"use client";

import { useRef } from "react";
import { HAND_GRID, type HandLabel } from "@/lib/poker/hands";
import { type Legend, findAction, textColorFor } from "@/lib/poker/legend";
import { type Range, actionOf } from "@/lib/poker/range";

interface RangeGridProps {
  range: Range;
  defaultActionId: string;
  legend: Legend;
  /** Mãos mistas: segunda ação aceita, desenhada na metade direita da casa. */
  alsoCorrect?: Range | null;
  /** Mão destacada (ex.: a mão do exercício). */
  highlight?: HandLabel | null;
  /** Se informado, a grade fica editável: clique ou arraste para pintar. */
  onPaint?: (hand: HandLabel) => void;
  compact?: boolean;
}

export function RangeGrid({ range, defaultActionId, legend, alsoCorrect, highlight, onPaint, compact }: RangeGridProps) {
  const painting = useRef(false);
  const lastPainted = useRef<HandLabel | null>(null);

  function paintAt(clientX: number, clientY: number) {
    if (!onPaint) return;
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const hand = element?.closest<HTMLElement>("[data-hand]")?.dataset.hand;
    if (hand && hand !== lastPainted.current) {
      lastPainted.current = hand;
      onPaint(hand);
    }
  }

  return (
    <div className="@container w-full">
    <div
      className={`grid select-none gap-px rounded-lg bg-zinc-800 p-px ${onPaint ? "cursor-crosshair touch-none" : ""}`}
      style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
      onPointerDown={(e) => {
        if (!onPaint) return;
        painting.current = true;
        lastPainted.current = null;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        paintAt(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (painting.current) paintAt(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        painting.current = false;
        lastPainted.current = null;
      }}
      onPointerCancel={() => {
        painting.current = false;
      }}
    >
      {HAND_GRID.flat().map((hand) => {
        const action = findAction(legend, actionOf(range, hand, defaultActionId));
        const background = action?.color ?? "#27272a";
        const second = alsoCorrect?.[hand] ? findAction(legend, alsoCorrect[hand]) : undefined;
        const isHighlight = highlight === hand;
        return (
          <div
            key={hand}
            data-hand={hand}
            data-mixed={second ? "true" : undefined}
            title={`${hand}: ${action?.label ?? "?"}${second ? ` ou ${second.label}` : ""}`}
            className={`flex aspect-square items-center justify-center font-mono leading-none ${
              isHighlight ? "relative z-10 ring-2 ring-white ring-offset-1 ring-offset-black" : ""
            }`}
            style={{
              backgroundColor: background,
              backgroundImage: second ? `linear-gradient(90deg, ${background} 50%, ${second.color} 50%)` : undefined,
              color: textColorFor(background),
              fontSize: compact ? "clamp(7px, 2cqw, 15px)" : "clamp(8px, 2.2cqw, 16px)",
            }}
          >
            {hand}
          </div>
        );
      })}
    </div>
    </div>
  );
}

export function LegendChips({ legend, actionIds }: { legend: Legend; actionIds?: string[] }) {
  const actions = actionIds ? legend.filter((a) => actionIds.includes(a.id)) : legend;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <span
          key={action.id}
          className="rounded-md px-2 py-1 text-xs font-medium"
          style={{ backgroundColor: action.color, color: textColorFor(action.color) }}
        >
          {action.label}
        </span>
      ))}
    </div>
  );
}
