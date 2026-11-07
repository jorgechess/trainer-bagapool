import { test } from "node:test";
import assert from "node:assert/strict";
import { createContentCache } from "../../content-cache";

function setup(opts: { checkMs?: number; maxAgeMs?: number } = {}) {
  let clock = 0;
  let version = "v1";
  let loads = 0;
  let checks = 0;
  let failVersion = false;
  const cache = createContentCache({
    now: () => clock,
    checkMs: opts.checkMs ?? 30_000,
    maxAgeMs: opts.maxAgeMs ?? 600_000,
    load: async () => `conteúdo ${++loads} (${version})`,
    readVersion: async () => {
      checks++;
      if (failVersion) throw new Error("banco fora");
      return version;
    },
  });
  return {
    cache,
    tick: (ms: number) => (clock += ms),
    setVersion: (v: string) => (version = v),
    failVersion: (f: boolean) => (failVersion = f),
    stats: () => ({ loads, checks }),
  };
}

test("cache do conteúdo: uma carga só, reaproveitada dentro da janela", async () => {
  const t = setup();
  const [a, b, c] = await Promise.all([t.cache.get(), t.cache.get(), t.cache.get()]);
  assert.equal(a, "conteúdo 1 (v1)");
  assert.equal(b, a);
  assert.equal(c, a);
  t.tick(10_000);
  assert.equal(await t.cache.get(), a);
  assert.deepEqual(t.stats(), { loads: 1, checks: 1 }, "leituras simultâneas e dentro de 30s não vão ao banco");
});

test("cache do conteúdo: confere a versão depois da janela e recarrega quando muda", async () => {
  const t = setup();
  await t.cache.get();
  t.tick(31_000);
  assert.equal(await t.cache.get(), "conteúdo 1 (v1)", "mesma versão: segue com a memória");
  assert.deepEqual(t.stats(), { loads: 1, checks: 2 });
  t.setVersion("v2");
  t.tick(31_000);
  assert.equal(await t.cache.get(), "conteúdo 2 (v2)");
});

test("cache do conteúdo: invalidate força a releitura e a idade máxima também", async () => {
  const t = setup();
  await t.cache.get();
  t.cache.invalidate();
  assert.equal(await t.cache.get(), "conteúdo 2 (v1)");
  t.tick(601_000);
  assert.equal(await t.cache.get(), "conteúdo 3 (v1)", "passou da idade máxima: relê mesmo sem mudar a versão");
});

test("cache do conteúdo: banco instável na conferência mantém o que está na memória", async () => {
  const t = setup();
  await t.cache.get();
  t.failVersion(true);
  t.tick(31_000);
  assert.equal(await t.cache.get(), "conteúdo 1 (v1)");
  assert.equal(t.stats().loads, 1);
});

test("cache do conteúdo: checkMs 0 confere a versão a cada leitura", async () => {
  const t = setup({ checkMs: 0 });
  await t.cache.get();
  await t.cache.get();
  t.setVersion("v2");
  assert.equal(await t.cache.get(), "conteúdo 2 (v2)");
  assert.deepEqual(t.stats(), { loads: 2, checks: 4 });
});
