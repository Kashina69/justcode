import fs from 'fs/promises';
import path from 'path';
import { Skill } from './types.js';

export async function loadSkills(skillsDir?: string): Promise<Skill[]> {
  const dir = skillsDir || path.join(process.cwd(), 'skills');
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const skills: Skill[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFile = path.join(dir, entry.name, 'SKILL.md');
        try {
          const raw = await fs.readFile(skillFile, 'utf-8');
          const content = stripFrontmatter(raw);
          if (content.trim()) {
            skills.push({ name: entry.name, content });
          }
        } catch { /* no SKILL.md in this dir */ }
      }
    }
    return skills;
  } catch {
    return [];
  }
}

export function stripFrontmatter(text: string): string {
  if (text.startsWith('---')) {
    const end = text.indexOf('---', 3);
    if (end !== -1) {
      return text.slice(end + 3).trim();
    }
  }
  return text.trim();
}
