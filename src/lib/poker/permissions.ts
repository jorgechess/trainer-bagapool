/** Papéis e permissões do time. */

export const ROLES = ["admin", "coach", "admin_drills", "mentor", "jogador"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  coach: "Coach",
  admin_drills: "Admin de drills",
  mentor: "Mentor",
  jogador: "Jogador",
};

export interface Member {
  id: string;
  role: Role;
  poolId: string | null;
}

/** Cadastrar jogadores, pools e papéis. */
export function canManageMembers(role: Role): boolean {
  return role === "admin";
}

/** Criar e editar drills, estratégias, legenda e standards. */
export function canManageContent(role: Role): boolean {
  return role === "admin" || role === "coach" || role === "admin_drills" || role === "mentor";
}

/** Ver o desempenho de todos os jogadores. */
export function canViewAllPerformance(role: Role): boolean {
  return role === "admin" || role === "coach" || role === "mentor";
}

/** Jogador vê o próprio desempenho e o da sua pool; coaches, mentores e admin veem todos. */
export function canViewPerformance(viewer: Member, target: Member): boolean {
  if (viewer.id === target.id) return true;
  if (canViewAllPerformance(viewer.role)) return true;
  return viewer.poolId !== null && viewer.poolId === target.poolId;
}
