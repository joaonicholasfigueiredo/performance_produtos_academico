# Análise comparativa — P1, P2 e P3

Esta análise consolida os registros de 23/10/2026 sem reescrever os seis
documentos originais. A navegação completa, o inventário de alterações
excluídas e a situação da publicação estão no [README](README.md).

## Produtos e evidências disponíveis

| Dimensão | P1 — Zero-shot (A) | P2 — Raciocínio estruturado inspirado em Chain-of-Thought (CoT) (B) | P3 — Few-shot (C) |
| --- | --- | --- | --- |
| Orientação do prompt | Instrução contextualizada pelos contratos, sem exemplos adicionais de casos | Operações, dependências, repetições, interrupções, ordem e invariantes | Exemplos ilustrativos de pytest, mocks e comparação numérica |
| Saída produzida | Oito especificações textuais | Oito especificações textuais | Quatro casos pytest em duas funções parametrizadas |
| Foco | Importação, cancelamento, reimportação, auditoria, valores inválidos e controle de acesso | Repetição, expiração de prévias, rollback, recuperação e consistência temporal | XLSX com chave duplicada, número inválido, ausência de sessão e perfil sem privilégio admin |
| Implementados na etapa | 0 | 0 | 4 |
| Executados na etapa | 0 | 0 | 4 |
| Aprovados / reprovados | Não se aplica; não houve execução | Não se aplica; não houve execução | 4 / 0 |
| Tempo de execução | Não medido | Não medido | 2,61 s, na execução original |
| PostgreSQL | Quatro casos requerem banco descartável para comprovação completa; quatro admitem simulação | Necessidade discriminada por caso; atomicidade e prazo SQL exigem banco real | Persistência simulada; zero tentativas de conexão observadas pelas sentinelas |

O P2 é classificado como **Raciocínio estruturado inspirado em Chain-of-Thought
(CoT)**: o prompt orientou a IA a mapear operações, dependências, falhas e
regras de integridade em etapas antes de apresentar os casos de teste.
Foi solicitado apenas um resumo objetivo desse mapeamento. Essa classificação
não caracteriza uso de CoT clássico nem solicitação de exposição do raciocínio
interno da IA; o título original “Estados e falhas” permanece preservado.

Fontes: [resultados P1](resultados_a_zero_shot.md),
[resultados P2](resultados_b_estados.md) e
[resultados P3](resultados_c_few_shot.md).
Os zeros de execução de P1/P2 não representam reprovação. Também não há taxa
de aprovação comparável entre as três estratégias: somente P3 foi executado,
com escopo menor e sem persistência real.

## Relação entre os cenários

O P1 oferece um conjunto amplo de oito casos: primeira importação com
normalização e consulta; cancelamento de prévia; substituição mensal com
auditoria; falha de auditoria com recuperação; chave duplicada; número
inválido; falta de autenticação; perfil sem autorização administrativa.

O P2 organiza oito sequências por estados e efeitos: sessão e prévia sem
publicação prematura; cancelamento repetido; repetição após commit e nova
análise idêntica; substituição com delta auditado; expiração e limpeza;
falha entre DELETE e INSERT; falha tardia antes do commit; e confirmações
sequenciais com referência temporal independente da ordem de importação.
Parte dos temas se sobrepõe ao P1; o detalhamento de transições e pontos
de falha é a diferença documental observada. Não há comprovação empírica
de rollback, expiração ou consistência temporal no experimento B.

**Os quatro testes do P3 correspondem a cenários previamente selecionados
do P1, A-ZS-05 a A-ZS-08. Não são quatro descobertas inéditas.**
A correspondência é temática e parcial:

| Caso do P1 | Implementação do P3 | Recorte em relação à especificação |
| --- | --- | --- |
| A-ZS-05 — chave natural duplicada | Upload XLSX real, sessão admin e resposta 422; persistência sem chamadas | Mesma representação de mês nas duas linhas; não cobre a variação de formatos de mês sugerida no P1 |
| A-ZS-06 — número inválido | Valor textual inválido em META_MENSAL; resposta 422 | P1 sugeria PRODUCAO_MENSAL; P3 testa outra coluna atendida pelo mesmo contrato numérico |
| A-ZS-07 — sem autenticação | Upload recusado pelo middleware, com 401 e Location | Não implementa as tentativas de confirmação e consulta analítica também descritas no P1 |
| A-ZS-08 — sem perfil admin | Login JWT real, identidade confirmada e upload recusado com 403 | Não implementa as tentativas de confirmação e leitura de logs também descritas no P1 |

Portanto, oito propostas P1, oito propostas P2 e quatro implementações P3
não equivalem a vinte cenários inéditos, nem a dezesseis ou vinte testes
executados. Os quatro casos automatizados exercitam parte de quatro
especificações anteriores.

## Ajustes relevantes e sua função

| Ajuste | Registro e efeito |
| --- | --- |
| Contextualização dos contratos | Consulta de rotas, campos XLSX, sessão, autorização, serviços e repositórios orientou entradas e oráculos; nomes ilustrativos não foram presumidos como funções existentes |
| Mapeamento de estados | No P2, distinguiu prévia, dados confirmados, auditoria, consumo de token, expiração lógica e limpeza física; explicitou estados antes/depois e pontos de falha |
| Exemplos pytest | No P3, orientaram parametrização, IDs, asserções HTTP e verificação de ausência de chamadas; pytest.approx não foi inserido sem resultado numérico a comparar |
| Isolamento da persistência | No P3, manteve HTTP, autenticação, autorização e validação XLSX reais, com mocks apenas nas fronteiras e sentinelas de conexão/startup; não comprova transações PostgreSQL |
| Instalação de httpx | Ausente inicialmente; httpx==0.28.1 foi instalado no ambiente virtual para o cliente ASGI. Continua não declarado nos manifests/lockfile |
| Restauração entre testes | Antes da execução P3, o patch do inicializador foi posicionado após importar core, evitando capturar mock temporário no alias global |
| Conferência estática auxiliar | A checagem textual que encontrou TestClient na docstring foi substituída por análise de chamadas na AST; não foi falha funcional do teste ou da aplicação |

Esses ajustes estão descritos nos [resultados C](resultados_c_few_shot.md).
Nenhuma regra de negócio foi alterada para obter aprovação. Não houve
correção do código de teste após uma execução reprovada: a primeira execução
registrada aprovou os quatro casos. Foram observados dois avisos de
depreciação de on_event na aplicação, sem evidência de startup executado.

## Resultados observados, inferências e pendências

**Observado nos artefatos e na execução original:** P1 e P2 contêm oito
propostas cada; P3 contém quatro casos implementados, executados e aprovados
em 2,61 s. As sentinelas de conexão e inicialização de persistência
permaneceram sem chamadas; a sentinela instalada antes da coleta registrou
zero tentativas PostgreSQL. As quatro respostas de erro e a ausência de
chamadas às dependências simuladas foram verificadas. Esta consolidação
apenas revisou os registros, sem repetir testes ou acessar banco.

**Interpretação limitada:** a estrutura de P2 torna explícitas transições,
invariantes e janelas de falha, enquanto o conjunto P1 distribui casos
pelo fluxo. Os exemplos few-shot forneceram orientação estrutural para o
código P3. Os registros permitem descrever essas diferenças, mas não
demonstram que uma técnica descubra mais defeitos, gere testes melhores
ou reduza tempo de implementação.

**Hipóteses ainda não testadas:** melhor cobertura de falhas com prompts
por estados; menor esforço de ajuste com few-shot; maior eficácia de uma
estratégia na detecção de defeitos. Seriam necessários escopos equivalentes,
repetições, critérios de cobertura, medição de esforço e controle do contexto
para compará-las. Nenhum desses estudos adicionais foi realizado aqui.

**Não executado:** os casos completos de P1/P2 com persistência real;
rollback de operações SQL já realizadas; expiração baseada em NOW();
limpeza de prévias; atomicidade de dados/log/token; integridade após commits;
concorrência entre processos; suíte completa e variação da ordem dos testes.
Os quatro testes P3 não substituem essas verificações. Nenhum defeito da
aplicação foi evidenciado no recorte executado; isso não prova sua ausência.

## Limitações metodológicas e de reprodução

Os prompts tinham objetivos e tamanhos diferentes. P1/P2 geraram
especificações, P3 implementou um subconjunto negativo com doubles.
O tempo de 2,61 s é o tempo local de execução dos testes P3, não o tempo
de geração pela IA, nem um benchmark da aplicação ou da técnica de prompting.
O aproveitamento de cenários de P1 impede tratar P3 como descoberta independente.

O [registro A](experimento_a_zero_shot.md) declara exposição anterior na
conversa; o [registro B](experimento_b_estados.md) declara consulta a trechos
de testes existentes; o [registro C](experimento_c_few_shot.md) documenta
o recorte e a inspeção de infraestrutura. Não se afirma independência
experimental absoluta. Identificador exato do modelo, temperatura e seed
não estavam disponíveis, e os contratos foram lidos de uma árvore de
trabalho com alterações não commitadas.

A reprodução P3 requer instalação manual de httpx==0.28.1 e também os
contratos e arquivos de isolamento usados no workspace original. A publicação
autorizada contém somente oito documentos e um arquivo de testes;
não inclui tests/conftest.py, repo/postgres_isolation.py ou as alterações
locais de aplicação/unidades. Assim, não se declara que esse recorte rode
isoladamente em um clone limpo da base. As referências históricas a quatro
arquivos fora do recorte estão inventariadas no [README](README.md).

Os seis originais e o teste foram mantidos sem alteração. A revisão de
publicação não encontrou caminhos absolutos pessoais ou dados confidenciais
nos nove arquivos selecionados. A documentação acadêmica já está publicada
na [branch entrega/forum-integracao-genai](https://github.com/joaonicholasfigueiredo/performance_produtos_academico/tree/entrega/forum-integracao-genai/docs/forum_integracao_genai).
Não houve novos testes, conexões PostgreSQL ou modificações da aplicação
nesta revisão documental, nem merge ou push automático.
