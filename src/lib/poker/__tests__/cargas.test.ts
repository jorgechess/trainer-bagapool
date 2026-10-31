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
