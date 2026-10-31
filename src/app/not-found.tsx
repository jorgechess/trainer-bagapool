import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card max-w-sm space-y-3 text-center">
        <h1 className="page-title">Página não encontrada</h1>
        <p className="muted">O endereço não existe ou o item foi removido.</p>
        <Link href="/" className="btn-primary">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
