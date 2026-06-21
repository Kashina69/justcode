import { ModelProvider, ConversationMessage } from '../providers/types.js';
import { Skill } from './types.js';
import { AppConfig } from '../config/index.js';
import { getProviderForAlias } from '../providers/factory.js';
import { readPromptSync } from '../config/prompts.js';

export class SkillMatcher {
  private config: AppConfig;

  /**
   * Initializes the SkillMatcher with config to query the fast model.
   * 
   * @param config The application configuration.
   */
  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Matches the user's query against loaded skill descriptions using the fast LLM alias.
   * 
   * @param taskDescription The query/prompt entered by the developer.
   * @param skills List of all loaded Skill objects.
   * @returns A promise resolving to an array of matching Skill objects.
   */
  async matchSkills(taskDescription: string, skills: Skill[]): Promise<Skill[]> {
    if (skills.length === 0) {
      return [];
    }

    const provider = getProviderForAlias('fast', this.config);

    const skillsSummary = skills
      .map((s) => `- Name: "${s.name}"\n  Description: "${s.description}"`)
      .join('\n');

    const systemPrompt = readPromptSync('skills_match_system.txt');

    const prompt =
      `Available Skills:\n${skillsSummary}\n\n` +
      `User Request:\n"${taskDescription}"\n\n` +
      `Output JSON array of matching skill names:`;

    try {
      const result = await provider.complete({
        systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        availableTools: [],
        modelAlias: 'fast',
      });

      // Parse output
      const cleanText = result.textContent.trim().replace(/^```json|```$/g, '').trim();
      const matchedNames = JSON.parse(cleanText) as string[];

      return skills.filter((s) => matchedNames.includes(s.name));
    } catch (error) {
      // Fallback: keyword matching in case the provider call fails
      const matched: Skill[] = [];
      const query = taskDescription.toLowerCase();
      for (const skill of skills) {
        if (
          query.includes(skill.name.toLowerCase()) ||
          skill.description
            .toLowerCase()
            .split(/\s+/)
            .some((word) => word.length > 3 && query.includes(word))
        ) {
          matched.push(skill);
        }
      }
      return matched;
    }
  }
}
