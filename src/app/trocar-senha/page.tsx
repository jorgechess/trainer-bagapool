import { redirect } from "next/navigation";
import { BagaWordmark } from "@/components/BagaWordmark";
import { getCurrentProfile } from "@/lib/data";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <BagaWordmark tagline="WELCOME TO THE NEW ERA" />
      <div className="card w-full max-w-sm space-y-5">
        <div>
          <h1 className="font-display text-3xl tracking-wide text-baga-cream">Crie sua senha</h1>
          <p className="muted mt-1">
            {profile.mustChangePassword
              ? `Olá, ${profile.nick ?? profile.name}! Antes de começar, troque a senha provisória por uma só sua.`
              : "Escolha uma senha nova."}
          </p>
        </div>
        <ChangePasswordForm firstAccess={profile.mustChangePassword} />
        <p className="text-xs text-zinc-500">
          A senha fica guardada criptografada: ninguém do time, nem os admins, consegue vê-la. Se esquecer, o mentor ou o
          admin da sua pool gera uma provisória.
        </p>
      </div>
    </main>
  );
}
