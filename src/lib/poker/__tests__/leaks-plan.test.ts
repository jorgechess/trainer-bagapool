import { test } from "node:test";
import assert from "node:assert/strict";
import type { Attempt } from "../drill";
import { findLeaks, groupAttempts, mostMissedHands, overallAccuracy } from "../leaks";
import {
  type StatStandard,
  buildMonthlyPlan,
  evaluateStat,
  monthInBrasilia,
  planProgress,
  prioritize,
  validateStandard,
} from "../plan";

test("mês no horário de Brasília", () => {
  assert.equal(monthInBrasilia("2026-11-01T02:59:00.000Z"), "2026-10");
  assert.equal(monthInBrasilia("2026-11-01T03:00:00.000Z"), "2026-11");
});
import { canManageContent, canManageMembers, canViewAllPerformance, canViewPerformance } from "../permissions";

function attempt(overrides: Partial<Attempt>): Attempt {
  return {
    drillId: "d1",
    strategyId: "s1",
    strategyName: "RFI BTN",
    situation: "RFI",
    street: "preflop",
    heroPosition: "BTN",
    stackLabel: "10–15bb",
    ratioLabel: "2:1",
    tags: ["max-late"],
    hand: "A5s",
    heroCards: ["As", "5s"],
    board: [],
    chosenActionId: "rfi",
    correctActionId: "rfi",
    correct: true,
    createdAt: "2026-10-10T10:00:00.000Z",
    ...overrides,
  };
}

function many(n: number, overrides: Partial<Attempt>): Attempt[] {
  return Array.from({ length: n }, () => attempt(overrides));
}

test("agrupa acertos por dimensão", () => {
  const data = [...many(8, { correct: true }), ...many(2, { correct: false }), ...many(5, { heroPosition: "CO" })];
  const byPos = groupAttempts(data, "posicao");
  const btn = byPos.find((g) => g.key === "BTN")!;
  assert.equal(btn.total, 10);
  assert.equal(btn.errors, 2);
  assert.equal(btn.accuracy, 0.8);
  assert.equal(byPos[0].key, "BTN", "pior acerto vem primeiro");
  const byStreet = groupAttempts(data, "street");
  assert.equal(byStreet[0].key, "Pré-flop");
  assert.equal(groupAttempts([attempt({ ratioLabel: null })], "proporcao").length, 0);
  const tags = groupAttempts([attempt({ tags: ["a", "b"] })], "tag");
  assert.equal(tags.length, 2);
});

test("leaks respeitam amostra mínima e meta", () => {
  const data = [
    ...many(15, { situation: "RFI", correct: true }),
    ...many(10, { situation: "RFI", correct: false }),
    ...many(3, { situation: "vs 3-bet", correct: false }),
  ];
  const leaks = findLeaks(data, { minAttempts: 20, targetAccuracy: 0.9 });
  assert.ok(leaks.some((l) => l.dimension === "situacao" && l.key === "RFI"));
  assert.ok(!leaks.some((l) => l.key === "vs 3-bet"), "amostra pequena não vira leak");
  for (let i = 1; i < leaks.length; i++) assert.ok(leaks[i - 1].accuracy <= leaks[i].accuracy);
  assert.equal(findLeaks(many(30, { correct: true })).length, 0);
});

test("mãos mais erradas e acerto geral", () => {
  const data = [
    attempt({ hand: "K9o", correct: false }),
    attempt({ hand: "K9o", correct: false }),
    attempt({ hand: "Q9s", correct: false }),
    attempt({ hand: "AA", correct: true }),
    attempt({ hand: "72o", correct: false, strategyId: "outra" }),
  ];
  const missed = mostMissedHands(data, "s1");
  assert.deepEqual(missed.map((m) => m.hand), ["K9o", "Q9s"]);
  assert.equal(overallAccuracy(data).accuracy, 0.2);
  assert.equal(overallAccuracy([]).accuracy, 0);
});

const standards: StatStandard[] = [
  { id: "1", statKey: "rfi_btn", label: "RFI BTN", min: 40, max: 50, margin: 5, priority: 1, drillIds: ["d-rfi"] },
  { id: "2", statKey: "fold_bb", label: "Fold BB vs steal", min: 30, max: 40, margin: 5, priority: 2, drillIds: ["d-bb"] },
  { id: "3", statKey: "3bet_sb", label: "3-bet SB", min: 8, max: 12, margin: 2, priority: 3, drillIds: ["d-3bet"] },
  { id: "4", statKey: "cbet", label: "Cbet", min: 50, max: 60, margin: 10, priority: 4, drillIds: [] },
];

test("classificação: dentro, fora e muito fora com direção", () => {
  const s = standards[0];
  assert.deepEqual(
    { status: evaluateStat(s, 45).status, dir: evaluateStat(s, 45).direction },
    { status: "dentro", dir: null },
  );
  assert.equal(evaluateStat(s, 40).status, "dentro");
  assert.equal(evaluateStat(s, 37).status, "fora");
  assert.equal(evaluateStat(s, 37).direction, "abaixo");
  assert.equal(evaluateStat(s, 35).status, "fora");
  assert.equal(evaluateStat(s, 34.9).status, "muito-fora");
  assert.equal(evaluateStat(s, 58).direction, "acima");
  assert.equal(evaluateStat(s, 58).deviation, 8);
});

test("regra de prioridade: muito fora primeiro, depois fora, cada grupo pela prioridade", () => {
  // Exemplo do Jorge: prioridade 2 muito fora passa na frente da 1 que está só fora.
  const evals = [
    evaluateStat(standards[0], 38), // P1 fora
    evaluateStat(standards[1], 50), // P2 muito fora
    evaluateStat(standards[2], 13), // P3 fora
    evaluateStat(standards[3], 55), // P4 dentro
  ];
  assert.deepEqual(prioritize(evals).map((e) => e.standard.priority), [2, 1, 3]);
  // Segundo exemplo: P2 só fora e P3 muito fora → P3 primeiro.
  const evals2 = [evaluateStat(standards[1], 42), evaluateStat(standards[2], 20)];
  assert.deepEqual(prioritize(evals2).map((e) => e.standard.priority), [3, 2]);
});

test("plano mensal: focos, metas e stats sem valor", () => {
  const plan = buildMonthlyPlan(
    "2026-11",
    { rfi_btn: 38, fold_bb: 50, "3bet_sb": 13, cbet: 55 },
    standards,
    { maxFocus: 2, decisionsFora: 100, decisionsMuitoFora: 300 },
  );
  assert.equal(plan.focus.length, 2);
  assert.equal(plan.focus[0].statKey, "fold_bb");
  assert.equal(plan.focus[0].order, 1);
  assert.deepEqual(plan.focus[0].goals, [{ drillId: "d-bb", targetDecisions: 300 }]);
  assert.deepEqual(plan.focus[1].goals, [{ drillId: "d-rfi", targetDecisions: 100 }]);
  const partial = buildMonthlyPlan("2026-11", { rfi_btn: 45 }, standards);
  assert.equal(partial.focus.length, 0);
  assert.equal(partial.missing.length, 3);
  assert.throws(() => buildMonthlyPlan("2026-13", {}, standards));
});

test("progresso conta só as decisões do mês do plano", () => {
  const plan = buildMonthlyPlan("2026-11", { rfi_btn: 30 }, standards, {
    maxFocus: 3,
    decisionsFora: 2,
    decisionsMuitoFora: 3,
  });
  const attempts = [
    attempt({ drillId: "d-rfi", createdAt: "2026-11-02T10:00:00.000Z" }),
    attempt({ drillId: "d-rfi", createdAt: "2026-11-03T10:00:00.000Z", correct: false }),
    attempt({ drillId: "d-rfi", createdAt: "2026-10-31T10:00:00.000Z" }),
    // 01/11 às 02h UTC ainda é 31/10 em Brasília
    attempt({ drillId: "d-rfi", createdAt: "2026-11-01T02:00:00.000Z" }),
    attempt({ drillId: "outro", createdAt: "2026-11-03T10:00:00.000Z" }),
  ];
  const [progress] = planProgress(plan, attempts);
  assert.equal(progress.targetDecisions, 3);
  assert.equal(progress.done, 2);
  assert.equal(progress.accuracy, 0.5);
  assert.equal(progress.completed, false);
});

test("validação dos standards", () => {
  assert.deepEqual(validateStandard(standards[0]), []);
  const errors = validateStandard({ ...standards[0], label: "x", min: 10, max: 5, margin: -1, priority: 0 });
  assert.equal(errors.length, 3);
});

test("permissões por papel", () => {
  assert.ok(canManageMembers("admin"));
  assert.ok(!canManageMembers("coach"));
  for (const role of ["admin", "coach", "admin_drills", "mentor"] as const) assert.ok(canManageContent(role));
  assert.ok(!canManageContent("jogador"));
  assert.ok(canViewAllPerformance("mentor"));
  assert.ok(!canViewAllPerformance("jogador"));

  const ana = { id: "ana", role: "jogador" as const, poolId: "p1" };
  const bia = { id: "bia", role: "jogador" as const, poolId: "p1" };
  const caio = { id: "caio", role: "jogador" as const, poolId: "p2" };
  const semPool = { id: "x", role: "jogador" as const, poolId: null };
  const outroSemPool = { id: "y", role: "jogador" as const, poolId: null };
  const coach = { id: "c", role: "coach" as const, poolId: null };
  assert.ok(canViewPerformance(ana, ana));
  assert.ok(canViewPerformance(ana, bia));
  assert.ok(!canViewPerformance(ana, caio));
  assert.ok(!canViewPerformance(semPool, outroSemPool));
  assert.ok(canViewPerformance(coach, caio));
});

test("relatório por drill: acerto, estratégias e mãos mais erradas", async () => {
  const { reportByDrill } = await import("../leaks");
  const data = [
    ...many(8, { drillId: "a", strategyId: "co", strategyName: "RFI CO", correct: true }),
    ...many(2, { drillId: "a", strategyId: "co", strategyName: "RFI CO", hand: "T8o", correct: false }),
    ...many(5, { drillId: "a", strategyId: "btn", strategyName: "RFI BTN", correct: true }),
    attempt({ drillId: "b", correct: false, hand: "72o", createdAt: "2026-10-20T10:00:00.000Z" }),
    attempt({ drillId: "b", correct: true }),
  ];
  const report = reportByDrill(data);
  assert.deepEqual(report.map((r) => r.drillId), ["b", "a"], "pior acerto primeiro");
  const a = report.find((r) => r.drillId === "a")!;
  assert.equal(a.total, 15);
  assert.equal(a.errors, 2);
  assert.deepEqual(a.byStrategy.map((s) => s.key), ["RFI CO", "RFI BTN"]);
  assert.deepEqual(a.missedHands, [{ hand: "T8o", strategyName: "RFI CO", total: 2, errors: 2 }]);
  assert.equal(report[0].lastAt, "2026-10-20T10:00:00.000Z");
  assert.deepEqual(reportByDrill([]), []);
});
