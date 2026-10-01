export const DICE_SETTLE_MS = 4800;
export const DICE_START_DELAY_MS = 160;
export const PHYSICS_SECOND_MS = 1240;
// Handoff times are relative to the same motion.startedAt used by both windows.
export const RESULT_REVEAL_START_MS = 5200;
export const RESULT_REVEAL_DURATION_MS = 1020;
export const CAST_DURATION_MS = DICE_START_DELAY_MS + RESULT_REVEAL_START_MS + RESULT_REVEAL_DURATION_MS + 60;
