import { exec } from 'child_process';
import { DbConfig, QueryResult } from './types.js';

/**
 * Checks if a query is read-only.
 */
export function isQueryReadOnly(query: string, type: DbConfig['type']): boolean {
  const q = query.trim().toLowerCase();
  if (type === 'mongodb') {
    return (
      q.includes('.find(') ||
      q.includes('.count(') ||
      q.includes('.aggregate(') ||
      q.includes('.findone(') ||
      q.includes('show collections') ||
      q.includes('getcollectionnames')
    );
  }
  // SQL read-only keywords
  return (
    q.startsWith('select') ||
    q.startsWith('show') ||
    q.startsWith('describe') ||
    q.startsWith('explain') ||
    q.startsWith('pragma')
  );
}

/**
 * Executes a query/command on the configured database via shell.
 */
export async function executeQuery(
  config: DbConfig,
  query: string,
  onConfirmWrite: () => Promise<boolean>
): Promise<QueryResult> {
  const isReadOnly = isQueryReadOnly(query, config.type);

  if (!isReadOnly) {
    const confirmed = await onConfirmWrite();
    if (!confirmed) {
      throw new Error('Database write operation cancelled by user.');
    }
  }

  return new Promise((resolve, reject) => {
    let cmd = '';

    if (config.type === 'sqlite') {
      // Use headers and csv mode for sqlite to easily parse it
      cmd = `sqlite3 -header -csv "${config.connectionString}"`;
    } else if (config.type === 'postgres') {
      cmd = `psql "${config.connectionString}" --csv`;
    } else if (config.type === 'mysql') {
      // MySQL CSV mode can be emulated or tab-separated can be parsed.
      // -B/--batch prints results using tab as separator, which is easy to parse.
      cmd = `mysql "${config.connectionString}" -B`;
    } else if (config.type === 'mongodb') {
      // Run command in mongosh
      cmd = `mongosh "${config.connectionString}" --quiet`;
    }

    const child = exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || error.message));
      }
      try {
        const result = parseCliOutput(stdout, config.type);
        resolve(result);
      } catch (err: any) {
        reject(new Error(`Failed to parse database output: ${err.message}\nRaw output:\n${stdout}`));
      }
    });

    if (child.stdin) {
      child.stdin.write(query + '\n');
      child.stdin.end();
    }
  });
}

/**
 * Parses CLI output based on the database type.
 */
function parseCliOutput(stdout: string, type: DbConfig['type']): QueryResult {
  const lines = stdout.trim().split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { columns: [], rows: [], info: 'Command executed successfully.' };
  }

  if (type === 'mongodb') {
    // Attempt to parse MongoDB JSON/object output
    const fullText = lines.join('\n');
    return {
      columns: ['Result'],
      rows: [[fullText]],
      info: 'MongoDB query executed.',
    };
  }

  // Parse CSV for SQLite / Postgres
  if (type === 'sqlite' || type === 'postgres') {
    const rows: string[][] = [];
    // Basic CSV parser for simplicity
    for (const line of lines) {
      // Note: simple split by comma, handles basic columns. A full CSV parser could be used if needed.
      const row = line.split(',').map((val) => {
        let clean = val.trim();
        if (clean.startsWith('"') && clean.endsWith('"')) {
          clean = clean.slice(1, -1);
        }
        return clean;
      });
      rows.push(row);
    }
    const columns = rows.shift() || [];
    return { columns, rows };
  }

  // Tab-separated for MySQL
  if (type === 'mysql') {
    const rows = lines.map((l) => l.split('\t'));
    const columns = rows.shift() || [];
    return { columns, rows };
  }

  return { columns: [], rows: [] };
}

/**
 * Tests connection to the database by running a simple query.
 */
export async function testConnection(config: DbConfig): Promise<boolean> {
  try {
    let query = 'SELECT 1;';
    if (config.type === 'mongodb') {
      query = 'db.adminCommand({ ping: 1 });';
    }
    const res = await executeQuery(config, query, async () => true);
    return res.rows.length > 0 || res.info !== undefined;
  } catch (err) {
    console.error(`Connection test failed: ${(err as Error).message}`);
    return false;
  }
}
