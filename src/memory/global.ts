import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Appends token usage statistics to the global log file in the user's home directory.
 * 
 * @param modelId The literal model ID used in the request.
 * @param inputTokens The number of prompt tokens used.
 * @param outputTokens The number of completion tokens used.
 */
export async function logTokenUsage(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const agentDir = path.join(os.homedir(), '.agent');
  const logPath = path.join(agentDir, 'usage.log');

  const timestamp = new Date().toISOString();

  // Basic cost estimation based on standard public pricing models
  let cost = 0;
  const modelLower = modelId.toLowerCase();
  if (modelLower.includes('sonnet')) {
    cost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  } else if (modelLower.includes('haiku')) {
    cost = (inputTokens * 0.8 + outputTokens * 4) / 1_000_000;
  } else if (modelLower.includes('gpt-4o-mini')) {
    cost = (inputTokens * 0.15 + outputTokens * 0.6) / 1_000_000;
  } else if (modelLower.includes('gpt-4o')) {
    cost = (inputTokens * 5 + outputTokens * 15) / 1_000_000;
  } else {
    // Default fallback estimation
    cost = (inputTokens * 2 + outputTokens * 10) / 1_000_000;
  }

  const logEntry = JSON.stringify({
    timestamp,
    modelId,
    inputTokens,
    outputTokens,
    estimatedCostUsd: Number(cost.toFixed(6)),
  });

  try {
    await fs.mkdir(agentDir, { recursive: true });
    await fs.appendFile(logPath, logEntry + '\n', 'utf-8');
  } catch (error) {
    // Silently ignore logging failures to avoid blocking the main agent execution loop
  }
}
