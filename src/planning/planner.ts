import fs from 'fs/promises';
import path from 'path';
import { getProviderForAlias } from '../providers/factory.js';
import { AppConfig } from '../config/index.js';
import { readPromptSync } from '../config/prompts.js';
import { parseSkillFile } from '../skills/parser.js';

import { PlanList } from './types.js';

export class PlanningManager {
  private projectRoot: string;
  private plansDir: string;
  private archivedDir: string;
  private config: AppConfig;

  /**
   * Initializes the PlanningManager.
   * 
   * @param config The application configuration context.
   * @param projectRoot Target project directory, defaults to current working directory.
   */
  constructor(config: AppConfig, projectRoot: string = process.cwd()) {
    this.config = config;
    this.projectRoot = path.resolve(projectRoot);
    this.plansDir = path.join(this.projectRoot, '.agent', 'plans');
    this.archivedDir = path.join(this.plansDir, 'archived');
  }

  /**
   * Loads custom planner skill from skills folder, falling back to static prompt file.
   */
  private async loadPlannerSkill(skillName: string, fallbackPromptFile: string): Promise<string> {
    try {
      const skillPath = path.join(this.projectRoot, 'skills', skillName, 'SKILL.md');
      const raw = await fs.readFile(skillPath, 'utf-8');
      const parsed = parseSkillFile(raw);
      if (parsed) {
        return parsed.content;
      }
    } catch {
      // Fallback
    }
    return readPromptSync(fallbackPromptFile);
  }

  /**
   * Loads project memory (.agent/memory.md) and analyzed files (agent/) to provide grounding context.
   */
  private async loadImprovisationContext(): Promise<string> {
    let context = '';

    // 1. Load project memory
    try {
      const memoryPath = path.join(this.projectRoot, '.agent', 'memory.md');
      const memory = await fs.readFile(memoryPath, 'utf-8');
      if (memory.trim()) {
        context += `\n### Project Memory (Timeline of decisions):\n${memory.trim()}\n`;
      }
    } catch {
      // Memory file may not exist yet
    }

    // 2. Load codebase analysis files made by analyze skill
    const analyzeFiles = [
      { name: 'project-overview.md', path: path.join(this.projectRoot, 'agent', 'project-overview.md') },
      { name: 'folder-structure.md', path: path.join(this.projectRoot, 'agent', 'folder-structure.md') },
      { name: 'code-conventions.md', path: path.join(this.projectRoot, 'agent', 'code-conventions.md') },
    ];

    let hasAnalyzeData = false;
    for (const file of analyzeFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        if (content.trim()) {
          context += `\n### Codebase Analysis context (${file.name}):\n${content.trim()}\n`;
          hasAnalyzeData = true;
        }
      } catch {
        // File may not exist yet
      }
    }

    return context;
  }

  /**
   * Generates a rough draft plan using the fast LLM provider.
   * 
   * @param goal The target developer goal description.
   * @returns A promise resolving to the drafted plan text.
   */
  async draftPlan(goal: string): Promise<string> {
    const provider = getProviderForAlias('fast', this.config);
    const systemPrompt = await this.loadPlannerSkill('planner', 'planner_draft_system.txt');
    const codebaseContext = await this.loadImprovisationContext();

    const userContent = codebaseContext
      ? `Here is the codebase overview, folder structure, code conventions, and project memory context to help ground your plan:\n${codebaseContext}\n\nGoal: "${goal}"`
      : `Goal: "${goal}"`;

    const response = await provider.complete({
      systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      availableTools: [],
      modelAlias: 'fast',
    });

    return response.textContent.trim();
  }

  /**
   * Critiques and rewrites the drafted plan using the smart LLM provider.
   * 
   * @param draft The rough plan text drafted previously.
   * @returns A promise resolving to the revised final proposed plan text.
   */
  async critiqueAndRewrite(draft: string): Promise<string> {
    const provider = getProviderForAlias('smart', this.config);
    const systemPrompt = await this.loadPlannerSkill('plan_review', 'planner_critique_system.txt');
    const codebaseContext = await this.loadImprovisationContext();

    const userContent = codebaseContext
      ? `Here is the codebase overview, folder structure, code conventions, and project memory context to help ground your plan review:\n${codebaseContext}\n\nDraft Plan:\n${draft}`
      : `Draft Plan:\n${draft}`;

    const response = await provider.complete({
      systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      availableTools: [],
      modelAlias: 'smart',
    });

    return response.textContent.trim();
  }

  /**
   * Saves the plan contents to .agent/plans/<planId>.md.
   * 
   * @param planId The unique identifier of the plan.
   * @param content The plan markdown text.
   */
  async savePlan(planId: string, content: string): Promise<void> {
    await fs.mkdir(this.plansDir, { recursive: true });
    const planPath = path.join(this.plansDir, `${planId}.md`);
    await fs.writeFile(planPath, content, 'utf-8');
  }

  /**
   * Scans and returns names of active and archived plans.
   * 
   * @returns A promise resolving to the PlanList catalog.
   */
  async listPlans(): Promise<PlanList> {
    const active: string[] = [];
    const archived: string[] = [];

    // Scan active plans
    try {
      const files = await fs.readdir(this.plansDir, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.md')) {
          active.push(file.name.replace(/\.md$/, ''));
        }
      }
    } catch {
      // Ignore if directory doesn't exist yet
    }

    // Scan archived plans
    try {
      const files = await fs.readdir(this.archivedDir, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.md')) {
          archived.push(file.name.replace(/\.md$/, ''));
        }
      }
    } catch {
      // Ignore if archived directory doesn't exist
    }

    return { active, archived };
  }

  /**
   * Archives an active plan by moving it to the archived subdirectory.
   * 
   * @param planId The target plan identifier.
   * @returns A promise resolving to true if successful, false otherwise.
   */
  async archivePlan(planId: string): Promise<boolean> {
    const activePath = path.join(this.plansDir, `${planId}.md`);
    const archivedPath = path.join(this.archivedDir, `${planId}.md`);

    try {
      await fs.access(activePath);
      await fs.mkdir(this.archivedDir, { recursive: true });
      await fs.rename(activePath, archivedPath);
      return true;
    } catch {
      return false;
    }
  }
}
