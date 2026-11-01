"use client";

import { useState } from "react";
import { RangeGrid } from "@/components/RangeGrid";
import { ALL_HANDS } from "@/lib/poker/hands";
import { type Legend, findAction, textColorFor } from "@/lib/poker/legend";
import { type Range, paintHands, parseRangeNotation, rangeBreakdown } from "@/lib/poker/range";

interface RangePainterProps {
  range: Range;
  onChange: (range: Range) => void;
  /** Mãos mistas (só exibição). */
  alsoCorrect?: Range | null;
  legend: Legend;
  actionIds: string[];
  defaultActionId: string;
}

/** Editor de range: escolha a ação e clique ou arraste na grade; também aceita notação em texto. */
export function RangePainter({ range, onChange, alsoCorrect, legend, actionIds, defaultActionId }: RangePainterProps) {
  const actions = legend.filter((a) => actionIds.includes(a.id));
  const [brush, setBrush] = useState(actions.find((a) => a.id !== defaultActionId)?.id ?? defaultActionId);
  const [notation, setNotation] = useState("");
  const [notationError, setNotationError] = useState<string | null>(null);
  const activeBrush = actionIds.includes(brush) ? brush : defaultActionId;

  function applyNotation() {
    try {
      const hands = parseRangeNotation(notation);
      if (hands.length === 0) throw new Error("Nenhuma mão encontrada.");
      onChange(paintHands(range, hands, activeBrush));
      setNotation("");
      setNotationError(null);
    } catch (error) {
      setNotationError((error as Error).message);
    }
  }

  const breakdown = rangeBreakdown(range, defaultActionId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => setBrush(action.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              activeBrush === action.id ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900" : "opacity-70"
            }`}
            style={{ backgroundColor: action.color, color: textColorFor(action.color) }}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="max-w-xl">
        <RangeGrid
          range={range}
          alsoCorrect={alsoCorrect}
          defaultActionId={defaultActionId}
          legend={legend}
          onPaint={(hand) => onChange(paintHands(range, [hand], activeBrush))}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
        {breakdown.map((b) => (
          <span key={b.actionId}>
            <span
              className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle"
              style={{ backgroundColor: findAction(legend, b.actionId)?.color }}
            />
            {findAction(legend, b.actionId)?.label ?? b.actionId}: {b.percent}% ({b.combos} combos)
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input font-mono"
          placeholder="Pintar por texto com a ação selecionada: 22+, A2s+, KTo+"
          value={notation}
          onChange={(e) => setNotation(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyNotation();
            }
          }}
        />
        <button type="button" className="btn-secondary whitespace-nowrap" onClick={applyNotation}>
          Pintar
        </button>
        <button
          type="button"
          className="btn-secondary whitespace-nowrap"
          onClick={() => {
            if (confirm("Voltar todas as mãos para a ação padrão?")) onChange(paintHands({}, ALL_HANDS, defaultActionId));
          }}
        >
          Limpar
        </button>
      </div>
      {notationError && <p className="text-sm text-red-400">{notationError}</p>}
    </div>
  );
}
