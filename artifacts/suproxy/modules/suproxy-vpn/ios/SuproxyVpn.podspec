Pod::Spec.new do |s|
  s.name           = 'SuproxyVpn'
  s.version        = '1.0.0'
  s.summary        = 'SuProxy VPN native module'
  s.description    = 'Expo module for SuProxy VPN (Android VpnService + iOS NetworkExtension)'
  s.license        = 'MIT'
  s.author         = 'SuProxy'
  s.homepage       = 'https://github.com/suproxy/suproxy'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.source_files   = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.frameworks     = 'NetworkExtension'
  s.dependency 'ExpoModulesCore'
end
