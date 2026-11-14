'use strict';
// Expected to differ in the spike (see known-differences.json): a function returning a
// native promise hands back a follow-on promise, so identity and custom properties change.
const shared = Promise.resolve('shared');
shared.extra = 'custom property';
function getShared() {
  return shared;
}
const got = getShared();
console.log(got === shared, got.extra);
