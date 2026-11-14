'use strict';
const add = (a, b) => a + b;
const makeObject = () => ({ ok: true });
const curry = (a) => (b) => (c) => a + b + c;
const self = {
  name: 'outer',
  get: function () {
    return [1].map(() => this.name);
  },
};
const field = new (class {
  name = 'field';
  read = () => this.name;
})();
console.log(
  add(2, 3),
  makeObject(),
  curry(1)(2)(3),
  self.get(),
  field.read(),
  add.length,
  add.name,
);
// Minified shapes: no spaces before `}` and comma-joined declarations.
const minified=function(n){return n*2},noSpace=(x)=>{return x+1};
console.log(minified(4), noSpace(4));
