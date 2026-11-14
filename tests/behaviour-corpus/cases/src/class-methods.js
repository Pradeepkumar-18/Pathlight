'use strict';
class Counter {
  constructor(start) {
    this.value = start;
  }
  increment(by = 1) {
    this.value += by;
    return this;
  }
  static from(n) {
    return new Counter(n);
  }
  #secret() {
    return 'hidden';
  }
  reveal() {
    return this.#secret();
  }
}
class Labeled extends Counter {
  increment(by) {
    super.increment(by);
    return this;
  }
  toString() {
    return `Labeled(${this.value})`;
  }
}
const c = Counter.from(1).increment().increment(5);
console.log(c.value, c instanceof Counter, c.reveal());
const l = new Labeled(10).increment(2);
console.log(
  String(l),
  Object.getPrototypeOf(l) === Labeled.prototype,
  Labeled.name,
  Counter.from.length,
);
