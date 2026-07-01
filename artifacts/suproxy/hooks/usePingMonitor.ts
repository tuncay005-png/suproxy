/**
 * usePingMonitor - React hook for monitoring server latency
 * 
 * Periodically measures ping to servers and provides real-time latency data
 */

import { useState, useEffect, useCallback } from "react";
import { pingService, type PingResult } from "@/lib/vpn/PingService";
import type { SubscriptionNode } from "@/lib/vpn/parseSubscription";

const PING_INTERVAL_MS = 25000; // 25 seconds between measurements
const INITIAL_PING_DELAY_MS = 2000; // Wait 2 seconds before first ping

export interface PingState {
  /** Map of server address to ping result */
  results: Map<string, PingResult>;
  
  /** Whether initial ping is in progress */
  isInitialPing: boolean;
  
  /** Manually trigger a ping measurement */
  measureNow: () => Promise<void>;
}

/**
 * Hook to monitor ping for a list of servers
 */
export function usePingMonitor(nodes: SubscriptionNode[]): PingState {
  const [results, setResults] = useState<Map<string, PingResult>>(new Map());
  const [isInitialPing, setIsInitialPing] = useState(true);
  
  const measurePings = useCallback(async () => {
    if (nodes.length === 0) {
      return;
    }
    
    // Measure ping for all nodes
    const pingPromises = nodes.map(node => 
      pingService.measureLatency(node.profile)
    );
    
    const pingResults = await Promise.all(pingPromises);
    
    // Update results map
    const newResults = new Map<string, PingResult>();
    pingResults.forEach(result => {
      newResults.set(result.address, result);
    });
    
    setResults(newResults);
    setIsInitialPing(false);
  }, [nodes]);
  
  // Initial ping after delay
  useEffect(() => {
    if (nodes.length === 0) {
      return;
    }
    
    const initialTimer = setTimeout(() => {
      void measurePings();
    }, INITIAL_PING_DELAY_MS);
    
    return () => clearTimeout(initialTimer);
  }, [nodes, measurePings]);
  
  // Periodic ping updates
  useEffect(() => {
    if (nodes.length === 0 || isInitialPing) {
      return;
    }
    
    const intervalId = setInterval(() => {
      void measurePings();
    }, PING_INTERVAL_MS);
    
    return () => clearInterval(intervalId);
  }, [nodes, isInitialPing, measurePings]);
  
  return {
    results,
    isInitialPing,
    measureNow: measurePings,
  };
}

/**
 * Get latency for a specific server address
 */
export function getServerLatency(
  results: Map<string, PingResult>,
  address: string,
): number | null {
  const result = results.get(address);
  return result?.latency ?? null;
}
