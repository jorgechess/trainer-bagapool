export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Mês atual no fuso de São Paulo, no formato "AAAA-MM". */
export function currentMonth(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const names = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `${names[(m ?? 1) - 1]} de ${year}`;
}

/** Primeiro instante do mês em São Paulo (UTC-3), em ISO. */
export function monthStartIso(month: string): string {
  return new Date(`${month}-01T03:00:00.000Z`).toISOString();
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
