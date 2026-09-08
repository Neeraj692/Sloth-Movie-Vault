import express from "express";
import pg from "pg";
import dotenv from "dotenv";
import { OAuth2Client } from 'google-auth-library';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let pool: pg.Pool | null = null;
const googleClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is missing. Database features will not work.");
} else {
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });

  pool.query(`
    CREATE TABLE IF NOT EXISTS Users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE Users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
    ALTER TABLE Users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    ALTER TABLE Users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    ALTER TABLE Users ADD COLUMN IF NOT EXISTS picture TEXT;

    CREATE TABLE IF NOT EXISTS Movies (
      id VARCHAR(50) PRIMARY KEY,
      imdb_id VARCHAR(50),
      title TEXT NOT NULL,
      poster_url TEXT,
      imdb_rating VARCHAR(50),
      year VARCHAR(50),
      genre TEXT,
      runtime INTEGER,
      overview TEXT
    );

    CREATE TABLE IF NOT EXISTS UserMovies (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
      movie_id VARCHAR(50) REFERENCES Movies(id) ON DELETE CASCADE,
      status VARCHAR(50) DEFAULT 'wishlist',
      remark TEXT,
      added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, movie_id)
    );
  `).then(() => console.log("PostgreSQL Database initialized"))
    .catch(err => console.error("Error initializing PostgreSQL database:", err));
}

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;

// Verify user authorization for state modifications
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const username = req.params.username;
  if (!username) return next();
  
  const norm = username.toLowerCase().trim();
  if (!pool) return next();

  try {
    const userRes = await pool.query("SELECT * FROM Users WHERE username = $1", [norm]);
    const user = userRes.rows[0];
    
    // If user doesn't exist, allow creating it without auth for backward compatibility
    if (!user) return next();
    
    // If user has no google_id, it is a public account (backward compatibility)
    if (!user.google_id) return next();

    // User is protected, check token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized. This watchlist is protected by Google Sign-In." });
    }

    const token = authHeader.split(" ")[1];
    const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (payload?.sub !== user.google_id) {
      return res.status(403).json({ error: "Forbidden. You are not the owner of this watchlist." });
    }
    
    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ error: "Invalid or expired authentication token." });
  }
}

// Auth Route
app.post("/api/auth/google", async (req, res) => {
  try {
    const { credential, claimUsername } = req.body;
    if (!pool) throw new Error("Database not configured");

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid payload");

    const googleId = payload.sub;
    const email = payload.email || '';
    const name = payload.name || '';
    const picture = payload.picture || '';

    // 1. Check if googleId already exists
    let userRes = await pool.query("SELECT * FROM Users WHERE google_id = $1", [googleId]);
    if (userRes.rows.length > 0) {
      return res.json({ user: userRes.rows[0], token: credential });
    }

    // 2. Claim existing username if it has no google_id
    if (claimUsername) {
      const norm = claimUsername.toLowerCase().trim();
      let claimRes = await pool.query("SELECT * FROM Users WHERE username = $1", [norm]);
      if (claimRes.rows.length > 0 && !claimRes.rows[0].google_id) {
         const updated = await pool.query(
           "UPDATE Users SET google_id = $1, email = $2, name = $3, picture = $4 WHERE username = $5 RETURNING *",
           [googleId, email, name, picture, norm]
         );
         return res.json({ user: updated.rows[0], token: credential });
      }
    }
    
    // 3. Create a new user
    let baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let finalUsername = baseUsername;
    let counter = 1;
    while (true) {
       let check = await pool.query("SELECT id FROM Users WHERE username = $1", [finalUsername]);
       if (check.rows.length === 0) break;
       finalUsername = `${baseUsername}${counter}`;
       counter++;
    }
    
    let newRes = await pool.query(
      "INSERT INTO Users (username, google_id, email, name, picture) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [finalUsername, googleId, email, name, picture]
    );
    return res.json({ user: newRes.rows[0], token: credential });

  } catch (error) {
    console.error("Auth verify error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
});

// Get or create user
async function getOrCreateUser(username: string) {
  if (!pool) throw new Error("Database not configured. Please add DATABASE_URL.");
  const normalizedUsername = username.toLowerCase().trim();
  let userRes = await pool.query("SELECT id FROM Users WHERE username = $1", [normalizedUsername]);
  if (userRes.rows.length === 0) {
    userRes = await pool.query("INSERT INTO Users (username) VALUES ($1) RETURNING id", [normalizedUsername]);
  }
  return userRes.rows[0].id;
}

app.use((req, _res, next) => {
  console.log("Catch-all route hit! req.url:", req.url, "req.path:", req.path, "req.query:", req.query);
  next();
});

app.get(["/api/search", "/search"], async (req, res) => {
  console.log("Search route hit! Query:", req.query);
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    
    console.log("TMDB_API_KEY available:", !!TMDB_API_KEY);
    
    // If we have TMDB API key, always search TMDB for best results
    if (TMDB_API_KEY) {
      try {
        const queryStr = String(q).trim();
        const isImdbId = /^tt\d+$/i.test(queryStr);
        let results: any[] = [];
        let searchSuccess = false;

        if (isImdbId) {
          console.log("Searching by IMDB ID:", queryStr);
          const findRes = await fetch(`https://api.themoviedb.org/3/find/${queryStr}?api_key=${TMDB_API_KEY}&external_source=imdb_id`);
          if (findRes.ok) {
            const findData = await findRes.json();
            results = findData.movie_results || [];
            searchSuccess = true;
          } else {
            console.error("TMDB find failed with status:", findRes.status);
          }
        } else {
          console.log("Searching by text:", queryStr);
          const searchRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(queryStr)}&page=1`);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            results = searchData.results || [];
            searchSuccess = true;
          } else {
            console.error("TMDB search failed with status:", searchRes.status);
            const errorText = await searchRes.text();
            console.error("TMDB search error response:", errorText);
          }
        }

        if (searchSuccess) {
          console.log("Search successful, returning", results.length, "results");
          return res.json(results.map((m: any) => ({
            id: isImdbId ? queryStr : m.id.toString(),
            title: m.title,
            poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
            imdb_rating: m.vote_average ? Number(m.vote_average).toFixed(1) : null,
            year: m.release_date ? m.release_date.substring(0, 4) : null,
            overview: m.overview || ''
          })));
        }
      } catch (err) {
        console.error("TMDB fetch error:", err);
      }
    } else {
      console.log("No TMDB_API_KEY found in environment variables");
    }
    
    // User requested to ONLY search from API, so return empty array instead of DB fallback.
    return res.json([]);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Failed to search movies" });
  }
});

app.post(["/api/users/:username/movies", "/users/:username/movies"], requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const { movieId } = req.body; 
    
    if (!movieId) return res.status(400).json({ error: "Movie ID is required" });

    const userId = await getOrCreateUser(username);
    
    // Fetch from TMDB to populate Movies table
    if (TMDB_API_KEY) {
      try {
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
        if (tmdbRes.ok) {
          const tmdbData = await tmdbRes.json();
          
          // Insert into Movies table using the requested movieId to maintain consistency with testcases
          if (pool) {
            await pool.query(`
              INSERT INTO Movies (id, imdb_id, title, poster_url, imdb_rating, year, genre, runtime, overview)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (id) DO UPDATE SET
                imdb_id = EXCLUDED.imdb_id,
                genre = EXCLUDED.genre,
                runtime = EXCLUDED.runtime,
                overview = EXCLUDED.overview,
                imdb_rating = EXCLUDED.imdb_rating
            `, [
              movieId.toString(),
              tmdbData.imdb_id,
              tmdbData.title,
              tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : "",
              tmdbData.vote_average ? Number(tmdbData.vote_average).toFixed(1) : "N/A",
              tmdbData.release_date ? tmdbData.release_date.substring(0, 4) : "N/A",
              tmdbData.genres ? tmdbData.genres.map((g: any) => g.name).join(', ') : "N/A",
              tmdbData.runtime || 0,
              tmdbData.overview || ""
            ]);
          }
        }
      } catch (err) {
        console.error("Error fetching/saving movie details:", err);
        // Continue even if TMDB fetch fails, we'll just save the ID
      }
    }

    // Add to UserMovies
    try {
      if (!pool) throw new Error("Database not configured");
      await pool.query(`
        INSERT INTO UserMovies (user_id, movie_id, status)
        VALUES ($1, $2, 'wishlist')
      `, [userId, movieId.toString()]);
    } catch (err: any) {
      console.error("DB Error in POST /movies:", err);
      if (err.code === '23505') { // unique violation
        return res.status(400).json({ error: "Movie already in your watchlist" });
      }
      throw err;
    }

    res.json({ success: true, movieId: movieId.toString() });
  } catch (error: any) {
    console.error("Error adding movie:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

app.get(["/api/users/:username/movies", "/users/:username/movies"], async (req, res) => {
  try {
    const { username } = req.params;
    const userId = await getOrCreateUser(username);

    if (!pool) throw new Error("Database not configured");
    const result = await pool.query(`
      SELECT 
        um.movie_id, um.status, um.remark, um.added_date,
        m.imdb_id, m.title, m.poster_url, m.imdb_rating, m.year, m.genre, m.runtime, m.overview
      FROM UserMovies um
      LEFT JOIN Movies m ON um.movie_id = m.id
      WHERE um.user_id = $1
      ORDER BY um.added_date DESC
    `, [userId]);

    const movies = result.rows.map((row) => {
      // Clean up legacy rating format if present (e.g. "⭐ 8.5 / 10" -> "8.5")
      let cleanRating = row.imdb_rating ? String(row.imdb_rating) : "N/A";
      if (cleanRating.includes('⭐')) {
        cleanRating = cleanRating.replace('⭐ ', '').replace(' / 10', '');
      }

      return {
        id: row.movie_id,
        imdb_id: row.imdb_id || "",
        title: row.title || "Unknown Title",
        poster_url: row.poster_url || "",
        imdb_rating: cleanRating,
        year: row.year || "N/A",
        genre: row.genre || "N/A",
        runtime: row.runtime || 0,
        overview: row.overview || "",
        status: row.status,
        remark: row.remark,
        added_date: row.added_date
      };
    });

    res.json(movies);
  } catch (error) {
    console.error("Error fetching movies:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put(["/api/users/:username/movies/:movieId/status", "/users/:username/movies/:movieId/status"], requireAuth, async (req, res) => {
  try {
    const { username, movieId } = req.params;
    const { status } = req.body; // 'wishlist' or 'watched'
    const userId = await getOrCreateUser(username);

    if (!pool) throw new Error("Database not configured");
    await pool.query(`
      UPDATE UserMovies 
      SET status = $1 
      WHERE user_id = $2 AND movie_id = $3
    `, [status, userId, movieId]);

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete(["/api/users/:username/movies/:movieId", "/users/:username/movies/:movieId"], requireAuth, async (req, res) => {
  try {
    const { username, movieId } = req.params;
    const userId = await getOrCreateUser(username);

    if (!pool) throw new Error("Database not configured");
    await pool.query(`
      DELETE FROM UserMovies 
      WHERE user_id = $1 AND movie_id = $2
    `, [userId, movieId]);

    // Delete from Movies if no other user has it in their watchlist
    await pool.query(`
      DELETE FROM Movies 
      WHERE id = $1 AND NOT EXISTS (
        SELECT 1 FROM UserMovies WHERE movie_id = $1
      )
    `, [movieId]);

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting movie:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
