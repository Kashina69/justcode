import fs from 'fs/promises';
import path from 'path';
import { executeQuery } from './executor.js';
/**
 * Introspects the database structure to build a DbSchema object.
 */
export async function introspectSchema(config) {
    const schema = { tables: [] };
    const mockConfirm = async () => true;
    if (config.type === 'sqlite') {
        // 1. Get tables
        const tableRes = await executeQuery(config, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';", mockConfirm);
        const tableNames = tableRes.rows.map((r) => r[0]);
        for (const tableName of tableNames) {
            if (!tableName)
                continue;
            // 2. Get column info
            const colRes = await executeQuery(config, `PRAGMA table_info("${tableName}");`, mockConfirm);
            // SQLite table_info output columns: cid, name, type, notnull, dflt_value, pk
            const columns = colRes.rows.map((r) => {
                const pkVal = parseInt(r[5], 10);
                return {
                    name: r[1],
                    type: r[2],
                    nullable: r[3] === '0',
                    isPrimaryKey: pkVal > 0,
                    isForeignKey: false,
                };
            });
            // 3. Get foreign keys
            const fkRes = await executeQuery(config, `PRAGMA foreign_key_list("${tableName}");`, mockConfirm);
            // SQLite foreign_key_list columns: id, seq, table, from, to, on_update, on_delete, match
            for (const fkRow of fkRes.rows) {
                const fromCol = fkRow[3];
                const toTable = fkRow[2];
                const toCol = fkRow[4];
                const col = columns.find((c) => c.name === fromCol);
                if (col) {
                    col.isForeignKey = true;
                    col.references = { table: toTable, column: toCol };
                }
            }
            schema.tables.push({ name: tableName, columns });
        }
    }
    else if (config.type === 'postgres') {
        const tableRes = await executeQuery(config, "SELECT table_name FROM information_schema.tables WHERE table_schema='public';", mockConfirm);
        const tableNames = tableRes.rows.map((r) => r[0]);
        for (const tableName of tableNames) {
            if (!tableName)
                continue;
            const colRes = await executeQuery(config, `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='${tableName}';`, mockConfirm);
            const columns = colRes.rows.map((r) => ({
                name: r[0],
                type: r[1],
                nullable: r[2] === 'YES',
                isPrimaryKey: false, // simplified for postgres
                isForeignKey: false,
            }));
            schema.tables.push({ name: tableName, columns });
        }
    }
    else if (config.type === 'mysql') {
        const tableRes = await executeQuery(config, 'SHOW TABLES;', mockConfirm);
        const tableNames = tableRes.rows.map((r) => r[0]);
        for (const tableName of tableNames) {
            if (!tableName)
                continue;
            const colRes = await executeQuery(config, `DESCRIBE \`${tableName}\`;`, mockConfirm);
            const columns = colRes.rows.map((r) => ({
                name: r[0],
                type: r[1],
                nullable: r[2] === 'YES',
                isPrimaryKey: r[3] === 'PRI',
                isForeignKey: r[3] === 'MUL',
            }));
            schema.tables.push({ name: tableName, columns });
        }
    }
    else if (config.type === 'mongodb') {
        const collRes = await executeQuery(config, 'show collections;', mockConfirm);
        // MongoDB show collections prints list of names
        const collections = collRes.rows.map((r) => r[0].trim());
        for (const collName of collections) {
            if (!collName)
                continue;
            // Fetch sample doc to guess fields
            const sampleRes = await executeQuery(config, `db.${collName}.findOne();`, mockConfirm);
            const columns = [];
            try {
                const doc = JSON.parse(sampleRes.rows[0][0]);
                if (doc) {
                    for (const key of Object.keys(doc)) {
                        columns.push({
                            name: key,
                            type: typeof doc[key],
                            nullable: true,
                            isPrimaryKey: key === '_id',
                            isForeignKey: false,
                        });
                    }
                }
            }
            catch {
                // Fallback if findOne fails or returns non-JSON
                columns.push({ name: '_id', type: 'objectId', nullable: false, isPrimaryKey: true, isForeignKey: false });
            }
            schema.tables.push({ name: collName, columns });
        }
    }
    return schema;
}
/**
 * Renders schema into a clean ASCII diagram.
 */
export function renderSchemaAscii(schema) {
    if (schema.tables.length === 0)
        return 'No tables/collections found.';
    let out = '';
    for (const table of schema.tables) {
        const title = `[Table: ${table.name}]`;
        const border = '+'.padEnd(title.length + 1, '-') + '+';
        out += `${border}\n| ${title} |\n${border}\n`;
        for (const col of table.columns) {
            let suffix = '';
            if (col.isPrimaryKey)
                suffix += ' (PK)';
            if (col.isForeignKey && col.references)
                suffix += ` (FK -> ${col.references.table}.${col.references.column})`;
            out += `  * ${col.name} : ${col.type}${suffix}${col.nullable ? '' : ' NOT NULL'}\n`;
        }
        out += '\n';
    }
    return out;
}
/**
 * Renders schema as a Mermaid ER Diagram string.
 */
export function renderSchemaMermaid(schema) {
    let out = 'erDiagram\n';
    const relations = [];
    for (const table of schema.tables) {
        out += `  "${table.name}" {\n`;
        for (const col of table.columns) {
            const typeStr = col.type.replace(/\s+/g, '_');
            const keyType = col.isPrimaryKey ? 'PK' : col.isForeignKey ? 'FK' : '';
            out += `    ${typeStr} ${col.name} ${keyType}\n`;
            if (col.isForeignKey && col.references) {
                relations.push(`  "${table.name}" ||--o{ "${col.references.table}" : "fk_${col.name}"`);
            }
        }
        out += '  }\n';
    }
    if (relations.length > 0) {
        out += '\n' + relations.join('\n') + '\n';
    }
    return out;
}
/**
 * Introspects database and saves details and diagrams into a markdown file.
 */
export async function saveSchemaToFile(schema, outputPath) {
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    const ascii = renderSchemaAscii(schema);
    const mermaid = renderSchemaMermaid(schema);
    const content = `# Database Schema Reference

## Visual ERD Diagram
\`\`\`mermaid
${mermaid}
\`\`\`

## Text Columns Definition
\`\`\`
${ascii}
\`\`\`
`;
    await fs.writeFile(outputPath, content, 'utf-8');
}
