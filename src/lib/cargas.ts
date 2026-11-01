/** Cargas prontas (pasta /cargas do repositório), oferecidas com um clique na tela Importar. */
import rfi30 from "../../cargas/rfi-30bb-vanilla.json";
import vs3bet30 from "../../cargas/vs3bet-30bb-vanilla.json";
import rfiPkoCobrindo from "../../cargas/rfi-50bb-pko-cobrindo.json";
import rfiPkoCoberto from "../../cargas/rfi-50bb-pko-coberto.json";
import vs3betPkoCoberto from "../../cargas/vs3bet-50bb-pko-coberto.json";

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
];
