# Ambiente Apache Hop usado no projeto

A carga real foi executada com Apache Hop 2.19.0, JDK 21 e PostgreSQL 18 no Windows. Python é o launcher/verificador; pipelines e workflows nativos fazem a extração, transformação e escrita.

1. Configure HOP_HOME para a pasta de instalação do Hop e HOP_JAVA_HOME para o JDK 21. Configure POSTGRES_BIN se os binários PostgreSQL não estiverem em C:\Program Files\PostgreSQL\18\bin.
2. Os drivers JDBC Firebird e PostgreSQL ficam em etl/lib e no runtime Hop preparado pelo executor. Eles não são versionados. O launcher usa a instalação local configurada.
3. Inicie o banco do projeto: banco/scripts/iniciar.ps1. O destino é dados em localhost:5434.
4. Para visualizar os arquivos, execute etl/scripts/abrir-hop.ps1. O projeto tem Home na pasta etl e metadados em metadata. O workflow inicial é workflows/main.hwf.
5. Para estabelecer conexões reais, execute abrir-hop.ps1 -Conectar e informe as credenciais solicitadas em memória. Os arquivos de conexão permanecem parametrizados.
6. Para executar a carga completa, siga etl/CONFIGURACAO_EXTRACAO_PEDIDOS.md. O acesso ao Firebird exige a rede da origem; o destino PostgreSQL é local e exclusivo do projeto.
7. Para transformar o staging já carregado, use etl/scripts/run_hop.py --somente-dw com as variáveis PostgreSQL configuradas. Essa opção não consulta o Firebird.

Não executar a extração ao iniciar a aplicação. A API usa apenas a última publicação com status publicado em etl.execucao_carga. A documentação detalhada de variáveis, SQL, drivers, projeto e execução está em [CONFIGURACAO_EXTRACAO_PEDIDOS.md](../etl/CONFIGURACAO_EXTRACAO_PEDIDOS.md).
