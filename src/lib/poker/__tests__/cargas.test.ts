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

test("carga Defesa BB Vanilla MLR: linear vs polar, com as porcentagens das legendas", () => {
  const result = parseImportBundle(load("defesa-bb-vanilla-mlr.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  assert.equal(result.strategies.length, 350);
  const get = (ctx: string, stack: number, v: string, ot: string) =>
    result.strategies.find((s) => s.id === `bb-def-mlr-${ctx}-${stack}bb-vs-${v}-${ot}`)!;
  // Contra linear: all-in = azul + rosa; call = verde + amarelo. Contra polar: all-in = azul; call = verde.
  // (casas divididas rosa/verde contam pela metade contra polar, por isso a folga)
  const near = (got: number, want: number, msg: string) => assert.ok(Math.abs(got - want) < 1.5, `${msg}: ${got} ≈ ${want}`);
  near(printPercent(get("3p1", 4, "btn", "linear"), "shove"), 27.3 + 3.32, "4bb 3:1 BTN linear all-in");
  near(printPercent(get("3p1", 4, "btn", "linear"), "call"), 54 + 15.38, "4bb 3:1 BTN linear call");
  near(printPercent(get("3p1", 4, "btn", "polar"), "shove"), 27.3, "4bb 3:1 BTN polar all-in");
  near(printPercent(get("3p1", 4, "btn", "polar"), "call"), 54, "4bb 3:1 BTN polar call");
  near(printPercent(get("bng", 10, "btn", "linear"), "shove"), 4.68 + 12.97, "10bb bolha BTN linear all-in");
  near(printPercent(get("bng", 6, "utg", "polar"), "call"), 6.03, "6bb bolha EP polar call");
  near(printPercent(get("3p1", 15, "utg", "polar"), "call"), 41.18, "15bb 3:1 EP polar call");
  near(printPercent(get("3p1", 15, "lj", "linear"), "call"), 41.4 + 21.12, "15bb 3:1 MP (LJ) linear call");
  near(printPercent(get("bg", 8, "co", "polar"), "call"), 5.73, "8bb bolha garantido CO polar call");
  const lin = get("2p1", 6, "co", "linear");
  assert.deepEqual(lin.openerStack, { min: 17, max: 40 });
  assert.deepEqual(get("2p1", 6, "co", "polar").openerStack, { min: 10, max: 14 });
  assert.deepEqual(lin.ratio, { min: 2, max: 2 });
  assert.equal(get("bng", 6, "co", "polar").bubble, "itm-nao-garantido");
});

test("carga Call em Shoves do BB MLR: porcentagens exatas dos prints e vilão cobrindo o herói", async () => {
  const { tableState } = await import("../table");
  const result = parseImportBundle(load("call-shove-bb-mlr.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  assert.equal(result.strategies.length, 175);
  const pct = (ctx: string, stack: number, v: string) =>
    rangeBreakdown(result.strategies.find((s) => s.id === `call-shove-bb-mlr-${ctx}-${stack}bb-vs-${v}`)!.range, "fold").find((b) => b.actionId === "call")?.percent ?? 0;
  const expected: [string, number, string, number][] = [
    ["3p1", 4, "btn", 83.7], ["bg", 4, "co", 1.4], ["2p1", 6, "lj", 27.0], ["bng", 8, "btn", 14.9],
    ["bg", 8, "btn", 3.8], ["3p1", 10, "co", 23.1], ["1e5p1", 15, "utg", 5.9], ["bg", 15, "btn", 6.6],
  ];
  for (const [ctx, stack, v, value] of expected) assert.equal(pct(ctx, stack, v), value, `${ctx} ${stack}bb vs ${v}`);
  const s = result.strategies.find((x) => x.id === "call-shove-bb-mlr-2p1-6bb-vs-co")!;
  for (let seed = 1; seed < 300; seed += 7) {
    const t = tableState(s, seed);
    assert.ok(t.villainStart! >= 6 && t.villainStart! <= 21, `vilão cobre: ${t.villainStart}`);
    assert.equal(t.remaining!.CO, 0);
    assert.equal(t.raiseLabel, "All-in");
  }
});

test("carga Defesa BB PKO Short: porcentagens das legendas", () => {
  const result = parseImportBundle(load("defesa-bb-pko-short.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  assert.equal(result.strategies.length, 56);
  const get = (ctx: string, stack: number, v: string) => result.strategies.find((s) => s.id === `bb-def-pko-short-${ctx}-${stack}bb-vs-${v}`)!;
  const rows: [string, number, string, string, number][] = [
    ["3p1", 10, "utg", "shove", 11.76], ["3p1", 10, "btn", "call", 70.29], ["bng", 10, "btn", "call", 35.44],
    ["3p1", 15, "co", "shove", 19.16], ["bng", 15, "lj", "call", 21.87], ["3p1", 20, "btn", "3bet-fold", 29.86],
    ["1e5p1", 20, "btn", "3bet-call", 3.32], ["bng", 20, "utg", "3bet-call", 1.21],
  ];
  for (const [ctx, stack, v, action, value] of rows) {
    const got = printPercent(get(ctx, stack, v), action);
    assert.ok(Math.abs(got - value) < 0.1, `${ctx} ${stack}bb vs ${v} ${action}: ${got} ≈ ${value}`);
  }
  assert.equal(get("3p1", 20, "co").pko?.coverage, "coberto");
});

test("carga Defesa BB Vanilla Multiway: porcentagens exatas e callers na mesa", async () => {
  const { tableSeats, knownPot } = await import("../table");
  const result = parseImportBundle(load("defesa-bb-vanilla-multiway.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  assert.equal(result.strategies.length, 24);
  const get = (id: string) => result.strategies.find((s) => s.id === `bb-def-mw-1e5p1-${id}`)!;
  const rows: [string, string, number][] = [
    ["3way-vs-utg-btn", "call", 40.42], ["3way-vs-mp-sb", "squeeze-call", 3.77], ["3way-vs-hj-btn", "shove", 4.52],
    ["3way-vs-btn-sb", "shove", 12.37], ["4way-vs-utg1-co-btn", "call", 30.32], ["4way-vs-co-btn-sb", "call", 56.26],
    ["4way-vs-lj-btn-sb", "squeeze-fold", 3.62],
  ];
  for (const [id, action, value] of rows) assert.ok(Math.abs(printPercent(get(id), action) - value) < 0.01, `${id} ${action}`);
  const s = get("4way-vs-co-btn-sb");
  const seats = tableSeats(s);
  assert.deepEqual(seats.filter((x) => x.status === "called").map((x) => x.position), ["BTN", "SB"]);
  assert.equal(knownPot(s), 2 + 2 + 2 + 1);
});

test("carga RFI SB Chip EV: 4 stacks, seção Blind War, raise de 3bb só com 25bb", async () => {
  const { drillSection } = await import("../sections");
  const result = parseImportBundle(load("rfi-sb-chip-ev.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.strategies.map((s) => s.stack.min), [12, 25, 50, 100]);
  assert.deepEqual(result.strategies.map((s) => s.tableSizes?.open), [3.5, 3, 3.5, 3.5]);
  const map = new Map(result.strategies.map((s) => [s.id, s]));
  assert.equal(drillSection(result.drills[0], map), "bw");
  const s12 = map.get("rfi-sb-chipev-12bb")!;
  assert.equal(s12.range["22"], "shove");
  const s100 = map.get("rfi-sb-chipev-100bb")!;
  assert.equal(s100.range["32o"], undefined, "32o fold com 100bb");
  assert.ok(printPercent(s100, "limp") > 70);
});

test("carga BW SB MLR: abertura do SB e plano contra shove/ISO, com as porcentagens das legendas", async () => {
  const { drillSection } = await import("../sections");
  const { tableState } = await import("../table");
  const result = parseImportBundle(load("bw-sb-mlr.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  const map = new Map(result.strategies.map((s) => [s.id, s]));
  assert.equal(drillSection(result.drills[0], map), "bw");
  const pct = (id: string, action: string) => rangeBreakdown(map.get(id)!.range, "fold").find((b) => b.actionId === action)?.percent ?? 0;
  // 3:1 15bb: limp = 8,14 + 2,11 + 13,27 + 26,24; shove 29,41
  assert.equal(pct("bw-sb-mlr-3p1-15bb", "shove"), 29.4);
  assert.equal(pct("bw-sb-mlr-3p1-15bb", "limp"), 49.8);
  // vs shove depois do limp: call = verde + amarelo; vs ISO: shove = verde, call = amarelo + laranja
  assert.equal(pct("bw-sb-mlr-3p1-15bb-limp-vs-shove", "call"), 10.3);
  assert.equal(pct("bw-sb-mlr-3p1-15bb-limp-vs-iso", "shove"), 8.1);
  assert.equal(pct("bw-sb-mlr-3p1-15bb-limp-vs-iso", "call"), 15.4);
  // 1,5:1 15bb: raise = 5,88 + 12,67; raise vs shove call = 5,88
  assert.equal(pct("bw-sb-mlr-1e5p1-15bb", "rfi"), 18.6);
  assert.equal(pct("bw-sb-mlr-1e5p1-15bb-raise-vs-shove", "call"), 5.9);
  assert.equal(pct("bw-sb-mlr-bng-2bb", "limp"), 59.9);
  assert.equal(pct("bw-sb-mlr-3p1-2bb", "shove"), 100);
  // Mesa: limp de 1bb e ISO de 3bb do BB
  const iso = tableState(map.get("bw-sb-mlr-3p1-15bb-limp-vs-iso")!, 7);
  assert.equal(iso.raiseLabel, "ISO");
  assert.equal(iso.seats.find((s) => s.position === "SB")!.posted, 1);
  assert.equal(iso.seats.find((s) => s.position === "BB")!.posted, 3);
  assert.ok(result.drills[0].variants!.some((v) => v[1] === "bw-sb-mlr-3p1-15bb-limp-vs-shove"));
});

test("carga BW BB: vs limp (com ISO vs 3-bet) e vs raise, com as porcentagens das legendas", async () => {
  const { tableState } = await import("../table");
  const { drillSituations, filterDrill } = await import("../drill");
  const result = parseImportBundle(load("bw-bb.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  const map = new Map(result.strategies.map((s) => [s.id, s]));
  const pct = (id: string, a: string) => rangeBreakdown(map.get(id)!.range, map.get(id)!.defaultActionId).find((b) => b.actionId === a)?.percent ?? 0;
  // vs limp 50+: check 37,71; ISO = 4,83 + 14,03 + 43,44
  assert.equal(pct("bw-bb-vs-limp-50plus", "check"), 37.7);
  assert.equal(pct("bw-bb-vs-limp-50plus", "iso"), 62.3);
  assert.equal(pct("bw-bb-vs-limp-10-15", "shove"), 16.4);
  assert.equal(pct("bw-bb-vs-limp-50plus-iso-vs-3bet", "shove"), 4.8);
  assert.equal(pct("bw-bb-vs-limp-50plus-iso-vs-3bet", "call"), 14);
  // vs raise
  assert.equal(pct("bw-bb-vs-raise-50plus", "call"), 50.5);
  assert.equal(pct("bw-bb-vs-raise-25-50", "3bet-call"), 4.7);
  assert.equal(pct("bw-bb-vs-raise-10-15", "shove"), 27.8);
  // Mesa: limp do SB (1bb), ISO 3bb vs 3-bet 8bb
  const iso = tableState(map.get("bw-bb-vs-limp-25-50-iso-vs-3bet")!, 5);
  assert.equal(iso.seats.find((s) => s.position === "BB")!.posted, 3);
  assert.equal(iso.seats.find((s) => s.position === "SB")!.posted, 8);
  assert.equal(iso.raiseLabel, "3-bet");
  const limp = tableState(map.get("bw-bb-vs-limp-25-50")!, 5);
  assert.equal(limp.seats.find((s) => s.position === "SB")!.posted, 1);
  assert.equal(limp.pot, 2);
  // Filtro de situação
  assert.deepEqual(drillSituations(result.drills[0], map), ["vs limp", "vs raise"]);
  assert.ok(filterDrill(result.drills[0], map, { situations: ["vs raise"] }).drill.variants!.every((v) => v[0].includes("vs-raise")));
});

test("carga Cbet flop IP: pote simples, CO/BTN vs BB, mãos do RFI e seção Posflop Attack", async () => {
  const { drillSection } = await import("../sections");
  const { dealQuestion, validateDrill } = await import("../drill");
  const { knownPot } = await import("../table");
  const { seededRng } = await import("../rng");
  const rfi = parseImportBundle(load("rfi-30bb-vanilla.json"), DEFAULT_LEGEND);
  const mlr = parseImportBundle(load("rfi-max-late-reg-vanilla.json"), DEFAULT_LEGEND);
  const result = parseImportBundle(load("cbet-flop-ip.json"), DEFAULT_LEGEND, [...rfi.strategies, ...mlr.strategies]);
  assert.deepEqual(result.errors, []);
  const map = new Map([...rfi.strategies, ...mlr.strategies, ...result.strategies].map((s) => [s.id, s]));
  assert.equal(drillSection(result.drills[0], map), "posflop-attack");
  assert.deepEqual(validateDrill(result.drills[0], map), []);
  for (const s of result.strategies) assert.equal(knownPot(s), 4.5, "pote de single raised (open 2bb + call do BB + SB)");
  const legend = result.legend ?? DEFAULT_LEGEND;
  const rng = seededRng(7);
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const q = dealQuestion(result.drills[0], map, legend, rng);
    assert.equal(q.steps.length, 1);
    assert.equal(q.steps[0].board.length, 3);
    const s = map.get(q.steps[0].strategyId)!;
    const open = map.get(s.dealFrom!.strategyId)!;
    assert.equal(open.range[q.hand], "rfi", `${q.hand} vem do RFI de ${s.heroPosition}`);
    seen.add(q.steps[0].correctActionId);
  }
  assert.deepEqual([...seen].sort(), ["bet-25", "bet-40", "check"]);
});

test("carga BW SB pós: SB vs BB no flop, raise/call e limp/check, seção Blind War", async () => {
  const { drillSection } = await import("../sections");
  const { dealQuestion, validateDrill } = await import("../drill");
  const { knownPot } = await import("../table");
  const { seededRng } = await import("../rng");
  const sb = parseImportBundle(load("rfi-sb-chip-ev.json"), DEFAULT_LEGEND);
  const result = parseImportBundle(load("bw-sb-pos.json"), DEFAULT_LEGEND, sb.strategies);
  assert.deepEqual(result.errors, []);
  const map = new Map([...sb.strategies, ...result.strategies].map((s) => [s.id, s]));
  assert.equal(drillSection(result.drills[0], map), "bw");
  assert.deepEqual(validateDrill(result.drills[0], map), []);
  assert.deepEqual(result.strategies.map((s) => knownPot(s)), [7.5, 3.5]);
  const legend = result.legend ?? DEFAULT_LEGEND;
  const rng = seededRng(11);
  const seen = { rc: new Set<string>(), lx: new Set<string>() };
  for (let i = 0; i < 400; i++) {
    const q = dealQuestion(result.drills[0], map, legend, rng);
    const s = map.get(q.steps[0].strategyId)!;
    const open = map.get(s.dealFrom!.strategyId)!;
    const node = s.id.endsWith("rc") ? "rc" : "lx";
    assert.equal(open.range[q.hand], node === "rc" ? "rfi" : "limp", `${q.hand} vem do ${node === "rc" ? "raise" : "limp"} do SB`);
    seen[node].add(q.steps[0].correctActionId);
  }
  assert.deepEqual([...seen.rc].sort(), ["bet-25", "bet-67", "check"]);
  assert.deepEqual([...seen.lx].sort(), ["bet-1bb", "check"]);
});

test("carga BB Leads: flop com continuação no turn, turn e river; seção Posflop Defense", async () => {
  const { drillSection } = await import("../sections");
  const { dealQuestion, validateDrill } = await import("../drill");
  const { seededRng } = await import("../rng");
  const deep = parseImportBundle(load("defesa-vanilla-deep.json"), DEFAULT_LEGEND);
  const result = parseImportBundle(load("bb-leads.json"), DEFAULT_LEGEND, deep.strategies);
  assert.deepEqual(result.errors, []);
  const map = new Map([...deep.strategies, ...result.strategies].map((s) => [s.id, s]));
  const drill = result.drills[0];
  assert.equal(drillSection(drill, map), "posflop-defense");
  assert.deepEqual(validateDrill(drill, map), []);
  const legend = result.legend ?? DEFAULT_LEGEND;
  const rng = seededRng(5);
  const answers = new Map<string, Set<string>>();
  for (let i = 0; i < 600; i++) {
    const q = dealQuestion(drill, map, legend, rng);
    const first = map.get(q.steps[0].strategyId)!;
    const call = map.get(first.dealFrom!.strategyId)!;
    assert.equal(call.range[q.hand], "call", `${q.hand} vem do call do BB`);
    if (first.cbet?.table === "bb-lead" && first.cbet.node === "flop-sim") {
      assert.equal(q.steps.length, 2, "lead no flop tem a decisão do turn");
      assert.equal(q.steps[1].board.length, 4);
    } else assert.equal(q.steps.length, 1);
    for (const s of q.steps) {
      const node = (map.get(s.strategyId)!.cbet as { node: string }).node;
      if (!answers.has(node)) answers.set(node, new Set());
      answers.get(node)!.add(s.correctActionId);
    }
  }
  assert.deepEqual([...answers.get("flop-sim")!], ["bet-25"]);
  assert.deepEqual([...answers.get("flop-nao")!], ["check"]);
  assert.deepEqual([...answers.get("turn-lead")!].sort(), ["bet-115", "bet-25", "bet-67", "check"]);
  assert.deepEqual([...answers.get("turn")!].sort(), ["bet-25", "bet-67", "check"]);
  assert.deepEqual([...answers.get("river")!].sort(), ["bet-10", "bet-100", "check"]);
});

test("carga BB Probes: turn, probe + barrel no river, seção Posflop Defense", async () => {
  const { drillSection } = await import("../sections");
  const { dealQuestion, validateDrill } = await import("../drill");
  const { seededRng } = await import("../rng");
  const deep = parseImportBundle(load("defesa-vanilla-deep.json"), DEFAULT_LEGEND);
  const result = parseImportBundle(load("bb-probes.json"), DEFAULT_LEGEND, deep.strategies);
  assert.deepEqual(result.errors, []);
  const map = new Map([...deep.strategies, ...result.strategies].map((s) => [s.id, s]));
  const drill = result.drills[0];
  assert.equal(drillSection(drill, map), "posflop-defense");
  assert.deepEqual(validateDrill(drill, map), []);
  const legend = result.legend ?? DEFAULT_LEGEND;
  const rng = seededRng(9);
  const answers = new Map<string, Set<string>>();
  for (let i = 0; i < 600; i++) {
    const q = dealQuestion(drill, map, legend, rng);
    assert.equal(q.steps[0].board.length, 4, "primeira decisão é no turn");
    for (const s of q.steps) {
      const node = (map.get(s.strategyId)!.cbet as { node: string }).node;
      if (!answers.has(node)) answers.set(node, new Set());
      answers.get(node)!.add(s.correctActionId);
    }
    if (q.steps.length === 2) assert.equal(q.steps[1].board.length, 5);
  }
  assert.deepEqual([...answers.get("turn-alto")!].sort(), ["bet-115", "bet-67", "check"]);
  assert.deepEqual([...answers.get("turn-baixo")!].sort(), ["bet-25", "bet-67", "check"]);
  assert.deepEqual([...answers.get("river-baixo")!].sort(), ["bet-25", "check"]);
  assert.deepEqual([...answers.get("turn-3s")!], ["bet-67"]);
  assert.deepEqual([...answers.get("river-3s")!], ["bet-67"]);
});

test("carga BB vs Cbet flop: boards da guide, mãos do call vs HJ", async () => {
  const { drillSection } = await import("../sections");
  const { dealQuestion, validateDrill } = await import("../drill");
  const { seededRng } = await import("../rng");
  const { findVsCbetBoard } = await import("../vs-cbet");
  const deep = parseImportBundle(load("defesa-vanilla-deep.json"), DEFAULT_LEGEND);
  const result = parseImportBundle(load("bb-vs-cbet-flop.json"), DEFAULT_LEGEND, deep.strategies);
  assert.deepEqual(result.errors, []);
  const map = new Map([...deep.strategies, ...result.strategies].map((s) => [s.id, s]));
  const drill = result.drills[0];
  assert.equal(drillSection(drill, map), "posflop-defense");
  assert.deepEqual(validateDrill(drill, map), []);
  const rng = seededRng(4);
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const q = dealQuestion(drill, map, result.legend ?? DEFAULT_LEGEND, rng);
    assert.ok(findVsCbetBoard(q.steps[0].board), "flop é um board da planilha");
    assert.equal(map.get("bb-def-30bb-vs-hj")!.range[q.hand], "call");
    seen.add(q.steps[0].correctActionId);
  }
  assert.deepEqual([...seen].sort(), ["vc-call", "vc-fold", "vc-raise"]);
});

test("carga BW BB pós: linhas SRP, limped e ISO na seção Blind War", async () => {
  const { drillSection } = await import("../sections");
  const { dealQuestion, validateDrill } = await import("../drill");
  const { seededRng } = await import("../rng");
  const bwbb = parseImportBundle(load("bw-bb.json"), DEFAULT_LEGEND);
  const result = parseImportBundle(load("bw-bb-pos.json"), DEFAULT_LEGEND, bwbb.strategies);
  assert.deepEqual(result.errors, []);
  const map = new Map([...bwbb.strategies, ...result.strategies].map((s) => [s.id, s]));
  const drill = result.drills[0];
  assert.equal(drillSection(drill, map), "bw");
  assert.deepEqual(validateDrill(drill, map), []);
  const rng = seededRng(8);
  const seen = new Map<string, Set<string>>();
  let iso3 = 0;
  for (let i = 0; i < 700; i++) {
    const q = dealQuestion(drill, map, result.legend ?? DEFAULT_LEGEND, rng);
    if (q.steps[0].strategyId.endsWith("iso-flop")) {
      assert.equal(q.steps.length, 3, "ISO: flop, turn e river");
      iso3++;
    }
    for (const s of q.steps) {
      if (!seen.has(s.strategyId)) seen.set(s.strategyId, new Set());
      seen.get(s.strategyId)!.add(s.correctActionId);
    }
  }
  assert.ok(iso3 > 0);
  assert.deepEqual([...seen.get("bw-bb-pos-srp-vs-cbet")!].sort(), ["call", "fold", "raise-3x"]);
  assert.deepEqual([...seen.get("bw-bb-pos-iso-river")!].sort(), ["bet-67", "check"]);
});

test("stacks no pós-flop descontam o que já foi pro pote (30bb no BB vira 28bb no flop)", async () => {
  const { tableState } = await import("../table");
  const deep = parseImportBundle(load("defesa-vanilla-deep.json"), DEFAULT_LEGEND);
  const cbet = parseImportBundle(load("bb-vs-cbet-flop.json"), DEFAULT_LEGEND, deep.strategies);
  const s = cbet.strategies[0];
  const t = tableState(s, 1234);
  assert.equal(t.remaining!.BB, 28, "30bb − 2bb do open defendido");
  const villain = t.villainStart!;
  assert.equal(t.remaining!.HJ, Math.round((villain - 2 - 1.5) * 10) / 10, "vilão: open de 2bb + cbet de 1,5bb na frente");
  const bwbb = parseImportBundle(load("bw-bb.json"), DEFAULT_LEGEND);
  const pos = parseImportBundle(load("bw-bb-pos.json"), DEFAULT_LEGEND, bwbb.strategies);
  const river = pos.strategies.find((x) => x.id === "bw-bb-pos-iso-river")!;
  assert.equal(tableState(river, 99).remaining!.BB, 17.1, "ISO no river: 30 − 12,875");
});

test("carga BB vs 2nd Barrel: size do vilão bate com o tipo de turn", async () => {
  const { drillSection } = await import("../sections");
  const { dealQuestion, validateDrill } = await import("../drill");
  const { seededRng } = await import("../rng");
  const { barrelSize } = await import("../bb-vs-barrel");
  const deep = parseImportBundle(load("defesa-vanilla-deep.json"), DEFAULT_LEGEND);
  const result = parseImportBundle(load("bb-vs-2nd-barrel.json"), DEFAULT_LEGEND, deep.strategies);
  assert.deepEqual(result.errors, []);
  const map = new Map([...deep.strategies, ...result.strategies].map((s) => [s.id, s]));
  const drill = result.drills[0];
  assert.equal(drillSection(drill, map), "posflop-defense");
  assert.deepEqual(validateDrill(drill, map), []);
  const rng = seededRng(12);
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const q = dealQuestion(drill, map, result.legend ?? DEFAULT_LEGEND, rng);
    const s = map.get(q.steps[0].strategyId)!;
    assert.equal(barrelSize(q.steps[0].board), (s.cbet as { size: number }).size);
    seen.add(q.steps[0].correctActionId);
  }
  assert.deepEqual([...seen].sort(), ["vc-call", "vc-fold", "vc-raise"]);
});

test("carga 3bet Pot as Aggressor: mãos do 3-bet do BB vs HJ, flop → turn → river", async () => {
  const { drillSection } = await import("../sections");
  const { dealQuestion, validateDrill } = await import("../drill");
  const { seededRng } = await import("../rng");
  const deep = parseImportBundle(load("defesa-vanilla-deep.json"), DEFAULT_LEGEND);
  const result = parseImportBundle(load("3bet-pot-aggressor-oop.json"), DEFAULT_LEGEND, deep.strategies);
  assert.deepEqual(result.errors, []);
  const map = new Map([...deep.strategies, ...result.strategies].map((s) => [s.id, s]));
  const drill = result.drills[0];
  assert.equal(drillSection(drill, map), "posflop-attack");
  assert.deepEqual(validateDrill(drill, map), []);
  const rng = seededRng(21);
  const lengths = new Set<number>();
  for (let i = 0; i < 300; i++) {
    const q = dealQuestion(drill, map, result.legend ?? DEFAULT_LEGEND, rng);
    assert.ok(["3bet-call", "3bet-fold"].includes(map.get("bb-def-30bb-vs-hj")!.range[q.hand]!));
    lengths.add(q.steps.length);
  }
  assert.ok(lengths.has(3), "algumas mãos vão até o river");
  assert.ok(lengths.has(2), "outras param no turn (a linha do river não bate)");
});

test("carga Cbet Turn IP: turn do opener vs BB, seção Posflop Attack", async () => {
  const { drillSection } = await import("../sections");
  const { dealQuestion, validateDrill } = await import("../drill");
  const { seededRng } = await import("../rng");
  const rfi = parseImportBundle(load("rfi-30bb-vanilla.json"), DEFAULT_LEGEND);
  const result = parseImportBundle(load("cbet-turn-ip.json"), DEFAULT_LEGEND, rfi.strategies);
  assert.deepEqual(result.errors, []);
  const map = new Map([...rfi.strategies, ...result.strategies].map((s) => [s.id, s]));
  const drill = result.drills[0];
  assert.equal(drillSection(drill, map), "posflop-attack");
  assert.deepEqual(validateDrill(drill, map), []);
  const rng = seededRng(29);
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const q = dealQuestion(drill, map, result.legend ?? DEFAULT_LEGEND, rng);
    assert.equal(q.steps[0].board.length, 4, "decisão no turn");
    seen.add(q.steps[0].correctActionId);
  }
  for (const id of ["check", "bet-67", "bet-125", "vc-call", "vc-raise", "vc-fold"]) assert.ok(seen.has(id), id);
});

test("cargas pós-flop: toda estratégia pós-flop tem histórico da mão até a street dela", async () => {
  const { STREETS } = await import("../strategy");
  const { readdirSync } = await import("node:fs");
  for (const file of readdirSync("cargas").filter((f) => f.endsWith(".json"))) {
    for (const s of (load(file) as { strategies: { id: string; street: string; history?: string[] }[] }).strategies) {
      if (s.street === "preflop") continue;
      assert.ok(s.history?.length, `${s.id} sem histórico`);
      assert.ok(s.history.length <= STREETS.indexOf(s.street as never) + 1, `${s.id}: histórico passa da street da decisão`);
    }
  }
});

test("carga Mesa Final (rodadores): mesa 6-max real, ranges do HRC e seção Drills especiais", async () => {
  const { drillSection } = await import("../sections");
  const { validateDrill } = await import("../drill");
  const { tableState } = await import("../table");
  const result = parseImportBundle(load("maos-rodadores.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  const map = new Map(result.strategies.map((s) => [s.id, s]));
  const drill = result.drills[0];
  assert.deepEqual(validateDrill(drill, map), []);
  assert.equal(drillSection(drill, map), "especiais");
  const co = map.get("hrc-bh54-co-vs-hj")!;
  // HRC: 55 paga (97%); AA paga; KK all-in; ATs e 66 mistos; 44 fora
  assert.equal(co.range["55"], "call");
  assert.equal(co.range.AA, "call");
  assert.equal(co.range.KK, "shove");
  assert.equal(co.range["44"] ?? "fold", "fold");
  assert.deepEqual([co.range.ATs, co.alsoCorrect?.ATs], ["shove", "call"]);
  const hj = map.get("hrc-bh54-hj-rfi")!;
  assert.equal(hj.range["22"] ?? "fold", "fold");
  assert.equal(hj.range.A5o ?? "fold", "fold");
  assert.equal(hj.alsoCorrect?.A5o, "rfi-hrc-2bb");
  // Mesa: 6 lugares, stacks reais menos ante e blinds; open de 2bb do HJ; pote com os antes
  const state = tableState(co, 1);
  assert.deepEqual(state.seats.map((s) => s.position), ["UTG", "HJ", "CO", "BTN", "SB", "BB"]);
  assert.equal(state.remaining!.CO, 20.6);
  assert.equal(state.remaining!.HJ, 29.9);
  assert.equal(state.remaining!.SB, 13.1);
  assert.equal(state.pot, 4.4);
});

test("Mesa Final: FT da Daily Legends com mesas de 3, 5 e 6 jogadores", async () => {
  const { tableState } = await import("../table");
  const result = parseImportBundle(load("maos-rodadores.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  const map = new Map(result.strategies.map((s) => [s.id, s]));
  const seats = (id: string) => tableState(map.get(id)!, 1).seats.map((s) => s.position);
  assert.deepEqual(seats("hrc-dl22-3left-a-bb-vs-jam"), ["BTN", "SB", "BB"]);
  assert.deepEqual(seats("hrc-dl22-5left-e-co"), ["HJ", "CO", "BTN", "SB", "BB"]);
  assert.deepEqual(seats("hrc-dl22-6left-d-utg"), ["UTG", "HJ", "CO", "BTN", "SB", "BB"]);
  // A6o larga contra o all-in do BTN; A7o é misto (paga 34%); KJo paga 75%
  const vsJam = map.get("hrc-dl22-3left-a-bb-vs-jam")!;
  assert.equal(vsJam.range.A6o ?? "fold", "fold");
  assert.deepEqual([vsJam.range.A7o ?? "fold", vsJam.alsoCorrect?.A7o], ["fold", "call"]);
  assert.equal(vsJam.range.KJo, "call");
  const state = tableState(vsJam, 1);
  assert.equal(state.seats.find((s) => s.position === "BTN")!.posted, 14.7, "all-in efetivo do BTN na mesa");
  // K3s larga no BTN de 15bb; QJo abre 2bb com 16,8bb; 55 abre no UTG; A4s abre no CO
  assert.equal(map.get("hrc-dl22-3left-b-btn")!.range.K3s ?? "fold", "fold");
  assert.equal(map.get("hrc-dl22-3left-c-btn")!.range.QJo, "rfi-hrc-2bb");
  assert.equal(map.get("hrc-dl22-6left-d-utg")!.range["55"], "rfi-hrc-2bb");
  assert.equal(map.get("hrc-dl22-5left-e-co")!.range.A4s, "rfi-hrc-2bb");
});

test("PKO Spots: Bounty Hunters Deepstack perto da bolha, mesa 8-max com EP", async () => {
  const { drillSection } = await import("../sections");
  const { validateDrill } = await import("../drill");
  const { tableState } = await import("../table");
  const { positionLabel } = await import("../strategy");
  const result = parseImportBundle(load("pko-spots.json"), DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  const map = new Map(result.strategies.map((s) => [s.id, s]));
  const drill = result.drills[0];
  assert.equal(drill.name, "PKO Spots");
  assert.deepEqual(validateDrill(drill, map), []);
  assert.equal(drillSection(drill, map), "especiais");
  const utg = map.get("pko-bhds21-utg-rfi")!;
  const mp = map.get("pko-bhds21-mp-vs-utg")!;
  // 8 lugares (sem LJ); UTG1 aparece como EP, como no HRC
  assert.deepEqual(tableState(mp, 1).seats.map((s) => s.position), ["UTG", "UTG1", "MP", "HJ", "CO", "BTN", "SB", "BB"]);
  assert.equal(positionLabel("UTG1", mp.special), "EP");
  // UTG: 44+ abre, 33 (15%) larga; J8s, QTo e 98s mistos
  assert.equal(utg.range["44"], "rfi-hrc-2bb");
  assert.equal(utg.range["33"] ?? "fold", "fold");
  assert.deepEqual([utg.range.QTo ?? "fold", utg.alsoCorrect?.QTo], ["fold", "rfi-hrc-2bb"]);
  // MP com 8,3bb: all-in só com 99+, AJs+ e AQo+; KQo da mão real larga
  assert.equal(mp.range["99"], "shove");
  assert.equal(mp.range["88"] ?? "fold", "fold");
  assert.equal(mp.range.KQo ?? "fold", "fold");
  assert.equal(mp.range.AQo, "shove");
});
