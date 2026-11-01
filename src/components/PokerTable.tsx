import { PlayingCard } from "@/components/PlayingCard";
import type { Card } from "@/lib/poker/cards";
import { formatNumberRange, type Strategy } from "@/lib/poker/strategy";
import { type Seat, facesThreeBet, knownPot, tableSeats } from "@/lib/poker/table";

interface PokerTableProps {
  strategy: Strategy;
  heroCards: [Card, Card];
  board: Card[];
  /** Descrição da textura, mostrada embaixo do board. */
  texture?: string | null;
  /** Mesa em pé, para telas estreitas e verticais. */
  vertical?: boolean;
  /** Linhas de mesas na tela (2 = grade 2×2): divide a altura disponível. */
  rows?: number;
  /** Espaço vertical ocupado pelo resto da página, em px. */
  reservedHeight?: number;
  /** Largura mínima para continuar legível (telas baixas rolam em vez de encolher demais). */
  minWidth?: number;
}

const SEAT_COUNT = 9;
/** Distância das fichas e do botão do dealer até o centro (1 = no lugar do jogador). */
const CHIP_FACTOR = 0.76;
/** Na mesa em pé (celular) os lugares ficam mais juntos: fichas um pouco mais para dentro. */
const CHIP_FACTOR_TALL = 0.66;
const DEALER_FACTOR = 0.6;

interface Shape {
  /** Proporção largura/altura da área da mesa. */
  aspect: number;
  /** Raios da elipse dos lugares, em % da largura e da altura. */
  rx: number;
  ry: number;
  /** Margens do feltro (CSS inset). */
  felt: string;
}

const WIDE: Shape = { aspect: 1.6, rx: 44, ry: 40, felt: "10% 8%" };
const TALL: Shape = { aspect: 0.82, rx: 39, ry: 41, felt: "9% 13%" };

/** Posição do lugar na elipse; o herói fica embaixo, no centro, e a ação gira no sentido horário. */
function seatPlacement(shape: Shape, offset: number) {
  const angle = ((90 + (offset * 360) / SEAT_COUNT) * Math.PI) / 180;
  return { x: 50 + shape.rx * Math.cos(angle), y: 50 + shape.ry * Math.sin(angle) };
}

function at(x: number, y: number) {
  return { left: `${x}%`, top: `${y}%` };
}

function towardCenter(shape: Shape, offset: number, factor: number) {
  const { x, y } = seatPlacement(shape, offset);
  return at(50 + (x - 50) * factor, 50 + (y - 50) * factor);
}

function CardBack() {
  return (
    <div className="h-[1.9em] w-[1.35em] rounded-[0.2em] border border-white/30 bg-gradient-to-br from-red-700 to-red-900 shadow" />
  );
}

function SeatView({
  seat,
  stack,
  heroCards,
  shape,
  raiseLabel,
}: {
  seat: Seat;
  stack: string;
  heroCards: [Card, Card];
  shape: Shape;
  raiseLabel: string;
}) {
  const hero = seat.status === "hero";
  const folded = seat.status === "folded";
  const { x, y } = seatPlacement(shape, seat.offset);
  return (
    <div
      className={`absolute flex -translate-x-1/2 flex-col items-center gap-[0.3em] ${hero ? "-translate-y-[78%]" : "-translate-y-1/2"}`}
      style={at(x, y)}
    >
      {hero ? (
        <div className="flex gap-[0.25em] text-[1.9em]" data-testid="hero-cards" aria-label="Sua mão">
          <PlayingCard card={heroCards[0]} size="fluid" />
          <PlayingCard card={heroCards[1]} size="fluid" />
        </div>
      ) : (
        !folded && (
          <div className="flex gap-[0.15em]">
            <CardBack />
            <CardBack />
          </div>
        )
      )}
      <div
        className={`min-w-[5.5em] rounded-[0.5em] border px-[0.6em] py-[0.25em] text-center leading-tight shadow ${
          hero
            ? "border-baga-red bg-zinc-900"
            : folded
              ? "border-zinc-800 bg-zinc-900/60 opacity-50"
              : "border-zinc-600 bg-zinc-900"
        }`}
      >
        <p className={`font-semibold ${hero ? "text-baga-cream" : "text-zinc-200"}`}>
          {seat.position}
          {hero && " (você)"}
        </p>
        <p className="text-zinc-400">{folded ? "Fold" : seat.status === "raised" ? `${raiseLabel} · ${stack}` : stack}</p>
      </div>
    </div>
  );
}

export function PokerTable({
  strategy,
  heroCards,
  board,
  texture,
  vertical = false,
  rows = 1,
  reservedHeight = 330,
  minWidth = 0,
}: PokerTableProps) {
  const shape = vertical ? TALL : WIDE;
  const seats = tableSeats(strategy);
  const stack = formatNumberRange(strategy.stack, "bb");
  const pot = knownPot(strategy);
  const button = seats.find((s) => s.isButton);

  return (
    <div
      className="@container mx-auto w-full select-none"
      // Cresce com a largura, mas nunca passa da altura disponível na tela
      style={{
        maxWidth: `min(100%, max(${minWidth}px, calc((100dvh - ${reservedHeight}px) / ${rows} * ${shape.aspect})))`,
      }}
    >
      <div
        className="relative w-full"
        style={{ aspectRatio: `${shape.aspect}`, fontSize: vertical ? "clamp(9px, 3.1cqw, 15px)" : "clamp(9px, 1.55cqw, 17px)" }}
      >
        {/* Mesa */}
        <div
          className="absolute rounded-[50%] border-[0.45em] border-amber-950 bg-gradient-to-b from-emerald-800 to-emerald-950 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]"
          style={{ inset: shape.felt }}
        />

        {/* Centro: board, textura e pote */}
        <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[0.4em]">
          {board.length > 0 && (
            <div className="flex gap-[0.2em] text-[1.45em]" data-testid="board" aria-label="Board">
              {board.map((card) => (
                <PlayingCard key={card} card={card} size="fluid" />
              ))}
            </div>
          )}
          {texture && <span className="text-emerald-100/70">{texture}</span>}
          {pot !== null && (
            <span className="rounded-full bg-black/40 px-[0.8em] py-[0.15em] text-zinc-100">
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
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-[0.3em]"
              // Fichas sempre coladas em quem apostou; as do herói ficam ao lado das cartas (o dealer fica do outro lado)
              style={
                s.offset === 0
                  ? (({ x, y }) => (vertical ? at(x - 12, y - 24) : at(x - 13, y - 10)))(seatPlacement(shape, 0))
                  : towardCenter(shape, s.offset, vertical ? CHIP_FACTOR_TALL : CHIP_FACTOR)
              }
            >
              <span className="h-[1.1em] w-[1.1em] rounded-full border-2 border-dashed border-white bg-sky-600" />
              <span className="font-semibold text-white">{s.posted.toLocaleString("pt-BR")}</span>
            </div>
          ))}

        {/* Botão do dealer */}
        {button && (
          <div
            className="absolute flex h-[1.6em] w-[1.6em] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white font-bold text-black shadow"
            style={
              button.offset === 0
                ? (({ x, y }) => (vertical ? at(x + 12, y - 24) : at(x + 13, y - 10)))(seatPlacement(shape, 0))
                : towardCenter(shape, button.offset, DEALER_FACTOR)
            }
            title="Dealer"
          >
            D
          </div>
        )}

        {seats.map((seat) => (
          <SeatView
            key={seat.position}
            seat={seat}
            stack={
              strategy.stack.min === strategy.stack.max && seat.posted > 0
                ? `${(Math.round((strategy.stack.min - seat.posted) * 10) / 10).toLocaleString("pt-BR")}bb`
                : stack
            }
            heroCards={heroCards}
            shape={shape}
            raiseLabel={facesThreeBet(strategy) ? "3-bet" : "Raise"}
          />
        ))}
      </div>
    </div>
  );
}
