# Informação sensível e problemas de segurança

O repositório distribui o código da parte prática. Arquivos Firebird/PostgreSQL, dumps, senhas, metas comerciais e referências completas de validação ficam fora do Git. As conexões usam variáveis de ambiente; `.env.example` mantém campos de senha vazios.

O ambiente de aplicação é local, com API e PostgreSQL em loopback. Esta versão não implementa autenticação de usuários para exposição pública pela Internet; disponibilizar o código no GitHub não publica nem protege uma instância web.

Ao identificar credencial ou dado indevidamente exposto, comunique o autor por canal privado previamente combinado. Não publique o conteúdo sensível em uma issue. Caso a opção de relato privado esteja habilitada no GitHub, use-a na aba Security do repositório.

Uma credencial que entrou em histórico deve ser revogada/substituída; apagar apenas o arquivo em um commit posterior não remove a exposição anterior. Dados de diagnóstico também devem ser revisados antes de compartilhamento.
