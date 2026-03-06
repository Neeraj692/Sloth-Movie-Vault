import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query("SELECT * FROM Movies");
    console.log("Rows:", res.rows);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    pool.end();
  }
}

test();
