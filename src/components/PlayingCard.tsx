import { SUIT_SYMBOLS, type Card, cardRank, cardSuit } from "@/lib/poker/cards";

/** Baralho de quatro cores: ♠ preto, ♥ vermelho, ♦ azul, ♣ verde. */
const SUIT_COLORS = { s: "#111827", h: "#dc2626", d: "#2563eb", c: "#16a34a" } as const;

export function PlayingCard({ card, size = "md" }: { card: Card; size?: "sm" | "md" | "lg" }) {
  const suit = cardSuit(card);
  const rank = cardRank(card);
  const dims = size === "lg" ? "h-20 w-14 text-2xl" : size === "sm" ? "h-10 w-7 text-sm" : "h-14 w-10 text-lg";
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-md font-bold text-white shadow ${dims}`}
      style={{ backgroundColor: SUIT_COLORS[suit] }}
      aria-label={card}
    >
      <span className="leading-none">{rank === "T" ? "10" : rank}</span>
      <span className="leading-none">{SUIT_SYMBOLS[suit]}</span>
    </div>
  );
}

export function CardRow({ cards, size }: { cards: readonly Card[]; size?: "sm" | "md" | "lg" }) {
  return (
    <div className="flex gap-1.5">
      {cards.map((card) => (
        <PlayingCard key={card} card={card} size={size} />
      ))}
    </div>
  );
}
