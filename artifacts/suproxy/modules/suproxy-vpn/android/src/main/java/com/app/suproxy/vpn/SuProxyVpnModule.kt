package com.app.suproxy.vpn

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SuProxyVpnModule : Module() {
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
        promise.resolve(false)
        return@AsyncFunction
      }

      val intent = VpnService.prepare(activity)
      if (intent == null) {
        promise.resolve(true)
        return@AsyncFunction
      }

      preparePromise = promise
      activity.startActivityForResult(intent, VPN_PREPARE_REQUEST)
    }

    AsyncFunction("getStatus") {
      SuProxyVpnService.status
    }

    AsyncFunction("start") { configJson: String ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val intent = Intent(context, SuProxyVpnService::class.java).apply {
        action = SuProxyVpnService.ACTION_START
        putExtra(SuProxyVpnService.EXTRA_CONFIG, configJson)
      }
      context.startForegroundService(intent)
    }

    AsyncFunction("stop") {
      val context = appContext.reactContext
      if (context != null) {
        val intent = Intent(context, SuProxyVpnService::class.java).apply {
          action = SuProxyVpnService.ACTION_STOP
        }
        context.startService(intent)
      }
    }

    OnActivityResult { _, result ->
      if (result.requestCode == VPN_PREPARE_REQUEST) {
        preparePromise?.resolve(result.resultCode == Activity.RESULT_OK)
        preparePromise = null
      }
    }
  }

  companion object {
    private const val VPN_PREPARE_REQUEST = 9100
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
    }
  }
}
