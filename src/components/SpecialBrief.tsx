import type { Position, SpecialSpot } from "@/lib/poker/strategy";

const fmt = (n: number, digits = 2) => n.toLocaleString("pt-BR", { maximumFractionDigits: digits });

/** Cor da célula do Risk Premium: verde quando o fator < 1 (incentivo a pagar), vermelho quando > 1. */
function cellTone(factor: number): string {
  if (factor < 0.75) return "bg-emerald-500/45 text-emerald-50";
  if (factor < 0.95) return "bg-emerald-500/25 text-emerald-100";
  if (factor <= 1.05) return "bg-zinc-700/40 text-zinc-200";
  return "bg-red-500/25 text-red-100";
}

/**
 * Enunciado dos drills especiais (mãos rodadas no HRC): o torneio, o momento (restantes, ITM, blinds),
 * a tabela de Risk Premium com a linha do herói e a coluna do vilão em destaque e, depois de responder,
 * o que aconteceu na mão real. Stacks e bounties de cada lugar ficam na própria mesa.
 */
export function SpecialBrief({
  spot,
  hero,
  villain,
  answered,
}: {
  spot: SpecialSpot;
  hero: Position;
  villain?: Position | null;
  answered: boolean;
}) {
  const t = spot.tournament;
  const facts = [
    t.playersLeft && t.entrants ? `${fmt(t.playersLeft, 0)}/${fmt(t.entrants, 0)} restantes` : null,
    t.itm ? `${fmt(t.itm, 0)} ITM` : null,
    t.blinds ? `Blinds ${t.blinds}${t.ante ? ` (ante ${fmt(t.ante)}bb)` : ""}` : null,
    t.averageStack ? `Média ${fmt(t.averageStack, 1)}bb` : null,
  ].filter(Boolean);
  const rp = spot.riskPremium;
  return (
    <section
      className="grid gap-3 rounded-lg border border-baga-gold/30 bg-gradient-to-br from-zinc-900 to-black/60 p-3 lg:grid-cols-[minmax(0,1fr)_auto]"
      data-testid="enunciado-especial"
      aria-label="Enunciado do spot"
    >
      <div className="flex min-w-0 gap-3">
        {t.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logo} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
        )}
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold leading-tight text-zinc-50">{t.name}</h2>
          <p className="text-xs text-baga-gold">{[t.site, t.format, t.buyIn].filter(Boolean).join(" · ")}</p>
          {facts.length > 0 && <p className="text-xs text-zinc-300">{facts.join(" · ")}</p>}
          {spot.source && <p className="text-[11px] text-zinc-500">{spot.source}</p>}
          {answered && spot.note && (
            <p className="rounded-md bg-zinc-800/80 px-2 py-1 text-xs text-zinc-200" data-testid="nota-mao-real">
              {spot.note}
            </p>
          )}
        </div>
      </div>

      {rp && (
        <div className="overflow-x-auto">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Risk Premium (linha = quem decide)
          </p>
          <table className="border-separate border-spacing-0.5 text-center text-[11px] tabular-nums" data-testid="risk-premium">
            <thead>
              <tr>
                <th />
                {rp.positions.map((p) => (
                  <th key={p} className={`px-1 font-semibold ${p === villain ? "text-baga-gold" : "text-zinc-400"}`}>
                    {p}
                    <span className="block font-normal text-zinc-500">{spot.stacks[p] !== undefined ? fmt(spot.stacks[p]!, 1) : ""}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rp.positions.map((row, i) => (
                <tr key={row}>
                  <th className={`pr-1 text-left font-semibold ${row === hero ? "text-baga-cream" : "text-zinc-400"}`}>
                    {row === hero ? `${row} (você)` : row}
                  </th>
                  {rp.cells[i].map((cell, j) => {
                    const col = rp.positions[j];
                    const focus = row === hero && col === villain;
                    return (
                      <td
                        key={col}
                        className={`rounded px-1 py-0.5 ${cell ? cellTone(cell.factor) : "bg-zinc-800/60"} ${
                          focus ? "ring-2 ring-baga-gold" : row === hero ? "ring-1 ring-zinc-500" : ""
                        }`}
                      >
                        {cell && (
                          <>
                            <span className="block font-semibold">
                              {cell.factor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="block opacity-80">
                              {cell.premium > 0 ? "+" : ""}
                              {cell.premium.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                            </span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {spot.payouts && spot.payouts.length > 0 && (
        <div className="text-xs text-zinc-300 lg:col-span-2">
          <span className="font-semibold text-zinc-400">Payouts: </span>
          {spot.payouts.map((p) => `${p.place} ${p.prize}`).join(" · ")}
        </div>
      )}
    </section>
  );
}
