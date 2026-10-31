/**
 * Drills (exercícios): o criador escolhe as estratégias em sequência — de onde começa e até onde vai
 * (só uma ação, só uma street ou até o river). O motor distribui mãos e corrige cada decisão.
 */
import { type Card, fullDeck, isCard } from "./cards";
import { type HandLabel, combosOf, handFromCards, ALL_HANDS } from "./hands";
import { type Legend, continuesHand, findAction } from "./legend";
import { borderHands } from "./range";
import { type Rng, defaultRng, pickOne, pickWeighted, shuffle } from "./rng";
import {
  BOARD_CARDS_BY_STREET,
  STREETS,
  type Street,
  type Strategy,
  correctAction,
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
  return parts.join(" · ");
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
    const available = ALL_HANDS.flatMap((hand) =>
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
      const correct = correctAction(strategy, hand, fullBoard);
      if (correct === null) break; // estratégia não cobre este board
      steps.push({
        strategyId: strategy.id,
        street: strategy.street,
        board: fullBoard.slice(0, BOARD_CARDS_BY_STREET[strategy.street]),
        options: strategy.actionIds,
        correctActionId: correct,
      });
      const action = findAction(legend, correct);
      if (!action || !continuesHand(action.kind)) break;
    }
    return { heroCards, hand, fullBoard, steps };
  }
  throw new Error("Nenhuma textura cadastrada combinou com os boards sorteados. Revise as texturas da estratégia.");
}

export function isCorrect(step: QuestionStep, chosenActionId: string): boolean {
  return step.correctActionId === chosenActionId;
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
  const correct = correctAction(strategy, hand, board as Card[]);
  if (correct === null) throw new Error("A estratégia não cobre este board");
  const step: QuestionStep = {
    strategyId: strategy.id,
    street: strategy.street,
    board: [...board] as Card[],
    options: strategy.actionIds,
    correctActionId: correct,
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
