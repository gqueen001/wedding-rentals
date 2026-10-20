import { assertEquals } from "@std/assert";
import { createCitiesStore } from "./cities.ts";
import type { City } from "./types.ts";

const city = (id: number) => ({ id, slug: `c${id}` }) as City;
const settle = () => new Promise((r) => setTimeout(r, 0));

Deno.test("a failed fetch is retried by the next read, and a good one is kept", async () => {
  let calls = 0;
  const cities = createCitiesStore(() => (++calls === 1 ? Promise.reject(new Error("offline")) : Promise.resolve([city(1)])));
  assertEquals(cities(), []);
  await settle();
  assertEquals(calls, 1);
  assertEquals(cities(), []); // the failure is not cached: this read retries
  await settle();
  assertEquals(calls, 2);
  assertEquals(cities().map((c) => c.id), [1]);
  await settle();
  assertEquals(calls, 2);
});

Deno.test("reads while a fetch is running do not start another", async () => {
  let calls = 0;
  const cities = createCitiesStore(() => (++calls, Promise.resolve([city(1)])));
  cities();
  cities();
  await settle();
  assertEquals(calls, 1);
});
