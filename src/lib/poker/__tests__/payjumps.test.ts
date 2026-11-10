import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMoney, parsePlace, parsePrize, payLadder } from "../payjumps";

const DL22 = [
  { place: "2º", prize: "$543" },
  { place: "3º", prize: "$367" },
  { place: "4º", prize: "$243" },
  { place: "5º", prize: "$170" },
  { place: "6º", prize: "$136" },
];

test("lê lugar e prêmio", () => {
  assert.equal(parsePlace("2º"), 2);
  assert.equal(parsePlace("10th"), 10);
  assert.equal(parsePlace("?"), null);
  assert.equal(parsePrize("$543"), 543);
  assert.equal(parsePrize("$1,234.50"), 1234.5);
  assert.equal(parsePrize("R$ 1.234,50"), 1234.5);
  assert.equal(parsePrize("$12,500"), 12500);
  assert.equal(parsePrize("—"), null);
});

test("3 left: 3º garantido e próximo pay jump até o 2º", () => {
  const ladder = payLadder(DL22, 3)!;
  assert.equal(ladder.currency, "$");
  assert.deepEqual(
    ladder.steps.map((s) => [s.place, s.prize, s.jump, s.status]),
    [
      [1, null, null, "em-jogo"],
      [2, 543, 176, "em-jogo"],
      [3, 367, 124, "garantido"],
      [4, 243, 73, "pago"],
      [5, 170, 34, "pago"],
      [6, 136, null, "pago"],
    ],
  );
  assert.equal(ladder.guaranteed?.place, 3);
  assert.equal(ladder.next?.place, 2);
  assert.equal(ladder.next?.jump, 176);
});

test("6 left: próximo pay jump é do 6º para o 5º", () => {
  const ladder = payLadder(DL22, 6)!;
  assert.equal(ladder.guaranteed?.prize, 136);
  assert.equal(ladder.next?.place, 5);
  assert.equal(ladder.next?.jump, 34);
});

test("sem payouts ou fora da escada", () => {
  assert.equal(payLadder(null, 3), null);
  assert.equal(payLadder([], 3), null);
  const far = payLadder(DL22, 324)!;
  assert.equal(far.guaranteed, null);
  assert.equal(far.next, null);
  assert.ok(far.steps.every((s) => s.status === "em-jogo"));
});

test("formata dinheiro com a moeda", () => {
  assert.equal(formatMoney(176, "$"), "$176");
  assert.equal(formatMoney(1234.5, "$"), "$1,234.5");
});
