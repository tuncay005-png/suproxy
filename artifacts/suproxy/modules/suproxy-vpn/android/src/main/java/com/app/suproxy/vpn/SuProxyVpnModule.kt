package com.app.suproxy.vpn

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CompletableDeferred

class SuProxyVpnModule : Module() {
  private var prepareDeferred: CompletableDeferred<Boolean>? = null

  override fun definition() = ModuleDefinition {
    Name("SuProxyVpn")

    Events("SuProxyVpnStatusChanged")

    OnCreate {
      VpnStatusEmitter.bind(this@SuProxyVpnModule)
    }

    AsyncFunction("prepare") {
      val activity = appContext.currentActivity ?: return@AsyncFunction false

      val intent = VpnService.prepare(activity)
      if (intent == null) {
        return@AsyncFunction true
      }

      val deferred = CompletableDeferred<Boolean>()
      prepareDeferred = deferred
      activity.startActivityForResult(intent, VPN_PREPARE_REQUEST)
      deferred.await()
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
      val context = appContext.reactContext ?: return@AsyncFunction
      val intent = Intent(context, SuProxyVpnService::class.java).apply {
        action = SuProxyVpnService.ACTION_STOP
      }
      context.startService(intent)
    }

    OnActivityResult { _, result ->
      if (result.requestCode == VPN_PREPARE_REQUEST) {
        prepareDeferred?.complete(result.resultCode == Activity.RESULT_OK)
        prepareDeferred = null
      }
    }
  }

  companion object {
    private const val VPN_PREPARE_REQUEST = 9100
  }
}

object VpnStatusEmitter {
  private var module: SuProxyVpnModule? = null

  fun bind(mod: SuProxyVpnModule) {
    module = mod
  }

  fun emit(status: String) {
    module?.sendEvent("SuProxyVpnStatusChanged", mapOf("status" to status))
  }
}
