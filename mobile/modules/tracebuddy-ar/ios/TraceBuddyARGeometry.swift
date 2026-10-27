import simd

// Both APIs already express the paper in XZ with a +Y normal. Keep this
// conversion explicit and covered with the same corner checks as the guide.
func traceBuddyMarkerPageBasis(_ imageAnchor: simd_float4x4) -> simd_float4x4 {
  imageAnchor
}

// Local guide coordinates match ARImageAnchor and RealityKit.generatePlane:
// X is page-right, Z is page-down, and +Y is the paper normal. The 1.5 mm
// lift avoids z-fighting. Marker artwork is 50 mm square; placing its right
// edge 15 mm left of the page and aligning the top edges puts the page center
// at (width/2 + 40 mm, depth/2 - 25 mm), before parent adjustment.
func traceBuddyGuideTransform(
  width: Float, depth: Float, scale: Float, rotation: Float,
  offsetX: Float, offsetDepth: Float
) -> simd_float4x4 {
  let cosine = cos(rotation)
  let sine = sin(rotation)
  return simd_float4x4(columns: (
    SIMD4(cosine * width * scale, 0, -sine * width * scale, 0),
    SIMD4(0, 1, 0, 0),
    SIMD4(sine * depth * scale, 0, cosine * depth * scale, 0),
    SIMD4(offsetX, 0.0015, offsetDepth, 1)
  ))
}

// A locked Surface guide uses its world anchor, not a new center raycast.
// Marker guides need the current tracked image in both preview and locked states.
func traceBuddyCandidateIsFresh(
  cameraNormal: Bool, hasGuide: Bool, lockedSurface: Bool, hasCandidate: Bool,
  timestamp: Double?, now: Double, lifetime: Double
) -> Bool {
  guard cameraNormal, hasGuide else { return false }
  if lockedSurface { return true }
  guard hasCandidate, let timestamp else { return false }
  let age = now - timestamp
  return age >= 0 && age <= lifetime
}
