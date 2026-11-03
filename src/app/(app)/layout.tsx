import { Nav } from "@/components/Nav";
import { syncCargas } from "@/lib/cargas-sync";
import { getPool, requireProfile } from "@/lib/data";
import { redirect } from "next/navigation";
import { canManageContent, canManagePlayers } from "@/lib/poker/permissions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  // Senha provisória (primeiro acesso ou redefinida): troca antes de usar o app
  if (profile.mustChangePassword) redirect("/trocar-senha");
  // Ranges e drills do time vêm direto do repositório (uma vez por versão)
  await syncCargas();
  const pool = await getPool(profile.poolId);
  return (
    <div className="min-h-screen">
      <Nav
        name={profile.name}
        pool={pool ? { name: pool.name, color: pool.color, logo: pool.logo } : null}
        canManageContent={canManageContent(profile.role)}
        canManageMembers={canManagePlayers(profile)}
      />
      <main className="mx-auto w-full max-w-[1800px] p-4 pb-16 sm:p-6 2xl:px-10">{children}</main>
    </div>
  );
}
