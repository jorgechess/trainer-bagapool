/** Quantidade de mãos da sessão: preferência do jogador, usada na tela de drills e no treino. */
export const LENGTH_KEY = "trainer:maos";
/** 0 = padrão do drill; -1 = sem limite (até clicar em "Encerrar sessão"). */
export const LENGTH_OPTIONS = [0, 10, 25, 50, 100, -1] as const;
