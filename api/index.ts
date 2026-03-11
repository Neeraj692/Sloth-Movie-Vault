import express from "express";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is missing. Please set it to connect to Neon DB.");
}

const pool = new pg.Pool({
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

const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY;

// Get or create user
async function getOrCreateUser(username: string) {
  const normalizedUsername = username.toLowerCase().trim();
  let userRes = await pool.query("SELECT id FROM Users WHERE username = $1", [normalizedUsername]);
  if (userRes.rows.length === 0) {
    userRes = await pool.query("INSERT INTO Users (username) VALUES ($1) RETURNING id", [normalizedUsername]);
  }
  return userRes.rows[0].id;
}

app.get("/api/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    
    // 1. Search DB first
    const dbRes = await pool.query(
      "SELECT * FROM Movies WHERE title ILIKE $1 LIMIT 20",
      [`%${q}%`]
    );
    
    if (dbRes.rows.length > 0) {
      return res.json(dbRes.rows);
    }
    
    // 2. If not found, fetch from TMDB
    if (!TMDB_API_KEY) return res.json([]);
    const searchRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q as string)}&page=1`);
    const searchData = await searchRes.json();
    const results = searchData.results || [];
    
    // 3. Store in Movies table
    for (const movie of results) {
      try {
        await pool.query(`
          INSERT INTO Movies (id, title, poster_url, imdb_rating, year, overview)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING
        `, [
          movie.id.toString(),
          movie.title,
          movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
          movie.vote_average ? movie.vote_average.toString() : null,
          movie.release_date ? movie.release_date.substring(0, 4) : null,
          movie.overview || ''
        ]);
      } catch (e) {
        console.error("Error inserting movie:", e);
      }
    }
    
    // Return the newly fetched and stored results
    const newDbRes = await pool.query(
      "SELECT * FROM Movies WHERE title ILIKE $1 LIMIT 20",
      [`%${q}%`]
    );
    
    if (newDbRes.rows.length > 0) {
      res.json(newDbRes.rows);
    } else {
      res.json(results.map((m: any) => ({
        id: m.id.toString(),
        title: m.title,
        poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
        imdb_rating: m.vote_average ? m.vote_average.toString() : null,
        year: m.release_date ? m.release_date.substring(0, 4) : null,
        overview: m.overview || ''
      })));
    }
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Failed to search movies" });
  }
});

app.post("/api/users/:username/movies", async (req, res) => {
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
          
          // Insert into Movies table
          await pool.query(`
            INSERT INTO Movies (id, imdb_id, title, poster_url, imdb_rating, year, genre, runtime, overview)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
          `, [
            tmdbData.id.toString(),
            tmdbData.imdb_id,
            tmdbData.title,
            tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : "",
            tmdbData.vote_average ? `⭐ ${tmdbData.vote_average.toFixed(1)} / 10` : "N/A",
            tmdbData.release_date ? tmdbData.release_date.substring(0, 4) : "N/A",
            tmdbData.genres ? tmdbData.genres.map((g: any) => g.name).join(', ') : "N/A",
            tmdbData.runtime || 0,
            tmdbData.overview || ""
          ]);
        }
      } catch (err) {
        console.error("Error fetching/saving movie details:", err);
        // Continue even if TMDB fetch fails, we'll just save the ID
      }
    }

    // Add to UserMovies
    try {
      await pool.query(`
        INSERT INTO UserMovies (user_id, movie_id, status)
        VALUES ($1, $2, 'wishlist')
      `, [userId, movieId.toString()]);
    } catch (err: any) {
      if (err.code === '23505') { // unique violation
        return res.status(400).json({ error: "Movie already in your watchlist" });
      }
      throw err;
    }

    res.json({ success: true, movieId });
  } catch (error: any) {
    console.error("Error adding movie:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

app.get("/api/users/:username/movies", async (req, res) => {
  try {
    const { username } = req.params;
    const userId = await getOrCreateUser(username);

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
      return {
        id: row.movie_id,
        imdb_id: row.imdb_id || "",
        title: row.title || "Unknown Title",
        poster_url: row.poster_url || "",
        imdb_rating: row.imdb_rating || "N/A",
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

app.put("/api/users/:username/movies/:movieId/status", async (req, res) => {
  try {
    const { username, movieId } = req.params;
    const { status } = req.body; // 'wishlist' or 'watched'
    const userId = await getOrCreateUser(username);

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

app.delete("/api/users/:username/movies/:movieId", async (req, res) => {
  try {
    const { username, movieId } = req.params;
    const userId = await getOrCreateUser(username);

    await pool.query(`
      DELETE FROM UserMovies 
      WHERE user_id = $1 AND movie_id = $2
    `, [userId, movieId]);

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting movie:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
