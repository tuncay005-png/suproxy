package com.app.suproxy.vpn

import android.content.Context
import android.content.SharedPreferences
import android.util.Log

/**
 * Stores the last used VPN configuration for Quick Settings Tile.
 * When user taps the tile, we need to start VPN with the last active config.
 */
object VpnConfigStore {
  private const val TAG = "VpnConfigStore"
  private const val PREFS_NAME = "suproxy_vpn_config"
  private const val KEY_LAST_CONFIG = "last_config_json"
  private const val KEY_HAS_ACTIVE_KEY = "has_active_key"

  private fun getPrefs(context: Context): SharedPreferences {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  }

  /**
   * Save the VPN configuration when user starts VPN.
   */
  fun saveConfig(context: Context, configJson: String) {
    try {
      getPrefs(context).edit()
        .putString(KEY_LAST_CONFIG, configJson)
        .putBoolean(KEY_HAS_ACTIVE_KEY, true)
        .apply()
      Log.i(TAG, "VPN config saved successfully")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to save VPN config", e)
    }
  }

  /**
   * Get the last saved VPN configuration.
   * Returns null if no config was saved or if user has no active key.
   */
  fun getConfig(context: Context): String? {
    try {
      val prefs = getPrefs(context)
      val hasActiveKey = prefs.getBoolean(KEY_HAS_ACTIVE_KEY, false)
      if (!hasActiveKey) {
        return null
      }
      return prefs.getString(KEY_LAST_CONFIG, null)
    } catch (e: Exception) {
      Log.e(TAG, "Failed to get VPN config", e)
      return null
    }
  }

  /**
   * Clear the active key flag (called when user removes VLESS key from app).
   */
  fun clearActiveKey(context: Context) {
    try {
      getPrefs(context).edit()
        .putBoolean(KEY_HAS_ACTIVE_KEY, false)
        .apply()
      Log.i(TAG, "Active key flag cleared")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to clear active key flag", e)
    }
  }

  /**
   * Check if user has an active VPN key configured.
   */
  fun hasActiveKey(context: Context): Boolean {
    return try {
      getPrefs(context).getBoolean(KEY_HAS_ACTIVE_KEY, false)
    } catch (e: Exception) {
      Log.e(TAG, "Failed to check active key", e)
      false
    }
  }
}
