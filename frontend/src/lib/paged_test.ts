import { assertEquals } from "@std/assert";
import { createPagedList } from "./paged.ts";
import type { Page } from "./types.ts";

function page(n: number, items: number[], total: number): Page<number> {
  return { items, page: n, per_page: 2, total };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

Deno.test("reset loads the first page and loadMore appends the next ones", async () => {
  const requested: number[] = [];
  const list = createPagedList((n) => {
    requested.push(n);
    return Promise.resolve(n === 1 ? page(1, [1, 2], 3) : page(2, [3], 3));
  });
  assertEquals(list.hasMore(), false);
  await list.reset();
  assertEquals(list.items(), [1, 2]);
  assertEquals(list.total(), 3);
  assertEquals(list.hasMore(), true);
  await list.loadMore();
  assertEquals(list.items(), [1, 2, 3]);
  assertEquals(list.hasMore(), false);
  await list.loadMore();
  assertEquals(requested, [1, 2]);
});

Deno.test("a response that arrives after a reset is ignored", async () => {
  const first = deferred<Page<number>>();
  let calls = 0;
  const list = createPagedList(() => (++calls === 1 ? first.promise : Promise.resolve(page(1, [9], 1))));
  const stale = list.reset();
  await list.reset();
  first.resolve(page(1, [1, 2], 2));
  await stale;
  assertEquals(list.items(), [9]);
  assertEquals(list.loading(), false);
});

Deno.test("an error is kept, loadMore waits, and retry loads the same page", async () => {
  let fail = true;
  const requested: number[] = [];
  const list = createPagedList((n) => {
    requested.push(n);
    if (n === 2 && fail) return Promise.reject(new Error("offline"));
    return Promise.resolve(page(n, n === 1 ? [1, 2] : [3, 4], 4));
  });
  await list.reset();
  await list.loadMore();
  assertEquals((list.error() as Error).message, "offline");
  await list.loadMore();
  assertEquals(requested, [1, 2]);
  fail = false;
  await list.retry();
  assertEquals(list.error(), null);
  assertEquals(list.items(), [1, 2, 3, 4]);
  assertEquals(requested, [1, 2, 2]);
});

Deno.test("an empty page stops paging even if total says otherwise", async () => {
  const list = createPagedList((n) => Promise.resolve(n === 1 ? page(1, [1, 2], 10) : page(2, [], 10)));
  await list.reset();
  await list.loadMore();
  assertEquals(list.items(), [1, 2]);
  assertEquals(list.hasMore(), false);
});
