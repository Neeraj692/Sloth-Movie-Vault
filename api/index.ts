import express from "express";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const isPostgres = !!process.env.DATABASE_URL;

let db: any;
let pool: pg.Pool | null = null;
let dbInitialized = false;

async function initDb() {
  if (dbInitialized) return;
  
  if (isPostgres) {
    if (!pool) {
      pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      pool.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client', err);
      });
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS Movies (
          Id VARCHAR(50) PRIMARY KEY,
          Title TEXT,
          PosterUrl TEXT,
          ImdbRating VARCHAR(10),
          Year VARCHAR(10),
          Genre TEXT,
          Description TEXT,
          Watched INTEGER DEFAULT 0,
          Remark TEXT
        )
      `);
      console.log("PostgreSQL Database initialized");
      dbInitialized = true;
    } catch (err) {
      console.error("Error initializing PostgreSQL database:", err);
    }
  } else {
    if (!db) {
      // Only import better-sqlite3 if not using Postgres
      try {
        const Database = await import("better-sqlite3");
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
        dbInitialized = true;
      } catch (e) {
        console.error("SQLite initialization failed.", e);
      }
    }
  }
}

app.use(async (req, res, next) => {
  await initDb();
  next();
});

app.post("/api/movies/add", async (req, res) => {
  try {
    const { id, title, poster_path, vote_average, release_date, overview, genres, imdb_id } = req.body;
    
    if (!id) return res.status(400).json({ error: "Movie ID is required" });

    const movieId = imdb_id || id.toString();

    if (isPostgres) {
      const existing = await pool!.query("SELECT * FROM Movies WHERE Id = $1", [movieId]);
      if (existing.rows.length > 0) return res.status(400).json({ error: "Movie already in watchlist" });
    } else {
      if (!db) return res.status(500).json({ error: "Database not initialized" });
      const existing = db.prepare("SELECT * FROM Movies WHERE Id = ?").get(movieId);
      if (existing) return res.status(400).json({ error: "Movie already in watchlist" });
    }

    const posterUrl = poster_path ? (poster_path.startsWith('http') ? poster_path : `https://image.tmdb.org/t/p/w500${poster_path}`) : "";
    const year = release_date ? release_date.substring(0, 4) : "N/A";
    const genreStr = genres ? (Array.isArray(genres) ? genres.map((g: any) => g.name || g).join(', ') : genres) : "N/A";

    const values = [
      movieId,
      title || "Unknown Title",
      posterUrl,
      vote_average ? vote_average.toString() : "N/A",
      year,
      genreStr,
      overview || ""
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
      const newMovie = db.prepare("SELECT * FROM Movies WHERE Id = ?").get(movieId);
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
