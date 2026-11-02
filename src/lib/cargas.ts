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
    name: "RFI 50bb PKO cobrindo",
    description: "7 estratégias de open (UTG a BTN) em PKO com o herói cobrindo, e o drill com todas.",
    requires: [],
    bundle: rfiPkoCobrindo,
  },
  {
    id: "rfi-50bb-pko-coberto",
    name: "RFI 50bb PKO coberto",
    description: "7 estratégias de open (UTG a BTN) em PKO com o herói coberto, e o drill com todas.",
    requires: [],
    bundle: rfiPkoCoberto,
  },
  {
    id: "vs3bet-50bb-pko-coberto",
    name: "vs 3-bet 50bb PKO coberto",
    description:
      "35 estratégias (quem abriu × quem deu 3-bet) em PKO com o herói coberto; mãos só do open coberto. Adiciona a ação 4-bet na legenda, se faltar.",
    requires: ["rfi-50bb-pko-coberto"],
    bundle: vs3betPkoCoberto,
  },
  {
    id: "vs3bet-50bb-pko-cobrindo",
    name: "vs 3-bet 50bb PKO cobrindo",
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
    name: "RFI PKO Short (RP -4% coberto)",
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
];
