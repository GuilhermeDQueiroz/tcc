/** Pass runtime environment values to Hop in memory, without secret files or CLI arguments. */
public final class HopLauncher {
  public static void main(String[] args) throws Exception {
    boolean gui = args.length > 0 && args[0].equals("--gui");
    if (gui) args = java.util.Arrays.copyOfRange(args, 1, args.length);
    String[] names = {
      "DB_FIREBIRD_HOST", "DB_FIREBIRD_PORT", "DB_FIREBIRD_DB", "DB_FIREBIRD_USER",
      "DB_FIREBIRD_PASSWORD", "DB_FIREBIRD_URL", "DB_POSTGRES_HOST", "DB_POSTGRES_PORT",
      "DB_POSTGRES_DB", "DB_POSTGRES_USER", "DB_POSTGRES_PASSWORD", "ETL_RUN_ID",
      "HOP_CONFIG_FOLDER", "HOP_AUDIT_FOLDER", "HOP_SHARED_JDBC_FOLDERS",
      "LOGISTICS_START_DATE", "LOGISTICS_REFERENCE_DATE"
    };
    for (String name : names) {
      String value = System.getenv(name);
      if (value != null) System.setProperty(name, value);
    }
    System.setProperty("HOP_PLATFORM_OS", "Windows");
    System.setProperty("HOP_PLATFORM_RUNTIME", gui ? "GUI" : "Run");
    System.setProperty("HOP_AUTO_CREATE_CONFIG", "Y");
    if (gui) org.apache.hop.ui.hopgui.HopGui.main(args);
    else org.apache.hop.run.HopRun.main(args);
  }
}
