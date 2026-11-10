/** Seções da tela de drills: cada drill cai em uma, pelo tipo de spot e pelas tags. */
import { type Drill, drillStrategyIds } from "./drill";
import type { Strategy } from "./strategy";

export const DRILL_SECTIONS = [
  { id: "especiais", label: "Drills especiais" },
  { id: "vanilla", label: "Vanilla" },
  { id: "pko", label: "PKO" },
  { id: "bw", label: "Blind War" },
  { id: "posflop-attack", label: "Posflop Attack" },
  { id: "posflop-defense", label: "Posflop Defense" },
  { id: "pos-flop", label: "Pós-flop" },
  { id: "outros", label: "Outros" },
] as const;

export type DrillSectionId = (typeof DRILL_SECTIONS)[number]["id"];

/**
 * Drills especiais (tag "especial": mãos dos rodadores, aulas, Mystery Bounty) ficam numa seção própria.
 * BW (tag "bw") vale para PKO, vanilla e pós-flop; depois Pós-flop (qualquer decisão depois do pré-flop).
 * Depois PKO (tag "pko") e vanilla (tag "vanilla"); o resto fica em Outros.
 */
export function drillSection(drill: Drill, strategies: ReadonlyMap<string, Strategy>): DrillSectionId {
  const used = drillStrategyIds(drill)
    .map((id) => strategies.get(id))
    .filter((s): s is Strategy => s !== undefined);
  const tags = new Set([...drill.tags, ...used.flatMap((s) => s.tags)].map((t) => t.toLowerCase()));
  if (tags.has("especial") || used.some((s) => s.special)) return "especiais";
  if (tags.has("posflop-attack")) return "posflop-attack";
  if (tags.has("posflop-defense")) return "posflop-defense";
  if (tags.has("bw")) return "bw";
  if (used.some((s) => s.street !== "preflop")) return "pos-flop";
  if (tags.has("pko") || used.some((s) => s.pko)) return "pko";
  if (tags.has("vanilla")) return "vanilla";
  return "outros";
}
