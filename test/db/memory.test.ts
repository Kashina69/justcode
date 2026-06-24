import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recordDbMemory, loadDbMemory, revalidateSchema } from '../../src/db/memory.js';
import { introspectSchema } from '../../src/db/schema.js';
import { DbConfig, DbSchema } from '../../src/db/types.js';
import fs from 'fs/promises';
import path from 'path';

vi.mock('../../src/db/schema.js', () => ({
  introspectSchema: vi.fn(),
  renderSchemaAscii: vi.fn().mockReturnValue('mock-ascii'),
  renderSchemaMermaid: vi.fn().mockReturnValue('mock-mermaid'),
}));

describe('DbMemory', () => {
  const config: DbConfig = { type: 'sqlite', connectionString: ':memory:', name: 'test-mem' };

  beforeEach(async () => {
    // Clean up .agent/db/memory directory before each test
    try {
      await fs.rm(path.join(process.cwd(), '.agent'), { recursive: true, force: true });
    } catch {}
  });

  afterEach(async () => {
    try {
      await fs.rm(path.join(process.cwd(), '.agent'), { recursive: true, force: true });
    } catch {}
  });

  it('should record and load database memory nodes successfully', async () => {
    const node = await recordDbMemory('Test memory', 'This is content', ['tag1']);
    expect(node.id).toBeDefined();
    expect(node.summary).toBe('Test memory');
    
    const index = await loadDbMemory();
    expect(index).toHaveLength(1);
    expect(index[0].summary).toBe('Test memory');
    expect(index[0].tags).toEqual(['tag1']);
  });

  it('should identify schema updates in revalidateSchema', async () => {
    const schema1: DbSchema = {
      tables: [
        {
          name: 'users',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false }],
        },
      ],
    };

    const schema2: DbSchema = {
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
            { name: 'role', type: 'TEXT', nullable: true, isPrimaryKey: false, isForeignKey: false },
          ],
        },
        {
          name: 'profiles',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false }],
        },
      ],
    };

    // First call caches schema1
    vi.mocked(introspectSchema).mockResolvedValueOnce(schema1);
    const res1 = await revalidateSchema(config);
    expect(res1.changed).toBe(true); // Initial caching counts as change

    // Second call compares schema2 with schema1
    vi.mocked(introspectSchema).mockResolvedValueOnce(schema2);
    const res2 = await revalidateSchema(config);
    expect(res2.changed).toBe(true);
    expect(res2.diff).toContain('Table "profiles" was created');
    expect(res2.diff).toContain('Column "role" was added to table "users"');

    // Third call with no changes
    vi.mocked(introspectSchema).mockResolvedValueOnce(schema2);
    const res3 = await revalidateSchema(config);
    expect(res3.changed).toBe(false);
  });
});
