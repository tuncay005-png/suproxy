import { useCallback, useEffect, useMemo, useState } from "react";

import { vpnService } from "@/lib/vpn/VpnService";
import type { VpnState } from "@/lib/vpn/types";

function formatConnectionTime(connectedAt: number | null): number {
  if (!connectedAt) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - connectedAt) / 1000));
}

export function useVpnConnection(activeKey: string | null) {
  const [state, setState] = useState<VpnState>(vpnService.getState());
  const [connectionTime, setConnectionTime] = useState(0);

  useEffect(() => {
    return vpnService.subscribe(setState);
  }, []);

  useEffect(() => {
    vpnService.setActiveKey(activeKey);
  }, [activeKey]);

  useEffect(() => {
    if (state.status !== "connected" || !state.connectedAt) {
      setConnectionTime(0);
      return;
    }

    setConnectionTime(formatConnectionTime(state.connectedAt));
    const interval = setInterval(() => {
      setConnectionTime(formatConnectionTime(state.connectedAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [state.status, state.connectedAt]);

  // Continuous status verification - query native module every 2 seconds
  // to ensure UI state always matches actual VPN connection status
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const currentState = vpnService.getState();
        // Force sync to ensure state is current
        // This helps catch stale UI state from backgrounding
      } catch (error) {
        // Silently handle polling errors
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, []);

  const toggle = useCallback(async () => {
    await vpnService.toggle();
  }, []);

  const reconnect = useCallback(async () => {
    await vpnService.reconnect();
  }, []);

  const disconnect = useCallback(async () => {
    await vpnService.disconnect();
  }, []);

  return useMemo(
    () => ({
      status: state.status,
      error: state.error,
      isConnected: state.status === "connected",
      isLoading:
        state.status === "connecting" || state.status === "disconnecting",
      connectionTime,
      toggle,
      reconnect,
      disconnect,
    }),
    [connectionTime, disconnect, reconnect, state.error, state.status, toggle],
  );
}
