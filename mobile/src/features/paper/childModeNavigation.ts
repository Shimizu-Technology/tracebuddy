/** The part of Expo Router's routing queue the guard needs. Every `router.*` call and `<Link>` goes through it. */
export type RoutingQueue = {
  queue: unknown[]
  add: (action: never) => void
  run: (ref: never) => void
}

/**
 * Refuses in-app navigation at its source while a screen is in child mode: a push, replace, back or dismiss
 * asked for while locked is dropped before it reaches the navigator, so it can never change focus. An action
 * queued just before Lock and run after it is dropped too. System links are handled in app/+native-intent.tsx.
 */
export function guardRoutingQueue(routingQueue: RoutingQueue, isLocked: () => boolean, onBlocked: () => void) {
  const add = routingQueue.add
  const run = routingQueue.run
  routingQueue.add = ((action) => {
    if (isLocked()) {
      onBlocked()
      return
    }
    add(action)
  }) as RoutingQueue['add']
  routingQueue.run = ((ref) => {
    if (isLocked()) {
      if (routingQueue.queue.length > 0) onBlocked()
      routingQueue.queue = []
      return
    }
    run(ref)
  }) as RoutingQueue['run']
}
