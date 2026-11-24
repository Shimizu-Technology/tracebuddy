import type { NativeStackNavigationOptions } from 'expo-router'

import { theme } from './theme'

export const smallSheetOptions = {
  presentation: 'formSheet',
  sheetAllowedDetents: [theme.sheet.smallDetent],
  sheetCornerRadius: theme.radius.sheet,
  sheetGrabberVisible: true,
  sheetLargestUndimmedDetentIndex: 0,
  contentStyle: { backgroundColor: theme.colors.surface },
} satisfies NativeStackNavigationOptions
