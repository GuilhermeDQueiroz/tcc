# Tratamento e nomes do DW — agosto/2026

O Hop reprocessou o DW a partir do staging real existente, sem nova extração
do Firebird e sem dados sintéticos. Execução publicada:
`2647add2-e8fe-4c70-a6b5-96d2b0d67d6d`, concluída em 01/10/2026 às 12:43:44.
A extração bruta continua sendo `f8b582ff-b782-4dff-bac5-17e092210a4c`.

Campos copiados preservam o nome Firebird, em minúsculas no PostgreSQL.
Campos calculados/compostos usam português e snake_case. A colisão entre os
dois CODIGO_DOCFAT em faturados recebe contexto somente na entrega:
codigo_docfat_entrega. O pedido mantém codigo_docfat.

| Caso | Campo no DW |
|---|---|
| Cliente copiado de CLIENTE_DOCFAT | cliente_docfat |
| UF copiada de SIGLA_UF | sigla_uf |
| Descrição calculada do grupo do cliente | grupo_cliente_descricao |
| Valor emitido copiado de VLRBRUTOLIQUIDO_DOCITEMDET | vlrbrutoliquido_docitemdet |
| Valor emitido após tratamento | valor_emitido_tratado |
| Valor faturado após tratamento | valor_faturado_tratado |

A correspondência completa está em [contrato-colunas-dw.md](contrato-colunas-dw.md)
e no arquivo versionado etl/contrato-colunas-dw.json. Foram auditados 94 campos
copiados. Os sete tratamentos temporais e 17 numéricos correspondem aos 24
helpers que faltavam. Os valores anteriores ao tratamento continuam disponíveis.

O SQL reproduz Float32, correção do volume acima de 1000, representação decimal
curta do CSV e armazenamento Double Precision. As métricas que usavam CLEAN/DATE
devem consumir os campos correspondentes conforme esse contrato.
LOCALTIMESTAMP mantém as metas no tipo timestamp sem fuso da origem, evitando
promoção implícita do UNION para timestamptz e conversão para UTC pelo pandas.
Uma consulta separada confirmou zero diferenças nos dois relógios de auditoria
entre staging e DW nas metas cadastradas de 2026.

## Conferência efetivamente executada

O verificador leu as consultas originais adaptadas sobre o staging, aplicou a
função extract_query original e sua serialização CSV, e comparou a saída com
os campos já gravados no DW pelo Hop. Leitura em REPEATABLE READ, sem escrita
no banco; preservação de nulos, multiplicidade e volumes antes do tratamento.

| Base | Linhas da amostra | Campos conferidos | Resultado |
|---|---:|---:|---|
| Abertos | 740 | 45 | Igual |
| Emitidos | 12.919 | 45 | Igual |
| Faturados | 14.317 | 57 | Igual |
| Carteira | 1.053 | 6 | Igual |
| Metas | 322 | 31 | Igual com exclusão temporal declarada abaixo |

| Total tratado em agosto | Extrator original | DW publicado |
|---|---:|---:|
| Emitidos | R$ 21.593.691,62 | R$ 21.593.691,62 |
| Faturados | R$ 19.674.847,05 | R$ 19.674.847,05 |

O total faturado antes de arredondar para exibição é 19674847.047659 nos dois
lados; emitidos é 21593691.62. Esses valores também coincidem com os CLEAN
da amostra Firebird capturada anteriormente. O centavo de diferença observado
antes da correção foi resolvido usando o mesmo tratamento do extrator.

As contagens completas das cinco bases publicadas foram preservadas:
4.793 abertos, 336.202 emitidos, 333.723 faturados, 20.862 clientes e 5.801 metas.
As 32 contagens do staging e seus quatro campos timestamp foram conferidos.
Backup DW/ETL foi criado antes da migração em banco/backups. A reaplicação do
DDL preservou contagens e confirmou 12 índices das referências dimensionais.
A segunda execução completa pelo Hop levou 4min34s; a primeira levou 26min08s.

Evidências privadas: .local/real-load.json, .local/dw-treatment-sample.json e
logs nativos do Hop. Validação: verify_published.py, verify_dw_treatment.py e
npm test (13 testes aprovados). O workflow visualizável é
etl/workflows/reprocessar_dw.hwf; main.hwf mantém a carga completa usual.

## Limites desta evidência

Esta é uma comparação do staging existente com o DW na amostra de agosto;
não é comparação completa nem uma nova captura sincronizada do Firebird.
Os dois campos CURRENT_TIMESTAMP das 272 linhas de metas sem cadastro são
excluídos apenas nessas linhas, pois cada processamento gera um instante novo.
Os timestamps das 50 metas cadastradas foram comparados normalmente.
A amostra não contém volume acima de 1000; esse ramo da regra não foi
exercitado com registros reais nesta conferência.

As diferenças anteriores entre Firebird e staging — status atualizados,
preenchimento de espaços e duas strings vazias versus NULL — continuam
documentadas na [amostragem inicial](amostragem-extrator-agosto-2026.md).
Não há comprovação de 100% da origem completa ou de todas as métricas das telas.
A API e a interface das três áreas ainda estão na etapa posterior da migração.
