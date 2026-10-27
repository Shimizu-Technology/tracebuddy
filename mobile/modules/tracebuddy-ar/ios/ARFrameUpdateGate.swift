import Foundation

// Delegate callbacks can arrive faster than the main actor can render. Keep at most
// one frame update in flight; callbacks never wait for the main actor.
final class ARFrameUpdateGate: @unchecked Sendable {
  private let lock = NSLock()
  private var pending = false

  func begin() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    guard !pending else { return false }
    pending = true
    return true
  }

  func end() {
    lock.lock()
    pending = false
    lock.unlock()
  }
}


// A Timer may already have queued its MainActor task when invalidated. Tokens
// reject that task after re-arm/cancellation or a replacement session.
struct ARDeadlineToken {
  private(set) var revision = 0
  mutating func invalidate() { revision += 1 }
  mutating func arm() -> Int { invalidate(); return revision }
  func accepts(_ token: Int, session: Int, currentSession: Int, active: Bool, running: Bool) -> Bool {
    token == revision && session == currentSession && active && running
  }
}
