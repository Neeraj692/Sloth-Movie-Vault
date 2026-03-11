async function test() {
  const res = await fetch("http://localhost:3000/api/users/neeraj/movies");
  const data = await res.json();
  console.log(data);
}
test();
