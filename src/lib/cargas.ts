/** Cargas prontas (pasta /cargas do repositório), oferecidas com um clique na tela Importar. */
import rfi30 from "../../cargas/rfi-30bb-vanilla.json";
import vs3bet30 from "../../cargas/vs3bet-30bb-vanilla.json";

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
];
