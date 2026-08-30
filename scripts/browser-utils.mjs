import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const chromeCandidates = [
  process.env.CHECK_CHROME,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

export function findChromeExecutable() {
  const executablePath = chromeCandidates.find((candidate) => existsSync(candidate))
  if (!executablePath) {
    throw new Error('Chrome was not found. Set CHECK_CHROME or PUPPETEER_EXECUTABLE_PATH to a Chrome/Chromium executable.')
  }
  return executablePath
}

export async function clickByText(page, text, selector = 'button, label') {
  const clicked = await page.evaluate(({ target, targetSelector }) => {
    const node = [...document.querySelectorAll(targetSelector)].find((element) => element.textContent?.trim().includes(target))
    if (!node) return false
    node.click()
    return true
  }, { target: text, targetSelector: selector })

  if (!clicked) throw new Error(`Could not find ${selector} containing "${text}"`)
}

export async function waitForSelector(page, selector) {
  await page.waitForSelector(selector, { timeout: 5_000 })
}

export async function closeBrowser(browser) {
  const browserProcess = browser.process()
  const ownedProcessIds = browserProcess ? safeBrowserProcessTree(browserProcess.pid) : []
  await Promise.race([
    browser.close(),
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 2_000)),
  ]).catch(() => undefined)
  browser.disconnect()
  ownedProcessIds.forEach((processId) => signalProcess(processId, 'SIGTERM'))
  await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 500))
  ownedProcessIds.forEach((processId) => signalProcess(processId, 'SIGKILL'))
}

function safeBrowserProcessTree(rootProcessId) {
  try {
    return browserProcessTree(rootProcessId)
  } catch {
    return [rootProcessId]
  }
}

function browserProcessTree(rootProcessId) {
  const rows = execFileSync('ps', ['-Ao', 'pid=,ppid='], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .map((row) => row.trim().split(/\s+/).map(Number))
    .filter(([processId, parentProcessId]) => Number.isInteger(processId) && Number.isInteger(parentProcessId))
  const childrenByParent = new Map()
  rows.forEach(([processId, parentProcessId]) => {
    childrenByParent.set(parentProcessId, [...(childrenByParent.get(parentProcessId) ?? []), processId])
  })
  const descendants = []
  const visit = (processId) => {
    ;(childrenByParent.get(processId) ?? []).forEach((childProcessId) => {
      visit(childProcessId)
      descendants.push(childProcessId)
    })
  }
  visit(rootProcessId)
  return [...descendants, rootProcessId]
}

function signalProcess(processId, signal) {
  try {
    process.kill(processId, signal)
  } catch {
    // The exact browser process has already exited.
  }
}
