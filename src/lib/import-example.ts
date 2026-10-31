/** Exemplo de arquivo de importação mostrado na tela Importar. */
export const IMPORT_EXAMPLE = {
  strategies: [
    {
      id: "rfi-btn-max-late-2-1",
      name: "RFI BTN max late 2:1",
      street: "preflop",
      situation: "RFI",
      heroPosition: "BTN",
      stack: { min: 0, max: 15 },
      ratio: { min: 2, max: 2 },
      bubble: null,
      tags: ["max-late", "rfi"],
      actionIds: ["fold", "rfi", "shove"],
      defaultActionId: "fold",
      range: {
        rfi: "55+, A2s+, A7o+, K8s+, KTo+, Q9s+, QJo, J9s+, T9s",
        shove: "22-44, A2o-A6o",
      },
    },
    {
      id: "cbet-btn-vs-bb",
      name: "Cbet BTN vs BB",
      street: "flop",
      situation: "Cbet",
      heroPosition: "BTN",
      villainPosition: "BB",
      stack: { min: 0, max: 15 },
      tags: ["pos-flop"],
      actionIds: ["check", "bet-33"],
      defaultActionId: "check",
      textureRanges: [
        { label: "Monotone", match: { suits: ["monotone"] }, range: { "bet-33": "TT+, AKs" } },
        { label: "Geral", match: {}, range: { "bet-33": "22+, A2s+, KTs+, ATo+" } },
      ],
    },
  ],
  drills: [
    {
      name: "RFI max late 2:1",
      steps: ["rfi-btn-max-late-2-1"],
      sampling: "fronteira",
      tags: ["max-late"],
      handsPerSession: 50,
      passAccuracy: 0.9,
    },
  ],
};
