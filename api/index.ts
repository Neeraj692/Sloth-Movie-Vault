import express from "express";
import pg from "pg";
const { Pool } = pg;
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const isPostgres = !!process.env.DATABASE_URL;

let db: any;
let pool: Pool | null = null;

if (isPostgres) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });

  pool.query(`
    CREATE TABLE IF NOT EXISTS Movies (
      Id VARCHAR(50) PRIMARY KEY,
      Title VARCHAR(255),
      PosterUrl TEXT,
      ImdbRating VARCHAR(10),
      Year VARCHAR(10),
      Genre VARCHAR(255),
      Description TEXT,
      Watched INTEGER DEFAULT 0,
      Remark TEXT
    )
  `).then(() => console.log("PostgreSQL Database initialized"))
    .catch(err => console.error("Error initializing PostgreSQL database:", err));
} else {
  // Only import better-sqlite3 if not using Postgres (to avoid Vercel build issues)
  import("better-sqlite3").then((Database) => {
    try {
      db = new Database.default("movievault.db");
      db.exec(`
        CREATE TABLE IF NOT EXISTS Movies (
          Id TEXT PRIMARY KEY,
          Title TEXT,
          PosterUrl TEXT,
          ImdbRating TEXT,
          Year TEXT,
          Genre TEXT,
          Description TEXT,
          Watched INTEGER DEFAULT 0,
          Remark TEXT
        )
      `);
      console.log("SQLite Database initialized");
    } catch (e) {
      console.error("SQLite initialization failed.", e);
    }
  }).catch(e => console.error("Failed to load better-sqlite3", e));
}

app.post("/api/movies/add", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const match = url.match(/title\/(tt\d+)/);
    if (!match) return res.status(400).json({ error: "Invalid IMDb URL. Expected format: https://www.imdb.com/title/tt1234567/" });

    const imdbId = match[1];

    if (isPostgres) {
      const existing = await pool!.query("SELECT * FROM Movies WHERE Id = $1", [imdbId]);
      if (existing.rows.length > 0) return res.status(400).json({ error: "Movie already in watchlist" });
    } else {
      if (!db) return res.status(500).json({ error: "Database not initialized" });
      const existing = db.prepare("SELECT * FROM Movies WHERE Id = ?").get(imdbId);
      if (existing) return res.status(400).json({ error: "Movie already in watchlist" });
    }

    const apiKey = process.env.TMDB_API_KEY || "614552faab6649681934deb55ec2004b";
    
    const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`);
    const findData = await findRes.json();
    
    let data = null;
    let mediaType = 'movie';
    
    if (findData.movie_results && findData.movie_results.length > 0) {
      data = findData.movie_results[0];
    } else if (findData.tv_results && findData.tv_results.length > 0) {
      data = findData.tv_results[0];
      mediaType = 'tv';
    }

    if (!data) {
      return res.status(400).json({ error: "Movie or TV show not found on TMDB." });
    }
    
    // Fetch full details to get genres
    const detailsRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${data.id}?api_key=${apiKey}`);
    const detailsData = await detailsRes.json();
    
    let imdbRating = detailsData.vote_average ? detailsData.vote_average.toFixed(1) : "N/A";
    
    try {
      const omdbRes = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=trilogy`);
      const omdbData = await omdbRes.json();
      if (omdbData.imdbRating && omdbData.imdbRating !== "N/A") {
        imdbRating = omdbData.imdbRating;
      }
    } catch (e) {
      console.error("OMDB fetch error:", e);
    }

    const values = [
      imdbId,
      detailsData.title || detailsData.name || "Unknown Title",
      detailsData.poster_path ? `https://image.tmdb.org/t/p/w500${detailsData.poster_path}` : "",
      imdbRating,
      (detailsData.release_date || detailsData.first_air_date) ? (detailsData.release_date || detailsData.first_air_date).substring(0, 4) : "N/A",
      detailsData.genres ? detailsData.genres.map((g: any) => g.name).join(', ') : "N/A",
      detailsData.overview || ""
    ];

    if (isPostgres) {
      const query = `
        INSERT INTO Movies (Id, Title, PosterUrl, ImdbRating, Year, Genre, Description, Watched, Remark)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 0, '')
        RETURNING *
      `;
      const result = await pool!.query(query, values);
      res.json(result.rows[0]);
    } else {
      const stmt = db.prepare(`
        INSERT INTO Movies (Id, Title, PosterUrl, ImdbRating, Year, Genre, Description, Watched, Remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, '')
      `);
      stmt.run(...values);
      const newMovie = db.prepare("SELECT * FROM Movies WHERE Id = ?").get(imdbId);
      res.json(newMovie);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/movies", async (req, res) => {
  try {
    if (isPostgres) {
      const result = await pool!.query("SELECT * FROM Movies ORDER BY Id DESC");
      res.json(result.rows);
    } else {
      if (!db) return res.status(500).json({ error: "Database not initialized" });
      const movies = db.prepare("SELECT * FROM Movies ORDER BY rowid DESC").all();
      res.json(movies);
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/movies/:id", async (req, res) => {
  try {
    if (isPostgres) {
      const result = await pool!.query("SELECT * FROM Movies WHERE Id = $1", [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: "Movie not found" });
      res.json(result.rows[0]);
    } else {
      if (!db) return res.status(500).json({ error: "Database not initialized" });
      const movie = db.prepare("SELECT * FROM Movies WHERE Id = ?").get(req.params.id);
      if (!movie) return res.status(404).json({ error: "Movie not found" });
      res.json(movie);
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/movies/watch-status", async (req, res) => {
  try {
    const { id, watched, remark } = req.body;
    if (isPostgres) {
      const query = "UPDATE Movies SET Watched = $1, Remark = $2 WHERE Id = $3 RETURNING *";
      const result = await pool!.query(query, [watched ? 1 : 0, remark || "", id]);
      res.json(result.rows[0]);
    } else {
      if (!db) return res.status(500).json({ error: "Database not initialized" });
      const stmt = db.prepare("UPDATE Movies SET Watched = ?, Remark = ? WHERE Id = ?");
      stmt.run(watched ? 1 : 0, remark || "", id);
      const updated = db.prepare("SELECT * FROM Movies WHERE Id = ?").get(id);
      res.json(updated);
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/movies/:id", async (req, res) => {
  try {
    if (isPostgres) {
      await pool!.query("DELETE FROM Movies WHERE Id = $1", [req.params.id]);
    } else {
      if (!db) return res.status(500).json({ error: "Database not initialized" });
      db.prepare("DELETE FROM Movies WHERE Id = ?").run(req.params.id);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
