# Riscos e limitações técnicas

Probabilidade é qualitativa e contextual; não foi medida em produção. As mitigações recomendadas são trabalho futuro, salvo quando o texto indica mecanismo existente.

| Risco | Causa e impacto | Probabilidade | Mitigação existente | Mitigação recomendada |
|---|---|---|---|---|
| Importação incompleta ou incorreta | Arquivo pode ter valores válidos sintaticamente, mas errados semanticamente; altera indicadores | Média | Colunas obrigatórias, mês único, chave única, prévia e conferência de linhas | Validar totais de origem e amostras com responsável de negócio |
| Reimportação concorrente | Bloqueio em memória só coordena um processo; dois workers podem disputar o mesmo mês | Média | Transação por substituição e PK composta | Bloqueio no banco ou serialização por período; teste concorrente real |
| Indisponibilidade do PostgreSQL | Startup e consultas dependem diretamente da conexão | Média | Timeout configurável e mensagem de erro | Monitoramento, backup, procedimento de recuperação e teste de restauração |
| Mudança de schema | `CREATE IF NOT EXISTS` não migra tabelas existentes | Média | Criação inicial automática | Migrações versionadas e matriz de compatibilidade |
| Autenticação e autorização | Sessão depende de segredo local; bypass requer flag, mas token pode chegar por query string e entrar em histórico de navegador/proxy | Média | JWT validado, cookie assinado, checagem `admin` nas rotas sensíveis | Usar apenas corpo/header para token, segredo estável seguro, testes HTTP de perfis e cookie seguro em HTTPS |
| Auditoria e retenção | Evento registra diferenças e pode conter dados sensíveis; não há retenção automática | Média | Evento na mesma transação da reimportação | Política de retenção, revisão de acesso e trilha de restauração |
| Limpeza administrativa | `DROP SCHEMA ... CASCADE` elimina dados, prévias e logs | Média | Exige `admin` e texto de confirmação | Backup antes da operação e teste de restauração; reduzir privilégio operacional |
| Cálculo e escala | Pandas carrega dados em memória; `DOUBLE PRECISION` arredonda valores financeiros | Média | Filtros por período em memória e formatação visual | Medir volume, paginar/agregar no banco e avaliar `NUMERIC`/Decimal com migração planejada |
| Exportações | Arquivos contêm valores importados e podem circular fora do sistema | Alta | Geração em memória; base bruta só para `admin` | Classificação, controles de distribuição e testes de autorização por rota |
| Configuração copiada | Ambiente virtual e configuração da máquina anterior podem apontar a recursos inadequados | Alta em cópia local | `.config/` e `.env` ignorados; exemplos sem segredo | Recriar venv, conferir host local, usar conta e banco isolados |
| Manutenção das regras | Constantes e pontuação estão distribuídas entre Python e JavaScript | Média | Testes de fluxo e documentação de regras | Casos de aceitação por regra, revisão de negócio e eventual centralização planejada |

Não há backup, restauração, migração ou teste PostgreSQL real automatizado neste repositório. A validação manual local deve ser feita com dados sintéticos e sem executar limpeza de base compartilhada.

## Lacunas de contrato observadas nesta revisão

- JWT: valida claims temporais presentes, mas não exige `exp`; contrato de emissão e validade obrigatória não definido no repositório.
- Autorização: consulta autenticada não é limitada ao PA do usuário; a política esperada de segregação precisa ser especificada antes de qualquer mudança.
- Prévias: token não possui vínculo persistido à sessão; as rotas exigem `admin`, mas não verificam propriedade entre administradores.
- Auditoria: diferenças de reimportação não incluem identidade do operador e não cobrem primeira importação, login ou limpeza.
- Operação local: controle automático de navegador lê apenas variável do processo; sugestão de endereço de rede do launcher não altera o bind loopback.

A [lista para implementação autônoma](../README.md#o-que-ainda-precisaria-ser-documentado-para-implementação-autônoma) separa comportamento implementado de decisões ainda ausentes. Nenhuma dessas lacunas foi corrigida por alteração funcional nesta atividade.
