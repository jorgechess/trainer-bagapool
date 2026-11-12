import Link from "next/link";
import { DrillRequestForm } from "@/components/DrillRequestForm";
import { requireProfile } from "@/lib/data";
import { REQUEST_STATUS_LABEL, listDrillRequests } from "@/lib/drill-requests";
import { canManageContent } from "@/lib/poker/permissions";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

/** Novo drill = pedido: a pessoa apresenta o drill e anexa prints; o time analisa os pedidos toda semana. */
export default async function NewDrillRequestPage() {
  const profile = await requireProfile();
  const manager = canManageContent(profile.role);
  const mine = await listDrillRequests({ onlyMine: profile.id });
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Novo drill</h1>
          <p className="muted">
            Apresente o drill que você gostaria de treinar e, se puder, anexe prints da estratégia (HRC, GTO Wizard,
            planilha da aula). Os pedidos são analisados toda semana.
          </p>
        </div>
        {manager && (
          <div className="flex gap-2">
            <Link href="/drills/pedidos" className="btn-secondary">
              Pedidos do time
            </Link>
            <Link href="/drills/novo/manual" className="btn-secondary">
              Criar manualmente
            </Link>
          </div>
        )}
      </div>
      <DrillRequestForm />
      {mine.length > 0 && (
        <section className="card space-y-3" data-testid="meus-pedidos">
          <h2 className="font-semibold">Seus pedidos</h2>
          <ul className="divide-y divide-zinc-800">
            {mine.map((r) => (
              <li key={r.id} className="space-y-1 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-xs text-zinc-400">
                    {dateFmt.format(new Date(r.createdAt))} · <span className="text-zinc-200">{REQUEST_STATUS_LABEL[r.status]}</span>
                    {r.imageIds.length > 0 && ` · ${r.imageIds.length} print${r.imageIds.length > 1 ? "s" : ""}`}
                  </span>
                </div>
                {r.reply && <p className="text-sm text-zinc-300">Resposta: {r.reply}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
