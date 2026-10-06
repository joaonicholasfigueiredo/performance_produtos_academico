# Testes e validação

A suíte usa `pytest` para descobrir classes `unittest.TestCase` em `tests/`. Há cinco arquivos de teste e cerca de 25 métodos `test_*` no código atual. Execute:

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
4. Abra `http://127.0.0.1:8000` e confirme o redirecionamento de login local. Um usuário sem `admin` não deve acessar importação/limpeza.
5. Use apenas uma planilha sintética para ensaiar análise, confirmação, consulta e exportação; a confirmação altera o banco.

Na validação desta revisão com Python 3.14.3, a compilação passou e `pytest -q` executou **25 testes: 25 aprovados, 0 falhas, 0 ignorados**. Houve dois avisos de depreciação do `@app.on_event("startup")` no FastAPI; eles não interrompem a suíte. A conexão de leitura ao PostgreSQL local respondeu `SELECT 1 = 1`, a inicialização criou/conferiu o armazenamento sem erro e uma execução temporária do servidor respondeu **HTTP 200** em `http://127.0.0.1:8765/login?logged_out=1`. O servidor de validação foi encerrado depois da checagem; o exemplo normal usa a porta 8000.
