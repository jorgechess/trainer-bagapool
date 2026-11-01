/** Estratégias do time: o range certo para cada spot. */
import type { Card } from "./cards";
import type { HandLabel } from "./hands";
import { type Legend, findAction } from "./legend";
import { type Range, actionOf, validateRange } from "./range";
import { type TextureMatch, boardTexture, textureMatches, validateTextureMatch } from "./texture";

export const STREETS = ["preflop", "flop", "turn", "river"] as const;
export type Street = (typeof STREETS)[number];

export const STREET_LABELS: Record<Street, string> = {
  preflop: "Pré-flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
};

/** Cartas do board visíveis em cada street. */
export const BOARD_CARDS_BY_STREET: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

export const POSITIONS = ["UTG", "UTG1", "MP", "LJ", "HJ", "CO", "BTN", "SB", "BB"] as const;
export type Position = (typeof POSITIONS)[number];

export type BubbleContext = "itm-garantido" | "itm-nao-garantido";

export const BUBBLE_LABELS: Record<BubbleContext, string> = {
  "itm-garantido": "Bolha com ITM garantido",
  "itm-nao-garantido": "Bolha sem ITM garantido",
};

export interface NumberRange {
  min: number;
  max: number;
}

export type Coverage = "cobrindo" | "coberto";

export interface PkoInfo {
  coverage: Coverage;
  /** Texto da etiqueta dourada de bounty (ex.: "$25.00"). Padrão: "$10.00". */
  bounty?: string;
  /** Stacks desenhados na mesa (bb). Padrão: quem cobre tem 10bb a mais que o stack da estratégia. */
  heroStack?: number;
  villainStack?: number;
}

export const COVERAGE_LABELS: Record<Coverage, string> = {
  cobrindo: "Cobrindo",
  coberto: "Coberto",
};

export interface DealFrom {
  strategyId: string;
  actionIds: string[];
}

export interface TextureRange {
  id: string;
  label: string;
  match: TextureMatch;
  range: Range;
}

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  street: Street;
  /** Situação livre, ex.: "RFI", "vs RFI", "Cbet", "Segundo barril", "Probe turn". */
  situation: string;
  heroPosition: Position;
  villainPosition?: Position | null;
  /** Faixa de stack efetivo em big blinds. */
  stack: NumberRange;
  /** Proporção jogadores restantes : premiados (ex.: 2 = 2 para 1). */
  ratio?: NumberRange | null;
  bubble?: BubbleContext | null;
  tags: string[];
  /** Ações oferecidas como botões no exercício. */
  actionIds: string[];
  /** Ação das mãos não pintadas. */
  defaultActionId: string;
  /**
   * Em um drill com várias decisões: esta decisão só acontece se a ação correta da decisão anterior
   * for uma destas (ex.: segundo barril só depois de cbet). Vazio = qualquer ação que continue a mão.
   */
  entryActionIds?: string[];
  /**
   * Só sorteia mãos em que outra estratégia (pré-flop) tem uma destas ações.
   * Ex.: vs 3-bet do CO só com mãos que o CO abre (RFI CO: "rfi").
   */
  dealFrom?: DealFrom | null;
  /** Torneio PKO (bounty): se o herói cobre ou é coberto, e o texto da etiqueta de bounty. */
  pko?: PkoInfo | null;
  /** Tamanhos desenhados na mesa (bb). Padrão: open 2bb, 3-bet 3,5× o open. */
  tableSizes?: { open?: number; threeBet?: number } | null;
  /** Range do pré-flop. */
  range: Range;
  /** Ranges do pós-flop por textura; vale a primeira textura que combinar com o board. */
  textureRanges: TextureRange[];
}

/** Range aplicável ao board, ou null se nenhuma textura cadastrada combinar. */
export function resolveRange(strategy: Strategy, board: readonly Card[]): Range | null {
  if (strategy.street === "preflop") return strategy.range;
  const visible = board.slice(0, BOARD_CARDS_BY_STREET[strategy.street]);
  if (visible.length < BOARD_CARDS_BY_STREET[strategy.street]) throw new Error("Board incompleto para a street");
  const texture = boardTexture(visible);
  const entry = strategy.textureRanges.find((tr) => textureMatches(tr.match, texture));
  return entry ? entry.range : null;
}

/** Ação correta para a mão, ou null se a estratégia não cobre esse board. */
export function correctAction(strategy: Strategy, hand: HandLabel, board: readonly Card[]): string | null {
  const range = resolveRange(strategy, board);
  return range ? actionOf(range, hand, strategy.defaultActionId) : null;
}

export function formatNumberRange(range: NumberRange, unit = ""): string {
  if (range.min === range.max) return `${range.min}${unit}`;
  return `${range.min}–${range.max}${unit}`;
}

export function formatRatio(range: NumberRange): string {
  if (range.min === range.max) return `${range.min}:1`;
  return `${range.min}:1 a ${range.max}:1`;
}

export function validateStrategy(strategy: Strategy, legend: Legend): string[] {
  const errors: string[] = [];
  if (!strategy.name.trim()) errors.push("A estratégia precisa de um nome.");
  if (!strategy.situation.trim()) errors.push("Informe a situação (ex.: RFI, vs 3-bet, Cbet).");
  if (!(POSITIONS as readonly string[]).includes(strategy.heroPosition)) errors.push("Posição inválida.");
  if (!(STREETS as readonly string[]).includes(strategy.street)) errors.push("Street inválida.");
  if (!(strategy.stack.min >= 0 && strategy.stack.max >= strategy.stack.min))
    errors.push("Faixa de stack inválida.");
  if (strategy.ratio && !(strategy.ratio.min >= 1 && strategy.ratio.max >= strategy.ratio.min))
    errors.push("Faixa de proporção inválida (mínimo 1:1).");
  if (strategy.actionIds.length < 2) errors.push("Escolha pelo menos duas ações para os botões do exercício.");
  for (const id of strategy.actionIds) {
    if (!findAction(legend, id)) errors.push(`A ação "${id}" não existe na legenda.`);
  }
  for (const id of strategy.entryActionIds ?? []) {
    if (!findAction(legend, id)) errors.push(`A ação de entrada "${id}" não existe na legenda.`);
  }
  if (strategy.pko && !["cobrindo", "coberto"].includes(strategy.pko.coverage))
    errors.push("PKO: informe se o herói está cobrindo ou coberto.");
  if (strategy.dealFrom) {
    if (!strategy.dealFrom.strategyId) errors.push("Escolha a estratégia de onde as mãos são sorteadas.");
    if (strategy.dealFrom.strategyId === strategy.id) errors.push("A estratégia não pode sortear mãos dela mesma.");
    if (strategy.dealFrom.actionIds.length === 0) errors.push("Escolha as ações do range de onde as mãos são sorteadas.");
  }
  if (!strategy.actionIds.includes(strategy.defaultActionId))
    errors.push("A ação padrão precisa estar entre os botões do exercício.");

  const checkRange = (range: Range, where: string) => {
    for (const message of validateRange(range, legend, strategy.defaultActionId)) errors.push(`${where}: ${message}`);
    for (const action of new Set(Object.values(range))) {
      if (action && !strategy.actionIds.includes(action))
        errors.push(`${where}: a ação "${action}" está no range, mas não está entre os botões do exercício.`);
    }
  };

  if (strategy.street === "preflop") {
    checkRange(strategy.range, "Range");
  } else {
    if (strategy.textureRanges.length === 0) errors.push("Cadastre pelo menos uma textura para o pós-flop.");
    for (const tr of strategy.textureRanges) {
      for (const message of validateTextureMatch(tr.match)) errors.push(`Textura "${tr.label}": ${message}`);
      checkRange(tr.range, `Textura "${tr.label}"`);
    }
  }
  return [...new Set(errors)];
}
