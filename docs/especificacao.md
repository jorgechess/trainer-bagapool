# Especificação – Trainer Baga Pool

Ferramenta de treino no estilo GTO Wizard, baseada nas estratégias exploitativas do time Baga Pool contra o field.

## Stack

- Next.js + TypeScript
- Supabase (banco de dados, login, armazenamento de imagens)
- Vercel (hospedagem)

## Visão geral

- Site acessado pelo navegador, responsivo para celular.
- Usado pelo time inteiro, dividido em várias pools.
- Biblioteca única de ranges e estratégias, igual para todas as pools.

## Usuários e permissões

- **Admin**: cadastra cada jogador e define a pool dele.
- **Criadores de exercícios**: coaches, admin de drills e mentores das pools.
- Todo exercício criado fica disponível para o time inteiro.
- **Visibilidade de desempenho**:
  - Jogador: vê o próprio desempenho e o da sua pool.
  - Mentores e coaches: veem o desempenho de todos.

## Ranges e legenda de cores

- Ranges chegam por padrão como imagens (prints); algumas estratégias pós-flop podem vir em planilha.
- Legenda de cores totalmente customizável: cada ação e cada sizing tem uma cor própria (sem esquema de tons claros/escuros).
- Exemplo de padrão: RFI laranja, open shove roxo, fold azul, limp verde.
- Não existem mãos mistas: cada mão tem uma única ação.

## Parâmetros dos spots

- Posição.
- Profundidade de stack em big blinds; cada estratégia define suas próprias faixas.
- Proporção do torneio (jogadores restantes : premiados), ex.: 300 jogadores e 150 premiados = 2:1.
- Estratégias de max late por proporção valem para 15 BB ou menos; acima de 15 BB usam-se ranges mais genéricos.
- Contexto de bolha: ITM garantido ou não.

## Pós-flop

- Estratégias em todas as streets:
  - Flop.
  - Turn: segundo barril, probe turn, etc.
  - River: probe river e demais linhas.
- Texturas: combinações de high, mid e low, monotone, board pareado alto ou baixo.
- Classificação das cartas: T a K = high; 9 a 6 = mid; 5 a 2 = low; Ás = categoria própria (com força de carta alta).
- Flops dos exercícios são aleatórios; o sistema identifica a textura automaticamente.

## Exercícios (drills)

- O criador define o spot inicial e até onde vai: só a ação, só a street ou até o river.
- Correção apenas certo ou errado.
- Cada exercício recebe etiquetas (fase do torneio, proporção, stack, tipo de spot, street).

## Leak finder

- Contabiliza acertos e erros por etiqueta/tipo de spot.
- Métrica mínima por drill para considerar o desempenho satisfatório (a definir).

## Plano mensal

- Todo fim de mês sai o relatório do jogador: print do popup do time gerado no Hand2Note.
- A ferramenta lê os stats da imagem e compara com os standards do time.
- Cada stat é classificado em três faixas: dentro, fora, muito fora.
- **Regra de prioridade**: primeiro todos os stats muito fora, na ordem de prioridade; depois os que estão fora, também na ordem de prioridade.
- Ranking de prioridades configurável pelos coaches (ex.: RFI como prioridade 1).
- Gera os drills do mês e a meta de quantidade, acompanhando o progresso.

## Etapas de entrega

1. Estrutura do projeto, login, cadastro de jogadores e pools.
2. Legenda de cores e editor de range (pintar a grade de 169 mãos).
3. Drills de pré-flop com correção certo/errado e registro de resultados.
4. Leak finder por etiqueta.
5. Pós-flop: classificação de textura e drills até o river.
6. Leitura automática de prints de ranges.
7. Plano mensal a partir do popup do Hand2Note.

## Pendências

- Fluxo de cadastro de exercícios e estratégias a partir dos prints.
- Definir os limites das faixas fora e muito fora para cada stat.
- Definir a métrica de aprovação dos drills.
- Receber os prints de ranges e do popup para análise.
