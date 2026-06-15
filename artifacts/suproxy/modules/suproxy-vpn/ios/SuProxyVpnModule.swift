import Foundation
import NetworkExtension
import ExpoModulesCore

public class SuProxyVpnModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SuProxyVpn")

    Events("SuProxyVpnStatusChanged")

    AsyncFunction("prepare") { () -> Bool in
      return await withCheckedContinuation { continuation in
        NETunnelProviderManager.loadAllFromPreferences { managers, error in
          if let error = error {
            NSLog("[SuProxyVpn] load managers failed: \(error.localizedDescription)")
            continuation.resume(returning: false)
            return
          }

          let manager = managers?.first ?? NETunnelProviderManager()
          let proto = NETunnelProviderProtocol()
          proto.providerBundleIdentifier = "com.app.suproxy.tunnel"
          proto.serverAddress = "SuProxy"
          manager.protocolConfiguration = proto
          manager.localizedDescription = "SuProxy VPN"
          manager.isEnabled = true

          manager.saveToPreferences { saveError in
            if let saveError = saveError {
              NSLog("[SuProxyVpn] save preferences failed: \(saveError.localizedDescription)")
              continuation.resume(returning: false)
              return
            }
            continuation.resume(returning: true)
          }
        }
      }
    }

    AsyncFunction("getStatus") { () -> String in
      return await withCheckedContinuation { continuation in
        NETunnelProviderManager.loadAllFromPreferences { managers, _ in
          guard let manager = managers?.first else {
            continuation.resume(returning: "disconnected")
            return
          }
          switch manager.connection.status {
          case .connected:
            continuation.resume(returning: "connected")
          case .connecting, .reasserting:
            continuation.resume(returning: "connecting")
          case .disconnecting:
            continuation.resume(returning: "disconnecting")
          default:
            continuation.resume(returning: "disconnected")
          }
        }
      }
    }

    AsyncFunction("start") { (configJson: String) in
      self.sendEvent("SuProxyVpnStatusChanged", ["status": "connecting"])

      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        NETunnelProviderManager.loadAllFromPreferences { managers, error in
          if let error = error {
            continuation.resume(throwing: error)
            return
          }

          guard let manager = managers?.first else {
            continuation.resume(throwing: NSError(
              domain: "SuProxyVpn",
              code: 1,
              userInfo: [NSLocalizedDescriptionKey: "VPN profile not configured. Call prepare() first."]
            ))
            return
          }

          do {
            try manager.connection.startVPNTunnel(options: [
              "config": configJson as NSString
            ])
            self.sendEvent("SuProxyVpnStatusChanged", ["status": "connected"])
            continuation.resume()
          } catch {
            self.sendEvent("SuProxyVpnStatusChanged", ["status": "error"])
            continuation.resume(throwing: error)
          }
        }
      }
    }

    AsyncFunction("stop") {
      NETunnelProviderManager.loadAllFromPreferences { managers, _ in
        managers?.first?.connection.stopVPNTunnel()
        self.sendEvent("SuProxyVpnStatusChanged", ["status": "disconnected"])
      }
    }
  }
}
