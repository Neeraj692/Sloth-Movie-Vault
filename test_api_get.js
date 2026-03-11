async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/users/neeraj/movies");
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Data:", data);
  } catch (err) {
    console.error(err);
  }
}
test();
