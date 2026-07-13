import { describe, it, expect } from 'vitest';
import { renderSchemaAscii, renderSchemaMermaid } from '../../src/db/schema.js';
import { DbSchema } from '../../src/db/types.js';

describe('DbSchema Rendering', () => {
  const schema: DbSchema = {
    tables: [
      {
        name: 'users',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'name', type: 'TEXT', nullable: true, isPrimaryKey: false, isForeignKey: false },
        ],
      },
      {
        name: 'posts',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'user_id', type: 'INTEGER', nullable: false, isPrimaryKey: false, isForeignKey: true, references: { table: 'users', column: 'id' } },
        ],
      },
    ],
  };

  it('should render clean ASCII ERD representation', () => {
    const ascii = renderSchemaAscii(schema);
    expect(ascii).toContain('[Table: users]');
    expect(ascii).toContain('[Table: posts]');
    expect(ascii).toContain('* id : INTEGER (PK) NOT NULL');
    expect(ascii).toContain('* user_id : INTEGER (FK -> users.id) NOT NULL');
  });

  it('should render correct Mermaid ER diagram syntax', () => {
    const mermaid = renderSchemaMermaid(schema);
    expect(mermaid).toContain('erDiagram');
    expect(mermaid).toContain('"users" {');
    expect(mermaid).toContain('INTEGER id PK');
    expect(mermaid).toContain('INTEGER user_id FK');
    expect(mermaid).toContain('"posts" ||--o{ "users" : "fk_user_id"');
  });
});
