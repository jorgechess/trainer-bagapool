/**
 * Pay jumps da mesa final: a escada de prêmios a partir dos payouts do enunciado ("2º", "$543").
 * Com N jogadores restantes, o N-ésimo prêmio já está garantido e o próximo pay jump é a diferença
 * até o prêmio de cima. Lugares abaixo de N já foram pagos (quem caiu antes).
 */

export interface PayoutEntry {
  place: string;
  prize: string;
}

export interface PayStep {
  place: number;
  /** Prêmio em número (null quando não informado). */
  prize: number | null;
  /** Texto original do prêmio, para mostrar com a moeda. */
  label: string;
  /** Quanto se ganha subindo para este lugar a partir do lugar de baixo (null se faltar algum dos dois). */
  jump: number | null;
  status: "garantido" | "em-jogo" | "pago";
}

export interface PayLadder {
  /** Prefixo da moeda tirado dos prêmios ("$", "R$", "€"…). */
  currency: string;
  steps: PayStep[];
  /** Prêmio já garantido (o do lugar = jogadores restantes). */
  guaranteed: PayStep | null;
  /** O próximo degrau acima do garantido. */
  next: PayStep | null;
}

export function parsePlace(place: string): number | null {
  const n = Number.parseInt(place.replace(/\D+/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "$1,234.50", "$1.234,50", "R$ 543" → número. Sem dígitos → null. */
export function parsePrize(prize: string): number | null {
  const digits = prize.replace(/[^\d.,]/g, "");
  if (!/\d/.test(digits)) return null;
  const lastSep = Math.max(digits.lastIndexOf("."), digits.lastIndexOf(","));
  // Separador decimal só quando sobram 1 ou 2 casas depois dele
  const decimals = lastSep >= 0 ? digits.length - lastSep - 1 : 0;
  if (lastSep >= 0 && decimals > 0 && decimals <= 2) {
    const int = digits.slice(0, lastSep).replace(/[.,]/g, "");
    return Number(`${int}.${digits.slice(lastSep + 1)}`);
  }
  return Number(digits.replace(/[.,]/g, ""));
}

function currencyOf(payouts: PayoutEntry[]): string {
  for (const p of payouts) {
    const prefix = p.prize.trim().match(/^[^\d\s.,]+/);
    if (prefix) return prefix[0];
  }
  return "";
}

export function formatMoney(value: number, currency: string): string {
  const text = value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${currency}${text}`;
}

/**
 * Monta a escada do 1º lugar até o último pago informado. Lugares que faltam entre eles (ex.: o 1º)
 * entram com prêmio desconhecido, para a escada não pular degrau.
 */
export function payLadder(payouts: PayoutEntry[] | null | undefined, playersLeft: number | null | undefined): PayLadder | null {
  if (!payouts || payouts.length === 0) return null;
  const byPlace = new Map<number, PayoutEntry>();
  for (const p of payouts) {
    const n = parsePlace(p.place);
    if (n !== null) byPlace.set(n, p);
  }
  if (byPlace.size === 0) return null;
  const last = Math.max(...byPlace.keys());
  const left = playersLeft && playersLeft > 0 ? playersLeft : null;
  const steps: PayStep[] = [];
  for (let place = 1; place <= last; place++) {
    const entry = byPlace.get(place);
    const prize = entry ? parsePrize(entry.prize) : null;
    steps.push({
      place,
      prize,
      label: entry?.prize ?? "?",
      jump: null,
      status: left === null || place < left ? "em-jogo" : place === left ? "garantido" : "pago",
    });
  }
  for (let i = 0; i < steps.length - 1; i++) {
    const here = steps[i].prize;
    const below = steps[i + 1].prize;
    steps[i].jump = here !== null && below !== null ? Math.round((here - below) * 100) / 100 : null;
  }
  const guaranteed = left !== null ? (steps.find((s) => s.place === left) ?? null) : null;
  const next = left !== null && left > 1 ? (steps.find((s) => s.place === left - 1) ?? null) : null;
  return { currency: currencyOf(payouts), steps, guaranteed, next };
}
