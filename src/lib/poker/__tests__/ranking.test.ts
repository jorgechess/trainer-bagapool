import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRanking, currentMonth, monthRange, previousMonth, rankingScore } from "../ranking";

test("ranking: acerto × log do volume (1.000 a 70% perde por pouco de 500 a 80%)", () => {
  assert.equal(Math.round(rankingScore(700, 1000) * 10) / 10, 210);
  assert.equal(Math.round(rankingScore(400, 500) * 10) / 10, 215.9);
  assert.ok(rankingScore(2400, 3000) > rankingScore(450, 500), "volume grande com bom acerto passa na frente");
  assert.equal(rankingScore(0, 0), 0);
});

test("ranking: mínimo de 500 decisões, ordem por pontuação e empate por volume", () => {
  const { ranked, pending } = buildRanking([
    { userId: "a", decisions: 1000, correct: 700 },
    { userId: "b", decisions: 500, correct: 400 },
    { userId: "c", decisions: 499, correct: 499 },
    { userId: "d", decisions: 0, correct: 0 },
    { userId: "e", decisions: 120, correct: 60 },
  ]);
  assert.deepEqual(ranked.map((r) => [r.position, r.userId]), [[1, "b"], [2, "a"]]);
  assert.deepEqual(pending.map((r) => r.userId), ["c", "e"], "fora do ranking, por volume");
  assert.equal(ranked[0].accuracy, 80);
});

test("ranking: mês no fuso de São Paulo", () => {
  assert.deepEqual(monthRange("2026-11"), { from: "2026-11-01T03:00:00.000Z", to: "2026-12-01T03:00:00.000Z" });
  assert.deepEqual(monthRange("2026-12").to, "2027-01-01T03:00:00.000Z");
  assert.equal(currentMonth(new Date("2026-12-01T02:30:00Z")), "2026-11", "23h30 de 30/11 em SP ainda é novembro");
  assert.equal(previousMonth("2027-01"), "2026-12");
});

test("ranking: meses à mostra desde o lançamento, do mais antigo ao atual, no máximo 4", async () => {
  const { rankingMonths } = await import("../ranking");
  assert.deepEqual(rankingMonths("2026-11"), ["2026-11"]);
  assert.deepEqual(rankingMonths("2026-12"), ["2026-11", "2026-12"]);
  assert.deepEqual(rankingMonths("2027-03"), ["2026-12", "2027-01", "2027-02", "2027-03"]);
});
