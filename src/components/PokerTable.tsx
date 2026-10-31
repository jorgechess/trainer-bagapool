import { PlayingCard } from "@/components/PlayingCard";
import type { Card } from "@/lib/poker/cards";
import { formatNumberRange, type Strategy } from "@/lib/poker/strategy";
import { type Seat, knownPot, tableSeats } from "@/lib/poker/table";

interface PokerTableProps {
  strategy: Strategy;
  heroCards: [Card, Card];
  board: Card[];
}

const SEAT_COUNT = 9;

/** Posição do lugar na elipse; o herói fica embaixo, no centro, e a ação gira no sentido horário. */
function seatPlacement(offset: number) {
  const angle = ((90 + (offset * 360) / SEAT_COUNT) * Math.PI) / 180;
  return { x: 50 + 44 * Math.cos(angle), y: 50 + 40 * Math.sin(angle) };
}

function at(x: number, y: number) {
  return { left: `${x}%`, top: `${y}%` };
}

/** Fichas e botão do dealer ficam entre o lugar e o centro da mesa. */
function towardCenter(offset: number, factor: number) {
  const { x, y } = seatPlacement(offset);
  return at(50 + (x - 50) * factor, 50 + (y - 50) * factor);
}

function CardBack() {
  return (
    <div className="h-7 w-5 rounded-sm border border-white/30 bg-gradient-to-br from-red-700 to-red-900 shadow sm:h-9 sm:w-6" />
  );
}

function SeatView({ seat, stack, heroCards }: { seat: Seat; stack: string; heroCards: [Card, Card] }) {
  const hero = seat.status === "hero";
  const folded = seat.status === "folded";
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={(({ x, y }) => at(x, y))(seatPlacement(seat.offset))}
    >
      {hero ? (
        <div className="flex gap-1" data-testid="hero-cards" aria-label="Sua mão">
          <PlayingCard card={heroCards[0]} size="md" />
          <PlayingCard card={heroCards[1]} size="md" />
        </div>
      ) : (
        !folded && (
          <div className="flex gap-0.5">
            <CardBack />
            <CardBack />
          </div>
        )
      )}
      <div
        className={`min-w-14 rounded-lg border px-2 py-1 text-center leading-tight shadow sm:min-w-20 ${
          hero
            ? "border-orange-400 bg-zinc-900"
            : folded
              ? "border-zinc-800 bg-zinc-900/60 opacity-50"
              : "border-zinc-600 bg-zinc-900"
        }`}
      >
        <p className={`text-[10px] font-semibold sm:text-xs ${hero ? "text-orange-300" : "text-zinc-200"}`}>
          {seat.position}
          {hero && " (você)"}
        </p>
        <p className="text-[10px] text-zinc-400 sm:text-xs">
          {folded ? "Fold" : seat.status === "raised" ? "Raise" : stack}
        </p>
      </div>
    </div>
  );
}

export function PokerTable({ strategy, heroCards, board }: PokerTableProps) {
  const seats = tableSeats(strategy);
  const stack = formatNumberRange(strategy.stack, "bb");
  const pot = knownPot(strategy);
  const button = seats.find((s) => s.isButton);

  return (
    <div className="relative mx-auto aspect-[16/11] w-full max-w-2xl select-none sm:aspect-[16/10]">
      {/* Mesa */}
      <div className="absolute inset-[10%_8%] rounded-[50%] border-[6px] border-amber-950 bg-gradient-to-b from-emerald-800 to-emerald-950 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)] sm:border-8" />

      {/* Centro: board e pote */}
      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
        {board.length > 0 && (
          <div className="flex gap-1" data-testid="board" aria-label="Board">
            {board.map((card) => (
              <PlayingCard key={card} card={card} size="sm" />
            ))}
          </div>
        )}
        {pot !== null && (
          <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] text-zinc-100 sm:text-xs">
            Pote: {pot.toLocaleString("pt-BR")}bb
          </span>
        )}
      </div>

      {/* Blinds colocados */}
      {seats
        .filter((s) => s.posted > 0)
        .map((s) => (
          <div
            key={`chip-${s.position}`}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1"
            style={towardCenter(s.offset, 0.55)}
          >
            <span className="h-3 w-3 rounded-full border-2 border-dashed border-white bg-sky-600 sm:h-4 sm:w-4" />
            <span className="text-[10px] font-semibold text-white sm:text-xs">{s.posted.toLocaleString("pt-BR")}</span>
          </div>
        ))}

      {/* Botão do dealer */}
      {button && (
        <div
          className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black shadow sm:h-6 sm:w-6 sm:text-xs"
          style={towardCenter(button.offset, button.offset === 0 ? 0.62 : 0.7)}
          title="Dealer"
        >
          D
        </div>
      )}

      {seats.map((seat) => (
        <SeatView key={seat.position} seat={seat} stack={stack} heroCards={heroCards} />
      ))}
    </div>
  );
}
