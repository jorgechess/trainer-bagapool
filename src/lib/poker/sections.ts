/** Seções da tela de drills: cada drill cai em uma, pelo tipo de spot e pelas tags. */
import { type Drill, drillStrategyIds } from "./drill";
import type { Strategy } from "./strategy";

export const DRILL_SECTIONS = [
  { id: "vanilla", label: "Vanilla" },
  { id: "pko", label: "PKO" },
  { id: "bw", label: "Blind War" },
  { id: "pos-flop", label: "Pós-flop" },
  { id: "outros", label: "Outros" },
] as const;

export type DrillSectionId = (typeof DRILL_SECTIONS)[number]["id"];

/**
 * Pós-flop: qualquer decisão depois do pré-flop. BW (tag "bw") vale para PKO e vanilla.
 * Depois PKO (tag "pko") e vanilla (tag "vanilla"); o resto fica em Outros.
 */
export function drillSection(drill: Drill, strategies: ReadonlyMap<string, Strategy>): DrillSectionId {
  const used = drillStrategyIds(drill)
    .map((id) => strategies.get(id))
    .filter((s): s is Strategy => s !== undefined);
  if (used.some((s) => s.street !== "preflop")) return "pos-flop";
  const tags = new Set([...drill.tags, ...used.flatMap((s) => s.tags)].map((t) => t.toLowerCase()));
  if (tags.has("bw")) return "bw";
  if (tags.has("pko") || used.some((s) => s.pko)) return "pko";
  if (tags.has("vanilla")) return "vanilla";
  return "outros";
}
