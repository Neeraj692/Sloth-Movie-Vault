async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/users/neeraj/movies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId: "27205" })
    });
    const data = await res.json();
    console.log("POST Status:", res.status);
    console.log("POST Data:", data);

    const res2 = await fetch("http://localhost:3000/api/users/neeraj/movies");
    const data2 = await res2.json();
    console.log("GET Status:", res2.status);
    console.log("GET Data:", data2.map(m => m.title));
  } catch (err) {
    console.error(err);
  }
}
test();
