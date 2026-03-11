async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/users/neeraj/movies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId: "tt1375666" }) // IMDB ID instead of TMDB ID?
    });
    const data = await res.json();
    console.log("POST Status:", res.status);
    console.log("POST Data:", data);
  } catch (err) {
    console.error(err);
  }
}
test();
