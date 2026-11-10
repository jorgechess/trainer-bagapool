import { Fragment } from "react";
import { InlineCard } from "@/components/PlayingCard";
import type { HistoryLine } from "@/lib/poker/history";
import { STREET_LABELS } from "@/lib/poker/strategy";

/** Linha do tempo da mão: Pré-flop → Flop [cartas] → Turn [carta], com as ações de cada street. */
export function HandHistory({ lines }: { lines: HistoryLine[] }) {
  if (!lines.length) return null;
  return (
    <ol
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-zinc-800 bg-black/30 px-3 py-1.5 text-xs text-zinc-300 sm:text-sm"
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
