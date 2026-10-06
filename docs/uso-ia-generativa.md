# Uso de inteligência artificial generativa

## IA no desenvolvimento

Nesta etapa acadêmica, a IA apoiou o **discovery estático antes das alterações**: leitura da estrutura, dependências, responsabilidades de módulos, persistência, autenticação, fluxos de importação/consulta, regras de cálculo, testes, riscos e divergências entre documentação e código. Também apoiou a revisão dos textos, a organização dos diagramas Mermaid e a investigação do ambiente local. As conclusões foram confrontadas com os arquivos da implementação e com os resultados de testes disponíveis.

A IA é ferramenta de apoio, não autoridade sobre regras de negócio. As sugestões devem ser revisadas pelo desenvolvedor responsável antes de sua adoção ou entrega acadêmica. A validação humana é necessária especialmente para o significado dos indicadores, a legitimidade dos dados e a autorização de compartilhamento. Este documento não atribui à IA a autoria das regras nem presume validação de negócio que não foi registrada.

## IA na aplicação em execução

A aplicação **não usa IA generativa em runtime**. As rotas HTTP chamam código determinístico em Python, pandas e SQL; o JavaScript apresenta e pontua os dados conforme regras explícitas. Não foi identificada chamada a provedor de modelos, geração de texto por IA ou armazenamento de prompts no fluxo operacional.

## Cuidados na revisão

Nenhum segredo ou dado real deve ser copiado para prompts, exemplos, documentação ou logs. O desenvolvedor deve revisar afirmações geradas contra o código, conferir testes e conexão local, e aprovar o conteúdo final destinado à publicação. Os limites atuais estão em [testes](testes-e-validacao.md) e [riscos](riscos-e-limitacoes.md).
