## Teste de carga: 100 jogadores simultâneos por 60s

Requisições: **4587** (72.1/s) · erros: **0** (0.00%)
Decisões gravadas: **12105** (190.2/s) · confirmadas pela API: 12105

| Rota | Chamadas | p50 | p95 | p99 | máx |
|---|---:|---:|---:|---:|---:|
| Abrir treino (página) | 838 | 1105 ms | 1393 ms | 1601 ms | 1639 ms |
| Gravar lote de 5 decisões (API) | 2421 | 416 ms | 696 ms | 890 ms | 1053 ms |
| Lista de drills (página) | 838 | 1125 ms | 1460 ms | 1592 ms | 1697 ms |
| Início (página) | 245 | 1131 ms | 1495 ms | 1637 ms | 1676 ms |
| Desempenho (página) | 245 | 1988 ms | 2438 ms | 2503 ms | 2532 ms |

_CI: servidor Next único (`next start`) e Supabase em Docker no mesmo runner de 2 vCPUs; na Vercel cada função escala sozinha._
