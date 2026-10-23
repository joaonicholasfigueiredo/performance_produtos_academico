# Resultados do experimento C — Few-shot

Execução em 23/10/2026 (America/Sao_Paulo), no Windows, com Python 3.14.3 e
pytest 9.1.1. O prompt integral e as condições de geração estão em
[experimento_c_few_shot.md](experimento_c_few_shot.md).

## Casos e resultado observado

Foram implementados **4 casos**, em duas funções parametrizadas. Foram
coletados e executados **4 testes**, com **4 aprovados, 0 reprovados,
0 erros e 0 ignorados**. Houve uma única execução de pytest,
restrita a `tests/integration/test_importacao_genai_few_shot.py`.
Tempo informado pelo pytest: **2,61 s**; código de saída: **0**.

| Comportamento | Entrada e contexto | Contrato verificado | Resultado |
| --- | --- | --- | --- |
| A-ZS-05 | Admin autenticado; duas linhas com a mesma chave natural e produções diferentes | HTTP 422; mensagem identifica CENTRAL, COOP, PA, ID_PRODUTO e MÊS/ANO, com 2 linhas | Aprovado |
| A-ZS-06 | Admin autenticado; META_MENSAL = `numero-invalido-c` | HTTP 422; mensagem identifica o valor que não pode ser convertido em número | Aprovado |
| A-ZS-07 | Sem autenticação; XLSX sintético válido | HTTP 401; `Autenticação necessária.`; cabeçalho `Location: /login` | Aprovado |
| A-ZS-08 | Sessão real com perfil `consulta`; XLSX sintético válido | HTTP 403; `Acesso permitido somente para o perfil admin.` | Aprovado |

Todos os casos verificam o JSON completo de erro e a ausência de chamadas às
quatro dependências de persistência simuladas. Os identificadores A-ZS foram
mantidos para rastreabilidade; o código foi derivado dos contratos atuais,
sem leitura ou cópia dos testes anteriores.

## Decisões técnicas

- Cliente `httpx.AsyncClient` com `ASGITransport(app=core.app)` atravessa a
  aplicação real em processo: middleware de sessão, middleware de
  autenticação, roteamento, autorização e tratamento HTTP de erros.
  O domínio `.invalid` é apenas a base de URL do transporte em memória.
- Autenticação por `POST /login`, com JWT HS256 sintético, assinado com chave
  exclusiva de teste, tipo `login`, e-mail sintético, perfil e expiração.
  O cliente recebe o cookie real e confirma a identidade por `/api/usuario`.
  Não há sessão fabricada, bypass de desenvolvimento ou mock de autenticação.
- `asyncio.run` permite testes pytest comuns, sem presumir a presença de
  pytest-asyncio ou de fixtures HTTP existentes.
- `openpyxl.Workbook` e `BytesIO` produzem o XLSX multipart com todas as
  colunas obrigatórias extraídas de `app.config`. pandas e openpyxl leem o
  arquivo pelo serviço real. Nenhuma planilha é gravada em disco.
- A duplicidade usa medidas diferentes para demonstrar a repetição da chave
  natural, sem depender de duas linhas integralmente iguais.
- Os únicos mocks de operações de negócio são nas fronteiras do repositório:
  `repo.database.validate_origins`, `load_units`, `period_exists` e
  `save_pending_import`, com `spec` das funções reais. São os pontos usados
  por `analyze_upload` e `pending_units`. Todos devem permanecer sem chamadas
  porque a rejeição ocorre antes da persistência.
- `analyze_upload`, `_normalize`, conversões, validação de chave, rotas,
  autenticação e autorização permanecem reais. O erro de negócio
  `ImportValidationError` é produzido pelo serviço e convertido em 422 pela rota.
- Cada caso recebe mocks, workbook, cliente, cookies e event loop próprios.
  O `monkeypatch` restaura as alterações. A instância global real da aplicação
  é compartilhada, mas os testes não alteram seu roteamento, dependências ou
  registros de startup e não acumulam estado de importação.

## Verificações concluídas antes do pytest

1. **Configuração sem PostgreSQL ativo:** o ambiente inspecionado não tinha
   `PERFORMANCE_TEST_POSTGRES` ativado. O processo executor fixa essa variável
   em `0`, remove variáveis `PG*`, limpa `PYTEST_ADDOPTS`/`PYTEST_PLUGINS` e
   desativa autoload de plugins externos. A configuração pytest em
   `pyproject.toml` contém somente `testpaths` e `pythonpath`.
   O guard herdado de `tests/conftest.py` fica ativo sem sessão autorizada;
   nesse estado `database_core._read_settings()` não usa a configuração real,
   pois encaminha para `postgres_isolation.settings()`, que recusa a operação.
   Não foi necessário ler nem divulgar credenciais de configuração.
2. **Startup com persistência não executado:** foi revisado o código instalado
   de `httpx.ASGITransport.handle_async_request`, que cria apenas escopos
   `http`. Nenhum gerenciador de lifespan é usado. O startup da aplicação
   chama `core.initialize_database`, protegido por sentinela durante os testes,
   assim como as referências em `database` e `database_core`.
3. **Conexões interceptadas:** o executor instala uma sentinela em
   `psycopg.connect`, `psycopg.Connection.connect` e
   `psycopg.AsyncConnection.connect` antes de importar pytest. Assim, o alias
   `_RAW_CONNECT` capturado ao carregar `postgres_isolation` também fica
   protegido antes da coleta. Cada fixture instala sentinelas novas nesses
   três pontos e em `postgres_isolation._RAW_CONNECT`, antes de importar a
   aplicação. A busca dos pontos de conexão confirmou que os módulos de
   persistência usam esse driver e esse alias para operações administrativas.
4. **Seleção sem fixtures DB:** inspeção estática via AST confirmou duas funções
   parametrizadas com 4 casos e uso somente de `isolated_app`, que depende de
   `monkeypatch`. O `tests/conftest.py` não contém fixtures autouse.
   `postgres` e `isolated_postgres_settings` não estão na cadeia de dependências.
   Não há conftest adicional em `tests/integration` e nenhum teste de outro
   arquivo foi selecionado.

Essas condições foram comprovadas antes da execução. Não houve impedimento
remanescente para executar os quatro casos autorizados.

## Evidências de ausência de conexão PostgreSQL

Trecho da saída observada:

```text
Preflight dinamico: PostgreSQL desativado; PG* removidas; sentinelas instaladas antes do pytest.
collecting ... collected 4 items
test_rejeicao_xlsx[A-ZS-05-chave-natural-duplicada] PASSED
test_rejeicao_xlsx[A-ZS-06-numero-invalido] PASSED
test_bloqueio_importacao[A-ZS-07-sem-autenticacao] PASSED
test_bloqueio_importacao[A-ZS-08-sem-perfil-admin] PASSED
4 passed, 2 warnings in 2.61s
Tentativas PostgreSQL na sentinela de bootstrap: 0
```

Além do contador de bootstrap em zero, o teardown de cada caso executou
`connection_attempt.assert_not_called()` e
`startup_attempt.assert_not_called()`. Os quatro casos aprovados comprovam
que essas verificações também passaram. Mesmo uma tentativa interceptada e
capturada pela aplicação reprovaria o teardown. Os mocks efetivamente ligados
à persistência também passaram por `assert_not_called()` em todos os casos.
Não foi acessado PostgreSQL, nem alterado banco, schema ou dados.

## Reprodução da execução isolada

No `.venv` do projeto, instalar as dependências declaradas, o extra `dev` e
`httpx==0.28.1`. Após revisar novamente as quatro condições acima em caso de
mudanças nos contratos ou fixtures, executar em PowerShell:

```powershell
@'
import os
import sys
from unittest.mock import Mock

os.environ['PERFORMANCE_TEST_POSTGRES'] = '0'
os.environ['PYTEST_DISABLE_PLUGIN_AUTOLOAD'] = '1'
os.environ.pop('PYTEST_ADDOPTS', None)
os.environ.pop('PYTEST_PLUGINS', None)
for name in list(os.environ):
    if name.upper().startswith('PG'):
        del os.environ[name]

import psycopg

bootstrap_sentinel = Mock(
    name='bootstrap_postgresql_sentinel',
    side_effect=AssertionError('Conexao PostgreSQL proibida desde antes da coleta'),
)
psycopg.connect = bootstrap_sentinel
psycopg.Connection.connect = bootstrap_sentinel
psycopg.AsyncConnection.connect = bootstrap_sentinel

assert os.environ['PERFORMANCE_TEST_POSTGRES'] == '0'
print('Preflight dinamico: PostgreSQL desativado; PG* removidas; sentinelas instaladas antes do pytest.')
import pytest
exit_code = pytest.main(['-v', 'tests/integration/test_importacao_genai_few_shot.py'])
print('Tentativas PostgreSQL na sentinela de bootstrap:', bootstrap_sentinel.call_count)
bootstrap_sentinel.assert_not_called()
sys.exit(exit_code)
'@ | .\.venv\Scripts\python.exe -
```

O uso de `pytest.main` no processo protegido seleciona exclusivamente o arquivo
autorizado e permite instalar a sentinela antes da coleta, sem alterar o
`conftest.py` compartilhado.

## Problemas de geração e ajustes

- **Dependência ausente:** `httpx` não estava disponível. Isso é uma condição
  do ambiente de teste, não um defeito da aplicação. A instalação explícita
  de 0.28.1 resolveu a dependência; o primeiro acesso ao índice foi bloqueado
  pelo sandbox e a repetição autorizada concluiu a instalação. A reprodução
  exige esse passo porque os manifests existentes não foram alterados.
- **Revisão antes da execução:** o patch de `initialize_database` foi colocado
  após a importação de `core`, evitando que a primeira importação guardasse
  um mock temporário no alias global e prejudicasse a restauração entre casos.
  As sentinelas de conexão já protegem o período anterior à importação.
- **Verificação estática auxiliar:** uma checagem inicial procurou o texto
  `TestClient` e encontrou a própria docstring explicativa. Foi corrigida
  para inspecionar chamadas na AST. Não foi uma falha de teste nem da aplicação;
  nenhum pytest havia sido executado nessa etapa.
- **Execução dos testes:** não houve erros no código dos testes nem ajustes
  posteriores para fazê-los passar. A primeira execução passou integralmente.
- **Avisos da aplicação:** foram emitidos dois `DeprecationWarning` sobre
  `@app.on_event("startup")`, em `app/core.py` e no registro do FastAPI.
  Decorar/registrar o handler não significa executar o startup. Os avisos
  não são falhas dos cenários nem evidência de conexão; a migração para lifespan
  fica fora deste experimento. Nenhuma regra de negócio foi alterada.
- **Possíveis defeitos da aplicação:** nenhum foi evidenciado pelos quatro
  contratos exercitados. Isso não permite concluir ausência de defeitos fora
  desse recorte.

## Diferenças em relação aos exemplos few-shot

| Exemplo | Aplicação no código final |
| --- | --- |
| A — organização e parametrização | Duas tabelas com dois casos cada, IDs rastreáveis, status e JSON reais; `cliente_simulado` foi substituído pelo cliente ASGI da aplicação. |
| B — ausência de efeitos colaterais | Mocks conectados à fachada realmente usada pelo serviço e verificados após a requisição; sentinelas de conexão/startup também verificadas no teardown. Não se usa `validar_entrada_simulada`. |
| C — comparação numérica | Não há resultado numérico de sucesso nos quatro contratos de rejeição, portanto `pytest.approx` não foi inserido artificialmente. Os floats 100.0 e 125.0 compõem a entrada XLSX, sem comparação de floats na saída. |

## Limitações e preservação do experimento

O experimento não cobre SQL, transações, persistência efetiva, migrações,
startup/lifespan, rede HTTP externa, confirmação da importação, caminho de
sucesso ou todas as formas de números inválidos. O valor não numérico foi
testado em `META_MENSAL`; as outras colunas não receberam variações próprias.
A simulação de persistência não constitui validação da integração com PostgreSQL.
Os testes exercitam JWT HS256 de teste, não chaves de produção ou provedor externo.
As mensagens de erro exatas são parte das asserções e exigem atualização caso
o contrato textual mude deliberadamente.

As sentinelas cobrem os pontos de conexão identificados no código atual;
não são uma sandbox contra código hostil ou contra futuros drivers não revisados.
O resultado depende do workspace e das versões registrados, incluindo alterações
pré-existentes. A execução isolada passou; a ordem inversa e a suíte completa
não foram executadas, conforme a restrição de seleção do usuário.

Foram criados apenas os três arquivos solicitados, além da instalação da
dependência no ambiente virtual e dos caches normais do pytest/Python.
Não houve commit, publicação no GitHub ou alteração dos arquivos originais
de A/B. As somas SHA-256 dos resultados anteriores foram registradas antes
da execução para comparação final:

| Arquivo | SHA-256 |
| --- | --- |
| `resultados_a_zero_shot.md` | `3b9238ee820b63fe8aaf574d1127c7cd2eca641fe9bf10933e1ee547320a7138` |
| `resultados_b_estados.md` | `a87599c53c3f5deb02286a971d7afc34be26e4920962ca1f51dd9334a1327665` |

A comparação final confirmou esses hashes e também a integridade dos dois
documentos de experimento A/B: os quatro arquivos anteriores permaneceram idênticos.
