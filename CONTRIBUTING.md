# Alterações no projeto

Use Node.js conforme `.nvmrc`, instale com `npm ci` e preserve `package-lock.json`. Separe mudanças de fórmula de mudanças visuais; as regras publicadas estão em `docs/dicionario-indicadores-logisticos.md`.

Antes de preparar um commit:

```powershell
npm test
npm run build
git add .
npm run check:repository
git diff --cached --stat
```

Confira a seleção de arquivos antes de enviar. Bancos, dumps, credenciais, metas reais e referências privadas permanecem locais. A verificação do índice também inspeciona arquivos adicionados à força; ela não substitui a revisão do material.

Uma alteração de indicadores exige testes de limites/ausências/filtros, definição atualizada e, quando depender da população real, reconciliação independente. Novos testes devem ser classificados em `scripts/test-suites.mjs`. O perfil público precisa funcionar sem `.local` ou diretórios irmãos. Testes controlados de regra não são resultados observados da empresa.

Para mudanças de interface, execute os testes de navegador pertinentes com a API real e confira teclado, filtros, estados de erro/vazio e telas menores. Screenshots detalhados de validação ficam nas pastas privadas; imagens de documentação devem conter somente o material destinado à entrega.

O projeto usa LF no código e CRLF nos scripts PowerShell, conforme `.gitattributes`. Credenciais e configuração de ambiente não devem entrar em issues, pull requests ou comentários públicos.
