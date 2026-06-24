import { ConversationMessage, ModelAlias } from '../providers/types.js';

/**
 * Dynamically routes the request to the most appropriate model alias.
 *
 * @param messages The conversation history.
 * @param hasActivePlans Whether there are active plans in the project.
 * @returns The resolved model alias ('fast' | 'smart' | 'planner').
 */
export function routeModelAlias(messages: ConversationMessage[], hasActivePlans: boolean): ModelAlias {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  let userText = '';
  if (lastUserMessage) {
    if (typeof lastUserMessage.content === 'string') {
      userText = lastUserMessage.content.toLowerCase();
    } else if (Array.isArray(lastUserMessage.content)) {
      userText = lastUserMessage.content
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join(' ')
        .toLowerCase();
    }
  }

  // 1. Check if user is explicitly calling plan commands or requesting plans
  if (
    userText.startsWith('/plan') ||
    userText.includes('create a plan') ||
    userText.includes('draft a plan') ||
    userText.includes('critique the plan') ||
    userText.includes('architecture plan')
  ) {
    return 'planner';
  }

  // 2. If there are active plans, we can transition to 'fast' model execution steps,
  // unless the query asks for complex architecting/refactoring.
  if (hasActivePlans) {
    if (
      userText.includes('refactor') ||
      userText.includes('design') ||
      userText.includes('security') ||
      userText.includes('optimize performance') ||
      userText.includes('architect')
    ) {
      return 'smart';
    }
    return 'fast';
  }

  // 3. For simple/short conversational queries, route to fast model
  if (
    userText.includes('hello') ||
    userText.includes('hi ') ||
    userText.includes('explain') ||
    userText.includes('what is') ||
    userText.includes('where is') ||
    userText.length < 25
  ) {
    return 'fast';
  }

  // 4. Default to smart model for general coding and tool-based executions
  return 'smart';
}
