import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateAudit } from './audit-check.mjs'

const allowlist = JSON.parse(readFileSync(new URL('./audit-allowlist.json', import.meta.url), 'utf8'))
const options = { project: 'mobile', today: '2026-10-27' }
const clean = {
  auditReportVersion: 2,
  vulnerabilities: {},
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
    dependencies: { prod: 1, dev: 0, optional: 0, peer: 0, peerOptional: 0, total: 1 },
  },
}
const vulnerable = structuredClone(clean)
vulnerable.metadata.vulnerabilities.high = vulnerable.metadata.vulnerabilities.total = 1
vulnerable.vulnerabilities.zod = {
  name: 'zod', severity: 'high', isDirect: false, range: '<4.6.6', nodes: ['node_modules/zod'],
  via: [{ title: 'Reviewed advisory', severity: 'high', url: `https://github.com/advisories/${allowlist[0].advisory}` }],
}
assert.deepEqual(evaluateAudit(clean, allowlist, options), { problems: [], allowed: [] })
assert.equal(evaluateAudit(vulnerable, [], options).problems.length, 1)
assert.equal(evaluateAudit(vulnerable, allowlist, options).allowed.length, 1)
assert.match(evaluateAudit(vulnerable, allowlist, { ...options, today: '2027-02-01' }).problems[0], /expired/)
assert.equal(evaluateAudit(vulnerable, allowlist, { ...options, today: allowlist[0].reviewBy }).problems.length, 0)
assert.match(evaluateAudit(vulnerable, allowlist, { ...options, project: '.' }).problems[0], /scope/)
for (const mutation of [
  (report) => { report.vulnerabilities.zod.isDirect = true },
  (report) => { report.vulnerabilities.zod.nodes.push('node_modules/runtime/node_modules/zod') },
  (report) => { report.vulnerabilities.zod.range = '<5.0.0' },
]) {
  const report = structuredClone(vulnerable)
  mutation(report)
  assert.match(evaluateAudit(report, allowlist, options).problems[0], /scope/)
}
for (const mutation of [
  (entry) => { delete entry.reviewBy },
  (entry) => { entry.reviewBy = '2027-02-30' },
  (entry) => { entry.reviewBy = 'tomorrow' },
  (entry) => { entry.reason = ' ' },
  (entry) => { delete entry.project },
  (entry) => { entry.isDirect = true },
  (entry) => { entry.nodes = [] },
  (entry) => { entry.nodes = ['node_modules/../zod'] },
  (entry) => { delete entry.range },
]) {
  const entries = structuredClone(allowlist)
  mutation(entries[0])
  assert.throws(() => evaluateAudit(clean, entries, options), /allowlist/)
}
const serviceError = { error: { code: 'ENOAUDIT', summary: 'registry audit endpoint unavailable' } }
for (const report of [null, [], {}, serviceError, { ...clean, error: {} },
  { ...clean, auditReportVersion: 1 }, { ...clean, vulnerabilities: [] },
  { ...clean, metadata: {} }, { ...clean, metadata: { ...clean.metadata, vulnerabilities: {} } },
  { ...clean, vulnerabilities: { zod: {} } },
]) assert.throws(() => evaluateAudit(report, allowlist, options))
for (const mutation of [
  (report) => { report.vulnerabilities.zod.via = ['missing'] },
  (report) => { report.vulnerabilities.zod.via = ['zod'] },
  (report) => { report.vulnerabilities.zod.via = [{}] },
  (report) => { report.metadata.vulnerabilities.total = 0 },
]) {
  const report = structuredClone(vulnerable)
  mutation(report)
  assert.throws(() => evaluateAudit(report, allowlist, options))
}

// Exercise the real CLI exit boundary with an isolated npm executable, without
// registry access or a production environment-variable bypass.
const bin = mkdtempSync(path.join(tmpdir(), 'tracebuddy-audit-check-'))
try {
  const npm = path.join(bin, 'npm')
  writeFileSync(npm, '#!/usr/bin/env node\nprocess.stdout.write(process.env.AUDIT_TEST_OUTPUT); process.exit(Number(process.env.AUDIT_TEST_STATUS))\n')
  chmodSync(npm, 0o755)
  const script = fileURLToPath(new URL('./audit-check.mjs', import.meta.url))
  const root = fileURLToPath(new URL('..', import.meta.url))
  for (const [label, output, status, expected] of [
    ['clean', JSON.stringify(clean), 0, 0],
    ['vulnerable root', JSON.stringify(vulnerable), 1, 1],
    ['service error', JSON.stringify(serviceError), 1, 1],
    ['malformed JSON', '{broken', 1, 1],
    ['incomplete report', '{}', 0, 1],
    ['unexpected npm exit', JSON.stringify(clean), 2, 1],
  ]) {
    const result = spawnSync(process.execPath, [script, root], {
      encoding: 'utf8', env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, AUDIT_TEST_OUTPUT: output, AUDIT_TEST_STATUS: String(status) },
    })
    assert.equal(result.status, expected, `${label}: ${result.stdout}\n${result.stderr}`)
    if (expected) assert.doesNotMatch(result.stdout, /No unreviewed/)
  }
} finally {
  rmSync(bin, { recursive: true, force: true })
}
console.log('Audit model and CLI checks passed: clean, vulnerable, expiry, schema, project/path/direct/range scope, malformed and service errors')
