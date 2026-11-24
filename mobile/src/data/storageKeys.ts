import { modePreferenceKey } from '../../../shared/finishFind'

export const previousWorkIndexKey = 'tracebuddy.previousWork.v1.index'
export const previousWorkSessionPrefix = 'tracebuddy.previousWork.v1.session.'
export const legacyPracticeAutosavePrefix = 'tracebuddy.practice.v1.'
export const drawingPreferencesKey = 'tracebuddy.drawingPreferences.v1'
export const learningProgressKey = 'tracebuddy.learningProgress.v1'
export const parentSetupSeenKey = 'tracebuddy.parentSetupSeen.v1'
export const resumeContextKey = 'tracebuddy.resumeContext.v1'
export const familyActivityKey = 'tracebuddy.familyActivity.v1'
export const savedAlignmentKey = 'tracebuddy.savedAlignment.v1'
export const whoIsDrawingKey = 'tracebuddy.whoIsDrawing.v1'
export { modePreferenceKey }

export const localSettingKeys = [
  resumeContextKey,
  drawingPreferencesKey,
  learningProgressKey,
  parentSetupSeenKey,
  savedAlignmentKey,
  familyActivityKey,
  modePreferenceKey,
] as const

export type LocalSettingKey = typeof localSettingKeys[number] | typeof whoIsDrawingKey
