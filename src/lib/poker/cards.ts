/** Cartas e baralho. Uma carta é representada como "As", "Td", "7c"... */
export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
export const SUITS = ["s", "h", "d", "c"] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
export type Card = `${Rank}${Suit}`;

export const SUIT_SYMBOLS: Record<Suit, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };

/** Valor numérico da carta: A = 14, K = 13, ..., 2 = 2. */
export function rankValue(rank: Rank): number {
  return 14 - RANKS.indexOf(rank);
}

export function isRank(value: string): value is Rank {
  return (RANKS as readonly string[]).includes(value);
}

export function isSuit(value: string): value is Suit {
  return (SUITS as readonly string[]).includes(value);
}

export function isCard(value: string): value is Card {
  return value.length === 2 && isRank(value[0]) && isSuit(value[1]);
}

export function parseCard(value: string): Card {
  const normalized = value.trim();
  const card = `${normalized[0]?.toUpperCase() ?? ""}${normalized[1]?.toLowerCase() ?? ""}`;
  if (normalized.length !== 2 || !isCard(card)) throw new Error(`Carta inválida: ${value}`);
  return card;
}

export function cardRank(card: Card): Rank {
  return card[0] as Rank;
}

export function cardSuit(card: Card): Suit {
  return card[1] as Suit;
}

export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) for (const suit of SUITS) deck.push(`${rank}${suit}`);
  return deck;
}

/** Ordena cartas da maior para a menor. */
export function sortCardsDesc(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => rankValue(cardRank(b)) - rankValue(cardRank(a)));
}
