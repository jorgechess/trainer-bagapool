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
