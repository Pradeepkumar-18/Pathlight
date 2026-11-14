'use strict';
// A rejection nobody handles must still crash the app (Node's default), traced or not.
process.on('exit', (code) => console.log('exit code', code));
async function failsLater() {
  await null;
  throw new Error('nobody handles me');
}
function startsWork() {
  return failsLater();
}
console.log('before');
startsWork();
