export function isDismissedPrintSheet(error: unknown, platform: string) {
  if (platform !== 'ios') return false

  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : ''
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''

  return code === 'ERR_PRINT_INCOMPLETE' || /printing did not complete/i.test(message)
}
