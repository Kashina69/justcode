import { describe, it, expect, vi } from 'vitest';
import { isQueryReadOnly, executeQuery } from '../../src/db/executor.js';
import { DbConfig } from '../../src/db/types.js';
import { exec } from 'child_process';

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('DbExecutor', () => {
  describe('isQueryReadOnly', () => {
    it('should correctly identify SQL read-only queries', () => {
      expect(isQueryReadOnly('SELECT * FROM users;', 'sqlite')).toBe(true);
      expect(isQueryReadOnly('SHOW TABLES;', 'mysql')).toBe(true);
      expect(isQueryReadOnly('DESCRIBE users;', 'mysql')).toBe(true);
      expect(isQueryReadOnly('EXPLAIN query;', 'postgres')).toBe(true);
      expect(isQueryReadOnly('PRAGMA table_info(users);', 'sqlite')).toBe(true);
      
      expect(isQueryReadOnly('INSERT INTO users VALUES (1);', 'sqlite')).toBe(false);
      expect(isQueryReadOnly('UPDATE users SET name = "a";', 'sqlite')).toBe(false);
      expect(isQueryReadOnly('DELETE FROM users;', 'sqlite')).toBe(false);
      expect(isQueryReadOnly('DROP TABLE users;', 'sqlite')).toBe(false);
    });

    it('should correctly identify MongoDB read-only queries', () => {
      expect(isQueryReadOnly('db.users.find();', 'mongodb')).toBe(true);
      expect(isQueryReadOnly('db.users.count();', 'mongodb')).toBe(true);
      expect(isQueryReadOnly('db.users.aggregate();', 'mongodb')).toBe(true);
      
      expect(isQueryReadOnly('db.users.insertOne({});', 'mongodb')).toBe(false);
      expect(isQueryReadOnly('db.users.updateOne({});', 'mongodb')).toBe(false);
      expect(isQueryReadOnly('db.users.deleteMany({});', 'mongodb')).toBe(false);
    });
  });

  describe('executeQuery', () => {
    it('should prompt confirmation for write query and block if rejected', async () => {
      const config: DbConfig = { type: 'sqlite', connectionString: 'test.db', name: 'test' };
      const onConfirmWrite = vi.fn().mockResolvedValue(false);

      await expect(
        executeQuery(config, 'DROP TABLE users;', onConfirmWrite)
      ).rejects.toThrow('Database write operation cancelled by user');
      
      expect(onConfirmWrite).toHaveBeenCalled();
    });

    it('should execute successfully if read-only or confirmed', async () => {
      const config: DbConfig = { type: 'sqlite', connectionString: 'test.db', name: 'test' };
      const onConfirmWrite = vi.fn().mockResolvedValue(true);

      const mockChild = {
        stdin: {
          write: vi.fn(),
          end: vi.fn(),
        },
      };

      vi.mocked(exec).mockImplementation((cmd: any, cb: any) => {
        // Mock success callback
        cb(null, 'id,name\n1,Alice\n2,Bob', '');
        return mockChild as any;
      });

      const res = await executeQuery(config, 'SELECT * FROM users;', onConfirmWrite);
      expect(res.columns).toEqual(['id', 'name']);
      expect(res.rows).toEqual([['1', 'Alice'], ['2', 'Bob']]);
    });
  });
});
