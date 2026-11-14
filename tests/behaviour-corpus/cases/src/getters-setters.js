'use strict';
let reads = 0;
class Temperature {
  #c = 0;
  get celsius() {
    reads += 1;
    return this.#c;
  }
  set celsius(v) {
    this.#c = v;
  }
  get fahrenheit() {
    return (this.celsius * 9) / 5 + 32;
  }
}
const obj = {
  _v: 1,
  get v() {
    reads += 1;
    return this._v;
  },
  set v(x) {
    this._v = x * 2;
  },
};
const t = new Temperature();
t.celsius = 100;
obj.v = 5;
const getter = Object.getOwnPropertyDescriptor(Temperature.prototype, 'celsius').get;
console.log(t.fahrenheit, obj.v, reads, getter.name);
