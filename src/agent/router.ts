import { ConversationMessage, ModelAlias } from '../providers/types.js';

export interface RouterContext {
  hasActivePlans?: boolean;
  isReadOnly?: boolean;
  isComplex?: boolean;
}

/**
 * Routes a task to the most appropriate model alias based on its description and context.
 *
 * @param taskDescription The description of the task.
 * @param context Additional routing flags.
 * @returns The resolved model alias.
 */
export function routeByTaskDescription(taskDescription: string, context?: RouterContext): ModelAlias {
  const userText = taskDescription.toLowerCase();

  // 0. If read-only is explicitly flagged, route to fast model
  if (context?.isReadOnly) {
    return 'fast';
  }

  // 1. Check if user is explicitly requesting planning or complex tasks
  if (
    context?.isComplex ||
    userText.startsWith('/plan') ||
    userText.includes('create a plan') ||
    userText.includes('draft a plan') ||
    userText.includes('critique the plan') ||
    userText.includes('architecture plan')
  ) {
    return 'planner';
  }

  // 2. Check for refactoring/design keywords
  if (
    userText.includes('refactor') ||
    userText.includes('design') ||
    userText.includes('security') ||
    userText.includes('optimize performance') ||
    userText.includes('architect')
  ) {
    return 'smart';
  }

  // 3. If there are active plans, default to fast model execution steps
  if (context?.hasActivePlans) {
    return 'fast';
  }

  // 4. For simple/short conversational queries, route to fast model
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

  // 5. Default to smart model
  return 'smart';
}

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

  return routeByTaskDescription(userText, { hasActivePlans });
}
