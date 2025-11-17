export function createStore(initialValue) {
  let value = initialValue;
  const listeners = new Set();

  function get() {
    return value;
  }

  function set(nextValue) {
    value = nextValue;
    listeners.forEach((listener) => {
      try {
        listener(value);
      } catch (err) {
        console.error("[i18n][store] listener error", err);
      }
    });
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { get, set, subscribe };
}

export function createDerivedStore(sourceStore, mapFn) {
  const derived = createStore(mapFn(sourceStore.get()));
  sourceStore.subscribe((value) => {
    derived.set(mapFn(value));
  });
  return derived;
}

export function createWritable(initialValue) {
  return createStore(initialValue);
}
