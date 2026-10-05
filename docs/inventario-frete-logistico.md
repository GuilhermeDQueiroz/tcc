# Inventário inicial de frete

Etapa 7 do plano, iniciada em 04/10/2026. Inspeção da cópia Firebird local em transação somente leitura, com rollback. Relatório de agregados e SQL: `.local/frete-origem-auditoria.json`; consulta exploratória: `.local/probe_freight.py`. Não houve alteração do ERP, do ETL ou de fórmulas do painel.

## Conferência concluída

População de cargas: emissão de 01/01/2026 inclusive a 01/10/2026 exclusive, sem restringir ao saldo aberto do painel. Consulta agregada por empresa e mês; 5.152 cargas, todas na empresa 1, de janeiro a setembro. Esse universo é diferente das 58 cargas com saldo da publicação logística.

| Campo / medida | Resultado | Interpretação permitida |
|---|---:|---|
| `FRETECOMBINADO_CARGA` não nulo | 5.152 | Preenchimento técnico de 100% |
| Frete combinado positivo | 0 | Nenhum custo positivo nesse campo e recorte |
| Frete combinado igual a zero | 5.152 | Zero gravado; significado operacional ainda não confirmado |
| Frete combinado negativo | 0 | Nenhum negativo observado |
| Soma de frete combinado e atual | R$ 0,00 em ambos | Não sustenta percentual de custo realizado |
| `VLRBRUTOLIQUIDO_CARGA` nulo ou ≤ 0 | 31 cargas | Base da carga exige validação própria |
| Liberação de saída preenchida | 0 | Não usar como confirmação de viagem realizada |
| Vínculos a documentos tipo 1 | 102.975 em 4.684 cargas | Tipo armazenado; confirmar exclusões e completude |
| Vínculos a documentos tipo 2 | 11.268 em 1.189 cargas | Há populações potencialmente mistas; não somar contagens distintas de cargas entre grupos |

As contagens por tipo vêm de `CARGA_DOCUMENTOS` ligado a `DOCUMENTO_FATURA` pelo código de documento. Não representam notas fiscais emitidas, itens ou viagens concluídas. A semântica de assistência do tipo 2 precisa confirmação operacional.

## Candidatos identificados nos metadados

| Fonte | Campo / vínculo | Descrição encontrada / cuidado |
|---|---|---|
| `CARGA` | `FRETECOMBINADO_CARGA`, `FRETEATUALCOMBINADO_CARGA` | Combinado com transportador/autônomo; contratado não prova pagamento |
| `CARGA_DOCUMENTOS` | `VALORFRETE_CARDOC`, `VALORFRETEACESSORIO_CARDOC`, `OPCAOFRETE_CARDOC` | Valor por documento e opção autônomo/acessório/CTRC; não somar junto com cabeçalho sem conferir rateio |
| `NOTA_FISCAL` | `VALORFRETE_NF` | Frete da nota ou CTRC; descrição diferencia do frete autônomo |
| `NOTA_FISCAL` | `VALORFRETECTRC_NF` | Descrição: frete do CTRC vinculado à nota, usado para cálculo do custo; candidato a investigar, não fonte aprovada |
| `NOTA_FISCAL` | `VALORFRETEAUTONOMO_NF`, `VALORFRETEEMBUTIDO_NF`, `TIPOFRETE_NF` | Natureza e responsabilidade diferentes; repasse ao cliente não prova despesa paga |
| `TRANSP_ACERTOFRETE` | `CARGA_ACERTOFRETE`, `VLRFRETEDEVIDO_ACERTOFRETE` | Valor que o transportador tem direito de receber; conferir liquidação e vínculo financeiro |
| `OPERACAO_TRANSPORTE` e tabelas de pagamento | Componentes e parcelas ligados à operação | Metadados existem; cobertura e eventos de pagamento ainda não conferidos |

As quatorze projeções logísticas atuais não incluem os campos monetários de frete. Sua existência na origem não significa disponibilidade no DW. Além disso, a extração atual é limitada a pedidos com saldo: não é base suficiente para um denominador de faturamento realizado por si só.

## Pendências para implementar o indicador

1. Confirmar com a logística qual rotina/campo representa custo contratado ou realizado e o tratamento de entrega, retirada e terceiros.
2. Conferir cobertura e valores dos documentos, notas, acertos e pagamentos no mesmo período; distinguir zero confirmado, não informado e não aplicável.
3. Verificar chaves, cancelamentos/estornos e cardinalidade entre carga, nota, documento e custo. Somar custo uma vez no grão real.
4. Definir população financeira correspondente e eventual rateio, conservando centavos. Para carga mista, separar venda e assistência ou manter custo agregado com limitação explícita.
5. Somente então ampliar a extração nativa Hop, publicar fatos, criar API e interface e reconciliar contra a origem.

Após salvar as consultas concluídas, a tentativa de ampliar o inventário passou a receber erro de autenticação do Firebird. As consultas adicionais de valor por documento, nota e acerto estão preparadas no script, mas **não foram executadas com sucesso**. O relatório existente conserva apenas as três consultas concluídas; não atribuir cobertura ou custo conhecido às fontes adicionais.

No TCC, o percentual de frete permanece requisito em investigação. R$/kg faturado é receita dos produtos por massa e não o substitui. Nenhuma conclusão de ausência de custo logístico é sustentada pelo zero do campo combinado.
