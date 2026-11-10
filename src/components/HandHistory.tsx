import { Fragment } from "react";
import { InlineCard } from "@/components/PlayingCard";
import type { HistoryLine } from "@/lib/poker/history";
import { STREET_LABELS } from "@/lib/poker/strategy";

/** Linha do tempo da mão: Pré-flop → Flop [cartas] → Turn [carta], com as ações de cada street. */
export function HandHistory({ lines, compact = false }: { lines: HistoryLine[]; compact?: boolean }) {
  if (!lines.length) return null;
  return (
    <ol
      className={`flex flex-wrap items-center rounded-md border border-zinc-800 bg-black/30 text-zinc-300 ${
        compact ? "gap-x-1.5 gap-y-0.5 px-2 py-1 text-[11px]" : "gap-x-2 gap-y-1 px-3 py-1.5 text-xs sm:text-sm"
      }`}
      aria-label="Histórico da mão"
      data-testid="historico-mao"
    >
      {lines.map((line, i) => (
        <Fragment key={line.street}>
          {i > 0 && (
            <li aria-hidden className="text-zinc-600">
              ›
            </li>
          )}
          <li className="flex items-center gap-1.5" data-street={line.street}>
            <span className="font-semibold text-zinc-400">{STREET_LABELS[line.street]}</span>
            {line.cards.length > 0 && (
              <span className="flex gap-0.5">
                {line.cards.map((card) => (
                  <InlineCard key={card} card={card} />
                ))}
              </span>
            )}
            {line.actions && <span className="text-zinc-100">{line.actions}</span>}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
