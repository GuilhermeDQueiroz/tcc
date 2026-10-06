# Geolocalização por CEP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ampliar o mapa com destinos aproximados por CEP, mantendo a origem identificada.

**Architecture:** Extração nativa Hop publica CEP do endereço de entrega. Comando Node enriquece CEPs distintos e grava cache local; repositório aplica apenas coordenadas faltantes e inclui a versão do cache nas respostas. Interface distingue pontos ERP e CEP aproximado.

**Tech Stack:** Apache Hop, PostgreSQL, Node 24, Vue, ECharts; sem novas dependências.

**Spec:** `docs/superpowers/specs/2026-10-06-geolocalizacao-cep.md`

## Global Constraints

- Coordenadas ERP têm prioridade. Resultados externos são sempre aproximados.
- Nenhuma consulta externa na abertura do painel; nenhuma alteração no ERP ou nos fatos financeiros.
- Cache e evidências reais ficam em `.local`, fora do Git.
- Node 24; nenhuma nova dependência.

## Review Focus

- CEP com zero inicial permanece texto; inválidos não geram consulta.
- Retorno sem coordenadas, cidade/UF divergente e falha HTTP não geram ponto.
- Arquivo ausente/corrompido mantém painel e totais operantes.
- Atualização do cache chega à API sem esperar o TTL da publicação.
- Pedidos em várias cargas mantêm medidas e origem após seleção.

### Task 1: Cache e consulta em lote

**Files:** criar `api-server/geolocation.js`, `scripts/geocode-cep.mjs`, `tests/geolocation.test.js`; registrar teste em `scripts/test-suites.mjs` e comando no `package.json`.

**Interfaces:** `normalizeCep(value)`, `validCoordinates(lat,lon)`, `readGeoCache(path)` retorna `{version,entries}`; `enrichLocations(items,cache)` retorna cópias com `geo_origin`; `updateGeoCache(items,{path,fetchImpl,now,limit,delayMs})` retorna contagens e escreve cache atomicamente.

- [x] Escrever testes de normalização, preferência ERP, conflitos e totais conservados, persistência/reuso, negativas e cache inválido.
- [x] Executar `node --test tests/geolocation.test.js`: observar falhas antes da implementação.
- [x] Implementar validação, consulta BrasilAPI com timeout e cache; CLI busca publicação atual PostgreSQL, limita e espaça consultas.
- [x] Executar teste e suíte pública.
- [x] Revisar diff da unidade.

### Task 2: CEP na publicação e API

**Files:** `etl/scripts/build_logistica.py`, pipeline/contrato/DDL gerados, `etl/sql/logistica/002_publicar.sql`, repositórios logística/estratégico, domínio logística, testes repositório/seleção.

**Interfaces:** fatos passam a incluir `cep`; snapshot inclui `geoVersion`; pedidos incluem `cep` e `geo_origin`.

- [x] Escrever testes de atualização do cache com mesma publicação e propagação até o mapa; observar RED.
- [x] Adicionar CEP à fonte nativa, regenerar artefatos e publicar campo por migração aditiva.
- [x] Aplicar enriquecimento no snapshot e incluir versão nas chaves de cache.
- [x] Executar testes públicos e validação estrutural ETL.

### Task 3: Interface, documentação e prova real

**Files:** `src/domain/logistics/formation.ts`, `src/views/FormacaoCargas.vue`, `src/components/analytics/AnalyticChart.vue`, README e documentação de formação.

- [x] Testar origem no mapa e medidas após seleção; observar RED.
- [x] Exibir ERP e CEP aproximado em marcadores, tooltip e cobertura.
- [x] Documentar comando, privacidade, cache e limites.
- [x] Executar `npm run check`.
- [x] Republicar recorte real pelo Hop e consultar CEPs em lote autorizado; medir cobertura e conciliação.
- [x] Verificar tela real e obter revisão independente do conjunto.

## Registro de conclusão

Implementado em 06/10/2026. Testes RED→GREEN observados para validação/cache, extração do CEP, invalidação da publicação e origem após seleção. Revisão independente concluída; expiração corrigida por teste de regressão. Validação real: 95 ERP + 1.192 CEP aproximado = 1.287 / 1.335 pedidos; 48 sem ponto. Medidas e pares ERP preservados. Segunda execução: 468 entradas reutilizadas, zero consultas. 59 testes públicos, 129 no perfil completo, build e verificações de navegador aprovados. Evidências privadas permanecem em `.local`; resultado agregado em `docs/geolocalizacao-cep.md`.
