# Documentação técnica — Baga Trainer

Documentação do sistema para quem desenvolve, opera ou audita o Baga Trainer. A estrutura segue o modelo
[arc42](https://arc42.org) (arquitetura), com diagramas no modelo [C4](https://c4model.com) em Mermaid e
decisões registradas como [ADRs](https://adr.github.io) (Architecture Decision Records).

| Documento | Para quem | Conteúdo |
| --- | --- | --- |
| [Arquitetura](arquitetura.md) | Desenvolvimento, auditoria | Objetivos, restrições, contexto, containers, componentes, fluxos, desempenho, segurança, qualidade, riscos |
| [Modelo de dados e permissões](dados.md) | Desenvolvimento, banco | Tabelas, relacionamentos, RLS, funções, migrações |
| [API e ações do servidor](api.md) | Desenvolvimento | `POST /api/decisoes`, server actions, contratos e erros |
| [Cargas, estratégias e drills](cargas-e-drills.md) | Desenvolvimento de conteúdo | Formato das cargas, campos das estratégias, motor de regras pós-flop, como criar um drill novo |
| [Operação (runbook)](operacao.md) | Operação | Deploy, migrações, variáveis, chaves, monitoramento, incidentes comuns |
| [Testes e qualidade](testes.md) | Desenvolvimento | Pirâmide de testes, CI, teste de carga, como rodar localmente |
| [ADRs](adr/) | Todos | Decisões de arquitetura e o porquê de cada uma |
| [Especificação funcional](especificacao.md) | Produto | Requisitos originais do time |

Para colocar o sistema no ar pela primeira vez, veja o [SETUP.md](../SETUP.md).

## Convenções

- Código, nomes de arquivos e identificadores técnicos em inglês; textos da interface, comentários e
  documentação em português.
- A documentação vive no repositório, junto do código: toda mudança de arquitetura atualiza o documento
  e, quando muda uma decisão, ganha um ADR novo (os antigos não são apagados, ficam como "substituído").
