import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttempt, dealQuestion, drillPositions, drillScope, drillStrategyIds, filterDrillByPositions, gradeSubmission, isCorrect, strategyFamilies, spotSummary, summarizeSession, validateDrill } from "../drill";
import { combosOf } from "../hands";
import { DEFAULT_LEGEND } from "../legend";
import { borderHands } from "../range";
import { seededRng } from "../rng";
import { correctAction, resolveRange, validateStrategy } from "../strategy";
import { cbetFlop, fullDrill, preflopDrill, rfiBtn, strategies, turnBarrel } from "./fixtures";

test("estratégias de exemplo são válidas", () => {
  for (const s of strategies.values()) assert.deepEqual(validateStrategy(s, DEFAULT_LEGEND), [], s.name);
});

test("validação de estratégia aponta problemas", () => {
  const broken = { ...rfiBtn, name: "", actionIds: ["fold"], defaultActionId: "rfi", stack: { min: 20, max: 10 } };
  const errors = validateStrategy(broken, DEFAULT_LEGEND);
  assert.ok(errors.some((e) => e.includes("nome")));
  assert.ok(errors.some((e) => e.includes("duas ações")));
  assert.ok(errors.some((e) => e.includes("stack")));
  assert.ok(errors.some((e) => e.includes("ação padrão")));
  const notInButtons = validateStrategy({ ...rfiBtn, actionIds: ["fold", "rfi"] }, DEFAULT_LEGEND);
  assert.ok(notInButtons.some((e) => e.includes("não está entre os botões")));
  const noTexture = validateStrategy({ ...cbetFlop, textureRanges: [] }, DEFAULT_LEGEND);
  assert.ok(noTexture.some((e) => e.includes("textura")));
  const badRatio = validateStrategy({ ...rfiBtn, ratio: { min: 0.5, max: 2 } }, DEFAULT_LEGEND);
  assert.ok(badRatio.some((e) => e.includes("proporção")));
});

test("ação correta no pré-flop", () => {
  assert.equal(correctAction(rfiBtn, "AA", []), "rfi");
  assert.equal(correctAction(rfiBtn, "44", []), "shove");
  assert.equal(correctAction(rfiBtn, "72o", []), "fold");
});

test("pós-flop usa a primeira textura que combinar", () => {
  const mono = ["Kh", "7h", "3h", "2c", "9d"] as const;
  const rainbow = ["Kh", "7d", "3s", "2c", "9d"] as const;
  assert.equal(correctAction(cbetFlop, "AA", [...mono]), "check");
  assert.equal(correctAction(cbetFlop, "AA", [...rainbow]), "bet-33");
  assert.throws(() => resolveRange(cbetFlop, ["Kh", "7d"]));
  const onlyMono = { ...cbetFlop, textureRanges: [cbetFlop.textureRanges[0]] };
  assert.equal(correctAction(onlyMono, "AA", [...rainbow]), null);
});

test("validação do drill: ordem das streets e estratégias existentes", () => {
  assert.deepEqual(validateDrill(fullDrill, strategies), []);
  const outOfOrder = { ...fullDrill, steps: [turnBarrel.id, rfiBtn.id] };
  assert.ok(validateDrill(outOfOrder, strategies).some((e) => e.includes("fora de ordem")));
  assert.ok(validateDrill({ ...fullDrill, steps: ["x"] }, strategies).some((e) => e.includes("não encontrada")));
  assert.ok(validateDrill({ ...fullDrill, steps: [] }, strategies).length > 0);
  assert.ok(validateDrill({ ...fullDrill, passAccuracy: 0 }, strategies).length > 0);
  assert.ok(validateDrill({ ...fullDrill, handsPerSession: 0 }, strategies).length > 0);
});

test("escopo e resumo do spot", () => {
  assert.equal(drillScope(preflopDrill, strategies), "Uma decisão (pré-flop)");
  assert.equal(drillScope(fullDrill, strategies), "Do pré-flop ao turn");
  assert.equal(drillScope({ ...fullDrill, steps: [] }, strategies), "—");
  assert.equal(spotSummary(rfiBtn), "RFI · BTN · 10–15bb · 2:1");
  assert.equal(spotSummary(cbetFlop), "Cbet · BTN · vs BB · 10–15bb");
});

test("mão distribuída é válida e não repete cartas", () => {
  const rng = seededRng(42);
  for (let i = 0; i < 300; i++) {
    const q = dealQuestion(fullDrill, strategies, DEFAULT_LEGEND, rng);
    const all = [...q.heroCards, ...q.fullBoard];
    assert.equal(new Set(all).size, 7);
    assert.ok(combosOf(q.hand).some(([a, b]) => (a === q.heroCards[0] && b === q.heroCards[1]) || (a === q.heroCards[1] && b === q.heroCards[0])));
    assert.ok(q.steps.length >= 1);
    for (const step of q.steps) assert.ok(step.options.includes(step.correctActionId));
  }
});

test("a mão para quando a ação correta é fold ou shove e segue a linha correta", () => {
  const rng = seededRng(7);
  let sawFull = false;
  for (let i = 0; i < 500; i++) {
    const q = dealQuestion(fullDrill, strategies, DEFAULT_LEGEND, rng);
    const first = q.steps[0];
    if (first.correctActionId === "fold" || first.correctActionId === "shove") assert.equal(q.steps.length, 1);
    else {
      assert.ok(q.steps.length >= 2);
      assert.equal(q.steps[1].board.length, 3);
      // segundo barril só acontece depois de cbet
      assert.equal(q.steps.length === 3, q.steps[1].correctActionId === "bet-33");
      if (q.steps.length === 3) {
        sawFull = true;
        assert.equal(q.steps[2].board.length, 4);
        assert.deepEqual(q.steps[2].board.slice(0, 3), q.steps[1].board);
      }
    }
    assert.equal(first.board.length, 0);
  }
  assert.ok(sawFull, "deveria haver mãos chegando ao turn");
});

test("foco na fronteira sorteia mais mãos de fronteira", () => {
  const border = new Set(borderHands(rfiBtn.range, rfiBtn.defaultActionId));
  const count = (sampling: "uniforme" | "fronteira") => {
    const rng = seededRng(99);
    let hits = 0;
    for (let i = 0; i < 2000; i++) {
      const q = dealQuestion({ ...preflopDrill, sampling }, strategies, DEFAULT_LEGEND, rng);
      if (border.has(q.hand)) hits++;
    }
    return hits;
  };
  assert.ok(count("fronteira") > count("uniforme") * 1.5);
});

test("drill pós-flop sem textura compatível gera erro claro", () => {
  const impossible = { ...cbetFlop, id: "x", textureRanges: [{ id: "t", label: "Trinca de ases", match: { patterns: ["A-A-A"], suits: ["monotone" as const] }, range: {} }] };
  const map = new Map([[impossible.id, impossible]]);
  assert.throws(
    () => dealQuestion({ ...preflopDrill, steps: ["x"] }, map, DEFAULT_LEGEND, seededRng(1)),
    /Nenhuma textura/,
  );
  assert.throws(() => dealQuestion({ ...preflopDrill, steps: ["nao-existe"] }, map, DEFAULT_LEGEND), /não encontrada/);
});

test("correção no servidor refaz o cálculo a partir das cartas", () => {
  const ok = gradeSubmission(preflopDrill, rfiBtn, ["As", "Ad"], [], "rfi");
  assert.equal(ok.correct, true);
  assert.equal(ok.hand, "AA");
  const bad = gradeSubmission(preflopDrill, rfiBtn, ["7c", "2d"], [], "rfi");
  assert.equal(bad.correct, false);
  assert.equal(bad.correctActionId, "fold");
  const flop = gradeSubmission(fullDrill, cbetFlop, ["Ah", "Ad"], ["Kc", "7d", "3s"], "bet-33");
  assert.equal(flop.correct, true);
  assert.throws(() => gradeSubmission(preflopDrill, cbetFlop, ["Ah", "Ad"], ["Kc", "7d", "3s"], "check"), /não faz parte/);
  assert.throws(() => gradeSubmission(preflopDrill, rfiBtn, ["Ah", "Ah"], [], "rfi"), /repetidas/);
  assert.throws(() => gradeSubmission(preflopDrill, rfiBtn, ["Xh", "Ah"], [], "rfi"), /inválidas/);
  assert.throws(() => gradeSubmission(preflopDrill, rfiBtn, ["Kh", "Ah"], ["2c", "3c", "4c"], "rfi"), /street/);
  assert.throws(() => gradeSubmission(preflopDrill, rfiBtn, ["Kh", "Ah"], [], "bet-75"), /Ação inválida/);
  const onlyMono = { ...cbetFlop, textureRanges: [cbetFlop.textureRanges[0]] };
  assert.throws(() => gradeSubmission(fullDrill, onlyMono, ["Ah", "Ad"], ["Kc", "7d", "3s"], "check"), /não cobre/);
});

test("correção, registro da tentativa e resumo da sessão", () => {
  const q = dealQuestion(preflopDrill, strategies, DEFAULT_LEGEND, seededRng(3));
  const step = q.steps[0];
  const wrong = step.options.find((o) => o !== step.correctActionId)!;
  assert.ok(isCorrect(step, step.correctActionId));
  assert.ok(!isCorrect(step, wrong));
  const now = new Date("2026-10-15T12:00:00Z");
  const ok = buildAttempt(preflopDrill, rfiBtn, q, step, step.correctActionId, now);
  const bad = buildAttempt(preflopDrill, rfiBtn, q, step, wrong, now);
  assert.equal(ok.correct, true);
  assert.equal(bad.correct, false);
  assert.equal(ok.stackLabel, "10–15bb");
  assert.equal(ok.ratioLabel, "2:1");
  assert.deepEqual(ok.tags.sort(), ["drill-rfi", "max-late"]);
  assert.equal(ok.createdAt, "2026-10-15T12:00:00.000Z");
  const summary = summarizeSession([ok, ok, ok, bad], 0.75);
  assert.equal(summary.accuracy, 0.75);
  assert.equal(summary.passed, true);
  assert.equal(summarizeSession([], 0.5).passed, false);
});

test("variações: cada mão sorteia uma das sequências", () => {
  const rfiCo = { ...rfiBtn, id: "rfi-co", name: "RFI CO", heroPosition: "CO" as const };
  const map = new Map([...strategies, [rfiCo.id, rfiCo]]);
  const drill = { ...preflopDrill, steps: [rfiBtn.id], variants: [[rfiBtn.id], [rfiCo.id]] };
  assert.deepEqual(validateDrill(drill, map), []);
  assert.deepEqual(drillStrategyIds(drill).sort(), [rfiBtn.id, rfiCo.id].sort());
  assert.equal(drillScope(drill, map), "Uma decisão (pré-flop)");
  const rng = seededRng(5);
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) seen.add(dealQuestion(drill, map, DEFAULT_LEGEND, rng).steps[0].strategyId);
  assert.deepEqual([...seen].sort(), [rfiBtn.id, rfiCo.id].sort());
  // a correção aceita qualquer estratégia de qualquer variação, e só delas
  assert.equal(gradeSubmission(drill, rfiCo, ["As", "Ad"], [], "rfi").correct, true);
  assert.throws(() => gradeSubmission(drill, cbetFlop, ["As", "Ad"], ["2c", "3c", "4d"], "check"), /não faz parte/);
  // variação vazia ou fora de ordem é apontada com o número da variação
  const bad = { ...drill, variants: [[rfiBtn.id], [], [turnBarrel.id, rfiBtn.id]] };
  const errors = validateDrill(bad, map);
  assert.ok(errors.some((e) => e.startsWith("Variação 2:")));
  assert.ok(errors.some((e) => e.startsWith("Variação 3:") && e.includes("fora de ordem")));
  // escopo combina as variações
  assert.equal(drillScope({ ...drill, variants: [[rfiBtn.id], [rfiBtn.id, cbetFlop.id]] }, map), "Do pré-flop ao flop");
});

test("posições do drill, filtro do jogador e famílias de estratégias", () => {
  const rfiCo = { ...rfiBtn, id: "rfi-co", name: "RFI CO", heroPosition: "CO" as const };
  const rfiUtg = { ...rfiBtn, id: "rfi-utg", name: "RFI UTG", heroPosition: "UTG" as const };
  const map = new Map([...strategies, [rfiCo.id, rfiCo], [rfiUtg.id, rfiUtg]]);
  const drill = { ...preflopDrill, steps: [rfiBtn.id], variants: [[rfiBtn.id], [rfiCo.id], [rfiUtg.id]] };
  assert.deepEqual(drillPositions(drill, map), ["UTG", "CO", "BTN"]);

  const onlyCo = filterDrillByPositions(drill, map, ["CO"]);
  assert.deepEqual(onlyCo.variants, [[rfiCo.id]]);
  assert.deepEqual(onlyCo.steps, [rfiCo.id]);
  assert.deepEqual(drill.variants?.length, 3, "o drill original não muda");
  assert.equal(filterDrillByPositions(drill, map, []), drill);
  assert.equal(filterDrillByPositions(drill, map, ["SB"]), drill, "posição sem variação = drill inteiro");
  const rng = seededRng(2);
  for (let i = 0; i < 30; i++)
    assert.equal(dealQuestion(filterDrillByPositions(drill, map, ["UTG", "BTN"]), map, DEFAULT_LEGEND, rng).steps[0].strategyId === rfiCo.id, false);

  const families = strategyFamilies([rfiBtn, rfiCo, rfiUtg, cbetFlop]);
  const rfi = families.find((f) => f.label.startsWith("RFI"))!;
  assert.equal(rfi.label, "RFI · 10–15bb · 2:1 (pré-flop)");
  assert.deepEqual(rfi.byPosition, { BTN: rfiBtn.id, CO: rfiCo.id, UTG: rfiUtg.id });
  assert.equal(families.length, 2);
  const otherStack = strategyFamilies([rfiBtn, { ...rfiCo, stack: { min: 20, max: 20 } }]);
  assert.equal(otherStack.length, 2, "stack diferente = família diferente");
});
