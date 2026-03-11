declare module 'sql.js' {
  interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): any[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    get(): any[];
    getColumnNames(): string[];
    free(): boolean;
    reset(): void;
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export type { Database, Statement, SqlJsStatic };
  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
}
