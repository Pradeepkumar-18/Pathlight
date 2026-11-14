'use strict';
// Expected to differ in the spike (see known-differences.json): Function.prototype.toString
// returns the source as loaded, which includes the inserted probes.
function add(a, b) {
  return a + b;
}
console.log(add(1, 2), add.toString());
