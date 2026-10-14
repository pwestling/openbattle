// Only objects traversed successfully here are memoized: a shallow freeze from
// elsewhere says nothing about its children. Reducer folds share frozen branches.
const frozen = new WeakSet<object>();
const visiting = new WeakSet<object>();

/** Freeze a data tree in place, without copying structurally shared state.
 * Accessors cannot represent immutable data: their returned value may change
 * after freezing. Functions are code, not data owned by this boundary.
 */
export function immutable<T>(value: T): T {
  if (value === null || typeof value !== "object" || frozen.has(value)) return value;
  if (visiting.has(value)) throw new Error("Immutable data cannot contain cycles");
  visiting.add(value);
  try {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value)) {
      const property = Object.getOwnPropertyDescriptor(value, key)!;
      if (!("value" in property)) throw new Error("Immutable data cannot contain accessors");
      immutable(property.value);
    }
    frozen.add(value);
    return value;
  } finally {
    visiting.delete(value);
  }
}
