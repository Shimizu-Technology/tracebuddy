import ExpoModulesCore
import UIKit

public final class TraceBuddyKeyboardModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TraceBuddyKeyboard")
    View(TraceBuddyEscapeView.self) {
      Events("onEscape")
    }
  }
}

// A non-text responder receives hardware Escape without opening a keyboard.
// It exists only inside the keepsake modal and relinquishes focus on removal.
final class TraceBuddyEscapeView: ExpoView {
  let onEscape = EventDispatcher()
  override var canBecomeFirstResponder: Bool { true }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      resignFirstResponder()
    } else {
      DispatchQueue.main.async { [weak self] in
        guard let self, self.window != nil else { return }
        self.becomeFirstResponder()
      }
    }
  }

  override var keyCommands: [UIKeyCommand]? {
    let escape = UIKeyCommand(input: UIKeyCommand.inputEscape, modifierFlags: [], action: #selector(closeKeepsake))
    escape.wantsPriorityOverSystemBehavior = true
    return [escape]
  }

  @objc private func closeKeepsake() {
    onEscape([:])
  }
}
