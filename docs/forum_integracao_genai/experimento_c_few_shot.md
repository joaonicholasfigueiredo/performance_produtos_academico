# Experimento C — Few-shot para testes de integração

## Técnica e condições de geração

Data: 23/10/2026 (America/Sao_Paulo). Projeto: `performance_produtos_academico`.
Geração assistida pelo agente Codex nesta sessão; identificador exato do modelo,
temperatura, seed e parâmetros de amostragem não foram disponibilizados.

Técnica: few-shot prompting, com três exemplos ilustrativos fornecidos no prompt
(parametrização pytest, verificação de ausência de chamadas e comparação numérica).
Os exemplos orientam a estrutura, mas não substituem a inspeção dos contratos.
Não foram lidos nem copiados testes dos experimentos A/B ou testes de importação
existentes. Foram inspecionados o código da aplicação e o `tests/conftest.py`
para verificar as condições de segurança e as fixtures herdadas.

Fontes consultadas: `pyproject.toml`, `requirements.txt`, cabeçalho de `uv.lock`,
`app/main.py`, `app/core.py`, `app/config.py`, `app/auth.py`,
`app/routes/auth.py`, `app/routes/imports.py`, `services/importer.py`,
`services/units.py`, `repo/database.py`, `repo/database_core.py`,
`repo/postgres_isolation.py` e buscas pelos pontos de conexão no repositório.
Também foi inspecionado o código local de `httpx.ASGITransport`.
Nenhuma regra de negócio foi modificada.

O workspace já continha alterações anteriores, inclusive nos contratos de
importação e de unidades. A geração usa esse estado de trabalho, sem presumir
que corresponde apenas ao último commit. Essas alterações foram preservadas.

Ambiente verificado: Python 3.14; pytest 9.1.1; FastAPI 0.136.3;
Starlette 1.7.0; pandas 2.3.3; openpyxl 3.1.5; psycopg 3.3.6;
PyJWT 2.15.1; python-multipart 0.0.32; itsdangerous 2.2.0.
`httpx` não estava instalado nem declarado nas dependências do projeto.
Foi instalado `httpx==0.28.1` no `.venv`, com httpcore 1.0.9 e
certifi 2026.10.23. A primeira instalação foi bloqueada pela restrição de rede
do sandbox; a repetição com elevação autorizada concluiu a instalação.
Os manifests e o lockfile existentes foram preservados; para reproduzir em
outro ambiente, instalar as dependências do projeto, o extra `dev` e
explicitamente `httpx==0.28.1`.

O escopo é HTTP em processo, sem startup/lifespan, com XLSX em memória,
autenticação JWT e sessão reais, e persistência simulada. Os resultados e
as verificações anteriores à execução constam no documento de resultados.

## Prompt completo fornecido pelo usuário

O bloco abaixo reproduz integralmente a solicitação do experimento, incluindo
os exemplos. Contextos de ambiente da ferramenta são descritos acima.

````markdown
# Fórum Unidade III — Experimento C: Few-shot para testes de integração

**Projeto:** `performance_produtos_academico`

Estamos realizando um experimento acadêmico sobre técnicas de prompting aplicadas à geração de testes de integração com IA generativa.

Esta etapa utiliza a técnica **few-shot prompting**, fornecendo exemplos de código para orientar a implementação de testes automatizados.

## 1. Objetivo

Gerar testes de integração utilizando Python, pytest e os contratos reais da aplicação.

Priorize as seguintes integrações:

- FastAPI → middleware de autenticação → rotas.
- FastAPI → serviço de importação → validação XLSX.
- FastAPI → serviços de negócio → tratamento de erros.

Nesta primeira implementação, utilize exclusivamente componentes simulados nas fronteiras de persistência.

## 2. Exemplos de referência (few-shot)

### Exemplo A — Organização de testes com pytest
```python
import pytest

@pytest.mark.parametrize(
    "entrada, esperado",
    [
        ("valor_a", 200),
        ("valor_b", 422),
    ],
)
def test_contrato_exemplo(entrada, esperado):
    resposta = cliente_simulado(entrada)

    assert resposta.status_code == esperado
```

Este exemplo demonstra organização e parametrização. `cliente_simulado` é apenas ilustrativo e não representa uma função existente.

### Exemplo B — Verificação de dependências simuladas
```python
from unittest.mock import Mock

def test_operacao_nao_executada():
    dependencia = Mock()

    resultado = validar_entrada_simulada("invalido")

    assert resultado is False
    dependencia.assert_not_called()
```

Este exemplo demonstra a intenção de verificar ausência de efeitos colaterais. É ilustrativo: o mock precisa ser conectado à dependência efetivamente utilizada no teste real.

### Exemplo C — Validação de resultados
```python
import pytest

def test_resultado_numerico():
    resultado = {"meta": 100.0, "producao": 125.0}

    assert resultado["producao"] == pytest.approx(125.0)
    assert resultado["meta"] == pytest.approx(100.0)
```

Este exemplo demonstra como tratar comparações numéricas evitando dependência desnecessária de igualdade exata entre floats.

## 3. Tarefa

A partir dos contratos do projeto, implemente quatro cenários de integração:

1. Rejeição de chave natural duplicada no XLSX.
2. Rejeição de valor numérico inválido.
3. Bloqueio de importação sem autenticação.
4. Bloqueio de importação por usuário sem perfil administrativo.

Esses cenários correspondem aos comportamentos A-ZS-05 a A-ZS-08, mas desenvolva a implementação a partir dos contratos do código e dos exemplos fornecidos, sem copiar testes existentes.

## 4. Requisitos técnicos

- Utilizar pytest.
- Utilizar cliente ASGI para atravessar o pipeline HTTP real.
- Preservar middleware, roteamento, autenticação e autorização reais.
- Utilizar XLSX sintético em memória.
- Simular apenas a persistência e os pontos de infraestrutura necessários.
- Não substituir por mocks a função principal que está sendo testada.
- Garantir que nenhum teste tente abrir uma conexão PostgreSQL.
- Não inicializar a aplicação com startup que acesse o banco.
- Utilizar sentinelas para detectar tentativas de conexão.
- Manter independência entre os testes.

Verifique as dependências e a interface real do projeto antes de escrever o código. Não presuma que `httpx`, fixtures ou auxiliares já estejam disponíveis.

## 5. Registro acadêmico

Crie:

`docs/forum_integracao_genai/experimento_c_few_shot.md`

`docs/forum_integracao_genai/resultados_c_few_shot.md`

`tests/integration/test_importacao_genai_few_shot.py`

No primeiro documento, registre o prompt completo, a técnica e as condições da geração.

No segundo, registre os casos implementados, decisões técnicas e limitações.

Não modifique os resultados originais dos experimentos A e B.

## 6. Execução autorizada

Antes de executar pytest:

1. Confirme que a configuração não ativa PostgreSQL real.
2. Confirme que os testes não inicializam o startup com persistência.
3. Confirme que toda tentativa de conexão é interceptada por sentinela.
4. Verifique que a seleção de testes não inclui fixtures com acesso ao banco.

Somente após essas verificações, execute exclusivamente:

`tests/integration/test_importacao_genai_few_shot.py`

Se qualquer condição não puder ser comprovada, não execute o teste e registre o impedimento.

## 7. Avaliação

Registre:

- Quantidade de testes implementados.
- Quantidade de testes executados.
- Testes aprovados e reprovados.
- Problemas de geração identificados.
- Ajustes necessários para tornar os testes executáveis.
- Evidências de ausência de conexão PostgreSQL.
- Diferenças entre exemplos fornecidos e código final produzido.

Não altere regras de negócio para fazer testes passarem.

Diferencie erros no código do teste de possíveis defeitos da aplicação.

## 8. Restrições finais

- Não acessar PostgreSQL real.
- Não alterar banco, schema ou dados.
- Não modificar regras de negócio.
- Não criar commits.
- Não publicar automaticamente no GitHub.
- Não reescrever os resultados originais de A ou B.

Ao concluir, apresente o relatório técnico e os arquivos criados ou modificados.
````
