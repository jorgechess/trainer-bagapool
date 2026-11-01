import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseImportBundle } from "../importer";
import { DEFAULT_LEGEND } from "../legend";
import { rangeBreakdown } from "../range";
import { dealSourceIds, mixedActions } from "../strategy";
import { allowedHands } from "../drill";

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

/** Porcentagem como no print: casa mista dividida igualmente entre as ações aceitas. */
function printPercent(s: { range: Record<string, string | undefined>; alsoCorrect?: Parameters<typeof mixedActions>[0] }, action: string) {
  let combos = 0;
  for (const [hand, primary] of Object.entries(s.range)) {
    const n = hand.length === 2 ? 6 : hand.endsWith("s") ? 4 : 12;
    const all = [primary, ...mixedActions(s.alsoCorrect, hand).filter((a) => a !== primary)];
    if (all.includes(action)) combos += n / all.length;
  }
  return (combos / 1326) * 100;
}

test("carga vs 3-bet 50bb PKO cobrindo: válida, coerente com o open cobrindo e com a legenda dos prints", () => {
  const rfi = parseImportBundle(load("rfi-50bb-pko-cobrindo.json"), DEFAULT_LEGEND);
  const result = parseImportBundle(load("vs3bet-50bb-pko-cobrindo.json"), DEFAULT_LEGEND, rfi.strategies);
  assert.deepEqual(result.errors, []);
  assert.equal(result.strategies.length, 35);
  const find = (hero: string, villain: string) =>
    result.strategies.find((x) => x.heroPosition === hero && x.villainPosition === villain)!;
  const expected: [string, string, string, number][] = [
    ["UTG", "UTG1", "call", 11.09],
    ["UTG", "UTG1", "shove", 2.34],
    ["UTG", "LJ", "4bet", 1.89],
    ["UTG", "HJ", "call", 12.07],
    ["UTG", "CO", "shove", 3.54],
    ["UTG", "BB", "call", 8.9],
    ["LJ", "HJ", "shove", 4.98],
    ["LJ", "BTN", "call", 13.65],
    ["HJ", "CO", "call", 19.83],
    ["HJ", "SB", "call", 29.41],
    ["CO", "BTN", "shove", 7.84],
    ["CO", "SB", "call", 30.92],
    ["BTN", "SB", "call", 36.5],
    ["BTN", "BB", "call", 39.97],
  ];
  for (const [hero, villain, action, value] of expected) {
    const got = printPercent(find(hero, villain), action);
    assert.ok(Math.abs(got - value) < 0.35, `${hero} vs ${villain} ${action}: ${got} ≈ ${value}`);
  }
  for (const s of result.strategies) {
    assert.equal(s.pko?.coverage, "cobrindo");
    assert.equal(s.pko?.heroStack, 60);
    const open = rfi.strategies.find((x) => x.id === s.dealFrom?.strategyId)!;
    assert.equal(open.heroPosition, s.heroPosition);
    // Exceção do print: 64s pago no MP vs BTN/SB/BB sem estar no open do MP (nunca é sorteado)
    for (const [hand, action] of Object.entries(s.range))
      if (action !== "fold" && !(s.heroPosition === "MP" && hand === "64s"))
        assert.equal(open.range[hand], "rfi", `${s.name}: ${hand} fora do open`);
  }
  // AA dividido em três (MP vs LJ): call, 4-bet e all-in valem
  const aa = find("MP", "LJ");
  assert.deepEqual([aa.range["AA"]!, ...mixedActions(aa.alsoCorrect, "AA")].sort(), ["4bet", "call", "shove"]);
});

test("carga RFI Max Late Reg Vanilla: 22 prints do Discord, com as porcentagens das legendas", () => {
  const result = parseImportBundle(load("rfi-max-late-reg-vanilla.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  assert.equal(result.strategies.length, 168);
  assert.equal(result.drills[0].variants?.length, 168);
  const get = (ctx: string, stack: number, pos: string) => result.strategies.find((s) => s.id === `rfi-mlr-${ctx}-${stack}bb-${pos}`)!;
  const pct = (ctx: string, stack: number, pos: string, action: string) => printPercent(get(ctx, stack, pos), action);
  const expected: [string, number, string, number][] = [
    ["3p1", 2, "utg", 43.89],
    ["3p1", 2, "btn", 65.01],
    ["3p1", 4, "hj", 42.38],
    ["3p1", 6, "btn", 70.14],
    ["2p1", 2, "co", 54.45],
    ["2p1", 4, "btn", 55.05],
    ["2p1", 6, "utg1", 18.4],
    ["1e5p1", 2, "lj", 40.72],
    ["1e5p1", 4, "mp", 28.51],
    ["1e5p1", 6, "btn", 57.16],
    ["bolha-nao-gtd", 2, "btn", 2.56],
    ["bolha-nao-gtd", 4, "btn", 11.76],
    ["bolha-nao-gtd", 6, "hj", 4.68],
    ["bolha-gtd", 2, "co", 1.36],
    ["bolha-gtd", 4, "btn", 6.94],
    ["bolha-gtd", 6, "btn", 3.77],
  ];
  for (const [ctx, stack, pos, value] of expected) {
    const got = pct(ctx, stack, pos, "shove");
    assert.ok(Math.abs(got - value) < 0.2, `${ctx} ${stack}bb ${pos}: ${got} ≈ ${value}`);
  }
  // Proporção e bolha viram players left na mesa; 10–15bb vira 10bb e 15bb
  assert.deepEqual(get("1e5p1", 2, "btn").ratio, { min: 1.5, max: 1.5 });
  assert.equal(get("bolha-gtd", 8, "co").bubble, "itm-garantido");
  assert.equal(get("bolha-gtd", 8, "co").ratio, null);
  // Legenda 3:1 10–15: AA raise com 10 e 15; azul (shove 10/raise com mais) muda com o stack
  assert.equal(get("3p1", 10, "utg").range["AA"], "rfi");
  assert.equal(get("3p1", 15, "utg").range["AA"], "rfi");
  const blue10 = Object.entries(get("3p1", 10, "btn").range).filter(([, a]) => a === "shove").map(([h]) => h);
  assert.ok(blue10.some((h) => get("3p1", 15, "btn").range[h] === "rfi"), "shove 10bb/raise com mais");
  assert.equal(get("2p1", 15, "co").range["22"], undefined, "1,5/2:1 olive: shove 10bb/fold com mais");
  assert.equal(get("2p1", 10, "co").range["22"], "shove");
});

test("carga Vs Resteal Max Late Reg Vanilla: 3 ranges do print em 13 spots", () => {
  const mlr = parseImportBundle(load("rfi-max-late-reg-vanilla.json"), DEFAULT_LEGEND);
  const result = parseImportBundle(load("vs-resteal-max-late-reg-vanilla.json"), DEFAULT_LEGEND, mlr.strategies);
  assert.deepEqual(result.errors, []);
  assert.equal(result.strategies.length, 13);
  // Mãos só dos raises (>10bb) do 3:1 e 2:1 com 15bb da mesma posição
  const map = new Map([...mlr.strategies, ...result.strategies].map((s) => [s.id, s]));
  for (const s of result.strategies) {
    const pos = s.heroPosition.toLowerCase();
    assert.deepEqual(dealSourceIds(s.dealFrom), [`rfi-mlr-3p1-15bb-${pos}`, `rfi-mlr-2p1-15bb-${pos}`]);
    const allowed = allowedHands(s, map)!;
    const raises = (id: string) => Object.entries(map.get(id)!.range).filter(([, a]) => a === "rfi").map(([h]) => h);
    assert.deepEqual([...allowed].sort(), [...new Set([...raises(`rfi-mlr-3p1-15bb-${pos}`), ...raises(`rfi-mlr-2p1-15bb-${pos}`)])].sort());
    assert.ok(!allowed.has("22") || map.get(`rfi-mlr-3p1-15bb-${pos}`)!.range["22"] === "rfi" || map.get(`rfi-mlr-2p1-15bb-${pos}`)!.range["22"] === "rfi");
  }
  const call = (hero: string, villain: string) => {
    const s = result.strategies.find((x) => x.heroPosition === hero && x.villainPosition === villain)!;
    assert.equal(s.villainAllIn, true);
    assert.equal(s.randomStacks, true);
    assert.deepEqual(s.stack, { min: 12, max: 15 });
    return rangeBreakdown(s.range, s.defaultActionId).find((b) => b.actionId === "call")!.percent;
  };
  for (const v of ["HJ", "CO", "BTN", "SB", "BB"]) assert.equal(call("LJ", v), 5.9, `LJ vs ${v}`);
  for (const v of ["CO", "BTN", "SB", "BB"]) assert.equal(call("HJ", v), 5.9, `HJ vs ${v}`);
  assert.equal(call("CO", "SB"), 10.9);
  assert.equal(call("BTN", "SB"), 10.9);
  assert.equal(call("CO", "BB"), 15.1);
  assert.equal(call("BTN", "BB"), 15.1);
});

test("carga RFI PKO Short coberto: 10, 15 e 20bb com as porcentagens das legendas", () => {
  const result = parseImportBundle(load("rfi-pko-short-coberto.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  assert.equal(result.strategies.length, 21);
  const pct = (stack: number, pos: string, action: string) =>
    printPercent(result.strategies.find((s) => s.id === `rfi-pko-short-coberto-${stack}bb-${pos}`)!, action);
  const expected: [number, string, string, number][] = [
    [10, "utg", "shove", 10.71], [10, "lj", "shove", 12.37], [10, "hj", "shove", 16.74], [10, "co", "shove", 20.66], [10, "co", "rfi", 2.26], [10, "btn", "shove", 29.71], [10, "btn", "rfi", 3.62],
    [15, "utg1", "shove", 7.84], [15, "utg", "rfi", 3.02], [15, "mp", "shove", 9.8], [15, "hj", "rfi", 4.22], [15, "co", "rfi", 7.54], [15, "btn", "shove", 17.95], [15, "btn", "rfi", 15.23],
    [20, "utg", "rfi", 12.82], [20, "mp", "shove", 4.37], [20, "hj", "shove", 6.03], [20, "co", "shove", 3.77], [20, "co", "rfi", 23.23], [20, "btn", "rfi", 33.79],
  ];
  for (const [stack, pos, action, value] of expected) {
    const got = pct(stack, pos, action);
    assert.ok(Math.abs(got - value) < 0.2, `${stack}bb ${pos} ${action}: ${got} ≈ ${value}`);
  }
  for (const s of result.strategies) assert.equal(s.pko?.coverage, "coberto");
});

test("carga Defesa Vanilla Deep (20 e 30bb): porcentagens exatas das legendas, substitui os drills antigos", () => {
  const result = parseImportBundle(load("defesa-vanilla-deep.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  assert.equal(result.strategies.length, 14);
  assert.equal(result.drills.length, 1);
  assert.deepEqual(result.replacedDrillIds, ["defesa-bb-20bb", "defesa-bb-30bb"]);
  assert.deepEqual(result.legend?.slice(-2).map((a) => a.id), ["3bet-call", "3bet-fold"]);
  const check = (file: string, rows: [string, Record<string, number>][]) => {
    const stack = Number(file.match(/(\d+)bb/)![1]);
    for (const [villain, expected] of rows) {
      const s = result.strategies.find((x) => x.villainPosition === villain && x.stack.min === stack)!;
      assert.equal(s.heroPosition, "BB");
      for (const [action, value] of Object.entries(expected))
        assert.ok(Math.abs(printPercent(s, action) - value) < 0.01, `${file} vs ${villain} ${action}`);
    }
  };
  check("defesa-bb-30bb.json", [
    ["UTG", { call: 50.83, shove: 0, "3bet-call": 3.02, "3bet-fold": 4.52 }],
    ["HJ", { call: 56.41, shove: 2.26, "3bet-call": 2.41, "3bet-fold": 3.62 }],
    ["CO", { call: 54.3, shove: 5.73, "3bet-call": 3.77, "3bet-fold": 6.33 }],
    ["BTN", { call: 59.13, shove: 6.94, "3bet-call": 4.98, "3bet-fold": 11.76 }],
  ]);
  check("defesa-bb-20bb.json", [
    ["MP", { call: 44.49, shove: 4.22, "3bet-call": 2.41, "3bet-fold": 2.71 }],
    ["LJ", { call: 47.81, shove: 6.33, "3bet-call": 2.41, "3bet-fold": 3.62 }],
    ["CO", { call: 50.38, shove: 9.2, "3bet-call": 3.32, "3bet-fold": 6.33 }],
    ["BTN", { call: 53.7, shove: 13.73, "3bet-call": 3.62, "3bet-fold": 9.05 }],
  ]);
});

test("carga Defesa BB PKO Deep: 30/50bb cobrindo/coberto com as porcentagens exatas das legendas", () => {
  const result = parseImportBundle(load("defesa-bb-pko-deep.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  assert.equal(result.strategies.length, 28);
  const rows: [number, string, string, Record<string, number>][] = [
    [30, "cobrindo", "UTG", { call: 66.21, shove: 0, "3bet-call": 3.02, "3bet-fold": 3.62 }],
    [30, "cobrindo", "BTN", { call: 68.48, shove: 7.24, "3bet-call": 6.18, "3bet-fold": 7.24 }],
    [30, "coberto", "LJ", { call: 57.32, shove: 3.17, "3bet-call": 2.41, "3bet-fold": 2.71 }],
    [30, "coberto", "BTN", { call: 64.4, shove: 12.67, "3bet-call": 3.02, "3bet-fold": 2.71 }],
    [50, "cobrindo", "CO", { call: 73, shove: 0, "3bet-call": 6.79, "3bet-fold": 12.97 }],
    [50, "cobrindo", "HJ", { call: 71.19, "3bet-call": 3.77, "3bet-fold": 9.65 }],
    [50, "coberto", "MP", { call: 58.37, "3bet-call": 3.02, "3bet-fold": 3.32 }],
    [50, "coberto", "BTN", { call: 74.36, "3bet-call": 5.73, "3bet-fold": 9.05 }],
  ];
  for (const [stack, coverage, villain, expected] of rows) {
    const s = result.strategies.find((x) => x.stack.min === stack && x.pko?.coverage === coverage && x.villainPosition === villain)!;
    for (const [action, value] of Object.entries(expected))
      assert.ok(Math.abs(printPercent(s, action) - value) < 0.01, `${stack}bb ${coverage} vs ${villain} ${action}: ${printPercent(s, action)}`);
  }
});
