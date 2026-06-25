import { Platform } from "react-native";
import type { IVpnAdapter } from "./IVpnAdapter";
import { resolveVpnModule } from "../VpnBridge";

/**
 * iOS-specific VPN adapter (Network Extension + sing-box/Xray based).
 * Fast path: Start Network Extension, wait for tunnel ready state.
 */
export class IosVpnAdapter implements IVpnAdapter {
  private readonly RETRY_INTERVAL_MS = 150;
  private readonly HEALTH_CHECK_ENDPOINT = "https://1.1.1.1/cdn-cgi/trace";

  async prepare(): Promise<boolean> {
    if (Platform.OS !== "ios") {
      throw new Error("IosVpnAdapter only works on iOS");
    }
    const module = resolveVpnModule();
    if (module.prepare) {
      return await module.prepare();
    }
    return true;
  }

  async start(configJson: string): Promise<void> {
    const module = resolveVpnModule();
    // Start Network Extension immediately (fast path - no waiting)
    await module.start(configJson);
    console.log("[IosVpnAdapter] Network Extension start command sent (fast path)");
  }

  async stop(): Promise<void> {
    const module = resolveVpnModule();
    await module.stop();
  }

  async getStatus(): Promise<string> {
    const module = resolveVpnModule();
    return await module.getStatus();
  }

  /**
   * Wait for Network Extension tunnel to be ready.
   * Uses status polling with retry instead of fixed delay.
   * Checks for NEVPNStatus.connected state from Network Extension.
   */
  async waitForCoreReady(timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      // Check if tunnel is in connected state
      const status = await this.getStatus();
      
      if (status === "connected") {
        const elapsed = Date.now() - startTime;
        console.log(`[IosVpnAdapter] Network Extension tunnel ready in ${elapsed}ms`);
        return true;
      }
      
      // Check for error state
      if (status === "error") {
        console.warn("[IosVpnAdapter] Network Extension encountered error");
        return false;
      }
      
      // Still connecting, wait before retry
      await this.sleep(this.RETRY_INTERVAL_MS);
    }
    
    console.warn("[IosVpnAdapter] Network Extension readiness timeout");
    return false;
  }

  /**
   * Health check: Verify real internet connectivity through the VPN.
   * Makes a simple HTTP request to a reliable endpoint.
   */
  async healthCheck(timeoutMs: number): Promise<boolean> {
    try {
      // Use a lightweight, reliable endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(this.HEALTH_CHECK_ENDPOINT, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log("[IosVpnAdapter] Health check passed");
        return true;
      }
      
      console.warn("[IosVpnAdapter] Health check failed: status", response.status);
      return false;
    } catch (error) {
      console.warn("[IosVpnAdapter] Health check error:", error);
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
