# Comparação por amostragem — agosto de 2026

Este documento registra a **amostragem inicial, antes do ajuste do DW**.
Os nomes e os 24 tratamentos derivados foram corrigidos posteriormente;
veja [tratamento-dw-agosto-2026.md](tratamento-dw-agosto-2026.md) para a
conferência da versão atual. Os resultados históricos abaixo são preservados.

**As contagens coincidiram, mas a saída completa ainda não é idêntica.**
Foram comparadas todas as linhas do recorte mensal, preservando nulos e
duplicidades. Esta amostragem não comprova equivalência da base inteira.
Não houve nova carga completa nem alterações nos bancos nesta etapa.

## Recorte e contagens

| Base | Filtro | Firebird | DW |
|---|---|---:|---:|
| Abertos | Emissão em agosto/2026 | 740 | 740 |
| Emitidos | Emissão em agosto/2026 | 12.919 | 12.919 |
| Faturados | Faturamento em agosto/2026 | 14.317 | 14.317 |
| Carteira | Clientes das três amostras | 1.053 | 1.053 |
| Metas | Ano 2026, incluindo META_08 | 322 | 322 |

O intervalo é `>= 2026-08-01` e `< 2026-09-01`; a data utilizada é
`DATA_EMISSAO_PEDIDO` para abertos/emitidos e `DT_FATURA` para faturados.
As bases de carteira e metas não têm o mesmo campo de data dos pedidos,
por isso recebem os filtros próprios descritos na tabela.

## Diferenças encontradas

- **Rótulos:** Firebird retorna espaços à direita em literais, como
  `RETIRA `, `NORDESTE    ` e `SUDESTE     `. PostgreSQL retorna os mesmos
  rótulos sem esses espaços. São diferenças de representação, registradas
  pela comparação estrita.
- **Status:** após remover apenas esses espaços no diagnóstico, restam
  45 linhas diferentes em abertos e 81 em emitidos, exclusivamente no campo
  STATUS. Uma consulta adicional comparou 26.621 documentos de agosto na
  origem e no staging: mesmas identidades/contagens, mas nove documentos
  com códigos de status diferentes. A diferença já existe entre a origem
  atual e o staging da carga anterior; é compatível com atualização no ERP.
- **Faturados:** todas as 14.317 linhas e suas 47 colunas originais coincidem
  após desconsiderar apenas os espaços à direita dos rótulos. A comparação
  estrita continua registrando esses espaços como diferença.
- **Carteira:** todas as 1.053 linhas e seis colunas coincidem estritamente.
- **Metas:** os valores das metas coincidem no recorte. Há dois valores
  vazios de USUARIOALTERACAO_METASVEN no Firebird que aparecem como NULL
  no DW. Além disso, 272 linhas usam CURRENT_TIMESTAMP nas consultas
  originais e têm horários distintos por terem sido geradas em momentos
  diferentes. Esses horários foram registrados estritamente e isolados
  em um diagnóstico separado, somente nas linhas AUTOINC_METASVEN=0.

Nos pedidos abertos/emitidos, a comparação de todas as outras colunas,
mantendo as duplicidades e removendo os espaços dos rótulos, também coincide.
Valores monetários, quantidades, pesos, volumes e datas do recorte não
apresentaram outras divergências nessa comparação. Isso não autoriza
ignorar STATUS na validação final ou afirmar equivalência integral.

## Pós-processamento do extrator

### Totais financeiros do recorte

Somando os valores das colunas originais com Decimal, os dois lados coincidem:

| Total das consultas SQL | Firebird | DW |
|---|---:|---:|
| VALOR_EMITIDO | R$ 21.593.691,62 | R$ 21.593.691,62 |
| VALOR_FATURADO | R$ 19.674.847,04 | R$ 19.674.847,04 |

O total faturado antes da apresentação em centavos é 19674847.040477 em
ambos os lados. Diferença entre as somas das colunas originais: zero.
A soma binária pandas de emitidos varia aproximadamente 3,7e-9 conforme
a ordem das linhas; as somas em Decimal e os valores em centavos coincidem.

Há uma diferença relevante no pós-processamento: VALOR_FATURADO_CLEAN,
gerado pelo extrator em float32 e serializado em CSV, soma 19674847.047659,
apresentado como **R$ 19.674.847,05**. Isso difere em um centavo da soma da
coluna original. VALOR_EMITIDO_CLEAN soma os mesmos R$ 21.593.691,62.
As colunas CLEAN ainda estão ausentes no DW e precisam preservar essa regra
para reproduzir os totais do legacy. Aplicar a mesma função original aos
dois lados reproduz o mesmo resultado CLEAN, apenas como diagnóstico.
Evidência local: `.local/sample-value-totals.json`.

O extrator original acrescenta sete colunas em abertos, sete em emitidos
e dez em faturados: datas `*_DATE` e valores `*_CLEAN`. Essas 24 colunas
ainda não existem nas respectivas views DW. Elas precisam ter suas regras
preservadas durante a migração do contrato de dados e das métricas.

O verificador executa a função original `extract_query` via AST, interceptando
somente a leitura e a escrita para aplicar o pós-processamento às amostras
reais. Também confere a representação CSV usada pelo writer original:
float32 em memória pode ter representação diferente ao ser serializado e
gravado como DOUBLE PRECISION. Aplicar a função aos dois lados é um
diagnóstico; não demonstra que essas regras já foram implementadas no Hop.

## Evidências e repetição

Versão DW comparada: `f8b582ff-b782-4dff-bac5-17e092210a4c`. A referência
Firebird foi capturada em 01/10/2026 às 10:43, em transação SNAPSHOT somente
leitura. O DW corresponde à carga concluída aproximadamente às 09:53.
Os dois lados não compartilham o mesmo snapshot da origem.

Verificação final: `npm test`, dez testes aprovados e nenhuma falha. Os testes
do comparador usam registros reais da amostra para conferir independência
da ordem, preservação de duplicidades e tratamento dos espaços nos rótulos.
Isso valida o mecanismo de conferência; não torna equivalentes as diferenças
documentadas acima.

- `etl/scripts/compare_sample.py`: consulta as cinco bases por leitura e
  compara multiconjuntos de linhas, mantendo todas as duplicidades.
- `etl/sql/validacao/firebird-*-agosto-2026.sql`: consultas originais com o
  filtro mensal externo para repetir a amostragem no Firebird.
- `etl/sql/validacao/postgresql-agosto-2026.sql`: recortes correspondentes
  nas views DW. O campo técnico registro_id não pertence ao contrato original.
- `.local/extractor-sample.json`: relatório agregado sem registros do ERP.
- `.local/sample-source-status.json`: consulta adicional dos status brutos.
- `.local/sample-2026-08/`: amostras privadas para repetir a comparação
  sem novas consultas. Diretório ignorado pelo Git.

Com as credenciais em variáveis de ambiente, na raiz de legacy-refatorado:

```powershell
..\legacy\.venv\Scripts\python.exe etl\scripts\compare_sample.py --year 2026 --month 8
```

Para repetir o diagnóstico sobre as mesmas amostras locais:

```powershell
..\legacy\.venv\Scripts\python.exe etl\scripts\compare_sample.py --from-cache
```

Antes de declarar equivalência completa, resolver o contrato das colunas
derivadas, conferir a preservação de strings vazias e comparar dados da
mesma versão da origem. A comparação completa fica adiada conforme a
escolha explícita do usuário; esta entrega é apenas a amostragem solicitada.
