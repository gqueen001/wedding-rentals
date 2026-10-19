import { assertEquals } from "@std/assert";
import { memoryKV, safeKV } from "./storage.ts";

class FakeStorage implements Storage {
  #m = new Map<string, string>();
  get length() {
    return this.#m.size;
  }
  clear() {
    this.#m.clear();
  }
  getItem(k: string) {
    return this.#m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.#m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.#m.delete(k);
  }
  setItem(k: string, v: string) {
    this.#m.set(k, v);
  }
}

const throwing = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new DOMException("full", "QuotaExceededError");
  },
  removeItem() {
    throw new Error("blocked");
  },
} as unknown as Storage;

Deno.test("memoryKV stores, reads and removes values", () => {
  const kv = memoryKV({ a: "1" });
  assertEquals(kv.get("a"), "1");
  kv.set("b", "2");
  assertEquals(kv.get("b"), "2");
  kv.remove("a");
  assertEquals(kv.get("a"), null);
});

Deno.test("safeKV writes through to the given storage", () => {
  const s = new FakeStorage();
  const kv = safeKV(s);
  kv.set("a", "1");
  assertEquals(s.getItem("a"), "1");
  assertEquals(kv.get("a"), "1");
  kv.remove("a");
  assertEquals(s.getItem("a"), null);
});

Deno.test("safeKV falls back to memory when storage throws", () => {
  const kv = safeKV(throwing);
  kv.set("a", "1");
  assertEquals(kv.get("a"), "1");
  kv.remove("a");
  assertEquals(kv.get("a"), null);
});

Deno.test("safeKV works without any storage", () => {
  const kv = safeKV(null);
  assertEquals(kv.get("a"), null);
  kv.set("a", "1");
  assertEquals(kv.get("a"), "1");
});
