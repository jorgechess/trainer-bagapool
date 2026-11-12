import { MembersAdmin } from "@/components/MembersAdmin";
import { listPools, listProfiles, requireMemberManager } from "@/lib/data";

export default async function MembersPage() {
  const me = await requireMemberManager();
  const [profiles, pools] = await Promise.all([listProfiles(), listPools()]);
  const isAdmin = me.role === "admin";
  // Mentor vê e gerencia só os jogadores da própria pool
  const visible = isAdmin ? profiles : profiles.filter((p) => p.poolId === me.poolId && p.role === "jogador" && !p.isTest);
  const myPool = pools.find((p) => p.id === me.poolId);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{isAdmin ? "Jogadores e pools" : `Jogadores · ${myPool?.name ?? ""}`}</h1>
        <p className="muted">
          Gere o acesso de cada jogador: o login é o nick e a senha inicial é provisória (ele troca no primeiro acesso).
          Esqueceu a senha? Gere uma nova provisória aqui.
        </p>
      </div>
      <MembersAdmin profiles={visible} pools={pools} myId={me.id} isAdmin={isAdmin} myPoolId={me.poolId} />
    </div>
  );
}
