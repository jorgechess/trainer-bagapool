import type { Drill } from "../drill";
import { rangeFromNotation } from "../range";
import type { Strategy } from "../strategy";

export const rfiBtn: Strategy = {
  id: "rfi-btn-15",
  name: "RFI BTN ≤15bb 2:1",
  street: "preflop",
  situation: "RFI",
  heroPosition: "BTN",
  stack: { min: 10, max: 15 },
  ratio: { min: 2, max: 2 },
  bubble: null,
  tags: ["max-late"],
  actionIds: ["fold", "rfi", "shove"],
  defaultActionId: "fold",
  range: rangeFromNotation({ rfi: "22+, A2s+, K9s+, KTo+, QTs+, JTs", shove: "22-66" }),
  textureRanges: [],
};

export const cbetFlop: Strategy = {
  id: "cbet-btn",
  name: "Cbet BTN vs BB",
  street: "flop",
  situation: "Cbet",
  heroPosition: "BTN",
  villainPosition: "BB",
  stack: { min: 10, max: 15 },
  ratio: null,
  tags: ["pos-flop"],
  actionIds: ["check", "bet-33"],
  defaultActionId: "check",
  range: {},
  textureRanges: [
    { id: "mono", label: "Monotone", match: { suits: ["monotone"] }, range: {} },
    { id: "geral", label: "Geral", match: {}, range: rangeFromNotation({ "bet-33": "22+, A2s+, KTs+" }) },
  ],
};

export const turnBarrel: Strategy = {
  id: "barrel-turn",
  name: "Segundo barril",
  street: "turn",
  situation: "Segundo barril",
  heroPosition: "BTN",
  villainPosition: "BB",
  stack: { min: 10, max: 15 },
  ratio: null,
  tags: ["pos-flop"],
  actionIds: ["check", "bet-75"],
  defaultActionId: "check",
  entryActionIds: ["bet-33"],
  range: {},
  textureRanges: [{ id: "geral", label: "Geral", match: {}, range: rangeFromNotation({ "bet-75": "TT+, AKs" }) }],
};

export const strategies = new Map([rfiBtn, cbetFlop, turnBarrel].map((s) => [s.id, s]));

export const preflopDrill: Drill = {
  id: "drill-rfi",
  name: "RFI max late",
  steps: [rfiBtn.id],
  sampling: "uniforme",
  tags: ["drill-rfi"],
  handsPerSession: 50,
  passAccuracy: 0.9,
};

export const fullDrill: Drill = {
  id: "drill-ate-turn",
  name: "RFI até o turn",
  steps: [rfiBtn.id, cbetFlop.id, turnBarrel.id],
  sampling: "uniforme",
  tags: [],
  handsPerSession: 30,
  passAccuracy: 0.85,
};
