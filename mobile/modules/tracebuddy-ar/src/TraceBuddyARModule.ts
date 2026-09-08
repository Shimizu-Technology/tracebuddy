import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class TraceBuddyARModule extends NativeModule<Record<string, never>> {
  isSupported(): boolean;
}

const module = requireOptionalNativeModule<TraceBuddyARModule>('TraceBuddyAR');

export function isTraceBuddyARSupported() {
  return module?.isSupported() ?? false;
}
