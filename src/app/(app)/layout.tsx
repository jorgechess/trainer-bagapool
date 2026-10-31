import { Nav } from "@/components/Nav";
import { requireProfile } from "@/lib/data";
import { canManageContent, canManageMembers } from "@/lib/poker/permissions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <div className="min-h-screen">
      <Nav
        name={profile.name}
        canManageContent={canManageContent(profile.role)}
        canManageMembers={canManageMembers(profile.role)}
      />
      <main className="mx-auto w-full max-w-6xl p-4 pb-16 sm:p-6">{children}</main>
    </div>
  );
}
