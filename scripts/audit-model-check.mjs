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
// The same advisory can be reviewed separately in each project, in either order.
const rootEntry = { ...allowlist[0], project: '.' }
for (const entries of [[rootEntry, ...allowlist], [...allowlist, rootEntry]]) {
  for (const project of ['.', 'mobile']) assert.equal(evaluateAudit(vulnerable, entries, { ...options, project }).problems.length, 0)
}
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
  const mobile = fileURLToPath(new URL('../mobile', import.meta.url))
  const mobileResult = spawnSync(process.execPath, [script, mobile], {
    encoding: 'utf8', env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, AUDIT_TEST_OUTPUT: JSON.stringify(vulnerable), AUDIT_TEST_STATUS: '1' },
  })
  assert.equal(mobileResult.status, 0, `allowlisted mobile: ${mobileResult.stdout}\n${mobileResult.stderr}`)
  assert.match(mobileResult.stdout, /allowed GHSA-mrhx-c7xc-m3w5 in zod/)
} finally {
  rmSync(bin, { recursive: true, force: true })
}
console.log('Audit model and CLI checks passed: clean, vulnerable, expiry, schema, project/path/direct/range scope, malformed and service errors')

// Both new picomatch exceptions must remain scoped to the reviewed dependency paths.
for (const project of ['.', 'mobile']) {
  const expectedNodes = project === '.' ? ['node_modules/picomatch'] : ['node_modules/jest-util/node_modules/picomatch', 'node_modules/micromatch/node_modules/picomatch', 'node_modules/picomatch']
  const entry = allowlist.find(item => item.project === project && item.package === 'picomatch')
  assert.ok(entry, `Missing reviewed picomatch scope for ${project}`)
  assert.deepEqual(entry.nodes, expectedNodes)
  const report = structuredClone(clean)
  report.metadata.vulnerabilities.high = report.metadata.vulnerabilities.total = 1
  report.vulnerabilities.picomatch = {
    name: 'picomatch', severity: 'high', isDirect: false, range: entry.range, nodes: expectedNodes,
    via: [{ title: 'Repeated extglob ReDoS', severity: 'high', url: `https://github.com/advisories/${entry.advisory}` }],
  }
  assert.equal(evaluateAudit(report, allowlist, { project, today: '2026-11-18', lockPackages: Object.fromEntries(expectedNodes.map(node => [node, { dev: true }])) }).problems.length, 0)
  assert.equal(evaluateAudit(report, allowlist, { project, today: '2027-02-01', lockPackages: Object.fromEntries(expectedNodes.map(node => [node, { dev: true }])) }).problems.length, 1)
  report.vulnerabilities.picomatch.nodes = ['node_modules/unreviewed/node_modules/picomatch']
  assert.equal(evaluateAudit(report, allowlist, { project, today: '2026-11-18', lockPackages: Object.fromEntries(expectedNodes.map(node => [node, { dev: true }])) }).problems.length, 1)
}
console.log('Root/mobile picomatch exception expiry and path boundaries passed')

// A reviewed consumer name cannot cover a new resolved instance (including npm aliases).
const instanceEntry = { advisory: 'GHSA-test-instance', package: 'picomatch', project: '.', via: 'fixture', reason: 'fixture', reviewBy: '2099-01-31', isDirect: false, range: '*', nodes: ['node_modules/picomatch'], reviewedConsumers: ['vite'], reviewedConsumerNodes: ['node_modules/vite'] }
const instanceReport = { auditReportVersion: 2, vulnerabilities: {
  picomatch: { name: 'picomatch', severity: 'high', isDirect: false, range: '*', nodes: ['node_modules/picomatch'], via: [{title: 'fixture', severity: 'high', url: 'https://github.com/advisories/GHSA-test-instance'}] },
  vite: { name: 'vite', severity: 'high', isDirect: true, range: '*', nodes: ['node_modules/vite'], via: ['picomatch'] },
}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 2, critical: 0, total: 2 }, dependencies: {prod: 0, dev: 2, optional: 0, peer: 0, peerOptional: 0, total: 2} } }
assert.equal(evaluateAudit(instanceReport, [instanceEntry], { project: '.' }).problems.length, 0)
instanceReport.vulnerabilities.vite.nodes.push('node_modules/vite-alias')
assert.match(evaluateAudit(instanceReport, [instanceEntry], { project: '.' }).problems[0], /unreviewed dependent instance/)

// A scan must use the same lockfile graph throughout its registry request.
{
  const { mkdtempSync, writeFileSync, chmodSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  const { spawnSync } = await import('node:child_process')
  const { fileURLToPath } = await import('node:url')
  const fixture = mkdtempSync(path.join(tmpdir(), 'audit-lock-'))
  const cleanReport = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: {info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0}, dependencies: {prod: 0, dev: 0, optional: 0, peer: 0, peerOptional: 0, total: 0} } }
  try {
    writeFileSync(path.join(fixture, 'package-lock.json'), '{"packages":{}}')
    const fakeNpm = path.join(fixture, 'npm')
    writeFileSync(fakeNpm, '#!/bin/sh\ncase " $* " in *" --include=dev "*) ;; *) exit 2;; esac\nif [ "$MUTATE_AUDIT_LOCK" = 1 ]; then printf " " >> package-lock.json; fi\nprintf "%s" "$CLEAN_AUDIT_REPORT"\n')
    chmodSync(fakeNpm, 0o755)
    const script = fileURLToPath(new URL('./audit-check.mjs', import.meta.url))
    const env = { ...process.env, NODE_ENV: 'production', PATH: `${fixture}${path.delimiter}${process.env.PATH}`, CLEAN_AUDIT_REPORT: JSON.stringify(cleanReport) }
    const stable = spawnSync(process.execPath, [script, fixture], {env, encoding: 'utf8'})
    assert.equal(stable.status, 0, stable.stderr)
    const changed = spawnSync(process.execPath, [script, fixture], {env: {...env, MUTATE_AUDIT_LOCK: '1'}, encoding: 'utf8'})
    assert.equal(changed.status, 1)
    assert.match(changed.stderr, /Lockfile changed during audit/)
  } finally { rmSync(fixture, {recursive: true, force: true}) }
}
