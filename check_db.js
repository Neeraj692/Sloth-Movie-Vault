import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'usermovies'");
    console.log("Columns:", res.rows);
    
    const res2 = await pool.query("SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = 'usermovies'");
    console.log("Constraints:", res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

check();
