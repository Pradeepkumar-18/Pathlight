// No "use strict": sloppy-mode `this` and `arguments` aliasing must survive too.
function sloppyThis() {
  return this === globalThis;
}
function strictThis() {
  'use strict';
  return this;
}
function args() {
  return [arguments.length, Array.prototype.slice.call(arguments)];
}
function mutateArguments(a) {
  arguments[0] = 'changed';
  return a;
}
function withNewTarget() {
  return new.target === withNewTarget;
}
const bound = function () {
  return this.id;
}.bind({ id: 42 });
console.log(
  sloppyThis(),
  strictThis(),
  args(1, 'two', [3]),
  mutateArguments('original'),
  new withNewTarget() instanceof withNewTarget,
  withNewTarget(),
  bound(),
);
