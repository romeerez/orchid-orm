export interface TableRlsConfig {
  enable?: boolean;
  force?: boolean;
}

export interface DbRlsOptions {
  tableRlsDefaults?: TableRlsConfig;
}
