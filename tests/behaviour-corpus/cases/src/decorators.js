'use strict';
// Shaped like tsc output for legacy decorators (experimentalDecorators), as in NestJS apps.
var __decorate =
  (this && this.__decorate) ||
  function (decorators, target, key, desc) {
    var c = arguments.length,
      r =
        c < 3
          ? target
          : desc === null
            ? (desc = Object.getOwnPropertyDescriptor(target, key))
            : desc,
      d;
    for (var i = decorators.length - 1; i >= 0; i--)
      if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return (c > 3 && r && Object.defineProperty(target, key, r), r);
  };
const calls = [];
function Log(label) {
  return function (target, key, descriptor) {
    const original = descriptor.value;
    descriptor.value = function (...args) {
      calls.push(`${label}:${String(key)}`);
      return original.apply(this, args);
    };
    return descriptor;
  };
}
function Sealed(constructor) {
  Object.seal(constructor);
  return constructor;
}
let Service = class Service {
  total(a, b) {
    return a + b;
  }
};
__decorate([Log('trace')], Service.prototype, 'total', null);
Service = __decorate([Sealed], Service);
exports.Service = Service;
console.log(new Service().total(2, 3), calls, Object.isSealed(Service), Service.name);
