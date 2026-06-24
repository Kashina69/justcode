import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { DbConfig } from './types.js';
import { askQuestion } from '../cli/ask-question.js';
import { selectOption } from '../cli/select-option.js';

const CONFIG_DIR = path.join(process.cwd(), '.agent', 'db');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Loads the DB configuration from .agent/db/config.json if it exists.
 */
export async function loadDbConfig(): Promise<DbConfig | null> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data) as DbConfig;
  } catch {
    return null;
  }
}

/**
 * Saves the DB configuration to .agent/db/config.json.
 */
export async function saveDbConfig(config: DbConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Interactive setup wizard for database configuration.
 */
export async function promptDbSetup(rl: readline.Interface): Promise<DbConfig> {
  console.log('\n\x1b[36m\x1b[1m--- Database Connection Setup ---\x1b[0m');

  const dbTypes: DbConfig['type'][] = ['sqlite', 'postgres', 'mysql', 'mongodb'];
  const dbTypeOptions = [
    'SQLite (Local database file)',
    'PostgreSQL (postgresql://...)',
    'MySQL (mysql://...)',
    'MongoDB (mongodb://...)',
  ];

  const typeIndex = await selectOption('Select database type:', dbTypeOptions);
  const type = dbTypes[typeIndex];

  let connPrompt = '';
  let defaultConn = '';
  if (type === 'sqlite') {
    connPrompt = 'Enter database file path (e.g., local.db):';
    defaultConn = 'local.db';
  } else if (type === 'postgres') {
    connPrompt = 'Enter connection string (e.g., postgresql://postgres:postgres@localhost:5432/mydb):';
    defaultConn = 'postgresql://postgres:postgres@localhost:5432/postgres';
  } else if (type === 'mysql') {
    connPrompt = 'Enter connection string (e.g., mysql://root:root@localhost:3306/mydb):';
    defaultConn = 'mysql://root:root@localhost:3306/mysql';
  } else {
    connPrompt = 'Enter connection string (e.g., mongodb://localhost:27017/mydb):';
    defaultConn = 'mongodb://localhost:27017/local';
  }

  let connectionString = await askQuestion(rl, `${connPrompt} (${defaultConn ? `default: ${defaultConn}` : ''}) `);
  if (!connectionString && defaultConn) {
    connectionString = defaultConn;
  }

  let name = await askQuestion(rl, 'Enter a name for this database connection (default: main): ');
  if (!name) {
    name = 'main';
  }

  const config: DbConfig = { type, connectionString, name };
  await saveDbConfig(config);

  console.log('\n\x1b[32m✔ Configuration saved successfully!\x1b[0m');
  return config;
}
