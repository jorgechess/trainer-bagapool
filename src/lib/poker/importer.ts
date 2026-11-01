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
  dealFrom?: { strategy: string; actionIds: string[] } | null;
  tableSizes?: { open?: number; threeBet?: number } | null;
  pko?: { coverage: "cobrindo" | "coberto"; bounty?: string; heroStack?: number; villainStack?: number } | null;
  range?: Record<string, string>;
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
  strategies?: ImportStrategy[];
  drills?: ImportDrill[];
}

export interface ImportResult {
  legend: Legend | null;
  strategies: Strategy[];
  drills: Drill[];
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
  if (!isObject(input)) return { legend: null, strategies: [], drills: [], errors: ["O arquivo precisa ser um objeto JSON."] };
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
      pko: raw.pko ?? null,
      dealFrom: raw.dealFrom ? { strategyId: String(raw.dealFrom.strategy ?? ""), actionIds: raw.dealFrom.actionIds ?? [] } : null,
      range: compactRange(toRange(raw.range, where, errors), raw.defaultActionId),
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
    const ref = strategy.dealFrom.strategyId;
    const source = byId.get(ref) ?? byName.get(ref.toLowerCase());
    if (!source) errors.push(`Estratégia "${strategy.name}": sorteia mãos de "${ref}", que não foi encontrada.`);
    else if (source.street !== "preflop") errors.push(`Estratégia "${strategy.name}": "${source.name}" não é de pré-flop.`);
    else strategy.dealFrom = { ...strategy.dealFrom, strategyId: source.id };
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

  return { legend, strategies, drills, errors };
}
