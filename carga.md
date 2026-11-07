## Teste de carga: 100 jogadores simultâneos por 60s

Requisições: **6215** (98.2/s) · erros: **0** (0.00%)
Decisões gravadas: **16445** (259.8/s) · confirmadas pela API: 16445

| Rota | Chamadas | p50 | p95 | p99 | máx |
|---|---:|---:|---:|---:|---:|
| Abrir treino (página) | 1120 | 623 ms | 826 ms | 1008 ms | 1087 ms |
| Gravar lote de 5 decisões (API) | 3289 | 227 ms | 399 ms | 576 ms | 824 ms |
| Lista de drills (página) | 1120 | 635 ms | 873 ms | 1019 ms | 1198 ms |
| Início (página) | 343 | 686 ms | 992 ms | 1098 ms | 1245 ms |
| Desempenho (página) | 343 | 851 ms | 1177 ms | 1275 ms | 1349 ms |

_CI: servidor Next único (`next start`) e Supabase em Docker no mesmo runner de 2 vCPUs; na Vercel cada função escala sozinha._
