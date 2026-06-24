/**
 * Returns a calibration note based on prior turn's token metrics.
 */
export function buildCalibrationNote(previousTurn) {
    if (!previousTurn || !previousTurn.declaredBudget)
        return '';
    return `[prior turn: declared ~${previousTurn.declaredBudget}, used ${previousTurn.actualOutputTokens}]`;
}
