/**
 * Drills (exercícios): o criador escolhe as estratégias em sequência — de onde começa e até onde vai
 * (só uma ação, só uma street ou até o river). O motor distribui mãos e corrige cada decisão.
 */
import { type Card, fullDeck, isCard } from "./cards";
import { type HandLabel, combosOf, handFromCards, ALL_HANDS } from "./hands";
import { type Legend, continuesHand, findAction } from "./legend";
import { actionOf, borderHands } from "./range";
import { type Rng, defaultRng, pickOne, pickWeighted, shuffle } from "./rng";
import {
  BOARD_CARDS_BY_STREET,
  POSITIONS,
  STREETS,
  type Street,
  type Strategy,
  acceptedActions,
  formatNumberRange,
  formatRatio,
  resolveRange,
} from "./strategy";

export type HandSampling = "uniforme" | "fronteira";

export const SAMPLING_LABELS: Record<HandSampling, string> = {
  uniforme: "Aleatória (frequência natural)",
  fronteira: "Foco nas mãos de fronteira",
};

export interface Drill {
  id: string;
  name: string;
  description?: string;
  /** Ids das estratégias, na ordem em que as decisões acontecem. */
  steps: string[];
  /**
   * Variações: cada mão sorteia uma delas (ex.: RFI de todas as posições).
   * Quando existe, substitui `steps` (que fica igual à primeira variação).
   */
  variants?: string[][];
  sampling: HandSampling;
  tags: string[];
  /** Mãos sugeridas por sessão. */
  handsPerSession: number;
  /** Acerto mínimo para considerar satisfatório (0 a 1). */
  passAccuracy: number;
}

export interface QuestionStep {
  strategyId: string;
  street: Street;
  /** Cartas do board visíveis nesta decisão. */
  board: Card[];
  options: string[];
  correctActionId: string;
  /** Outras ações também aceitas (mão mista). */
  alsoAccepted?: string[];
}

export interface HandQuestion {
  heroCards: [Card, Card];
  hand: HandLabel;
  /** Board completo sorteado (5 cartas); cada passo mostra só as cartas da sua street. */
  fullBoard: Card[];
  steps: QuestionStep[];
}

/** Variações do drill (sempre pelo menos uma). */
export function drillVariants(drill: Drill): string[][] {
  return drill.variants?.length ? drill.variants : [drill.steps];
}

/** Todas as estratégias usadas pelo drill, sem repetição. */
export function drillStrategyIds(drill: Drill): string[] {
  return [...new Set(drillVariants(drill).flat())];
}

export function validateDrill(drill: Drill, strategies: Map<string, Strategy>): string[] {
  const errors: string[] = [];
  if (!drill.name.trim()) errors.push("O drill precisa de um nome.");
  if (!(drill.handsPerSession >= 1 && drill.handsPerSession <= 500))
    errors.push("Mãos por sessão deve ficar entre 1 e 500.");
  if (!(drill.passAccuracy > 0 && drill.passAccuracy <= 1)) errors.push("Acerto mínimo deve ficar entre 1% e 100%.");
  const variants = drillVariants(drill);
  variants.forEach((steps, index) => {
    const prefix = variants.length > 1 ? `Variação ${index + 1}: ` : "";
    if (steps.length === 0) errors.push(`${prefix}escolha pelo menos uma estratégia.`);
    let lastStreet = -1;
    for (const id of steps) {
      const strategy = strategies.get(id);
      if (!strategy) {
        errors.push(`${prefix}Estratégia não encontrada: ${id}.`);
        continue;
      }
      if (strategy.dealFrom && steps[0] === id) {
        const source = strategies.get(strategy.dealFrom.strategyId);
        if (!source) errors.push(`${prefix}"${strategy.name}" sorteia mãos de uma estratégia que não existe.`);
        else if (source.street !== "preflop")
          errors.push(`${prefix}"${strategy.name}" só pode sortear mãos de uma estratégia de pré-flop.`);
      }
      const streetIndex = STREETS.indexOf(strategy.street);
      if (streetIndex < lastStreet)
        errors.push(
          `${prefix}"${strategy.name}" está fora de ordem: as streets precisam seguir pré-flop → flop → turn → river.`,
        );
      lastStreet = Math.max(lastStreet, streetIndex);
    }
  });
  return [...new Set(errors)];
}

/** Escopo do drill, para mostrar ao jogador: "Só pré-flop", "Pré-flop até river"... */
export function drillScope(drill: Drill, strategies: Map<string, Strategy>): string {
  const labels: Record<Street, string> = { preflop: "pré-flop", flop: "flop", turn: "turn", river: "river" };
  const variants = drillVariants(drill)
    .map((steps) => steps.map((id) => strategies.get(id)?.street).filter((s): s is Street => Boolean(s)))
    .filter((streets) => streets.length > 0);
  if (variants.length === 0) return "—";
  const firsts = variants.map((v) => STREETS.indexOf(v[0]));
  const lasts = variants.map((v) => STREETS.indexOf(v[v.length - 1]));
  const first = STREETS[Math.min(...firsts)];
  const last = STREETS[Math.max(...lasts)];
  if (variants.every((v) => v.length === 1) && first === last) return `Uma decisão (${labels[first]})`;
  if (first === last) return `Só ${labels[first]}`;
  return `Do ${labels[first]} ao ${labels[last]}`;
}

/** Contexto do spot inicial para mostrar no exercício. */
export function spotSummary(strategy: Strategy): string {
  const parts = [strategy.situation, strategy.heroPosition];
  if (strategy.villainPosition) parts.push(`vs ${strategy.villainPosition}`);
  parts.push(formatNumberRange(strategy.stack, "bb"));
  if (strategy.ratio) parts.push(formatRatio(strategy.ratio));
  if (strategy.pko) parts.push(`PKO ${strategy.pko.coverage}`);
  return parts.join(" · ");
}

/** Mãos que a estratégia pode receber (respeita "sortear só do range de"), ou null = todas. */
export function allowedHands(strategy: Strategy, strategies: Map<string, Strategy>): Set<HandLabel> | null {
  if (!strategy.dealFrom) return null;
  const source = strategies.get(strategy.dealFrom.strategyId);
  if (!source) throw new Error(`"${strategy.name}" sorteia mãos de uma estratégia que não existe mais.`);
  if (source.street !== "preflop") throw new Error(`"${strategy.name}" só pode sortear mãos de uma estratégia de pré-flop.`);
  const actions = new Set(strategy.dealFrom.actionIds);
  return new Set(ALL_HANDS.filter((hand) => actions.has(actionOf(source.range, hand, source.defaultActionId))));
}

/** Estratégias que o drill precisa para funcionar: as das variações e as usadas em "sortear só do range de". */
export function drillDependencyIds(drill: Drill, strategies: Map<string, Strategy>): string[] {
  const ids = new Set(drillStrategyIds(drill));
  for (const id of [...ids]) {
    const from = strategies.get(id)?.dealFrom?.strategyId;
    if (from) ids.add(from);
  }
  return [...ids];
}

const FRONTEIRA_WEIGHT = 4;
const MAX_BOARD_TRIES = 200;

/**
 * Sorteia uma mão e monta a sequência de decisões.
 * A mão segue a linha correta: se a ação certa for fold ou all-in, as decisões seguintes não acontecem.
 */
export function dealQuestion(
  drill: Drill,
  strategies: Map<string, Strategy>,
  legend: Legend,
  rng: Rng = defaultRng,
): HandQuestion {
  const variants = drillVariants(drill);
  const chosenSteps = variants.length > 1 ? pickOne(rng, variants) : variants[0];
  const stepStrategies = chosenSteps.map((id) => {
    const strategy = strategies.get(id);
    if (!strategy) throw new Error(`Estratégia não encontrada: ${id}`);
    return strategy;
  });
  if (stepStrategies.length === 0) throw new Error("Drill sem estratégias");
  const first = stepStrategies[0];

  for (let attempt = 0; attempt < MAX_BOARD_TRIES; attempt++) {
    const deck = shuffle(rng, fullDeck());
    const fullBoard = deck.slice(0, 5);
    const used = new Set<Card>(fullBoard);

    // A primeira decisão precisa ter range para este board (pós-flop depende da textura).
    const firstRange = resolveRange(first, fullBoard);
    if (!firstRange) continue;

    const border = drill.sampling === "fronteira" ? new Set(borderHands(firstRange, first.defaultActionId)) : null;
    const allowed = allowedHands(first, strategies);
    if (allowed && allowed.size === 0) throw new Error(`"${first.name}" não tem mãos para sortear no range escolhido.`);
    const available = (allowed ? ALL_HANDS.filter((h) => allowed.has(h)) : ALL_HANDS).flatMap((hand) =>
      combosOf(hand)
        .filter(([a, b]) => !used.has(a) && !used.has(b))
        .map((combo) => ({ hand, combo })),
    );
    const pick = pickWeighted(rng, available, (item) => (border && border.has(item.hand) ? FRONTEIRA_WEIGHT : 1));
    const heroCards = pick.combo;
    const hand = handFromCards(heroCards[0], heroCards[1]);

    const steps: QuestionStep[] = [];
    for (const strategy of stepStrategies) {
      const previous = steps[steps.length - 1];
      if (previous && strategy.entryActionIds?.length && !strategy.entryActionIds.includes(previous.correctActionId))
        break; // a linha correta não chega nesta decisão
      const accepted = acceptedActions(strategy, hand, fullBoard);
      if (accepted === null) break; // estratégia não cobre este board
      const [correct, ...alsoAccepted] = accepted;
      steps.push({
        strategyId: strategy.id,
        street: strategy.street,
        board: fullBoard.slice(0, BOARD_CARDS_BY_STREET[strategy.street]),
        options: strategy.actionIds,
        correctActionId: correct,
        ...(alsoAccepted.length ? { alsoAccepted } : {}),
      });
      const action = findAction(legend, correct);
      if (!action || !continuesHand(action.kind)) break;
    }
    return { heroCards, hand, fullBoard, steps };
  }
  throw new Error("Nenhuma textura cadastrada combinou com os boards sorteados. Revise as texturas da estratégia.");
}

export function isCorrect(step: QuestionStep, chosenActionId: string): boolean {
  return step.correctActionId === chosenActionId || (step.alsoAccepted ?? []).includes(chosenActionId);
}

/** Registro de uma decisão do jogador — base do leak finder. */
export interface Attempt {
  drillId: string;
  strategyId: string;
  strategyName: string;
  situation: string;
  street: Street;
  heroPosition: string;
  stackLabel: string;
  ratioLabel: string | null;
  tags: string[];
  hand: HandLabel;
  heroCards: [Card, Card];
  board: Card[];
  chosenActionId: string;
  correctActionId: string;
  correct: boolean;
  createdAt: string;
}

export function buildAttempt(
  drill: Drill,
  strategy: Strategy,
  question: HandQuestion,
  step: QuestionStep,
  chosenActionId: string,
  now: Date = new Date(),
): Attempt {
  return {
    drillId: drill.id,
    strategyId: strategy.id,
    strategyName: strategy.name,
    situation: strategy.situation,
    street: strategy.street,
    heroPosition: strategy.heroPosition,
    stackLabel: formatNumberRange(strategy.stack, "bb"),
    ratioLabel: strategy.ratio ? formatRatio(strategy.ratio) : null,
    tags: [...new Set([...drill.tags, ...strategy.tags])],
    hand: question.hand,
    heroCards: question.heroCards,
    board: step.board,
    chosenActionId,
    correctActionId: step.correctActionId,
    correct: isCorrect(step, chosenActionId),
    createdAt: now.toISOString(),
  };
}

/**
 * Corrige no servidor uma decisão enviada pelo navegador: refaz o cálculo da ação certa a partir
 * das cartas, para que o leak finder não dependa do que o navegador diz.
 */
export function gradeSubmission(
  drill: Drill,
  strategy: Strategy,
  heroCards: readonly string[],
  board: readonly string[],
  chosenActionId: string,
  now: Date = new Date(),
): Attempt {
  if (!drillStrategyIds(drill).includes(strategy.id)) throw new Error("A estratégia não faz parte deste drill");
  const cards = [...heroCards, ...board];
  if (heroCards.length !== 2 || !cards.every(isCard)) throw new Error("Cartas inválidas");
  if (new Set(cards).size !== cards.length) throw new Error("Cartas repetidas");
  if (board.length !== BOARD_CARDS_BY_STREET[strategy.street]) throw new Error("Board incompatível com a street");
  if (!strategy.actionIds.includes(chosenActionId)) throw new Error("Ação inválida para esta decisão");
  const hero = heroCards as [Card, Card];
  const hand = handFromCards(hero[0], hero[1]);
  const accepted = acceptedActions(strategy, hand, board as Card[]);
  if (accepted === null) throw new Error("A estratégia não cobre este board");
  const [correct, ...alsoAccepted] = accepted;
  const step: QuestionStep = {
    strategyId: strategy.id,
    street: strategy.street,
    board: [...board] as Card[],
    options: strategy.actionIds,
    correctActionId: correct,
    ...(alsoAccepted.length ? { alsoAccepted } : {}),
  };
  return buildAttempt(drill, strategy, { heroCards: hero, hand, fullBoard: step.board, steps: [step] }, step, chosenActionId, now);
}

export interface SessionSummary {
  decisions: number;
  correct: number;
  accuracy: number;
  passed: boolean;
}

export function summarizeSession(attempts: readonly Attempt[], passAccuracy: number): SessionSummary {
  const correct = attempts.filter((a) => a.correct).length;
  const accuracy = attempts.length ? correct / attempts.length : 0;
  return { decisions: attempts.length, correct, accuracy, passed: attempts.length > 0 && accuracy >= passAccuracy };
}

// ---------------------------------------------------------------------------
// Posições do drill
// ---------------------------------------------------------------------------

/** Posições do herói na primeira decisão de cada variação, na ordem da mesa. */
export function drillPositions(drill: Drill, strategies: Map<string, Strategy>): string[] {
  const found = new Set(
    drillVariants(drill)
      .map((v) => strategies.get(v[0] ?? "")?.heroPosition)
      .filter((p): p is NonNullable<typeof p> => Boolean(p)),
  );
  return POSITIONS.filter((p) => found.has(p));
}

/**
 * Drill só com as variações que começam nas posições escolhidas pelo jogador.
 * Não altera o drill original; lista vazia ou sem nenhuma variação compatível = drill inteiro.
 */
export function filterDrillByPositions(drill: Drill, strategies: Map<string, Strategy>, positions: readonly string[]): Drill {
  return filterDrill(drill, strategies, { positions }).drill;
}

/** Proporção do spot para o filtro do jogador ("3:1", "1,5:1", "Bolha garantido"...), ou null. */
export function contextLabel(strategy: Strategy): string | null {
  if (strategy.bubble) return strategy.bubble === "itm-garantido" ? "Bolha garantido" : "Bolha não garantido";
  if (strategy.ratio) return formatRatio(strategy.ratio).replace(".", ",");
  return null;
}

function contextOrder(strategy: Strategy): number {
  if (strategy.bubble) return strategy.bubble === "itm-nao-garantido" ? -1 : -2;
  return strategy.ratio?.min ?? -3;
}

/** Proporções que aparecem no drill (maior para menor; bolhas por último). */
export function drillContexts(drill: Drill, strategies: Map<string, Strategy>): string[] {
  const found = new Map<string, number>();
  for (const v of drillVariants(drill)) {
    const s = strategies.get(v[0] ?? "");
    const label = s && contextLabel(s);
    if (s && label) found.set(label, contextOrder(s));
  }
  return [...found.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
}

/** Stacks do herói que aparecem no drill, do menor para o maior. */
export function drillStacks(drill: Drill, strategies: Map<string, Strategy>): string[] {
  const found = new Map<string, number>();
  for (const v of drillVariants(drill)) {
    const s = strategies.get(v[0] ?? "");
    if (s) found.set(formatNumberRange(s.stack, "bb"), s.stack.min);
  }
  return [...found.entries()].sort((a, b) => a[1] - b[1]).map(([label]) => label);
}

export interface DrillFilter {
  positions?: readonly string[];
  contexts?: readonly string[];
  stacks?: readonly string[];
}

function variantMatches(strategy: Strategy | undefined, filter: DrillFilter): boolean {
  if (!strategy) return false;
  if (filter.positions?.length && !filter.positions.includes(strategy.heroPosition)) return false;
  if (filter.contexts?.length && !filter.contexts.includes(contextLabel(strategy) ?? "")) return false;
  if (filter.stacks?.length && !filter.stacks.includes(formatNumberRange(strategy.stack, "bb"))) return false;
  return true;
}

/**
 * Drill só com as variações que batem com os filtros do jogador (posição, proporção, stack).
 * Não altera o drill original; filtros vazios ou combinação sem nenhuma variação = drill inteiro (`empty` avisa).
 */
export function filterDrill(drill: Drill, strategies: Map<string, Strategy>, filter: DrillFilter): { drill: Drill; empty: boolean } {
  if (!filter.positions?.length && !filter.contexts?.length && !filter.stacks?.length) return { drill, empty: false };
  const kept = drillVariants(drill).filter((v) => variantMatches(strategies.get(v[0] ?? ""), filter));
  if (kept.length === 0) return { drill, empty: true };
  return { drill: { ...drill, steps: kept[0], variants: kept }, empty: false };
}

export interface StrategyFamily {
  key: string;
  label: string;
  /** Posição do herói → id da estratégia. */
  byPosition: Partial<Record<string, string>>;
}

/**
 * Agrupa estratégias que são o mesmo spot em posições diferentes (mesma street, situação, stack,
 * proporção, bolha e vilão), para montar drills escolhendo as posições.
 */
export function strategyFamilies(strategies: readonly Strategy[]): StrategyFamily[] {
  const families = new Map<string, StrategyFamily>();
  for (const s of strategies) {
    const ratio = s.ratio ? formatRatio(s.ratio) : "";
    const key = [
      s.street,
      s.situation.toLowerCase(),
      s.stack.min,
      s.stack.max,
      ratio,
      s.bubble ?? "",
      s.villainPosition ?? "",
      s.pko?.coverage ?? "",
    ].join("|");
    let family = families.get(key);
    if (!family) {
      const parts = [s.situation, formatNumberRange(s.stack, "bb")];
      if (ratio) parts.push(ratio);
      if (s.villainPosition) parts.push(`vs ${s.villainPosition}`);
      if (s.pko) parts.push(`PKO ${s.pko.coverage}`);
      family = { key, label: `${parts.join(" · ")} (${s.street === "preflop" ? "pré-flop" : s.street})`, byPosition: {} };
      families.set(key, family);
    }
    if (!family.byPosition[s.heroPosition]) family.byPosition[s.heroPosition] = s.id;
  }
  return [...families.values()].sort((a, b) => a.label.localeCompare(b.label));
}
