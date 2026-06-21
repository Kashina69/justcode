import fs from 'fs/promises';
import path from 'path';
import { Skill } from './types.js';
import { AppConfig } from '../config/index.js';

export class SkillMatcher {
  private config: AppConfig;

  /**
   * Initializes the SkillMatcher with config.
   * 
   * @param config The application configuration.
   */
  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Matches the user's query against loaded skills deterministically.
   * 
   * @param taskDescription The query/prompt entered by the developer.
   * @param skills List of all loaded Skill objects.
   * @returns A promise resolving to an array of matching Skill objects.
   */
  async matchSkills(taskDescription: string, skills: Skill[]): Promise<Skill[]> {
    const taskDescLower = taskDescription.toLowerCase();

    // 1. Special command routing: if user runs /analyze or /anyalize, only analyze skill should be active.
    if (taskDescLower.startsWith('/analyze') || taskDescLower.startsWith('/anyalize') || taskDescLower.includes('analyze this codebase')) {
      const analyzeSkill = skills.find((s) => s.name === 'analyze');
      return analyzeSkill ? [analyzeSkill] : [];
    }

    const active: Skill[] = [];

    // 2. coding-efficiency is the default skill when we are writing code (always on otherwise)
    const codingEfficiency = skills.find((s) => s.name === 'coding-efficiency');
    if (codingEfficiency) {
      active.push(codingEfficiency);
    }

    // 3. Read dependencies from package.json in the current working directory
    let dependencies: string[] = [];
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      dependencies = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
      ];
    } catch {
      // Ignore if package.json does not exist or is invalid
    }

    // 4. Dependency-specific rules (e.g. Next.js)
    if (dependencies.includes('next')) {
      const nextSkill = skills.find((s) => s.name === 'nextjs-conventions' || s.name === 'next');
      if (nextSkill && !active.includes(nextSkill)) {
        active.push(nextSkill);
      }
    }

    // 5. Simple keyword matches against task description
    for (const skill of skills) {
      if (active.includes(skill)) {
        continue;
      }
      if (taskDescLower.includes(skill.name.toLowerCase())) {
        active.push(skill);
      }
    }

    // 6. If the requirement is big or there is not enough data, use the analyze skill too.
    const isBigRequirement =
      taskDescLower.includes('refactor') ||
      taskDescLower.includes('migrate') ||
      taskDescLower.includes('rewrite') ||
      taskDescLower.includes('architecture') ||
      taskDescLower.includes('large') ||
      taskDescLower.includes('complex') ||
      taskDescLower.includes('big');

    let hasAnalyzedData = false;
    try {
      const overviewPath = path.join(process.cwd(), 'agent', 'project-overview.md');
      await fs.access(overviewPath);
      hasAnalyzedData = true;
    } catch {
      // Missing analyzed files
    }

    if (isBigRequirement || !hasAnalyzedData) {
      const analyzeSkill = skills.find((s) => s.name === 'analyze');
      if (analyzeSkill && !active.includes(analyzeSkill)) {
        active.push(analyzeSkill);
      }
    }

    return active;
  }
}

