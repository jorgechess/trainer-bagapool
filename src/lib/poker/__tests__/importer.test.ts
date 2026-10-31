import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImportBundle, slugify } from "../importer";
import { DEFAULT_LEGEND } from "../legend";
import { IMPORT_EXAMPLE } from "../../import-example";

const bundle = {
  strategies: [
    {
      name: "RFI BTN 2:1 ≤15bb",
      street: "preflop",
      situation: "RFI",
      heroPosition: "BTN",
      stack: { min: 0, max: 15 },
      ratio: { min: 2, max: 2 },
      tags: ["max-late"],
      actionIds: ["fold", "rfi", "shove"],
      defaultActionId: "fold",
      range: { rfi: "22+, A2s+, KTo+", shove: "22-55" },
    },
    {
      id: "cbet-btn",
      name: "Cbet BTN",
      street: "flop",
      situation: "Cbet",
      heroPosition: "BTN",
      stack: { min: 0, max: 15 },
      actionIds: ["check", "bet-33"],
      defaultActionId: "check",
      textureRanges: [{ label: "Geral", match: {}, range: { "bet-33": "TT+" } }],
    },
  ],
  drills: [{ name: "RFI até flop", steps: ["RFI BTN 2:1 ≤15bb", "cbet-btn"] }],
};

test("o exemplo da tela Importar é válido", () => {
  const result = parseImportBundle(IMPORT_EXAMPLE, DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  assert.equal(result.strategies.length, 2);
  assert.equal(result.drills.length, 1);
});

test("slugify remove acentos e símbolos", () => {
  assert.equal(slugify("Ação Pré-flop ≤15bb"), "acao-pre-flop-15bb");
});

test("importa estratégias e drills válidos", () => {
  const result = parseImportBundle(bundle, DEFAULT_LEGEND);
  assert.deepEqual(result.errors, []);
  assert.equal(result.strategies.length, 2);
  const rfi = result.strategies[0];
  assert.equal(rfi.id, "rfi-btn-2-1-15bb");
  assert.equal(rfi.range["AA"], "rfi");
  assert.equal(rfi.range["33"], "shove");
  assert.equal(rfi.range["72o"], undefined);
  assert.equal(result.strategies[1].textureRanges[0].range["QQ"], "bet-33");
  assert.deepEqual(result.drills[0].steps, [rfi.id, "cbet-btn"]);
  assert.equal(result.drills[0].passAccuracy, 0.9);
  assert.equal(result.legend, null);
});

test("aponta erros com a localização", () => {
  const broken = {
    strategies: [
      { ...bundle.strategies[0], heroPosition: "XX", range: { rfi: "AAs" } },
      { ...bundle.strategies[0] },
    ],
    drills: [{ name: "D", steps: ["inexistente"] }, { name: "Sem steps" }],
  };
  const result = parseImportBundle(broken, DEFAULT_LEGEND);
  assert.ok(result.errors.some((e) => e.includes("posição inválida")));
  assert.ok(result.errors.some((e) => e.includes("Par não leva")));
  assert.ok(result.errors.some((e) => e.includes("id repetido")));
  assert.ok(result.errors.some((e) => e.includes('"inexistente" não encontrada')));
  assert.ok(result.errors.some((e) => e.includes("precisa de \"steps\"")));
  assert.deepEqual(parseImportBundle(null, DEFAULT_LEGEND).errors.length, 1);
});

test("aceita legenda própria e valida", () => {
  const ok = parseImportBundle({ legend: DEFAULT_LEGEND, strategies: [] }, []);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.legend?.length, DEFAULT_LEGEND.length);
  const bad = parseImportBundle({ legend: [{ id: "x", label: "", color: "azul", kind: "fold" }] }, DEFAULT_LEGEND);
  assert.ok(bad.errors.some((e) => e.startsWith("Legenda:")));
  assert.equal(bad.legend, null);
});
