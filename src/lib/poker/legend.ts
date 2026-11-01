/** Legenda de ações: cada ação e cada sizing tem uma cor própria, escolhida pelo time. */

export const ACTION_KINDS = ["fold", "check", "call", "limp", "raise", "bet", "allin"] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export const ACTION_KIND_LABELS: Record<ActionKind, string> = {
  fold: "Fold",
  check: "Check",
  call: "Call / Flat",
  limp: "Limp",
  raise: "Raise",
  bet: "Bet",
  allin: "All-in / Shove",
};

export interface LegendAction {
  /** Identificador estável, ex.: "rfi", "shove", "bet-33". */
  id: string;
  /** Nome mostrado ao jogador, ex.: "Raise (RFI)". */
  label: string;
  /** Cor em hexadecimal, ex.: "#f97316". */
  color: string;
  kind: ActionKind;
  /** Sizing opcional, ex.: "2.2bb", "33%", "75%". */
  sizing?: string;
}

export type Legend = LegendAction[];

export const DEFAULT_LEGEND: Legend = [
  { id: "fold", label: "Fold", color: "#3b82f6", kind: "fold" },
  { id: "rfi", label: "Raise (RFI)", color: "#f97316", kind: "raise" },
  { id: "shove", label: "All-in", color: "#a855f7", kind: "allin" },
  { id: "limp", label: "Limp", color: "#22c55e", kind: "limp" },
  { id: "call", label: "Flat / Call", color: "#eab308", kind: "call" },
  { id: "3bet", label: "3-bet", color: "#ef4444", kind: "raise" },
  { id: "4bet", label: "4-bet", color: "#e11d48", kind: "raise" },
  { id: "check", label: "Check", color: "#64748b", kind: "check" },
  { id: "bet-33", label: "Bet 33%", color: "#f59e0b", kind: "bet", sizing: "33%" },
  { id: "bet-75", label: "Bet 75%", color: "#ec4899", kind: "bet", sizing: "75%" },
];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const ACTION_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/** Retorna a lista de problemas da legenda (vazia = válida). */
export function validateLegend(legend: Legend): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const colors = new Map<string, string>();
  if (legend.length === 0) errors.push("A legenda precisa ter pelo menos uma ação.");
  for (const action of legend) {
    if (!ACTION_ID.test(action.id))
      errors.push(`Identificador inválido "${action.id}": use letras minúsculas, números e hífen.`);
    if (ids.has(action.id)) errors.push(`Identificador repetido: "${action.id}".`);
    ids.add(action.id);
    if (!action.label.trim()) errors.push(`A ação "${action.id}" precisa de um nome.`);
    if (!isHexColor(action.color)) errors.push(`Cor inválida na ação "${action.label}": ${action.color}.`);
    if (!(ACTION_KINDS as readonly string[]).includes(action.kind))
      errors.push(`Tipo inválido na ação "${action.label}": ${action.kind}.`);
    const normalizedColor = action.color.toLowerCase();
    const sameColor = colors.get(normalizedColor);
    if (sameColor) errors.push(`As ações "${sameColor}" e "${action.label}" usam a mesma cor.`);
    colors.set(normalizedColor, action.label);
  }
  return errors;
}

export function findAction(legend: Legend, id: string | undefined): LegendAction | undefined {
  return id === undefined ? undefined : legend.find((action) => action.id === id);
}

/** Cor do texto (preto ou branco) com melhor contraste sobre a cor de fundo. */
export function textColorFor(background: string): "#000000" | "#ffffff" {
  if (!isHexColor(background)) return "#000000";
  const channel = (offset: number) => {
    const value = parseInt(background.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.4 ? "#000000" : "#ffffff";
}

/** Ações que permitem a mão continuar para a próxima decisão. */
export function continuesHand(kind: ActionKind): boolean {
  return kind === "check" || kind === "call" || kind === "limp" || kind === "raise" || kind === "bet";
}
