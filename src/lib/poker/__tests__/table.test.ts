import { test } from "node:test";
import assert from "node:assert/strict";
import { knownPot, tableSeats } from "../table";
import { cbetFlop, rfiBtn } from "./fixtures";

test("RFI do BTN: quem age antes foldou, blinds esperam com as fichas", () => {
  const seats = tableSeats(rfiBtn);
  const by = Object.fromEntries(seats.map((s) => [s.position, s]));
  for (const p of ["UTG", "UTG1", "MP", "LJ", "HJ", "CO"]) assert.equal(by[p].status, "folded", p);
  assert.equal(by.BTN.status, "hero");
  assert.equal(by.BTN.isButton, true);
  assert.equal(by.BTN.offset, 0);
  assert.equal(by.SB.status, "waiting");
  assert.equal(by.SB.posted, 0.5);
  assert.equal(by.BB.posted, 1);
  assert.equal(by.SB.offset, 1);
  assert.equal(by.UTG.offset, 3);
  assert.equal(knownPot(rfiBtn), 1.5);
});

test("RFI do UTG: ninguém foldou ainda", () => {
  const seats = tableSeats({ ...rfiBtn, heroPosition: "UTG" });
  assert.ok(seats.filter((s) => s.status !== "hero").every((s) => s.status === "waiting"));
});

test("vilão que aumentou aparece como raise; pós-flop só herói e vilão", () => {
  const vsRfi = tableSeats({ ...rfiBtn, heroPosition: "BB", villainPosition: "CO" });
  assert.equal(vsRfi.find((s) => s.position === "CO")!.status, "raised");
  assert.equal(vsRfi.find((s) => s.position === "BTN")!.status, "folded");
  assert.equal(knownPot({ ...rfiBtn, villainPosition: "CO" }), null);
  const post = tableSeats(cbetFlop);
  assert.deepEqual(
    post.filter((s) => s.status !== "folded").map((s) => [s.position, s.status]),
    [
      ["BTN", "hero"],
      ["BB", "active"],
    ],
  );
  assert.ok(post.every((s) => s.posted === 0));
  assert.equal(knownPot(cbetFlop), null);
});

test("stacks na mesa: PKO cobrindo 60×50 e coberto 50×60", async () => {
  const { tableStacks } = await import("../table");
  const base = { ...rfiBtn, stack: { min: 50, max: 50 } };
  assert.deepEqual(tableStacks(base), { hero: 50, others: 50 });
  assert.deepEqual(tableStacks({ ...base, pko: { coverage: "cobrindo" } }), { hero: 60, others: 50 });
  assert.deepEqual(tableStacks({ ...base, pko: { coverage: "coberto" } }), { hero: 50, others: 60 });
  assert.deepEqual(tableStacks({ ...base, pko: { coverage: "cobrindo", heroStack: 80 } }), { hero: 80, others: 50 });
  assert.equal(tableStacks(rfiBtn), null, "faixa de stack (10–15bb) mostra a faixa");
});

test("jogadores restantes: ITM 17, proporção p:1 = 17 × p, bolha de 20 a 18", async () => {
  const { playersLeft, seedFrom } = await import("../table");
  assert.equal(playersLeft({ ratio: { min: 2, max: 2 }, bubble: null }), 34);
  assert.equal(playersLeft({ ratio: { min: 3, max: 3 }, bubble: null }), 51);
  assert.equal(playersLeft({ ratio: { min: 1.5, max: 1.5 }, bubble: null }), 26);
  assert.equal(playersLeft({ ratio: null, bubble: null }), null);
  for (let seed = 0; seed < 30; seed++) {
    const n = playersLeft({ ratio: null, bubble: "itm-nao-garantido" }, seed)!;
    assert.ok(n >= 18 && n <= 20, `bolha: ${n}`);
  }
  // a mesma mão sempre mostra o mesmo número
  assert.equal(playersLeft({ ratio: null, bubble: "itm-garantido" }, seedFrom("AsKd")), playersLeft({ ratio: null, bubble: "itm-garantido" }, seedFrom("AsKd")));
});

test("fim de torneio: só o herói tem o stack do spot; vilões sorteados em volta de uma média aleatória", async () => {
  const { randomVillainStacks } = await import("../table");
  const spot = { ...rfiBtn, stack: { min: 4, max: 4 }, ratio: { min: 2, max: 2 } };
  const a = randomVillainStacks(spot, 123)!;
  assert.equal(a.BTN, undefined, "herói não entra");
  assert.equal(Object.keys(a).length, 8);
  assert.deepEqual(randomVillainStacks(spot, 123), a, "mesma mão, mesma mesa");
  const averages = new Set<number>();
  for (let seed = 1; seed < 40; seed++) {
    const v = Object.values(randomVillainStacks(spot, seed * 7919)!) as number[];
    assert.ok(v.every((x) => x >= 2 && x <= 75));
    averages.add(Math.round(v.reduce((s, x) => s + x, 0) / v.length / 5));
  }
  assert.ok(averages.size >= 3, "a média da mesa muda de mão para mão");
  assert.equal(randomVillainStacks({ ...rfiBtn, ratio: null, bubble: null }, 1), null, "sem proporção/bolha: igual ao herói");
});

test("vs resteal: herói com stack sorteado na faixa, vilão all-in com o stack inteiro", async () => {
  const { tableState, heroStackFor } = await import("../table");
  const spot = { ...rfiBtn, situation: "vs resteal", heroPosition: "CO" as const, villainPosition: "BB" as const,
    stack: { min: 12, max: 15 }, randomStacks: true, villainAllIn: true };
  const heroes = new Set<number>();
  for (let seed = 1; seed < 200; seed += 3) {
    const hero = heroStackFor(spot, seed)!;
    assert.ok(Number.isInteger(hero) && hero >= 12 && hero <= 15);
    heroes.add(hero);
    const t = tableState(spot, seed);
    const bb = t.seats.find((s) => s.position === "BB")!;
    const co = t.seats.find((s) => s.position === "CO")!;
    assert.equal(t.remaining!.BB, 0, "vilão foi all-in");
    assert.equal(co.posted, 2, "herói abriu 2bb");
    assert.equal(t.remaining!.CO, hero - 2);
    assert.equal(t.raiseLabel, "All-in");
    assert.equal(t.pot, Math.round((bb.posted + 2 + 0.5) * 10) / 10);
  }
  assert.equal(heroes.size, 4, "12, 13, 14 e 15 aparecem");
});

test("PKO coberto com stacks aleatórios: todo vilão cobre o herói", async () => {
  const { tableState } = await import("../table");
  const spot = { ...rfiBtn, stack: { min: 20, max: 20 }, ratio: null, randomStacks: true, pko: { coverage: "coberto" as const, heroStack: 20 } };
  for (let seed = 1; seed < 100; seed += 7) {
    const t = tableState(spot, seed);
    for (const seat of t.seats)
      if (seat.status !== "hero") assert.ok(t.remaining![seat.position]! + seat.posted > 20, `${seat.position} cobre`);
  }
});
