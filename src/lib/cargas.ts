/** Cargas do repositório (pasta /cargas): importadas direto no banco a cada nova versão (cargas-sync). */
import rfi30 from "../../cargas/rfi-30bb-vanilla.json";
import vs3bet30 from "../../cargas/vs3bet-30bb-vanilla.json";
import rfiPkoCobrindo from "../../cargas/rfi-50bb-pko-cobrindo.json";
import rfiPkoCoberto from "../../cargas/rfi-50bb-pko-coberto.json";
import vs3betPkoCoberto from "../../cargas/vs3bet-50bb-pko-coberto.json";
import vs3betPkoCobrindo from "../../cargas/vs3bet-50bb-pko-cobrindo.json";
import rfiMaxLate from "../../cargas/rfi-max-late-reg-vanilla.json";
import vsRestealMaxLate from "../../cargas/vs-resteal-max-late-reg-vanilla.json";
import rfiPkoShortCoberto from "../../cargas/rfi-pko-short-coberto.json";
import defesaVanillaDeep from "../../cargas/defesa-vanilla-deep.json";
import defesaBbPkoDeep from "../../cargas/defesa-bb-pko-deep.json";
import defesaBbVanillaMlr from "../../cargas/defesa-bb-vanilla-mlr.json";
import callShoveBbMlr from "../../cargas/call-shove-bb-mlr.json";
import defesaBbPkoShort from "../../cargas/defesa-bb-pko-short.json";
import defesaBbVanillaMultiway from "../../cargas/defesa-bb-vanilla-multiway.json";
import rfiSbChipEv from "../../cargas/rfi-sb-chip-ev.json";
import bwSbMlr from "../../cargas/bw-sb-mlr.json";
import bwBb from "../../cargas/bw-bb.json";
import threeBetPotOop from "../../cargas/3bet-pot-aggressor-oop.json";
import cbetTurnIp from "../../cargas/cbet-turn-ip.json";
import maosRodadores from "../../cargas/maos-rodadores.json";
import pkoSpots from "../../cargas/pko-spots.json";
import bbLeads from "../../cargas/bb-leads.json";
import bbProbes from "../../cargas/bb-probes.json";
import bbVs2ndBarrel from "../../cargas/bb-vs-2nd-barrel.json";
import bbVsCbetFlop from "../../cargas/bb-vs-cbet-flop.json";
import bwBbPos from "../../cargas/bw-bb-pos.json";
import bwSbPos from "../../cargas/bw-sb-pos.json";
import cbetFlopIp from "../../cargas/cbet-flop-ip.json";

export interface Carga {
  id: string;
  name: string;
  description: string;
  /** Cargas que precisam ser importadas antes. */
  requires: string[];
  bundle: unknown;
}

export const CARGAS: Carga[] = [
  {
    id: "rfi-30bb-vanilla",
    name: "RFI 30bb vanilla",
    description: "7 estratégias de open (UTG a BTN) e o drill com todas as posições.",
    requires: [],
    bundle: rfi30,
  },
  {
    id: "vs3bet-30bb-vanilla",
    name: "vs 3-bet 30bb vanilla",
    description: "35 estratégias (quem abriu × quem deu 3-bet) e o drill com todas; mãos só do range de open.",
    requires: ["rfi-30bb-vanilla"],
    bundle: vs3bet30,
  },
  {
    id: "rfi-50bb-pko-cobrindo",
    name: "RFI 50bb PKO COBRINDO",
    description: "7 estratégias de open (UTG a BTN) em PKO com o herói cobrindo, e o drill com todas.",
    requires: [],
    bundle: rfiPkoCobrindo,
  },
  {
    id: "rfi-50bb-pko-coberto",
    name: "RFI 50bb PKO COBERTO",
    description: "7 estratégias de open (UTG a BTN) em PKO com o herói coberto, e o drill com todas.",
    requires: [],
    bundle: rfiPkoCoberto,
  },
  {
    id: "vs3bet-50bb-pko-coberto",
    name: "vs 3-bet 50bb PKO COBERTO",
    description:
      "35 estratégias (quem abriu × quem deu 3-bet) em PKO com o herói coberto; mãos só do open coberto. Adiciona a ação 4-bet na legenda, se faltar.",
    requires: ["rfi-50bb-pko-coberto"],
    bundle: vs3betPkoCoberto,
  },
  {
    id: "vs3bet-50bb-pko-cobrindo",
    name: "vs 3-bet 50bb PKO COBRINDO",
    description:
      "35 estratégias (quem abriu × quem deu 3-bet) em PKO com o herói cobrindo; mãos só do open cobrindo. Adiciona a ação 4-bet na legenda, se faltar.",
    requires: ["rfi-50bb-pko-cobrindo"],
    bundle: vs3betPkoCobrindo,
  },
  {
    id: "rfi-max-late-reg-vanilla",
    name: "RFI Max Late Reg Vanilla",
    description:
      "168 estratégias de open: 3:1, 2:1, 1,5:1, bolha não garantido e bolha garantido, de 2bb a 15bb, UTG a BTN; e o drill com todas.",
    requires: [],
    bundle: rfiMaxLate,
  },
  {
    id: "vs-resteal-max-late-reg-vanilla",
    name: "Vs Resteal Max Late Reg Vanilla",
    description:
      "13 spots: MP (LJ e HJ) vs qualquer posição, LP (CO e BTN) vs SB e vs BB; você com 12–15bb e só mãos dos raises de 15bb do 3:1 e 2:1.",
    requires: ["rfi-max-late-reg-vanilla"],
    bundle: vsRestealMaxLate,
  },
  {
    id: "rfi-pko-short-coberto",
    name: "RFI PKO Short (RP -4% COBERTO)",
    description: "21 estratégias de open com 10, 15 e 20bb (UTG a BTN) em PKO com o herói coberto, e o drill com todas.",
    requires: [],
    bundle: rfiPkoShortCoberto,
  },
  {
    id: "defesa-vanilla-deep",
    name: "Defesa Vanilla Deep",
    description:
      "BB contra open de UTG a BTN com 20 e 30bb (filtro de stack no treino): flat, resteal, 3-bet/call e 3-bet/fold. Substitui os drills Defesa BB 20bb e 30bb.",
    requires: [],
    bundle: defesaVanillaDeep,
  },
  {
    id: "defesa-bb-pko-deep",
    name: "Defesa BB PKO Deep",
    description:
      "BB contra open de UTG a BTN em PKO com 30 e 50bb, cobrindo e coberto (filtros no treino): flat, resteal, 3-bet/call e 3-bet/fold.",
    requires: [],
    bundle: defesaBbPkoDeep,
  },
  {
    id: "defesa-bb-vanilla-mlr",
    name: "Defesa BB Vanilla MLR",
    description:
      "350 spots: BB com 4, 6, 8, 10 e 15bb em 3:1, 2:1, 1,5:1 e bolhas, contra open de UTG a BTN, range linear (vilão >16bb) ou polar (10–14bb).",
    requires: [],
    bundle: defesaBbVanillaMlr,
  },
  {
    id: "call-shove-bb-mlr",
    name: "Call em Shoves do BB MLR",
    description:
      "175 spots: BB com 4, 6, 8, 10 e 15bb em 3:1, 2:1, 1,5:1 e bolhas, contra shove de UTG a BTN (o vilão sempre cobre você).",
    requires: [],
    bundle: callShoveBbMlr,
  },
  {
    id: "defesa-bb-pko-short",
    name: "Defesa BB PKO Short",
    description:
      "BB coberto com 10, 15 e 20bb em 3:1, 1,5:1 e bolha não garantido, contra open de UTG a BTN: flat, resteal, 3-bet/call e 3-bet/fold.",
    requires: [],
    bundle: defesaBbPkoShort,
  },
  {
    id: "defesa-bb-vanilla-multiway",
    name: "Defesa BB Vanilla Multiway",
    description: "BB em 1,5:1 depois de open + call(s), 3-way e 4-way: call, squeeze/call, squeeze/fold ou resteal.",
    requires: [],
    bundle: defesaBbVanillaMultiway,
  },
  {
    id: "rfi-sb-chip-ev",
    name: "RFI SB Chip EV",
    description: "Blind war: SB com 12, 25, 50 e 100bb, limp, raise ou all-in.",
    requires: [],
    bundle: rfiSbChipEv,
  },
  {
    id: "bw-sb-mlr",
    name: "BW SB MLR",
    description: "Blind war max late: SB de 2 a 15bb em 3:1, 1,5:1 e bolha não garantido, com a decisão seguinte contra shove ou ISO do BB.",
    requires: [],
    bundle: bwSbMlr,
  },
  {
    id: "bw-bb",
    name: "BW BB Pré",
    description: "Blind war no BB, de 10 a 100bb: vs limp do SB (check, ISO, all-in e resposta ao 3-bet) e vs raise (fold, call, 3-bet, resteal).",
    requires: [],
    bundle: bwBb,
  },
  {
    id: "cbet-flop-ip",
    name: "Cbet flop IP",
    description: "Posflop Attack: cbet do CO/BTN vs BB pela estratégia MES (25–50bb e 15bb 3:1), com boards variados por classe.",
    requires: ["rfi-30bb-vanilla", "rfi-max-late-reg-vanilla"],
    bundle: cbetFlopIp,
  },
  {
    id: "bw-sb-pos",
    name: "BW SB Pós",
    description: "Blind War pós-flop (aula 17): SB vs BB 30bb, flop depois de raise/call (check, B25, B67) e de limp/check (check, stab 1bb).",
    requires: ["rfi-sb-chip-ev"],
    bundle: bwSbPos,
  },
  {
    id: "bb-leads",
    name: "BB Leads",
    description: "Posflop Defense: donk bets do BB 30bb vs CO e BTN no flop (com o turn depois do lead/call), no turn e no river.",
    requires: ["defesa-vanilla-deep"],
    bundle: bbLeads,
  },
  {
    id: "bb-probes",
    name: "BB Probes",
    description: "Posflop Defense: probes do BB 30bb vs CO e BTN no turn depois do flop check/check, com barrel no river nos flops baixos e 3S médios.",
    requires: ["defesa-vanilla-deep"],
    bundle: bbProbes,
  },
  {
    id: "bb-vs-cbet-flop",
    name: "BB vs Cbet Flop",
    description: "Posflop Defense: BB 30bb vs HJ contra cbet de size baixo no flop (X/C, X/R 3x, X/F) pela guide do time.",
    requires: ["defesa-vanilla-deep"],
    bundle: bbVsCbetFlop,
  },
  {
    id: "bw-bb-pos",
    name: "BW BB Pós",
    description: "Blind War pós-flop do BB 30bb vs SB: single raised, limped e ISO pelo guide da aula e o heat map do time.",
    requires: ["bw-bb"],
    bundle: bwBbPos,
  },
  {
    id: "bb-vs-2nd-barrel",
    name: "BB vs 2nd Barrel",
    description: "Posflop Defense (aula 24): BB 30bb vs barrel no turn de EP, MP e LP, com o size pelo tipo de turn.",
    requires: ["defesa-vanilla-deep"],
    bundle: bbVs2ndBarrel,
  },
  {
    id: "3bet-pot-aggressor-oop",
    name: "3bet Pot as Aggressor",
    description: "Posflop Attack (aula 27): BB 3-betou o HJ com 30bb; cbet de range no flop e game plan MES no turn e no river.",
    requires: ["defesa-vanilla-deep"],
    bundle: threeBetPotOop,
  },
  {
    id: "cbet-turn-ip",
    name: "Cbet Turn IP",
    description: "Posflop Attack (aula 29): HJ/CO/BTN vs BB 30bb no turn: barrel com o size do runout depois do b67, delayed cbet e vs probe b25/b67.",
    requires: ["rfi-30bb-vanilla"],
    bundle: cbetTurnIp,
  },
  {
    id: "maos-rodadores",
    name: "Mesa Final",
    description: "Drills especiais: spots de mesa final rodados no HRC (torneio, mesa, bounties, Risk Premium e ranges).",
    requires: [],
    bundle: maosRodadores,
  },
  {
    id: "pko-spots",
    name: "PKO Spots",
    description: "Drills especiais: spots de torneios PKO rodados no HRC (torneio, mesa, bounties, Risk Premium e ranges).",
    requires: ["maos-rodadores"],
    bundle: pkoSpots,
  },
];
