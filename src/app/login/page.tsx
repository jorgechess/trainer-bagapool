import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-6">
        <div>
          <h1 className="page-title">Trainer Baga Pool</h1>
          <p className="muted mt-1">Entre com o e-mail e a senha que o admin cadastrou.</p>
        </div>
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
