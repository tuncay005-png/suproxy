# SuProxy VPN Native Module

Expo local module that bridges JavaScript to platform VPN APIs.

## Android

- `SuProxyVpnService` — Foreground `VpnService` with persistent notification
- `AndroidLibXrayLite` (official GitHub release AAR) — Xray-core for VLESS / Reality / XTLS-Vision
- SOCKS inbound on port `10808` + optional `hev-socks5-tunnel` for TUN routing

### Build

```bash
cd artifacts/suproxy
pnpm install
npx expo prebuild
npx expo run:android
```

Grant VPN permission when prompted on first connect.

### Optional: full TUN routing

Bundle `hev-socks5-tunnel` AAR and add to `modules/suproxy-vpn/android/build.gradle` if traffic is not routed without it.

## iOS

1. Run `npx expo prebuild` to generate the Xcode project
2. In Xcode, add a **Network Extension** target:
   - Product name: `SuProxyTunnel`
   - Bundle ID: `com.app.suproxy.tunnel`
   - Copy `ios-extension/PacketTunnelProvider.swift` into the extension target
3. Link **Xray.xcframework** (from [libXray](https://github.com/XTLS/libXray) or `react-native-nitro-xray-core`)
4. Enable **Network Extensions** capability on both app and extension targets
5. Add App Group: `group.com.app.suproxy`

```bash
npx expo run:ios
```

## JS API

The module exposes `SuProxyVpn` with:

- `prepare()` — Android VPN permission / iOS VPN profile
- `start(configJson)` — Xray JSON config string
- `stop()` — tear down tunnel
- `getStatus()` — `disconnected | connecting | connected | disconnecting | error`

Event: `SuProxyVpnStatusChanged`
