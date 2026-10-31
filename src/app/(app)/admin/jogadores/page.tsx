import { MembersAdmin } from "@/components/MembersAdmin";
import { listPools, listProfiles, requireAdmin } from "@/lib/data";

export default async function MembersPage() {
  const me = await requireAdmin();
  const [profiles, pools] = await Promise.all([listProfiles(), listPools()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Jogadores e pools</h1>
        <p className="muted">Cadastre cada pessoa do time, defina o papel e a pool.</p>
      </div>
      <MembersAdmin profiles={profiles} pools={pools} myId={me.id} />
    </div>
  );
}
