"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { PlayingCard } from "@/components/PlayingCard";
import type { Card } from "@/lib/poker/cards";
import { formatNumberRange, type Strategy } from "@/lib/poker/strategy";
import { ITM_PLACES, type Seat, playersLeft, seedFrom, tableState } from "@/lib/poker/table";

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
  /** Celular deitado: mesa mais baixa, então letras e cartas proporcionalmente maiores. */
  compact?: boolean;
  /** Espaço vertical ocupado pelo resto da página, em px. */
  reservedHeight?: number;
  /** Largura mínima para continuar legível (telas baixas rolam em vez de encolher demais). */
  minWidth?: number;
}

/** Valor padrão da etiqueta de bounty nas mesas PKO. */
const DEFAULT_BOUNTY = "$10.00";
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
  /** Lugares na mesa (9 ou 6). */
  count: number;
}

const WIDE: Shape = { aspect: 1.6, rx: 44, ry: 40, felt: "10% 8%", count: 9 };
const TALL: Shape = { aspect: 0.82, rx: 39, ry: 41, felt: "9% 13%", count: 9 };

/** Posição do lugar na elipse; o herói fica embaixo, no centro, e a ação gira no sentido horário. */
function seatPlacement(shape: Shape, offset: number) {
  const angle = ((90 + (offset * 360) / shape.count) * Math.PI) / 180;
  return { x: 50 + shape.rx * Math.cos(angle), y: 50 + shape.ry * Math.sin(angle) };
}

function at(x: number, y: number) {
  return { left: `${x}%`, top: `${y}%` };
}

function towardCenter(shape: Shape, offset: number, factor: number) {
  const { x, y } = seatPlacement(shape, offset);
  return at(50 + (x - 50) * factor, 50 + (y - 50) * factor);
}

/**
 * Fichas de um jogador: na direção do centro. Nos lugares de cima as cartas e a caixa do jogador
 * descem até perto do feltro, então as fichas entram um pouco mais para não ficarem escondidas.
 */
function chipSpot(shape: Shape, offset: number, factor: number) {
  const { y } = seatPlacement(shape, offset);
  const upper = Math.max(0, (50 - y) / shape.ry);
  return towardCenter(shape, offset, factor - 0.16 * upper);
}

function CardBack() {
  return (
    <div className="h-[1.9em] w-[1.35em] rounded-[0.2em] border border-white/30 bg-gradient-to-br from-red-700 to-red-900 shadow" />
  );
}

/** Etiqueta dourada de bounty, no estilo das mesas PKO da GGPoker. */
function BountyTag({ text, dim }: { text: string; dim?: boolean }) {
  return (
    <span
      className={`rounded-[0.35em] border border-amber-200/70 bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600 px-[0.6em] py-[0.1em] font-bold whitespace-nowrap text-stone-900 shadow ${
        dim ? "opacity-50" : ""
      }`}
      data-testid="bounty-tag"
    >
      {text}
    </span>
  );
}

/** Fichas apostadas por um jogador. */
function Chips({ amount }: { amount: number }) {
  return (
    <>
      <span className="h-[1.1em] w-[1.1em] rounded-full border-2 border-dashed border-white bg-sky-600" />
      <span className="font-semibold text-white">{amount.toLocaleString("pt-BR")}</span>
    </>
  );
}

function SeatView({
  seat,
  stack,
  heroCards,
  shape,
  raiseLabel,
  bounty,
}: {
  seat: Seat;
  stack: string;
  heroCards: [Card, Card];
  shape: Shape;
  raiseLabel: string;
  bounty?: string;
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
        <div className="relative">
          {/* Fichas do herói logo à frente das cartas, voltadas para o centro da mesa */}
          {seat.posted > 0 && (
            <div
              className="absolute bottom-full left-1/2 mb-[0.4em] flex -translate-x-1/2 items-center gap-[0.3em] whitespace-nowrap"
              data-testid="hero-chips"
            >
              <Chips amount={seat.posted} />
            </div>
          )}
          <div className="flex gap-[0.25em] text-[1.9em]" data-testid="hero-cards" aria-label="Sua mão">
            <PlayingCard card={heroCards[0]} size="fluid" />
            <PlayingCard card={heroCards[1]} size="fluid" />
          </div>
        </div>
      ) : (
        !folded && (
          <div className="flex gap-[0.15em]">
            <CardBack />
            <CardBack />
          </div>
        )
      )}
      {bounty && !hero && <BountyTag text={bounty} dim={folded} />}
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
        <p className="whitespace-nowrap text-zinc-400">{folded ? "Fold" : seat.status === "raised" ? (raiseLabel === "All-in" ? "All-in" : `${raiseLabel} · ${stack}`) : seat.status === "called" ? `Call · ${stack}` : stack}</p>
      </div>
      {bounty && hero && <BountyTag text={bounty} />}
    </div>
  );
}

/** Duração das fichas indo para o pote ao virar a street (ms); a carta nova entra logo depois. */
const FLIGHT_MS = 550;

interface Flight {
  chips: { key: string; amount: number; from: { left: string; top: string } }[];
  /** Cartas do board a partir deste índice são novas (entram com animação). */
  newFrom: number;
  /** Pote mostrado enquanto as fichas voam. */
  fromPot: number | null;
  go: boolean;
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
  compact = false,
}: PokerTableProps) {
  const seed = seedFrom(heroCards.join(""));
  const { seats, remaining, pot, raiseLabel } = tableState(strategy, seed);
  const shape = { ...(vertical ? TALL : WIDE), count: seats.length };
  const stack = formatNumberRange(strategy.stack, "bb");
  const button = seats.find((s) => s.isButton);
  const left = playersLeft(strategy, seed);
  const bubble = left !== null && strategy.bubble != null;

  // Virou a street na mesma mão (flop → turn → river): as apostas da street anterior vão para o pote,
  // como no GTO Wizard, e a carta nova entra depois
  const handKey = heroCards.join("");
  const previous = useRef<{ hand: string; board: number; pot: number | null } | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const villainOffset = seats.find((s) => s.position === strategy.villainPosition)?.offset;
  const factor = vertical ? CHIP_FACTOR_TALL : CHIP_FACTOR;
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { hand: handKey, board: board.length, pot };
    if (!before || before.hand !== handKey || board.length <= before.board) {
      setFlight(null);
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const delta = pot !== null && before.pot !== null ? pot - before.pot : 0;
    const each = Math.round((delta / 2) * 100) / 100;
    const chips =
      each > 0
        ? [
            { key: "hero", amount: each, from: chipSpot(shape, 0, factor) },
            ...(villainOffset !== undefined
              ? [{ key: "villain", amount: each, from: chipSpot(shape, villainOffset, factor) }]
              : []),
          ]
        : [];
    setFlight({ chips, newFrom: before.board, fromPot: before.pot, go: false });
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setFlight((f) => (f ? { ...f, go: true } : f)));
    });
    const end = setTimeout(() => setFlight(null), FLIGHT_MS + 450);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handKey, board.length, pot]);
  const shownPot = flight && flight.chips.length ? flight.fromPot : pot;

  return (
    <div
      className="@container mx-auto w-full select-none"
      data-testid="mesa"
      // Cresce com a largura, mas nunca passa da altura disponível na tela
      style={{
        maxWidth: `min(100%, max(${minWidth}px, calc((100dvh - ${reservedHeight}px) / ${rows} * ${shape.aspect})))`,
      }}
    >
      <div
        className="relative w-full"
        style={{ aspectRatio: `${shape.aspect}`, fontSize: vertical ? "clamp(9px, 3.1cqw, 15px)" : compact ? "clamp(9px, 2.1cqw, 15px)" : "clamp(9px, 1.55cqw, 30px)" }}
      >
        {/* Mesa */}
        {strategy.special ? (
          <FinalTableFelt inset={shape.felt} site={strategy.special.tournament.site} />
        ) : (
          <div
            className="absolute rounded-[50%] border-[0.45em] border-amber-950 bg-gradient-to-b from-emerald-800 to-emerald-950 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]"
            style={{ inset: shape.felt }}
            data-testid="feltro"
            data-feltro="verde"
          />
        )}

        {/* Jogadores restantes (spots de proporção e bolha) */}
        {left !== null && (
          <div
            className={`absolute top-0 right-0 rounded-[0.5em] border px-[0.7em] py-[0.3em] text-right leading-tight ${
              bubble ? "border-amber-400/60 bg-amber-500/15" : "border-zinc-700 bg-black/50"
            }`}
            data-testid="players-left"
          >
            <p className="font-display text-[1.6em] tracking-wide text-baga-cream">{left} left</p>
            <p className={`text-[0.85em] ${bubble ? "text-amber-300" : "text-zinc-400"}`}>
              {bubble
                ? `${strategy.bubble === "itm-garantido" ? "Bolha garantido" : "Bolha não garantido"} · ITM ${ITM_PLACES}`
                : `ITM ${ITM_PLACES}`}
            </p>
          </div>
        )}

        {/* Centro: board, textura e pote */}
        <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[0.4em]">
          {board.length > 0 && (
            <div className="flex gap-[0.2em] text-[1.45em]" data-testid="board" aria-label="Board">
              {board.map((card, i) => (
                <div
                  key={card}
                  className={flight && i >= flight.newFrom ? "deal-in" : undefined}
                  style={flight && i >= flight.newFrom ? { animationDelay: `${flight.chips.length ? FLIGHT_MS - 100 : 0}ms` } : undefined}
                >
                  <PlayingCard card={card} size="fluid" />
                </div>
              ))}
            </div>
          )}
          {texture && <span className={strategy.special ? "text-violet-100/70" : "text-emerald-100/70"}>{texture}</span>}
          {shownPot !== null && (
            <span className="rounded-full bg-black/40 px-[0.8em] py-[0.15em] text-zinc-100" data-testid="pote">
              Pote: {shownPot.toLocaleString("pt-BR")}bb
            </span>
          )}

        </div>

        {/* Blinds colocados */}
        {seats
          .filter((s) => s.posted > 0 && s.offset !== 0)
          .map((s) => (
            <div
              key={`chip-${s.position}`}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-[0.3em]"
              // Fichas sempre coladas em quem apostou; as do herói ficam à frente das cartas (dentro do lugar dele)
              style={chipSpot(shape, s.offset, vertical ? CHIP_FACTOR_TALL : CHIP_FACTOR)}
            >
              <Chips amount={s.posted} />
            </div>
          ))}

        {/* Fichas da street anterior indo para o pote */}
        {flight?.chips.map((chip) => (
          <div
            key={chip.key}
            className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-[0.3em]"
            data-testid="fichas-indo-pote"
            style={{
              ...(flight.go ? { left: "50%", top: "50%", opacity: 0 } : { ...chip.from, opacity: 1 }),
              transition: `left ${FLIGHT_MS}ms ease-in, top ${FLIGHT_MS}ms ease-in, opacity 150ms ease-in ${FLIGHT_MS - 120}ms`,
            }}
          >
            <Chips amount={chip.amount} />
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
            stack={remaining ? `${remaining[seat.position]!.toLocaleString("pt-BR")}bb` : stack}
            heroCards={heroCards}
            shape={shape}
            raiseLabel={raiseLabel}
            bounty={
              strategy.special?.bounties?.[seat.position] ??
              (strategy.pko ? strategy.pko.bounty || DEFAULT_BOUNTY : undefined)
            }
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Logos dos sites (arquivos em /public/sites, enviados pelo time). Sem arquivo, o nome do site
 * aparece escrito na fonte do Trainer.
 */
const SITE_LOGOS: Record<string, string> = {
  ggpoker: "/sites/ggpoker.png",
  gg: "/sites/ggpoker.png",
  partypoker: "/sites/partypoker.png",
  coinpoker: "/sites/coinpoker.png",
  championpoker: "/sites/championpoker.png",
  champion: "/sites/championpoker.png",
  pokerstars: "/sites/pokerstars.png",
  stars: "/sites/pokerstars.png",
  wpn: "/sites/wpn.png",
  acr: "/sites/wpn.png",
  americascardroom: "/sites/wpn.png",
  wptglobal: "/sites/wpt-global.png",
  "888poker": "/sites/888poker.png",
  "888": "/sites/888poker.png",
};

function siteKey(site: string): string {
  return site.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Mesa dos drills especiais (mesa final): borda escura com brilho, feltro roxo com luz neon em volta,
 * a linha das apostas e o site do spot no meio, meio transparente.
 */
function FinalTableFelt({ inset, site }: { inset: string; site?: string | null }) {
  const logo = site ? SITE_LOGOS[siteKey(site)] : undefined;
  return (
    <div
      className="absolute rounded-[50%]"
      style={{
        inset,
        background: "linear-gradient(180deg, #3b3542 0%, #1b1820 45%, #0b0a0e 100%)",
        boxShadow: "0 1.2em 2.4em rgba(0,0,0,0.75), inset 0 0.08em 0 rgba(255,255,255,0.18), inset 0 -0.3em 0.8em rgba(0,0,0,0.6)",
      }}
    >
      <div
        className="absolute inset-[0.85em] overflow-hidden rounded-[50%]"
        style={{
          background: "radial-gradient(ellipse at 50% 42%, #a03ccc 0%, #7424a0 38%, #4a1468 72%, #2c0b3e 100%)",
          border: "0.16em solid #ecc4ff",
          boxShadow:
            "0 0 0.5em #c77dff, 0 0 1.5em rgba(192,110,255,0.65), inset 0 0 1em rgba(199,125,255,0.6), inset 0 0 4em rgba(0,0,0,0.45)",
        }}
        data-testid="feltro"
        data-feltro="roxo"
      >
        {/* Linha das apostas */}
        <div className="absolute inset-[11%_8%] rounded-[50%] border border-white/12" />
        {/* Site do spot */}
        {site && (
          <div className="pointer-events-none absolute top-[34%] left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap" data-testid="marca-site" aria-hidden>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-auto max-h-[4.2em] w-auto max-w-[13em] object-contain opacity-20" data-logo-site={siteKey(site)} />
            ) : (
              <span className="font-display text-[3.4em] tracking-[0.14em] text-white/18 uppercase">{site}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
