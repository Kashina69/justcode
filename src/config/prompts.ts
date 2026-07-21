import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let installDir = path.resolve(__dirname, '..', '..');
if (!fs.existsSync(path.join(installDir, 'prompts'))) {
  installDir = path.resolve(__dirname, '..', '..', '..');
}
const promptsDir = path.join(installDir, 'prompts');

export type PromptName =
  | 'agent_system'
  | 'ask_user_guidance'
  | 'db_admin_system'
  | 'planner_draft_system'
  | 'planner_critique_system'
  | 'plan_injection_header'
  | 'manual_skill_header'
  | 'session_summary_system';

class PromptProvider {
  private cache = new Map<PromptName, string>();

  get(name: PromptName): string {
    const cached = this.cache.get(name);
    if (cached !== undefined) return cached;

    const filePath = path.join(promptsDir, `${name}.txt`);
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    this.cache.set(name, content);
    return content;
  }
}

export const prompts = new PromptProvider();

export function readPromptSync(filename: string): string {
  const name = filename.replace(/\.txt$/, '') as PromptName;
  return prompts.get(name);
}

export function readTemplateSync(filename: string): string {
  const name = filename.replace(/\.txt$/, '') as PromptName;
  return prompts.get(name);
}
