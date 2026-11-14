'use strict';
const wait = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
async function sequential() {
  const a = await wait(5, 1);
  const b = await wait(1, 2);
  return a + b;
}
async function parallel() {
  return Promise.all([wait(5, 'a'), wait(1, 'b')]);
}
async function failing() {
  await wait(1);
  throw new RangeError('async boom');
}
function returnsPromise() {
  return wait(2, 'plain');
}
const order = [];
async function ordering() {
  order.push('start');
  await null;
  order.push('after await');
}
(async () => {
  console.log(await sequential(), await parallel(), await returnsPromise());
  try {
    await failing();
  } catch (error) {
    console.log(error.name, error.message, error instanceof RangeError);
  }
  const p = ordering();
  order.push('sync after call');
  await p;
  console.log(order.join(' > '));
  const settled = await Promise.allSettled([failing(), wait(1, 'ok')]);
  console.log(settled.map((result) => result.status));
})();
