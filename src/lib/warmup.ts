/** Aquecimento: um drill que mistura os drills do plano do jogador, com peso parecido para cada um. */
import { type Drill, drillVariants } from "@/lib/poker/drill";

export const WARMUP_SECONDS = 15 * 60;
/** Cada drill entra com pelo menos este número de variações (repetindo as que tem), para pesos parecidos. */
const SHARE = 60;

export function buildWarmupDrill(drills: readonly Drill[]): { drill: Drill; sourceDrillOf: Record<string, string> } {
  const variants: string[][] = [];
  const sourceDrillOf: Record<string, string> = {};
  for (const d of drills) {
    const own = drillVariants(d);
    const repeat = Math.max(1, Math.ceil(SHARE / own.length));
    for (let i = 0; i < repeat; i++) variants.push(...own);
    for (const v of own) for (const id of v) sourceDrillOf[id] ??= d.id;
  }
  return {
    drill: {
      id: "aquecimento",
      name: "Aquecimento",
      description: drills.map((d) => d.name).join(" · "),
      steps: variants[0] ?? [],
      variants,
      sampling: "fronteira",
      tags: [],
      handsPerSession: 0,
      passAccuracy: 0.9,
    },
    sourceDrillOf,
  };
}
