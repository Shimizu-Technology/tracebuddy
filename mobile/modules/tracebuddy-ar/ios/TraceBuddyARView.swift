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
  private var appliedOpacity: Float?
  private var guideMaterial: UnlitMaterial?
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
  private var candidateTimestamp: TimeInterval?
  private var sessionStartedAt: TimeInterval = 0
  private var cameraTrackingState: ARCamera.TrackingState = .notAvailable
  nonisolated private let frameUpdateGate = ARFrameUpdateGate()
  private let candidateLifetime: TimeInterval = 0.5
  private var active = true
  private var sessionRunning = false
  private var isLocked = false
  private var hasAppeared = false
  private var placeRevision = 0
  private var resetRevision = 0
  private var lastPayload = ""
  private var sessionGeneration = 0
  private var trackingLossToken = ARDeadlineToken()
  private var freshnessToken = ARDeadlineToken()
  private var freshnessTimer: Timer?
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
      cancelTrackingLoss()
      arView.session.pause()
      arView.session.delegate = nil
      sessionRunning = false
      invalidateTracking()
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
      invalidateTracking()
    }
  }

  func setGuideImageUri(_ uri: String?) {
    guard guideImageUri != uri else { return }
    guideImageUri = uri
    guideTexture = nil
    guideMaterial = nil
    clearCandidate()
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
    updateGuideAppearance()
  }

  func setGuideScale(_ value: Double) {
    guideScale = sanitize(value, minimum: 0.35, maximum: 1.15, fallback: 0.88)
    updateGuideAppearance()
  }

  func setGuideRotation(_ value: Double) {
    guideRotation = sanitize(value, minimum: -180, maximum: 180, fallback: 0) * .pi / 180
    updateGuideAppearance()
  }

  func setGuideOffsetX(_ value: Double) {
    guideOffsetX = sanitize(value, minimum: -0.25, maximum: 0.25, fallback: 0)
    updateGuideAppearance()
  }

  func setGuideOffsetY(_ value: Double) {
    guideOffsetY = sanitize(value, minimum: -0.25, maximum: 0.25, fallback: 0)
    updateGuideAppearance()
  }

  func setPaperWidth(_ value: Double) {
    paperWidth = sanitize(value, minimum: 0.08, maximum: 0.45, fallback: 0.2159)
    updateGuideAppearance()
  }

  func setPaperHeight(_ value: Double) {
    paperHeight = sanitize(value, minimum: 0.08, maximum: 0.45, fallback: 0.2794)
    updateGuideAppearance()
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

    invalidateTracking()
    sessionStartedAt = CACurrentMediaTime()
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
          self.guideMaterial = nil
          self.rebuildGuideGeometry()
        }
      )
  }

  private func resetSession(resetTracking: Bool) {
    cancelTrackingLoss()
    guideRoot.transform = .identity
    guideRoot.isEnabled = false
    guideEntity?.removeFromParent()
    guideEntity = nil
    rebuildGuideGeometry()
    latestSurfaceTransform = nil
    candidateTimestamp = nil
    markerTransform = nil
    markerIsTracked = false
    isLocked = false
    reticle.isHidden = false
    startSessionIfPossible(resetTracking: resetTracking)
  }

  private var cameraIsNormal: Bool {
    guard active, hasAppeared, sessionRunning,
          case .normal = cameraTrackingState,
          let frame = arView.session.currentFrame,
          case .normal = frame.camera.trackingState,
          traceBuddyFrameIsFresh(timestamp: frame.timestamp, sessionStartedAt: sessionStartedAt,
                                 now: CACurrentMediaTime(), lifetime: candidateLifetime) else { return false }
    return true
  }

  private var candidateIsFresh: Bool {
    traceBuddyCandidateIsFresh(
      cameraNormal: cameraIsNormal, hasGuide: guideEntity != nil,
      lockedSurface: isLocked && placementMode == .surface,
      hasCandidate: placementMode == .marker ? markerIsTracked && markerTransform != nil : latestSurfaceTransform != nil,
      timestamp: candidateTimestamp, now: CACurrentMediaTime(), lifetime: candidateLifetime
    )
  }

  private func clearCandidate() {
    cancelFreshnessDeadline()
    latestSurfaceTransform = nil
    markerTransform = nil
    markerIsTracked = false
    candidateTimestamp = nil
    guideRoot.isEnabled = false
  }

  private func invalidateTracking() {
    sessionGeneration += 1
    cancelTrackingLoss()
    cameraTrackingState = .notAvailable
    clearCandidate()
  }

  private func lockCurrentPlacement() {
    guard !isLocked, guideTexture != nil, cameraIsNormal else { return }
    // Re-query now: the last preview event is not authority to place a guide.
    updatePlacement()
    guard candidateIsFresh else { return }
    let transform = placementMode == .marker ? markerTransform : latestSurfaceTransform
    guard let transform else { return }
    isLocked = true
    reticle.isHidden = true
    guideRoot.setTransformMatrix(transform, relativeTo: nil)
    guideRoot.isEnabled = true
    emit(session: "running", tracking: "normal", reason: "none", anchor: "tracked", placement: "locked")
  }

  private func setPreviewTransform(_ transform: simd_float4x4, anchorState: String) {
    guard !isLocked, candidateIsFresh else { return }
    guideRoot.setTransformMatrix(transform, relativeTo: nil)
    guideRoot.isEnabled = true
    emit(session: "running", tracking: "normal", reason: "none", anchor: anchorState, placement: "preview")
  }

  private func rebuildGuideGeometry() {
    guard let texture = guideTexture else { return }
    guideEntity?.removeFromParent()
    var material = UnlitMaterial()
    material.color = .init(tint: UIColor.white, texture: .init(texture))
    material.opacityThreshold = 0.01
    guideMaterial = material
    appliedOpacity = nil
    // A unit XZ plane lets size, rotation and nudges use only entity transforms.
    let entity = ModelEntity(mesh: .generatePlane(width: 1, depth: 1), materials: [material])
    guideRoot.addChild(entity)
    guideEntity = entity
    updateGuideAppearance()
  }

  private func updateGuideAppearance() {
    guard let entity = guideEntity else { return }
    entity.transform = Transform(matrix: traceBuddyGuideTransform(
      width: paperWidth, depth: paperHeight, scale: guideScale,
      rotation: guideRotation, offsetX: guideOffsetX, offsetDepth: guideOffsetY
    ))
    if appliedOpacity != guideOpacity, var material = guideMaterial {
      material.blending = .transparent(opacity: .init(floatLiteral: guideOpacity))
      entity.model?.materials = [material]
      guideMaterial = material
      appliedOpacity = guideOpacity
    }
  }

  private func updatePlacement() {
    guard active, hasAppeared, sessionRunning else { return }
    // Re-arm on processed frames, independently of deduplicated bridge emits.
    // The locked Surface path also needs a watchdog if ARKit stops delivering.
    defer { if candidateIsFresh { armFreshnessDeadline() } }
    guard cameraIsNormal else {
      clearCandidate()
      emitCameraState()
      return
    }
    if placementMode == .marker {
      let imageAnchor = arView.session.currentFrame?.anchors.compactMap { $0 as? ARImageAnchor }.first
      updateMarkerPlacement(imageAnchor)
      return
    }
    if isLocked {
      guideRoot.isEnabled = true
      cancelTrackingLoss()
      emit(session: "running", tracking: "normal", reason: "none", anchor: "tracked", placement: "locked")
      return
    }
    guard arView.bounds.width > 0, arView.bounds.height > 0 else { return }
    let center = CGPoint(x: arView.bounds.midX, y: arView.bounds.midY)
    let results = arView.raycast(from: center, allowing: .existingPlaneGeometry, alignment: .horizontal)
    let result = results.first ?? arView.raycast(from: center, allowing: .estimatedPlane, alignment: .horizontal).first
    guard let result else {
      clearCandidate()
      emit(session: "running", tracking: "normal", reason: "none", anchor: "none", placement: "none")
      return
    }
    latestSurfaceTransform = result.worldTransform
    candidateTimestamp = arView.session.currentFrame?.timestamp
    setPreviewTransform(result.worldTransform, anchorState: "surfaceFound")
  }

  private func pauseForBackground() {
    guard sessionRunning else { return }
    arView.session.pause()
    sessionRunning = false
    invalidateTracking()
    cancelTrackingLoss()
    emit(session: "interrupted", tracking: "unavailable", reason: "none", anchor: isLocked ? "stale" : "none", placement: isLocked ? "locked" : "none")
  }

  private func resumeFromBackground() {
    guard active, hasAppeared else { return }
    startSessionIfPossible(resetTracking: false)
    guard isLocked else { return }
    emit(session: "running", tracking: "limited", reason: "relocalizing", anchor: "stale", placement: "locked")
    scheduleTrackingLoss()
  }

  private func emit(session: String, tracking: String, reason: String, anchor: String, placement: String, message: String? = nil) {
    // Never let preview/anchor callbacks promote a limited camera to normal.
    let authoritativeTracking = tracking == "normal" && !cameraIsNormal ? cameraStateName : tracking
    let authoritativeReason = tracking == "normal" && !cameraIsNormal ? cameraReasonName : reason
    let fresh = session == "running" && candidateIsFresh
    let payload = [String(resetRevision), guideImageUri ?? "", session, authoritativeTracking, authoritativeReason, anchor, placement, String(fresh), message ?? ""].joined(separator: "|")
    guard payload != lastPayload else { return }
    lastPayload = payload
    var event: [String: Any] = ["resetRevision": resetRevision, "guideImageUri": guideImageUri ?? "", "session": session, "tracking": authoritativeTracking, "reason": authoritativeReason, "anchor": anchor, "placement": placement, "candidateFresh": fresh]
    if let message { event["message"] = message }
    onStateChange(event)
  }

  private var cameraStateName: String {
    switch cameraTrackingState {
    case .normal: return cameraIsNormal ? "normal" : "unavailable"
    case .limited: return "limited"
    case .notAvailable: return "unavailable"
    }
  }

  private var cameraReasonName: String {
    if case .limited(let reason) = cameraTrackingState { return Self.reasonName(reason) }
    return "none"
  }

  private func emitCameraState() {
    emit(session: "running", tracking: cameraStateName, reason: cameraReasonName,
         anchor: isLocked ? "stale" : "none", placement: isLocked ? "locked" : "none")
  }

  nonisolated func session(_ session: ARSession, didUpdate frame: ARFrame) {
    guard frameUpdateGate.begin() else { return }
    Task { @MainActor [weak self, frameUpdateGate] in
      defer { frameUpdateGate.end() }
      self?.updatePlacement()
    }
  }

  nonisolated func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
    let state = camera.trackingState
    Task { @MainActor [weak self] in
      guard let self, self.active, self.hasAppeared, self.sessionRunning else { return }
      self.cameraTrackingState = state
      if self.cameraIsNormal {
        self.updatePlacement()
      } else {
        self.clearCandidate()
        self.emitCameraState()
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

  private func cancelTrackingLoss() {
    trackingLossToken.invalidate()
    relocalizationTimer?.invalidate()
    relocalizationTimer = nil
  }

  private func scheduleTrackingLoss() {
    guard relocalizationTimer == nil, active, hasAppeared, sessionRunning else { return }
    let generation = sessionGeneration
    let token = trackingLossToken.arm()
    let timer = Timer(timeInterval: 8, repeats: false) { [weak self] _ in
      Task { @MainActor in
        guard let self, self.isLocked, self.hasAppeared,
              self.trackingLossToken.accepts(token, session: generation, currentSession: self.sessionGeneration,
                                             active: self.active, running: self.sessionRunning) else { return }
        self.cancelTrackingLoss()
        self.guideRoot.isEnabled = false
        self.emit(session: "running", tracking: "limited", reason: "unknown", anchor: "stale", placement: "locked")
      }
    }
    relocalizationTimer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  private func cancelFreshnessDeadline() {
    freshnessToken.invalidate()
    freshnessTimer?.invalidate()
    freshnessTimer = nil
  }

  private func armFreshnessDeadline() {
    cancelFreshnessDeadline()
    guard let frame = arView.session.currentFrame else { return }
    let generation = sessionGeneration
    let token = freshnessToken.arm()
    let remaining = max(0.001, frame.timestamp + candidateLifetime - CACurrentMediaTime())
    let timer = Timer(timeInterval: remaining, repeats: false) { [weak self] _ in
      Task { @MainActor in
        guard let self, self.hasAppeared,
              self.freshnessToken.accepts(token, session: generation, currentSession: self.sessionGeneration,
                                          active: self.active, running: self.sessionRunning) else { return }
        // Tolerate an early timer firing; frame age, never bridge receipt time,
        // is authority. Healthy frames invalidate every prior deadline token.
        if self.candidateIsFresh { self.armFreshnessDeadline(); return }
        self.clearCandidate()
        self.emit(session: "running", tracking: self.cameraStateName, reason: self.cameraReasonName,
                  anchor: self.isLocked ? "stale" : "none", placement: self.isLocked ? "locked" : "none",
                  message: "Tracking frames stopped. Hold still or reset Paper Lock.")
        if self.isLocked { self.scheduleTrackingLoss() }
      }
    }
    freshnessTimer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  // Frame processing reads the latest image anchor, rather than queuing an extra
  // main-actor task for every marker callback with a potentially stale transform.
  private func updateMarkerPlacement(_ imageAnchor: ARImageAnchor?) {
    guard placementMode == .marker, cameraIsNormal else { return }
    guard let imageAnchor, imageAnchor.isTracked else {
      clearCandidate()
      emit(session: "running", tracking: cameraStateName, reason: cameraReasonName,
           anchor: isLocked ? "stale" : "none", placement: isLocked ? "locked" : "none",
           message: "Show the whole Paper Lock marker in even light.")
      if isLocked { scheduleTrackingLoss() }
      return
    }
    // ARImageAnchor and RealityKit's width/depth plane both use XZ, +Y normal.
    // Apply the anchor directly: an extra X rotation would stand the page up.
    let transform = traceBuddyMarkerPageBasis(imageAnchor.transform)
    markerTransform = transform
    markerIsTracked = true
    candidateTimestamp = arView.session.currentFrame?.timestamp
    if isLocked {
      cancelTrackingLoss()
      guideRoot.setTransformMatrix(transform, relativeTo: nil)
      guideRoot.isEnabled = candidateIsFresh
      emit(session: "running", tracking: "normal", reason: "none", anchor: "tracked", placement: "locked")
    } else {
      setPreviewTransform(transform, anchorState: "markerFound")
    }
  }

  nonisolated func sessionWasInterrupted(_ session: ARSession) {
    Task { @MainActor [weak self] in
      guard let self else { return }
      self.sessionRunning = false
      self.invalidateTracking()
      self.emit(session: "interrupted", tracking: "unavailable", reason: "none", anchor: self.isLocked ? "stale" : "none", placement: self.isLocked ? "locked" : "none")
    }
  }

  nonisolated func sessionInterruptionEnded(_ session: ARSession) {
    Task { @MainActor [weak self] in self?.resumeFromBackground() }
  }

  nonisolated func session(_ session: ARSession, didFailWithError error: Error) {
    Task { @MainActor [weak self] in
      self?.sessionRunning = false
      self?.invalidateTracking()
      self?.emit(session: "failed", tracking: "unavailable", reason: "unknown", anchor: "none", placement: "none", message: "Tracking stopped. Reset Paper Lock or use Camera Trace.")
    }
  }

  nonisolated func sessionShouldAttemptRelocalization(_ session: ARSession) -> Bool { true }

  func coachingOverlayViewWillActivate(_ coachingOverlayView: ARCoachingOverlayView) { reticle.isHidden = true }
  func coachingOverlayViewDidDeactivate(_ coachingOverlayView: ARCoachingOverlayView) { reticle.isHidden = isLocked }
  func coachingOverlayViewDidRequestSessionReset(_ coachingOverlayView: ARCoachingOverlayView) { resetSession(resetTracking: true) }
}
