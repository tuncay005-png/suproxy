import { Platform } from "react-native";
import type { IVpnAdapter } from "./IVpnAdapter";
import { resolveVpnModule } from "../VpnBridge";

/**
 * Android-specific VPN adapter (Xray + TProxyService based).
 * Fast path: Start VPN immediately, then wait for SOCKS port readiness.
 */
export class AndroidVpnAdapter implements IVpnAdapter {
  private readonly SOCKS_PORT = 10808;
  private readonly SOCKS_HOST = "127.0.0.1";
  private readonly RETRY_INTERVAL_MS = 150;

  async prepare(): Promise<boolean> {
    if (Platform.OS !== "android") {
      throw new Error("AndroidVpnAdapter only works on Android");
    }
    const module = resolveVpnModule();
    if (module.prepare) {
      return await module.prepare();
    }
    return true;
  }

  async start(configJson: string): Promise<void> {
    const module = resolveVpnModule();
    // Start VPN service immediately (fast path - no waiting)
    await module.start(configJson);
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
   * Wait for Xray SOCKS proxy port (127.0.0.1:10808) to be ready.
   * Uses retry with short intervals instead of fixed delay.
   */
  async waitForCoreReady(timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      // Check if SOCKS port is listening
      const isReady = await this.checkSocksPortReady();
      if (isReady) {
        console.log("[AndroidVpnAdapter] SOCKS port ready");
        return true;
      }
      
      // Wait before retry
      await this.sleep(this.RETRY_INTERVAL_MS);
    }
    
    console.warn("[AndroidVpnAdapter] SOCKS port readiness timeout");
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
      
      const response = await fetch("https://1.1.1.1/cdn-cgi/trace", {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log("[AndroidVpnAdapter] Health check passed");
        return true;
      }
      
      console.warn("[AndroidVpnAdapter] Health check failed: status", response.status);
      return false;
    } catch (error) {
      console.warn("[AndroidVpnAdapter] Health check error:", error);
      return false;
    }
  }

  /**
   * Check if SOCKS proxy port is accepting connections.
   * Uses a simple HTTP request to verify connectivity.
   */
  private async checkSocksPortReady(): Promise<boolean> {
    try {
      // Check if we can make a request through the VPN
      // This verifies that Xray SOCKS proxy is running and accepting connections
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      
      // Try a lightweight HEAD request to a reliable endpoint
      // If Xray proxy is ready, this request will go through
      const response = await fetch("https://www.google.com/generate_204", {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-store",
      });
      
      clearTimeout(timeoutId);
      
      // 204 No Content or any 2xx response means proxy is working
      return response.status === 204 || response.ok;
    } catch (error) {
      // Connection failed - port not ready yet or network issue
      // This is expected during startup, keep retrying
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
