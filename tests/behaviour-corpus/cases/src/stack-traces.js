'use strict';
// Function names and line numbers only. The spike shifts columns on lines where it inserts
// probes (a finding for decision 0002), so columns are left out here on purpose.
function level3() {
  throw new Error('deep');
}
function level2() {
  return level3();
}
function level1() {
  return level2();
}
try {
  level1();
} catch (error) {
  const frames = error.stack
    .split('\n')
    .slice(1, 4)
    .map((line) =>
      line
        .trim()
        .replace(/:(\d+):\d+\)?$/, ':$1')
        .replace(/\(.*[\\/]/, '('),
    );
  console.log(error.message, frames);
}
