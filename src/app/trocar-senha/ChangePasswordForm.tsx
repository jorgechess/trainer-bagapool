"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changePassword } from "./actions";

export function ChangePasswordForm({ firstAccess }: { firstAccess: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await changePassword(password, confirmation);
          if (!r.ok) return setError(r.error);
          router.replace("/");
          router.refresh();
        });
      }}
    >
      <div>
        <label className="label" htmlFor="nova-senha">
          Nova senha
        </label>
        <input
          id="nova-senha"
          type="password"
          autoComplete="new-password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-zinc-500">Pelo menos 8 caracteres, com letras e números.</p>
      </div>
      <div>
        <label className="label" htmlFor="confirmar-senha">
          Repita a senha
        </label>
        <input
          id="confirmar-senha"
          type="password"
          autoComplete="new-password"
          className="input"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Salvando..." : firstAccess ? "Salvar e entrar" : "Salvar"}
      </button>
    </form>
  );
}
