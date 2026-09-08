Pod::Spec.new do |s|
  s.name           = 'TraceBuddyAR'
  s.version        = '1.0.0'
  s.summary        = 'TraceBuddy RealityKit paper anchoring'
  s.description    = 'A local-only RealityKit view that anchors tracing guides to paper or a tabletop.'
  s.author         = 'Shimizu Technology'
  s.homepage       = 'https://tracebuddy-gu.netlify.app/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ARKit', 'RealityKit'
  s.resource_bundles = {
    'TraceBuddyARResources' => ['Resources/**/*']
  }

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
