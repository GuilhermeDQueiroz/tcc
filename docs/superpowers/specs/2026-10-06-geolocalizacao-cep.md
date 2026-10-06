# Localização aproximada por CEP

Escopo aprovado: extrair `PESSOA_ENDERECO.CEP_PESSOA_END` do endereço de entrega ligado por `DOCUMENTO_FATURA.LOCALENTREGA_DOCFAT`; preservar coordenadas válidas do ERP; consultar CEPs de destinos sem coordenadas; guardar resultados localmente; informar a origem dos pontos.

O Apache Hop continua responsável pela extração Firebird. O CEP bruto acompanha a publicação logística. Um comando Node separado consulta BrasilAPI CEP v2, sem credenciais de terceiros e sem consultas externas durante a abertura do painel. O cache `.local/geocoding-cep.json` fica fora do Git. A API combina dados publicados e cache, sem alterar fatos ou o ERP.

Todo resultado externo é aproximado: a API pode retornar um centro municipal. Não representa o imóvel nem uma rota. Validar CEP de oito dígitos, retorno do mesmo CEP, UF/cidade compatíveis e coordenadas numéricas na região brasileira. Resultados sem coordenadas, erros e conflitos continuam sem marcador; negativas têm nova tentativa após 24 horas. Coordenadas ERP têm prioridade. Resultados CEP têm validade de 180 dias, com atualização pelo comando em lote.

Node 24; nenhuma nova dependência. Cache escrito atomicamente, leitura inválida não impede mapas de ERP ou totais. Cache atualizado invalida respostas da API. Preservar quantidades, valores e distribuição por UF/cidade. Não publicar endereços ou cache real. Documentar limite de precisão e medir cobertura real, sem prometer cobertura integral.
