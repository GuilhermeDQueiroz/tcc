# Localização aproximada por CEP de entrega

O mapa usa primeiro as coordenadas válidas do ERP. Quando faltam, pode aproveitar uma localização aproximada consultada pelo CEP. Círculos verdes identificam ERP; losangos azuis identificam CEP aproximado. Ao passar o mouse, o ponto mostra origem, CEP e medidas do pedido. A cobertura acompanha filtros e seleção de carga/pedido.

## Origem e precisão

O workflow nativo Apache Hop extrai `CEP_PESSOA_END` de `PESSOA_ENDERECO`, ligada ao pedido por `DOCUMENTO_FATURA.LOCALENTREGA_DOCFAT`. Esse é o CEP do endereço de entrega; não se usa o CEP genérico do cadastro de cidade. O valor é publicado como texto em `logistica.item_pedido.cep`, preservando zeros iniciais.

O enriquecimento usa [BrasilAPI CEP v2](https://brasilapi.com.br/docs#tag/CEP-V2). Sua [implementação de geolocalização](https://github.com/BrasilAPI/BrasilAPI/blob/main/lib/fetchGeocoordinateFromBrazilLocation.js) pode recorrer ao centro do município e não informa precisão do imóvel. Portanto, todos os pontos derivados são apresentados como **aproximados**, mesmo quando a resposta contém coordenadas. O mapa apoia análise de concentração geográfica; não localiza necessariamente a portaria, nem calcula distâncias rodoviárias ou rotas.

São aceitos CEPs de oito dígitos, com ou sem hífen, diferentes de `00000000`. O retorno deve ter o mesmo CEP, cidade compatível (ignorando acentos/caixa) e a mesma UF do endereço publicado. Coordenadas devem ser numéricas, passar pelo intervalo brasileiro usado no projeto e ficar dentro da UF no GeoJSON do mapa. Essa validação evita inconsistências evidentes; não certifica a posição exata. Uma UF diferente, ausência de coordenadas ou falha da consulta deixa o pedido sem marcador. Ele continua nos totais e na consulta de destinos.

## Executar

1. Publique novamente a logística com `npm run etl:logistics -- --database CAMINHO_DA_COPIA.FDB --start-date AAAA-MM-DD --reference-date AAAA-MM-DD`, com Hop/JDK e credenciais configurados conforme [reprodução](reproducao.md).
2. Configure as variáveis PostgreSQL do projeto no ambiente ou `.env` local.
3. Execute `npm run geocode:cep -- --limit 500`. O limite é de consultas novas, entre 1 e 10.000; o padrão é 500. Se `remaining` for maior que zero, repita o comando para completar o lote.
4. Atualize o painel `/cargas`. A API reconhece o arquivo atualizado e reconstrói o mapa; não precisa reiniciar o servidor.

O comando considera somente a publicação logística ativa, elimina CEPs duplicados e consulta destinos sem coordenadas válidas do ERP. As requisições são sequenciais, espaçadas em 300 ms, com timeout de 10 segundos. O resumo informa CEPs distintos, consultas, resultados aceitos, falhas, reutilizados e pendentes; são contagens de **CEPs**, não de pedidos.

## Cache e privacidade

O arquivo `.local/geocoding-cep.json` guarda CEP, UF/cidade retornados, coordenadas, provedor e data da consulta, sem nomes de clientes, documentos, números de pedidos ou logradouro completo. Fica fora do Git junto às demais evidências privadas. É gravado por substituição atômica após cada consulta. Execute uma instância do comando por vez.

Resultados aceitos são reutilizados por até 180 dias. Falhas e resultados incompatíveis recebem nova tentativa após 24 horas. A API não exibe pontos CEP expirados. Execute novamente o comando para atualizar entradas vencidas; apagar o cache opcional também permite consultar tudo novamente. Cache ausente ou ilegível mantém pontos ERP e totais disponíveis. Nenhuma consulta externa é feita ao abrir o painel.

Cada requisição externa transmite somente o CEP ao provedor. O cache permanece local; não é incluído no repositório da entrega. O enriquecimento não altera Firebird, fatos publicados, valores, quantidades ou pesos: somente a localização e sua origem na resposta da API.

## Verificação do recurso

Os testes públicos exercitam validação, prioridade do ERP, compatibilidade do retorno, persistência/reuso do cache, falhas, expiração, privacidade dos campos guardados, invalidação de respostas e preservação de medidas após selecionar cargas. Eles não dependem de banco ou rede externa.

O teste de navegador `tests/ui/logistica-cep.spec.ts` exige a API local com uma publicação real e um cache com pontos CEP aceitos. Confere a origem exibida, cobertura, ajuda, layout e ausência de consultas ao provedor pelo navegador. Usa a resposta real inalterada da API por `route.fetch`, evitando o limite do cache de inspeção do Chrome para esse payload grande.

## Resultado na cópia anonimizada — 06/10/2026

O Hop republicou o recorte de emissão de 01/01/2026 a 30/09/2026, com 4.685 itens, 1.335 pedidos, 2.125 vínculos e 58 cargas com saldo. Todos os pedidos tinham CEP de entrega; 468 CEPs distintos precisavam de consulta. Foram aceitos 447 resultados e 21 ficaram sem localização compatível. Uma segunda execução reutilizou as 468 entradas, sem novas requisições e sem pendências de lote.

| Cobertura por pedido | Resultado |
|---|---:|
| Coordenadas ERP preservadas | 95 |
| Localização aproximada por CEP | 1.192 |
| Total de pedidos com ponto | 1.287 de 1.335 (96,4%) |
| Pedidos que permanecem sem ponto aceito | 48 |

Essas são contagens de pedidos, não de destinos distintos: pedidos no mesmo CEP ou centro municipal podem compartilhar a posição no mapa. O número de retornos aceitos por CEP não equivale à contagem de pedidos; a compatibilidade também é verificada em cada endereço. Ausência de ponto não exclui medidas das tabelas e dos estados.

A conciliação independente preservou exatamente 40.550 unidades abertas, 12.732 alocadas, 27.818 sem carga, valor aberto, peso e cubagem. Também conferiu todos os 95 pares de coordenadas ERP antes/depois e a igualdade dos indicadores da API. Não houve simulação de dados, alteração do Firebird ou substituição de fatos publicados pelo cache.

Verificação: 59 testes públicos e 129 testes no perfil completo sem falhas; build aprovado; validação estrutural ETL aprovada; layout, seleção e origem CEP conferidos no navegador. A revisão independente não encontrou problemas críticos ou importantes. O ajuste de expiração identificado foi coberto por teste que falhou antes da correção e passou depois. Logs, cache e capturas da publicação real permanecem em `.local`, fora do Git.
