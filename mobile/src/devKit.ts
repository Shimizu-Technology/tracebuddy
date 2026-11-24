// The UI kit route is for development and preview builds only. Set EXPO_PUBLIC_DEV_KIT=1 to include it in a Release build.
export const devKitEnabled = __DEV__ || process.env.EXPO_PUBLIC_DEV_KIT === '1'
