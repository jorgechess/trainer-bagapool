"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { recordDecisions } from "@/app/(app)/drills/actions";
import { PokerTable } from "@/components/PokerTable";
import { RangeGrid } from "@/components/RangeGrid";
import { formatPercent } from "@/lib/format";
import { type Drill, type HandQuestion, dealQuestion, spotSummary } from "@/lib/poker/drill";
import { type Legend, findAction, textColorFor } from "@/lib/poker/legend";
import { STREET_LABELS, type Strategy, resolveRange } from "@/lib/poker/strategy";
import { boardTexture, describeFlop } from "@/lib/poker/texture";

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

const PEEK_KEY = "trainer:mostrar-resposta";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  );
}

export function Trainer({ drill, strategies, legend }: TrainerProps) {
  const strategyMap = useMemo(() => new Map(strategies.map((s) => [s.id, s])), [strategies]);
  const [question, setQuestion] = useState<HandQuestion | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [handDecisions, setHandDecisions] = useState<Decision[]>([]);
  const [handsPlayed, setHandsPlayed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [dealError, setDealError] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pending = useRef<Submission[]>([]);

  const deal = useCallback(() => {
    try {
      setQuestion(dealQuestion(drill, strategyMap, legend));
      setStepIndex(0);
      setChosen(null);
      setHandDecisions([]);
    } catch (error) {
      setDealError((error as Error).message);
    }
  }, [drill, strategyMap, legend]);

  useEffect(() => {
    deal();
  }, [deal]);

  useEffect(() => {
    try {
      setPeek(localStorage.getItem(PEEK_KEY) === "1");
    } catch {
      // armazenamento indisponível: começa fechado
    }
  }, []);

  function togglePeek() {
    setPeek((current) => {
      const next = !current;
      try {
        localStorage.setItem(PEEK_KEY, next ? "1" : "0");
      } catch {
        // ignora
      }
      return next;
    });
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

  const step = question?.steps[stepIndex];
  const strategy = step ? strategyMap.get(step.strategyId) : undefined;

  const choose = useCallback(
    (actionId: string) => {
      if (!question || !step || chosen) return;
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
      setDecisions((d) => [...d, decision]);
    },
    [question, step, chosen, peek],
  );

  const next = useCallback(() => {
    if (!question || !chosen) return;
    if (stepIndex + 1 < question.steps.length) {
      setStepIndex((i) => i + 1);
      setChosen(null);
      return;
    }
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
    const played = handsPlayed + 1;
    setHandsPlayed(played);
    if (played >= drill.handsPerSession) setFinished(true);
    else deal();
  }, [question, chosen, stepIndex, drill, handDecisions, handsPlayed, flush, deal]);

  const isCorrect = chosen !== null && step !== undefined && chosen === step.correctActionId;

  useEffect(() => {
    if (chosen && isCorrect && autoAdvance) {
      const timer = setTimeout(next, 700);
      return () => clearTimeout(timer);
    }
  }, [chosen, isCorrect, autoAdvance, next]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!step || finished) return;
      if (!chosen) {
        const index = Number(event.key) - 1;
        if (index >= 0 && index < step.options.length) choose(step.options[index]);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, chosen, finished, choose, next]);

  function restart() {
    setDecisions([]);
    setHandsPlayed(0);
    setFinished(false);
    deal();
  }

  const countedDecisions = decisions.filter((d) => !d.peeked);
  const peekedCount = decisions.length - countedDecisions.length;
  const correctCount = countedDecisions.filter((d) => d.chosenActionId === d.correctActionId).length;
  const accuracy = countedDecisions.length ? correctCount / countedDecisions.length : 0;

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
    const passed = countedDecisions.length > 0 && accuracy >= drill.passAccuracy;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="card space-y-2 text-center">
          <p className="label">Sessão concluída</p>
          <p className={`text-5xl font-bold ${passed ? "text-green-400" : "text-red-400"}`}>{formatPercent(accuracy)}</p>
          <p className="muted">
            {correctCount} de {countedDecisions.length} decisões certas · meta {formatPercent(drill.passAccuracy)}
          </p>
          {peekedCount > 0 && (
            <p className="text-xs text-zinc-500">
              {peekedCount} respondida(s) com a resposta à mostra, fora da conta e do desempenho.
            </p>
          )}
          <p className={passed ? "text-green-400" : "text-red-400"}>{passed ? "Satisfatório" : "Abaixo da meta"}</p>
        </div>
        {saveError && <p className="text-sm text-amber-400">{saveError}</p>}
        {mistakes.length > 0 && (
          <div className="card space-y-2">
            <h2 className="font-semibold">Erros da sessão</h2>
            <ul className="divide-y divide-zinc-800 text-sm">
              {mistakes.map((m, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-mono">
                    {m.peeked && <span className="mr-1" title="Com a resposta à mostra">👁</span>}
                    {m.hand}
                    {m.board.length > 0 && <span className="ml-2 text-zinc-400">{m.board.join(" ")}</span>}
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

  if (!question || !step || !strategy) {
    return <p className="muted">Distribuindo cartas...</p>;
  }

  const range = resolveRange(strategy, step.board);
  const texture = step.board.length >= 3 ? describeFlop(boardTexture(step.board).flop) : null;
  const correctAction = findAction(legend, step.correctActionId);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{drill.name}</h1>
          <p className="muted">
            Mão {handsPlayed + 1} de {drill.handsPerSession} ·{" "}
            {countedDecisions.length > 0 ? formatPercent(accuracy) : "—"} de acerto
            {peekedCount > 0 && ` · ${peekedCount} com resposta à mostra`}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} />
          Avançar sozinho quando acertar
        </label>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full bg-orange-500 transition-all"
          style={{ width: `${(handsPlayed / drill.handsPerSession) * 100}%` }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,420px)]">
        <div className="card space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded bg-orange-500/20 px-2 py-0.5 font-medium text-orange-300">
              {STREET_LABELS[step.street]}
            </span>
            <span className="text-zinc-300">{spotSummary(strategy)}</span>
            {question.steps.length > 1 && (
              <span className="text-zinc-500">
                · decisão {stepIndex + 1} de {question.steps.length}
              </span>
            )}
          </div>

          <PokerTable strategy={strategy} heroCards={question.heroCards} board={step.board} />
          {texture && <p className="-mt-3 text-center text-xs text-zinc-500">{texture}</p>}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {step.options.map((actionId, index) => {
              const action = findAction(legend, actionId);
              const isChosen = chosen === actionId;
              const isRight = chosen !== null && actionId === step.correctActionId;
              return (
                <button
                  key={actionId}
                  onClick={() => choose(actionId)}
                  disabled={chosen !== null}
                  className={`rounded-lg px-3 py-3 text-sm font-semibold transition disabled:cursor-default ${
                    chosen !== null && !isChosen && !isRight ? "opacity-40" : ""
                  } ${isRight ? "ring-2 ring-green-400" : ""} ${isChosen && !isRight ? "ring-2 ring-red-500" : ""}`}
                  style={{
                    backgroundColor: action?.color ?? "#3f3f46",
                    color: textColorFor(action?.color ?? "#3f3f46"),
                  }}
                >
                  <span className="mr-1 hidden opacity-60 sm:inline">{index + 1}</span>
                  {action?.label ?? actionId}
                </button>
              );
            })}
          </div>

          {chosen && (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg p-3 ${
                isCorrect ? "bg-green-950 text-green-200" : "bg-red-950 text-red-200"
              }`}
            >
              <span className="font-medium">
                {isCorrect ? "Certo!" : `Errado. A ação correta é ${correctAction?.label ?? step.correctActionId}.`}
              </span>
              <button className="btn-secondary" onClick={next}>
                Continuar
              </button>
            </div>
          )}
          {saveError && <p className="text-xs text-amber-400">{saveError}</p>}
        </div>

        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <p className="label mb-0">Range da estratégia</p>
            <button
              type="button"
              onClick={togglePeek}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
                peek ? "bg-orange-500/20 text-orange-300" : "text-zinc-400 hover:text-white"
              }`}
              aria-pressed={peek}
              title={peek ? "Esconder a resposta antes de responder" : "Mostrar a resposta antes de responder"}
            >
              <EyeIcon open={peek} />
              {peek ? "Resposta à mostra" : "Mostrar resposta"}
            </button>
          </div>
          {(chosen || peek) && range ? (
            <RangeGrid
              range={range}
              defaultActionId={strategy.defaultActionId}
              legend={legend}
              highlight={question.hand}
              compact
            />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-500">
              Responda para ver o range
            </div>
          )}
          {peek && (
            <p className="text-xs text-zinc-500">Com a resposta à mostra, as decisões não contam no desempenho.</p>
          )}
        </div>
      </div>
    </div>
  );
}
