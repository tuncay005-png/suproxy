/**
 * Platform-agnostic VPN adapter interface.
 * Each platform (Android, iOS) implements this to handle platform-specific logic.
 */
export interface IVpnAdapter {
  /**
   * Prepare VPN permissions/configuration.
   * @returns true if ready, false if denied
   */
  prepare(): Promise<boolean>;

  /**
   * Start the VPN connection with given config.
   * This should return immediately without waiting for connection to be ready.
   * @param configJson - Xray/core configuration JSON
   */
  start(configJson: string): Promise<void>;

  /**
   * Stop the VPN connection.
   */
  stop(): Promise<void>;

  /**
   * Get current VPN status from native module.
   */
  getStatus(): Promise<string>;

  /**
   * Wait for the VPN core to be ready (e.g., port listening, tunnel established).
   * This should use event-driven checks with retry, NOT fixed delays.
   * @param timeoutMs - Maximum time to wait
   * @returns true if ready, false if timeout
   */
  waitForCoreReady(timeoutMs: number): Promise<boolean>;

  /**
   * Perform a health check to verify real internet connectivity.
   * @param timeoutMs - Maximum time to wait for health check
   * @returns true if internet is working, false otherwise
   */
  healthCheck(timeoutMs: number): Promise<boolean>;
}
