import { Warmup } from "@/components/Warmup";
import { getAttempts, getLegend, getPlan, listDrills, listStrategies, requireProfile } from "@/lib/data";
import { currentMonth, monthStartIso } from "@/lib/format";
import { drillDependencyIds } from "@/lib/poker/drill";
import { reportByDrill } from "@/lib/poker/leaks";
import { planProgress } from "@/lib/poker/plan";
import { WARMUP_SECONDS, buildWarmupDrill } from "@/lib/warmup";

/** Aquecimento de 15 minutos com um mix do plano do mês (ou dos drills com pior acerto). */
export default async function WarmupPage() {
  const profile = await requireProfile();
  const month = currentMonth();
  const [attempts, plan, drills, strategyList, legend] = await Promise.all([
    getAttempts(profile.id, monthStartIso(month)),
    getPlan(profile.id, month),
    listDrills(),
    listStrategies(),
    getLegend(),
  ]);
  const byId = new Map(drills.map((d) => [d.id, d]));
  let source = "plano do mês";
  let chosen = plan
    ? planProgress(plan.plan, attempts)
        .filter((g) => !g.completed)
        .map((g) => byId.get(g.drillId))
        .filter((d) => d !== undefined)
    : [];
  if (chosen.length === 0) {
    source = "drills com pior acerto no mês";
    chosen = reportByDrill(attempts)
      .filter((r) => r.total >= 20)
      .slice(0, 3)
      .map((r) => byId.get(r.drillId))
      .filter((d) => d !== undefined);
  }
  if (chosen.length === 0) {
    source = "drills do time";
    chosen = drills.slice(0, 4);
  }
  const { drill, sourceDrillOf } = buildWarmupDrill(chosen);
  const strategyMap = new Map(strategyList.map((s) => [s.id, s]));
  const ids = new Set(chosen.flatMap((d) => drillDependencyIds(d, strategyMap)));
  return (
    <Warmup
      drill={drill}
      strategies={strategyList.filter((s) => ids.has(s.id))}
      legend={legend}
      sourceDrillOf={sourceDrillOf}
      seconds={WARMUP_SECONDS}
      source={source}
      drillNames={chosen.map((d) => d.name)}
      sourceDrillNames={Object.fromEntries(chosen.map((d) => [d.id, d.name]))}
    />
  );
}
