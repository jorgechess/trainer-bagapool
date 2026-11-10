# Cargas, estratégias e drills

O conteúdo do time (ranges, regras pós-flop, drills e cores) é versionado no repositório como **cargas**
em [`cargas/`](../cargas). A cada deploy, o primeiro acesso calcula o hash das cargas e, se for uma versão
nova, importa tudo no banco (`src/lib/cargas-sync.ts`). Ajustes pontuais também podem ser feitos pela tela
**Estratégias**, mas a carga do repositório é a fonte da verdade: a próxima versão sobrescreve itens com
o mesmo `id`.

## Formato de uma carga

```jsonc
{
  "legendAdd": [                       // ações novas na legenda (só entram as que ainda não existem)
    { "id": "bet-75", "label": "Bet 75%", "color": "#c026d3", "kind": "bet", "sizing": "75%" }
  ],
  "strategies": [ /* objetos Strategy, ver abaixo */ ],
  "drills": [
    {
      "id": "cbet-turn-ip",
      "name": "Cbet Turn IP",
      "description": "Texto que aparece na lista de drills",
      "variants": [["cbet-turn-ip-hj-after-b40"], ["cbet-turn-ip-hj-xx"]],  // cada mão sorteia uma linha
      "sampling": "uniforme",            // ou "fronteira" (mãos perto da borda do range)
      "tags": ["posflop-attack", "cbet-turn", "mes"],
      "handsPerSession": 50,
      "passAccuracy": 0.9
    }
  ]
}
```

- `legendAdd` só acrescenta ids que faltam. Para renomear uma ação, crie um id novo.
- Cada cor precisa ser única na legenda inteira (a validação da legenda recusa cores repetidas).
- Uma linha de `variants` com várias estratégias é uma mão de várias decisões (flop → turn → river).
- Toda carga é registrada em [`src/lib/cargas.ts`](../src/lib/cargas.ts) com `requires` (as cargas de que
  ela depende, por exemplo o RFI de onde saem as mãos).

## Campos da estratégia

| Campo | Tipo | Uso |
| --- | --- | --- |
| `id`, `name`, `description` | texto | Identificador estável; nome e descrição na tela |
| `street` | `preflop` · `flop` · `turn` · `river` | Quantas cartas de board o spot tem |
| `situation` | texto | Agrupa no filtro "Situação" e no leak finder |
| `heroPosition`, `villainPosition` | posição | Mesa e filtros |
| `stack` | `{ min, max }` em bb | Faixa sorteada; `randomStacks` sorteia os stacks da mesa |
| `ratio`, `bubble` | faixa, contexto | Max late reg (proporção e bolha) |
| `tags` | texto[] | Seção da tela de drills (`posflop-attack`, `posflop-defense`, `bw`, `pko`, `vanilla`) |
| `actionIds`, `defaultActionId` | ids da legenda | Botões e ação das mãos não pintadas |
| `range`, `alsoCorrect` | mão → ação | Range pré-flop e mãos mistas aceitas |
| `textureRanges` | lista | Ranges pós-flop por textura (vale a primeira que combina) |
| `cbet` | `CbetSpec` | Regra pós-flop em código (ver abaixo); dispensa range |
| `dealFrom` | `{ strategy, actionIds }` | Só sorteia mãos que a outra estratégia joga com essas ações |
| `entryActionIds` | ids | Numa mão de várias decisões, esta só acontece se a resposta anterior for uma delas |
| `tablePot`, `invested`, `tablePosted`, `villainLabel` | bb, texto | Desenho da mesa: pote, fichas já investidas, aposta do vilão |
| `villainCoversHero`, `pko`, `openerStack`, `openType`, `callers`, `tableSizes` | vários | Detalhes de mesa, PKO, multiway |

A validação completa está em `validateStrategy` e `parseImportBundle`
([`src/lib/poker/strategy.ts`](../src/lib/poker/strategy.ts), [`importer.ts`](../src/lib/poker/importer.ts)).

## Motor de regras pós-flop

Spots pós-flop do game plan do time não têm range fixo: a resposta sai do board e da mão do herói.
O campo `cbet.table` escolhe a regra, despachada em [`src/lib/poker/cbet.ts`](../src/lib/poker/cbet.ts):

| `table` | Drill | Módulo |
| --- | --- | --- |
| `mes-ip-vs-bb` | Cbet flop IP | `cbet.ts` |
| `bw-sb` | BW SB Pós | `cbet.ts` |
| `bb-lead` | BB Leads | `cbet.ts` |
| `bb-probe` | BB Probes | `cbet.ts` |
| `bb-vs-cbet` | BB vs Cbet Flop | `vs-cbet.ts` |
| `bw-bb` | BW BB Pós | `bw-bb-pos.ts` |
| `bb-vs-barrel` | BB vs 2nd Barrel | `bb-vs-barrel.ts` |
| `3bet-pot` | 3bet Pot as Aggressor | `threebet-pot.ts` |
| `cbet-turn` | Cbet Turn IP | `cbet-turn.ts` |

Contrato de cada regra:

- `flopRuleFor(spec, board)` devolve a regra do board (`group`, `label`, `mode`, `size`) ou `null` quando o
  board não serve para o spot; o sorteio tenta outro board (até 1.000 tentativas).
- `cbetAnswer(spec, mão, board)` devolve `{ action, rule, hand: { category, reason } }`. A `category` e o
  `reason` aparecem no painel "Sua mão" depois da resposta.
- `ruleSummary(rule)` é o título do painel (ex.: "Guideline Cbet Turn IP (aula 29)").

## Como criar um drill novo (checklist)

1. **Material da aula**: PDF/slides, planilha e a transcrição (`.srt`). Sem a transcrição, documente as
   suposições no commit e na resposta ao time.
2. **Regra**: se o spot é pré-flop, a carga com ranges basta. Se é pós-flop, crie um módulo em
   `src/lib/poker/` com funções puras e registre a tabela em `CbetSpec`, `flopRuleFor`, `cbetAnswer` e
   `ruleSummary`.
3. **Carga**: `cargas/<drill>.json` com `legendAdd` (cores únicas), estratégias (`street`, `tags` da
   seção, `dealFrom`, `tablePot`/`invested` para a mesa) e o drill. Registre em `src/lib/cargas.ts`.
4. **Testes unitários**: exemplos da aula em `src/lib/poker/__tests__/cbet.test.ts` e um teste da carga em
   `cargas.test.ts` (importa sem erros, cai na seção certa, sorteia todas as respostas).
5. **Teste de ponta a ponta**: um passo em `scripts/e2e.mjs` que abre o drill, responde e confere o painel;
   a captura de tela vai para a branch `ci-capturas`.
6. **Push na `main`**, CI verde, conferir a captura e enviar ao time com as suposições feitas.
