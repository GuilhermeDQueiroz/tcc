# Verificação da preparação para Git

Preparação em 05/10/2026, para o repositório `GuilhermeDQueiroz/tcc`. O escopo é tornar o software publicável e reproduzível, preservando bancos, metas reais, credenciais e evidências locais.

## Mudanças verificáveis

- `.gitignore` e inspeção do índice para separar código de bancos, dumps, arquivos de ambiente, metas reais, referências privadas e registros de trabalho.
- Dependências npm fixadas, `.nvmrc`, engines, configuração de linhas e CI para testes públicos/build/conferência do índice.
- Perfil público independente dos dados e perfil completo de validação real mantido em `npm run test:real`.
- Configuração pública de metas sem valores definidos; configuração real existente permanece local, com precedência para dados persistidos.
- Comandos npm para executar Python/ETL a partir do próprio clone e de `.env` local, sem exigir o diretório irmão legacy para executar o produto.
- README, captura agregada da interface, guia de reprodução, roteiro para a banca, orientações de contribuição, segurança e atribuição de terceiros.

Testes de regressão reproduziram as ausências de template/perfis e verificaram casos de arquivos privados, credenciais, chave privada, tamanho, classificação de testes e resolução do executável Python. Casos controlados são somente testes do software; a API produtiva continua exigindo publicações reais.

## Execuções desta preparação

Uma cópia isolada foi exportada dos arquivos do índice Git, sem `.env`, metas privadas, `.local`, bancos ou dependências já instaladas. Nela foram executados os comandos de instalação e verificação pública, em Windows, com Node.js 24.16.0 e npm 11.13.0.

| Execução | Resultado em 05/10/2026 |
|---|---|
| `npm ci` na cópia limpa | Instalação concluída a partir do lockfile |
| `npm run check` na cópia limpa | 50 testes públicos aprovados, zero falhas; TypeScript/Vue e build aprovados; inspeção do índice aprovada |
| `npm run check:repository` | 342 arquivos, aproximadamente 4,50 MiB; sem ocorrências nas regras verificadas |
| `npm run test:etl` na cópia limpa | 32 fontes brutas, duas acrescentadas, cinco transformações e publicação atômica estruturalmente válidas; sem conexão aos bancos |
| `npm run test:real` no ambiente original | 120 testes aprovados, zero falhas, cancelamentos ou testes ignorados; inclui comparações com referências reais locais |
| Revisão independente | Sem achados críticos ou importantes; dois ajustes menores corrigidos e verificados por seis testes específicos |

A revisão verificou a rejeição de textos UTF-16/NUL pelo inspetor e o isolamento dos defaults de metas nos testes públicos. O scanner verifica regras explícitas e não substitui a revisão dos arquivos. A compilação ainda emite aviso sobre o tamanho do bundle de gráficos; isso não impediu a geração da interface.

Logs completos e relatório de conferência permanecem em `.local`, fora do Git. Não publicar os logs privados como condição para comprovar o código. A cópia limpa foi verificada localmente em Windows; a execução em Linux será confirmada pelo workflow do GitHub após a publicação.

As verificações em dados reais já registradas em [Visão Estratégica](visao-estrategica-logistica.md) e [Formação de Cargas](formacao-cargas-analise-operacional.md) pertencem às publicações ali identificadas. Nesta preparação não será alegada nova carga integral do Firebird nem nova avaliação gerencial.

O workflow da CI estará disponível após envio ao GitHub. A execução local de seus comandos não é uma execução do serviço GitHub Actions.
