"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createMember,
  createPool,
  deletePool,
  resetPassword,
  updatePool,
  updateMember,
} from "@/app/(app)/admin/jogadores/actions";
import { PoolChip, PoolLogo } from "@/components/PoolBadge";
import type { Pool, Profile } from "@/lib/data";
import { LOGO_OPTIONS } from "@/lib/pools";
import type { ActionResult } from "@/lib/format";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/poker/permissions";

function randomPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

function Feedback({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p className={`text-sm ${result.ok ? "text-green-400" : "text-red-400"}`}>
      {result.ok ? (result.message ?? "Pronto.") : result.error}
    </p>
  );
}

function PoolSelect({ pools, value, onChange }: { pools: Pool[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sem pool</option>
      {pools.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function RoleSelect({ value, onChange }: { value: Role; onChange: (v: Role) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value as Role)}>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

function NewMemberForm({ pools }: { pools: Pool[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Gerada só no navegador, para o HTML do servidor e o do navegador baterem
  const [password, setPassword] = useState("");
  useEffect(() => setPassword(randomPassword()), []);
  const [role, setRole] = useState<Role>("jogador");
  const [poolId, setPoolId] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const r = await createMember({ name, email, password, role, poolId: poolId || null });
      setResult(r.ok ? { ok: true, message: `${r.message} Senha: ${password}` } : r);
      if (r.ok) {
        setName("");
        setEmail("");
        setPassword(randomPassword());
      }
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-semibold">Novo jogador</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label">Nome</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Senha inicial</label>
          <input className="input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div>
          <label className="label">Papel</label>
          <RoleSelect value={role} onChange={setRole} />
        </div>
        <div>
          <label className="label">Pool</label>
          <PoolSelect pools={pools} value={poolId} onChange={setPoolId} />
        </div>
      </div>
      <Feedback result={result} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Cadastrando..." : "Cadastrar"}
      </button>
    </form>
  );
}

function MemberRow({ profile, pools, isMe }: { profile: Profile; pools: Pool[]; isMe: boolean }) {
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState<Role>(profile.role);
  const [poolId, setPoolId] = useState(profile.poolId ?? "");
  const [active, setActive] = useState(profile.active);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty =
    name !== profile.name || role !== profile.role || poolId !== (profile.poolId ?? "") || active !== profile.active;

  function save() {
    startTransition(async () => {
      setResult(await updateMember({ id: profile.id, name, role, poolId: poolId || null, active }));
    });
  }

  function newPassword() {
    const password = randomPassword();
    if (!confirm(`Trocar a senha de ${profile.name}?`)) return;
    startTransition(async () => {
      const r = await resetPassword(profile.id, password);
      setResult(r.ok ? { ok: true, message: `Nova senha: ${password}` } : r);
    });
  }

  return (
    <div className={`card space-y-2 ${active ? "" : "opacity-60"}`}>
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.4fr_1fr_1fr_auto]">
        <div>
          <label className="label">Nome</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">E-mail</label>
          <div className="flex items-center gap-2 py-2 text-sm text-zinc-300">
            <span className="truncate">{profile.email}</span>
            <PoolChip pool={pools.find((p) => p.id === profile.poolId) ?? null} compact />
          </div>
        </div>
        <div>
          <label className="label">Papel</label>
          <RoleSelect value={role} onChange={setRole} />
        </div>
        <div>
          <label className="label">Pool</label>
          <PoolSelect pools={pools} value={poolId} onChange={setPoolId} />
        </div>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" checked={active} disabled={isMe} onChange={(e) => setActive(e.target.checked)} />
          Ativo
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary px-3 py-1.5" onClick={save} disabled={!dirty || pending}>
          Salvar
        </button>
        <button className="btn-secondary px-3 py-1.5" onClick={newPassword} disabled={pending}>
          Gerar nova senha
        </button>
        <Feedback result={result} />
      </div>
    </div>
  );
}

function PoolRow({ pool, members }: { pool: Pool; members: number }) {
  const [name, setName] = useState(pool.name);
  const [color, setColor] = useState(pool.color);
  const [logo, setLogo] = useState(pool.logo ?? "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = name !== pool.name || color !== pool.color || logo !== (pool.logo ?? "");
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg bg-black/40 p-2">
      <PoolLogo pool={{ name, color, logo: logo || null }} size={48} />
      <input className="input max-w-48" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        type="color"
        className="h-9 w-12 cursor-pointer rounded border border-zinc-700 bg-transparent"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        title="Cor da pool"
      />
      <select className="input max-w-52" value={logo} onChange={(e) => setLogo(e.target.value)}>
        <option value="">Sem logo (iniciais)</option>
        {LOGO_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-zinc-500">{members} ativos</span>
      <div className="ml-auto flex gap-2">
        <button
          className="btn-primary px-3 py-1.5"
          disabled={!dirty || pending}
          onClick={() =>
            startTransition(async () => setResult(await updatePool(pool.id, { name, color, logo: logo || null })))
          }
        >
          Salvar
        </button>
        <button
          className="btn-danger px-2 py-1.5"
          disabled={pending}
          onClick={() => {
            if (confirm(`Excluir a pool ${pool.name}?`)) startTransition(async () => setResult(await deletePool(pool.id)));
          }}
        >
          Excluir
        </button>
      </div>
      {result && <div className="w-full"><Feedback result={result} /></div>}
    </li>
  );
}

function PoolsCard({ pools, profiles }: { pools: Pool[]; profiles: Profile[] }) {
  const [name, setName] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const count = (id: string) => profiles.filter((p) => p.poolId === id && p.active).length;

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Pools</h2>
      <ul className="space-y-2">
        {pools.map((pool) => (
          <PoolRow key={pool.id} pool={pool} members={count(pool.id)} />
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await createPool(name);
            setResult(r);
            if (r.ok) setName("");
          });
        }}
      >
        <input className="input" placeholder="Nome da nova pool" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-secondary whitespace-nowrap" disabled={pending}>
          Criar pool
        </button>
      </form>
      <Feedback result={result} />
    </div>
  );
}

export function MembersAdmin({ profiles, pools, myId }: { profiles: Profile[]; pools: Pool[]; myId: string }) {
  const [filter, setFilter] = useState("");
  const filtered = profiles.filter((p) =>
    `${p.name} ${p.email}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <PoolsCard pools={pools} profiles={profiles} />
      <NewMemberForm pools={pools} />
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Time ({profiles.length})</h2>
          <input
            className="input max-w-xs"
            placeholder="Buscar por nome ou e-mail"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {filtered.map((profile) => (
          <MemberRow key={profile.id} profile={profile} pools={pools} isMe={profile.id === myId} />
        ))}
      </div>
    </div>
  );
}
