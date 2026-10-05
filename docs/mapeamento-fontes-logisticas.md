# Rastreabilidade entre fontes, painel e TCC

Atualizado em 04/10/2026. A matriz separa implementação verificada de requisitos que ainda dependem de fonte ou avaliação. Referência acadêmica: texto original em `Parte Escrita`; ele permanece preservado.

| Requisito | Fonte / transformação | Indicador ou comportamento / tela | Evidência | Parte do TCC |
|---|---|---|---|---|
| Identificar saldo de pedidos | `DOCUMENTO_FATURA`, `DOCUMENTO_ITEM`, `DOCUMENTO_ITEM_DETALHE`; Hop → `logistica_stage` → `logistica.item_pedido` | Quantidades/valor aberto em `/cargas` | `scripts/conferir-vinculos-logistica.py`; [primeira entrega](implementacao-logistica-primeira-entrega.md) | Objetivos, ETL, modelagem, resultados |
| Separar livre de alocado | `CARGA_ITENS` e `CARGA_DOCUMENTOS`; agregação da ponte antes do join | Saldo livre/alocado, hierarquia carga → pedido → item | `scripts/verify-logistica.py`, `tests/logistics-selection.test.js`; reconciliação por item | Modelagem dimensional, construção do painel |
| Planejar peso e cubagem por destino | `ITEM`, `ITEM_DETALHE`, `PESSOA`, `PESSOA_ENDERECO`, `CIDADE`, `UF`, `STATUS` | Peso, m³, valor e mapa em `/cargas` | `scripts/conferir-medidas-logistica.py`, `verify-logistica-operacional.mjs`; [análise operacional](formacao-cargas-analise-operacional.md) | Levantamento, indicadores, resultados |
| Priorizar previsão | `DOCUMENTO_PEDIDO`; previsão por vínculo/carga/pedido | Vencidos, sem previsão e próximos dias | `scripts/verify-logistica-operacional.mjs`, `tests/logistics-filters.test.js`, `tests/strategic.test.js` | Regras, apoio à decisão |
| Acompanhar etapa da carga | Marcos de separação/conferência/fechamento/saída em `CARGA` → `logistica.alocacao` | Classificação por marco registrado em `/cargas` | Testes de domínio e inventário de cobertura | Resultados com limite de registro; duração por etapa pendente |
| Visão estratégica da carteira | `logistica.item_pedido` e `logistica.alocacao` publicados | Sete cards, quatro prioridades em `/estrategico` | `scripts/verify-strategic.mjs`, testes de prioridades | Construção do painel, casos de decisão |
| Desempenho de faturamento | `QUERY_FATURADOS.sql` → staging comercial → `dw.pedidos_faturados` | Nível de Serviço, OTIF, R$/kg, t por período, modalidade | `tests/strategic.test.js`; SQL independente por mês | Indicadores, resultados; definir proxy de faturamento |
| Navegar da prioridade aos pedidos | API estratégica → filtros logísticos → `/cargas` | Recorte preservado e pedidos explicando o total | `tests/strategic-navigation.test.js`, `tests/ui/strategic-priorities.spec.ts` | Utilidade funcional, demonstração |
| Percentual de frete | Candidatos em `CARGA`, `CARGA_DOCUMENTOS`, `NOTA_FISCAL`, acerto/transporte; fonte ainda não homologada | Não implementado | [Inventário de frete](inventario-frete-logistico.md) | Objetivos/indicadores: requisito pendente |
| Assistências e recolhimentos | Tipos e vínculos a confirmar; fora da população de venda atual | Módulo próprio pendente | Inventário inicial, sem prova de conclusão do processo | Escopo ampliado do plano; não relatar entrega |
| Evolução real do saldo | Snapshots/eventos suficientes ainda não entregues | Histórico do saldo pendente | Série de emissão atual não substitui snapshots | Limitações e trabalhos futuros |
| Benefício gerencial | Tarefas reais, procedimento manual e participantes | Tempo/acurácia, Likert e comentários | Avaliação ainda não aplicada | Metodologia e avaliação de resultados |

## Artefatos do fluxo executado

- Extração logística: `etl/scripts/build_logistica.py`, `etl/logistica-fontes.json`, quatorze pipelines em `etl/pipelines/logistica`, workflow `etl/workflows/logistica_local.hwf`.
- Preparação/publicação: `etl/sql/logistica/001_preparar.sql` e `002_publicar.sql`; tabelas `logistica.execucao`, `logistica.item_pedido`, `logistica.alocacao`.
- Domínios: `api-server/domain/logistics.js`, `logistics-operations.js`, `strategic.js`; repositórios logístico e estratégico.
- Apresentação: `src/views/FormacaoCargas.vue`, `VisaoEstrategica.vue` e stores correspondentes.
- Comercial preservado: 32 projeções brutas, quatro dimensões e três fatos; [catálogo de equivalência](catalogo-equivalencia.md).

Os dois fluxos têm publicações independentes. A Visão Estratégica informa ambas as versões; não afirmar que uma única execução Hop atualiza atomicamente todos os módulos. Os IDs e horários da conferência estão em [Visão Estratégica](visao-estrategica-logistica.md).
