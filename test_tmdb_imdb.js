import dotenv from 'dotenv';
dotenv.config();
async function test() {
  const res = await fetch(`https://api.themoviedb.org/3/movie/tt1375666?api_key=${process.env.VITE_TMDB_API_KEY}`);
  console.log(res.status);
  const data = await res.json();
  console.log(data.title);
}
test();
