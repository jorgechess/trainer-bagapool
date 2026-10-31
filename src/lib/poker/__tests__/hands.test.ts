import { test } from "node:test";
import assert from "node:assert/strict";
import { fullDeck, parseCard, rankValue, sortCardsDesc } from "../cards";
import {
  ALL_HANDS,
  HAND_GRID,
  TOTAL_COMBOS,
  comboCount,
  combosOf,
  gridNeighbors,
  handAt,
  handFromCards,
  handPosition,
} from "../hands";

test("baralho tem 52 cartas únicas", () => {
  const deck = fullDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck).size, 52);
});

test("parseCard normaliza e rejeita cartas inválidas", () => {
  assert.equal(parseCard("as"), "As");
  assert.equal(parseCard(" tD "), "Td");
  assert.throws(() => parseCard("1s"));
  assert.throws(() => parseCard("Ax"));
  assert.throws(() => parseCard("A"));
});

test("valores e ordenação das cartas", () => {
  assert.equal(rankValue("A"), 14);
  assert.equal(rankValue("2"), 2);
  assert.deepEqual(sortCardsDesc(["2c", "As", "Td"]), ["As", "Td", "2c"]);
});

test("grade tem 169 mãos únicas com pares na diagonal", () => {
  assert.equal(ALL_HANDS.length, 169);
  assert.equal(new Set(ALL_HANDS).size, 169);
  assert.equal(HAND_GRID[0][0], "AA");
  assert.equal(HAND_GRID[0][1], "AKs");
  assert.equal(HAND_GRID[1][0], "AKo");
  assert.equal(HAND_GRID[12][12], "22");
  assert.equal(handAt(3, 7), "J7s");
  assert.equal(handAt(7, 3), "J7o");
});

test("posição na grade é o inverso de handAt", () => {
  for (let row = 0; row < 13; row++)
    for (let col = 0; col < 13; col++) assert.deepEqual(handPosition(handAt(row, col)), { row, col });
  assert.throws(() => handPosition("AAs"));
});

test("combos somam 1326 e batem com combosOf", () => {
  const total = ALL_HANDS.reduce((sum, hand) => sum + comboCount(hand), 0);
  assert.equal(total, TOTAL_COMBOS);
  assert.equal(combosOf("AA").length, 6);
  assert.equal(combosOf("AKs").length, 4);
  assert.equal(combosOf("AKo").length, 12);
  for (const hand of ALL_HANDS) {
    for (const [a, b] of combosOf(hand)) assert.equal(handFromCards(a, b), hand);
  }
});

test("handFromCards independe da ordem", () => {
  assert.equal(handFromCards("2h", "Ah"), "A2s");
  assert.equal(handFromCards("Kd", "Ac"), "AKo");
  assert.equal(handFromCards("7s", "7d"), "77");
  assert.throws(() => handFromCards("7s", "7s"));
});

test("vizinhos na grade", () => {
  assert.deepEqual(gridNeighbors("AA").sort(), ["AKo", "AKs"].sort());
  assert.equal(gridNeighbors("T9s").length, 4);
});
