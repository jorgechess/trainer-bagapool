import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boardTexture,
  cardClass,
  describeFlop,
  flopTexture,
  patternMatches,
  textureMatches,
  validateTextureMatch,
} from "../texture";

test("classes das cartas seguem o padrão do time", () => {
  assert.equal(cardClass("A"), "A");
  for (const r of ["K", "Q", "J", "T"] as const) assert.equal(cardClass(r), "H");
  for (const r of ["9", "8", "7", "6"] as const) assert.equal(cardClass(r), "M");
  for (const r of ["5", "4", "3", "2"] as const) assert.equal(cardClass(r), "L");
});

test("padrão do flop em ordem decrescente", () => {
  assert.equal(flopTexture(["7c", "Kd", "3s"]).pattern, "H-M-L");
  assert.equal(flopTexture(["2c", "4d", "5s"]).pattern, "L-L-L");
  assert.equal(flopTexture(["8c", "As", "3d"]).pattern, "A-M-L");
});

test("naipes: monotone, two-tone, rainbow", () => {
  assert.equal(flopTexture(["7h", "Kh", "3h"]).suits, "monotone");
  assert.equal(flopTexture(["7h", "Kh", "3s"]).suits, "twotone");
  assert.equal(flopTexture(["7h", "Kd", "3s"]).suits, "rainbow");
});

test("flop pareado e trinca, com a classe da carta dobrada", () => {
  const low = flopTexture(["4c", "4d", "Ks"]);
  assert.equal(low.paired, "pareado");
  assert.equal(low.pairedClass, "L");
  const high = flopTexture(["Qc", "Qd", "5s"]);
  assert.equal(high.pairedClass, "H");
  const trips = flopTexture(["9c", "9d", "9s"]);
  assert.equal(trips.paired, "trinca");
  assert.equal(trips.pairedClass, "M");
  assert.equal(flopTexture(["9c", "8d", "2s"]).pairedClass, null);
});

test("flop inválido", () => {
  assert.throws(() => flopTexture(["9c", "8d"]));
  assert.throws(() => flopTexture(["9c", "9c", "2s"]));
  assert.throws(() => boardTexture(["9c", "8d"]));
  assert.throws(() => boardTexture(["9c", "8d", "2s", "9c"]));
});

test("textura do board com turn e river", () => {
  const t = boardTexture(["9c", "8d", "2s", "Ah", "5c"]);
  assert.equal(t.turnClass, "A");
  assert.equal(t.riverClass, "L");
  assert.equal(boardTexture(["9c", "8d", "2s"]).turnClass, null);
});

test("padrões com coringa", () => {
  assert.ok(patternMatches("A-*-*", "A-M-L"));
  assert.ok(patternMatches("h-m-l", "H-M-L"));
  assert.ok(!patternMatches("H-M-L", "H-L-L"));
  assert.ok(!patternMatches("H-M", "H-M-L"));
});

test("filtro de textura combina todos os campos informados", () => {
  const board = boardTexture(["Kh", "7h", "3h", "Td"]);
  assert.ok(textureMatches({}, board));
  assert.ok(textureMatches({ patterns: ["H-M-L"], suits: ["monotone"] }, board));
  assert.ok(!textureMatches({ suits: ["rainbow"] }, board));
  assert.ok(textureMatches({ turnClass: ["H"] }, board));
  assert.ok(!textureMatches({ riverClass: ["H"] }, board));
  assert.ok(!textureMatches({ pairedClass: ["L"] }, board));
  const paired = boardTexture(["4c", "4d", "Ks"]);
  assert.ok(textureMatches({ paired: ["pareado"], pairedClass: ["L"] }, paired));
  assert.ok(!textureMatches({ paired: ["nao"] }, paired));
});

test("validação e descrição de textura", () => {
  assert.deepEqual(validateTextureMatch({ patterns: ["H-M-L", "a-*-*"] }), []);
  assert.equal(validateTextureMatch({ patterns: ["X-M-L"] }).length, 1);
  assert.equal(describeFlop(flopTexture(["4c", "4d", "Ks"])), "High-Low-Low · Rainbow · Pareado (dobrado) em Low");
});
