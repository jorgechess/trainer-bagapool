"use client";

import { usePathname } from "next/navigation";

/** Telas de treino usam a largura toda (monitores ultrawide); o resto fica numa coluna de leitura. */
export function isWideRoute(pathname: string): boolean {
  return /^\/drills\/[^/]+\/treinar/.test(pathname) || pathname.startsWith("/aquecimento");
}

export function widthClass(pathname: string): string {
  return isWideRoute(pathname) ? "max-w-[3400px]" : "max-w-[1800px]";
}

export function MainContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <main className={`mx-auto w-full ${widthClass(pathname)} p-4 pb-16 sm:p-6 2xl:px-10`}>{children}</main>;
}
