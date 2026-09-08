import { requireNativeView } from 'expo';
import * as React from 'react';
import { Platform } from 'react-native';

import { TraceBuddyARViewProps } from './TraceBuddyAR.types';

let NativeView: React.ComponentType<TraceBuddyARViewProps> | null = null;

export default function TraceBuddyARView(props: TraceBuddyARViewProps) {
  if (Platform.OS !== 'ios') return null;
  NativeView ??= requireNativeView<TraceBuddyARViewProps>('TraceBuddyAR');
  return <NativeView {...props} />;
}
