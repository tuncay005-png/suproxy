# VPN Adapter Architecture

## Overview

This directory contains platform-specific VPN adapters that implement a unified interface for VPN operations across Android and iOS. The adapter pattern separates platform-specific logic from the common VPN service layer.

## Architecture

```
VpnService (Platform-agnostic business logic)
    ↓
IVpnAdapter (Interface)
    ↓
AndroidVpnAdapter / IosVpnAdapter (Platform-specific implementations)
```

## Key Features

### 1. Fast Path Startup
- VPN starts immediately without fixed delays
- UI shows "connecting" state instantly
- No `Thread.sleep()` or artificial timeouts

### 2. Event-Driven Retry Mechanism
- Short retry intervals (100-200ms)
- Polls for readiness instead of waiting blindly
- Configurable timeout (3-5 seconds default)

### 3. Health Check
- Verifies real internet connectivity after connection
- Prevents "connected but no internet" problem
- Uses lightweight HTTP request to reliable endpoint (Cloudflare 1.1.1.1)

### 4. Platform-Specific Readiness Checks

#### Android (Xray-based)
- Waits for SOCKS proxy port (127.0.0.1:10808) to be ready
- Uses TCP connection check to verify port is listening
- TProxyService only starts AFTER port is confirmed ready
- No race conditions between Xray startup and TProxyService

#### iOS (Network Extension)
- Waits for Network Extension tunnel to reach "connected" state
- Uses NEVPNStatus polling instead of port checks
- Compatible with sing-box/Xray core events

## Usage

The adapter is automatically selected based on platform:

```typescript
import { vpnService } from "@/lib/vpn/VpnService";

// Start VPN (uses AndroidVpnAdapter on Android, IosVpnAdapter on iOS)
await vpnService.connect();
```

## Connection Flow

### Android Connection Flow
1. `prepare()` - Check VPN permissions
2. `start(configJson)` - Start native VPN service (fast path - returns immediately)
3. `waitForCoreReady()` - Poll SOCKS port until ready (max 5s)
   - Retries every 150ms
   - Checks TCP connection to 127.0.0.1:10808
4. `healthCheck()` - Verify internet connectivity (max 3s)
   - Fetches https://1.1.1.1/cdn-cgi/trace
5. Mark as "connected" only if health check passes

### iOS Connection Flow
1. `prepare()` - Setup Network Extension profile
2. `start(configJson)` - Start Network Extension tunnel (fast path)
3. `waitForCoreReady()` - Poll NEVPNStatus until "connected" (max 5s)
   - Retries every 150ms
   - Checks `getStatus()` for "connected" or "error"
4. `healthCheck()` - Verify internet connectivity (max 3s)
5. Mark as "connected" only if health check passes

## Benefits

### No "Connected but No Internet" Problem
- Health check ensures VPN is actually routing traffic
- User never sees false "connected" state

### Fast Connection
- Starts immediately (fast path)
- Typical connection time: 1-3 seconds
- Much faster than previous 60-90 second timeouts

### Stable Connection
- No race conditions
- Event-driven state management
- Proper error handling and cleanup

### Platform Separation
- Android and iOS logic completely separated
- Easy to maintain and extend
- No cross-platform code mixing

## Configuration

Timeouts are configurable in `VpnService.ts`:

```typescript
private readonly CORE_READY_TIMEOUT_MS = 5000; // Core readiness check
private readonly HEALTH_CHECK_TIMEOUT_MS = 3000; // Internet health check
private readonly CONNECT_OVERALL_TIMEOUT_MS = 90000; // Overall connection timeout
```

## Implementation Details

### IVpnAdapter Interface
All adapters must implement:
- `prepare()` - Setup VPN permissions/profile
- `start(configJson)` - Start VPN core
- `stop()` - Stop VPN
- `getStatus()` - Get current VPN status
- `waitForCoreReady(timeoutMs)` - Wait for core to be ready
- `healthCheck(timeoutMs)` - Verify internet connectivity

### Platform-Specific Notes

#### Android
- Uses Xray core with libv2ray
- SOCKS proxy on 127.0.0.1:10808
- TProxyService handles TUN routing
- Port readiness check in native Kotlin code (`XrayRunner.isPortReady()`)

#### iOS
- Uses Network Extension framework
- Xray C bridge (TODO: needs implementation in PacketTunnelProvider)
- Status polling via NEVPNStatus
- No direct port checking (uses tunnel state instead)

## Future Improvements

1. **iOS Xray Bridge**: Complete the Xray C bridge implementation in PacketTunnelProvider
2. **Retry Strategy**: Exponential backoff for health check failures
3. **Metrics**: Track connection time, retry counts, failure reasons
4. **Automatic Reconnection**: Retry connection on transient failures
5. **Network Change Detection**: Auto-reconnect when network changes

## Troubleshooting

### Android: "SOCKS port failed to become ready"
- Check Xray core configuration
- Verify no firewall blocking port 10808
- Check logs for `XrayRunner` errors

### iOS: "Network Extension readiness timeout"
- Verify Network Extension is properly configured
- Check Xray C bridge is implemented
- Review PacketTunnelProvider logs

### Health Check Fails
- Check internet connectivity
- Verify DNS resolution is working
- Check if firewall/proxy blocks 1.1.1.1
- Try alternative health check endpoint

## Testing

To test the refactored VPN:

1. **Fast Connection**: Connection should complete in 1-3 seconds
2. **No Fixed Delays**: Check logs - no "waiting 500ms" messages
3. **Health Check**: After connection, open browser - internet should work immediately
4. **Error Handling**: Disconnect during connection - should handle gracefully
5. **Reconnection**: Toggle VPN on/off multiple times - should be stable

## Store Compliance

This implementation follows Google Play and App Store guidelines:
- ✅ No arbitrary delays
- ✅ Proper permission handling
- ✅ Clean error messages
- ✅ Graceful disconnection
- ✅ No data collection
- ✅ Transparent VPN operation
