import { SUIT_SYMBOLS, type Card, cardRank, cardSuit } from "@/lib/poker/cards";

/** Baralho de quatro cores: ♠ preto, ♥ vermelho, ♦ azul, ♣ verde. */
const SUIT_COLORS = { s: "#111827", h: "#dc2626", d: "#2563eb", c: "#16a34a" } as const;

/** `fluid`: o tamanho acompanha a fonte do elemento pai (usado na mesa, que cresce com a tela). */
export function PlayingCard({ card, size = "md" }: { card: Card; size?: "xs" | "sm" | "md" | "lg" | "fluid" }) {
  const suit = cardSuit(card);
  const rank = cardRank(card);
  const dims =
    size === "fluid"
      ? "h-[3.1em] w-[2.2em] text-[1em] rounded-[0.3em]"
      : size === "lg"
        ? "h-20 w-14 text-2xl"
        : size === "sm"
          ? "h-10 w-7 text-sm"
          : size === "xs"
            ? "h-8 w-6 rounded text-xs"
          : "h-14 w-10 text-lg";
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-md font-bold text-white shadow ring-1 ring-white/25 ${dims}`}
      style={{ backgroundColor: SUIT_COLORS[suit] }}
      aria-label={card}
    >
      <span className="leading-none">{rank === "T" ? "10" : rank}</span>
      <span className="leading-none">{SUIT_SYMBOLS[suit]}</span>
    </div>
  );
}

export function CardRow({ cards, size }: { cards: readonly Card[]; size?: "xs" | "sm" | "md" | "lg" | "fluid" }) {
  return (
    <div className={`flex ${size === "xs" ? "gap-0.5" : "gap-1.5"}`}>
      {cards.map((card) => (
        <PlayingCard key={card} card={card} size={size} />
      ))}
    </div>
  );
}
