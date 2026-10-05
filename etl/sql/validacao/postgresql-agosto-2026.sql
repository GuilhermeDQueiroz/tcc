-- Somente leitura no PostgreSQL dados:5434. Mesmos recortes do Firebird.

SELECT * FROM dw.pedidos_abertos
WHERE data_emissao_pedido >= DATE '2026-08-01' AND data_emissao_pedido < DATE '2026-09-01';

SELECT * FROM dw.pedidos_emitidos
WHERE data_emissao_pedido >= DATE '2026-08-01' AND data_emissao_pedido < DATE '2026-09-01';

SELECT * FROM dw.pedidos_faturados
WHERE dtemissao_docfat >= DATE '2026-08-01' AND dtemissao_docfat < DATE '2026-09-01';

-- Valores efetivamente usados pelas métricas, após o tratamento do extrator.
SELECT SUM(valor_emitido_tratado::numeric) AS total_emitido
FROM dw.pedidos_emitidos
WHERE data_emissao_pedido >= DATE '2026-08-01' AND data_emissao_pedido < DATE '2026-09-01';

SELECT SUM(valor_faturado_tratado::numeric) AS total_faturado
FROM dw.pedidos_faturados
WHERE dtemissao_docfat >= DATE '2026-08-01' AND dtemissao_docfat < DATE '2026-09-01';
