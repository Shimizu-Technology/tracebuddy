// Fails on high or critical npm advisories, except reviewed entries in
// scripts/audit-allowlist.json. Each entry must name the advisory, the package
// it reaches us through, why it is not exploitable here, and a review date.
// Expired entries fail the gate so exceptions cannot linger unnoticed.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const target = path.resolve(process.argv[2] ?? '.')
const allowlist = JSON.parse(readFileSync(new URL('./audit-allowlist.json', import.meta.url), 'utf8'))
const today = new Date().toISOString().slice(0, 10)
const failing = new Set(['high', 'critical'])

let report
try {
  report = execFileSync('npm', ['audit', '--json'], { cwd: target, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
} catch (error) {
  // npm audit exits non-zero when it finds advisories; the JSON is still on stdout.
  report = error.stdout
  if (!report) throw error
}

const { vulnerabilities = {} } = JSON.parse(report)
const problems = []

for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (!failing.has(vulnerability.severity)) continue
  for (const via of vulnerability.via) {
    // String entries point at another package's advisory, which is checked on its own.
    if (typeof via === 'string' || !failing.has(via.severity)) continue
    const id = via.url?.split('/').pop()
    const entry = allowlist.find((item) => item.advisory === id && item.package === name)
    if (!entry) {
      problems.push(`${name}: ${via.title} (${via.url})`)
    } else if (entry.reviewBy < today) {
      problems.push(`${name}: allowlist entry for ${id} expired on ${entry.reviewBy}; review it again`)
    } else {
      console.log(`allowed ${id} in ${name} until ${entry.reviewBy}: ${entry.reason}`)
    }
  }
}

if (problems.length) {
  console.error(`High or critical advisories in ${target}:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log(`No unreviewed high or critical advisories in ${target}.`)
