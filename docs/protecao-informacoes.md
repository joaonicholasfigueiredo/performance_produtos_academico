# Proteção de informações na versão acadêmica

O diagnóstico foi feito por leitura dos módulos, da configuração, dos testes, da documentação e do índice Git. Este documento registra apenas classes de achados, sem valores originais. Ele não substitui uma revisão de segurança ou de autorização de publicação do histórico Git.

| Classe | Decisão | Tratamento |
|---|---|---|
| `.config/.env`, outros `.env`, chaves JWT e credenciais PostgreSQL | **MANTER SOMENTE LOCAL** | Arquivos ignorados pelo Git; exemplos usam placeholders. Não incluir em entregas. |
| Logs locais e exportações que possam conter dados importados | **MANTER SOMENTE LOCAL** | Ignorar `logs/`, `data/exports/` e `.config/`; revisar qualquer arquivo gerado antes de distribuir. |
| Capturas antigas da auditoria visual com identificação e números reais | **REMOVER DA DOCUMENTAÇÃO DISTRIBUÍDA** | Retiradas do índice Git e ignoradas, preservadas no computador para revisão privada. O histórico anterior ainda pode contê-las. |
| Nomes específicos de unidades em constante de apresentação | **ANONIMIZAR** | Substituídos por rótulos genéricos; códigos de PA, filtros e fórmulas permanecem. |
| Identificadores de produto e códigos de PA usados em cálculos | **MANTER** | Fazem parte das regras e do contrato da planilha. Seu significado deve ser avaliado antes de divulgação externa. |
| Dados financeiros, clientes e auditoria armazenados no PostgreSQL | **MANTER SOMENTE LOCAL** | Usar base sintética na demonstração e em qualquer captura ou exportação acadêmica. |

`.gitignore` não remove conteúdo já existente do histórico. Caso o repositório tenha sido compartilhado antes da sanitização, uma revisão específica do histórico e das credenciais usadas é necessária fora desta atividade; o histórico não foi reescrito aqui. Não compartilhe `.config/`, `.env`, dumps, CSVs, XLSX/PDF de produção, logs nem capturas privadas.
