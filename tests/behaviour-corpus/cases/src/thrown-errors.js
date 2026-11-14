'use strict';
class DomainError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
const thrown = [];
function throwsError() {
  throw new DomainError('bad input', 'E_INPUT');
}
function throwsString() {
  throw 'just a string';
}
function throwsObject() {
  throw { code: 42 };
}
function returnsFromFinally() {
  try {
    return 'try';
  } finally {
    thrown.push('finally ran');
  }
}
function rethrows() {
  try {
    throwsError();
  } catch (error) {
    error.handled = true;
    throw error;
  }
}
for (const fn of [throwsError, throwsString, throwsObject, rethrows]) {
  try {
    fn();
  } catch (error) {
    thrown.push(
      error instanceof Error
        ? `${error.name}:${error.message}:${error.code}:${error.handled}`
        : JSON.stringify(error),
    );
  }
}
console.log(returnsFromFinally(), thrown);
const original = new TypeError('same object');
try {
  (function passThrough() {
    throw original;
  })();
} catch (error) {
  console.log(error === original);
}
