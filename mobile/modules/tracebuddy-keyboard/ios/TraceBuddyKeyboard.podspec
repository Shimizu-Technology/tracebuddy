Pod::Spec.new do |s|
  s.name = 'TraceBuddyKeyboard'
  s.version = '1.0.0'
  s.summary = 'Local keepsake keyboard dismissal'
  s.description = 'A focused Escape key responder for the TraceBuddy keepsake.'
  s.author = 'Shimizu Technology'
  s.homepage = 'https://tracebuddy-gu.netlify.app/'
  s.platforms = { :ios => '16.4' }
  s.source = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'UIKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
