import Link from "next/link";
import { DrillRequestReview } from "@/components/DrillRequestReview";
import { listProfiles, requireContentManager } from "@/lib/data";
import { REQUEST_STATUS_LABEL, listDrillRequests, weekStart } from "@/lib/drill-requests";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const dayFmt = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
};

/** Análise semanal dos pedidos de drill: agrupados pela semana (segunda a domingo), mais recentes primeiro. */
export default async function DrillRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireContentManager();
  const params = await searchParams;
  const [requests, profiles] = await Promise.all([listDrillRequests(), listProfiles()]);
  const names = new Map(profiles.map((p) => [p.id, p.nick ?? p.name]));
  const filter = params.status ?? "abertos";
  const shown = requests.filter((r) =>
    filter === "todos" ? true : filter === "abertos" ? r.status === "novo" || r.status === "em_analise" : r.status === filter,
  );
  const weeks = new Map<string, typeof shown>();
  for (const r of shown) {
    const key = weekStart(r.createdAt);
    weeks.set(key, [...(weeks.get(key) ?? []), r]);
  }
  const filters: [string, string][] = [
    ["abertos", "Abertos"],
    ["aprovado", "Aprovados"],
    ["feito", "Feitos"],
    ["recusado", "Recusados"],
    ["todos", "Todos"],
  ];
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="page-title">Pedidos de drill</h1>
        <p className="muted">Pedidos do time por semana. Mude o status e deixe uma resposta para quem pediu.</p>
      </div>
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Filtro">
        {filters.map(([v, l]) => (
          <Link
            key={v}
            href={`/drills/pedidos?status=${v}`}
            aria-current={filter === v ? "page" : undefined}
            className={`rounded-md px-3 py-1 ${filter === v ? "bg-baga-red/15 text-baga-cream" : "text-zinc-400 hover:text-white"}`}
          >
            {l}
          </Link>
        ))}
      </nav>
      {weeks.size === 0 && <p className="card muted">Nenhum pedido aqui.</p>}
      {[...weeks.entries()].map(([week, list]) => (
        <section key={week} className="space-y-3" data-testid="semana-pedidos">
          <h2 className="text-sm font-semibold text-zinc-400">
            Semana de {dayFmt(week)} · {list.length} pedido{list.length > 1 ? "s" : ""}
          </h2>
          {list.map((r) => (
            <article key={r.id} className="card space-y-3" data-testid="pedido">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{r.title}</h3>
                <span className="text-xs text-zinc-400">
                  {names.get(r.userId) ?? "—"} · {dateFmt.format(new Date(r.createdAt))} · {REQUEST_STATUS_LABEL[r.status]}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap text-zinc-200">{r.description}</p>
              {r.imageIds.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {r.imageIds.map((id, i) => (
                    <a key={id} href={`/api/pedidos/imagem/${id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/pedidos/imagem/${id}`} alt={`Print ${i + 1}`} className="h-36 w-full bg-black object-contain" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              <DrillRequestReview id={r.id} status={r.status} reply={r.reply} />
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
