async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/users/neeraj/movies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId: "550" }) // Fight Club
    });
    const data = await res.json();
    console.log("POST Status:", res.status);
    console.log("POST Data:", data);
  } catch (err) {
    console.error(err);
  }
}
test();
