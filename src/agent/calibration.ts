import { TurnMetrics } from './types.js';

/**
 * Returns a calibration note based on prior turn's token metrics.
 */
export function buildCalibrationNote(previousTurn: TurnMetrics | null): string {
  if (!previousTurn || !previousTurn.declaredBudget) return '';
  return `[prior turn: declared ~${previousTurn.declaredBudget}, used ${previousTurn.actualOutputTokens}]`;
}
