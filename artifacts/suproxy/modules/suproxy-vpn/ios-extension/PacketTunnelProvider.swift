import NetworkExtension
import os.log

/// Packet Tunnel Provider for SuProxy VPN.
/// Add this file to a separate "SuProxyTunnel" Network Extension target in Xcode.
/// Bundle ID: com.app.suproxy.tunnel
///
/// Link Xray.xcframework (from libXray or react-native-nitro-xray-core) and call
/// StartXray(config, tunFd) from the C bridge inside startTunnel(options:).
class PacketTunnelProvider: NEPacketTunnelProvider {
  private let log = Logger(subsystem: "com.app.suproxy.tunnel", category: "PacketTunnel")

  override func startTunnel(options: [String: NSObject]?, completionHandler: @escaping (Error?) -> Void) {
    guard let configJson = options?["config"] as? String else {
      completionHandler(NSError(domain: "SuProxyTunnel", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Missing Xray config"
      ]))
      return
    }

    let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: "254.0.0.1")
    settings.mtu = 1500

    let ipv4 = NEIPv4Settings(addresses: ["10.8.0.2"], subnetMasks: ["255.255.255.0"])
    ipv4.includedRoutes = [NEIPv4Route.default()]
    settings.ipv4Settings = ipv4

    settings.dnsSettings = NEDNSSettings(servers: ["1.1.1.1", "8.8.8.8"])

    setTunnelNetworkSettings(settings) { error in
      if let error = error {
        completionHandler(error)
        return
      }

      // TODO: invoke Xray C bridge with configJson and packetFlow file descriptor
      // Example: StartXray(configJson, tunFd)
      self.log.info("Tunnel started — wire Xray bridge here. Config length: \(configJson.count)")
      completionHandler(nil)
    }
  }

  override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
    // TODO: StopXray()
    completionHandler()
  }
}
