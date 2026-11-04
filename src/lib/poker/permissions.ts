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

/** Gerar acesso e nova senha: admin para todo o time; mentor só para os jogadores da própria pool. */
export function canManagePlayers(viewer: Member): boolean {
  return viewer.role === "admin" || (viewer.role === "mentor" && viewer.poolId !== null);
}

export function canManagePlayer(viewer: Member, target: Member): boolean {
  if (viewer.role === "admin") return true;
  return viewer.role === "mentor" && viewer.poolId !== null && target.poolId === viewer.poolId && target.role === "jogador";
}

/** Nick do login: 3 a 30 letras, números, ponto, hífen ou sublinhado. */
export const NICK_PATTERN = /^[A-Za-z0-9_.-]{3,30}$/;

/** Senha nova do jogador: pelo menos 8 caracteres, com letra e número. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use letras e números na senha.";
  return null;
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

/**
 * Acrescentar ou tirar drills do plano do mês (é o que alimenta o warmup):
 * admin para todos, mentor para os jogadores da própria pool e qualquer perfil que não seja jogador no próprio plano.
 */
export function canEditPlanDrills(viewer: Member, target: Member): boolean {
  if (viewer.role === "admin") return true;
  if (viewer.id === target.id) return viewer.role !== "jogador";
  return canManagePlayer(viewer, target);
}
