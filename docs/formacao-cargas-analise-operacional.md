# Formação de cargas: ampliação para apoio à logística

Entrega de 2 de outubro de 2026, complementar à [primeira implementação](implementacao-logistica-primeira-entrega.md), utilizando as sete imagens enviadas pelo autor como referências de necessidades operacionais. Os valores das imagens não foram usados como dados ou metas do painel.

## Funcionalidades entregues

O painel `/cargas` passou a apresentar doze indicadores: pedidos abertos, sem carga, parcialmente alocados, totalmente alocados, cargas com saldo, quantidade sem carga e **valor, peso e cubagem em carga e sem carga**. As medidas se referem ao saldo ainda aberto, preservando a divisão dos itens entre cargas e saldo livre de alocação.

Foram acrescentados gráfico mensal de previsão de faturamento em reais, gráfico de peso previsto para faturamento em sete dias, mapa de cubagem sem carga por estado e tabela dos status dos pedidos no ERP. Estado, cidade, entrega/retirada, emissão, previsão de faturamento, idade e status do ERP complementam os filtros anteriores de empresa, alocação e pesquisa. A pesquisa também encontra clientes. Selecionar um estado no mapa aplica o filtro de estado.

As tabelas detalhadas incluem cliente, destino, entrega/retirada, descrição do produto, descrição da carga, valores, peso, cubagem e próxima previsão de faturamento. A tabela de status usa contagem de pedidos distintos e mostra a parte sem carga e parcialmente alocada. O status é o texto registrado no ERP, sem transformar seus nomes em prova de entrega física ou etapa efetivamente concluída.

## Fontes e publicação

A extração nativa Apache Hop passou de sete para **quatorze fontes** neste módulo: as sete anteriores mais `ITEM`, `ITEM_DETALHE`, `PESSOA`, `PESSOA_ENDERECO`, `CIDADE`, `UF` e `STATUS`. As tabelas de pedidos e itens são restritas ao recorte; os pequenos catálogos de cidade, UF e status são lidos integralmente. Campos adicionais do pedido e da carga identificam destino, modalidade, descrição e previsão.

O endereço utilizado para o destino é `LOCALENTREGA_DOCFAT`, ligado a `PESSOA_ENDERECO`, `CIDADE` e `UF`, seguindo o relacionamento da consulta original de Abertos. A primeira versão do mapa agregava por estado; a versão atual também mostra pontos de pedidos, preservando coordenadas ERP e complementando destinos por [CEP aproximado](geolocalizacao-cep.md). Não representa roteirização ou otimização de percursos. Não foram acrescentadas capacidades presumidas de veículos ou custos de frete.

O runner criou backup da publicação anterior antes da extração. As migrações são aditivas. Os novos campos dos fatos foram calculados e publicados na mesma transação que valida vínculos e saldos. A versão anterior dos fatos permanece preservada; os painéis anteriores em `dw` continuam com sua publicação própria.

## Regras das medidas

| Medida | Regra |
|---|---|
| Peso unitário | Peso bruto positivo da variação; na ausência, peso bruto positivo do produto; caso contrário, não disponível |
| Cubagem unitária | m³ positivos da variação; na ausência, m³ positivos do produto abaixo de 10, seguindo a restrição do cálculo original; caso contrário, não disponível |
| Peso/cubagem aberto | Medida unitária × quantidade aberta |
| Peso/cubagem em carga | Medida unitária × soma das quantidades abertas dos vínculos em carga |
| Peso/cubagem sem carga | Medida unitária × quantidade aberta ainda não alocada |
| Valor em carga/sem carga | Preço unitário truncado em seis casas × quantidade correspondente |
| Quantidade sem carga | Saldo aberto − saldo aberto em carga, sem descontar faturamento novamente |

As medidas de peso são armazenadas/calculadas em kg e exibidas em toneladas. Cubagem é exibida em m³. As medidas unitárias vêm do cadastro de produto/variação: não se somam totais cadastrados da carga com totais calculados dos itens. O tamanho em m³ não é percentual de ocupação do veículo, pois a capacidade não foi homologada.

Pedidos parcialmente alocados participam dos dois lados, apenas com suas quantidades correspondentes. **Valor sem carga inclui o saldo não alocado desses pedidos**, e não somente o valor integral dos pedidos classificados como completamente sem carga. Um vínculo já faturado com quantidade aberta zero não contribui para os cards de carga.

Campos ausentes, zero ou inválidos de medida unitária não geram cubagem física presumida. Quando existe medida conhecida parcial, o card identifica a cobertura incompleta; quando nenhum valor positivo conhecido pode ser apresentado com cobertura incompleta, exibe “Não disponível”. As tabelas identificam medidas incompletas. O recorte publicado nesta entrega apresentou cobertura integral de peso e cubagem.

## Previsões e seus limites

Para quantidade em carga, a data efetiva de previsão usa, em ordem, `DTPREVISAOFATURAMENTO_CARDOC`, `DTPREVISAOFATURAMENTO_CARGA` e `DTPREVISAOFATURAMENTO_DOCPED`. Para quantidade sem carga, usa a previsão do pedido. A próxima previsão exibida na carga é a menor data efetiva dos seus vínculos com saldo no recorte; os gráficos conservam a distribuição de cada vínculo em sua própria data.

O gráfico mensal reúne todas as previsões preenchidas dos saldos selecionados, inclusive previsões vencidas. O gráfico de sete dias abrange **a data de referência e os seis dias seguintes**, dividido entre quantidade em carga e sem carga. Ele mostra peso previsto para **faturamento**, não uma agenda confirmada de carregamento. Datas não preenchidas ficam fora dos gráficos e são quantificadas ao lado das previsões.

O filtro de previsão na pesquisa seleciona pedidos pela previsão do pedido. Não é um filtro da previsão efetiva de cada vínculo de carga. A seleção de pedido/código/cliente conserva o pedido completo para não modificar sua classificação de alocação. Datas de emissão não alteram o intervalo já extraído do Firebird; apenas restringem a publicação disponível.

A referência permanece 30/09/2026 e o recorte de emissão continua 01/01/2026 a 30/09/2026. Os saldos são os presentes na cópia anonimizada; a tela não reconstrói automaticamente saldo histórico nem apresenta atualização em tempo real da produção.

## Conferência efetivamente realizada

Uma consulta independente no Firebird, em transação de leitura, calculou peso, cubagem e valores a partir do cadastro e da quantidade líquida de carga registrada no detalhe do pedido. O DW utiliza a ponte de alocação já conciliada. Os agregados foram iguais com tolerância de um milionésimo na verificação matemática:

| Medida | Em aberto | Em carga | Sem carga |
|---|---:|---:|---:|
| Peso bruto (kg) | 3.253.730,35 | 1.035.565,50 | 2.218.164,85 |
| Cubagem (m³), antes da formatação | 6.728,0743 | 2.174,3521 | 4.553,7222 |
| Valor (R$), antes da formatação | 20.342.714,678543 | 6.387.837,425658 | 13.954.877,252885 |

A previsão efetiva de faturamento distribui as **40.550 unidades abertas** em 32.490 sem data, 3.915 com previsão vencida e 4.145 com previsão na referência ou futura. As consultas independentes sobre os fatos publicados conferiram essa divisão e cada mês/dia dos gráficos. Isso é uma conferência técnica das regras sobre a publicação, não uma confirmação de cumprimento futuro das datas.

O destino está disponível em todos os 1.335 pedidos do recorte, distribuídos por 16 estados e 386 cidades. A tabela de status apresenta 17 categorias do ERP. A série original por estado mantém a conciliação de cubagem sem carga. Na área interativa de formação de carga, o mapa representa o saldo aberto dos pedidos do recorte ou os vínculos da carga selecionada, conforme a seleção visível.

Build TypeScript/Vite aprovado. Verificação do DW com 21 conferências aprovada, incluindo cinco rejeições de publicação que preservam a versão anterior. Verificações da API e dos filtros aprovadas, junto aos cinco testes existentes de API/contratos/configuração/pesquisa. Testes Playwright em desktop, celular e planejamento operacional aprovados, incluindo expansão de hierarquia, preservação da tabela no loading, cubagem exibida, três gráficos, filtro de destino e limpeza de filtros.

Para repetir, com credenciais no ambiente e a cópia local configurada:

```powershell
python scripts/conferir-medidas-logistica.py
python scripts/verify-logistica.py
node scripts/verify-logistica-operacional.mjs
npm run build
npx playwright test tests/ui/logistica.spec.ts tests/ui/logistica-operacional.spec.ts tests/ui/logistica-selecao.spec.ts
node --test tests/logistics-selection.test.js
```

Evidências privadas em `.local/logistica-medidas-origem.json`, `.local/logistica-previsao-referencia.json`, `.local/logistica-operacional-verificacao.json` e capturas `.local/logistica-*.png`. Não contêm credenciais e não substituem a homologação da equipe de logística. Frete, capacidade de veículo, conferência de coleta, roteirização e indicadores concluídos de faturamento permanecem nas próximas etapas do plano.


## Navegação cruzada e destinos (02/10/2026)

A área central passa a apresentar o mapa à esquerda e duas tabelas simultâneas à direita: cargas e pedidos. As previsões de faturamento e a situação no ERP permanecem abaixo. Em telas pequenas, os painéis são empilhados e cada tabela mantém rolagem própria, altura estável e loading sobre o conteúdo existente.

A seleção é única e reversível:

- **Carga selecionada:** a tabela de cargas mantém as opções do recorte; a tabela de pedidos contém somente pedidos e itens alocados naquela carga. As quantidades, valores, peso, cubagem, previsões e totais usam os vínculos da carga. O saldo do pedido em outras cargas ou ainda sem carga não entra nesse recorte. Os itens são abertos automaticamente.
- **Pedido selecionado:** a tabela de pedidos mantém as opções do recorte; a tabela de cargas contém somente as cargas vinculadas ao pedido. Cada carga exibe apenas quantidades e medidas daquele pedido. O total de pedidos da tabela conta pedidos distintos, inclusive quando o mesmo pedido está dividido entre várias cargas.
- **Pedido sem carga:** a tabela de cargas fica vazia, com mensagem explícita. O pedido continua disponível no mapa e na consulta de destinos.
- **Troca e limpeza:** clicar em outra entidade substitui a seleção; clicar novamente na entidade ou em “Limpar seleção” restaura o recorte. Aplicar filtros ou atualizar os dados também limpa a seleção, para evitar manter vínculos de uma publicação anterior.

O mapa acompanha a seleção. Os indicadores superiores continuam representando os filtros aplicados, conforme aviso visível no painel. O estado clicado restringe a consulta local de cidades; clicar em uma cidade aplica UF e cidade nos filtros da análise. Pontos de pedidos são clicáveis e seus detalhes apresentam cliente, destino, valor, peso e cubagem. Há zoom, deslocamento e restauração da visão do Brasil. A lista de cidades fica em uma seção expansível para priorizar a visualização simultânea do mapa e das tabelas.

### Coordenadas e cobertura

A extração nativa do Hop foi inicialmente ampliada com `LATITUDE_PESSOA_END` e `LONGITUDE_PESSOA_END`, de `PESSOA_ENDERECO`, associadas pelo endereço de entrega do documento. Naquela entrega, a API usava somente a publicação PostgreSQL, sem geocodificação externa. A atualização de 06/10/2026 acrescentou o CEP à mesma fonte e um [cache local de localização aproximada](geolocalizacao-cep.md), mantendo as 14 fontes Hop.

A publicação aceita o par numérico com latitude entre -34 e 6, longitude entre -74 e -34, e latitude diferente de zero. Pares inválidos ou ausentes são publicados como nulos. Esse limite é uma checagem geográfica básica para a operação brasileira, sem certificar a precisão de cada cadastro. O mapa informa a origem ERP ou CEP aproximado; os pontos não comprovam entrega realizada.

Na execução `061684fb-7343-43dc-b01a-f338b3e66d9c`, 95 dos 1.335 pedidos têm coordenadas válidas. Pedidos sem coordenadas continuam na lista de cidades e nos agregados de estado quando têm UF válida. A cobertura da seleção é exibida junto ao mapa, sem inventar pontos para os pedidos restantes.

As quantidades e medidas publicadas permaneceram iguais: 4.685 itens, 2.125 vínculos, 58 cargas com saldo, 12.732 unidades em carga e 27.818 sem carga. As 21 verificações da publicação e a conciliação independente dos valores, peso e cubagem passaram após a ampliação.

A compilação TypeScript/Vite e os testes de unidade/API foram aprovados. A verificação de interface cobre a seleção carga → pedidos/itens → cargas com dados reais, limpeza, altura das tabelas, zoom, filtro por cidade, preservação durante loading, navegação e uso em celular. Os casos de pedido dividido, sem carga e seleção obsoleta também têm verificação isolada.


## Composição limpa e enquadramento dos painéis

A interface foi simplificada conforme a orientação de aproveitar a área da tela e seguir a composição de Pedidos em Aberto. Gráficos e tabelas usam o fundo da página, com títulos compactos, divisões discretas, rolagem interna e cabeçalhos/totais fixos. A coluna de identificação permanece visível durante a rolagem horizontal das tabelas.

Os doze indicadores ficam sempre visíveis, em uma grade responsiva, sem recolhimento. Valores monetários nos cards são abreviados em mil, mi ou bi com duas casas decimais; o valor exato permanece no título e na ajuda do indicador. A API e os cálculos não foram modificados.

Os blocos explicativos, o texto permanente de ausência de seleção, a barra de saldo aberto e os avisos extensos foram retirados da composição principal. Regras de recorte, alocação, cobertura geográfica e previsão continuam disponíveis na ajuda da formação de cargas. A seleção ativa é apresentada em uma etiqueta compacta com botão para limpar.

A consulta de destinos ocupa uma seção permanente de largura integral abaixo do mapa e das duas tabelas. As UFs são os primeiros níveis e se expandem em cidades, com medidas agregadas por estado e total geral sem duplicar pedidos. Cargas, pedidos e destinos não têm paginação: todos os registros do recorte ficam disponíveis na rolagem interna. A tabela de cargas mostra as 58 cargas com saldo aberto da publicação sem filtros; uma seleção de pedido restringe suas cargas como antes. Os títulos de cargas e pedidos foram ocultados, mantendo acesso às configurações e exportação.

A regressão visual verifica sidebar aberta/recolhida, destinos visíveis e larguras de 1.100, 1.440 e 1.850 pixels. Além dos limites das colunas, confere os limites internos de corpo, viewport, rolagem e rodapé, evitando sobreposição vertical entre cargas e pedidos. A altura é estável nas seleções e atualizações; em celular os painéis são empilhados.

Os filtros foram retirados da área principal e reunidos em uma janela modal no padrão visual dos filtros existentes, acessível pelo cabeçalho e pela sidebar. Estão disponíveis os doze campos suportados pela consulta logística: busca, empresa, alocação, entrega/retirada, status do ERP, idade, UF, cidade e limites inicial/final de emissão e previsão. Alterações ficam em rascunho até aplicar; cancelar preserva o recorte anterior. Intervalos invertidos são rejeitados, o foco é contido na janela e retorna ao botão de abertura.

O carregamento central da Formação de Cargas usa o mesmo componente, duração e transição de Pedidos em Aberto, tanto na abertura quanto nas atualizações e aplicações de filtros. As tabelas continuam montadas durante a consulta e mantêm seus loaders internos. O carregamento assíncrono dos gráficos também usa o mesmo componente de espera.
