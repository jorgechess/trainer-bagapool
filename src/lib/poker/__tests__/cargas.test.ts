import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseImportBundle } from "../importer";
import { DEFAULT_LEGEND } from "../legend";
import { rangeBreakdown } from "../range";

const load = (name: string) => JSON.parse(readFileSync(join(process.cwd(), "cargas", name), "utf8"));

test("carga RFI 30bb vanilla: válida e com as porcentagens do print do time", () => {
  const result = parseImportBundle(load("rfi-30bb-vanilla.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  const percent = (pos: string) => {
    const s = result.strategies.find((x) => x.heroPosition === pos)!;
    return rangeBreakdown(s.range, s.defaultActionId).find((b) => b.actionId === "rfi")!.percent;
  };
  assert.deepEqual(
    ["UTG", "UTG1", "MP", "LJ", "HJ", "CO", "BTN"].map(percent),
    [16.9, 16.9, 25.8, 25.8, 31.7, 45.1, 67.4],
  );
  // ranges acumulados: cada posição abre tudo que a anterior abre
  const order = ["UTG", "MP", "HJ", "CO", "BTN"].map((p) => result.strategies.find((x) => x.heroPosition === p)!);
  for (let i = 1; i < order.length; i++)
    for (const hand of Object.keys(order[i - 1].range)) assert.equal(order[i].range[hand], "rfi", `${order[i].heroPosition} abre ${hand}`);
  // conferências pontuais do print
  const btn = result.strategies.find((x) => x.heroPosition === "BTN")!;
  const utg = result.strategies.find((x) => x.heroPosition === "UTG")!;
  assert.equal(utg.range["A3s"], "rfi");
  assert.equal(utg.range["A2s"], undefined);
  assert.equal(btn.range["K2o"], "rfi");
  assert.equal(btn.range["Q2o"], undefined);
  assert.equal(btn.range["72o"], undefined);
  assert.equal(result.drills[0].variants?.length, 7);
});

test("carga vs 3-bet 30bb vanilla: válida, coerente com o open e com as porcentagens dos prints", () => {
  const rfi = parseImportBundle(load("rfi-30bb-vanilla.json"), DEFAULT_LEGEND);
  const result = parseImportBundle(load("vs3bet-30bb-vanilla.json"), DEFAULT_LEGEND, rfi.strategies);
  assert.deepEqual(result.errors, []);
  assert.equal(result.strategies.length, 35);
  assert.equal(result.drills[0].variants?.length, 35);
  const pct = (hero: string, villain: string, action: string) => {
    const s = result.strategies.find((x) => x.heroPosition === hero && x.villainPosition === villain)!;
    return rangeBreakdown(s.range, s.defaultActionId).find((b) => b.actionId === action)?.percent ?? 0;
  };
  // Porcentagens que aparecem nos prints (arredondadas para 1 casa)
  const expected: [string, string, string, number][] = [
    ["BTN", "SB", "shove", 13.9],
    ["BTN", "SB", "call", 2.4],
    ["BTN", "BB", "shove", 4.7],
    ["BTN", "BB", "call", 8.0],
    ["CO", "BTN", "shove", 10.3],
    ["CO", "BTN", "call", 0.9],
    ["HJ", "CO", "shove", 8.1],
    ["LJ", "HJ", "shove", 3.5],
    ["UTG", "UTG1", "shove", 2.6],
    ["UTG", "UTG1", "call", 0.8],
    ["UTG", "BB", "call", 2.4],
  ];
  for (const [hero, villain, action, value] of expected)
    assert.equal(pct(hero, villain, action), value, `${hero} vs ${villain} ${action}`);
  // toda mão de call/all-in está no range de open da posição
  for (const s of result.strategies) {
    const open = rfi.strategies.find((x) => x.id === s.dealFrom?.strategyId)!;
    for (const [hand, action] of Object.entries(s.range))
      if (action !== "fold") assert.equal(open.range[hand], "rfi", `${s.name}: ${hand} fora do open`);
  }
});

test("cargas RFI 50bb PKO: válidas e com as porcentagens do print (cobrindo)", () => {
  const pct = (bundle: string, pos: string) => {
    const r = parseImportBundle(load(bundle), DEFAULT_LEGEND);
    assert.deepEqual(r.errors, []);
    const s = r.strategies.find((x) => x.heroPosition === pos)!;
    assert.equal(s.pko?.coverage, bundle.includes("cobrindo") ? "cobrindo" : "coberto");
    assert.deepEqual(s.stack, { min: 50, max: 50 });
    return rangeBreakdown(s.range, s.defaultActionId).find((b) => b.actionId === "rfi")!.percent;
  };
  // Legenda do print COBRINDO (incremental): EP 23,98 · MP 5,43 · LJ 5,43 · HJ 8,14 · CO 11,46 · BTN 22,93
  const f = "rfi-50bb-pko-cobrindo.json";
  assert.equal(pct(f, "UTG"), 24.0);
  assert.equal(pct(f, "MP"), 29.4);
  assert.equal(pct(f, "LJ"), 34.8);
  assert.equal(pct(f, "HJ"), 43.0);
  assert.equal(pct(f, "CO"), 54.4);
  assert.equal(pct(f, "BTN"), 77.4);
  // Coberto: ranges menores que cobrindo em todas as posições
  for (const pos of ["UTG", "MP", "LJ", "HJ", "CO", "BTN"])
    assert.ok(pct("rfi-50bb-pko-coberto.json", pos) < pct(f, pos), `coberto < cobrindo no ${pos}`);
});

test("carga vs 3-bet 50bb PKO coberto: válida, coerente com o open coberto e com a legenda dos prints", () => {
  const rfi = parseImportBundle(load("rfi-50bb-pko-coberto.json"), DEFAULT_LEGEND);
  const bundle = load("vs3bet-50bb-pko-coberto.json");
  // Legenda do time sem 4-bet: a carga acrescenta só essa ação, sem mexer nas outras
  const semQuatro = DEFAULT_LEGEND.filter((a) => a.id !== "4bet");
  const result = parseImportBundle(bundle, semQuatro, rfi.strategies);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.legend?.map((a) => a.id), [...semQuatro.map((a) => a.id), "4bet"]);
  assert.equal(parseImportBundle(bundle, DEFAULT_LEGEND, rfi.strategies).legend, null, "legenda já tem 4-bet: nada muda");
  assert.equal(result.strategies.length, 35);
  assert.equal(result.drills[0].variants?.length, 35);

  const find = (hero: string, villain: string) =>
    result.strategies.find((x) => x.heroPosition === hero && x.villainPosition === villain)!;
  // Porcentagem do print contando mão mista pela metade (cada casa dividida vale 50/50)
  const weighted = (hero: string, villain: string, action: string) => {
    const s = find(hero, villain);
    let combos = 0;
    for (const [hand, a] of Object.entries(s.range)) {
      const n = hand.length === 2 ? 6 : hand.endsWith("s") ? 4 : 12;
      const mixed = s.alsoCorrect?.[hand];
      if (a === action) combos += mixed ? n / 2 : n;
      else if (mixed === action) combos += n / 2;
    }
    return (combos / 1326) * 100;
  };
  const expected: [string, string, string, number][] = [
    ["UTG", "UTG1", "call", 4.3],
    ["UTG", "UTG1", "shove", 4.15],
    ["UTG", "HJ", "4bet", 0.98],
    ["UTG", "CO", "4bet", 1.81],
    ["UTG", "BTN", "4bet", 1.73],
    ["UTG", "SB", "call", 6.79],
    ["LJ", "HJ", "shove", 5.73],
    ["LJ", "BTN", "call", 7.01],
    ["HJ", "CO", "call", 11.01],
    ["HJ", "BB", "call", 12.67],
    ["CO", "BTN", "shove", 7.92],
    ["CO", "BB", "call", 19.46],
    ["BTN", "SB", "call", 22.47],
    ["BTN", "BB", "call", 25.64],
  ];
  for (const [hero, villain, action, value] of expected)
    assert.ok(Math.abs(weighted(hero, villain, action) - value) < 0.35, `${hero} vs ${villain} ${action}: ${weighted(hero, villain, action)} ≈ ${value}`);

  for (const s of result.strategies) {
    assert.equal(s.pko?.coverage, "coberto");
    assert.equal(s.pko?.heroStack, 50);
    const open = rfi.strategies.find((x) => x.id === s.dealFrom?.strategyId)!;
    assert.equal(open.heroPosition, s.heroPosition);
    for (const [hand, action] of Object.entries(s.range))
      if (action !== "fold") assert.equal(open.range[hand], "rfi", `${s.name}: ${hand} fora do open`);
  }
  // Conferências pontuais: AA misto call/all-in vs UTG1; AA misto 4-bet/call vs CO
  assert.deepEqual([find("UTG", "UTG1").range["AA"], find("UTG", "UTG1").alsoCorrect?.["AA"]].sort(), ["call", "shove"]);
  assert.deepEqual([find("UTG", "CO").range["AA"], find("UTG", "CO").alsoCorrect?.["AA"]].sort(), ["4bet", "call"]);
  assert.equal(find("BTN", "SB").range["22"], "shove");
  assert.equal(find("BTN", "BB").range["22"], undefined);
});
