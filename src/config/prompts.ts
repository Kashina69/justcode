import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve installation directory dynamically to support both dev (src/) and prod (dist/src/) layouts
let installDir = path.resolve(__dirname, '..', '..');
if (!fs.existsSync(path.join(installDir, 'prompts'))) {
  installDir = path.resolve(__dirname, '..', '..', '..');
}
const promptsDir = path.join(installDir, 'prompts');

/**
 * Loads the contents of a prompt file from the prompts directory.
 * 
 * @param filename Name of the prompt file (e.g. 'agent_system.txt')
 * @returns The contents of the prompt file.
 */
export function readPromptSync(filename: string): string {
  const filePath = path.join(promptsDir, filename);
  try {
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch (error: any) {
    throw new Error(`Failed to read prompt file at "${filePath}": ${error.message}`);
  }
}
