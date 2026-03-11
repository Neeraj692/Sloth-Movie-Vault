async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/users/neeraj/movies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId: "123456" })
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Data:", data);
  } catch (err) {
    console.error(err);
  }
}
test();
