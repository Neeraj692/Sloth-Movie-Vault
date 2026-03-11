async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/debug/constraints");
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error(err);
  }
}
test();
