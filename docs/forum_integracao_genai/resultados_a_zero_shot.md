# Experimento A — Resposta original: oito casos de integração

Data: 23/10/2026. Técnica: zero-shot contextualizada. Estado: casos gerados, não
implementados e não executados. Este documento contém a primeira versão integral
da geração; não houve refinamento posterior.

## Convenções comuns da especificação

Todos os dados são sintéticos. Cada caso tem preparação independente e não depende
de outro caso. Nas execuções futuras, o ambiente deve estar isolado antes de
importar/inicializar a aplicação. Casos reais exigem banco descartável autorizado
`performance_test_<uuid>`, IP loopback e contas de teste separadas, conforme o
contrato existente. Casos simulados devem substituir a inicialização do banco e
usar sentinela para impedir acesso real; não basta simular apenas uma consulta.

As requisições devem atravessar a aplicação ASGI e seus middlewares, sem chamar
diretamente apenas a função de rota. O cliente deve preservar cookies e permitir
desabilitar redirecionamentos. Nenhum cliente, servidor ou lifespan é executado
nesta etapa documental.

Para login, configurar explicitamente ambiente de desenvolvimento, algoritmo
HS256, segredo e segredo de sessão sintéticos; não passar `--development`, evitando
bypass. Um JWT válido tem `email=admin31@example.test`, `uid=admin31`,
`perfil=admin`, `tipo=login` e expiração futura calculada em relação ao relógio da
execução. O login usa `POST /login` com JSON contendo `token`. A API de importação
usa cookie da sessão, não Bearer como substituto da sessão.

Para as planilhas válidas, todas as 16 colunas de `EXPECTED_COLUMNS` devem existir:
`CENTRAL`, `COOP`, `PA`, `PRODUTO`, `ID_PRODUTO`, `META_MENSAL`,
`PRODUCAO_MENSAL`, `META_TRIMESTRAL`, `PRODUCAO_TRIMESTRAL`, `META_SEMESTRAL`,
`PRODUCAO_SEMESTRAL`, `META_ANUAL`, `PRODUCAO_ANUAL`, `META_NO_PERIODO`,
`PRODUCAO_NO_PERIODO`, `MÊS/ANO`.

Uma linha sintética de referência tem CENTRAL `CENTRAL_TESTE_Z`, COOP `0031`, PA
`31`, PRODUTO e ID_PRODUTO `COBRANCA`, mês `04/2026`, meta mensal 80, produção
mensal 100, meta anual 960 e produção anual 100. Os demais campos numéricos são
zero, salvo substituição explícita no caso. Identificadores devem ser escritos
como texto no XLSX. Usar uma única aba e enviar bytes do XLSX como multipart no
campo `file`.

Quando necessário, preparar cadastro sintético do PA `31`, mesma CENTRAL/COOP,
nome `Unidade Teste 31`, classificação `unidade_real`, ativa e início de vigência
`2026-01-01`. Cadastro/vigência não são criados automaticamente pela importação.

As asserções sugeridas abaixo usam nomes descritivos para respostas, snapshots,
linhas e mocks a serem definidos futuramente; não são código de teste implementado
nem declaração de fixtures existentes. Comparações de snapshots consideram
conteúdo completo ordenado por chave, sem depender da ordem incidental do SQL.

## A-ZS-01 — Primeira importação com normalização e consulta confirmada

- **Identificador:** A-ZS-01.
- **Cenário:** autenticar administrador, analisar XLSX, confirmar a primeira carga e consultar o resultado persistido.
- **Componentes integrados:** rota de login, PyJWT, sessão, middleware, rotas de importação, pandas/openpyxl, serviço importador, cadastro de unidades, repositórios de prévias/dados/logs, PostgreSQL e serviço/rota analítica.
- **Pré-condições:** banco descartável sem dados importados, prévias ou logs de importação; cadastro do PA `31` vigente; configuração sintética de login; nenhum mock de persistência ou cálculo. Inicialização somente após bootstrap de isolamento.
- **Dados de entrada sintéticos:** `abril_normalizado.xlsx` com a linha de referência, substituindo META_MENSAL por texto `80,00`, PRODUCAO_MENSAL por texto `100,00` e META_TRIMESTRAL por célula vazia. Login administrativo comum. Confirmação via formulário com token retornado e `file_name=abril_normalizado.xlsx`. Consulta `GET /api/acompanhamento/producao-acumulada?inicio=2026-04&fim=2026-04&pa=31&base_calculo=NO_PERIODO&escopo=GERAL`.
- **Resultado esperado:** login 303 com cookie; análise 200, mês ISO `2026-04-01`, uma linha, valores 80/100/0 normalizados, contagem de um vazio preenchido e dois números textuais convertidos, sem avisos cadastrais. Antes de confirmar, uma prévia existe e `dados` continua vazia. Confirmação 200 com ação `inserted`, uma inclusão e total global um; token é consumido e não há evento de diferenças na primeira carga. Consulta 200 retorna meta 80, produção 100, gap 20, atingimento 125% e status `aderente`.
- **Asserções sugeridas para pytest:** `assert login.status_code == 303`; `assert cookie_de_sessao_presente`; `assert analise.status_code == 200`; `assert previa['period_iso'] == '2026-04-01'`; `assert previa['blank_values_filled'] == 1`; `assert previa['text_numbers_converted'] == 2`; `assert previa['unit_warnings'] == []`; conferir prévia por conexão nova antes de confirmar; `assert resultado['action'] == 'inserted'`; `assert resultado['inserted_rows'] == resultado['total_rows'] == 1`; `assert resultado['log_file'] is None`; `assert quantidade_logs_importacao == 0`; `assert token_ausente_no_banco`; `assert produto['meta_acumulada'] == pytest.approx(80)`; `assert produto['producao_acumulada'] == pytest.approx(100)`; `assert produto['gap'] == pytest.approx(20)`; `assert produto['percentual_atingido'] == pytest.approx(125)`; `assert produto['status'] == 'aderente'`; conferir hash hexadecimal com 64 caracteres, arquivo de origem e horário persistidos.
- **Classificação do cenário:** positivo; integração completa HTTP–serviços–PostgreSQL; normalização, persistência e consistência analítica. **Exige PostgreSQL real descartável.**
- **Fundamentação:** `app/routes/auth.py:52–64`; `app/routes/imports.py:19–58`; `services/importer.py:172–256,267–333`; `repo/database_pending.py:14–59`; `services/analytics_production.py:101–183`.

## A-ZS-02 — Prévia de substituição cancelada não altera resultados confirmados

- **Identificador:** A-ZS-02.
- **Cenário:** analisar correção de um mês existente, consultar antes da confirmação, cancelar e tentar confirmar o token cancelado.
- **Componentes integrados:** sessão administrativa, rotas de análise/cancelamento/confirmação, importador, prévias JSONB, leitura de dados confirmados, PostgreSQL e consulta analítica.
- **Pré-condições:** banco descartável com cadastro vigente e uma importação de abril confirmada pelo fluxo HTTP, meta mensal 10 e produção 8; nenhuma prévia pendente ou log de diferenças; armazenar snapshots dos dados e logs após essa preparação.
- **Dados de entrada sintéticos:** `abril_rascunho.xlsx` com a linha de referência, meta mensal 99 e produção 120. Analisar; consultar o PA `31` em abril com `base_calculo=NO_PERIODO`; cancelar por `POST /api/importacoes/cancelar` com formulário `token`; tentar confirmar o mesmo token e nome de arquivo.
- **Resultado esperado:** análise 200 com `period_already_exists=true`; prévia contém 99/120, mas consulta continua retornando 10/8. Cancelamento 200 com `cancelled=true` remove a prévia. Confirmação subsequente retorna 422 por prévia ausente/processada. Dados e logs de importação permanecem iguais aos snapshots e consulta continua com produção 8.
- **Asserções sugeridas para pytest:** `assert analise.status_code == 200`; `assert previa['period_already_exists'] is True`; `assert previa_persistida['PRODUCAO_MENSAL'] == pytest.approx(120)`; `assert produto_antes_do_cancelamento['producao_acumulada'] == pytest.approx(8)`; `assert cancelamento.status_code == 200`; `assert cancelamento.json() == {'cancelled': True}`; `assert token_ausente_no_banco`; `assert confirmacao_tardia.status_code == 422`; `assert snapshot_dados_depois == snapshot_dados_antes`; `assert snapshot_logs_depois == snapshot_logs_antes`; `assert produto_depois['meta_acumulada'] == pytest.approx(10)`; `assert produto_depois['producao_acumulada'] == pytest.approx(8)`.
- **Classificação do cenário:** positivo de cancelamento com confirmação negativa posterior; integração HTTP–serviços–PostgreSQL; separação entre prévia e base confirmada. **Exige PostgreSQL real descartável.**
- **Fundamentação:** `services/importer.py:229–256,273–279,336–341`; `app/routes/imports.py:52–68`; `repo/database_pending.py:40–71`; `services/analytics_common.py:53–70`.

## A-ZS-03 — Substituição integral de mês com auditoria de inclusão, alteração e remoção

- **Identificador:** A-ZS-03.
- **Cenário:** reimportar abril com conjunto diferente de produtos, preservando outro mês e verificando diferenças pela API de auditoria.
- **Componentes integrados:** rotas de importação, serviço importador, `build_update_event()`, substituição transacional, auditoria PostgreSQL, `/api/logs` e consulta analítica.
- **Pré-condições:** administrador autenticado; cadastro vigente; banco descartável com abril contendo COBRANCA (meta 80, produção 100) e CONSORCIOS (meta 50, produção 45), e maio contendo COBRANCA (meta 80, produção 70). Todas as cargas preparatórias são confirmações iniciais de seus meses; guardar snapshot completo de maio e quantidade inicial de logs.
- **Dados de entrada sintéticos:** `abril_substituido.xlsx`, mesmo PA/origem, duas linhas de abril: COBRANCA com meta 80 e produção 130; SIPAG com meta 40 e produção 44. Para cada linha, ID_PRODUTO igual ao PRODUTO, campos anuais da referência e demais campos zero. CONSORCIOS não aparece no novo arquivo. Analisar e confirmar; consultar `/api/logs` e produção acumulada de abril no PA `31`, `base_calculo=NO_PERIODO`.
- **Resultado esperado:** análise avisa mês existente. Confirmação retorna ação `updated`, uma inclusão, uma alteração, uma remoção, três linhas alteradas e total global três. Abril contém somente COBRANCA e SIPAG; maio permanece integralmente igual. Há um novo evento de abril com tipos INCLUIDO para SIPAG, ATUALIZADO para COBRANCA e REMOVIDO para CONSORCIOS; antes/depois de PRODUCAO_MENSAL da COBRANCA são 100/130. Consulta apresenta apenas os dois produtos de abril com produções 130/44. Token consumido e referência de log preenchida.
- **Asserções sugeridas para pytest:** `assert previa['period_already_exists'] is True`; `assert resultado['action'] == 'updated'`; `assert resultado['inserted_rows'] == resultado['updated_rows'] == resultado['removed_rows'] == 1`; `assert resultado['changed_rows'] == 3`; `assert resultado['total_rows'] == 3`; `assert resultado['log_file'] is not None`; `assert conjunto_produtos_abril == {'COBRANCA', 'SIPAG'}`; `assert snapshot_maio_depois == snapshot_maio_antes`; `assert logs_http.status_code == 200`; `assert quantidade_eventos_depois == quantidade_eventos_antes + 1`; conferir o conjunto exato de pares produto/tipo do evento; `assert alteracao_cobranca['before']['PRODUCAO_MENSAL'] == pytest.approx(100)`; `assert alteracao_cobranca['after']['PRODUCAO_MENSAL'] == pytest.approx(130)`; `assert produtos_consulta['COBRANCA']['producao_acumulada'] == pytest.approx(130)`; `assert produtos_consulta['SIPAG']['producao_acumulada'] == pytest.approx(44)`; `assert token_ausente_no_banco`.
- **Classificação do cenário:** positivo de reimportação; integração HTTP–serviços–PostgreSQL; auditoria e integridade entre períodos. **Exige PostgreSQL real descartável.**
- **Fundamentação:** `services/importer.py:285–333`; `services/audit.py:70–165`; `repo/database_data.py:84–138`; `app/routes/admin.py:36–42`.

## A-ZS-04 — Falha na gravação da auditoria reverte a substituição e preserva a prévia

- **Identificador:** A-ZS-04.
- **Cenário:** provocar erro PostgreSQL ao inserir o evento de uma reimportação, depois da substituição das linhas dentro da transação.
- **Componentes integrados:** rota de confirmação, importador, cálculo de diferenças, repositório de dados, inserção de auditoria, contexto transacional psycopg, prévias e consulta analítica.
- **Pré-condições:** banco descartável com uma linha confirmada de abril, meta mensal 80 e produção 100; cadastro vigente e admin autenticado. Analisar correção e guardar snapshots completos de dados/logs/prévia. Somente na futura execução autorizada, instalar trigger sintética que rejeite INSERT em `logs_alteracoes`; garantir remoção em finalização. Não substituir o repositório por um mock que apenas lance exceção, pois isso não demonstraria rollback real.
- **Dados de entrada sintéticos:** `abril_falha_auditoria.xlsx` com produção mensal 160, demais dados da referência. Confirmar seu token com o trigger ativo. Após a falha, consultar por conexões novas; remover o trigger e repetir a confirmação com o mesmo token.
- **Resultado esperado:** primeira confirmação retorna 422 com mensagem de atualização não concluída; os dados anteriores continuam com produção 100, nenhum evento novo é persistido e a prévia continua disponível com produção 160. A consulta analítica ainda retorna 100. Após remover a falha, a repetição retorna 200, produção passa a 160, um evento é gravado e o token é consumido. Não se presume rollback apenas pela mensagem HTTP: ele deve ser comprovado pelo estado persistido.
- **Asserções sugeridas para pytest:** `assert primeira_confirmacao.status_code == 422`; `assert snapshot_dados_apos_falha == snapshot_dados_antes`; `assert snapshot_logs_apos_falha == snapshot_logs_antes`; `assert snapshot_previa_apos_falha == snapshot_previa_antes`; `assert produto_apos_falha['producao_acumulada'] == pytest.approx(100)`; `assert segunda_confirmacao.status_code == 200`; `assert segunda_confirmacao.json()['updated_rows'] == 1`; `assert produto_apos_recuperacao['producao_acumulada'] == pytest.approx(160)`; `assert quantidade_eventos_final == quantidade_eventos_inicial + 1`; `assert token_ausente_no_banco_ao_final`.
- **Classificação do cenário:** negativo com recuperação; integração transacional HTTP–serviços–PostgreSQL; falha de persistência, atomicidade e integridade. **Exige PostgreSQL real descartável.** Nenhum trigger ou operação de banco é executado nesta geração.
- **Fundamentação:** `services/importer.py:285–310`; `repo/database_data.py:99–138`; `repo/database_pending.py:40–59`.

## A-ZS-05 — Chave natural duplicada rejeitada antes de persistir a prévia

- **Identificador:** A-ZS-05.
- **Cenário:** enviar XLSX legível com duas linhas para a mesma chave natural e valores de produção diferentes.
- **Componentes integrados:** middleware de sessão, rota multipart, leitor pandas/openpyxl, normalização de períodos, validação de chaves e tradução para resposta HTTP.
- **Pré-condições:** cliente com sessão administrativa obtida pelo login real com JWT sintético; inicialização do banco substituída no cliente futuro; todas as fronteiras de repositório protegidas por mocks/sentinelas que detectem chamadas. Leitor XLSX e normalização devem permanecer reais.
- **Dados de entrada sintéticos:** `abril_duplicado.xlsx` com duas linhas de referência; primeira com mês `04/2026` e produção 100, segunda com mês `2026-04` e produção 101. CENTRAL, COOP, PA e ID_PRODUTO são iguais. Ambas representam o mesmo mês após normalização.
- **Resultado esperado:** análise retorna 422 com indicação de mais de uma linha para a combinação CENTRAL/COOP/PA/ID_PRODUTO/MÊS/ANO. Não há token, gravação de prévia, validação de origens nem consulta de existência do mês, pois a duplicidade é detectada antes dessas operações. Não há deduplicação silenciosa.
- **Asserções sugeridas para pytest:** `assert resposta.status_code == 422`; `assert 'mais de uma linha' in resposta.json()['detail']`; `assert 'token' not in resposta.json()`; `salvar_previa.assert_not_called()`; `validar_origens.assert_not_called()`; `periodo_existe.assert_not_called()`; `substituir_periodo.assert_not_called()`; `driver_sentinela.assert_not_called()`.
- **Classificação do cenário:** negativo de entrada inválida; integração parcial HTTP–serviço–leitor XLSX real, com repositório simulado. **Pode utilizar componentes simulados; não exige PostgreSQL real.** Não comprova constraints do banco.
- **Fundamentação:** `app/config.py:94`; `services/importer.py:172–242`; `app/routes/imports.py:33–36`.

## A-ZS-06 — Valor numérico inválido em XLSX produz erro de conteúdo

- **Identificador:** A-ZS-06.
- **Cenário:** enviar planilha estruturalmente válida com produção mensal não conversível em número.
- **Componentes integrados:** sessão/middleware, upload multipart, rota de análise, pandas/openpyxl, `_normalize()`, `_parse_number()` e tradução de `ImportValidationError` para HTTP 422.
- **Pré-condições:** login administrativo válido; banco e startup simulados como no modo simulado comum; parser XLSX e normalização reais; spies nas operações de repositório para verificar ausência de interação. Não simular diretamente `analyze_upload()`.
- **Dados de entrada sintéticos:** `abril_numero_invalido.xlsx` com a linha de referência, substituindo PRODUCAO_MENSAL pelo texto `valor-invalido-Z31`; todas as colunas obrigatórias e mês `04/2026` presentes.
- **Resultado esperado:** análise retorna 422, com mensagem identificando o valor não conversível. Não retorna token e não inicia gravação de prévia ou substituição. Não confundir esse erro de conteúdo com arquivo vazio/extensão inválida, que seguem outros contratos HTTP.
- **Asserções sugeridas para pytest:** `assert resposta.status_code == 422`; `assert 'valor-invalido-Z31' in resposta.json()['detail']`; `assert 'convertido em número' in resposta.json()['detail']`; `assert 'token' not in resposta.json()`; `salvar_previa.assert_not_called()`; `validar_origens.assert_not_called()`; `periodo_existe.assert_not_called()`; `substituir_periodo.assert_not_called()`; `driver_sentinela.assert_not_called()`.
- **Classificação do cenário:** negativo de entrada inválida; integração parcial HTTP–serviço–leitura XLSX, com persistência simulada. **Pode utilizar componentes simulados; não exige PostgreSQL real.**
- **Fundamentação:** `services/importer.py:99–125,172–219,229–244`; `app/routes/imports.py:19–36`.

## A-ZS-07 — Sessão ausente impede importação, confirmação e consulta

- **Identificador:** A-ZS-07.
- **Cenário:** cliente anônimo tenta atravessar as três fronteiras HTTP principais sem realizar login.
- **Componentes integrados:** aplicação ASGI, SessionMiddleware, middleware `require_authenticated_user`, roteamento HTTP e respostas JSON de acesso negado.
- **Pré-condições:** cliente novo sem cookies; startup de banco substituído antes de seu uso futuro; serviços e driver com spies/sentinelas; `ROOT_PATH=/` explicitamente configurado. Esta especificação trata as três requisições como etapas de um único cenário de acesso anônimo.
- **Dados de entrada sintéticos:** upload válido `abril_anonimo.xlsx` com a linha de referência; formulário de confirmação com token de 32 caracteres `a` e nome do arquivo; consulta `/api/acompanhamento/producao-acumulada?inicio=2026-04&fim=2026-04&pa=31&base_calculo=NO_PERIODO`. Não é necessário que o token exista porque a sessão é verificada antes do serviço.
- **Resultado esperado:** todas as requisições retornam 401 com `detail=Autenticação necessária.` e cabeçalho `Location=/login`. Nenhum serviço de análise, confirmação ou cálculo é chamado e nenhuma conexão é tentada. O cliente não deve seguir automaticamente redirecionamentos para mascarar a resposta inicial.
- **Asserções sugeridas para pytest:** para cada resposta, `assert resposta.status_code == 401`, `assert resposta.json()['detail'] == 'Autenticação necessária.'` e `assert resposta.headers['location'] == '/login'`; `analisar_upload.assert_not_called()`; `confirmar_importacao.assert_not_called()`; `calcular_acumulado.assert_not_called()`; `driver_sentinela.assert_not_called()`.
- **Classificação do cenário:** negativo de autenticação; integração HTTP–sessão–middleware–roteamento, com serviços/persistência simulados para observar bloqueio. **Pode utilizar componentes simulados; não exige PostgreSQL real.** Não é teste isolado de `_require_admin()`.
- **Fundamentação:** `app/core.py:219–236`; `app/routes/imports.py:19–58`; `app/routes/analytics.py:28–39`.

## A-ZS-08 — Login válido de usuário comum não concede importação administrativa

- **Identificador:** A-ZS-08.
- **Cenário:** autenticar usuário sem perfil admin e verificar rejeição nas rotas administrativas do fluxo, preservando a identidade autenticada.
- **Componentes integrados:** PyJWT, rota de login, armazenamento de sessão, cookie, middleware de autenticação, `_require_admin()`, rotas de importação/auditoria e `/api/usuario`.
- **Pré-condições:** ambiente sintético de autenticação, sem bypass; startup PostgreSQL simulado; cliente com cookie jar; serviços administrativos e driver protegidos por mocks/sentinelas. Não mockar `verificar_token()` nem `_require_admin()`.
- **Dados de entrada sintéticos:** JWT HS256 com email `leitor31@example.test`, uid `leitor31`, perfil `user`, tipo `login` e expiração futura; `POST /login`; upload `abril_sem_permissao.xlsx` com linha de referência; confirmação com token de 32 caracteres `b` e nome do arquivo; `GET /api/logs`; `GET /api/usuario`.
- **Resultado esperado:** login retorna 303 e cria cookie; `/api/usuario` retorna 200 com email/perfil do leitor, demonstrando autenticação bem-sucedida. Upload, confirmação e consulta de logs retornam 403 com mensagem de acesso restrito a admin. Não são criados tokens de prévia, dados ou eventos. Não há tentativa de conexão, e o login válido não eleva o perfil.
- **Asserções sugeridas para pytest:** `assert login.status_code == 303`; `assert cookie_de_sessao_presente`; `assert usuario.status_code == 200`; `assert usuario.json()['email'] == 'leitor31@example.test'`; `assert usuario.json()['perfil'] == 'user'`; para as três respostas administrativas, `assert resposta.status_code == 403` e `assert resposta.json()['detail'] == 'Acesso permitido somente para o perfil admin.'`; `analisar_upload.assert_not_called()`; `confirmar_importacao.assert_not_called()`; `consultar_logs.assert_not_called()`; `driver_sentinela.assert_not_called()`.
- **Classificação do cenário:** negativo de autorização após autenticação positiva; integração HTTP–JWT–sessão–controle administrativo, com persistência simulada. **Pode utilizar componentes simulados; não exige PostgreSQL real.**
- **Fundamentação:** `app/auth.py:87–128`; `app/routes/auth.py:52–64,81–99`; `app/core.py:131–163`; `app/routes/imports.py:19–58`; `app/routes/admin.py:36–42`.

## Resumo quantitativo da geração original

- Oito casos, identificados de A-ZS-01 a A-ZS-08.
- Quatro exigem PostgreSQL real descartável: A-ZS-01 a A-ZS-04.
- Quatro admitem repositório/serviços simulados preservando fronteiras de integração: A-ZS-05 a A-ZS-08.
- Três têm fluxo principal positivo: primeira importação, cancelamento e reimportação (A-ZS-01 a A-ZS-03); A-ZS-02 inclui uma tentativa negativa posterior.
- Cinco têm fluxo principal negativo: falha de auditoria com recuperação, duas entradas inválidas, autenticação ausente e autorização insuficiente (A-ZS-04 a A-ZS-08).
- Zero casos implementados, zero casos executados e zero conexões PostgreSQL nesta etapa.
