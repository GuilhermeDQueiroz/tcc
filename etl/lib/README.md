# Drivers JDBC do ambiente verificado

Coloque nesta pasta os arquivos de driver baixados das distribuições oficiais. Os `.jar` não são versionados. O launcher inclui esta pasta em `HOP_SHARED_JDBC_FOLDERS`.

| Driver | Arquivo verificado | SHA-256 |
|---|---|---|
| Firebird Jaybird | `jaybird-6.0.6.jar` | `b051a1609ec64d0e9609c5bc47d82a2857b60dce47bcef22601842d0c24423d1` |
| PostgreSQL JDBC | `postgresql-42.7.12.jar` | `31fbf6f06b2217fb51d5100cee51b22625cc81640da0679b47914e54c1e6377c` |

Fontes: [Jaybird/Firebird](https://www.firebirdsql.org/en/jdbc-driver/) e [PostgreSQL JDBC](https://jdbc.postgresql.org/download/). Essas são as versões dos binários usados no ambiente do autor, não uma afirmação de que sejam as versões mais recentes.

Para conferir um arquivo recebido no Windows:

```powershell
Get-FileHash .\etl\lib\jaybird-6.0.6.jar -Algorithm SHA256
Get-FileHash .\etl\lib\postgresql-42.7.12.jar -Algorithm SHA256
```
