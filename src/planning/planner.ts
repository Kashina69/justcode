import fs from 'fs/promises';
import path from 'path';
import { getProviderForAlias } from '../providers/factory.js';
import { AppConfig } from '../config/index.js';
import { readPromptSync } from '../config/prompts.js';

export interface PlanList {
  active: string[];
  archived: string[];
}

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
   * Generates a rough draft plan using the fast LLM provider.
   * 
   * @param goal The target developer goal description.
   * @returns A promise resolving to the drafted plan text.
   */
  async draftPlan(goal: string): Promise<string> {
    const provider = getProviderForAlias('fast', this.config);

    const systemPrompt = readPromptSync('planner_draft_system.txt');

    const response = await provider.complete({
      systemPrompt,
      messages: [{ role: 'user', content: `Goal: "${goal}"` }],
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

    const systemPrompt = readPromptSync('planner_critique_system.txt');

    const response = await provider.complete({
      systemPrompt,
      messages: [{ role: 'user', content: `Draft Plan:\n${draft}` }],
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
