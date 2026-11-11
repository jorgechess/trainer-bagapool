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

test("BB Leads: flop, turn depois do lead/call, turn e river pelas guidelines", async () => {
  const { bbLeadRule, isLeadFlop } = await import("../cbet");
  type N = "flop-sim" | "flop-nao" | "turn-lead" | "turn" | "river";
  const rule = (b: string, node: N) => {
    const r = bbLeadRule(c(b), node);
    return r ? `${r.mode}:${r.size}` : null;
  };
  const lead = (hero: string, board: string, node: N) => cbetAnswer({ table: "bb-lead", node }, c(hero), c(board))?.action;
  // flop: sequência MLL/LLL (L = 2–6, M = 7–9)
  assert.equal(isLeadFlop(c("7c6h5s")), true);
  assert.equal(isLeadFlop(c("6c5h4s")), true);
  assert.equal(isLeadFlop(c("9c6h5s")), true);
  assert.equal(isLeadFlop(c("8c7h5s")), false); // MML
  assert.equal(isLeadFlop(c("Kc6h5s")), false);
  assert.equal(isLeadFlop(c("6c6h4s")), false);
  assert.equal(rule("6c5h4s", "flop-sim"), "range:bet-25");
  assert.equal(rule("Kc8h3s", "flop-sim"), null);
  assert.equal(rule("Kc8h3s", "flop-nao"), "range:check");
  assert.equal(rule("6c5h4s", "flop-nao"), null);
  // turn depois de lead/call no 654
  assert.equal(rule("6c5h4s2s", "turn-lead"), "range:bet-67"); // 4ª por baixo
  assert.equal(rule("6c5h4s5d", "turn-lead"), "range:bet-67"); // dobra
  assert.equal(rule("6c5h4s7c", "turn-lead"), "range:bet-25"); // 4ª por cima
  assert.equal(rule("6c5h4sTh", "turn-lead"), "range:bet-25"); // 9 ao Q
  assert.equal(rule("6c5h4sKh", "turn-lead"), "split:bet-115");
  assert.equal(lead("Kd6d", "6c5h4sKh", "turn-lead"), "bet-115"); // dois pares
  assert.equal(lead("3d3c", "6c5h4sKh", "turn-lead"), "bet-115"); // sequência
  assert.equal(lead("8d7d", "6c5h4sKd", "turn-lead"), "bet-115"); // sequência (8-4)
  assert.equal(lead("Qd9d", "6d5h4sKd", "turn-lead"), "bet-115"); // flush draw
  assert.equal(lead("Ad6d", "6c5h4sKh", "turn-lead"), "check"); // um par
  // turn avulso (BB check/call no flop)
  assert.equal(rule("Kc8h3h2h", "turn"), "range:check"); // 3F
  assert.equal(rule("Kc8h3s8d", "turn"), "range:bet-67"); // dobra média
  assert.equal(rule("Kc8h3sKd", "turn"), "range:check"); // dobra alta
  assert.equal(rule("Kc7h3s5d", "turn"), "range:bet-25"); // 3S 7-high (7-5-3)
  assert.equal(rule("Kc9h3s7d", "turn"), "range:check"); // 9-7 + K: sequência alta, não é 8-high
  assert.equal(rule("Kc8h3sJd", "turn"), "range:check");
  // river avulso
  assert.equal(rule("Kc8h3sJd8s", "river"), "split:bet-10"); // dobra (não é o 2º par: J)
  assert.equal(rule("Kc8h3sJdJs", "river"), "split:bet-100"); // dobra do 2º par
  assert.equal(rule("Kc8h3hJd2h", "river"), "split:bet-10"); // flush completo
  assert.equal(rule("Kc9h3sTd8s", "river"), "split:bet-10"); // QJ/76 completam pelas duas pontas
  assert.equal(rule("Kc8h3s2d4d", "river"), "range:check");
  assert.equal(lead("AdJc", "Kc8h3sJdJs", "river"), "bet-100"); // trinca
  assert.equal(lead("Ad4c", "Kc8h3sJdJs", "river"), "bet-100"); // ar
  assert.equal(lead("Kd4c", "Kc8h3sJdJs", "river"), "check"); // um par (o par do board não conta)
});

test("BB Probes: turn por altura do flop, hotspots e probe + barrel", async () => {
  const { bbProbeRule, isProbeBarrelFlop } = await import("../cbet");
  type N = "turn-alto" | "turn-baixo" | "river-baixo" | "turn-3s" | "river-3s";
  const rule = (b: string, node: N) => {
    const r = bbProbeRule(c(b), node);
    return r ? `${r.mode}:${r.size}` : null;
  };
  const probe = (hero: string, board: string) => cbetAnswer({ table: "bb-probe", node: "turn-alto" }, c(hero), c(board))?.action;
  assert.equal(isProbeBarrelFlop(c("JcTh7s")), true);
  assert.equal(isProbeBarrelFlop(c("Tc8h6s")), true);
  assert.equal(isProbeBarrelFlop(c("Kc8h3s")), false);
  // flop T-high+
  assert.equal(rule("Kc8h3s2d", "turn-alto"), "split:bet-115"); // blank
  assert.equal(rule("Qc8h3sKd", "turn-alto"), "range:check"); // overcard
  assert.equal(rule("Qc8h3sTd", "turn-alto"), "split:bet-115"); // T num flop Q-high não é overcard
  assert.equal(rule("Kc8h3h2h", "turn-alto"), "range:bet-67"); // 3F
  assert.equal(rule("Qc9h3s7d", "turn-alto"), "split:bet-115");
  assert.equal(rule("Qc9h8sTd", "turn-alto"), "range:bet-67"); // 4S (8-9-T-Q)
  assert.equal(rule("Jc9h3sTd", "turn-alto"), "split:bet-115"); // J-T-9 é só 3 pra sequência
  assert.equal(rule("9c6h3s2d", "turn-alto"), null);
  // polar
  assert.equal(probe("Kd5d", "Kc8h3s2d"), "bet-115"); // top pair
  assert.equal(probe("8d7c", "Kc8h3s2d"), "check"); // segundo par
  assert.equal(probe("AhJh", "Kc8h3h2d"), "bet-115"); // flush draw
  assert.equal(probe("AdJc", "Kc8h3s2d"), "check");
  // flop 9-high-
  assert.equal(rule("9c6h3s2d", "turn-baixo"), "range:bet-25");
  assert.equal(rule("9c6h3sQd", "turn-baixo"), "range:check");
  assert.equal(rule("9c6h3s2d7c", "river-baixo"), "range:bet-25");
  assert.equal(rule("9c6h3s2dAc", "river-baixo"), "range:check");
  assert.equal(rule("9c6h3sQd2c", "river-baixo"), null); // turn A/H não tem barrel
  assert.equal(rule("7c6h5s2d", "turn-baixo"), null); // flop de lead
  // hotspot probe + barrel
  assert.equal(rule("JcTh7s2d", "turn-3s"), "range:bet-67");
  assert.equal(rule("JcTh7s2dAc", "river-3s"), "range:bet-67");
  assert.equal(rule("JcTh7s2d", "turn-alto"), null);
});

test("BB vs Cbet flop: guide vs EP mão a mão nos boards da planilha", async () => {
  const { vsCbetAnswer, findVsCbetBoard, randomVsCbetFlop, VS_CBET_BOARDS } = await import("../vs-cbet");
  const { seededRng } = await import("../rng");
  const vc = (hero: string, board: string) => vsCbetAnswer(c(hero), c(board))?.action;
  // ST AHH: 2nd e 3rd pair pagam (J7 em AKJ não é air); sem par segue fold
  assert.equal(vc("Jh7h", "AhKdJc"), "vc-call");
  assert.equal(vc("Kc5d", "AhKdJc"), "vc-call");
  assert.equal(vc("9h8h", "AhKdJc"), "vc-fold");
  assert.equal(vsCbetAnswer(c("Jh7h"), c("AhKdJc"))?.category, "2nd e 3rd pair (Kx, Jx)");
  assert.equal(VS_CBET_BOARDS.length, 29);
  // naipes trocados mantendo a estrutura acham o mesmo board
  assert.equal(findVsCbetBoard(c("AhTd8h"))?.label, "AHM");
  assert.equal(findVsCbetBoard(c("AhTh8d")), null, "outra estrutura de naipes não é o mesmo board");
  const rng = seededRng(3);
  for (let i = 0; i < 50; i++) assert.ok(findVsCbetBoard(randomVsCbetFlop(rng)));
  // A♠T♥8♠
  assert.equal(vc("AdKc", "AsTh8s"), "vc-raise"); // TPGK
  assert.equal(vc("Ad5c", "AsTh8s"), "vc-call"); // par do board
  assert.equal(vc("Ks3s", "AsTh8s"), "vc-raise"); // FD com 3x
  assert.equal(vc("KsQs", "AsTh8s"), "vc-call"); // FD (e broca)
  assert.equal(vc("KdQc", "AsTh8s"), "vc-call"); // melhor broca
  assert.equal(vc("9d6c", "AsTh8s"), "vc-raise"); // pior broca
  assert.equal(vc("5d5c", "AsTh8s"), "vc-fold"); // pocket
  assert.equal(vc("Kd4c", "AsTh8s"), "vc-fold"); // air
  // A♠9♥3♦: X/R todos os pares
  assert.equal(vc("2d2c", "As9h3d"), "vc-raise");
  assert.equal(vc("KdQc", "As9h3d"), "vc-fold");
  // K♠T♦3♥
  assert.equal(vc("QdJc", "KsTd3h"), "vc-raise"); // broadways
  assert.equal(vc("8d8c", "KsTd3h"), "vc-fold"); // pocket médio
  assert.equal(vc("4d4c", "KsTd3h"), "vc-raise"); // 55-
  // 7♠3♥2♦
  assert.equal(vc("Jd3c", "7s3h2d"), "vc-call"); // 3rd pair GK
  assert.equal(vc("9d9c", "7s3h2d"), "vc-raise"); // pocket
  assert.equal(vc("AdTc", "7s3h2d"), "vc-call");
  // DB T♦4♥4♦
  assert.equal(vc("Td4c", "Td4h4d"), "vc-call"); // full
  assert.equal(vc("8c8s", "Td4h4d"), "vc-call"); // pocket acima da trinca
  assert.equal(vc("3c3s", "Td4h4d"), "vc-raise");
  // MN 7♠3♠2♠
  assert.equal(vc("KsQs", "7s3s2s"), "vc-call"); // flush com 2 H
  assert.equal(vc("9s8s", "7s3s2s"), "vc-raise"); // flush sem 2 H
  assert.equal(vc("2c2h", "7s3s2s"), "vc-raise"); // bottom set
});

test("BW BB pós: categorias da mão e linhas do guide", async () => {
  const { bwBbAnswer, bwBbCategory } = await import("../bw-bb-pos");
  const a = (hero: string, board: string, node: Parameters<typeof bwBbAnswer>[2]) => bwBbAnswer(c(hero), c(board), node).action;
  assert.equal(bwBbCategory(c("Qc8d"), c("Qs8h5d")), "top");
  assert.equal(bwBbCategory(c("Qc4d"), c("Qs8h5d")), "value");
  assert.equal(bwBbCategory(c("9c9d"), c("Qs8h5d")), "mid");
  assert.equal(bwBbCategory(c("7c6d"), c("Qs8h5d")), "draw");
  assert.equal(bwBbCategory(c("9s3s"), c("Qs8h5d")), "backdoor");
  assert.equal(bwBbCategory(c("Kc2h"), c("Qs8h5d")), "air");
  // SRP vs cbet: float, acelera top pair, slow play dos top buckets
  assert.equal(a("Qc4d", "Qs8h5d", "srp-vs-cbet"), "raise-3x");
  assert.equal(a("Qc8d", "Qs8h5d", "srp-vs-cbet"), "call");
  assert.equal(a("9s3s", "Qs8h5d", "srp-vs-cbet"), "call");
  assert.equal(a("Kc2h", "Qs8h5d", "srp-vs-cbet"), "fold");
  // SRP vs check: BVM só por valor
  assert.equal(a("Qc4d", "Qs8h5d", "srp-x"), "bet-33");
  assert.equal(a("7c6d", "Qs8h5d", "srp-x"), "check");
  assert.equal(a("Kc2h", "Qs9h5d2c", "srp-2x"), "bet-67");
  assert.equal(a("7c6d", "Qs8h5d2c", "srp-delay"), "raise-3x");
  assert.equal(a("Kc3h", "Qs9h5d2c", "srp-delay"), "fold");
  // Limped
  assert.equal(a("Qc8d", "Qs8h5d", "lp-x"), "check");
  assert.equal(a("Kc2h", "Qs9h5d", "lp-x"), "bet-1bb");
  assert.equal(a("Qc4d", "Qs8h5d", "lp-vs-stab"), "raise-3x");
  // ISO
  assert.equal(a("Kc2h", "Qs9h5d", "iso-flop"), "bet-25");
  assert.equal(a("Kc2h", "Qs9h5d3c", "iso-turn"), "bet-67");
  assert.equal(a("Kc2h", "Qs9h5d3c7d", "iso-river"), "check");
  assert.equal(a("Qc2h", "Qs9h5d3c7d", "iso-river"), "bet-67");
});

test("BB vs 2nd Barrel: size por turn, bottom de call por posição e draws por size", async () => {
  const { turnType, barrelSize, barrelAnswer } = await import("../bb-vs-barrel");
  const b = (hero: string, board: string, pos: "EP" | "MP" | "LP") => barrelAnswer(c(hero), c(board), pos).action;
  assert.equal(turnType(c("Qs9h3d8c")), "3S");
  assert.equal(turnType(c("Qs9h3dQc")), "DH");
  assert.equal(turnType(c("Ks9h3d2c")), "L");
  assert.equal(barrelSize(c("Ks9h3d2c")), 125);
  assert.equal(barrelSize(c("Ks9h3d7c")), 67);
  assert.equal(turnType(c("Ks9h3h2h")), "3F");
  // bottom de call: EP 2nd pair GK, MP any 2nd pair, LP 3rd pair GK
  assert.equal(b("Ad9c", "Ks9h3d7c", "EP"), "vc-call");
  assert.equal(b("9c6c", "Ks9h3d7c", "EP"), "vc-fold");
  assert.equal(b("9c6c", "Ks9h3d7c", "MP"), "vc-call");
  assert.equal(b("Ac3d", "Ks9h3d2c", "LP"), "vc-call"); // 3rd pair GK vs LP
  assert.equal(b("Ac3d", "Ks9h3d2c", "EP"), "vc-fold");
  assert.equal(b("Kd5c", "Ks9h3d7c", "EP"), "vc-call"); // top pair
  assert.equal(b("Kd9c", "Ks9h3d7c", "EP"), "vc-raise"); // dois pares
  // draws vs b125 (turn L): OESD baixo folda, combo draw X/jam
  assert.equal(b("6c5d", "Ks7h4d2c", "EP"), "vc-fold"); // OESD 3-7 baixo? 4-5-6-7 + 3/8
  assert.equal(b("JhTh", "Ks9h4h2c", "EP"), "vc-raise"); // FD + broca (Q) vs b125: X/jam
  assert.equal(b("Th8h", "Ks9h4h2c", "EP"), "vc-call"); // FD médio (T) vs b125
});

test("3bet Pot as Aggressor OOP: cbet de range e game plan MES", async () => {
  const { threeBetAnswer } = await import("../threebet-pot");
  const a = (hero: string, board: string, node: "flop" | "turn" | "river-bet" | "river-xx") => threeBetAnswer(c(hero), c(board), node).action;
  assert.equal(a("Ad5c", "Kc7d2s", "flop"), "bet-25");
  assert.equal(a("Ad5c", "8c9c2s", "flop"), "bet-50"); // 2 middle cards e flush draw
  assert.equal(a("Qd9c", "Kc7d2s4h", "turn"), "bet-33"); // air: BBB
  assert.equal(a("Ad5c", "Kc7d2s4h", "turn"), "check"); // A5 virou broca de roda: check/shove
  assert.equal(a("QdQc", "Qs7d2h3c", "turn"), "check"); // valor protegido: slowplay
  assert.equal(a("Tc7c", "8c9c2s5h", "turn"), "check"); // draw: check/shove
  assert.equal(a("Ad5c", "Kc7d2s4h9s", "river-bet"), "shove");
  assert.equal(a("Ad5c", "Js9d8c6s3h", "river-xx"), "shove"); // bluff river
  assert.equal(a("8d5c", "Js9d8c6s3h", "river-xx"), "check"); // par médio
});

test("Cbet Turn IP (aula 29): size pelo runout, delayed cbet e vs probe", async () => {
  const { cbetTurnAnswer, runoutGroup, RUNOUT_SIZE } = await import("../cbet-turn");
  const g = (board: string) => runoutGroup(c(board));
  // exemplos da guideline
  assert.equal(g("Ks9c5dAs"), "A ou H");
  assert.equal(g("Qs7h2hQd"), "Dobra H");
  assert.equal(g("Ks9c4d2c"), "Brick");
  assert.equal(g("Ks8d4c8s"), "Dobra M/L");
  assert.equal(g("As7s4h9s"), "3F");
  assert.equal(g("9s8h2c6d"), "3S");
  assert.equal(g("AhTh7h2h"), "4F");
  assert.equal(g("JsTd9c8h"), "4S");
  assert.equal(RUNOUT_SIZE.Brick, "bet-125");
  assert.equal(RUNOUT_SIZE["3S"], "bet-67"); // b75 do solver arredondado para b67
  const a = (hero: string, board: string, node: "after-b40" | "after-b25" | "xx" | "probe-25" | "probe-67") =>
    cbetTurnAnswer(c(hero), c(board), node).action;
  // depois do cbet do flop: air barrela com o size do runout, par médio dá check
  assert.equal(a("Qd3c", "Ks9c4d2c", "after-b40"), "bet-125"); // air no brick
  assert.equal(a("Qd3c", "Ks9c5dAs", "after-b40"), "bet-67");
  assert.equal(a("Jd3c", "Ks8d4c8s", "after-b40"), "bet-40");
  assert.equal(a("KdQc", "Ks9c4d2c", "after-b40"), "bet-125"); // top pair
  assert.equal(a("9d8d", "Ks9c4d2c", "after-b40"), "check"); // segundo par
  assert.equal(a("QhJh", "As7s4h9s", "after-b40"), "bet-40"); // 3F: o b50 cai no b40
  // double check: delayed cbet b67
  assert.equal(a("Qd3c", "Ks9c4d2c", "xx"), "bet-67");
  assert.equal(a("9d8d", "Ks9c4d2c", "xx"), "check");
  // probe b25: raise 2nd pair+ e draws sem showdown
  assert.equal(a("9d8d", "Ks9c4d2c", "probe-25"), "vc-raise");
  assert.equal(a("QhJh", "Kh9h4d2c", "probe-25"), "vc-raise"); // flush draw
  assert.equal(a("6h3h", "Ks9c6d2c", "probe-25"), "vc-call"); // terceiro par
  assert.equal(a("4h3h", "Ks9c6d2c", "probe-25"), "vc-raise"); // broca sem showdown
  assert.equal(a("Qd3c", "Ks9c6d2c", "probe-25"), "vc-call"); // air
  // turn que dobra o board: top pair vira mão média e paga; raise só com trinca+
  assert.equal(a("Ah7s", "Jc9hAsJh", "probe-25"), "vc-call");
  assert.equal(a("JdTc", "Jc9hAs9d", "probe-25"), "vc-call");
  assert.equal(a("9dTc", "Jc9hAs9d", "probe-25"), "vc-raise"); // trinca
  // probe b67: 0% de raise
  assert.equal(a("KdKc", "Ks9c4d2c", "probe-67"), "vc-call"); // set paga
  assert.equal(a("9d8d", "Ks9c4d2c", "probe-67"), "vc-call");
  assert.equal(a("6h3c", "Ks9c6d2c", "probe-67"), "vc-fold"); // 3rd pair sem redraw
  assert.equal(a("6c5c", "Ks9c6d2c", "probe-67"), "vc-call"); // 3rd pair + flush draw
  assert.equal(a("QhJh", "Kh9h4d2c", "probe-67"), "vc-call"); // FD
  assert.equal(a("Qd3c", "Ks9c6d2c", "probe-67"), "vc-fold");
});

test("Cbet Turn IP: a linha do flop segue a nossa estratégia (B40/B25 de range; check só no split)", async () => {
  const { cbetAnswer, flopRuleFor } = await import("../cbet");
  const spec = (node: "after-b40" | "after-b25" | "xx" | "probe-25") => ({ table: "cbet-turn" as const, node });
  // J92 two-tone é range bet B40: entra no depois do B40, não no B25 nem no double check
  assert.ok(flopRuleFor(spec("after-b40"), c("Jh9h2d2h")));
  assert.equal(flopRuleFor(spec("after-b25"), c("Jh9h2d2h")), null);
  assert.equal(flopRuleFor(spec("xx"), c("Jh9h2d2h")), null);
  // JA9 é range bet: nada de probe
  assert.equal(flopRuleFor(spec("probe-25"), c("Jc9hAsJh")), null);
  // 773 (dobra M) é split: entra no double check, mas só com as mãos que dão check no flop
  assert.ok(flopRuleFor(spec("xx"), c("7s7d3c2h")));
  const checks = cbetAnswer({ table: "mes-ip-vs-bb", band: "25-50" }, c("AhKh"), c("7s7d3c"))!.action === "check";
  assert.equal(cbetAnswer(spec("xx"), c("AhKh"), c("7s7d3c2h")) !== null, checks);
});
