# Entrega e demonstração da parte prática

O endereço de entrega do código é [github.com/GuilhermeDQueiroz/tcc](https://github.com/GuilhermeDQueiroz/tcc). Esta preparação organiza a versão local; publicar no GitHub e escolher uma versão final para a banca são passos separados.

## O que entregar

1. Link do repositório e identificação do commit/tag efetivamente avaliado. O commit distingue a entrega das mudanças posteriores.
2. Monografia no formato exigido pela instituição. A parte escrita original permanece fora deste repositório de software.
3. Meio de acesso à cópia Firebird anonimizada ou ao material de dados autorizado para reprodução, separado do Git, com data/recorte e instruções de conexão.
4. Evidências efetivamente utilizadas no experimento e na avaliação gerencial, quando essas atividades forem realizadas. Relatórios privados completos podem ser apresentados ao avaliador sem entrarem no repositório público.

Não há versão final/tag de defesa definida nesta preparação. O [plano conciliado](plano-implementacao-logistica-tcc.md) identifica as etapas que ainda faltam. A CI verifica o software público, não declara concluída a pesquisa.

## Roteiro da demonstração

| Passo | Ação | O que explicar |
|---|---|---|
| 1 | Mostrar README e arquitetura | Firebird → Hop → staging → transformação/publicação → API → interface |
| 2 | Abrir workflow comercial e logístico no Hop | Extração nativa, SQL, granularidade, validações e identificação da publicação |
| 3 | Abrir `/estrategico` | Carteira versus histórico, períodos, cobertura, sete indicadores e cinco gráficos |
| 4 | Analisar uma prioridade | Valor livre, previsão vencida ou ausente; filtros transferidos à Formação de Cargas |
| 5 | Selecionar pedido/carga em `/cargas` | Parcelas livres/alocadas, itens, cargas vinculadas e conservação de valores/peso/m³ |
| 6 | Aplicar filtros e exportar um recorte | Correspondência entre totals e detalhamento; localizar os pedidos que explicam o agregado |
| 7 | Mostrar dicionário e matriz de fontes | Como o requisito acadêmico se liga a fonte, fórmula, tela e evidência |
| 8 | Apresentar validação e limitações | Equivalência técnica, SQL independente, testes públicos/reais e avaliação gerencial ainda pendente |

No recorte do autor, OTIF significa pontualidade de faturamento por registro. Não explicar esse resultado como entrega no prazo e completa. O mapa mostra distribuição, sem algoritmo de otimização de rotas. Não denominar R$/kg dos produtos como custo de frete.

## Registro da versão avaliada

Depois de publicar a versão aprovada:

```powershell
git rev-parse HEAD
git log -1 --format="%h %s"
```

Registre esse identificador na documentação da entrega, com as versões das publicações usadas no painel. Se houver uma tag final, seu nome deve corresponder ao estágio real do projeto; esta preparação não criou uma tag de conclusão.

## Avaliação acadêmica

A comparação manual × painel deve usar a mesma pergunta, população e resultado correto, medindo tempo e acurácia. A avaliação gerencial deve registrar participantes e respostas de acordo com o protocolo acordado com o orientador. Não converter tempo HTTP, quantidade de testes ou simples presença de um gráfico em ganho de produtividade ou utilidade percebida.
