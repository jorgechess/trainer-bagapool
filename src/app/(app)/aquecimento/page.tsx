import Link from "next/link";
import { Warmup } from "@/components/Warmup";
import { getAttempts, getLegend, getPlan, listDrills, listStrategies, requireProfile } from "@/lib/data";
import { currentMonth, monthStartIso } from "@/lib/format";
import { drillDependencyIds } from "@/lib/poker/drill";
import { planProgress } from "@/lib/poker/plan";
import { WARMUP_SECONDS, buildWarmupDrill } from "@/lib/warmup";

/** Aquecimento cronometrado (15 minutos por padrão, o jogador escolhe) com um mix do plano do mês (ou dos drills com pior acerto). */
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
  // Só os drills do plano do mês: primeiro os que ainda não bateram a meta; se todos bateram, todos do plano
  const progress = plan ? planProgress(plan.plan, attempts) : [];
  const pending = progress.filter((g) => !g.completed);
  const chosen = (pending.length ? pending : progress)
    .map((g) => byId.get(g.drillId))
    .filter((d) => d !== undefined);
  if (chosen.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 text-center" data-testid="warmup-sem-plano">
        <h1 className="page-title">Warmup</h1>
        <p className="muted">
          O warmup usa os drills do seu plano do mês, e você ainda não tem plano para este mês. Fale com o seu mentor para
          montar o plano.
        </p>
        <Link href="/plano" className="btn-secondary">
          Ver plano do mês
        </Link>
      </div>
    );
  }
  const source = pending.length ? "drills do plano do mês" : "drills do plano do mês (metas já batidas)";
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
