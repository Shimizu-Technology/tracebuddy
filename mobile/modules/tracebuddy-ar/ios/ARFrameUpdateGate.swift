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

