package com.app.suproxy.vpn

import android.app.ActivityManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.util.Log

/**
 * Quick Settings Tile for SuProxy VPN.
 * Allows users to start/stop VPN from Android's Quick Settings panel without opening the app.
 * 
 * Features:
 * - Shows real-time VPN status (Inactive/Connecting/Active)
 * - Synchronized with in-app VPN button
 * - Handles VPN permission requests
 * - Compatible with Android 7.0+ (API 24+)
 */
class SuProxyVpnTile : TileService() {
  companion object {
    private const val TAG = "SuProxyVpnTile"
    
    /**
     * Request all active tiles to update their state.
     * Called when VPN status changes.
     */
    fun requestUpdate(context: Context) {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
          TileService.requestListeningState(
            context,
            ComponentName(context, SuProxyVpnTile::class.java)
          )
        }
      } catch (e: Exception) {
        Log.e(TAG, "Failed to request tile update", e)
      }
    }
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private var statusUpdateRunnable: Runnable? = null

  override fun onStartListening() {
    super.onStartListening()
    Log.i(TAG, "Tile listening started")
    updateTileState()
    startStatusPolling()
  }

  override fun onStopListening() {
    super.onStopListening()
    Log.i(TAG, "Tile listening stopped")
    stopStatusPolling()
  }

  override fun onClick() {
    super.onClick()
    Log.i(TAG, "Tile clicked")
    
    val currentStatus = SuProxyVpnService.status
    Log.i(TAG, "Current VPN status: $currentStatus")
    
    when (currentStatus) {
      "disconnected" -> {
        // Check if VPN permission is granted
        val prepareIntent = VpnService.prepare(applicationContext)
        if (prepareIntent != null) {
          // Permission not granted - show dialog
          Log.i(TAG, "VPN permission not granted, showing dialog")
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // Android 14+ (API 34+): Start activity for permission
            startActivityAndCollapse(prepareIntent)
          } else {
            // Android 13 and below: Start activity
            prepareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivityAndCollapse(prepareIntent)
          }
          return
        }
        
        // Check if user has configured a VPN key
        val configJson = VpnConfigStore.getConfig(applicationContext)
        if (configJson.isNullOrBlank()) {
          Log.w(TAG, "No VPN config found, user needs to configure key in app")
          showUnavailable("Open app to configure VPN key")
          return
        }
        
        // Start VPN
        Log.i(TAG, "Starting VPN from Quick Settings")
        startVpn(configJson)
      }
      
      "connected", "connecting" -> {
        // Stop VPN
        Log.i(TAG, "Stopping VPN from Quick Settings")
        stopVpn()
      }
      
      "error" -> {
        // Error state - try to stop and reset
        Log.i(TAG, "VPN in error state, stopping")
        stopVpn()
      }
    }
    
    // Update tile immediately
    updateTileState()
  }

  /**
   * Start VPN service with the given configuration.
   */
  private fun startVpn(configJson: String) {
    try {
      val intent = Intent(applicationContext, SuProxyVpnService::class.java).apply {
        action = SuProxyVpnService.ACTION_START
        putExtra(SuProxyVpnService.EXTRA_CONFIG, configJson)
      }
      applicationContext.startForegroundService(intent)
      Log.i(TAG, "VPN start command sent")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to start VPN", e)
      showError("Failed to start VPN")
    }
  }

  /**
   * Stop VPN service.
   */
  private fun stopVpn() {
    try {
      val intent = Intent(applicationContext, SuProxyVpnService::class.java).apply {
        action = SuProxyVpnService.ACTION_STOP
      }
      applicationContext.startService(intent)
      Log.i(TAG, "VPN stop command sent")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to stop VPN", e)
      showError("Failed to stop VPN")
    }
  }

  /**
   * Update tile visual state based on current VPN status.
   */
  private fun updateTileState() {
    val tile = qsTile ?: return
    val status = SuProxyVpnService.status
    
    Log.d(TAG, "Updating tile state: status=$status")
    
    when (status) {
      "disconnected" -> {
        tile.state = Tile.STATE_INACTIVE
        tile.label = "SuProxy"
        tile.subtitle = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) "Tap to connect" else null
        tile.icon = Icon.createWithResource(applicationContext, R.drawable.ic_suproxy_tile)
      }
      
      "connecting" -> {
        tile.state = Tile.STATE_ACTIVE
        tile.label = "SuProxy"
        tile.subtitle = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) "Connecting..." else null
        tile.icon = Icon.createWithResource(applicationContext, R.drawable.ic_suproxy_tile)
      }
      
      "connected" -> {
        tile.state = Tile.STATE_ACTIVE
        tile.label = "SuProxy"
        tile.subtitle = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) "Connected" else null
        tile.icon = Icon.createWithResource(applicationContext, R.drawable.ic_suproxy_tile)
      }
      
      "disconnecting" -> {
        tile.state = Tile.STATE_UNAVAILABLE
        tile.label = "SuProxy"
        tile.subtitle = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) "Disconnecting..." else null
        tile.icon = Icon.createWithResource(applicationContext, R.drawable.ic_suproxy_tile)
      }
      
      "error" -> {
        tile.state = Tile.STATE_INACTIVE
        tile.label = "SuProxy"
        tile.subtitle = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) "Error - Tap to retry" else null
        tile.icon = Icon.createWithResource(applicationContext, R.drawable.ic_suproxy_tile)
      }
    }
    
    tile.updateTile()
  }

  /**
   * Show tile as unavailable with a message.
   */
  private fun showUnavailable(message: String) {
    val tile = qsTile ?: return
    tile.state = Tile.STATE_UNAVAILABLE
    tile.label = "SuProxy"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      tile.subtitle = message
    }
    tile.icon = Icon.createWithResource(applicationContext, R.drawable.ic_suproxy_tile)
    tile.updateTile()
  }

  /**
   * Show tile with error message.
   */
  private fun showError(message: String) {
    val tile = qsTile ?: return
    tile.state = Tile.STATE_INACTIVE
    tile.label = "SuProxy"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      tile.subtitle = message
    }
    tile.icon = Icon.createWithResource(applicationContext, R.drawable.ic_suproxy_tile)
    tile.updateTile()
  }

  /**
   * Start polling VPN status for real-time updates.
   * Polls every 2 seconds while tile is visible.
   */
  private fun startStatusPolling() {
    stopStatusPolling() // Clear any existing polling
    
    statusUpdateRunnable = object : Runnable {
      override fun run() {
        updateTileState()
        mainHandler.postDelayed(this, 2000) // Poll every 2 seconds
      }
    }
    mainHandler.post(statusUpdateRunnable!!)
  }

  /**
   * Stop polling VPN status.
   */
  private fun stopStatusPolling() {
    statusUpdateRunnable?.let { runnable ->
      mainHandler.removeCallbacks(runnable)
    }
    statusUpdateRunnable = null
  }
}
