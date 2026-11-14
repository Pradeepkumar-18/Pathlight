"use strict"
// Directives written without `;`, hoisting, `var` scope and a parameter named like a probe.
function strictInside() { "use strict"
  return this === undefined }
function usesHoisted() {
  return hoisted();
  function hoisted() {
    return 'hoisted';
  }
}
function usesVar() {
  if (true) {
    var later = 'var';
  }
  return later;
}
function shadowing(__pt$) {
  return __pt$;
}
console.log(strictInside(), usesHoisted(), usesVar(), shadowing('param named like a probe'));
