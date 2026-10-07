# Uso de inteligência artificial generativa

## IA no desenvolvimento

Nesta etapa acadêmica, a IA apoiou o **discovery estático antes das alterações**: leitura da estrutura, dependências, responsabilidades de módulos, persistência, autenticação, fluxos de importação/consulta, regras de cálculo, testes, riscos e divergências entre documentação e código. Também apoiou a revisão dos textos, a organização dos diagramas Mermaid e a investigação do ambiente local. As conclusões foram confrontadas com os arquivos da implementação e com os resultados de testes disponíveis.

A IA é ferramenta de apoio, não autoridade sobre regras de negócio. As sugestões devem ser revisadas pelo desenvolvedor responsável antes de sua adoção ou entrega acadêmica. A validação humana é necessária especialmente para o significado dos indicadores, a legitimidade dos dados e a autorização de compartilhamento. Este documento não atribui à IA a autoria das regras nem presume validação de negócio que não foi registrada.

## IA na aplicação em execução

A aplicação **não usa IA generativa em runtime**. As rotas HTTP chamam código determinístico em Python, pandas e SQL; o JavaScript apresenta e pontua os dados conforme regras explícitas. Não foi identificada chamada a provedor de modelos, geração de texto por IA ou armazenamento de prompts no fluxo operacional.

## Diagramas, ajustes e limite de atribuição

Nesta revisão, a IA elaborou os diagramas estrutural e de sequência incorporados ao README a partir de inspeção somente leitura realizada antes das edições. A proposta foi conferida com a instância compartilhada FastAPI, as chamadas diretas entre módulos, a prévia JSONB, os ramos de confirmação/cancelamento e o contexto transacional psycopg. A decisão editorial foi representar fronteiras e responsabilidades com `flowchart` e `sequenceDiagram`, sem assumir containers Docker ou conformidade C4 completa.

O [registro de ajustes no README](../README.md#uso-de-ia-generativa-e-ajustes-realizados) lista divergências comprovadas e suas evidências: comando de desenvolvimento, localização dos diagramas, evento somente na reimportação, referência de log PostgreSQL, perfil local, abertura de navegador e claims JWT opcionais. Não há prompts ou respostas antigas disponíveis para atribuir essas divergências à IA. A falta de rastreabilidade de uma saída incorreta anterior é declarada como lacuna, e não como evidência de que nunca houve erro.

Há um erro de geração efetivamente observado nesta execução: as mensagens da primeira sequência usavam ponto e vírgula sem escape, como `Exigir admin; validar extensão`. A revisão trocou essa pontuação por vírgulas conforme a [sintaxe oficial](https://mermaid.js.org/syntax/sequenceDiagram.html#entity-codes-to-escape-characters), que reserva ponto e vírgula como separador de instruções. O README registra o antes/depois. Isso comprova ajuste de sintaxe da saída de IA, sem inventar uma interpretação arquitetural errada ou alegar teste de renderização que não ocorreu.

As decisões necessárias para reconstrução autônoma estão na [seção específica do README](../README.md#o-que-ainda-precisaria-ser-documentado-para-implementação-autônoma). O conteúdo final ainda requer revisão humana.

## Cuidados na revisão

Nenhum segredo ou dado real deve ser copiado para prompts, exemplos, documentação ou logs. O desenvolvedor deve revisar afirmações geradas contra o código, conferir testes e conexão local, e aprovar o conteúdo final destinado à publicação. Os limites atuais estão em [testes](testes-e-validacao.md) e [riscos](riscos-e-limitacoes.md).
