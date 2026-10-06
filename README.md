# Acompanhamento de Produtos

Aplicação web de acompanhamento de metas e produção por produto, período e unidade (PA). Importa planilhas XLSX, permite revisar uma prévia antes da confirmação, apresenta indicadores e exporta relatórios. Este repositório descreve a implementação atual para estudo acadêmico; use somente dados sintéticos em demonstrações.

## Contexto, objetivo e escopo

O problema tratado é transformar uma base mensal de metas e produção em consultas comparáveis, com rastreabilidade da substituição de períodos. O sistema cobre importação, consultas gerenciais, estudo de evolução anual, exportação e auditoria. Não é um sistema de origem dos dados nem realiza backup automático do PostgreSQL.

## Funcionalidades

- Upload XLSX de até 50 MB, validação, normalização, prévia e confirmação por token.
- Reimportação de mês por substituição transacional, com registro das diferenças no PostgreSQL.
- Consultas sintética e analítica, produtos gerais e sete produtos foco, desempenho por PA e projeção anual.
- Exportação Excel da base e do acompanhamento; PDF dos cartões por agência.
- Sessão autenticada por JWT; operações de importação, auditoria, limpeza e exportação da base exigem perfil `admin`.

## Tecnologias e arquitetura

Python 3.10 ou superior, FastAPI, Jinja2, JavaScript, pandas, openpyxl, psycopg 3, PostgreSQL, ReportLab, PyJWT e pytest. É um **monólito modular**: `app/` define HTTP e autenticação, `services/` contém os fluxos e cálculos, `repo/` concentra SQL, `views/` contém templates e recursos estáticos. A inicialização cria schema e tabelas no banco configurado; não há mecanismo de migração versionada.

```text
app.py -> app/launcher.py -> app/main.py -> app/core.py
app/routes/       HTTP e controle de acesso
services/         importação, análise, auditoria e exportação
repo/             configuração e operações PostgreSQL
views/            templates Jinja2, JavaScript, CSS e imagens
tests/            testes automatizados
docs/             arquitetura, regras e validação
```

Os fluxos principais são: planilha → análise → prévia pendente → confirmação → dados e auditoria; e navegador → sessão → API de acompanhamento → serviços analíticos → PostgreSQL → tabelas, gráficos ou arquivo para download. Veja [arquitetura](docs/arquitetura.md), [importação](docs/fluxo-importacao.md), [banco de dados](docs/banco-de-dados.md) e [regras de negócio](docs/regras-negocio.md).

## Persistência e regras

O schema padrão `performance_produtos` contém `dados`, `logs_alteracoes` e `importacoes_pendentes`. A chave natural dos dados é central, cooperativa, PA, identificador do produto e mês. Os indicadores usam campos mensais ou a última posição anual conforme a base de cálculo; produtos de saldo têm tratamento próprio. As alocações e o rateio de Venda Nova PA são aplicados nas consultas, sem alterar o dado importado. O [modelo](docs/banco-de-dados.md) e as [fórmulas](docs/regras-negocio.md) detalham limites e exceções.

## Segurança e controle de acesso

`POST /login` valida JWT com segredo HS256 em desenvolvimento ou chave pública configurada em produção e grava a identidade em cookie de sessão. O bypass local requer **ambos** `ENVIRONMENT=development` e `--development`. As rotas `/api/*` exigem sessão; a checagem de `admin` existe nas rotas de importação, limpeza, logs e exportação da base. Outras exportações e análises aceitam qualquer sessão autenticada. Mantenha o servidor restrito a `127.0.0.1` em desenvolvimento e substitua os segredos de exemplo antes de testar JWT.

## Como executar localmente (Windows PowerShell)

1. Instale Python 3.10+ e PostgreSQL local. Um ambiente virtual copiado de outro computador deve ser recriado; seus executáveis e caminhos podem não funcionar.
2. Na raiz do projeto, execute:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   python -m pip install pytest
   ```

   Se o launcher `py` não estiver disponível, use o caminho do Python instalado no primeiro comando. `pip install -e ".[dev]"` também instala o projeto e pytest conforme `pyproject.toml`.
3. Crie banco e usuário locais. Exemplo no `psql` com um usuário administrador local:

   ```sql
   CREATE DATABASE acompanhamento_produtos;
   -- O usuário configurado precisa de CONNECT no banco e CREATE no banco
   -- para que o startup crie o schema e as três tabelas.
   ```

4. Copie [.env.example](.env.example) para `.config/.env` e ajuste **localmente** `PGUSER`, `PGPASSWORD` e demais valores. `.config/.env` tem prioridade sobre `.env` da raiz; variáveis de processo `PG*` têm prioridade sobre ambos. Se já houver `.config/.env`, confira que aponta para o banco local e não o sobrescreva sem necessidade. Também é aceito `.config` como arquivo INI com `[postgresql]`, `[storage]` e `[server]`, mas esse formato e o diretório `.config/` ocupam o mesmo caminho e não coexistem.
5. Execute `python app.py --development` para o bypass local, ou `python app.py` para autenticação JWT. Com o exemplo, a URL é `http://127.0.0.1:8000`. A API documentada fica em `/api/docs` após login. O launcher pode abrir o navegador automaticamente se `ACOMPANHAMENTO_OPEN_BROWSER` não for `0`.

`uvicorn app.main:app --reload --host 127.0.0.1` também inicia a aplicação, mas o parâmetro `--development` só é reconhecido pelo fluxo do launcher. A inicialização exige conexão PostgreSQL válida e permissão para criar schema/tabelas.

## Testes e validação

```powershell
python -m compileall -q app repo services utils tests
python -m pytest -q
```

A suíte usa armazenamento em memória e mocks; ela não comprova uma conexão PostgreSQL real. A [estratégia e os resultados de validação](docs/testes-e-validacao.md) separam isso da checagem manual de banco.

## IA generativa, versionamento e limites

A IA foi usada como apoio à leitura estática, à revisão de documentação e à identificação de riscos nesta etapa. A aplicação não chama um modelo de IA durante a execução. A [declaração de uso](docs/uso-ia-generativa.md) separa apoio ao desenvolvimento e uso em runtime.

O histórico Git existente mistura mensagens em texto livre e prefixos como `FEAT`/`FIX`; não se afirma adesão integral a Conventional Commits. A recomendação para evoluções é adotar mensagens consistentes sem reescrever o histórico. Há mistura de CRLF/LF no checkout; nenhuma normalização em massa foi feita.

Limites atuais incluem ausência de migrações e backup automatizado, cálculos monetários em `float`, testes sem PostgreSQL real e risco de dados sensíveis em exportações. Consulte [riscos e limitações](docs/riscos-e-limitacoes.md) e [proteção das informações](docs/protecao-informacoes.md).

Este material foi preparado para atividade de pós-graduação. Autor e instituição podem ser informados no contexto da entrega acadêmica, sem incluir identificadores internos do ambiente de origem.
