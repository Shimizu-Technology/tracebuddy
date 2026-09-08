@preconcurrency import ARKit
import Combine
import ExpoModulesCore
import RealityKit
import UIKit

enum TraceBuddyARPlacementMode {
  case surface
  case marker
}

@MainActor
final class TraceBuddyARView: ExpoView, ARSessionDelegate, @preconcurrency ARCoachingOverlayViewDelegate, @unchecked Sendable {
  let onStateChange = EventDispatcher()

  private let arView = ARView(frame: .zero, cameraMode: .ar, automaticallyConfigureSession: false)
  private let coachingOverlay = ARCoachingOverlayView()
  private let reticle = UIView()
  private let sceneAnchor = AnchorEntity(world: matrix_identity_float4x4)
  private let guideRoot = Entity()
  private var guideEntity: ModelEntity?
  private var guideTexture: TextureResource?
  private var guideImageUri: String?
  private var placementMode: TraceBuddyARPlacementMode = .surface
  private var guideOpacity: Float = 0.72
  private var guideScale: Float = 0.88
  private var guideRotation: Float = 0
  private var guideOffsetX: Float = 0
  private var guideOffsetY: Float = 0
  private var paperWidth: Float = 0.2159
  private var paperHeight: Float = 0.2794
  private var latestSurfaceTransform: simd_float4x4?
  private var markerTransform: simd_float4x4?
  private var markerIsTracked = false
  private var active = true
  private var sessionRunning = false
  private var isLocked = false
  private var hasAppeared = false
  private var placeRevision = 0
  private var resetRevision = 0
  private var lastPayload = ""
  private var relocalizationTimer: Timer?
  private var textureLoad: AnyCancellable?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black

    arView.translatesAutoresizingMaskIntoConstraints = false
    arView.renderOptions.insert(.disableCameraGrain)
    arView.session.delegate = self
    addSubview(arView)

    sceneAnchor.addChild(guideRoot)
    guideRoot.isEnabled = false
    arView.scene.addAnchor(sceneAnchor)

    coachingOverlay.translatesAutoresizingMaskIntoConstraints = false
    coachingOverlay.session = arView.session
    coachingOverlay.goal = .horizontalPlane
    coachingOverlay.activatesAutomatically = true
    coachingOverlay.delegate = self
    addSubview(coachingOverlay)

    reticle.translatesAutoresizingMaskIntoConstraints = false
    reticle.isUserInteractionEnabled = false
    reticle.layer.borderColor = UIColor.white.withAlphaComponent(0.92).cgColor
    reticle.layer.borderWidth = 2
    reticle.layer.cornerRadius = 12
    reticle.backgroundColor = UIColor.white.withAlphaComponent(0.08)
    addSubview(reticle)

    NSLayoutConstraint.activate([
      arView.leadingAnchor.constraint(equalTo: leadingAnchor),
      arView.trailingAnchor.constraint(equalTo: trailingAnchor),
      arView.topAnchor.constraint(equalTo: topAnchor),
      arView.bottomAnchor.constraint(equalTo: bottomAnchor),
      coachingOverlay.leadingAnchor.constraint(equalTo: leadingAnchor),
      coachingOverlay.trailingAnchor.constraint(equalTo: trailingAnchor),
      coachingOverlay.topAnchor.constraint(equalTo: topAnchor),
      coachingOverlay.bottomAnchor.constraint(equalTo: bottomAnchor),
      reticle.centerXAnchor.constraint(equalTo: centerXAnchor),
      reticle.centerYAnchor.constraint(equalTo: centerYAnchor),
      reticle.widthAnchor.constraint(equalToConstant: 76),
      reticle.heightAnchor.constraint(equalToConstant: 76),
    ])

    NotificationCenter.default.addObserver(self, selector: #selector(appWillResignActive), name: UIApplication.willResignActiveNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(appDidBecomeActive), name: UIApplication.didBecomeActiveNotification, object: nil)
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    hasAppeared = window != nil
    if hasAppeared {
      arView.session.delegate = self
      startSessionIfPossible(resetTracking: !sessionRunning)
    } else {
      relocalizationTimer?.invalidate()
      relocalizationTimer = nil
      arView.session.pause()
      arView.session.delegate = nil
      sessionRunning = false
    }
  }

  @objc private func appWillResignActive() { pauseForBackground() }
  @objc private func appDidBecomeActive() {
    arView.session.delegate = self
    resumeFromBackground()
  }

  func setActive(_ value: Bool) {
    guard active != value else { return }
    active = value
    if value { startSessionIfPossible(resetTracking: !sessionRunning) } else {
      arView.session.pause()
      sessionRunning = false
    }
  }

  func setGuideImageUri(_ uri: String?) {
    guard guideImageUri != uri else { return }
    guideImageUri = uri
    guideTexture = nil
    guideRoot.isEnabled = false
    guideEntity?.removeFromParent()
    guideEntity = nil
    loadGuideTexture(uri)
  }

  func setPlacementMode(_ mode: TraceBuddyARPlacementMode) {
    guard placementMode != mode else { return }
    placementMode = mode
    resetSession(resetTracking: true)
  }

  func setGuideOpacity(_ value: Double) {
    guideOpacity = sanitize(value, minimum: 0.12, maximum: 1, fallback: 0.72)
    updateGuideGeometry()
  }

  func setGuideScale(_ value: Double) {
    guideScale = sanitize(value, minimum: 0.35, maximum: 1.15, fallback: 0.88)
    updateGuideGeometry()
  }

  func setGuideRotation(_ value: Double) {
    guideRotation = sanitize(value, minimum: -180, maximum: 180, fallback: 0) * .pi / 180
    updateGuideGeometry()
  }

  func setGuideOffsetX(_ value: Double) {
    guideOffsetX = sanitize(value, minimum: -0.25, maximum: 0.25, fallback: 0)
    updateGuideGeometry()
  }

  func setGuideOffsetY(_ value: Double) {
    guideOffsetY = sanitize(value, minimum: -0.25, maximum: 0.25, fallback: 0)
    updateGuideGeometry()
  }

  func setPaperWidth(_ value: Double) {
    paperWidth = sanitize(value, minimum: 0.08, maximum: 0.45, fallback: 0.2159)
    updateGuideGeometry()
  }

  func setPaperHeight(_ value: Double) {
    paperHeight = sanitize(value, minimum: 0.08, maximum: 0.45, fallback: 0.2794)
    updateGuideGeometry()
  }

  func placeIfNeeded(_ revision: Int) {
    guard revision > placeRevision else { return }
    placeRevision = revision
    lockCurrentPlacement()
  }

  func resetIfNeeded(_ revision: Int) {
    guard revision > resetRevision else { return }
    resetRevision = revision
    resetSession(resetTracking: true)
  }

  private func sanitize(_ value: Double, minimum: Float, maximum: Float, fallback: Float) -> Float {
    guard value.isFinite else { return fallback }
    return min(maximum, max(minimum, Float(value)))
  }

  private func startSessionIfPossible(resetTracking: Bool) {
    guard active, hasAppeared else { return }
    guard ARWorldTrackingConfiguration.isSupported else {
      emit(session: "unsupported", tracking: "unavailable", reason: "none", anchor: "none", placement: "none")
      return
    }

    let config = makeConfiguration()
    var options: ARSession.RunOptions = []
    if resetTracking { options = [.resetTracking, .removeExistingAnchors] }
    arView.session.run(config, options: options)
    sessionRunning = true
    coachingOverlay.goal = placementMode == .surface ? .horizontalPlane : .tracking
    emit(session: "running", tracking: "initializing", reason: "initializing", anchor: "none", placement: "none")
  }

  private func makeConfiguration() -> ARWorldTrackingConfiguration {
    let config = ARWorldTrackingConfiguration()
    config.worldAlignment = .gravity
    config.planeDetection = [.horizontal]
    config.environmentTexturing = .none
    config.isAutoFocusEnabled = true
    if placementMode == .marker, let marker = makeMarkerReferenceImage() {
      config.detectionImages = [marker]
      config.maximumNumberOfTrackedImages = 1
    }
    return config
  }

  private func makeMarkerReferenceImage() -> ARReferenceImage? {
    for bundle in [Bundle(for: Self.self), Bundle.main] {
      let resourceBundle = bundle.url(forResource: "TraceBuddyARResources", withExtension: "bundle").flatMap(Bundle.init(url:))
      for candidate in [resourceBundle, bundle].compactMap({ $0 }) {
        if let url = candidate.url(forResource: "tracebuddy-paper-lock-marker", withExtension: "png"),
           let image = UIImage(contentsOfFile: url.path), let cgImage = image.cgImage {
          let reference = ARReferenceImage(cgImage, orientation: .up, physicalWidth: 0.05)
          reference.name = "TraceBuddy Paper Lock"
          return reference
        }
      }
    }
    return nil
  }

  private func loadGuideTexture(_ uri: String?) {
    guard let uri, let url = URL(string: uri), url.isFileURL else {
      emit(session: sessionRunning ? "running" : "idle", tracking: "limited", reason: "unknown", anchor: "none", placement: "none", message: "The tracing guide could not be prepared.")
      return
    }

    let expectedUri = uri
    textureLoad?.cancel()
    textureLoad = TextureResource.loadAsync(contentsOf: url, withName: "TraceBuddy guide")
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self] completion in
          guard case .failure = completion, let self, self.guideImageUri == expectedUri else { return }
          self.emit(session: self.sessionRunning ? "running" : "idle", tracking: "limited", reason: "unknown", anchor: "none", placement: "none", message: "The tracing guide could not be loaded.")
        },
        receiveValue: { [weak self] texture in
          guard let self, self.guideImageUri == expectedUri else { return }
          self.guideTexture = texture
          self.updateGuideGeometry()
        }
      )
  }

  private func resetSession(resetTracking: Bool) {
    relocalizationTimer?.invalidate()
    relocalizationTimer = nil
    guideRoot.transform = .identity
    guideRoot.isEnabled = false
    guideEntity?.removeFromParent()
    guideEntity = nil
    latestSurfaceTransform = nil
    markerTransform = nil
    markerIsTracked = false
    isLocked = false
    reticle.isHidden = false
    startSessionIfPossible(resetTracking: resetTracking)
  }

  private func lockCurrentPlacement() {
    guard !isLocked, guideTexture != nil else { return }
    if placementMode == .marker, !markerIsTracked { return }
    let transform = placementMode == .marker ? markerTransform : latestSurfaceTransform
    guard let transform else { return }
    isLocked = true
    reticle.isHidden = true
    guideRoot.setTransformMatrix(transform, relativeTo: nil)
    guideRoot.isEnabled = true
    updateGuideGeometry()
    emit(session: "running", tracking: "normal", reason: "none", anchor: "tracked", placement: "locked")
  }

  private func setPreviewTransform(_ transform: simd_float4x4, anchorState: String) {
    guard !isLocked, guideTexture != nil else { return }
    guideRoot.setTransformMatrix(transform, relativeTo: nil)
    guideRoot.isEnabled = true
    emit(session: "running", tracking: "normal", reason: "none", anchor: anchorState, placement: "preview")
  }

  private func updateGuideGeometry() {
    guard let texture = guideTexture else { return }
    guideEntity?.removeFromParent()
    let mesh = MeshResource.generatePlane(width: paperWidth * guideScale, depth: paperHeight * guideScale)
    var material = UnlitMaterial()
    material.color = .init(tint: UIColor.white, texture: .init(texture))
    material.blending = .transparent(opacity: .init(floatLiteral: guideOpacity))
    material.opacityThreshold = 0.01
    let entity = ModelEntity(mesh: mesh, materials: [material])
    entity.position = [guideOffsetX, 0.0015, guideOffsetY]
    entity.orientation = simd_quatf(angle: guideRotation, axis: [0, 1, 0])
    guideRoot.addChild(entity)
    guideEntity = entity
  }

  private func updateSurfacePreview() {
    guard placementMode == .surface, !isLocked, arView.bounds.width > 0, arView.bounds.height > 0 else { return }
    let center = CGPoint(x: arView.bounds.midX, y: arView.bounds.midY)
    let results = arView.raycast(from: center, allowing: .existingPlaneGeometry, alignment: .horizontal)
    let result = results.first ?? arView.raycast(from: center, allowing: .estimatedPlane, alignment: .horizontal).first
    guard let result else { return }
    latestSurfaceTransform = result.worldTransform
    setPreviewTransform(result.worldTransform, anchorState: "surfaceFound")
  }

  private func pauseForBackground() {
    guard sessionRunning else { return }
    arView.session.pause()
    sessionRunning = false
    relocalizationTimer?.invalidate()
    relocalizationTimer = nil
    emit(session: "interrupted", tracking: "unavailable", reason: "none", anchor: isLocked ? "stale" : "none", placement: isLocked ? "locked" : "none")
  }

  private func resumeFromBackground() {
    guard active, hasAppeared else { return }
    startSessionIfPossible(resetTracking: false)
    guard isLocked else { return }
    emit(session: "running", tracking: "limited", reason: "relocalizing", anchor: "stale", placement: "locked")
    relocalizationTimer?.invalidate()
    relocalizationTimer = Timer.scheduledTimer(withTimeInterval: 8, repeats: false) { [weak self] _ in
      Task { @MainActor in
        guard let self, self.isLocked else { return }
        self.relocalizationTimer = nil
        self.guideRoot.isEnabled = false
        self.emit(session: "running", tracking: "limited", reason: "unknown", anchor: "stale", placement: "locked")
      }
    }
  }

  private func emit(session: String, tracking: String, reason: String, anchor: String, placement: String, message: String? = nil) {
    let payload = [session, tracking, reason, anchor, placement, message ?? ""].joined(separator: "|")
    guard payload != lastPayload else { return }
    lastPayload = payload
    var event: [String: Any] = ["session": session, "tracking": tracking, "reason": reason, "anchor": anchor, "placement": placement]
    if let message { event["message"] = message }
    onStateChange(event)
  }

  nonisolated func session(_ session: ARSession, didUpdate frame: ARFrame) {
    Task { @MainActor [weak self] in self?.updateSurfacePreview() }
  }

  nonisolated func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
    let state = camera.trackingState
    Task { @MainActor [weak self] in
      guard let self else { return }
      switch state {
      case .normal:
        if self.isLocked {
          if self.placementMode == .marker, !self.markerIsTracked {
            self.scheduleTrackingLoss()
            self.emit(session: "running", tracking: "limited", reason: "unknown", anchor: "stale", placement: "locked", message: "Show the Paper Lock marker again.")
          } else {
            self.relocalizationTimer?.invalidate()
            self.relocalizationTimer = nil
            self.guideRoot.isEnabled = true
            self.emit(session: "running", tracking: "normal", reason: "none", anchor: "tracked", placement: "locked")
          }
        } else if self.placementMode == .marker, self.markerIsTracked, let transform = self.markerTransform {
          self.setPreviewTransform(transform, anchorState: "markerFound")
        } else {
          self.emit(session: "running", tracking: "normal", reason: "none", anchor: "none", placement: "none")
        }
      case .notAvailable:
        self.emit(session: "running", tracking: "unavailable", reason: "unknown", anchor: self.isLocked ? "stale" : "none", placement: self.isLocked ? "locked" : "none")
      case .limited(let reason):
        self.emit(session: "running", tracking: "limited", reason: Self.reasonName(reason), anchor: self.isLocked ? "tracked" : "none", placement: self.isLocked ? "locked" : "none")
        if self.isLocked { self.scheduleTrackingLoss() }
      }
    }
  }

  nonisolated private static func reasonName(_ reason: ARCamera.TrackingState.Reason) -> String {
    switch reason {
    case .initializing: return "initializing"
    case .excessiveMotion: return "excessiveMotion"
    case .insufficientFeatures: return "insufficientFeatures"
    case .relocalizing: return "relocalizing"
    @unknown default: return "unknown"
    }
  }

  private func scheduleTrackingLoss() {
    guard relocalizationTimer == nil else { return }
    relocalizationTimer = Timer.scheduledTimer(withTimeInterval: 8, repeats: false) { [weak self] _ in
      Task { @MainActor in
        guard let self, self.isLocked else { return }
        self.relocalizationTimer = nil
        self.guideRoot.isEnabled = false
        self.emit(session: "running", tracking: "limited", reason: "unknown", anchor: "stale", placement: "locked")
      }
    }
  }

  nonisolated func session(_ session: ARSession, didAdd anchors: [ARAnchor]) { updateMarkerAnchor(from: anchors) }
  nonisolated func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) { updateMarkerAnchor(from: anchors) }

  nonisolated func session(_ session: ARSession, didRemove anchors: [ARAnchor]) {
    guard anchors.contains(where: { $0 is ARImageAnchor }) else { return }
    Task { @MainActor [weak self] in
      guard let self, self.placementMode == .marker else { return }
      self.markerTransform = nil
      self.markerIsTracked = false
      if self.isLocked {
        self.emit(session: "running", tracking: "limited", reason: "unknown", anchor: "stale", placement: "locked", message: "Show the Paper Lock marker again.")
        self.scheduleTrackingLoss()
      } else {
        self.guideRoot.isEnabled = false
        self.emit(session: "running", tracking: "normal", reason: "none", anchor: "none", placement: "none", message: "Show the Paper Lock marker again.")
      }
    }
  }

  nonisolated private func updateMarkerAnchor(from anchors: [ARAnchor]) {
    guard let imageAnchor = anchors.compactMap({ $0 as? ARImageAnchor }).first else { return }
    let markerToHorizontalPage = simd_float4x4(simd_quatf(angle: .pi / 2, axis: [1, 0, 0]))
    let transform = imageAnchor.transform * markerToHorizontalPage
    let tracked = imageAnchor.isTracked
    Task { @MainActor [weak self] in
      guard let self, self.placementMode == .marker else { return }
      self.markerTransform = transform
      self.markerIsTracked = tracked
      if self.isLocked {
        if tracked {
          self.relocalizationTimer?.invalidate()
          self.relocalizationTimer = nil
          self.guideRoot.setTransformMatrix(transform, relativeTo: nil)
          self.guideRoot.isEnabled = true
        } else {
          self.scheduleTrackingLoss()
        }
        self.emit(session: "running", tracking: tracked ? "normal" : "limited", reason: tracked ? "none" : "unknown", anchor: tracked ? "tracked" : "stale", placement: "locked")
      } else if tracked {
        self.setPreviewTransform(transform, anchorState: "markerFound")
      } else {
        self.guideRoot.isEnabled = false
        self.emit(session: "running", tracking: "normal", reason: "none", anchor: "none", placement: "none", message: "Show the Paper Lock marker again.")
      }
    }
  }

  nonisolated func sessionWasInterrupted(_ session: ARSession) {
    Task { @MainActor [weak self] in
      guard let self else { return }
      self.emit(session: "interrupted", tracking: "unavailable", reason: "none", anchor: self.isLocked ? "stale" : "none", placement: self.isLocked ? "locked" : "none")
    }
  }

  nonisolated func sessionInterruptionEnded(_ session: ARSession) {
    Task { @MainActor [weak self] in self?.resumeFromBackground() }
  }

  nonisolated func session(_ session: ARSession, didFailWithError error: Error) {
    Task { @MainActor [weak self] in
      self?.emit(session: "failed", tracking: "unavailable", reason: "unknown", anchor: "none", placement: "none", message: "Tracking stopped. Reset Paper Lock or use Camera Trace.")
    }
  }

  nonisolated func sessionShouldAttemptRelocalization(_ session: ARSession) -> Bool { true }

  func coachingOverlayViewWillActivate(_ coachingOverlayView: ARCoachingOverlayView) { reticle.isHidden = true }
  func coachingOverlayViewDidDeactivate(_ coachingOverlayView: ARCoachingOverlayView) { reticle.isHidden = isLocked }
  func coachingOverlayViewDidRequestSessionReset(_ coachingOverlayView: ARCoachingOverlayView) { resetSession(resetTracking: true) }
}
