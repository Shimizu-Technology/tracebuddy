// The UI kit route is for development and preview builds only. Set EXPO_PUBLIC_DEV_KIT=1 to include it in a Release build.
export const devKitEnabled = __DEV__ || process.env.EXPO_PUBLIC_DEV_KIT === '1'

export const traceBuddy2Enabled = process.env.EXPO_PUBLIC_TB2 === '1'

// Stick to paper (Paper Lock) stays off in 2.0 until it passes the physical accuracy test. Set EXPO_PUBLIC_PAPER_LOCK=1 to include it.
export const paperLockEnabled = process.env.EXPO_PUBLIC_PAPER_LOCK === '1'
