async function test() {
  const res = await fetch("http://localhost:3000/api/search?q=tt1375666");
  const data = await res.json();
  console.log(data);
}
test();
