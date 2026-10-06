# Scripts auxiliares

`validate_local_db.py` executa `SELECT 1` apenas quando `PGHOST` aponta para loopback local. Não imprime dados de conexão. Execute com `python scripts/validate_local_db.py` depois de configurar o PostgreSQL. O ponto de entrada da aplicação é `app.py`, que chama `app.launcher.main`. A criação do schema, a persistência e a auditoria são executadas pelos módulos `repo/` durante o uso da aplicação.

Instruções de instalação, configuração e validação estão no [README principal](../README.md). Não coloque dumps, credenciais ou exportações reais nesta pasta.
