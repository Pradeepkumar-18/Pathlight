'use strict';
function* count(n) {
  for (let i = 0; i < n; i += 1) yield i;
  return 'done';
}
async function* ticks() {
  yield 1;
  await null;
  yield 2;
}
const it = count(3);
console.log([...count(3)], it.next(), it.next(), it.next(), it.next());
(async () => {
  const seen = [];
  for await (const tick of ticks()) seen.push(tick);
  console.log(seen);
})();
