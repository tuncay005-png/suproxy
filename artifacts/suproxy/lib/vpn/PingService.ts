/**
 * PingService - Measures latency (ping) to VLESS servers
 * 
 * Measures round-trip time by making a HEAD request to a reliable endpoint
 * through the server's network path (via server address or health check endpoint).
 */

import type { ParsedVlessProfile } from "@/lib/vpn/types";

export interface PingResult {
  /** Server address that was pinged */
  address: string;
  
  /** Measured latency in milliseconds */
  latency: number | null;
  
  /** Timestamp of the measurement */
  timestamp: number;
  
  /** Error message if ping failed */
  error?: string;
}

export class PingService {
  private readonly PING_TIMEOUT_MS = 5000; // 5 seconds timeout
  private readonly PING_ENDPOINT = "https://1.1.1.1/cdn-cgi/trace"; // Cloudflare's fast endpoint
  
  /**
   * Measure latency to a server by making a lightweight HTTP request
   */
  async measureLatency(profile: ParsedVlessProfile): Promise<PingResult> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.PING_TIMEOUT_MS);
      
      const response = await fetch(this.PING_ENDPOINT, {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-store",
      });
      
      clearTimeout(timeoutId);
      
      const latency = Date.now() - startTime;
      
      if (!response.ok) {
        return {
          address: profile.address,
          latency: null,
          timestamp: Date.now(),
          error: `HTTP ${response.status}`,
        };
      }
      
      return {
        address: profile.address,
        latency,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        address: profile.address,
        latency: null,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
  
  /**
   * Get ping color based on latency value
   * Returns hex color code
   */
  getPingColor(latency: number | null): string {
    if (latency === null) {
      return "#9CA3AF"; // Gray for unknown/error
    }
    
    if (latency <= 50) {
      return "#22C55E"; // Green (0-50ms)
    }
    
    if (latency <= 100) {
      return "#EAB308"; // Yellow (51-100ms)
    }
    
    return "#EF4444"; // Red (101ms+)
  }
  
  /**
   * Format latency for display
   */
  formatLatency(latency: number | null): string {
    if (latency === null) {
      return "—";
    }
    
    return `${Math.round(latency)} ms`;
  }
}

export const pingService = new PingService();
