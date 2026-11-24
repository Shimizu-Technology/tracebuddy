// Runs a screen hook's real source in Node, without React Native: the file is transpiled with TypeScript and
// its imports are answered from `modules` (fakes for native modules, the real pure modules otherwise).
// React's hooks are a minimal single-component runtime: state, refs, memos and effects, with effects run after
// each render and re-rendering until state settles.
import { readFileSync } from 'node:fs'
import ts from 'typescript'

type Effect = { deps?: readonly unknown[]; cleanup?: void | (() => void) }

export function createHookRuntime() {
  const slots: unknown[] = []
  let cursor = 0
  let dirty = false
  let pending: (() => void)[] = []
  const changed = (before: readonly unknown[] | undefined, after: readonly unknown[] | undefined) =>
    !before || !after || before.length !== after.length || before.some((value, index) => !Object.is(value, after[index]))

  const React = {
    useState<T>(initial: T | (() => T)) {
      const slot = cursor++
      if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? (initial as () => T)() : initial
      const set = (next: T | ((value: T) => T)) => {
        const value = typeof next === 'function' ? (next as (value: T) => T)(slots[slot] as T) : next
        if (Object.is(value, slots[slot])) return
        slots[slot] = value
        dirty = true
      }
      return [slots[slot] as T, set] as const
    },
    useRef<T>(initial: T) {
      const slot = cursor++
      if (!(slot in slots)) slots[slot] = { current: initial }
      return slots[slot] as { current: T }
    },
    useMemo<T>(make: () => T, deps: readonly unknown[]) {
      const slot = cursor++
      const memo = slots[slot] as { value: T; deps: readonly unknown[] } | undefined
      if (memo && !changed(memo.deps, deps)) return memo.value
      const value = make()
      slots[slot] = { value, deps }
      return value
    },
    useCallback<T>(callback: T, deps: readonly unknown[]) {
      const memo = React.useMemo
      return memo(() => callback, deps)
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const slot = cursor++
      const previous = slots[slot] as Effect | undefined
      if (previous && !changed(previous.deps, deps)) return
      slots[slot] = { ...previous, deps }
      pending.push(() => {
        if (typeof previous?.cleanup === 'function') previous.cleanup()
        ;(slots[slot] as Effect).cleanup = effect()
      })
    },
  }

  function render<A extends unknown[], R>(hook: (...args: A) => R, ...args: A) {
    let result!: R
    for (let pass = 0; pass < 25; pass += 1) {
      cursor = 0
      dirty = false
      result = hook(...args)
      const effects = pending
      pending = []
      effects.forEach((run) => run())
      if (!dirty) return result
    }
    throw new Error('The hook kept updating its state')
  }

  function unmount() {
    for (const slot of slots) {
      const cleanup = (slot as Effect | undefined)?.cleanup
      if (typeof cleanup === 'function') cleanup()
    }
  }

  return { React, render, unmount, isDirty: () => dirty }
}

export function createFakeTimers() {
  let now = 0
  let nextId = 1
  const timers = new Map<number, { at: number; run: () => void }>()
  return {
    setTimeout: (run: () => void, ms = 0) => {
      const id = nextId++
      timers.set(id, { at: now + ms, run })
      return id
    },
    clearTimeout: (id: number | undefined) => { if (id !== undefined) timers.delete(id) },
    advance(ms: number) {
      const until = now + ms
      for (;;) {
        const due = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0])
        now = due[1].at
        due[1].run()
      }
      now = until
    },
    pending: () => timers.size,
  }
}

/** Loads `file` (relative to the repo root) with its imports answered from `modules`. */
export function loadHookModule<T>(file: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  })
  const module = { exports: {} as T }
  const require = (name: string) => {
    if (!(name in modules)) throw new Error(`${file} imports ${name}, which the check doesn't provide`)
    return modules[name]
  }
  const names = Object.keys(globals)
  new Function('require', 'module', 'exports', ...names, outputText)(require, module, module.exports, ...names.map((name) => globals[name]))
  return module.exports
}
