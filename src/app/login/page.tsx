import { BagaWordmark } from "@/components/BagaWordmark";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <div className="text-center">
        <BagaWordmark tagline="WELCOME TO THE NEW ERA" />
        <p className="font-display mt-2 text-lg tracking-[0.3em] text-zinc-400">TRAINER</p>
      </div>
      <div className="card w-full max-w-sm space-y-6">
        <p className="muted">Entre com o e-mail e a senha que o admin cadastrou.</p>
        {erro === "sem-acesso" && (
          <p className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-200">
            Seu acesso não está ativo. Fale com o admin do time.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
