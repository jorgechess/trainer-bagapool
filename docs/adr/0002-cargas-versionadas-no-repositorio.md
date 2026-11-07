# ADR 0002: Conteúdo do time como cargas JSON no repositório

- **Status:** aceita
- **Data:** 2026-10 (registrada em 2026-11)

## Contexto

Os ranges e as regras chegam a cada aula, muitas vezes junto com mudanças de código (regra pós-flop nova). Cadastrar tudo à mão pela tela é lento e sujeito a erro, e o conteúdo precisa ser revisável.

## Decisão

Manter o conteúdo em `cargas/*.json`, registrado em `src/lib/cargas.ts`. No primeiro acesso de cada versão (hash SHA-1 das cargas), o servidor importa tudo no banco e grava `settings.cargas_version`.

## Consequências

- Conteúdo e regra mudam no mesmo commit e passam pelos mesmos testes.
- Histórico e revisão pelo Git; rollback de conteúdo é reverter o commit.
- Edições feitas pela tela com o mesmo `id` são sobrescritas na próxima versão da carga.
- A importação roda no caminho de uma requisição (primeiro acesso); é idempotente e tolera falha.

## Alternativas consideradas

Somente pela tela de Estratégias (lento, sem revisão); script de importação manual (fácil de esquecer).
