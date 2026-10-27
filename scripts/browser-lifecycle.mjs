import { mkdirSync, rmdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// Concurrent suites must not race the lifecycle CLI's session ledger writes.
export function browserLifecycle(action, pid) {
  const session = process.env.DEV_LIFECYCLE_SESSION
  if (!session) return
  const lock = join(tmpdir(), `tracebuddy-lifecycle-${session}.lock`)
  for (let attempt = 0; ; attempt += 1) {
    try { mkdirSync(lock); break } catch (error) {
      if (error.code !== 'EEXIST' || attempt > 400) throw error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25)
    }
  }
  try { execFileSync('dev-lifecycle', [action, '--session', session, ...(action === 'claim' ? ['--owner', process.env.DEV_LIFECYCLE_OWNER || 'tracebuddy-w5'] : []), 'process', String(pid)]) }
  finally { rmdirSync(lock) }
}
