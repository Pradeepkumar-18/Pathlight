// Object IDs (`data-model.md` §2, §3.4): the same object gets the same `obj_<n>` everywhere it
// appears, so the v2 data journey can follow it from step to step. A `WeakMap` holds the IDs:
// it never keeps an object alive, so the app's memory is unaffected however many requests run.
export interface ObjectIds {
  idOf: (value: object) => string;
}

export function createObjectIds(): ObjectIds {
  const ids = new WeakMap<object, number>();
  let last = 0;
  return {
    idOf(value) {
      let id = ids.get(value);
      if (id === undefined) {
        last += 1;
        id = last;
        ids.set(value, id);
      }
      return `obj_${id}`;
    },
  };
}
