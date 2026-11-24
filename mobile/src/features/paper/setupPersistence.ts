import { serializeRememberedSetup } from './paperModel'
import type { GuideSetup, ScreenOrientation } from './paperModel'

export type SetupIO = { read: () => Promise<string | null>; write: (raw: string) => Promise<void> }
export type OperationQueue = <T>(operation: () => Promise<T>) => Promise<T>
export type SetupSnapshot = { orientation: ScreenOrientation; setup: GuideSetup }

/**
 * Saving reads the stored record, merges this orientation's setup into it and writes it back as one queued
 * step, and loading waits behind every save queued before it. So a pending portrait save can't be lost when
 * the device turns and the landscape setup loads, and an older read can never overwrite a newer write.
 */
export function createSetupPersistence(io: SetupIO, queue: OperationQueue) {
  return {
    save(snapshot: SetupSnapshot) {
      return queue(async () => {
        const previous = await io.read()
        await io.write(serializeRememberedSetup(previous, snapshot.orientation, snapshot.setup))
      })
    },
    load() {
      return queue(() => io.read())
    },
  }
}
