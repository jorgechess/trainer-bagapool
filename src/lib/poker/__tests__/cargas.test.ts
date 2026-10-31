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
