# Fórum Unidade III — Testes de integração com GenAI

Consolidação acadêmica do projeto `performance_produtos_academico`, em
23/10/2026 (America/Sao_Paulo). O estudo compara três estratégias de prompting
aplicadas ao fluxo FastAPI de autenticação, importação XLSX, prévias,
confirmação, substituição mensal, auditoria e consulta analítica.

A entrega reúne especificações originais e uma implementação parcial.
**Somente o P3 tem execução registrada: quatro testes aprovados em 2,61 s,
com zero tentativas de conexão PostgreSQL observadas pelas sentinelas.**
Essa execução ocorreu no experimento C; a consolidação não executou testes,
não iniciou a aplicação e não acessou PostgreSQL.

## Metodologia e estratégias

| Estratégia | Método e foco | Produto registrado | Evidência de execução |
| --- | --- | --- | --- |
| P1 — Zero-shot contextualizada (A) | Instruções e contratos reais, sem exemplos fornecidos nesta etapa; amplitude do fluxo e integridade | Oito casos textuais de importação, cancelamento, reimportação, auditoria, valores inválidos e controle de acesso | Nenhum caso implementado ou executado na etapa A |
| P2 — Raciocínio estruturado inspirado em Chain-of-Thought (CoT) (B) | Mapeamento de operações, estados, dependências, efeitos colaterais e invariantes | Oito casos textuais, com ênfase em repetição, expiração de prévias, rollback e consistência temporal | Nenhum caso implementado ou executado na etapa B |
| P3 — Few-shot (C) | Exemplos de parametrização pytest, ausência de chamadas e comparação numérica; consulta aos contratos | Quatro testes de rejeição e controle de acesso, com persistência simulada | Quatro executados e aprovados; zero reprovados; 2,61 s |

No P2, o prompt orientou a IA a mapear, em etapas, operações, dependências,
falhas e regras de integridade antes de apresentar os casos de teste.
A classificação indica essa organização estruturada e a solicitação de um
resumo objetivo do mapeamento; não caracteriza uso de CoT clássico nem
solicitação de exposição do raciocínio interno da IA. O experimento original
mantém o título “Estados e falhas”.

Os quatro testes do P3 implementam um recorte de A-ZS-05 a A-ZS-08 do P1.
**Não são quatro descobertas inéditas**, nem uma implementação integral de
todas as operações descritas nesses quatro casos. P1 e P2 produziram
especificações; resultados esperados nelas não equivalem a comportamento
empiricamente comprovado.

O contexto disponível e os ajustes fazem parte da metodologia:
contextualização dos contratos reais no P1; mapeamento de estados no P2;
exemplos pytest, isolamento da persistência e instalação explícita de
`httpx==0.28.1` no P3. O histórico e a exposição a cenários prévios diferem
entre as etapas, conforme seus registros originais. Não houve controle
experimental suficiente para atribuir superioridade causal a uma estratégia.

## Navegação

| Etapa | Prompt, técnica e condições | Saída original |
| --- | --- | --- |
| P1 / A | [Experimento A — Zero-shot](experimento_a_zero_shot.md) | [Resultados A — oito casos](resultados_a_zero_shot.md) |
| P2 / B | [Experimento B — CoT (estados e falhas)](experimento_b_estados.md) | [Resultados B — oito casos](resultados_b_estados.md) |
| P3 / C | [Experimento C — Few-shot](experimento_c_few_shot.md) | [Resultados C — implementação e execução](resultados_c_few_shot.md) |

- [Análise comparativa e limites das evidências](analise_comparativa.md).
- [Código dos quatro testes P3](../../tests/integration/test_importacao_genai_few_shot.py).

Os seis documentos originais foram preservados integralmente. Seus registros
de “não criar commits” descrevem as restrições das etapas originais;
a finalização posterior autorizou uma branch acadêmica com os arquivos
selecionados, sem merge automático em `main`.

## Reprodução: dependências e limites desta entrega

O P3 usa pytest, cliente ASGI `httpx.AsyncClient`/`ASGITransport`,
XLSX sintético em memória, JWT e sessão reais. O transporte não executa
lifespan/startup; fronteiras de persistência são simuladas e sentinelas
detectam tentativas de conexão. A evidência histórica detalhada, inclusive
o executor protegido, está em [resultados C](resultados_c_few_shot.md).

**A reprodução requer `httpx==0.28.1`, ainda não declarado nos manifests
ou no lockfile do projeto.** A instalação manual dessa versão foi necessária
no ambiente original. Não houve alteração de dependências nesta consolidação.

A execução original também dependia do estado de trabalho local, que incluía
`repo/postgres_isolation.py`, `tests/conftest.py`, cadastro de unidades e
mudanças em contratos ainda não versionadas. Esses componentes estão fora
da seleção autorizada. **A instalação de httpx, sozinha, não torna este
recorte reproduzível em um clone limpo da base usada para a entrega.**
A implementação é publicada como artefato acadêmico da execução registrada;
não se afirma que o checkout isolado reproduza os quatro testes aprovados.

Nenhuma nova execução foi feita para contornar essa limitação. Reproduzir
futuramente exigirá disponibilidade dos contratos e do isolamento originais,
além de nova verificação de segurança e autorização de execução. Essa
integração futura permanece pendente e fora do escopo deste fórum.

## Conferência de links e publicação

Os links entre os oito documentos acadêmicos e o link para o teste foram
conferidos por resolução estática de caminhos. Todos apontam para arquivos
incluídos na seleção. Não foi necessário executar a aplicação para isso.

Há quatro referências históricas nos originais que só resolvem no workspace
original e não no recorte versionado sobre o HEAD
`a0dbd4f768b64ac4df62d382290078d9a44c98d8`:

| Documento original | Destino externo ao recorte e ausente na base |
| --- | --- |
| `experimento_a_zero_shot.md` | `docs/isolamento-postgresql-testes.md` |
| `experimento_b_estados.md` | `services/units.py` |
| `experimento_b_estados.md` | `repo/database_units.py` |
| `experimento_b_estados.md` | `tests/conftest.py` |

Essas referências foram mantidas para preservar integralmente os originais;
não se afirma que todos os links históricos para infraestrutura funcionarão
no GitHub. Não foram acrescentados arquivos fora da lista autorizada para
resolver essas referências.

A revisão dos nove arquivos selecionados não identificou caminhos locais
absolutos com identificação pessoal, credenciais reais ou dados confidenciais.
A chave JWT no teste é explicitamente sintética e exclusiva de teste;
e-mails, códigos e planilhas descritos são sintéticos. Não foram incluídos
arquivos `.env`, planilhas reais, bancos, caches ou arquivos temporários.

A documentação acadêmica já está publicada no GitHub, na
[branch entrega/forum-integracao-genai](https://github.com/joaonicholasfigueiredo/performance_produtos_academico/tree/entrega/forum-integracao-genai/docs/forum_integracao_genai).
Esta revisão corrige a classificação metodológica do P2 e o registro da
publicação, sem merge ou push automático.

## Inventário das alterações preexistentes

Antes da consolidação, `git status --porcelain=v1 --untracked-files=all`
registrava **52 arquivos: 28 modificados e 24 não rastreados**.
Sete não rastreados são os seis originais e o teste do P3, selecionados
para o commit. Os outros **45 arquivos** abaixo foram excluídos da entrega
e preservados. O README e a análise comparativa foram criados posteriormente.
O índice estava vazio antes da seleção.

`M` indica arquivo modificado; `??` indica arquivo não rastreado.
Os caminhos são relativos à raiz do repositório.

```text
 M app/core.py
 M app/routes/analytics.py
 M app/routes/imports.py
 M docs/arquitetura.md
 M docs/banco-de-dados.md
 M docs/regras-negocio.md
 M docs/riscos-e-limitacoes.md
 M docs/testes-e-validacao.md
 M repo/database.py
 M repo/database_core.py
 M repo/database_data.py
 M repo/database_logs.py
 M services/analytics.py
 M services/analytics_agencies.py
 M services/analytics_common.py
 M services/analytics_evolution.py
 M services/analytics_production.py
 M services/analytics_summary.py
 M services/exporter_excel.py
 M services/importer.py
 M tests/test_import_flow.py
 M views/src/app.js
 M views/src/modules/03-import.js
 M views/src/modules/04-navigation.js
 M views/src/modules/09-tracking-data.js
 M views/templates/index.html
 M views/templates/partials/import.html
 M views/templates/partials/sidebar.html
?? app/routes/units.py
?? docs/gerenciamento-unidades.md
?? docs/isolamento-postgresql-testes.md
?? docs/refatoracao-clean-code-unidades.md
?? repo/database_units.py
?? repo/postgres_isolation.py
?? services/units.py
?? tests/conftest.py
?? tests/test_postgres_isolation_security.py
?? tests/test_units.py
?? tests/test_units_browser.py
?? tests/test_units_clean_code.py
?? tests/test_units_postgres.py
?? utils/units.py
?? views/css/units.css
?? views/src/modules/10-units.js
?? views/templates/partials/units.html
```

## Integridade dos seis originais

Hashes SHA-256 capturados antes da consolidação, para comparação com os
arquivos finais e os blobs do commit:

| Arquivo | SHA-256 |
| --- | --- |
| `experimento_a_zero_shot.md` | `7d66cedeab4a6dcc383241c5337fd848e6c904d7357f4c770a4f7f954d5fd3cf` |
| `experimento_b_estados.md` | `1d0ac2531a9666fca7115fa8d9ad88ab888e1994b58fc1049ddb6639dbe774ee` |
| `experimento_c_few_shot.md` | `0cfaa11ed232b24ead1cec8ae26cb8047ee7ea8c026b25d44eb0aade253ea5cc` |
| `resultados_a_zero_shot.md` | `3b9238ee820b63fe8aaf574d1127c7cd2eca641fe9bf10933e1ee547320a7138` |
| `resultados_b_estados.md` | `a87599c53c3f5deb02286a971d7afc34be26e4920962ca1f51dd9334a1327665` |
| `resultados_c_few_shot.md` | `eb614ff044c96c651d1ee750cfb7c02800bd8567bd0d0414af12b36d10be6770` |
