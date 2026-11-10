import { test } from "node:test";
import assert from "node:assert/strict";
import { handHistory, shortAction } from "../history";
import { DEFAULT_LEGEND } from "../legend";
import type { Card } from "../cards";

const legend = [
  ...DEFAULT_LEGEND,
  { id: "bet-25", label: "Bet 25%", color: "#000001", kind: "bet" as const, sizing: "25%" },
  { id: "bet-33", label: "Bet 33%", color: "#000002", kind: "bet" as const, sizing: "33%" },
];
const board = ["As", "7d", "2c", "Kh", "3s"] as Card[];

test("histórico: notação curta das ações", () => {
  assert.equal(shortAction("bet-25", legend), "B25");
  assert.equal(shortAction("fold", legend), "F");
  assert.equal(shortAction("shove", legend), "AI");
  assert.equal(shortAction("desconhecida", legend), "desconhecida");
});

test("histórico: linhas até a street da decisão, com as cartas de cada street", () => {
  const lines = handHistory(["HJ raise 2bb · BB call", "BB X · HJ B67 · BB C", "BB X"], "turn", board.slice(0, 4), {}, legend);
  assert.deepEqual(
    lines.map((l) => [l.street, l.cards.join(" "), l.actions]),
    [
      ["preflop", "", "HJ raise 2bb · BB call"],
      ["flop", "As 7d 2c", "BB X · HJ B67 · BB C"],
      ["turn", "Kh", "BB X"],
    ],
  );
});

test("histórico: {flop}/{turn} viram a ação escolhida pelo herói nas decisões anteriores", () => {
  const history = ["HJ raise 2bb · BB 3-bet 8bb · HJ call", "BB {flop} · HJ C", "BB {turn} · HJ C"];
  const lines = handHistory(history, "river", board, { flop: "bet-25", turn: "bet-33" }, legend);
  assert.equal(lines[1].actions, "BB B25 · HJ C");
  assert.equal(lines[2].actions, "BB B33 · HJ C");
  assert.deepEqual(lines[3], { street: "river", cards: ["3s"], actions: "" }, "river só com a carta (o herói age primeiro)");
});

test("histórico: pré-flop e estratégias sem histórico não mostram nada", () => {
  assert.deepEqual(handHistory(["x"], "preflop", [], {}, legend), []);
  assert.deepEqual(handHistory(undefined, "flop", board.slice(0, 3), {}, legend), []);
});
