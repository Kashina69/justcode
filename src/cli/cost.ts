import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { getPricingRates } from '../config/constants.js';

/**
 * Estimates cost based on public pricing models, incorporating prompt caching details.
 */
export const estimateCost = (modelId: string, inputTokens: number, outputTokens: number, cacheHit?: boolean): number => {
  const rates = getPricingRates(modelId);
  const inputCostRate = cacheHit ? rates.cacheHitRate : rates.inputRate;
  const cost = (inputTokens * inputCostRate + outputTokens * rates.outputRate) / 1_000_000;
  return Number(cost.toFixed(6));
};

/**
 * Prints the global token statistics and costs from ~/.agent/usage.log.
 */
export const printCostSummary = async () => {
  const logPath = path.join(os.homedir(), '.agent', 'usage.log');
  try {
    const data = await fs.readFile(logPath, 'utf-8');
    const lines = data.trim().split('\n');
    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;
    let count = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        totalInput += parsed.inputTokens || 0;
        totalOutput += parsed.outputTokens || 0;
        totalCost += parsed.estimatedCostUsd || 0;
        count++;
      } catch {
        // Ignore parse errors
      }
    }

    console.log('\n📊 Global Usage & Cost Stats:');
    console.log(`  Total API Sessions:   ${count}`);
    console.log(`  Total Input Tokens:   ${totalInput.toLocaleString()}`);
    console.log(`  Total Output Tokens:  ${totalOutput.toLocaleString()}`);
    console.log(`  Total Estimated Cost: $${totalCost.toFixed(6)} USD`);
  } catch {
    console.log('\n📊 Global Usage Stats: No usage logs found.');
  }
};
