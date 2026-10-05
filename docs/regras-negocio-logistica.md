# Regras de negócio e decisões em aberto

Estado em 04/10/2026. A base de comparação é o contrato entregue, detalhado no [dicionário](dicionario-indicadores-logisticos.md).

## Regras executadas e verificadas

1. A publicação é versionada. Staging contém projeções da origem; `002_publicar.sql` verifica relações e saldos antes de marcar a execução como publicada. Extração é feita pelo Apache Hop. Python inspeciona e confere agregados; não substitui o Hop na transferência de linhas.
2. Quantidade já faturada em uma carga não permanece como reserva aberta. Na conferência inicial, 13.752 unidades vinculadas menos 1.020 faturadas resultaram em 12.732 abertas em carga.
3. Itens livres e alocados conservam o saldo aberto. Cada medida financeira/física usa a quantidade da parcela correspondente, sem repetir o pedido completo em cada carga.
4. Filtrar/pesquisar um item conserva os demais itens do pedido na formação. Selecionar uma carga restringe o detalhamento às suas parcelas; selecionar um pedido mostra as cargas vinculadas a ele. Cards superiores continuam representando os filtros aplicados.
5. A previsão vencida exige data anterior à referência. Data igual à referência não é vencida; ausência de previsão é categoria própria. Pedido antigo e previsão vencida são análises diferentes.
6. A carteira representa o saldo da cópia publicada. Agrupar por emissão não reconstrói o saldo de cada mês. Sem eventos/snapshots suficientes, não apresentar série histórica de backlog da carteira.
7. Nível de Serviço/Lead Time estratégico é uma média por registro faturado. OTIF é a convenção de pontualidade de faturamento preservada, com cobertura visível. Alocação, faturamento e entrega são eventos distintos.
8. Abertura de uma prioridade substitui os filtros anteriores da formação, preserva os filtros compartilhados e descarta o intervalo de faturamento, que não restringe o saldo atual.
9. Medida ausente não vira zero conhecido. Regras de cobertura diferem por medida e estão documentadas no dicionário e na ajuda dos cards.

## Decisões para homologação

| Decisão | Evidência atual / questão | Dependência |
|---|---|---|
| Marco inicial e conclusão integral | Emissão e faturamento por registro entregues; conferir atendimento integral, cancelamentos e estornos por pedido | Novas métricas de ciclo por pedido |
| Pontualidade revisada | Definir prazo original/vigente, população e tratamento de prazo ausente | Nova versão do OTIF; manter versão atual identificada |
| Frete | Carga combinada, documento fiscal e pagamento têm significados distintos; [inventário inicial](inventario-frete-logistico.md) | Fonte do numerador, responsabilidade, vínculo e denominador conciliados |
| Assistência | Tipo 2 encontrado na origem; confirmar significado, saldo, fechamento e vínculo com venda original | Extração e painel próprios |
| Recolhimento | Campo de vínculo existe; confirmar solicitação versus realização e fonte do evento | Módulo de retorno |
| Expedição e entrega | Campos existem; saída liberada sem preenchimento no inventário de 2026 | Durações e indicadores físicos com cobertura suficiente |
| Frequência e história | Atualização por lote; retenção, snapshots e reprocessamento precisam critérios operacionais | Etapa 9 do plano |

A validação com a operação deve registrar responsável, data, recorte, resultado e divergências. Testes automatizados ou valores preenchidos na origem não representam, por si só, confirmação do significado operacional.

## Limites para redação do TCC

Descrever o produto como BI para acompanhamento da carteira, formação de cargas e desempenho de faturamento. Mapa apoia distribuição geográfica; não otimiza rotas. Não afirmar entrega no prazo e completa a partir do OTIF atual. Não relatar redução de esforço, ganho percentual, aplicação de questionário ou adoção de rotina antes de medir essas atividades.
