import { AppState, Platform } from "react-native";

import { parseVlessUrl } from "@/lib/vpn/parseVlessUrl";
import { buildXrayClientConfig } from "@/lib/vpn/buildXrayConfig";
import {
  resolveVpnModule,
  subscribeNativeVpnEvents,
} from "@/lib/vpn/VpnBridge";
import {
  VpnError,
  type VpnState,
  type VpnStatus,
} from "@/lib/vpn/types";
import type { IVpnAdapter } from "@/lib/vpn/adapters/IVpnAdapter";
import { AndroidVpnAdapter } from "@/lib/vpn/adapters/AndroidVpnAdapter";
import { IosVpnAdapter } from "@/lib/vpn/adapters/IosVpnAdapter";

type Listener = (state: VpnState) => void;

const initialState: VpnState = {
  status: "disconnected",
  error: null,
  connectedAt: null,
};

class VpnServiceImpl {
  private state: VpnState = initialState;
  private listeners = new Set<Listener>();
  private activeKey: string | null = null;
  private unsubscribeNative: (() => void) | null = null;
  private adapter: IVpnAdapter;
  private appStateSubscription: any = null;
  private isDisconnecting: boolean = false;  // Track if we explicitly requested disconnect
  
  // Configuration: timeouts and intervals
  private readonly CORE_READY_TIMEOUT_MS = 5000; // 5 seconds max for core readiness
  private readonly HEALTH_CHECK_TIMEOUT_MS = 3000; // 3 seconds for health check
  private readonly CONNECT_OVERALL_TIMEOUT_MS = 90000; // 90 seconds overall connection timeout

  constructor() {
    // Initialize platform-specific adapter
    this.adapter = Platform.OS === "ios" 
      ? new IosVpnAdapter() 
      : new AndroidVpnAdapter();
    
    this.unsubscribeNative = subscribeNativeVpnEvents((status) => {
      // Filter unsafe state transitions to prevent false disconnects
      // Only accept state changes if they represent real events:
      // 1. If connecting -> accept error or connected
      // 2. If connected -> ONLY accept explicit disconnect/error
      // 3. Ignore spurious/timeout-triggered events

      const currentStatus = this.state.status;

      // Safe transitions from "connecting" state
      if (currentStatus === "connecting") {
        if (status === "connected") {
          this.setStatus("connected", null, Date.now());
          return;
        }
        if (status === "error") {
          this.setStatus("error", this.state.error ?? "VPN connection failed");
          return;
        }
        // Ignore other states while connecting
        return;
      }

      // Safe transitions from "connected" state
      // ONLY accept explicit disconnect/error, never spurious reconnections
      if (currentStatus === "connected") {
        if (status === "error") {
          // Only accept error if it's a real failure, not a timeout
          this.setStatus("error", this.state.error ?? "VPN connection failed");
          return;
        }
        if (status === "disconnected" || status === "disconnecting") {
          // Only accept if we explicitly requested disconnect
          if (this.isDisconnecting) {
            this.isDisconnecting = false;
            this.setStatus("disconnected", null);
            return;
          }
          // Ignore accidental disconnect events (e.g., timeout-triggered)
          console.log(
            "[VpnService] Ignoring spurious disconnect while connected - VPN stays active",
          );
          return;
        }
        // Ignore all other events while connected - stay connected
        return;
      }

      // For all other states, accept the status change
      this.setStatus(status);
    });

    // Sync state when app comes to foreground to handle background disconnections
    // or state changes while app was backgrounded
    this.appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void this.syncStatus();
      }
    });
  }

  getState(): VpnState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setActiveKey(vlessUrl: string | null): void {
    this.activeKey = vlessUrl;
    if (!vlessUrl && this.state.status !== "disconnected") {
      void this.disconnect();
    }
  }

  /** Sync UI state with native VPN service status */
  async syncStatus(): Promise<void> {
    try {
      const nativeStatus = await this.adapter.getStatus();
      if (nativeStatus !== this.state.status) {
        console.log(
          `[VpnService] State sync: local=${this.state.status}, native=${nativeStatus}`,
        );
        // Update to native status if it differs
        if (nativeStatus === "connected") {
          // Get connection start time from native if available
          let connectedAt = this.state.connectedAt ?? Date.now();
          try {
            const module = resolveVpnModule();
            if (module.getConnectedAtMs) {
              const nativeConnectedAt = await module.getConnectedAtMs();
              if (nativeConnectedAt > 0) {
                connectedAt = nativeConnectedAt;
                console.log(`[VpnService] Restored connectedAt from native: ${connectedAt}`);
              }
            }
          } catch (error) {
            // Ignore if getConnectedAtMs not available
          }
          this.setStatus("connected", null, connectedAt);
        } else if (nativeStatus === "disconnected") {
          this.setStatus("disconnected", null);
        } else {
          this.setStatus(nativeStatus as VpnStatus);
        }
      } else if (nativeStatus === "connected" && !this.state.connectedAt) {
        // If already connected but we don't have a timestamp, get it from native
        // This handles the case where VPN was started from Quick Settings Tile
        console.log("[VpnService] Restoring connectedAt timestamp for existing connection");
        let connectedAt = Date.now();
        try {
          const module = resolveVpnModule();
          if (module.getConnectedAtMs) {
            const nativeConnectedAt = await module.getConnectedAtMs();
            if (nativeConnectedAt > 0) {
              connectedAt = nativeConnectedAt;
              console.log(`[VpnService] Restored connectedAt from native: ${connectedAt}`);
            }
          }
        } catch (error) {
          // Ignore if getConnectedAtMs not available
        }
        this.setStatus("connected", null, connectedAt);
      }
    } catch (error) {
      // Silently ignore errors during status sync
      // Native service may not be available
    }
  }

  destroy(): void {
    // Clean up AppState listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    // Clean up native event listener
    if (this.unsubscribeNative) {
      this.unsubscribeNative();
      this.unsubscribeNative = null;
    }
  }

  getState(): VpnState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setActiveKey(vlessUrl: string | null): void {
    this.activeKey = vlessUrl;
    
    // Notify Android native module about active key status (for Quick Settings Tile)
    if (Platform.OS === "android") {
      try {
        const module = resolveVpnModule();
        if (module?.setActiveKey) {
          module.setActiveKey(vlessUrl !== null).catch((error: Error) => {
            console.warn("[VpnService] Failed to update active key status:", error);
          });
        }
      } catch (error) {
        console.warn("[VpnService] Failed to notify native about active key:", error);
      }
    }
    
    if (!vlessUrl && this.state.status !== "disconnected") {
      void this.disconnect();
    }
  }

  async toggle(): Promise<void> {
    if (
      this.state.status === "connecting" ||
      this.state.status === "disconnecting"
    ) {
      return;
    }

    if (this.state.status === "connected") {
      await this.disconnect();
      return;
    }

    await this.connect();
  }

  /**
   * Connect to VPN with fast path + retry + health check.
   * 1. Start VPN immediately (FAST PATH - no waiting)
   * 2. UI goes to "connecting" state immediately
   * 3. Wait for core to be ready (port/tunnel ready) with retry
   * 4. Perform health check to verify real internet connectivity
   * 5. Only then mark as "connected"
   */
  async connect(): Promise<void> {
    if (!this.activeKey) {
      throw new VpnError("No VLESS key configured", "NO_KEY");
    }

    if (
      this.state.status === "connected" ||
      this.state.status === "connecting"
    ) {
      return;
    }

    const startTime = Date.now();

    try {
      // Set connecting state immediately (UI feedback)
      this.setStatus("connecting", null);
      console.log("[VpnService] Starting VPN connection (fast path)");

      // Parse profile and build config
      const profile = parseVlessUrl(this.activeKey);
      const configJson = buildXrayClientConfig(profile, {
        tunInbound: Platform.OS === "ios",
        socksPort: 10808,
      });

      // Prepare VPN permissions
      const permissionGranted = await this.adapter.prepare();
      if (!permissionGranted) {
        throw new VpnError("VPN permission was denied", "PERMISSION_DENIED");
      }

      // FAST PATH: Start VPN immediately without waiting
      await this.adapter.start(configJson);
      console.log("[VpnService] VPN start command sent (fast path)");

      // Wait for core to be ready (port listening / tunnel established)
      // Uses retry mechanism with short intervals (NO fixed delays)
      console.log("[VpnService] Waiting for VPN core to be ready...");
      const coreReady = await this.adapter.waitForCoreReady(this.CORE_READY_TIMEOUT_MS);
      
      if (!coreReady) {
        throw new VpnError(
          "VPN core failed to initialize within timeout",
          "CORE_NOT_READY"
        );
      }

      const coreReadyTime = Date.now() - startTime;
      console.log(`[VpnService] VPN core ready in ${coreReadyTime}ms`);

      // Perform health check to verify real internet connectivity
      // This prevents "connected but no internet" problem
      console.log("[VpnService] Performing health check...");
      const healthOk = await this.adapter.healthCheck(this.HEALTH_CHECK_TIMEOUT_MS);
      
      if (!healthOk) {
        throw new VpnError(
          "VPN connected but internet is not working",
          "HEALTH_CHECK_FAILED"
        );
      }

      const totalTime = Date.now() - startTime;
      console.log(`[VpnService] VPN connected successfully in ${totalTime}ms (core: ${coreReadyTime}ms)`);

      // Mark as connected only after health check passes
      this.setStatus("connected", null, Date.now());
    } catch (error) {
      const message =
        error instanceof VpnError
          ? error.message
          : error instanceof Error
            ? error.message
            : "VPN connection failed";
      
      console.error("[VpnService] Connection failed:", message);
      this.setStatus("error", message);
      
      // Clean up: try to stop the VPN
      try {
        await this.adapter.stop();
      } catch (stopError) {
        // Ignore cleanup errors
      }
      
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.state.status === "disconnected") {
      return;
    }

    try {
      this.setStatus("disconnecting", null);
      this.isDisconnecting = true; // Mark that we're explicitly disconnecting
      console.log("[VpnService] Disconnecting VPN...");
      
      await this.adapter.stop();
      
      // Wait for the native service to emit "disconnected" (up to 10s)
      // instead of assuming it happened immediately
      await this.waitForStatus(["disconnected", "error"], 10_000);
      if (this.state.status !== "disconnected") {
        this.setStatus("disconnected", null);
      }
      
      console.log("[VpnService] VPN disconnected successfully");
    } catch (error) {
      this.isDisconnecting = false; // Reset flag on error
      const message =
        error instanceof Error ? error.message : "VPN disconnect failed";
      console.error("[VpnService] Disconnect failed:", message);
      this.setStatus("error", message);
      throw error;
    } finally {
      this.isDisconnecting = false; // Always reset flag
    }
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  private setStatus(
    status: VpnStatus,
    error: string | null = this.state.error,
    connectedAt: number | null = status === "connected"
      ? (this.state.connectedAt ?? Date.now())
      : null,
  ): void {
    this.state = {
      status,
      error,
      connectedAt: status === "connected" ? connectedAt : null,
    };
    this.emit();
  }

  private waitForStatus(
    targets: VpnStatus[],
    timeoutMs: number,
  ): Promise<void> {
    if (targets.includes(this.state.status)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        if (this.state.status === "connecting") {
          this.setStatus("error", "VPN connection timed out");
        }
        resolve();
      }, timeoutMs);

      const unsubscribe = this.subscribe((state) => {
        if (targets.includes(state.status)) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export const vpnService = new VpnServiceImpl();
