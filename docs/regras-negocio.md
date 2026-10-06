# Regras de negócio do acompanhamento de produtos

Este documento descreve as transformações e os critérios aplicados aos dados
importados antes de sua apresentação nas telas e exportações.

Os identificadores de produto e PA abaixo são parte do contrato de entrada e dos
filtros do código. Nomes comerciais ou de unidades exibidos em exemplos foram
generalizados para esta versão acadêmica. A justificativa de negócio para alguns
limiares fixos não está registrada no código: **justificativa de negócio não
documentada**.

## Produtos e metas

- A planilha contém metas e produção mensal, trimestral, semestral, anual e
  no período. As consultas atuais usam sobretudo os pares mensal e anual; os
  demais campos permanecem armazenados e disponíveis na exportação da base.
- Os sete produtos foco definidos em `services/analytics_common.py` são
  `COBRANCA`, `CONSORCIOS`, `SEGURO_RURAL`, `VENDA_NOVA_PA`,
  `SEGUROS_GERAIS`, `SICOOBCARD` e `SIPAG`.
- `CREDITO_PESSOAL`, `CREDITO_RURAL` e `CREDITO_PJ` são produtos de saldo. A
  posição mais recente é usada no acumulado; somar seus saldos mensais
  produziria um valor sem o significado pretendido.
- O rótulo de quantidade de produtos na visão sintética vem dos registros
  efetivamente retornados. O denominador fixo de **18 oportunidades mensais**
  pertence à pontuação por PA; não significa que toda base terá exatamente
  18 produtos distintos exibidos.

## Escopo das unidades

- **Singular:** consolida os registros de todos os PAs.
- **PA:** considera somente os registros pertencentes ao PA selecionado.
- No escopo geral da Singular, utiliza-se `VENDA_NOVA_SINGULAR` e descarta-se
  `VENDA_NOVA_PA`.
- No escopo geral de um PA, utiliza-se `VENDA_NOVA_PA` e descarta-se
  `VENDA_NOVA_SINGULAR`.
- O escopo de produtos foco possui sete indicadores e utiliza
  `VENDA_NOVA_PA`, inclusive em sua consolidação Singular.

## Ajuste proporcional da meta de Venda Nova PA

### Motivação

A `META_MENSAL` de `VENDA_NOVA_SINGULAR` representa a meta consolidada da
Singular. Em condições normais, ela deveria coincidir com a soma das
`META_MENSAL` de `VENDA_NOVA_PA`. Como a fonte pode apresentar uma meta
Singular superior à soma das metas distribuídas, o acompanhamento complementa
as metas dos PAs por rateio proporcional.

### Aplicação

A comparação é realizada separadamente para cada mês:

1. Soma-se a `META_MENSAL` de todos os registros `VENDA_NOVA_PA`.
2. Obtém-se a `META_MENSAL` consolidada de `VENDA_NOVA_SINGULAR`.
3. Se a soma dos PAs for igual ou superior à meta Singular, as metas dos PAs
   permanecem inalteradas.
4. Se a soma dos PAs for inferior à meta Singular, a diferença é distribuída
   na proporção da meta original de cada PA.

Para cada PA:

```text
diferenca = meta_singular - soma_metas_pa
participacao_pa = meta_original_pa / soma_metas_pa
meta_ajustada_pa = meta_original_pa + (diferenca * participacao_pa)
```

Forma equivalente:

```text
meta_ajustada_pa = meta_original_pa * (meta_singular / soma_metas_pa)
```

Exemplo: para meta Singular de `R$ 14.130,00` e soma original dos PAs de
`R$ 9.200,00`, aplica-se o fator `14.130 / 9.200`. Uma meta de PA originalmente
igual a `R$ 1.000,00` passa a ser aproximadamente `R$ 1.535,87`.

### Exceções e limites

- O ajuste nunca reduz uma meta de PA.
- Sem registro de `VENDA_NOVA_SINGULAR` no mês, as metas dos PAs permanecem
  inalteradas.
- Se a soma das metas dos PAs for zero, não há rateio.
- Somente `META_MENSAL` de `VENDA_NOVA_PA` é ajustada.
- Produção, metas anuais e os demais campos permanecem inalterados.
- O cálculo é feito em memória nas consultas. Os registros originais do
  PostgreSQL não são modificados.
- O valor integral é usado nos cálculos; o arredondamento monetário ocorre
  apenas na apresentação.

## Bases de cálculo

- **Mensal:** para produtos regulares, soma metas e produções mensais no
  intervalo selecionado.
- **No período:** produtos regulares usam a soma mensal; produtos de saldo usam
  somente o valor mensal do último mês disponível.
- **Anual:** utiliza os campos anuais do último mês disponível de cada produto.
- `CREDITO_PESSOAL`, `CREDITO_RURAL` e `CREDITO_PJ` são produtos de saldo e,
  no acumulado mensal, utilizam o saldo anual mais recente em vez da soma dos
  meses.

## Aderência e pontuação por PA

- Um produto é aderente quando possui meta maior que zero e produção igual ou
  superior à meta.
- No quadro por PA, cada produto pode gerar uma oportunidade de atingimento por
  mês.
- O escopo geral considera 18 oportunidades por mês e o escopo foco considera
  sete.
- Na base **No período**, a quantidade esperada corresponde ao número de meses
  selecionados. Na base **Anual**, a expectativa é sempre de 12 meses: 216
  oportunidades no escopo geral e 84 no escopo de sete produtos.
- Produto ausente ou sem atingimento consome a oportunidade sem pontuar.
- Em **Desempenho por agência**, o denominador do escopo geral permanece em
  18 produtos mesmo quando algum registro possui meta mensal igual a zero ou
  está ausente. Esses casos não pontuam e são contabilizados como não aderentes.
- Em **Desempenho por agência**, o seletor **No período / Anual** segue as
  mesmas bases de cálculo da visão geral: **No período** soma os valores mensais
  dos produtos regulares e usa o último saldo mensal dos produtos de saldo;
  **Anual** usa a última posição anual disponível de cada produto.

### Visão analítica Produto por PA

- A navegação interna possui uma página **Consolidado** e uma página para cada
  um dos sete produtos foco.
- A página **Consolidado** apresenta a evolução conjunta dos produtos e não
  funciona como seletor; o detalhamento é acessado pelas abas de produto.
- Os sete produtos são exibidos simultaneamente no consolidado, sem paginação,
  com os valores de meta e produção no período e um indicador de aderência
  calculado sobre esses valores.
- Cada página de produto apresenta sua evolução consolidada e o desempenho
  mensal de todas as agências.
- A página de produto abre na opção **Tabela**, com todos os PAs visíveis. O
  nome do PA expande ou recolhe seu gráfico individual de evolução mensal.
- A opção **Gráfico** substitui a tabela pelo comportamento consolidado do
  produto e apresenta meta, produção, percentual e gap nas bases **No
  período** e **Anual**.
- Nas páginas individuais, a visão de tabela destaca meta e produção no
  período, percentual da meta anual e aderência anual do produto.
- A análise é mensal e considera cada combinação de produto foco, PA e mês.
- Para cada combinação são apresentados `META_MENSAL`, `PRODUCAO_MENSAL`,
  percentual de atingimento e `GAP` (`PRODUCAO_MENSAL - META_MENSAL`).
- O status mensal é **Aderente** quando a meta é maior que zero e o percentual
  de atingimento é igual ou superior a 100%; abaixo de 100% é **Não aderente**.
- Registros sem meta positiva são identificados como **Sem meta** e meses sem
  registro são identificados como **Sem dados**.
- Os indicadores de aderência do quadro contabilizam oportunidades mensais,
  não apenas o resultado acumulado de cada agência no período.
- Na base **Anual**, cada agência possui 12 oportunidades mensais esperadas por
  produto; na base **No período**, são considerados os meses disponíveis no
  intervalo selecionado.

## Outras alocações gerenciais

- Registros `SEGURO_VIDA` do PA `00` são apresentados como
  `SEGURO_VIDA_ARRECADACAO` no PA `89`.
- Os PAs `89` e `999` compõem o consolidado Singular, mas não são exibidos
  individualmente nos filtros, resumos ou cards de agências.

## Estudo de evolução anual

- O estudo utiliza o ano do mês mais recente disponível na base e apresenta
  cada produto separadamente por PA.
- A produção realizada em cada mês corresponde ao valor de `PRODUCAO_ANUAL`
  registrado naquele período; a meta final corresponde à `META_ANUAL` do
  último mês disponível para o produto.
- A trilha ideal distribui a meta anual proporcionalmente pelos 12 meses:
  `meta_anual × número_do_mês / 12`.
- O gap para dezembro é a parcela positiva de
  `meta_anual - producao_anual_atual`.
- O ritmo mínimo necessário divide esse gap pela quantidade de meses restantes
  até dezembro.
- A recomendação nunca reduz um ritmo que já é suficiente: usa o maior valor
  entre a média mensal realizada no ano e o ritmo mínimo necessário. Assim, a
  trajetória recomendada mantém o desempenho atual quando ele já projeta o
  atingimento da meta e acelera somente quando a projeção ficaria abaixo dela.
- Para produtos de saldo (`CREDITO_PESSOAL`, `CREDITO_RURAL` e `CREDITO_PJ`),
  o ritmo necessário representa incremento médio de saldo, não soma de
  movimentações mensais.
- A projeção no ritmo atual é linear e serve como referência gerencial:
  `producao_atual / meses_decorridos × 12`.
- A grade mensal segue a ordem **Mês**, **Meta mensal**, **Produção realizada**,
  **Gap**, **Déficit acumulado** e **Plano de evolução**, para separar o
  resultado isolado do mês do esforço necessário até dezembro.
- Na leitura mês a mês, o `GAP` é
  `PRODUCAO_MENSAL - META_MENSAL` e mostra o resultado isolado do mês.
- Para produtos regulares, o déficit acumulado é a parcela positiva da soma
  progressiva dos gaps mensais:
  `max(soma(META_MENSAL) - soma(PRODUCAO_MENSAL), 0)`.
- Para produtos de saldo, que não podem ter seus saldos mensais somados, o
  déficit acumulado compara a posição anual registrada com a trilha anual:
  `max(trilha_ideal - PRODUCAO_ANUAL, 0)`.
- Para os meses futuros, a meta-base mensal corresponde a `META_ANUAL / 12`,
  pois ainda não existe registro mensal importado para esses períodos.
- O plano de evolução mensal utiliza o ritmo recomendado. O adicional de
  recuperação é `max(ritmo_recomendado - meta_base_mensal, 0)` e evidencia
  quanto precisa ser produzido além da parcela mensal da meta anual.
- Nos rótulos dos pontos realizados do gráfico, a variação mensal compara
  `PRODUCAO_MENSAL` com o mês imediatamente anterior. Seta para cima indica
  aumento, seta para baixo indica queda e seta horizontal indica estabilidade.
- Os pontos futuros exibem o acumulado projetado e o incremento mensal do plano.
  Esses rótulos podem ser exibidos ou ocultados sem alterar os cálculos.

## Rankings e combos na interface

O serviço entrega produtos e unidades com ordenação por percentual/aderência;
as tabelas JavaScript também permitem ordenação selecionada pelo usuário. A
posição visual reflete o filtro e a base de cálculo ativos, sem tabela de ranking
persistida. Os combos da visão analítica são definidos em
`views/src/modules/01-core.js` e pontuados em
`views/src/modules/07-analytics-score.js`; são uma regra da apresentação, não
uma tabela do banco.

- No modo **individual**, cada requisito de produto rende um ponto por mês
  importado quando o percentual é pelo menos 100%. O máximo é o número de
  requisitos multiplicado pelos meses importados.
- No modo **combo**, um combo rende um ponto no mês somente se **todos** os
  requisitos atingirem 100%. O intervalo considera os meses do filtro, inclusive
  meses sem dados; um requisito ausente ou sem meta não pontua.
- No escopo geral existem grupos de Crédito, Serviços, Investimentos,
  Recebimentos e Pagamentos e Proteção; no foco, há grupos próprios de
  Serviços, Recebimentos e Pagamentos e Proteção. Alguns requisitos aceitam
  identificadores alternativos do mesmo indicador. A composição exata está nas
  constantes JavaScript citadas acima.

As projeções anuais são lineares e gerenciais; não são previsão estatística.
Justificativa de negócio não documentada para a escolha dos grupos e dos
denominadores fixos de pontuação.
