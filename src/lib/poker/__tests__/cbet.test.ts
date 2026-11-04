import { test } from "node:test";
import assert from "node:assert/strict";
import { cbetAnswer, mesFlopRule, readHand } from "../cbet";
import type { Card } from "../cards";

const c = (s: string) => s.match(/../g) as Card[];
const act = (band: "25-50" | "15", hero: string, board: string) =>
  cbetAnswer({ table: "mes-ip-vs-bb", band }, c(hero), c(board))?.action;

test("tabela MES: classe do flop e tamanho por stack", () => {
  const rule = (b: string, band: "25-50" | "15" = "25-50") => {
    const r = mesFlopRule(c(b), band)!;
    return `${r.mode}:${r.size}`;
  };
  assert.equal(rule("AsQh9d"), "range:bet-40");
  assert.equal(rule("As8s4h", "15"), "range:bet-25");
  assert.equal(rule("KsTh8d"), "range:bet-40"); // HH (asterisco: sem perfil, range bet)
  assert.equal(rule("Qs9h7h"), "range:bet-40"); // H-M-M
  assert.equal(rule("Kh8d4c"), "range:bet-40"); // H-M-L (mesma lógica do A-M-L)
  assert.equal(rule("Ks5h4d"), "range:bet-25"); // H-L-L
  assert.equal(rule("QsQhJs"), "range:bet-25"); // dobra H
  assert.equal(rule("Js8s4s"), "range:bet-25"); // mono
  assert.equal(rule("9s8s8h"), "split:bet-25"); // dobra M
  assert.equal(rule("Ks5h5d"), "split:bet-25"); // dobra L
  assert.equal(rule("9s6h3d"), "split:bet-40");
  assert.equal(rule("7s6h5d", "15"), "split:bet-40");
  assert.equal(mesFlopRule(c("8s8h8d"), "25-50"), null, "trinca no board fica fora");
  assert.equal(mesFlopRule(c("AsAh5d"), "25-50"), null, "par de Ás fica fora");
});

test("split: valor forte e draws apostam; equity média protegida dá check", () => {
  // K55r (X_B25): exemplo do time, K9o é check
  assert.equal(act("25-50", "Kc9h", "Ks5h5d"), "check");
  assert.equal(act("25-50", "KcTh", "Ks5h5d"), "bet-25");
  assert.equal(act("25-50", "7c7h", "Ks5h5d"), "check");
  assert.equal(act("25-50", "AcAh", "Ks5h5d"), "bet-25");
  assert.equal(act("25-50", "Ac5c", "Ks5h5d"), "bet-25"); // trinca
  assert.equal(act("25-50", "AcQh", "Ks5h5d"), "check"); // só uma overcard: Ás-alto com showdown
  assert.equal(act("25-50", "AcKh", "9s6h3d"), "bet-40"); // duas overcards sem showdown
  // 963r (X_B40)
  assert.equal(act("25-50", "8c7d", "9s6h3d"), "bet-40"); // OESD
  assert.equal(act("25-50", "Ac6d", "9s6h3d"), "check"); // segundo par
  assert.equal(act("25-50", "Ac4d", "9s6h3d"), "check"); // Ás-alto
  assert.equal(act("25-50", "Kc4d", "9s6h3d"), "check"); // ar
  assert.equal(act("25-50", "9c8d", "9s6h3d"), "check"); // top pair kicker fraco
  assert.equal(act("25-50", "AhTh", "9s6h3h"), "bet-40"); // flush draw + overcards
  assert.equal(act("15", "5c4d", "7s6h5d"), "bet-40"); // sequência... 7-6-5-4 + 3/8: OESD com par
  assert.equal(readHand(c("8c4d"), c("7s6h5d")).category, "Sequência");
  // range bet ignora a mão
  assert.equal(act("25-50", "2c3d", "AsQh9d"), "bet-40");
  assert.equal(act("15", "2c3d", "AsQh9d"), "bet-25");
});
