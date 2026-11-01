"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { recordDecisions } from "@/app/(app)/drills/actions";
import { CardRow } from "@/components/PlayingCard";
import { PokerTable } from "@/components/PokerTable";
import { PositionChips } from "@/components/PositionChips";
import { RangeGrid } from "@/components/RangeGrid";
import { formatPercent } from "@/lib/format";
import {
  type Drill,
  type HandQuestion,
  dealQuestion,
  drillPositions,
  filterDrillByPositions,
  spotSummary,
} from "@/lib/poker/drill";
import type { Card } from "@/lib/poker/cards";
import { type Legend, findAction, textColorFor } from "@/lib/poker/legend";
import { STREET_LABELS, type Strategy, resolveRange } from "@/lib/poker/strategy";
import { boardTexture, describeFlop } from "@/lib/poker/texture";
import {
  type Bindings,
  CONTINUE_COMMAND,
  PEEK_COMMAND,
  SHORTCUTS_KEY,
  commandFor,
  inputShortLabel,
  isTypingTarget,
  keyInput,
  mouseInput,
  parseBindings,
} from "@/lib/shortcuts";

interface TrainerProps {
  drill: Drill;
  strategies: Strategy[];
  legend: Legend;
}

interface Decision {
  strategyId: string;
  heroCards: string[];
  board: string[];
  chosenActionId: string;
  correctActionId: string;
  hand: string;
  /** Respondida com a resposta à mostra: não conta no desempenho. */
  peeked: boolean;
}

type Submission = { drillId: string; decisions: Omit<Decision, "correctActionId" | "hand" | "peeked">[] };

/** O que cada mesa está mostrando agora (para o painel de range e o teclado). */
interface SlotState {
  strategyId: string;
  board: string[];
  hand: string;
  chosen: string | null;
}

/** O que o treino pode pedir para cada mesa (atalhos de teclado e mouse). */
interface SlotApi {
  choose: (actionId: string) => void;
  next: () => void;
  options: string[];
  /** A decisão atual desta mesa já foi respondida. */
  answered: boolean;
}

const PEEK_KEY = "trainer:mostrar-resposta";
const TABLES_KEY = "trainer:mesas";
const LENGTH_KEY = "trainer:maos";
/** 0 = padrão do drill; -1 = sem limite (até clicar em "Encerrar sessão"). */
const LENGTH_OPTIONS = [0, 10, 25, 50, 100, -1] as const;
export const TABLE_OPTIONS = [1, 2, 4] as const;
type TableCount = (typeof TABLE_OPTIONS)[number];

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  );
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // armazenamento indisponível: a preferência vale só nesta visita
  }
}

interface TableSlotProps {
  index: number;
  tableCount: TableCount;
  drill: Drill;
  strategyMap: Map<string, Strategy>;
  legend: Legend;
  vertical: boolean;
  peek: boolean;
  autoAdvance: boolean;
  /** Este slot recebe os atalhos: "choose" (ações) ou "next" (continuar). */
  keyboard: "choose" | "next" | null;
  bindings: Bindings;
  register: (index: number, api: SlotApi | null) => void;
  onDecision: (decision: Decision) => void;
  /** Avisa que a mão acabou; devolve se a sessão continua (e a mesa recebe outra mão). */
  onHandComplete: (decisions: Decision[]) => boolean;
  onState: (index: number, state: SlotState | null) => void;
  onError: (message: string) => void;
}

/** Uma mesa com a sua própria mão. */
function TableSlot({
  index,
  tableCount,
  drill,
  strategyMap,
  legend,
  vertical,
  peek,
  autoAdvance,
  keyboard,
  bindings,
  register,
  onDecision,
  onHandComplete,
  onState,
  onError,
}: TableSlotProps) {
  const [question, setQuestion] = useState<HandQuestion | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [handDecisions, setHandDecisions] = useState<Decision[]>([]);
  const [done, setDone] = useState(false);

  const deal = useCallback(() => {
    try {
      setQuestion(dealQuestion(drill, strategyMap, legend));
      setStepIndex(0);
      setChosen(null);
      setHandDecisions([]);
    } catch (error) {
      onError((error as Error).message);
    }
  }, [drill, strategyMap, legend, onError]);

  useEffect(() => {
    deal();
  }, [deal]);

  const step = question?.steps[stepIndex];
  const strategy = step ? strategyMap.get(step.strategyId) : undefined;

  useEffect(() => {
    onState(
      index,
      question && step && !done
        ? { strategyId: step.strategyId, board: step.board, hand: question.hand, chosen }
        : null,
    );
  }, [index, question, step, chosen, done, onState]);

  useEffect(() => () => onState(index, null), [index, onState]);

  const choose = useCallback(
    (actionId: string) => {
      if (!question || !step || chosen || done) return;
      setChosen(actionId);
      const decision: Decision = {
        strategyId: step.strategyId,
        heroCards: question.heroCards,
        board: step.board,
        chosenActionId: actionId,
        correctActionId: step.correctActionId,
        hand: question.hand,
        peeked: peek,
      };
      setHandDecisions((d) => [...d, decision]);
      onDecision(decision);
    },
    [question, step, chosen, done, peek, onDecision],
  );

  const next = useCallback(() => {
    if (!question || !chosen || done) return;
    if (stepIndex + 1 < question.steps.length) {
      setStepIndex((i) => i + 1);
      setChosen(null);
      return;
    }
    if (onHandComplete(handDecisions)) deal();
    else setDone(true);
  }, [question, chosen, done, stepIndex, handDecisions, onHandComplete, deal]);

  const isCorrect = chosen !== null && step !== undefined && chosen === step.correctActionId;

  useEffect(() => {
    if (chosen && isCorrect && autoAdvance) {
      const timer = setTimeout(next, 700);
      return () => clearTimeout(timer);
    }
  }, [chosen, isCorrect, autoAdvance, next]);

  useEffect(() => {
    register(index, step && !done ? { choose, next, options: step.options, answered: chosen !== null } : null);
  }, [index, step, done, chosen, choose, next, register]);

  useEffect(() => () => register(index, null), [index, register]);

  if (done) {
    return (
      <div className="card flex min-h-40 items-center justify-center text-sm text-zinc-500" data-testid="table-slot">
        Mesa encerrada
      </div>
    );
  }
  if (!question || !step || !strategy)
    return (
      <div className="card muted" data-testid="table-slot">
        Distribuindo cartas...
      </div>
    );

  const texture = step.board.length >= 3 ? describeFlop(boardTexture(step.board).flop) : null;
  const correctAction = findAction(legend, step.correctActionId);
  const multi = tableCount > 1;
  const rows = tableCount === 4 ? 2 : 1;

  return (
    <div
      className={`card space-y-4 transition-shadow ${multi ? "p-3" : ""} ${
        chosen === null
          ? keyboard === "choose" && multi
            ? "border-zinc-600"
            : ""
          : isCorrect
            ? "border-green-500 ring-2 ring-green-500"
            : "border-red-500 ring-2 ring-red-500"
      }`}
      data-feedback={chosen === null ? undefined : isCorrect ? "certo" : "errado"}
      data-testid="table-slot"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {multi && <span className="text-xs text-zinc-500">Mesa {index + 1}</span>}
        <span className="rounded bg-baga-red/20 px-2 py-0.5 font-medium text-baga-cream">
          {STREET_LABELS[step.street]}
        </span>
        <span className="text-zinc-300">{spotSummary({ ...strategy, pko: null })}</span>
        {strategy.pko && (
          <span
            className={`rounded px-2 py-0.5 text-xs font-bold tracking-wide uppercase ${
              strategy.pko.coverage === "coberto"
                ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/60"
                : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/60"
            }`}
            data-testid="pko-coverage"
          >
            PKO {strategy.pko.coverage}
          </span>
        )}
        {question.steps.length > 1 && (
          <span className="text-zinc-500">
            · decisão {stepIndex + 1} de {question.steps.length}
          </span>
        )}
      </div>

      <PokerTable
        strategy={strategy}
        heroCards={question.heroCards}
        board={step.board}
        texture={texture}
        vertical={vertical}
        rows={rows}
        reservedHeight={multi ? 250 + rows * 130 : 330}
        minWidth={multi ? 420 : 0}
      />

      <div className={`grid gap-2 ${multi ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`} data-testid="actions">
        {step.options.map((actionId, optionIndex) => {
          const action = findAction(legend, actionId);
          const isChosen = chosen === actionId;
          const isRight = chosen !== null && actionId === step.correctActionId;
          return (
            <button
              key={actionId}
              onClick={() => choose(actionId)}
              disabled={chosen !== null}
              className={`rounded-lg px-3 text-sm font-semibold transition disabled:cursor-default ${multi ? "py-2" : "py-3"} ${
                chosen !== null && !isChosen && !isRight ? "opacity-40" : ""
              } ${isRight ? "ring-2 ring-green-400" : ""} ${isChosen && !isRight ? "ring-2 ring-red-500" : ""}`}
              style={{
                backgroundColor: action?.color ?? "#3f3f46",
                color: textColorFor(action?.color ?? "#3f3f46"),
              }}
            >
              {keyboard === "choose" && (
                <span className="mr-1 hidden opacity-60 sm:inline">
                  {bindings[actionId] ? inputShortLabel(bindings[actionId]) : optionIndex + 1}
                </span>
              )}
              {action?.label ?? actionId}
            </button>
          );
        })}
      </div>

      {chosen && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`text-sm font-medium ${isCorrect ? "text-green-400" : "text-red-400"}`}>
            {isCorrect ? "Certo" : `Correta: ${correctAction?.label ?? step.correctActionId}`}
          </span>
          <button className="btn-secondary" onClick={next}>
            Continuar
            {keyboard === "next" && bindings[CONTINUE_COMMAND] && (
              <span className="text-xs opacity-60">{inputShortLabel(bindings[CONTINUE_COMMAND])}</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export function Trainer({ drill, strategies, legend }: TrainerProps) {
  const strategyMap = useMemo(() => new Map(strategies.map((s) => [s.id, s])), [strategies]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [handsPlayed, setHandsPlayed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [session, setSession] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [dealError, setDealError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const [positions, setPositions] = useState<string[]>([]);
  const [tableCount, setTableCount] = useState<TableCount>(1);
  const [lengthChoice, setLengthChoice] = useState<number>(0);
  /** Mãos da sessão; null = sem limite. */
  const sessionLength = lengthChoice === -1 ? null : lengthChoice === 0 ? drill.handsPerSession : lengthChoice;
  const lengthRef = useRef<number | null>(sessionLength);
  lengthRef.current = sessionLength;
  const [vertical, setVertical] = useState(false);
  const [slotStates, setSlotStates] = useState<(SlotState | null)[]>([]);
  const [panelSlot, setPanelSlot] = useState(0);
  const pending = useRef<Submission[]>([]);
  const handsRef = useRef(0);
  const [bindings, setBindings] = useState<Bindings>({});
  const slotApis = useRef<(SlotApi | null)[]>([]);
  const register = useCallback((index: number, api: SlotApi | null) => {
    slotApis.current[index] = api;
  }, []);

  const positionsKey = `trainer:posicoes:${drill.id}`;
  const availablePositions = useMemo(() => drillPositions(drill, strategyMap), [drill, strategyMap]);
  /** Drill com o filtro de posições do jogador (não muda o drill de ninguém). */
  const activeDrill = useMemo(
    () => filterDrillByPositions(drill, strategyMap, positions),
    [drill, strategyMap, positions],
  );

  useEffect(() => {
    // Mesa em pé no celular; tablets e telas maiores usam a mesa deitada
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setVertical(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setPeek(readStorage(PEEK_KEY) === "1");
    setBindings(parseBindings(readStorage(SHORTCUTS_KEY)));
    const length = Number(readStorage(LENGTH_KEY));
    if ((LENGTH_OPTIONS as readonly number[]).includes(length)) setLengthChoice(length);
    const tables = Number(readStorage(TABLES_KEY));
    if ((TABLE_OPTIONS as readonly number[]).includes(tables)) setTableCount(tables as TableCount);
    try {
      const saved = JSON.parse(readStorage(positionsKey) ?? "[]");
      if (Array.isArray(saved)) setPositions(saved.filter((p) => availablePositions.includes(p)));
    } catch {
      // preferência inválida: começa com todas as posições
    }
  }, [positionsKey, availablePositions]);

  function togglePeek() {
    setPeek((current) => {
      writeStorage(PEEK_KEY, current ? "0" : "1");
      return !current;
    });
  }

  function changePositions(next: string[]) {
    setPositions(next);
    writeStorage(positionsKey, JSON.stringify(next));
  }

  function changeLength(choice: number) {
    setLengthChoice(choice);
    writeStorage(LENGTH_KEY, String(choice));
    const limit = choice === -1 ? null : choice === 0 ? drill.handsPerSession : choice;
    if (limit !== null && handsRef.current >= limit) setFinished(true);
  }

  function endSession() {
    void flush();
    setFinished(true);
  }

  function changeTables(count: TableCount) {
    setTableCount(count);
    setPanelSlot(0);
    writeStorage(TABLES_KEY, String(count));
  }

  const flush = useCallback(async () => {
    const queue = [...pending.current];
    pending.current = [];
    for (const submission of queue) {
      const result = await recordDecisions(submission).catch(() => ({ ok: false as const, error: "Sem conexão." }));
      if (!result.ok) {
        pending.current.push(submission);
        setSaveError(`Não foi possível salvar algumas decisões (${result.error}). Vamos tentar de novo.`);
      } else if (pending.current.length === 0) {
        setSaveError(null);
      }
    }
  }, []);

  const onState = useCallback((index: number, state: SlotState | null) => {
    setSlotStates((current) => {
      const copy = [...current];
      copy[index] = state;
      return copy;
    });
  }, []);

  const makeOnDecision = useCallback(
    (index: number) => (decision: Decision) => {
      setDecisions((d) => [...d, decision]);
      setPanelSlot(index);
    },
    [],
  );

  const onHandComplete = useCallback(
    (handDecisions: Decision[]) => {
      const counted = handDecisions.filter((d) => !d.peeked);
      if (counted.length > 0) {
        pending.current.push({
          drillId: drill.id,
          decisions: counted.map(({ strategyId, heroCards, board, chosenActionId }) => ({
            strategyId,
            heroCards,
            board,
            chosenActionId,
          })),
        });
        void flush();
      }
      handsRef.current += 1;
      setHandsPlayed(handsRef.current);
      if (lengthRef.current !== null && handsRef.current >= lengthRef.current) {
        setFinished(true);
        return false;
      }
      return true;
    },
    [drill, flush],
  );

  const onError = useCallback((message: string) => setDealError(message), []);

  function restart() {
    handsRef.current = 0;
    setDecisions([]);
    setHandsPlayed(0);
    setFinished(false);
    setSlotStates([]);
    setPanelSlot(0);
    setSession((s) => s + 1);
  }

  const countedDecisions = decisions.filter((d) => !d.peeked);
  const peekedCount = decisions.length - countedDecisions.length;
  const correctCount = countedDecisions.filter((d) => d.chosenActionId === d.correctActionId).length;
  const accuracy = countedDecisions.length ? correctCount / countedDecisions.length : 0;

  // Teclado: números respondem a primeira mesa sem resposta; Enter continua a primeira já respondida.
  const visibleStates = slotStates.slice(0, tableCount);
  const chooseTarget = visibleStates.findIndex((s) => s !== null && s !== undefined && s.chosen === null);
  const nextTarget = visibleStates.findIndex((s) => s?.chosen != null);

  // Painel de range: a última mesa respondida (ou, com o olho aberto, a mesa que espera resposta).
  const panelIndex = peek && chooseTarget >= 0 && !visibleStates[panelSlot]?.chosen ? chooseTarget : panelSlot;
  const panel = visibleStates[panelIndex] ?? null;
  const panelStrategy = panel ? strategyMap.get(panel.strategyId) : undefined;
  const panelRange = panel && panelStrategy ? resolveRange(panelStrategy, panel.board as Card[]) : null;
  const showPanelRange = Boolean(panel && panelRange && (panel.chosen || peek));

  // Atalhos: teclado e botões do mouse, definidos pelo jogador na tela Atalhos.
  const tableCountRef = useRef(tableCount);
  tableCountRef.current = tableCount;
  const togglePeekRef = useRef(togglePeek);
  togglePeekRef.current = togglePeek;
  useEffect(() => {
    if (finished) return;
    function run(input: string, digit: number | null, event: Event): boolean {
      // Consulta as mesas na hora: a primeira sem resposta recebe a ação; a primeira respondida, o "continuar".
      const apis = slotApis.current.slice(0, tableCountRef.current);
      const choose = apis.findIndex((a) => a && !a.answered);
      const next = apis.findIndex((a) => a?.answered);
      const command = commandFor(bindings, input);
      if (command === CONTINUE_COMMAND) {
        if (next < 0) return false;
        slotApis.current[next]?.next();
        return true;
      }
      if (command === PEEK_COMMAND) {
        togglePeekRef.current();
        return true;
      }
      const api = choose >= 0 ? slotApis.current[choose] : null;
      if (command) {
        if (api?.options.includes(command)) {
          api.choose(command);
          return true;
        }
        return false;
      }
      // Sem atalho definido: números escolhem as ações na ordem; Enter/Espaço continuam
      if (digit !== null && api && digit >= 1 && digit <= api.options.length && !Object.values(bindings).includes(input)) {
        api.choose(api.options[digit - 1]);
        return true;
      }
      if (event instanceof KeyboardEvent && (event.code === "Space" || event.code === "Enter" || event.code === "NumpadEnter") &&
        !bindings[CONTINUE_COMMAND]) {
        if (next < 0) return false;
        slotApis.current[next]?.next();
        return true;
      }
      return false;
    }
    function onKey(event: KeyboardEvent) {
      if (isTypingTarget(event.target as HTMLInputElement | null)) return;
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const digitMatch = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
      if (run(keyInput(event), digitMatch ? Number(digitMatch[1]) : null, event)) event.preventDefault();
    }
    function onMouseDown(event: MouseEvent) {
      if (event.button === 0) return;
      if (run(mouseInput(event), null, event)) event.preventDefault();
    }
    // Botões laterais não voltam/avançam a página quando têm atalho
    function onMouseUp(event: MouseEvent) {
      if ((event.button === 3 || event.button === 4) && commandFor(bindings, mouseInput(event))) event.preventDefault();
    }
    function onContextMenu(event: MouseEvent) {
      if (commandFor(bindings, "mouse:2")) event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [bindings, finished]);

  if (dealError) {
    return (
      <div className="card space-y-2">
        <h1 className="page-title">{drill.name}</h1>
        <p className="text-red-400">{dealError}</p>
      </div>
    );
  }

  if (finished) {
    const mistakes = decisions.filter((d) => d.chosenActionId !== d.correctActionId);
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="card space-y-2 text-center">
          <p className="label">Sessão concluída</p>
          <p className="font-display text-6xl text-baga-cream">{countedDecisions.length ? formatPercent(accuracy) : "—"}</p>
          <p className="muted">
            {correctCount} de {countedDecisions.length} decisões certas
          </p>
          {peekedCount > 0 && (
            <p className="text-xs text-zinc-500">
              {peekedCount} respondida(s) com a resposta à mostra, fora da conta e do desempenho.
            </p>
          )}
        </div>
        {saveError && <p className="text-sm text-amber-400">{saveError}</p>}
        {mistakes.length > 0 && (
          <div className="card space-y-2">
            <h2 className="font-semibold">Erros da sessão</h2>
            <ul className="divide-y divide-zinc-800 text-sm">
              {mistakes.map((m, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="flex items-center gap-2" data-testid="mistake-cards" title={m.hand}>
                    {m.peeked && (
                      <span title="Com a resposta à mostra">
                        👁
                      </span>
                    )}
                    <CardRow cards={m.heroCards as Card[]} size="xs" />
                    {m.board.length > 0 && (
                      <span className="flex items-center gap-1 border-l border-zinc-700 pl-2">
                        <CardRow cards={m.board as Card[]} size="xs" />
                      </span>
                    )}
                  </span>
                  <span className="text-zinc-400">{strategyMap.get(m.strategyId)?.name}</span>
                  <span>
                    <span className="text-red-400">{findAction(legend, m.chosenActionId)?.label}</span>
                    {" → "}
                    <span className="text-green-400">{findAction(legend, m.correctActionId)?.label}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={restart}>
            Nova sessão
          </button>
          <Link href="/drills" className="btn-secondary">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const multi = tableCount > 1;
  // Com várias mesas, o range fica embaixo (telas médias) ou numa coluna estreita: não precisa ocupar tudo.
  const rangeMaxWidth = multi ? "min(100%, 520px, calc(100dvh - 290px))" : "min(100%, calc(100dvh - 290px))";
  const rangePanel = (
    <div className="card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="label mb-0">
          Range da estratégia{multi && panel ? ` · mesa ${panelIndex + 1}` : ""}
        </p>
        <button
          type="button"
          onClick={togglePeek}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
            peek ? "bg-baga-red/20 text-baga-cream" : "text-zinc-400 hover:text-white"
          }`}
          aria-pressed={peek}
          title={peek ? "Esconder a resposta antes de responder" : "Mostrar a resposta antes de responder"}
        >
          <EyeIcon open={peek} />
          {peek ? "Resposta à mostra" : "Mostrar resposta"}
        </button>
      </div>
      {showPanelRange && panel && panelRange && panelStrategy ? (
        <div className="mx-auto w-full" style={{ maxWidth: rangeMaxWidth }}>
          <RangeGrid
            range={panelRange}
            defaultActionId={panelStrategy.defaultActionId}
            legend={legend}
            highlight={panel.hand}
            compact
          />
        </div>
      ) : (
        <div
          className="mx-auto flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-500"
          style={{ maxWidth: rangeMaxWidth }}
        >
          Responda para ver o range
        </div>
      )}
      {peek && <p className="text-xs text-zinc-500">Com a resposta à mostra, as decisões não contam no desempenho.</p>}
    </div>
  );

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <div
            className="flex min-w-20 flex-col items-center rounded-lg border border-zinc-700 bg-black/60 px-3 py-1 leading-none"
            data-testid="hand-counter"
            title="Mão atual da sessão"
          >
            <span className="font-display text-3xl tracking-wide text-baga-cream sm:text-4xl">
              {sessionLength === null
                ? handsPlayed + 1
                : `${Math.min(handsPlayed + 1, sessionLength)}/${sessionLength}`}
            </span>
            <span className="text-[10px] tracking-wider text-zinc-500 uppercase">
              {sessionLength === null ? "sem limite" : "mão"}
            </span>
          </div>
          <div>
            <h1 className="text-lg font-semibold">{drill.name}</h1>
            <p className="muted">
              {countedDecisions.length > 0 ? formatPercent(accuracy) : "—"} de acerto
              {countedDecisions.length > 0 && ` · ${correctCount}/${countedDecisions.length} decisões`}
              {peekedCount > 0 && ` · ${peekedCount} com resposta à mostra`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} />
            Avançar sozinho quando acertar
          </label>
          <button type="button" className="btn-secondary px-3 py-1.5" onClick={endSession}>
            Encerrar sessão
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Mãos da sessão">
          <span className="mr-1 text-xs text-zinc-400">Mãos</span>
          {LENGTH_OPTIONS.filter((o) => o === 0 || o === -1 || o !== drill.handsPerSession).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => changeLength(option)}
              aria-pressed={lengthChoice === option}
              title={option === 0 ? "Quantidade definida no drill" : option === -1 ? "Até clicar em Encerrar sessão" : undefined}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                lengthChoice === option ? "bg-zinc-200 text-black" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              }`}
            >
              {option === 0 ? `${drill.handsPerSession} (padrão)` : option === -1 ? "Sem limite" : option}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Mesas">
          <span className="mr-1 text-xs text-zinc-400">Mesas</span>
          {TABLE_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => changeTables(count)}
              aria-pressed={tableCount === count}
              aria-label={`${count} ${count === 1 ? "mesa" : "mesas"}`}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                tableCount === count ? "bg-zinc-200 text-black" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              }`}
            >
              {count}
            </button>
          ))}
        </div>
        {availablePositions.length > 1 && (
          <PositionChips available={availablePositions} selected={positions} onChange={changePositions} />
        )}
        <p className="w-full text-xs text-zinc-500">
          Filtros só seus: o drill continua igual para o time.
        </p>
      </div>

      {sessionLength !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-baga-red transition-all"
            style={{ width: `${Math.min(100, (handsPlayed / sessionLength) * 100)}%` }}
          />
        </div>
      )}
      {saveError && <p className="text-xs text-amber-400">{saveError}</p>}

      <div
        className={`grid items-start gap-4 ${
          multi ? "2xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        }`}
      >
        <div className={`grid items-start gap-3 ${multi ? "md:grid-cols-2" : ""}`}>
          {Array.from({ length: tableCount }, (_, index) => (
            <TableSlot
              key={`${session}-${tableCount}-${index}`}
              index={index}
              tableCount={tableCount}
              drill={activeDrill}
              strategyMap={strategyMap}
              legend={legend}
              vertical={vertical}
              peek={peek}
              autoAdvance={autoAdvance}
              keyboard={index === chooseTarget ? "choose" : index === nextTarget ? "next" : null}
              bindings={bindings}
              register={register}
              onDecision={makeOnDecision(index)}
              onHandComplete={onHandComplete}
              onState={onState}
              onError={onError}
            />
          ))}
        </div>
        {rangePanel}
      </div>
    </div>
  );
}
