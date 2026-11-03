"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { editPlanDrill } from "@/app/(app)/plano/actions";

export function RemovePlanDrillButton({ userId, month, drillId, name }: { userId: string; month: string; drillId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="text-xs text-zinc-500 hover:text-red-400"
      disabled={pending}
      title={`Tirar ${name} do plano`}
      data-testid="remover-drill-plano"
      onClick={() => {
        if (!confirm(`Tirar "${name}" do plano do mês?`)) return;
        startTransition(async () => {
          const r = await editPlanDrill({ userId, month, drillId }, "remove");
          if (!r.ok) alert(r.error);
          router.refresh();
        });
      }}
    >
      {pending ? "..." : "Tirar"}
    </button>
  );
}

export function AddPlanDrillForm({
  userId,
  month,
  drills,
}: {
  userId: string;
  month: string;
  drills: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [drillId, setDrillId] = useState("");
  const [target, setTarget] = useState("200");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      data-testid="acrescentar-drill-plano"
      onSubmit={(e) => {
        e.preventDefault();
        if (!drillId) return;
        startTransition(async () => {
          const r = await editPlanDrill({ userId, month, drillId, targetDecisions: Number(target) }, "add");
          setMessage(r.ok ? { ok: true, text: r.message ?? "Pronto." } : { ok: false, text: r.error });
          if (r.ok) {
            setDrillId("");
            router.refresh();
          }
        });
      }}
    >
      <div className="min-w-56 flex-1">
        <label className="label">Drill</label>
        <select className="input" value={drillId} onChange={(e) => setDrillId(e.target.value)}>
          <option value="">Escolha um drill</option>
          {drills.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="w-32">
        <label className="label">Meta (decisões)</label>
        <input className="input" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} />
      </div>
      <button className="btn-primary" disabled={pending || !drillId}>
        {pending ? "Salvando..." : "Acrescentar"}
      </button>
      {message && <p className={`w-full text-sm ${message.ok ? "text-green-400" : "text-red-400"}`}>{message.text}</p>}
    </form>
  );
}
