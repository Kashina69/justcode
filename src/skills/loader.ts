import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
// @ts-ignore
import { glob } from 'fs/promises';
import { fileURLToPath } from 'url';
import { Skill } from './types.js';
import { parseSkillFile } from './parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let installDir = path.resolve(__dirname, '..', '..');
if (!fsSync.existsSync(path.join(installDir, 'skills'))) {
  installDir = path.resolve(__dirname, '..', '..', '..');
}

export class SkillLoader {
  private projectRoot: string;

  /**
   * Initializes the SkillLoader under the target project root.
   * 
   * @param projectRoot Target project directory, defaults to current working directory.
   */
  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Recursively reads built-in and project-specific skill markdown files,
   * parses them, and returns the loaded list.
   * 
   * @returns A promise resolving to an array of loaded Skill objects.
   */
  async loadSkills(): Promise<Skill[]> {
    const loadedSkills: Skill[] = [];
    const patterns: string[] = [];
    if (!process.env.VITEST) {
      patterns.push(path.join(installDir, 'skills', '**', '*.md'));
    }
    if (process.env.VITEST || path.resolve(installDir) !== path.resolve(this.projectRoot)) {
      patterns.push(
        path.join(this.projectRoot, 'skills', '**', '*.md'),
        path.join(this.projectRoot, '.agent', 'skills', '**', '*.md')
      );
    } else {
      patterns.push(
        path.join(this.projectRoot, '.agent', 'skills', '**', '*.md')
      );
    }

    for (const pattern of patterns) {
      try {
        // Native glob generator in Node.js 22+
        for await (const entry of glob(pattern)) {
          try {
            const rawContent = await fs.readFile(entry, 'utf-8');
            const skill = parseSkillFile(rawContent);
            if (skill) {
              loadedSkills.push(skill);
            }
          } catch (err) {
            // Skip un-parseable or un-readable files
          }
        }
      } catch (err) {
        // Ignore folder path check errors
      }
    }

    return loadedSkills;
  }
}
