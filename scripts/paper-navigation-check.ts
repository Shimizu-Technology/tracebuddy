import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { StackActions, StackRouter } from '../mobile/node_modules/expo-router/build/react-navigation/routers'
import { guardRoutingQueue } from '../mobile/src/features/paper/childModeNavigation'
import type { RoutingQueue } from '../mobile/src/features/paper/childModeNavigation'
import { childModeState } from '../mobile/src/features/paper/childModeState'
import { drawInsteadAction } from '../mobile/src/features/paper/drawInstead'

// The app's root stack, with the real React Navigation stack router.
const routeNames = ['index', 'draw/[id]', 'draw-more', 'picture/[id]', 'paper', 'dev/kit']
const router = StackRouter({})
const options = { routeNames, routeParamList: {}, routeGetIdList: {} }
type State = ReturnType<typeof router.getInitialState>
type Action = Parameters<typeof router.getStateForAction>[1]
const apply = (state: State, action: Action) => {
  const next = router.getStateForAction(state, action, options)
  assert.ok(next, `the stack handles ${action.type}`)
  return next as State
}
const names = (state: State) => state.routes.map((route) => route.name)
const focused = (state: State) => state.routes[state.index]
const home = () => router.getInitialState(options)
const crab = { id: 'happy-crab', level: 'simple' }

// 1. Expo Router's routing queue still has the shape the child-mode guard wraps: every router.* call and
//    <Link> adds to it, and the app runs it into the navigator. (An Expo Router upgrade that changes this
//    must fail here, not silently let navigation through.)
{
  const queueSource = readFileSync(new URL('../mobile/node_modules/expo-router/build/global-state/routingQueue.js', import.meta.url), 'utf8')
  assert.match(queueSource, /exports\.routingQueue = \{\s*queue: \[\],/, 'the queue is a plain object with a queue array')
  assert.match(queueSource, /add\(action\) \{\s*exports\.routingQueue\.queue\.push\(action\);/, 'add pushes onto it')
  assert.match(queueSource, /run\(ref\) \{[\s\S]*ref\.current\.dispatch\(action\)/, 'run dispatches into the navigator')
  const routerSource = readFileSync(new URL('../mobile/node_modules/expo-router/build/global-state/router.js', import.meta.url), 'utf8')
  for (const type of ['POP', 'POP_TO_TOP', 'GO_BACK']) assert.match(routerSource, new RegExp(`routingQueue\\.add\\(\\{ type: '${type}'`), `${type} goes through the queue`)
  assert.match(routerSource, /routingQueue_1\.routingQueue\.add\(linkAction\)/, 'push, navigate, replace and links go through the queue')
  const emitter = readFileSync(new URL('../mobile/node_modules/expo-router/build/imperative-api.js', import.meta.url), 'utf8')
  assert.match(emitter, /routingQueue\.run\(ref\)/, 'the app runs the same queue')
}

// 2. A push asked for while locked never changes focus. The queue below behaves like Expo Router's.
{
  let notified = 0
  const queue: RoutingQueue = {
    queue: [],
    add(action: never) {
      queue.queue.push(action)
      notified += 1
    },
    run(ref: never) {
      const events = queue.queue
      queue.queue = []
      for (const action of events) (ref as { current: { dispatch: (action: Action) => void } }).current.dispatch(action as Action)
    },
  }
  let blocked = 0
  guardRoutingQueue(queue, childModeState.isActive, () => { blocked += 1 })

  let state = apply(home(), StackActions.push('paper', { screen: '[id]', params: crab }))
  const ref = { current: { dispatch: (action: Action) => { state = apply(state, action) } } }
  const paper = focused(state).key
  const owner = {}

  // Lock: the flag goes on in the Lock handler, before anything renders.
  childModeState.set(owner, true)
  queue.add(StackActions.push('dev/kit') as never) // router.push('/dev/kit')
  queue.run(ref as never)
  assert.equal(focused(state).key, paper, 'a push while locked never takes focus')
  queue.add({ type: 'GO_BACK' } as never) // router.back()
  queue.add(StackActions.replace('index') as never) // router.replace('/')
  queue.add({ type: 'POP_TO_TOP' } as never) // router.dismissAll()
  queue.run(ref as never)
  assert.equal(focused(state).key, paper, 'neither does back, replace or dismiss')
  assert.deepEqual(names(state), ['index', 'paper'])
  assert.equal(notified, 0, 'refused at the source: the navigator is never asked')
  assert.equal(blocked, 4, 'and each refusal is reported, so the screen can say how to unlock')

  // Asked for just before Lock, run just after it: still refused.
  childModeState.set(owner, false)
  queue.add(StackActions.push('dev/kit') as never)
  childModeState.set(owner, true)
  queue.run(ref as never)
  assert.equal(focused(state).key, paper, 'an action queued before Lock and run after it is dropped')
  assert.equal(queue.queue.length, 0)

  // Unlocked: navigation works again.
  childModeState.set(owner, false)
  queue.add(StackActions.push('dev/kit') as never)
  queue.run(ref as never)
  assert.equal(focused(state).name, 'dev/kit', 'after unlock, a push works')
}

// 3. "Draw on the screen instead" never stacks two Draws.
{
  // From the Picture sheet: the sheet replaced itself with On paper ([Home, On paper]); Draw takes its place.
  let state = apply(home(), StackActions.push('picture/[id]', crab))
  state = apply(state, StackActions.replace('paper', { screen: '[id]', params: crab }))
  assert.deepEqual(names(state), ['index', 'paper'])
  const fromPicture = drawInsteadAction(state, crab)
  assert.equal(fromPicture.kind, 'replace')
  state = apply(state, fromPicture.action)
  assert.deepEqual(names(state), ['index', 'draw/[id]'], 'Picture → On paper → Draw instead gives [Home, Draw]')
  assert.deepEqual(focused(state).params, crab, 'with the same picture')

  // From Draw's More: "Trace on paper instead" replaces the More sheet with On paper ([Home, Draw, On paper]).
  state = apply(home(), StackActions.push('draw/[id]', crab))
  const draw = focused(state).key
  state = apply(state, StackActions.push('draw-more'))
  state = apply(state, StackActions.replace('paper', { screen: '[id]', params: crab }))
  assert.deepEqual(names(state), ['index', 'draw/[id]', 'paper'])
  // Camera denied → "Draw on the screen instead".
  const fromDraw = drawInsteadAction(state, crab)
  assert.equal(fromDraw.kind, 'back')
  state = apply(state, fromDraw.action)
  assert.deepEqual(names(state), ['index', 'draw/[id]'], 'Draw → On paper → Draw instead returns to one Draw')
  assert.equal(focused(state).key, draw, 'the same Draw, strokes and all')
}

console.log('Paper navigation checks passed.')
