import { familyActivities, guidedLessons, normalizeDrawingPreferences, normalizeLearningProgress, normalizeTraceAlignment } from '../../../shared'
import { makeNativeModePreference, normalizeModePreference } from '../../finishFindModel'
import type { NativeTraceMode } from '../../finishFindModel'
import { selectedFamilyActivity } from '../../nativeSafetyModel'
import { normalizeResumeContext } from '../../practiceModel'
import type { ResumeContext } from '../../practiceModel'
import type { PracticeSource } from '../../practiceStorageModel'

const activityIds = familyActivities.map((activity) => activity.id)
const lessonIds = guidedLessons.map((lesson) => lesson.id)

function parseJson(raw: string | null): unknown {
  return raw ? JSON.parse(raw) : null
}

export function parseDrawingPreferences(raw: string | null) {
  return normalizeDrawingPreferences(parseJson(raw))
}

export function parseLearningProgress(raw: string | null) {
  return normalizeLearningProgress(parseJson(raw))
}

export function parseSavedAlignment(raw: string | null) {
  return normalizeTraceAlignment(parseJson(raw))
}

export function parseParentSetupSeen(raw: string | null) {
  return raw === '1'
}

export const parentSetupSeenValue = '1'

export function parseFamilyActivity(raw: string | null) {
  return selectedFamilyActivity(raw, activityIds)
}

export function parseResumeContext(raw: string | null) {
  return normalizeResumeContext(parseJson(raw), lessonIds)
}

export function serializeResumeContext(context: ResumeContext & { source?: PracticeSource }) {
  return JSON.stringify(context)
}

export function parseModePreference(raw: string | null, arSupported: boolean) {
  return normalizeModePreference(raw, arSupported)
}

export function serializeModePreference(surface: NativeTraceMode) {
  return JSON.stringify(makeNativeModePreference(surface))
}
