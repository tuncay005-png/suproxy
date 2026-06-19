import { AppState, Platform } from "react-native";

import { parseVlessUrl } from "@/lib/vpn/parseVlessUrl";
import { buildXrayClientConfig } from "@/lib/vpn/buildXrayConfig";
import {
  resolveVpnModule,
  subscribeNativeVpnEvents,
  type NativeVpnModule,
} from "@/lib/vpn/VpnBridge";
import {
  VpnError,
  type VpnState,
  type VpnStatus,
} from "@/lib/vpn/types";

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
  private module: NativeVpnModule | null = null;
  private appStateSubscription: any = null;

  constructor() {
    this.unsubscribeNative = subscribeNativeVpnEvents((status) => {
      if (status === "connected") {
        this.setStatus("connected", null, Date.now());
        return;
      }
      if (status === "error") {
        this.setStatus("error", this.state.error ?? "VPN connection failed");
        return;
      }
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

  private getModule(): NativeVpnModule {
    if (!this.module) {
      this.module = resolveVpnModule();
    }
    return this.module;
  }

  /** Sync UI state with native VPN service status */
  private async syncStatus(): Promise<void> {
    try {
      const nativeStatus = await this.getModule().getStatus();
      if (nativeStatus !== this.state.status) {
        console.log(
          `[VpnService] State sync: local=${this.state.status}, native=${nativeStatus}`,
        );
        // Update to native status if it differs
        if (nativeStatus === "connected") {
          this.setStatus("connected", null, this.state.connectedAt ?? Date.now());
        } else if (nativeStatus === "disconnected") {
          this.setStatus("disconnected", null);
        } else {
          this.setStatus(nativeStatus as VpnStatus);
        }
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
    if (!vlessUrl && this.state.status !== "disconnected") {
      void this.disconnect();
    }
  }

  private getModule(): NativeVpnModule {
    if (!this.module) {
      this.module = resolveVpnModule();
    }
    return this.module;
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

    try {
      this.setStatus("connecting", null);

      const profile = parseVlessUrl(this.activeKey);
      const configJson = buildXrayClientConfig(profile, {
        tunInbound: Platform.OS === "ios",
        socksPort: 10808,
      });

      if (this.getModule().prepare) {
        const ready = await this.getModule().prepare();
        if (!ready) {
          throw new VpnError("VPN permission was denied", "PERMISSION_DENIED");
        }
      }

      await this.getModule().start(configJson);
      await this.waitForStatus(["connected", "error"], 45_000);
      if (this.state.status === "error") {
        throw new VpnError(this.state.error ?? "VPN connection failed", "CONNECT_FAILED");
      }
    } catch (error) {
      const message =
        error instanceof VpnError
          ? error.message
          : error instanceof Error
            ? error.message
            : "VPN connection failed";
      this.setStatus("error", message);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.state.status === "disconnected") {
      return;
    }

    try {
      this.setStatus("disconnecting", null);
      await this.getModule().stop();
      // Wait for the native service to emit "disconnected" (up to 10s)
      // instead of assuming it happened immediately
      await this.waitForStatus(["disconnected", "error"], 10_000);
      if (this.state.status !== "disconnected") {
        this.setStatus("disconnected", null);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "VPN disconnect failed";
      this.setStatus("error", message);
      throw error;
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
