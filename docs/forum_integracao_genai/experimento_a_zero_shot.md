# Fórum Unidade III — Experimento A: Zero-shot

## Identificação

- Projeto: `performance_produtos_academico`.
- Data: 23/10/2026, referência America/Sao_Paulo.
- Técnica: zero-shot contextualizada, com instrução e consulta aos contratos do projeto, sem fornecer exemplos de testes nesta etapa.
- Agente: Codex nesta conversa; identificador exato do modelo, temperatura e demais parâmetros de amostragem não disponibilizados para este registro.
- Produto: oito especificações textuais, registradas integralmente em [resultados_a_zero_shot.md](resultados_a_zero_shot.md).
- Execuções dos casos gerados: zero. Implementações Python: zero.

## Prompt utilizado — transcrição integral

```text
# Fórum Unidade III — Experimento A: Zero-shot

**Projeto:** `performance_produtos_academico`

Vamos iniciar o primeiro experimento acadêmico de geração de testes de integração com inteligência artificial generativa.

## Contexto

O projeto é uma aplicação Python com FastAPI, PostgreSQL, pandas e pytest.

O fluxo selecionado envolve:

1. Autenticação administrativa.
2. Upload e análise de planilha XLSX.
3. Persistência da prévia de importação.
4. Confirmação e substituição transacional dos registros.
5. Registro de auditoria.
6. Consulta analítica dos dados confirmados.

Consulte o código e a documentação para identificar os contratos existentes.

## Objetivo

Utilizando exclusivamente a técnica **zero-shot contextualizada**, gere 8 casos de teste de integração para o fluxo descrito.

Não utilize exemplos de casos de teste anteriores como referência para a geração. Baseie-se apenas no contexto técnico e nas regras do projeto.

Os testes devem contemplar comportamentos bem-sucedidos, entradas inválidas, controle de acesso, persistência e integridade.

## Formato obrigatório

Para cada caso gerado, apresente:

- Identificador.
- Cenário.
- Componentes integrados.
- Pré-condições.
- Dados de entrada sintéticos.
- Resultado esperado.
- Asserções sugeridas para pytest.
- Classificação do cenário.

Diferencie testes que exigem PostgreSQL real daqueles que podem utilizar componentes simulados.

Priorize testes que realmente atravessem fronteiras entre módulos. Evite classificar como integração testes que exercitam apenas uma função isolada.

## Registro do experimento

Crie exclusivamente os arquivos:

`docs/forum_integracao_genai/experimento_a_zero_shot.md`

`docs/forum_integracao_genai/resultados_a_zero_shot.md`

No primeiro arquivo, registre o prompt utilizado, sua técnica e as condições do experimento.

No segundo, registre integralmente os 8 casos gerados, preservando a resposta original da LLM.

Não reescreva ou melhore os casos após a geração.

## Restrições

- Não execute testes.
- Não estabeleça conexões com PostgreSQL.
- Não inicialize FastAPI.
- Não altere os módulos da aplicação.
- Não modifique o mecanismo de isolamento.
- Não implemente ainda os testes em Python.
- Não utilize os resultados de um futuro experimento few-shot.
- Não crie commits.

Ao concluir, apresente os arquivos criados e um resumo quantitativo dos casos gerados.

Aguarde novas instruções antes de qualquer implementação.
```

## Condições e fontes de contexto

A geração foi feita nesta conversa, a partir da leitura estática de código de
produção e documentação de contratos. Não foram abertos arquivos de testes,
resultados anteriores ou exemplos de casos como referência nesta etapa. Não
houve consulta a resultados few-shot, pesquisa externa, execução de aplicação,
importação de módulos Python, pytest ou conexão com PostgreSQL.

Fontes consultadas nesta etapa:

- `app/config.py`, `app/auth.py` e trechos de `app/core.py`.
- `app/routes/auth.py`, `app/routes/imports.py`, `app/routes/analytics.py` e trecho de `app/routes/admin.py`.
- `services/importer.py`, `services/audit.py`, `services/analytics_common.py`, `services/analytics_production.py` e trechos de `services/units.py`.
- `repo/database_data.py` e `repo/database_pending.py`.
- `docs/fluxo-importacao.md` e trechos de `docs/arquitetura.md`, `docs/regras-negocio.md` e `docs/isolamento-postgresql-testes.md`.

Os arquivos foram lidos do workspace atual, que já continha alterações locais.
O experimento não representa necessariamente o conteúdo de um commit isolado.
Somente os dois documentos desta etapa foram criados.

### Limite metodológico do histórico

A conversa já continha diagnóstico com cenários candidatos e trabalho anterior
de isolamento. Esse histórico não pode ser removido do contexto desta sessão.
Não foi utilizado como modelo de casos, mas não se pode alegar uma sessão nova
sem exposição anterior. O registro é de zero-shot contextualizada nesta etapa,
sem exemplos adicionais, e não de independência experimental absoluta. Esta
condição deve ser considerada na comparação acadêmica posterior.

## Procedimento de registro e limites

Os oito casos foram gerados diretamente no arquivo de resultados em uma única
gravação, sem etapa posterior de reescrita, refinamento ou melhoria. A verificação
posterior é apenas estrutural: existência dos dois arquivos, quantidade de casos
e campos obrigatórios. Eventuais defeitos encontrados posteriormente devem ser
registrados separadamente em outra etapa, preservando o texto original.

As asserções são sugestões textuais para uma implementação futura; os nomes
auxiliares não representam fixtures ou funções já implementadas. Resultados
esperados são oráculos derivados do código, não resultados observados.

Quatro casos exigem PostgreSQL real descartável para comprovar persistência e
transações. Quatro podem usar repositório simulado, mantendo integração entre
HTTP/middlewares e autenticação ou leitura/validação XLSX. Simulações não
comprovam comportamento do PostgreSQL.

Qualquer execução futura exige autorização e preparação do ambiente dedicado
conforme [o contrato de isolamento](../isolamento-postgresql-testes.md). Nenhum
banco foi preparado, acessado ou validado operacionalmente neste experimento.
