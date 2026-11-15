'use strict';
// Empty bodies (the probe's opening and closing text meet at one offset), arrows inside a
// derived constructor before super(), and arrow class fields that use `this`.
function noop() {}
const empty = () => {};
class Base {
  constructor(value) {
    this.value = value;
  }
  hook() {}
}
class Child extends Base {
  label = () => `child ${this.value}`;
  constructor() {
    const compute = () => 21 * 2;
    super(compute());
  }
  static make() {}
}
console.log(noop(), empty(), Child.make(), new Child().hook());
console.log(new Child().value, new Child().label());
