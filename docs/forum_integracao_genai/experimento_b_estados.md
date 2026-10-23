# Experimento B — Estados, dependências e efeitos colaterais

## Registro e condições da geração

- Data: 23/10/2026, referência de calendário America/Sao_Paulo.
- Projeto: `performance_produtos_academico`.
- Estratégia solicitada: prompt estruturado por estados, dependências e efeitos colaterais.
- Agente: Codex nesta conversa. Identificador exato do modelo, temperatura, seed e demais parâmetros de amostragem não foram disponibilizados; não se atribuem valores a eles.
- Fonte analisada: arquivos locais na árvore de trabalho, inclusive alterações preexistentes não commitadas. HEAD consultado: `a0dbd4f768b64ac4df62d382290078d9a44c98d8`; esse hash sozinho não reproduz a árvore analisada.
- Procedimento: leitura estática dos contratos, serviços, repositórios, documentação e trechos dos testes existentes; geração documental de oito propostas, sem execução ou validação empírica.
- Não foram executados testes, coleta do pytest, imports Python, aplicação, startup ou conexões PostgreSQL. Não se implementou Python, não se alteraram regras de negócio e não se criaram commits.
- Somente os dois documentos B foram criados. As asserções nos resultados são sugestões textuais para futura implementação, não testes implementados.
- Saída original desta geração: [resultados_b_estados.md](resultados_b_estados.md). Os oito casos foram registrados em uma versão única, sem refinamento posterior. A conferência documental de quantidade, estrutura e preservação dos arquivos A não equivale à validação funcional.

## Limitação metodológica e contexto anterior

Não havia resultados ou cenários anteriores nas mensagens visíveis da conversa antes desta solicitação. Entretanto, já existiam no workspace `experimento_a_zero_shot.md`, `resultados_a_zero_shot.md` e testes com cenários de importação e análise. A existência dos documentos A foi identificada e seus hashes foram obtidos; seu conteúdo não foi lido nesta geração. Trechos dos testes existentes foram consultados como evidência de contratos e de simulação já utilizada. Há, portanto, exposição a cenários prévios do projeto, e não se afirma independência experimental nem ausência de influência dessa exposição. As modificações locais preexistentes também limitam a reprodução pelo HEAD isolado. Não houve execução que permita comparar taxa de sucesso entre A e B.

Hashes SHA-256 dos arquivos A observados antes da escrita dos documentos B, mantidos para conferência de preservação:

- `experimento_a_zero_shot.md`: `7D66CEDEAB4A6DCC383241C5337FD848E6C904D7357F4C770A4F7F954D5FD3CF`.
- `resultados_a_zero_shot.md`: `3B9238EE820B63FE8AAF574D1127C7CD2ECA641FE9BF10933E1EE547320A7138`.

## Contratos consultados

- [Configuração de colunas e produtos](../../app/config.py): colunas obrigatórias, chave natural e produtos de saldo.
- [Sessão, autorização e startup](../../app/core.py), [login e logout](../../app/routes/auth.py) e [verificação de tokens](../../app/auth.py): autenticação e perfil admin; startup inicializa o banco e não foi acionado.
- [Rotas de importação](../../app/routes/imports.py) e [serviço de importação](../../services/importer.py): análise, confirmação, cancelamento, normalização, metadados e tratamento de falhas.
- [Prévias persistidas](../../repo/database_pending.py): validade de 24 horas e limpeza oportunista.
- [Substituição de período](../../repo/database_data.py), [conexão e schema](../../repo/database_core.py), [fachada pública](../../repo/database.py) e [logs e limpeza](../../repo/database_logs.py): transação e tabelas.
- [Auditoria](../../services/audit.py) e [rotas administrativas](../../app/routes/admin.py): resumo de alterações e contratos HTTP de logs e limpeza.
- [Rotas analíticas](../../app/routes/analytics.py), [produção acumulada](../../services/analytics_production.py), [fontes analíticas](../../services/analytics_common.py) e [resumo de unidades](../../services/analytics_summary.py): leitura, seleção temporal e dependência do cadastro vigente.
- [Cadastro de unidades](../../services/units.py) e [validação de origens](../../repo/database_units.py): cadastro explícito e revalidação na confirmação.
- [Fluxo documentado](../fluxo-importacao.md), [regras documentadas](../regras-negocio.md), [testes existentes](../../tests/test_import_flow.py) e [fixtures de isolamento](../../tests/conftest.py): contexto e limites dos doubles. Nenhum desses testes foi executado.

## Prompt integral recebido

O bloco seguinte transcreve integralmente a mensagem do usuário que solicitou o experimento, incluindo a saudação. Instruções de sistema, configuração do ambiente e respostas intermediárias do agente não integram esse prompt do usuário.

```text
Bom dia minha querida Lai, como voce esta?



# Fórum Unidade III — Experimento B: Estados e falhas

**Projeto:** `performance_produtos_academico`

Estamos realizando um experimento acadêmico para avaliar como diferentes estratégias de prompting influenciam a geração de testes de integração.

## Objetivo

Gere 8 casos de teste de integração utilizando uma estratégia de **prompt estruturado por estados, dependências e efeitos colaterais**.

O foco é verificar a consistência do sistema quando diferentes operações modificam ou consultam os mesmos dados.

## Contexto técnico

A aplicação utiliza FastAPI, PostgreSQL, pandas e pytest.

O fluxo de integração envolve autenticação, análise de XLSX, prévia persistida, confirmação, substituição transacional, auditoria e consultas analíticas.

Consulte os contratos reais do projeto.

## Procedimento de análise

Antes de apresentar os casos, organize sua análise nas seguintes etapas:

1. Identifique quais operações criam, modificam, consultam ou excluem dados.
2. Mapeie as dependências entre prévias, dados confirmados, auditoria e consultas.
3. Identifique situações em que uma operação seja repetida, cancelada ou interrompida.
4. Considere falhas ocorridas entre operações de uma mesma transação.
5. Avalie se diferentes ordens de execução podem produzir comportamentos inconsistentes.
6. Defina quais invariantes de negócio e integridade devem ser preservadas.

Apresente somente um resumo objetivo desse mapeamento, sem necessidade de expor raciocínio interno detalhado.

## Geração dos casos

Gere exatamente 8 casos de integração.

Cada caso deve conter:

- Identificador B-EST-01 a B-EST-08.
- Cenário.
- Componentes integrados.
- Estado inicial.
- Sequência de operações.
- Estado final esperado.
- Dados sintéticos.
- Asserções sugeridas para pytest.
- Necessidade de PostgreSQL real ou possibilidade de simulação.
- Regra de integridade protegida.

Priorize efeitos sobre dados persistidos, operações repetidas, consistência temporal e recuperação após falhas.

Não invente funcionalidades ou garantias de concorrência que não estejam implementadas.

## Registro

Crie:

`docs/forum_integracao_genai/experimento_b_estados.md`

`docs/forum_integracao_genai/resultados_b_estados.md`

Registre integralmente o prompt, as condições da geração e os casos produzidos.

Preserve os resultados originais sem refinamento posterior.

## Restrições

- Não execute testes.
- Não estabeleça conexão com PostgreSQL.
- Não inicialize a aplicação.
- Não altere regras de negócio.
- Não implemente código Python.
- Não modifique os resultados do experimento A.
- Não crie commits.

Se o histórico da conversa já contiver resultados ou cenários anteriores, registre essa limitação metodológica. Não afirme independência experimental se ela não existir.

Ao concluir, informe a quantidade de casos, suas categorias e os arquivos criados. Aguarde novas instruções.
```
