import ARKit
import ExpoModulesCore

public final class TraceBuddyARModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TraceBuddyAR")

    Function("isSupported") {
      ARWorldTrackingConfiguration.isSupported
    }

    View(TraceBuddyARView.self) {
      Events("onStateChange")

      Prop("active") { (view, active: Bool?) in view.setActive(active ?? true) }
      Prop("guideImageUri") { (view, uri: String?) in view.setGuideImageUri(uri) }
      Prop("placementMode") { (view, mode: String?) in view.setPlacementMode(mode == "marker" ? .marker : .surface) }
      Prop("opacity") { (view, opacity: Double?) in view.setGuideOpacity(opacity ?? 0.72) }
      Prop("scale") { (view, scale: Double?) in view.setGuideScale(scale ?? 0.88) }
      Prop("rotationDegrees") { (view, rotation: Double?) in view.setGuideRotation(rotation ?? 0) }
      Prop("offsetXmeters") { (view, offset: Double?) in view.setGuideOffsetX(offset ?? 0) }
      Prop("offsetYmeters") { (view, offset: Double?) in view.setGuideOffsetY(offset ?? 0) }
      Prop("paperWidthMeters") { (view, width: Double?) in view.setPaperWidth(width ?? 0.2159) }
      Prop("paperHeightMeters") { (view, height: Double?) in view.setPaperHeight(height ?? 0.2794) }
      Prop("placeRevision") { (view, revision: Int?) in view.placeIfNeeded(revision ?? 0) }
      Prop("resetRevision") { (view, revision: Int?) in view.resetIfNeeded(revision ?? 0) }
    }
  }
}
