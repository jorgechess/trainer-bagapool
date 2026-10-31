"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BagaWordmark } from "@/components/BagaWordmark";
import { PoolChip, type PoolLook } from "@/components/PoolBadge";
import { createClient } from "@/lib/supabase/client";

interface NavProps {
  name: string;
  pool: PoolLook | null;
  canManageContent: boolean;
  canManageMembers: boolean;
}

export function Nav({ name, pool, canManageContent, canManageMembers }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "Início" },
    { href: "/drills", label: "Drills" },
    { href: "/desempenho", label: "Desempenho" },
    { href: "/plano", label: "Plano do mês" },
    { href: "/atalhos", label: "Atalhos" },
    ...(canManageContent
      ? [
          { href: "/estrategias", label: "Estratégias" },
          { href: "/legenda", label: "Legenda" },
          { href: "/admin/standards", label: "Standards" },
          { href: "/admin/importar", label: "Importar" },
        ]
      : []),
    ...(canManageMembers ? [{ href: "/admin/jogadores", label: "Jogadores" }] : []),
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-baga-black/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-4 py-3 sm:px-6 2xl:px-10">
        <Link href="/" aria-label="Baga Trainer — início">
          <BagaWordmark size="sm" />
        </Link>
        <nav className="hidden flex-1 gap-0.5 xl:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap ${
                isActive(link.href) ? "bg-baga-red/15 text-baga-cream" : "text-zinc-400 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-3 xl:flex">
          <span className="text-sm whitespace-nowrap text-zinc-300">{name}</span>
          <PoolChip pool={pool} />
          <button onClick={logout} className="btn-secondary px-3 py-1.5">
            Sair
          </button>
        </div>
        <span className="ml-auto xl:hidden">
          <PoolChip pool={pool} compact />
        </span>
        <button
          className="btn-secondary px-3 py-1.5 xl:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Menu"
        >
          {open ? "Fechar" : "Menu"}
        </button>
      </div>
      {open && (
        <nav className="border-t border-zinc-800 px-4 py-2 xl:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2 text-sm ${
                isActive(link.href) ? "bg-zinc-800 text-white" : "text-zinc-300"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-zinc-800 px-3 pt-3 pb-1">
            <span className="flex items-center gap-2 text-sm text-zinc-300">
              {name}
              <PoolChip pool={pool} />
            </span>
            <button onClick={logout} className="btn-secondary px-3 py-1.5">
              Sair
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
