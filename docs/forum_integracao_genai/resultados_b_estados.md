# Resultados originais — Experimento B: estados e falhas

Geração documental em 23/10/2026 (America/Sao_Paulo). Exatamente oito casos propostos, não implementados e não executados. Prompt integral, condições e limitações metodológicas: [experimento_b_estados.md](experimento_b_estados.md). Esta é a saída original, sem refinamento posterior.

## Resumo objetivo do mapeamento

1. **Operações e efeitos:** login/logout alteram a sessão; análise lê XLSX com pandas, normaliza e salva payload em `importacoes_pendentes`; ao salvar, também exclui prévias com mais de 24 horas. Confirmação lê a prévia e os dados atuais do mês, substitui esse mês, grava evento quando já existiam dados e remove o token. Cancelamento exclui somente a prévia indicada. Limpeza exclui dados importados, logs de importação e todas as prévias, preservando cadastro e auditoria de unidades. Status, logs e acompanhamento consultam o armazenamento; consultas analíticas fazem transformações em memória.
2. **Dependências:** autenticação precede APIs; análise, confirmação e cancelamento exigem admin. A confirmação depende de token válido e prévia ainda utilizável. A auditoria compara a base existente no momento da confirmação com a entrada; a primeira inserção não cria evento. Consultas usam dados confirmados e cadastro com vigência aplicável, nunca o payload pendente. A origem CENTRAL/COOP de um PA é validada na análise e novamente na transação de confirmação.
3. **Repetição, cancelamento e interrupção:** token consumido não pode confirmar novamente; reanalisar o mesmo arquivo cria outro token e permite nova substituição. Cancelar token inexistente ou já cancelado é aceito; token malformado no cancelamento também resulta em sucesso sem remoção. Prévia antiga é recusada na leitura mesmo antes da exclusão física. Se houver commit e perda da resposta, repetir o token resulta em 422, sem mecanismo de recuperação da resposta original.
4. **Falhas transacionais:** exclusão do mês, inserções, verificação de quantidade, evento de auditoria, exclusão do token e contagem final pertencem à mesma transação do repositório. Exceção antes do commit deve desfazer seus efeitos. A análise/salvamento da prévia ocorreu em transação anterior; o rollback da confirmação deve preservar essa prévia.
5. **Ordens de execução:** duas prévias do mesmo mês podem coexistir; o indicador `period_already_exists` é uma fotografia da análise. Em confirmações sequenciais, a segunda lê o estado deixado pela primeira e pode sobrescrevê-lo, inclusive com conteúdo mais antigo. O `Lock` do importador é local ao processo; existe advisory lock na validação de origens, mas não se deduz dele proteção geral de snapshot, detecção de prévia obsoleta ou garantia de concorrência entre processos. Os casos não exercitam execução simultânea. Nas consultas de saldo, o mês de referência vem de `MÊS/ANO`, não da ordem de importação.
6. **Invariantes:** uma linha por CENTRAL/COOP/PA/ID_PRODUTO/mês; um mês por XLSX; substituição restrita ao mês; dados e evento coerentes; consumo da prévia somente junto ao sucesso; preservação integral no rollback; consulta sem efeito de escrita; validade de prévia respeitada; elegibilidade e origem de unidades consistentes. Idempotência de efeitos do token consumido não significa resposta HTTP idempotente nem deduplicação global de arquivos.

## Convenções e dados comuns

Os passos HTTP usam os contratos reais: `POST /login`; `POST /api/importacoes/analisar` com multipart `file`; `POST /api/importacoes/confirmar` com form `token` e `file_name`; `POST /api/importacoes/cancelar` com form `token`; `GET /api/logs`; `GET /api/base/status`; `GET /api/acompanhamento/producao-acumulada`. Login válido redireciona com 303; nas verificações desse status, desabilitar seguimento automático de redirects. A validação externa do JWT pode ser simulada na fronteira de `app.routes.auth.verificar_token`, mantendo reais o endpoint, cookie, middleware e autorização. Não atribuir formato de JWT válido às strings sintéticas sem preparar essa fronteira.

Cada caso começa isolado dos demais. Na futura execução com banco, usar banco descartável isolado segundo `tests/conftest.py`, nunca a base configurada de uso. A preparação do cadastro deve criar PAs `01` e `02`, CENTRAL `Central Sintética`, COOP `0001`, nomes `Agência Sintética 01/02`, classificação `unidade_real`, ativa verdadeira, vigência inicial `2026-01-01`. Usar o contrato de `services.units.save_unit` com operador `admin@sintetico.invalid`. A auditoria desse cadastro fica em tabelas distintas; contagens de eventos abaixo referem-se somente a `logs_alteracoes`. Nenhuma preparação foi executada nesta geração.

Cada XLSX tem as 16 colunas de `EXPECTED_COLUMNS`: `CENTRAL`, `COOP`, `PA`, `PRODUTO`, `ID_PRODUTO`, `META_MENSAL`, `PRODUCAO_MENSAL`, `META_TRIMESTRAL`, `PRODUCAO_TRIMESTRAL`, `META_SEMESTRAL`, `PRODUCAO_SEMESTRAL`, `META_ANUAL`, `PRODUCAO_ANUAL`, `META_NO_PERIODO`, `PRODUCAO_NO_PERIODO`, `MÊS/ANO`. Textos de códigos são células de texto. Toda coluna numérica não indicada vale 0; CENTRAL e COOP seguem o cadastro. As planilhas sintéticas são especificações para futura preparação, não arquivos gerados nesta entrega.

| Conjunto | Mês e linhas: PA / ID_PRODUTO / PRODUTO / meta mensal / produção mensal / meta anual / produção anual |
| --- | --- |
| J | 01/2026: `01 / P001 / COBRANCA / 100 / 80 / 1200 / 80`; `01 / P002 / CREDITO_PESSOAL / 50 / 45 / 600 / 90` |
| F | 02/2026: `01 / P001 / COBRANCA / 100 / 120 / 1200 / 200`; `01 / P002 / CREDITO_PESSOAL / 60 / 55 / 660 / 105` |
| F2 | Igual a F, alterando somente `PRODUCAO_MENSAL` de P001 de 120 para 150 |
| F3 | Igual a F, alterando somente `PRODUCAO_MENSAL` de P001 de 120 para 170 |
| S | 02/2026: linha P001 de F2; retira P002; inclui `02 / P003 / CONSORCIOS / 30 / 40 / 360 / 40` |

Arquivos: `janeiro.xlsx`, `fevereiro.xlsx`, `fevereiro_v2.xlsx`, `fevereiro_v3.xlsx` e `substituicao.xlsx`, respectivamente. Na leitura direta de dados, comparar linhas ordenadas pela chave natural; incluir metadados quando o passo exigir preservação integral. Na comparação entre novas importações do mesmo conteúdo, distinguir valores de negócio e `_REGISTRO_ID` dos metadados de origem e instante, que podem mudar.

As expressões de asserção a seguir são sugestões documentais para pytest. Nomes como `resposta`, `evento`, `antes`, `depois`, `produto` e `pendentes` designam valores a coletar futuramente; não são fixtures existentes nem código implementado. `pd.testing.assert_frame_equal` pressupõe ordenação, índices e tipos normalizados. Consultas analíticas usam `pa=01`, `escopo=GERAL`, `inicio=2026-01`, `fim=2026-02`, salvo indicação distinta. A simulação de repositório não comprova constraints, JSONB, prazo SQL ou atomicidade do PostgreSQL.

## B-EST-01 — Sessão, autorização e prévia sem publicação prematura

- **Cenário:** proteger mutações por perfil e separar prévia persistida dos dados consultáveis.
- **Componentes integrados:** login/sessão, middleware FastAPI, autorização admin, rotas de importação, pandas/openpyxl, repositório de prévias/dados, cadastro e consulta analítica.
- **Estado inicial:** J confirmado, sem eventos de alteração e sem prévias; cadastro comum preparado. Clientes separados sem sessão, leitor e admin.
- **Sequência de operações:**
  1. Cliente anônimo tenta analisar F: esperar 401. Autenticar leitor por `POST /login`, com identidade sintética de perfil sem privilégio admin, e tentar análise: esperar 403. Verificar armazenamento intacto após cada recusa.
  2. Autenticar admin com `perfil=admin`, analisar F e obter token T; verificar HTTP 200, duas linhas e `period_already_exists=false`.
  3. Consultar produção de janeiro: COBRANCA continua 80; confirmar que fevereiro ainda não está em `load_product_data`.
  4. Leitor tenta confirmar e cancelar T: ambos 403, T continua disponível. Admin confirma T com `file_name=fevereiro.xlsx` e repete a consulta incluindo fevereiro.
- **Estado final esperado:** J e F confirmados, quatro linhas; nenhuma prévia T; nenhum evento de alteração pela primeira inserção de fevereiro. COBRANCA acumulada mensal = 200; dados e consultas não foram afetados pelas recusas nem pela mera análise.
- **Dados sintéticos:** J e F; identidades `admin@sintetico.invalid`, `leitor@sintetico.invalid`, com perfis `admin` e `leitor`; strings de autenticação somente com fronteira de validação preparada.
- **Asserções sugeridas para pytest:** `assert anonima.status_code == 401`; `assert recusada.status_code == 403`; `assert analise.json()['rows'] == 2`; `assert analise.json()['period_already_exists'] is False`; `assert len(database.load_pending_import(T)) == 2`; após confirmação, `assert resposta.json()['action'] == 'inserted'`, `assert resposta.json()['total_rows'] == 4`, `assert database.load_pending_import(T).empty`, `assert database.load_log_events() == []` e `assert produto['producao_acumulada'] == pytest.approx(200)`. Nas recusas, comparar snapshots completos de dados, logs e payload T.
- **PostgreSQL real ou simulação:** simulação permite integrar sessão, parser e serviços; PostgreSQL real é necessário para comprovar persistência entre conexões e armazenamento da prévia. Validação JWT pode ser simulada sem substituir a autorização.
- **Regra de integridade protegida:** apenas admin modifica importações; prévia não publica fatos; confirmação bem-sucedida insere o mês e consome o token em conjunto.

## B-EST-02 — Cancelamento repetido e tentativa de confirmação posterior

- **Cenário:** cancelar uma substituição pendente sem perder a base atual nem outra prévia.
- **Componentes integrados:** sessão admin, rotas de análise/cancelamento/confirmação, pandas, prévias persistidas, dados, auditoria e consulta analítica.
- **Estado inicial:** J e F confirmados; zero eventos de alteração; duas prévias recém-criadas: T2 para F2 e T3 para F3.
- **Sequência de operações:**
  1. Capturar dados, logs, resultado analítico e payload T3. Cancelar T2: HTTP 200 e `cancelled=true`.
  2. Cancelar T2 novamente: HTTP 200 e mesmo corpo.
  3. Tentar confirmar T2: HTTP 422 indicando prévia expirada ou já processada.
  4. Reconsultar dados, logs, prévias e análise. Não confirmar T3.
- **Estado final esperado:** J e F exatamente preservados, inclusive metadados; T2 ausente e T3 inalterada; zero eventos; COBRANCA mensal acumulada = 200.
- **Dados sintéticos:** J, F, F2 e F3; dois tokens distintos de 32 caracteres hexadecimais retornados pela análise.
- **Asserções sugeridas para pytest:** `assert cancelamento.json() == {'cancelled': True}` nas duas respostas; `assert confirmacao.status_code == 422`; `assert database.load_pending_import(T2).empty`; `assert len(database.load_pending_import(T3)) == 2`; `pd.testing.assert_frame_equal(antes, depois)` nos dados e em T3; `assert logs_depois == logs_antes`; `assert analitico_depois == analitico_antes`.
- **PostgreSQL real ou simulação:** double com armazenamento separado por token permite verificar a orquestração; PostgreSQL real comprova a exclusão apenas do token escolhido e sua persistência entre requisições.
- **Regra de integridade protegida:** cancelamento tem efeito restrito à prévia indicada e repetição não altera dados confirmados nem consome prévias independentes.

## B-EST-03 — Resposta perdida após commit, repetição do token e reanálise idêntica

- **Cenário:** distinguir repetição do token consumido de uma nova importação do mesmo conteúdo.
- **Componentes integrados:** rotas HTTP, serviço de confirmação, hash de linha, transação de dados/prévia, auditoria e logs administrativos.
- **Estado inicial:** somente J confirmado e token T para F; nenhum evento de alteração.
- **Sequência de operações:**
  1. Confirmar T até o término bem-sucedido da transação. Descartar a resposta no lado cliente para representar perda de conhecimento do resultado após commit, sem alegar falha real de rede provocada.
  2. Consultar status e dados por outra conexão: F já existe e T foi removido. Reenviar a confirmação de T: HTTP 422. Comparar o snapshot antes/depois dessa repetição.
  3. Reanalisar exatamente os bytes de F: novo token U, `period_already_exists=true`. Confirmar U com o mesmo nome de arquivo.
  4. Consultar logs e dados, separando colunas de negócio dos metadados de importação.
- **Estado final esperado:** quatro linhas; a repetição de T não altera nada. A confirmação de U é `updated`, com zero incluídas/alteradas/removidas e um evento de resumo sem mudanças. O hash das linhas de F permanece igual; o instante de importação pode mudar. O evento existe mesmo com `changes=[]`.
- **Dados sintéticos:** J e os mesmos bytes de `fevereiro.xlsx` em duas análises; T e U distintos. Nenhuma chave de idempotência adicional.
- **Asserções sugeridas para pytest:** `assert repetida.status_code == 422`; comparar snapshot integral após a repetição de T; `assert U != T`; `assert nova_confirmacao.json()['action'] == 'updated'`; `assert nova_confirmacao.json()['changed_rows'] == 0`; `assert nova_confirmacao.json()['duplicate_rows'] == 0`; `assert len(eventos) == 1`; `assert eventos[0]['changes'] == []`; `assert eventos[0]['summary']['included'] == 0`; `assert eventos[0]['summary']['updated'] == 0`; `assert eventos[0]['summary']['removed'] == 0`; `assert logs['summary']['updates'] == 1`; `assert logs['summary']['changes'] == 0`; comparar hashes e valores de negócio; T e U ausentes.
- **PostgreSQL real ou simulação:** simulação cobre a distinção semântica; banco real comprova o commit observado por conexão posterior e o evento JSONB sem mudanças. O descarte da resposta é uma condição do cliente, não um teste de infraestrutura de rede.
- **Regra de integridade protegida:** token consumido não reaplica dados; nova análise permite substituição sem duplicar a chave natural. A auditoria representa a substituição, ainda que nenhuma coluna auditável tenha mudado.

## B-EST-04 — Substituição integral do mês com inclusão, alteração e remoção auditadas

- **Cenário:** atualizar parte de um mês, retirar uma linha e acrescentar outra, preservando o mês vizinho.
- **Componentes integrados:** análise XLSX, confirmação, chave natural PostgreSQL, comparação de auditoria, transação, logs e produção acumulada.
- **Estado inicial:** J e F confirmados, quatro linhas, nenhum evento de alteração. Prévia TS de S, com `period_already_exists=true`.
- **Sequência de operações:**
  1. Salvar snapshot integral de J e confirmar TS.
  2. Ler fevereiro diretamente: P001 com produção 150, P002 ausente, P003 no PA 02 com produção 40.
  3. Consultar `/api/logs` e comparar evento, resumo e valores antes/depois com os dados persistidos.
  4. Consultar COBRANCA do PA 01 em janeiro–fevereiro e reler J.
- **Estado final esperado:** quatro linhas totais; duas linhas em fevereiro, exatamente S; J preservado. Um evento de fevereiro com uma inclusão, uma alteração e uma remoção; token consumido. COBRANCA mensal acumulada = 230.
- **Dados sintéticos:** J, F e S. Para P001, somente `PRODUCAO_MENSAL` muda de 120 para 150; P002 removido e P003 incluído têm chaves distintas.
- **Asserções sugeridas para pytest:** `assert resposta.json()['action'] == 'updated'`; `assert resposta.json()['inserted_rows'] == 1`; `assert resposta.json()['updated_rows'] == 1`; `assert resposta.json()['removed_rows'] == 1`; `assert resposta.json()['changed_rows'] == 3`; `assert resposta.json()['total_rows'] == 4`; `assert evento['summary']['previous_rows'] == 2`; `assert evento['summary']['current_rows'] == 2`; `assert alteracao['changed_fields'] == ['PRODUCAO_MENSAL']`; `assert alteracao['before']['PRODUCAO_MENSAL'] == 120`; `assert alteracao['after']['PRODUCAO_MENSAL'] == 150`; comparar os tipos das mudanças com `{'INCLUIDO', 'ATUALIZADO', 'REMOVIDO'}` e identificar cada uma por PA/ID; verificar chave natural sem duplicatas, TS ausente e `pd.testing.assert_frame_equal(janeiro_antes, janeiro_depois)`.
- **PostgreSQL real ou simulação:** simulação verifica comparação e resumos; banco real é necessário para validar DELETE/INSERT, chave primária, persistência do evento e exclusão do token na mesma transação.
- **Regra de integridade protegida:** substituição equivale ao conjunto recebido daquele mês, sem acumular linhas antigas nem afetar outros meses; auditoria descreve exatamente o delta de negócio.

## B-EST-05 — Prévia expirada: recusa lógica, remoção física e recuperação por nova análise

- **Cenário:** interromper o fluxo após a análise por mais de 24 horas e retomá-lo sem confirmar payload expirado.
- **Componentes integrados:** prévia JSONB e `created_at`, relógio SQL PostgreSQL, confirmação HTTP, limpeza oportunista no salvamento, dados, logs e análise XLSX.
- **Estado inicial:** J e F confirmados; zero eventos; prévia T de F2. Em preparação futura exclusivamente no banco descartável, ajustar `created_at` de T para `NOW() - INTERVAL '25 hours'`; criar também prévia V recente de F3. Não esperar 24 horas de relógio real.
- **Sequência de operações:**
  1. Consultar fisicamente a linha de T: ainda existe. Tentar confirmar T: HTTP 422; a leitura de prévia deve retornar frame vazio.
  2. Verificar que a confirmação recusada não excluiu fisicamente T nem alterou a base ou os logs.
  3. Analisar F2 novamente, produzindo U recente: o salvamento limpa T por idade. Verificar que V e U continuam disponíveis.
  4. Confirmar U e consultar base e auditoria; deixar V pendente.
- **Estado final esperado:** fevereiro = F2; J intacto; um evento com uma alteração; T removido pela nova análise, U consumido pela confirmação, V preservado. Antes da etapa 3, T contava como linha física, embora não fosse utilizável.
- **Dados sintéticos:** J, F, F2 e F3; idade de T de 25 horas, V e U criadas no instante da execução futura. Evitar o limite exato de 24 horas para não depender da duração entre transações.
- **Asserções sugeridas para pytest:** `assert expirado.status_code == 422`; `assert database.load_pending_import(T).empty`; verificar por SELECT direto que T existe antes da nova análise e não existe depois; `assert database.count_pending_imports() == 2` após criação de U e antes de confirmá-la (U e V); `assert database.count_pending_imports() == 1` depois; `assert len(database.load_pending_import(V)) == 2`; `assert resposta.json()['updated_rows'] == 1`; comparar base e logs antes/depois da recusa; conferir `before=120` e `after=150` no evento final.
- **PostgreSQL real ou simulação:** PostgreSQL real necessário para comprovar `NOW()`, filtro de validade e limpeza SQL. Um double temporal pode verificar a orquestração, mas o `MemoryStorage` existente não implementa prazo nem `created_at` e não demonstra essa regra.
- **Regra de integridade protegida:** prévia vencida não modifica a base; expiração lógica independe da limpeza física, e a limpeza preserva prévias recentes.

## B-EST-06 — Falha depois de excluir o mês, antes de inserir sua substituição

- **Cenário:** recuperar a base anterior quando a confirmação falha entre DELETE e INSERT.
- **Componentes integrados:** rota de confirmação, importador, `repo.database_data.replace_period_data`, conexão psycopg real, dados, auditoria, prévia e consulta analítica.
- **Estado inicial:** J e F confirmados; zero eventos; T para S; snapshots completos dos dados, metadados, logs, payload T e resultado analítico.
- **Sequência de operações:**
  1. Na execução futura, preparar injeção pontual de exceção no cursor da transação real: executar o DELETE de fevereiro e, antes do primeiro INSERT de dados, lançar exceção. Manter reais a conexão e a saída por exceção de seu contexto; não substituir `replace_period_data` por um mock que falha antes de escrever.
  2. Confirmar T: HTTP 422 com mensagem de atualização segura/base anterior preservada.
  3. Por nova conexão, verificar restauração integral de F e J, ausência de novo evento e presença integral de T. Repetir a consulta analítica.
  4. Remover a injeção e confirmar o mesmo T, ainda dentro do prazo; verificar sucesso e delta de S.
- **Estado final esperado:** imediatamente após a falha, estado persistido idêntico ao inicial e COBRANCA acumulada 200. Após a recuperação, J + S, quatro linhas, um evento com três mudanças e T ausente. Não há mês vazio persistido entre tentativas concluídas.
- **Dados sintéticos:** J, F e S; falha sintética única após DELETE de `mes_ano=2026-02-01`, sem encerrar o processo nem derrubar o servidor.
- **Asserções sugeridas para pytest:** `assert falha.status_code == 422`; `assert 'A base anterior foi preservada.' in falha.json()['detail']`; `pd.testing.assert_frame_equal(antes, depois_da_falha)` incluindo metadados; `assert eventos_depois_da_falha == eventos_antes`; comparar payload T antes/depois da falha; `assert analitico_depois_da_falha == analitico_antes`; após retry, `assert sucesso.status_code == 200`, `assert sucesso.json()['changed_rows'] == 3`, `assert len(database.load_log_events()) == 1` e `assert database.load_pending_import(T).empty`.
- **PostgreSQL real ou simulação:** PostgreSQL real indispensável para evidenciar rollback de um DELETE já executado. Um mock de alto nível só comprovaria tradução de exceção em erro HTTP. A instrumentação é proposta para teste futuro, sem alterar regras de produção.
- **Regra de integridade protegida:** uma substituição incompleta não apaga dados confirmados, não publica auditoria e não consome a prévia necessária à recuperação.

## B-EST-07 — Falha tardia após auditoria e exclusão do token, antes do commit

- **Cenário:** provar que dados, auditoria e consumo da prévia retrocedem juntos mesmo quando todas as mutações já ocorreram na transação.
- **Componentes integrados:** confirmação HTTP, comparação de auditoria, inserção JSONB de log, exclusão de prévia, contagem final e contexto transacional psycopg.
- **Estado inicial:** J e F confirmados; zero eventos; token T de F2; snapshots completos dos dados, logs, payload e `created_at` de T.
- **Sequência de operações:**
  1. Na execução futura, instrumentar somente a confirmação com conexão PostgreSQL real. Deixar concluir DELETE/INSERT dos dados, `_insert_log` e DELETE de T. Após executar a contagem final global de dados, lançar exceção antes de o contexto `_connection` concluir o commit. Registrar no instrumento que o log e a exclusão de T foram efetivamente executados, sem provocar commit intermediário.
  2. Confirmar T e esperar HTTP 422; consultar tudo em conexão posterior ao rollback.
  3. Remover a injeção e repetir a confirmação de T, ainda válido. Consultar o evento persistido e os dados.
- **Estado final esperado:** após falha, fevereiro ainda F, nenhum evento persistido e T com payload e `created_at` originais. Após retry, fevereiro F2, exatamente um evento com `PRODUCAO_MENSAL: 120 → 150`, T ausente, janeiro intacto. O evento construído na tentativa revertida não deve aparecer nos logs; não se exige reutilizar seu UUID no retry.
- **Dados sintéticos:** J, F e F2; exceção sintética única após a última consulta de contagem, antes de commit. Não simular perda de conexão durante o commit, cujo resultado poderia ser desconhecido pelo cliente.
- **Asserções sugeridas para pytest:** `assert falha.status_code == 422`; conferir marcadores da instrumentação para execução prévia do INSERT de log e DELETE de T; `pd.testing.assert_frame_equal(antes, depois_da_falha)`; `assert database.load_log_events() == []`; comparar payload e `created_at` por SELECT direto; após retry, `assert sucesso.json()['updated_rows'] == 1`, `assert sucesso.json()['changed_rows'] == 1`, `assert len(eventos_finais) == 1`, `assert eventos_finais[0]['changes'][0]['before']['PRODUCAO_MENSAL'] == 120`, `assert eventos_finais[0]['changes'][0]['after']['PRODUCAO_MENSAL'] == 150` e `assert database.load_pending_import(T).empty`.
- **PostgreSQL real ou simulação:** PostgreSQL real indispensável para comprovar rollback conjunto de alterações já enviadas ao servidor. Doubles podem verificar o caminho de erro, mas não comprovam atomicidade. Injeção deve permitir que a exceção atravesse o contexto transacional real.
- **Regra de integridade protegida:** não existe atualização confirmada sem seu evento, nem evento persistido de atualização revertida; remoção da prévia só se torna durável junto ao commit completo.

## B-EST-08 — Duas prévias do mesmo mês e referência temporal independente da ordem de importação

- **Cenário:** confirmar duas versões sequencialmente e importar janeiro por último, distinguindo ordem de gravação e ordem dos meses.
- **Componentes integrados:** análise e prévias independentes, confirmação, leitura da base atual, auditoria, cadastro vigente, produção acumulada mensal e anual.
- **Estado inicial:** dados e logs vazios; cadastro comum pronto. Analisar F2 e depois F3, obtendo T2 e T3, ambos com `period_already_exists=false`. Não confirmar ainda.
- **Sequência de operações:**
  1. Confirmar T3 primeiro: fevereiro = F3, ação `inserted`, zero eventos; T2 permanece disponível.
  2. Confirmar T2 depois: ação `updated`, fevereiro = F2; auditar P001 de 170 para 150, embora o indicador original de T2 dissesse que o período não existia. A prévia mais antiga não é recusada por obsolescência.
  3. Analisar e confirmar J por último: janeiro inserido, sem novo evento de alteração.
  4. Consultar `producao-acumulada` do PA 01 em janeiro–fevereiro com `base_calculo=MENSAL` e novamente com `base_calculo=ANUAL`; consultar também os períodos e conferir a base após as leituras.
- **Estado final esperado:** J + F2, quatro linhas, um evento de fevereiro, T2 e T3 consumidos. Em MENSAL: COBRANCA soma 80 + 150 = 230; CREDITO_PESSOAL usa o último saldo anual de fevereiro (meta 660, produção 105), sem somar 90 + 105. Em ANUAL: COBRANCA usa meta 1200 e produção 200 de fevereiro. Referência mais recente = `2026-02`, mesmo com janeiro gravado por último. As consultas não alteram fatos ou logs.
- **Dados sintéticos:** F2, F3 e J; dois tokens diferentes criados antes de qualquer confirmação. As operações são estritamente sequenciais, no mesmo ambiente; não há threads nem requisições concorrentes.
- **Asserções sugeridas para pytest:** `assert analise2.json()['period_already_exists'] is False` e o mesmo para analise3; `assert primeira.json()['action'] == 'inserted'`; depois da primeira, `assert len(database.load_pending_import(T2)) == 2`; `assert segunda.json()['action'] == 'updated'`; `assert segunda.json()['updated_rows'] == 1`; `assert evento['changes'][0]['before']['PRODUCAO_MENSAL'] == 170`; `assert evento['changes'][0]['after']['PRODUCAO_MENSAL'] == 150`; `assert cobranca_mensal['producao_acumulada'] == pytest.approx(230)`; `assert credito_mensal['producao_acumulada'] == pytest.approx(105)`; `assert credito_mensal['meta_acumulada'] == pytest.approx(660)`; `assert credito_mensal['regra_calculo'] == 'ultimo_saldo_anual'`; `assert credito_mensal['periodo_referencia'] == '2026-02'`; `assert cobranca_anual['producao_acumulada'] == pytest.approx(200)`; conferir períodos `['2026-01', '2026-02']`, ausência dos tokens e snapshots iguais antes/depois das consultas.
- **PostgreSQL real ou simulação:** double pode integrar parser, duas prévias, confirmação e fórmulas; PostgreSQL real comprova os estados duráveis e logs após cada commit. Não conclui segurança de concorrência entre workers nem detecção de atualização perdida.
- **Regra de integridade protegida:** confirmação usa a base atual para decidir ação/auditoria; a substituição sequencial respeita a última confirmação, enquanto a referência analítica respeita o mês dos dados. A ausência de rejeição de prévia obsoleta é um comportamento observado no código, não uma garantia adicional.

## Classificação da saída

| Caso | Categoria principal |
| --- | --- |
| B-EST-01 | Autenticação, autorização e isolamento da prévia |
| B-EST-02 | Cancelamento repetido e preservação de estados independentes |
| B-EST-03 | Repetição após commit e reimportação idêntica |
| B-EST-04 | Substituição mensal e auditoria do delta |
| B-EST-05 | Expiração temporal, limpeza e retomada |
| B-EST-06 | Rollback entre exclusão e inserção, com recuperação |
| B-EST-07 | Rollback tardio de dados, log e token, com recuperação |
| B-EST-08 | Ordem sequencial de confirmações e consistência temporal analítica |

Não há resultados de execução, métricas de aprovação ou evidência empírica de rollback nesta entrega. Os estados esperados são derivados dos contratos lidos. As condições de exposição a cenários anteriores estão registradas no documento do experimento; não se afirma independência experimental.
