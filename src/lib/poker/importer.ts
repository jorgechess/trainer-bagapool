/**
 * Importação em lote (carga inicial): estratégias e drills descritos em JSON,
 * com ranges escritos em notação de texto ("22+, A2s+, KTo+").
 */
import { type Legend, validateLegend } from "./legend";
import { compactRange, rangeFromNotation, type Range } from "./range";
import {
  POSITIONS,
  STREETS,
  type BubbleContext,
  type NumberRange,
  type Position,
  type Street,
  type Strategy,
  type TextureRange,
  type MixedHands,
  mixedActions,
  dealSourceIds,
  validateStrategy,
} from "./strategy";
import type { TextureMatch } from "./texture";
import { type Drill, type HandSampling, validateDrill } from "./drill";

export interface ImportTextureRange {
  label: string;
  match: TextureMatch;
  range: Record<string, string>;
}

export interface ImportStrategy {
  id?: string;
  name: string;
  description?: string;
  street: Street;
  situation: string;
  heroPosition: Position;
  villainPosition?: Position | null;
  stack: NumberRange;
  ratio?: NumberRange | null;
  bubble?: BubbleContext | null;
  tags?: string[];
  actionIds: string[];
  defaultActionId: string;
  entryActionIds?: string[];
  /** Sorteia mãos só onde outra estratégia (id ou nome) tem uma destas ações. */
  /** `strategy` (id ou nome); `alsoStrategies` soma outras estratégias ao sorteio. */
  dealFrom?: { strategy: string; alsoStrategies?: string[]; actionIds: string[] } | null;
  tableSizes?: { open?: number; threeBet?: number } | null;
  randomStacks?: boolean;
  villainAllIn?: boolean;
  openerStack?: { min: number; max: number } | null;
  villainCoversHero?: boolean;
  callers?: string[] | null;
  villainLabel?: string | null;
  history?: string[] | null;
  special?: Strategy["special"];
  tablePosted?: { hero?: number; villain?: number } | null;
  cbet?: import("./cbet").CbetSpec | null;
  tablePot?: number | null;
  invested?: number | null;
  openType?: "linear" | "polar" | null;
  pko?: { coverage: "cobrindo" | "coberto"; bounty?: string; heroStack?: number; villainStack?: number } | null;
  range?: Record<string, string>;
  /** Mãos mistas: ações extras também aceitas, no formato do range (a mão pode aparecer em várias ações). */
  alsoCorrect?: Record<string, string>;
  textureRanges?: ImportTextureRange[];
}

export interface ImportDrill {
  id?: string;
  name: string;
  description?: string;
  /** Ids ou nomes das estratégias, em ordem. */
  steps?: string[];
  /** Variações: cada mão sorteia uma (lista de sequências de ids ou nomes). */
  variants?: string[][];
  sampling?: HandSampling;
  tags?: string[];
  handsPerSession?: number;
  passAccuracy?: number;
}

export interface ImportBundle {
  legend?: Legend;
  /** Drills antigos que esta carga substitui: saem da lista (o histórico continua). */
  replacesDrills?: string[];
  /** Ações que a carga usa: entram na legenda do time só se ainda não existirem (não mexe nas outras). */
  legendAdd?: Legend;
  strategies?: ImportStrategy[];
  drills?: ImportDrill[];
}

export interface ImportResult {
  legend: Legend | null;
  strategies: Strategy[];
  drills: Drill[];
  /** Drills que a carga substitui (arquivar ao importar). */
  replacedDrillIds: string[];
  errors: string[];
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Cor livre mais próxima: mexe 1 ponto no azul (depois verde) até não repetir. */
export function uniqueColor(color: string, used: ReadonlySet<string>): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color) || !used.has(color.toLowerCase())) return color;
  const n = parseInt(color.slice(1), 16);
  for (let step = 1; step < 512; step++) {
    for (const delta of [step, -step]) {
      const b = (n & 0xff) + delta;
      const g = ((n >> 8) & 0xff) + (b > 255 ? 1 : b < 0 ? -1 : 0);
      const candidate = `#${(((n >> 16) & 0xff) << 16 | (Math.min(255, Math.max(0, g)) << 8) | ((b + 256) % 256)).toString(16).padStart(6, "0")}`;
      if (!used.has(candidate)) return candidate;
    }
  }
  return color;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRange(notation: unknown, where: string, errors: string[]): Range {
  if (notation === undefined) return {};
  if (!isObject(notation)) {
    errors.push(`${where}: o range deve ser um objeto { "acao": "notação" }.`);
    return {};
  }
  try {
    return rangeFromNotation(notation as Record<string, string>);
  } catch (error) {
    errors.push(`${where}: ${(error as Error).message}`);
    return {};
  }
}

function toMixed(byAction: unknown, where: string, errors: string[]): MixedHands {
  const mixed: MixedHands = {};
  if (!isObject(byAction)) {
    errors.push(`${where}: use { "acao": "notação" }.`);
    return mixed;
  }
  for (const [action, notation] of Object.entries(byAction)) {
    for (const hand of Object.keys(toRange({ [action]: notation }, where, errors))) {
      const current = mixedActions(mixed, hand);
      mixed[hand] = current.length ? [...current, action] : action;
    }
  }
  return mixed;
}

/**
 * Converte o JSON da carga inicial em estratégias e drills validados.
 * `currentLegend` é a legenda atual do time, usada se o arquivo não trouxer uma;
 * `existingStrategies` são as já cadastradas, que os drills do arquivo podem usar.
 */
export function parseImportBundle(
  input: unknown,
  currentLegend: Legend,
  existingStrategies: readonly Strategy[] = [],
): ImportResult {
  const errors: string[] = [];
  if (!isObject(input)) return { legend: null, strategies: [], drills: [], replacedDrillIds: [], errors: ["O arquivo precisa ser um objeto JSON."] };
  const bundle = input as ImportBundle;

  let legend: Legend | null = null;
  if (bundle.legend !== undefined) {
    if (!Array.isArray(bundle.legend)) errors.push("legend deve ser uma lista.");
    else {
      const legendErrors = validateLegend(bundle.legend);
      errors.push(...legendErrors.map((e) => `Legenda: ${e}`));
      if (legendErrors.length === 0) legend = bundle.legend;
    }
  }
  if (bundle.legendAdd !== undefined) {
    if (!Array.isArray(bundle.legendAdd)) errors.push("legendAdd deve ser uma lista.");
    else {
      const base = legend ?? currentLegend;
      // A legenda do banco pode ter sido editada pela tela: cor nova que bate com uma já usada é
      // ajustada de leve, para a carga não ser recusada inteira por causa de uma cor
      const used = new Set(base.map((b) => b.color.toLowerCase()));
      const missing = bundle.legendAdd
        .filter((a) => isObject(a) && !base.some((b) => b.id === a.id))
        .map((a) => {
          const color = typeof a.color === "string" ? uniqueColor(a.color, used) : a.color;
          if (typeof color === "string") used.add(color.toLowerCase());
          return { ...a, color };
        });
      if (missing.length) {
        const merged = [...base, ...missing];
        const legendErrors = validateLegend(merged);
        errors.push(...legendErrors.map((e) => `Legenda: ${e}`));
        if (legendErrors.length === 0) legend = merged;
      }
    }
  }
  const effectiveLegend = legend ?? currentLegend;

  const strategies: Strategy[] = [];
  const usedIds = new Set<string>();
  for (const [index, raw] of (bundle.strategies ?? []).entries()) {
    const where = `Estratégia ${index + 1}${raw && isObject(raw) && raw.name ? ` ("${raw.name}")` : ""}`;
    if (!isObject(raw)) {
      errors.push(`${where}: formato inválido.`);
      continue;
    }
    const id = raw.id ? String(raw.id) : slugify(String(raw.name ?? `estrategia-${index + 1}`));
    if (usedIds.has(id)) {
      errors.push(`${where}: id repetido "${id}".`);
      continue;
    }
    usedIds.add(id);
    if (!(STREETS as readonly string[]).includes(raw.street)) errors.push(`${where}: street inválida "${raw.street}".`);
    if (!(POSITIONS as readonly string[]).includes(raw.heroPosition))
      errors.push(`${where}: posição inválida "${raw.heroPosition}".`);

    const textureRanges: TextureRange[] = (raw.textureRanges ?? []).map((tr, i) => ({
      id: `${id}-t${i + 1}`,
      label: tr.label ?? `Textura ${i + 1}`,
      match: tr.match ?? {},
      range: compactRange(toRange(tr.range, `${where}, textura "${tr.label}"`, errors), raw.defaultActionId),
    }));

    const strategy: Strategy = {
      id,
      name: String(raw.name ?? ""),
      description: raw.description,
      street: raw.street,
      situation: String(raw.situation ?? ""),
      heroPosition: raw.heroPosition,
      villainPosition: raw.villainPosition ?? null,
      stack: raw.stack ?? { min: 0, max: 0 },
      ratio: raw.ratio ?? null,
      bubble: raw.bubble ?? null,
      tags: raw.tags ?? [],
      actionIds: raw.actionIds ?? [],
      defaultActionId: raw.defaultActionId,
      entryActionIds: raw.entryActionIds ?? [],
      tableSizes: raw.tableSizes ?? null,
      ...(raw.randomStacks ? { randomStacks: true } : {}),
      ...(raw.villainAllIn ? { villainAllIn: true } : {}),
      ...(raw.openerStack ? { openerStack: raw.openerStack } : {}),
      ...(raw.villainCoversHero ? { villainCoversHero: true } : {}),
      ...(raw.villainLabel ? { villainLabel: String(raw.villainLabel) } : {}),
      ...(raw.special && typeof raw.special === "object" ? { special: raw.special } : {}),
      ...(Array.isArray(raw.history) && raw.history.length ? { history: raw.history.slice(0, 4).map(String) } : {}),
      ...(raw.tablePosted ? { tablePosted: raw.tablePosted } : {}),
      ...(raw.cbet ? { cbet: raw.cbet } : {}),
      ...(raw.tablePot ? { tablePot: raw.tablePot } : {}),
      ...(typeof raw.invested === "number" ? { invested: raw.invested } : {}),
      ...(raw.callers?.length ? { callers: raw.callers as Strategy["heroPosition"][] } : {}),
      ...(raw.openType ? { openType: raw.openType } : {}),
      pko: raw.pko ?? null,
      dealFrom: raw.dealFrom
        ? {
            strategyId: String(raw.dealFrom.strategy ?? ""),
            ...(raw.dealFrom.alsoStrategies?.length ? { alsoStrategyIds: raw.dealFrom.alsoStrategies.map(String) } : {}),
            actionIds: raw.dealFrom.actionIds ?? [],
          }
        : null,
      range: compactRange(toRange(raw.range, where, errors), raw.defaultActionId),
      ...(raw.alsoCorrect ? { alsoCorrect: toMixed(raw.alsoCorrect, `${where}, mãos mistas`, errors) } : {}),
      textureRanges,
    };
    errors.push(...validateStrategy(strategy, effectiveLegend).map((e) => `${where}: ${e}`));
    strategies.push(strategy);
  }

  // Drills podem usar estratégias do arquivo ou já cadastradas (as do arquivo têm preferência).
  const all = [...existingStrategies, ...strategies];
  const byId = new Map(all.map((s) => [s.id, s]));
  const byName = new Map(all.map((s) => [s.name.toLowerCase(), s]));

  // Resolve "sortear só do range de" (pode apontar para estratégias do arquivo ou já cadastradas)
  for (const strategy of strategies) {
    if (!strategy.dealFrom) continue;
    const resolved = dealSourceIds(strategy.dealFrom).map((ref) => {
      const source = byId.get(ref) ?? byName.get(ref.toLowerCase());
      if (!source) errors.push(`Estratégia "${strategy.name}": sorteia mãos de "${ref}", que não foi encontrada.`);
      else if (source.street !== "preflop") errors.push(`Estratégia "${strategy.name}": "${source.name}" não é de pré-flop.`);
      return source?.id ?? ref;
    });
    const [first, ...rest] = resolved;
    strategy.dealFrom = { ...strategy.dealFrom, strategyId: first, ...(rest.length ? { alsoStrategyIds: rest } : {}) };
  }
  const drills: Drill[] = [];
  const drillIds = new Set<string>();
  for (const [index, raw] of (bundle.drills ?? []).entries()) {
    const where = `Drill ${index + 1}${raw && isObject(raw) && raw.name ? ` ("${raw.name}")` : ""}`;
    const rawVariants: unknown[] | null = Array.isArray(raw?.variants) && raw.variants.length
      ? raw.variants
      : Array.isArray(raw?.steps)
        ? [raw.steps]
        : null;
    if (!isObject(raw) || !rawVariants || !rawVariants.every(Array.isArray)) {
      errors.push(`${where}: formato inválido (precisa de "steps" ou "variants").`);
      continue;
    }
    const id = raw.id ? String(raw.id) : slugify(String(raw.name ?? `drill-${index + 1}`));
    if (drillIds.has(id)) {
      errors.push(`${where}: id repetido "${id}".`);
      continue;
    }
    drillIds.add(id);
    const resolve = (ref: unknown) => {
      const strategy = byId.get(String(ref)) ?? byName.get(String(ref).toLowerCase());
      if (!strategy) errors.push(`${where}: estratégia "${ref}" não encontrada.`);
      return strategy?.id ?? String(ref);
    };
    const variants = (rawVariants as unknown[][]).map((line) => line.map(resolve));
    const steps = variants[0];
    const drill: Drill = {
      id,
      name: String(raw.name ?? ""),
      description: raw.description,
      steps,
      ...(variants.length > 1 ? { variants } : {}),
      sampling: raw.sampling ?? "uniforme",
      tags: raw.tags ?? [],
      handsPerSession: raw.handsPerSession ?? 50,
      passAccuracy: raw.passAccuracy ?? 0.9,
    };
    errors.push(
      ...validateDrill(drill, byId)
        .filter((e) => !e.includes("Estratégia não encontrada"))
        .map((e) => `${where}: ${e}`),
    );
    drills.push(drill);
  }

  const replacedDrillIds = Array.isArray(bundle.replacesDrills)
    ? bundle.replacesDrills.map(String).filter((id) => !drills.some((d) => d.id === id))
    : [];
  return { legend, strategies, drills, replacedDrillIds, errors };
}
