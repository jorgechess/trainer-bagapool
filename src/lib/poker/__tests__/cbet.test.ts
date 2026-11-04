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

test("split na dobra (aula 05): nuts check, trincas apostam, escadinha invertida, naipe no resto", () => {
  // 988 / 994 / K55
  assert.equal(act("25-50", "8c8d", "9s8h8c"), "check"); // quadra bloqueia o call
  assert.equal(act("25-50", "9c9d", "9s8h8c"), "check"); // full
  assert.equal(act("25-50", "9c8d", "9s8h8c"), "check"); // full
  assert.equal(act("25-50", "Ac8d", "9s8h8c"), "bet-25"); // trinca
  assert.equal(act("25-50", "TcTd", "9s8h8c"), "bet-25"); // overpair baixo
  assert.equal(act("25-50", "QcQd", "9s8h8c"), "bet-25");
  assert.equal(act("25-50", "KcKd", "9s8h8c"), "check"); // escadinha invertida
  assert.equal(act("25-50", "AcAd", "9s8h8c"), "check");
  assert.equal(act("25-50", "Ac9d", "9s8h8c"), "bet-25"); // melhores noves
  assert.equal(act("25-50", "9c7c", "9s8h8c"), "check"); // piores noves
  assert.equal(act("25-50", "3c3d", "9s8h8c"), "bet-25"); // par baixo por proteção
  // Ás-alto: off aposta, suited dá check (print do Jorge: A8o no 994 é bet)
  assert.equal(act("15", "Ad8c", "9s9d4c"), "bet-25");
  assert.equal(act("15", "Ad8d", "9s9h4c"), "check");
  assert.equal(readHand(c("Ad8c"), c("9s9d4c")).category, "Ás-alto · offsuit");
  // K55: quadra/full check, trinca bet, underpairs baixos bet e altos check
  assert.equal(act("25-50", "5c5d", "Ks5h5d"), "check");
  assert.equal(act("25-50", "Ac5c", "Ks5h5d"), "bet-25");
  assert.equal(act("25-50", "AcAh", "Ks5h5d"), "check");
  assert.equal(act("25-50", "7c7h", "Ks5h5d"), "bet-25");
  assert.equal(act("25-50", "TcTh", "Ks5h5d"), "check");
  assert.equal(act("25-50", "4c4h", "Ks5h5d"), "bet-25");
  assert.equal(act("25-50", "KcTh", "Ks5h5d"), "bet-25");
  assert.equal(act("25-50", "Kc9h", "Ks5h5d"), "check"); // exemplo do time
  assert.equal(act("25-50", "QhJh", "Ks5h5d"), "check"); // suited
  assert.equal(act("25-50", "QcJh", "Ks5h5d"), "bet-25"); // off
});

test("split 9-high- (X_B40): trinca/nuts check, pares médios check, naipe no resto", () => {
  assert.equal(act("25-50", "9c9d", "9s6h3d"), "check"); // set sem sequência possível
  assert.equal(act("25-50", "TcTd", "9s6h3d"), "bet-40");
  assert.equal(act("25-50", "KcKd", "9s6h3d"), "check");
  assert.equal(act("25-50", "8c8d", "9s6h3d"), "check"); // par médio
  assert.equal(act("25-50", "Ac6d", "9s6h3d"), "check"); // segundo par
  assert.equal(act("25-50", "Ac9d", "9s6h3d"), "bet-40"); // top pair bom
  assert.equal(act("25-50", "9c8d", "9s6h3d"), "check"); // top pair fraco
  assert.equal(act("25-50", "8c7d", "9s6h3d"), "bet-40"); // OESD off
  assert.equal(act("25-50", "8c7c", "9s6h3d"), "check"); // OESD suited
  assert.equal(act("25-50", "AcKh", "9s6h3d"), "bet-40");
  assert.equal(act("25-50", "AhKh", "9s6h3d"), "check");
  // 765: checa a sequência nuts, aposta o set
  assert.equal(act("15", "9c8d", "7s6h5d"), "check");
  assert.equal(act("15", "4c3d", "7s6h5d"), "bet-40");
  assert.equal(act("15", "7c7d", "7s6h5d"), "bet-40");
  assert.equal(readHand(c("8c4d"), c("7s6h5d")).category, "Sequência");
  // range bet ignora a mão
  assert.equal(act("25-50", "2c3d", "AsQh9d"), "bet-40");
  assert.equal(act("15", "2c3d", "AsQh9d"), "bet-25");
});

test("BW SB pós (aula 17): guide do flop em raise/call e limp/check", async () => {
  const { bwFlopRule } = await import("../cbet");
  const rule = (b: string, node: "rc" | "lx" = "rc") => {
    const r = bwFlopRule(c(b), node)!;
    return `${r.mode}:${r.size}`;
  };
  // RC
  assert.equal(rule("As8c3h"), "range:bet-25"); // Axx
  assert.equal(rule("8s8h4d"), "range:bet-25"); // pareado
  assert.equal(rule("Js7s3s"), "range:bet-25"); // mono
  assert.equal(rule("Kc8h3d"), "split:bet-25"); // HMLr desconectado
  assert.equal(rule("Kc8h3h"), "split:bet-67"); // HMLfd
  assert.equal(rule("Qc4h3d"), "split:bet-25"); // HLL
  assert.equal(rule("9c5h2d"), "split:bet-25"); // MLLr desconectado
  assert.equal(rule("9c3h2d"), "split:bet-67"); // MLL conectado
  assert.equal(rule("KsQd8c"), "split:bet-67"); // HHM
  assert.equal(rule("7s6h5d"), "split:bet-67"); // sequência
  assert.equal(rule("AsKdQc"), "split:bet-67"); // AHH com sequência
  assert.equal(rule("4s3h2d"), "split:bet-67"); // LLL
  // LX (stab 1bb)
  assert.equal(rule("As8c3h", "lx"), "range:bet-1bb");
  assert.equal(rule("Kc8h3d", "lx"), "range:bet-1bb"); // K83: figura desconectada
  assert.equal(rule("6s6h2d", "lx"), "range:bet-1bb"); // dobrado
  assert.equal(rule("Js7s3s", "lx"), "split:bet-1bb"); // mono
  assert.equal(rule("Kc9h7d", "lx"), "split:bet-1bb"); // K97 conectado
  assert.equal(rule("Qc6h5h", "lx"), "split:bet-1bb"); // Q65fd
  assert.equal(rule("Qc4h3d", "lx"), "split:bet-1bb"); // Q43
  assert.equal(rule("9c3h2d", "lx"), "split:bet-1bb"); // 932
});

test("BW SB pós: tabela do split por mão", () => {
  const bw = (hero: string, board: string, node: "rc" | "lx" = "rc") =>
    cbetAnswer({ table: "bw-sb", node }, c(hero), c(board))?.action;
  // KQ8r (split polar B67)
  assert.equal(bw("Kc8d", "KsQd8c"), "check"); // dois pares: check 100%
  assert.equal(bw("AcAd", "KsQd8c"), "check"); // AA protege o check
  assert.equal(bw("KcAd", "KsQd8c"), "bet-67"); // top pair kicker bom
  assert.equal(bw("Kc5d", "KsQd8c"), "check"); // kicker baixo
  assert.equal(bw("Qc9d", "KsQd8c"), "check"); // segundo par em board HH
  assert.equal(bw("Jd9d", "KsQd8c"), "bet-67"); // OESD com naipe (backdoor de ouros)
  assert.equal(bw("Jh9c", "KsQd8c"), "check"); // OESD sem naipe
  // Kc8h3h (HMLfd, split polar)
  assert.equal(bw("QhJh", "Kc8h3h"), "bet-67"); // flush draw sem par
  assert.equal(bw("8d8s", "Kc8h3h"), "check"); // set
  assert.equal(bw("Ah5h", "Kc8h3h"), "bet-67"); // flush draw
  assert.equal(bw("Ah3h", "Kc8h3h"), "check"); // flush draw com par
  assert.equal(bw("Jh6c", "Kc8h3h"), "bet-67"); // trash com naipe na carta alta
  assert.equal(bw("Jc6h", "Kc8h3h"), "check"); // naipe na carta baixa
  assert.equal(bw("Ac8d", "Kc8h3h"), "bet-67"); // segundo par com top kicker
  assert.equal(bw("9c8d", "Kc8h3h"), "check");
  // Kc8h3d (HMLr, split misto B25)
  assert.equal(bw("Qh9c", "Kc8h3d"), "bet-25"); // trash com os dois naipes do board
  assert.equal(bw("Qs9s", "Kc8h3d"), "check"); // naipe fora do board
  assert.equal(bw("2c2d", "Kc8h3d"), "check"); // par baixo sem naipe
  // range
  assert.equal(bw("2c7d", "As8c3h"), "bet-25");
  assert.equal(bw("2c7d", "As8c3h", "lx"), "bet-1bb");
  assert.equal(bw("KcAd", "KsQd8c", "lx"), "bet-1bb"); // LX split usa a mesma tabela
});
