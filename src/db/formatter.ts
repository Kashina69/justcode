import { QueryResult } from './types.js';

/**
 * Formats a QueryResult as a premium-looking ASCII table.
 */
export function formatQueryResult(result: QueryResult): string {
  if (result.rows.length === 0) {
    return result.info || 'No rows returned.';
  }

  const columns = result.columns;
  const colWidths = columns.map((col) => col.length);

  // Find max widths
  for (const row of result.rows) {
    for (let i = 0; i < columns.length; i++) {
      const valStr = row[i] !== null && row[i] !== undefined ? String(row[i]) : 'NULL';
      if (valStr.length > colWidths[i]) {
        colWidths[i] = valStr.length;
      }
    }
  }

  // Build borders
  const buildBorder = () => {
    return '+' + colWidths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
  };

  const border = buildBorder();
  let out = border + '\n';

  // Format headers
  out += '|' + columns.map((col, idx) => ` ${col.padEnd(colWidths[idx])} `).join('|') + '|\n';
  out += border + '\n';

  // Format rows
  for (const row of result.rows) {
    out += '|' + columns.map((_, idx) => {
      const val = row[idx];
      const valStr = val !== null && val !== undefined ? String(val) : 'NULL';
      return ` ${valStr.padEnd(colWidths[idx])} `;
    }).join('|') + '|\n';
  }

  out += border + '\n';
  out += `(${result.rows.length} row(s) returned)\n`;
  return out;
}

/**
 * Formats database errors with a nice red block interface.
 */
export function formatError(error: string): string {
  return `\n\x1b[31m\x1b[1mError executing query:\x1b[0m\n\x1b[31m${error}\x1b[0m\n`;
}
