/** Gerador de números aleatórios. Usa Math.random por padrão, mas aceita semente para testes. */
export type Rng = () => number;

/** RNG determinístico (mulberry32) — útil para testes e para reproduzir uma sessão. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const defaultRng: Rng = Math.random;

export function randomInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error("Lista vazia");
  return items[randomInt(rng, items.length)];
}

/** Escolhe um item com probabilidade proporcional ao peso. */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
  if (items.length === 0 || total <= 0) throw new Error("Nenhum item com peso positivo");
  let roll = rng() * total;
  for (const item of items) {
    roll -= Math.max(0, weight(item));
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
