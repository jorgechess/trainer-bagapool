import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_HANDS } from "../hands";
import { DEFAULT_LEGEND, textColorFor, validateLegend } from "../legend";
import {
  actionOf,
  borderHands,
  compactRange,
  completeRange,
  paintHands,
  parseRangeNotation,
  rangeBreakdown,
  rangeFromNotation,
  validateRange,
} from "../range";

test("notação: pares com +", () => {
  assert.deepEqual(parseRangeNotation("TT+"), ["AA", "KK", "QQ", "JJ", "TT"]);
  assert.equal(parseRangeNotation("22+").length, 13);
});

test("notação: suited e offsuit com +", () => {
  assert.deepEqual(parseRangeNotation("ATs+"), ["AKs", "AQs", "AJs", "ATs"]);
  assert.deepEqual(parseRangeNotation("KJo+"), ["KQo", "KJo"]);
  assert.equal(parseRangeNotation("A2s+").length, 12);
});

test("notação: intervalos com hífen", () => {
  assert.deepEqual(parseRangeNotation("99-66"), ["99", "88", "77", "66"]);
  assert.deepEqual(parseRangeNotation("A5s-A2s"), ["A5s", "A4s", "A3s", "A2s"]);
  assert.deepEqual(parseRangeNotation("A2s-A5s"), ["A5s", "A4s", "A3s", "A2s"]);
});

test("notação: sem sufixo inclui suited e offsuit; minúsculas e espaços aceitos", () => {
  assert.deepEqual(parseRangeNotation("ak").sort(), ["AKo", "AKs"].sort());
  assert.deepEqual(parseRangeNotation("  qq,  kts ; 76s ").sort(), ["QQ", "KTs", "76s"].sort());
});

test("notação: remove duplicadas e rejeita entradas inválidas", () => {
  assert.equal(parseRangeNotation("AA, AA, QQ+").length, 3);
  assert.throws(() => parseRangeNotation("AAs"), /Par/);
  assert.throws(() => parseRangeNotation("AKx"), /Sufixo/);
  assert.throws(() => parseRangeNotation("Z2s"), /inválida/);
  assert.throws(() => parseRangeNotation("A5s-K2s"), /mesma carta alta/);
  assert.throws(() => parseRangeNotation("A5s-A2o"), /tipos diferentes/);
  assert.throws(() => parseRangeNotation("A-K-Q"), /Intervalo/);
  assert.throws(() => parseRangeNotation("A"), /incompleta/);
});

test("range a partir de notação por ação; a última ação vence em conflito", () => {
  const range = rangeFromNotation({ rfi: "22+, A2s+", shove: "22-44" });
  assert.equal(range["AA"], "rfi");
  assert.equal(range["22"], "shove");
  assert.equal(range["A5s"], "rfi");
  assert.equal(range["72o"], undefined);
});

test("ação padrão, completar e compactar", () => {
  const range = paintHands({}, ["AA", "KK"], "rfi");
  assert.equal(actionOf(range, "72o", "fold"), "fold");
  const full = completeRange(range, "fold");
  assert.equal(Object.keys(full).length, 169);
  const withDefaults = paintHands(range, ["72o"], "fold");
  assert.deepEqual(compactRange(withDefaults, "fold"), { AA: "rfi", KK: "rfi" });
  assert.throws(() => paintHands({}, ["XX"], "rfi"));
});

test("distribuição do range em combos e porcentagem", () => {
  const range = rangeFromNotation({ rfi: "AA, AKs" });
  const breakdown = rangeBreakdown(range, "fold");
  const rfi = breakdown.find((b) => b.actionId === "rfi")!;
  const fold = breakdown.find((b) => b.actionId === "fold")!;
  assert.equal(rfi.hands, 2);
  assert.equal(rfi.combos, 10);
  assert.equal(rfi.percent, 0.8);
  assert.equal(fold.combos, 1316);
  assert.equal(breakdown[0].actionId, "fold");
});

test("validação do range contra a legenda", () => {
  assert.deepEqual(validateRange({ AA: "rfi" }, DEFAULT_LEGEND, "fold"), []);
  assert.equal(validateRange({ AA: "xyz" }, DEFAULT_LEGEND, "fold").length, 1);
  assert.equal(validateRange({}, DEFAULT_LEGEND, "nada").length, 1);
  assert.equal(validateRange({ ZZ: "rfi" }, DEFAULT_LEGEND, "fold").length, 1);
});

test("mãos de fronteira", () => {
  const range = rangeFromNotation({ rfi: "AA" });
  assert.deepEqual(borderHands(range, "fold").sort(), ["AA", "AKo", "AKs"].sort());
  assert.deepEqual(borderHands({}, "fold"), []);
  const all = rangeFromNotation({ rfi: ALL_HANDS.join(",") });
  assert.deepEqual(borderHands(all, "fold"), []);
});

test("legenda padrão é válida e erros são detectados", () => {
  assert.deepEqual(validateLegend(DEFAULT_LEGEND), []);
  const errors = validateLegend([
    { id: "a", label: "A", color: "#ffffff", kind: "fold" },
    { id: "a", label: "B", color: "#FFFFFF", kind: "raise" },
    { id: "Bad Id", label: "", color: "red", kind: "fold" },
  ]);
  assert.ok(errors.some((e) => e.includes("repetido")));
  assert.ok(errors.some((e) => e.includes("mesma cor")));
  assert.ok(errors.some((e) => e.includes("Identificador inválido")));
  assert.ok(errors.some((e) => e.includes("Cor inválida")));
  assert.ok(errors.some((e) => e.includes("precisa de um nome")));
  assert.equal(validateLegend([]).length, 1);
});

test("contraste do texto sobre a cor", () => {
  assert.equal(textColorFor("#ffffff"), "#000000");
  assert.equal(textColorFor("#000000"), "#ffffff");
  assert.equal(textColorFor("#3b82f6"), "#ffffff");
  assert.equal(textColorFor("#eab308"), "#000000");
});
