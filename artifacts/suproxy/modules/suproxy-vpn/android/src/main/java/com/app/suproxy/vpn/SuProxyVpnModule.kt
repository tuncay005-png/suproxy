package com.app.suproxy.vpn

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.os.Handler
import android.os.Looper
import android.util.Log
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SuProxyVpnModule : Module() {
  companion object {
    private const val TAG = "SuProxyVpn"
    private const val VPN_PREPARE_REQUEST = 9100
  }

  private var preparePromise: Promise? = null
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("SuProxyVpn")

    Events("SuProxyVpnStatusChanged")

    OnCreate {
      VpnStatusEmitter.bind(this@SuProxyVpnModule, mainHandler)
    }

    AsyncFunction("prepare") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        Log.e(TAG, "prepare() failed: currentActivity is null")
        promise.reject("ACTIVITY_NOT_AVAILABLE", "VPN activity not available", null)
        return@AsyncFunction
      }

      try {
        val intent = VpnService.prepare(activity)
        if (intent == null) {
          Log.i(TAG, "prepare() - VPN permission already granted")
          promise.resolve(true)
          return@AsyncFunction
        }

        Log.i(TAG, "prepare() - Showing VPN permission dialog")
        preparePromise = promise
        activity.startActivityForResult(intent, VPN_PREPARE_REQUEST)
      } catch (e: Exception) {
        Log.e(TAG, "prepare() exception", e)
        promise.reject("PREPARE_FAILED", e.message, e)
      }
    }

    AsyncFunction("getStatus") {
      SuProxyVpnService.status
    }

    AsyncFunction("start") { configJson: String ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val applicationContext = context.applicationContext
      
      // Save config for Quick Settings Tile
      VpnConfigStore.saveConfig(applicationContext, configJson)
      
      val intent = Intent(applicationContext, SuProxyVpnService::class.java).apply {
        action = SuProxyVpnService.ACTION_START
        putExtra(SuProxyVpnService.EXTRA_CONFIG, configJson)
      }
      // startForegroundService returns ComponentName which Expo cannot serialize
      // We ignore the return value to avoid serialization errors
      try {
        applicationContext.startForegroundService(intent)
        Log.i(TAG, "start() - VPN service started")
      } catch (e: Exception) {
        Log.e(TAG, "start() failed", e)
        throw e
      }
    }

    AsyncFunction("stop") {
      val context = appContext.reactContext
      if (context != null) {
        val applicationContext = context.applicationContext
        val intent = Intent(applicationContext, SuProxyVpnService::class.java).apply {
          action = SuProxyVpnService.ACTION_STOP
        }
        try {
          // startService returns ComponentName which Expo cannot serialize
          // We ignore the return value to avoid serialization errors
          applicationContext.startService(intent)
          Log.i(TAG, "stop() - VPN service stop requested")
        } catch (e: Exception) {
          Log.e(TAG, "stop() failed", e)
          throw e
        }
      }
    }

    AsyncFunction("setActiveKey") { hasKey: Boolean ->
      val context = appContext.reactContext
      if (context != null) {
        val applicationContext = context.applicationContext
        if (hasKey) {
          // User has set an active VLESS key - no need to do anything, config will be saved on start
        } else {
          // User removed active VLESS key - clear the flag
          VpnConfigStore.clearActiveKey(applicationContext)
          Log.i(TAG, "setActiveKey() - Active key cleared")
        }
      }
    }

    OnActivityResult { _, result ->
      if (result.requestCode == VPN_PREPARE_REQUEST) {
        preparePromise?.resolve(result.resultCode == Activity.RESULT_OK)
        preparePromise = null
      }
    }
  }


}

object VpnStatusEmitter {
  private var module: SuProxyVpnModule? = null
  private var handler: Handler? = null

  fun bind(mod: SuProxyVpnModule, mainHandler: Handler) {
    module = mod
    handler = mainHandler
  }

  fun emit(status: String) {
    handler?.post {
      module?.sendEvent("SuProxyVpnStatusChanged", mapOf("status" to status))
      
      // Update Quick Settings Tile
      try {
        module?.appContext?.reactContext?.applicationContext?.let { context ->
          SuProxyVpnTile.requestUpdate(context)
        }
      } catch (e: Exception) {
        Log.e("VpnStatusEmitter", "Failed to update tile", e)
      }
    }
  }
}
