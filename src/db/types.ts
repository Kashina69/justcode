export interface DbConfig {
  type: 'sqlite' | 'postgres' | 'mysql' | 'mongodb';
  connectionString: string;
  name: string;
}

export interface DbColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface DbTable {
  name: string;
  columns: DbColumn[];
}

export interface DbSchema {
  tables: DbTable[];
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  affectedRows?: number;
  info?: string;
}
