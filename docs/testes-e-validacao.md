# Testes e validação

A suíte usa `pytest` para descobrir classes `unittest.TestCase` em `tests/`. Há cinco arquivos de teste; a execução desta revisão coletou e aprovou 25 testes. Com o ambiente virtual ativado, execute:

```powershell
python -m compileall -q app repo services utils tests
python -m pytest -q
```

## Escopo verificado pelo código da suíte

| Tipo | Arquivos | O que verifica |
|---|---|---|
| Unitário | `test_auth.py`, `test_launcher.py`, `test_routes.py` | Claims JWT, rejeição de token, configuração do servidor e funções de rotas |
| Fluxo simulado | `test_import_flow.py` | XLSX sintético, análise, confirmação, reimportação, cálculos e auditoria com `MemoryStorage` injetado no lugar do repositório |
| SQL simulado | `test_database_logs.py` | Montagem de consultas e parâmetros com conexão/cursor mockados |

Não há teste automatizado que conecte a um PostgreSQL real. Os mocks comprovam o comportamento local das funções, mas não comprovam permissões, criação de schema, transação em servidor real ou desempenho com grande volume.

## Validação manual local

1. Verifique que `.config/.env` ou as variáveis `PG*` apontam a um banco **local** e que o serviço PostgreSQL está ativo.
2. Execute `python scripts/validate_local_db.py`. O script permite apenas loopback, faz `SELECT 1` e não imprime usuário, senha, host completo ou string de conexão.
3. Inicie `python app.py --development`; o startup deve criar o schema/tabelas se permitido.
4. Abra `http://127.0.0.1:8000` e confirme o redirecionamento de login local. Um usuário sem `admin` não deve acessar importação/limpeza. Para o ensaio administrativo sintético, configure `ENVIRONMENT_PROFILE=admin` apenas localmente antes de iniciar; o `.env.example` não concede esse perfil.
5. Use apenas uma planilha sintética para ensaiar análise, confirmação, consulta e exportação; a confirmação altera o banco.

## Resultado desta revisão documental (05/10/2026)

O alias `python` do terminal apontava ao WindowsApps e não pôde ser executado. Foi utilizado o interpretador do ambiente existente com o comando equivalente `& '.\.venv\Scripts\python.exe' -m pytest -q`; depois, com `.venv/Scripts` no início do PATH, `python -m pytest -q` também passou: **25 passed, 2 warnings**, em 2,02 segundos. Os dois avisos são a depreciação de `@app.on_event("startup")`; código funcional não foi alterado para removê-los. Não foi necessário reinstalar dependências ou recriar o ambiente.

Não foi executada nesta revisão conexão PostgreSQL real, inicialização do schema ou validação HTTP manual. A documentação anterior relatava esses ensaios e compilação com Python 3.14.3; são relatos históricos, não resultados reconfirmados nesta execução. A verificação Git e dos blocos Mermaid é documental; renderização visual no GitHub deve ser conferida após a publicação.

`git diff --check` passou sem erros de whitespace. Git emitiu avisos de conversão LF para CRLF, sem normalização em massa. A checagem estática confirmou os caminhos dos links locais, os dois blocos no README (`flowchart` e `sequenceDiagram`) e o balanceamento dos blocos condicionais das sequências. Não houve execução de parser ou renderizador Mermaid.
