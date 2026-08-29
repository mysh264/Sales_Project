// In-memory stub for next/headers used by the live action harness.
let store = new Map();

export function __setCookie(name, value) {
  if (value == null) store.delete(name);
  else store.set(name, value);
}
export function __clear() { store = new Map(); }

export function cookies() {
  return {
    get(name) {
      const v = store.get(name);
      return v == null ? undefined : { name, value: v };
    },
    set(name, value) {
      store.set(name, typeof value === "string" ? value : value.value);
    },
    delete(name) { store.delete(name); },
    has(name) { return store.has(name); },
  };
}

// audit.ts calls headers() to capture IP/user-agent. Return a minimal stub.
export function headers() {
  return new Map([
    ["x-forwarded-for", ""],
    ["user-agent", "live-harness"],
  ]);
}
