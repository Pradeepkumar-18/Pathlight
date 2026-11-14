'use strict';
let evaluated = 0;
const next = () => (evaluated += 1);
function greet(name = 'world', greeting = `hello ${name}`, count = next()) {
  return [greeting, count];
}
function destructure({ a = 1, b: { c = 2 } = {} } = {}, ...rest) {
  return [a, c, rest];
}
console.log(greet(), greet('Ada'), greet(undefined, 'hi'), evaluated);
console.log(
  destructure(),
  destructure({ a: 9, b: { c: 8 } }, 'x', 'y'),
  greet.length,
  destructure.length,
);
