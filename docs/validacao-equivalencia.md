# Evidências da aplicação e da carga real — 01/10/2026

Destino: PostgreSQL 18, localhost:5434, banco dados, proprietário API, arquivos físicos em business-intelligence-logistica/banco/data. A aplicação produtiva usa somente o DW. Não há dados sintéticos, fallback ou nova extração Python.

## Publicação usada

Publicação DW atual: **2647add2-e8fe-4c70-a6b5-96d2b0d67d6d**, concluída em 01/10/2026 às 12:43:44, em 274,734 segundos. Essa execução nativa Hop reprocessou o staging existente. A extração bruta anterior foi f8b582ff-b782-4dff-bac5-17e092210a4c.

| Base | Registros publicados |
|---|---:|
| Pedidos em aberto | 4.793 |
| Pedidos emitidos | 336.202 |
| Pedidos faturados | 333.723 |
| Carteira de clientes | 20.862 |
| Metas de consultores | 5.801 |

O loader da aplicação mantém **336.189 emitidos** no contexto de referência 01/10/2026: as 13 emissões futuras são excluídas pela regra original. Contagem publicada e contagem consumida têm escopos distintos.

Os 32 espelhos staging contêm dados puros das projeções Firebird. Joins e tratamentos são executados entre staging e DW. São quatro dimensões, três fatos, carteira e metas. Contagens, timestamps e 12 índices dimensionais foram conferidos por SQL; DDL reaplicado de forma idempotente preservou os registros. Iniciar/parar o PostgreSQL e confirmar sua localização física também foram exercitados. As instâncias 5432/5433 permanecem preservadas.

## Origem: amostra por data

Conforme a escolha do usuário, a comparação com a extração original utilizou agosto/2026, com filtros específicos para emissão e faturamento. O comparador cobriu 184 campos lógicos das cinco bases, preservando duplicidades, campos brutos e derivados. A máscara explícita limita-se aos instantes gerados de 272 metas sem origem física; timestamps das 50 metas reais foram conferidos.

| Total tratado de agosto | Extrator/Firebird e DW |
|---|---:|
| Pedidos emitidos | R$ 21.593.691,62 |
| Pedidos faturados | R$ 19.674.847,05 |

Valores antes da formatação: 21593691.62 e 19674847.047659. Detalhes em [tratamento-dw-agosto-2026.md](tratamento-dw-agosto-2026.md). A comparação financeira usa as colunas tratadas CLEAN, como o dashboard original.

Essa amostra não comprova igualdade integral contemporânea das cinco consultas Firebird. Não foi feita uma nova leitura completa da origem nesta rodada.

## Cálculos: mesma publicação, referência executada

scripts/reference_full.py executou corpos de funções extraídos do AST do legacy: **121 capturas, zero erros**, com referência congelada em 01/10/2026. Relatórios e registros privados ficam em .local, não são fonte de dados da aplicação. Foram interceptados relógio e apresentação terminal; as fórmulas permaneceram originais. Imports de helpers foram disponibilizados globalmente para exercitar abas avançadas que lançavam UnboundLocalError no código original; os arquivos originais não foram modificados.

- Abertos: todos os cards comparados sobre os 4.793 registros; linhas numéricas e totalizadores das 23 dimensões originais comparados.
- Emitidos/Faturados: semanas atual/anterior/retrasada, canais, metas diárias/acumuladas, projeções, evolução, comparações anuais e geografia comparados no recorte real de agosto com seu histórico anterior.
- Carteira: todos os campos capturados de grupos/status/RFM no histórico completo, além de oportunidades, qualidade, recência, concentração e cobertura UF.
- Dimensões comerciais: **43 análises completas, 404.313 comparações numéricas e 155.462 comparações de centavos exibidos, nenhuma diferença** em linhas e totalizadores, incluindo períodos anteriores. Evidência .local/dimensions-real-verification.json; reprodução scripts/verify-dimensions.mjs. A rodada final concluiu em 01/10/2026 às 16:06:39 (Brasília).
- Hierarquias: summaries, aliases, campos especializados, períodos anteriores, ordenação das raízes, datas dos pedidos, customização e limites verificados com registros reais e árvores originais.

Durante a ampliação, 1.364 diferenças de contagem de grupos presentes somente no ano anterior foram detectadas e corrigidas: a contagem atual passou de uma unidade indevida para zero. A conferência completa foi repetida após a correção; os resultados financeiros não apresentaram divergências.

A referência de reduções .local/core-reference.json foi regenerada a partir das linhas reais normalizadas da publicação atual: 740 emitidas em agosto e 369 incluídas no backlog real. Sua reprodução pública é scripts/prepare-core-reference.py. O arquivo anterior, ligado à carga f8b582ff, foi preservado como histórico; não foi usado para certificar a publicação atual. Ordenação e tratamento das entradas alteraram algumas reduções entre essas versões, sem alteração artificial das fórmulas.

## Precisão e regras

Valores financeiros seguem Float64; peso, volume, quantidade, serviço e OTIF seguem Float32 original. Reduções Series reproduzem o pairwise NumPy e agregações groupby reproduzem Kahan/pandas. Identificadores/contagens são exatos; comparadores numéricos usam tolerância absoluta 1e-6 e relativa 1e-8; testes de redução e metas também exigem igualdade exata quando aplicável. Formatação pt-BR preserva arredondamento e centavos.

A API projeta nomes lógicos para as chaves do legacy. Nomes físicos copiados permanecem os da origem; nomes de campos derivados são normalizados. Veja [contrato-colunas-dw.md](contrato-colunas-dw.md).

## Execução e desempenho

API e interface estão implementadas nas três áreas. A aplicação compilada é servida em 127.0.0.1:3002; desenvolvimento em 5173. O launcher scripts/iniciar-dev.ps1 foi executado com sucesso, e parar-dev.ps1 encerrou somente o processo registrado, preservando o PostgreSQL. Senhas não são gravadas pelo launcher.

Uma consulta de backlog foi otimizada após análise real do plano: largura da CTE 610 → 119 bytes, temporários 24.715 → 5.562 blocos de 8 KiB e execução 4,063 → 2,083 segundos neste ambiente. A média resultante **637691.8251981444** continuou exatamente igual à função original. Essa medição específica não é um benchmark do painel completo.

Opções de filtros são coalescidas por publicação, área e data. Snapshots imutáveis permanecem até 30 minutos, com limite de três entradas; a versão publicada é consultada antes de cada acesso. O frontend confere também a versão ativa antes de aceitar opções, evitando misturar filtros e painel de cargas diferentes.

O diagnóstico dos 503 registrou `connection_timeout` ao abrir novas conexões, sem fila no pool. A configuração anterior encerrava conexões ociosas após dez segundos. A primeira correção (mínimo de uma conexão e retenção de cinco minutos) passou na regressão isolada, mas não eliminou uma nova abertura lenta na rodada extensa de navegador. A configuração atual abre as quatro conexões antes de aceitar requisições e mantém `min: 4`, `max: 4`, `idleTimeoutMillis: 0`, `connectionTimeoutMillis: 30000` e timeout SQL de 60 segundos. scripts/verify-pool.mjs confirmou quatro backends distintos, reutilizados após onze segundos, em PostgreSQL real, somente leitura. Evidência atual: .local/pool-warm-verification.json; a evidência anterior permanece como histórico.

Testes de domínio/ETL/HTTP após a integração da pesquisa original: **80 aprovados, zero falhas**, em 49,840 segundos. Build e TypeScript passaram após as correções solicitadas do resumo. A revisão segue painel por painel, conforme solicitação do usuário, sem declarar concluída a validação visual integral das três áreas.

Resumo de Abertos: sete testes de navegador aprovados (27,6 segundos), mais a integração real das cinco abas de Abertos aprovada (20 segundos). Após os ajustes finais de mapa/calendário/tabela, a organização foi novamente aprovada (16,8 segundos), incluindo a troca de métrica por resposta real da API. Não houve entradas novas em api.err.log nessas rodadas. A rodada extensa das três áreas foi interrompida para atender à revisão por painel e não é declarada aprovada.

O novo teste tests/open-organization.test.js confrontou exatamente o calendário, os valores de UF e os 14 grupos mensais de entrega/retirada com capturas das funções/expressão AST originais. scripts/reference-open-layout.py executa o groupby inline de pedidos_em_aberto.py sobre os mesmos registros reais já normalizados; não extrai nem fornece dados à aplicação. A revisão fonte/layout está em [mapa-paineis-validacao.md](mapa-paineis-validacao.md).

A pesquisa integrada agora usa o grão por pedido do original: groupby CODIGO_PEDIDO, primeiros campos de cliente/tipo/status, somas por item e média de nível de serviço. Totalizadores são reduzidos sobre os pedidos consolidados como em tot_ped_aberto. Os filtros locais não alteram os demais gráficos. A referência AST real de scripts/reference-open-orders.py passou em igualdade exata no teste de domínio; scripts/verify-open-orders.mjs confrontou a API real com 1.378 pedidos, três seleções reais e 22.760 campos, além dos totalizadores e 1.378 linhas CSV. Evidência: .local/open-orders-http-verification.json, concluída em 01/10/2026 às 18:40:22 (Brasília). A leitura HTTP é da mesma publicação DW; não amplia a amostra Firebird autorizada.

Após as 14 correções de interface solicitadas, a suíte focada passou com **10/10 testes de navegador**, usando respostas reais da API: estrutura sem introdução/guias/botões redundantes, ícones, tooltips por mouse e teclado, configurações, exportação CSV, tela cheia, KG/R$, dimensões, pesquisa consolidada, spinner e uso no celular. Evidência: .local/ui-review-final.log. O cenário de spinner/celular foi repetido com sucesso para registrar a captura após a animação do menu lateral, em .local/ui-review-mobile-final.log.

Os quatro cenários de compatibilidade de Abertos também passaram: renderização das cinco URLs antigas, pesquisa com colunas/ordenação/paginação/CSV, calendário com filtro de data e drilldown de código numérico. A primeira rodada encontrou dois seletores de teste incompatíveis com a nova configuração; foram atualizados e os dois cenários passaram na repetição. Evidências: .local/ui-review-integration.log e .local/ui-review-integration-retry.log. Esses resultados não representam uma nova aprovação da suíte extensa das três áreas. api.err.log permaneceu vazio nas verificações desta rodada.

Foi corrigida uma sobreposição real no celular: o fundo da sidebar bloqueava o botão de fechar os filtros. O diálogo de filtros agora aparece acima dessa camada; abertura e fechamento foram conferidos no navegador. Capturas atuais em tests/ui/screenshots/abertos-organizacao-completa.png, abertos-revisao-desktop.png, abertos-pesquisa-revisao.png e abertos-revisao-mobile.png. O painel segue aguardando avaliação visual do usuário antes da próxima etapa.

## Limites explícitos

1. Empates exatos no quicksort NumPy podem selecionar uma identidade diferente no limite de filhos da árvore. Na evidência atual de faturados, uma troca no valor 71112.72 possui os mesmos indicadores comparados; raízes, RFM e totais permanecem iguais. Não prometer identidade de todos os filhos em qualquer empate.
2. Não houve criação de casos artificiais. Fronteiras sem ocorrência nos dados reais, inclusive volume maior que 1.000 na amostra de agosto, permanecem sem exercício específico.
3. Uma falha real da publicação Hop com versão anterior intacta não foi injetada integralmente; publicação transacional e caminhos de erro foram examinados estruturalmente.
4. A abertura visual da GUI do Hop não integra esta evidência. Os arquivos nativos foram executados com sucesso e podem ser abertos pelo launcher.
5. Rodadas anteriores encontraram 503 intermitentes por timeout na abertura de conexão. A configuração atual passou na regressão real e nas rodadas focadas de Abertos; uma nova rodada extensa das três áreas continua pendente.
6. Avaliação com gestores e comparação com consolidação manual previstas no TCC não foram realizadas. O benchmark HTTP não as substitui.

O mapeamento de código e evidências está em [cobertura-aplicacao.md](cobertura-aplicacao.md), e as diferenças em relação à parte escrita estão em [relacao-com-tcc.md](relacao-com-tcc.md).
