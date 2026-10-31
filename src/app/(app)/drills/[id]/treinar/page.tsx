import { notFound } from "next/navigation";
import { Trainer } from "@/components/Trainer";
import { getDrill, getLegend, listStrategies, requireProfile } from "@/lib/data";
import { drillStrategyIds, validateDrill } from "@/lib/poker/drill";

export default async function TrainPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const [drill, strategyList, legend] = await Promise.all([getDrill(id), listStrategies(), getLegend()]);
  if (!drill) notFound();
  const ids = drillStrategyIds(drill);
  const strategies = strategyList.filter((s) => ids.includes(s.id));
  const errors = validateDrill(drill, new Map(strategies.map((s) => [s.id, s])));
  if (errors.length) {
    return (
      <div className="card space-y-2">
        <h1 className="page-title">{drill.name}</h1>
        <p className="text-red-400">Este drill tem problemas e não pode ser treinado:</p>
        <ul className="list-disc pl-5 text-sm text-zinc-300">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    );
  }
  return <Trainer drill={drill} strategies={strategies} legend={legend} />;
}
