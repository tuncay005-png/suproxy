package com.app.suproxy.vpn

import android.content.Context
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.util.Log
import hev.socks5.TProxyService
import libXray.LibXray
import java.io.File

object XrayRunner {
  private const val TAG = "SuProxyVpn"
  private const val SOCKS_PORT = 10808
  private var initialized = false

  fun init(context: Context, protect: (Int) -> Boolean) {
    if (initialized) return
    val assetDir = File(context.filesDir, "xray").apply { mkdirs() }
    LibXray.initCoreEnv(assetDir.absolutePath, "")
    try {
      LibXray.registerDialerController { fd -> protect(fd.toInt()) }
    } catch (_: Exception) {
      // older libXray builds may omit dialer controller
    }
    initialized = true
  }

  fun start(configJson: String): String? {
    return try {
      val result = LibXray.runXrayFromJson(configJson)
      if (result.isNullOrEmpty()) null else result
    } catch (e: Exception) {
      Log.e(TAG, "Xray start failed", e)
      e.message
    }
  }

  fun stop() {
    try {
      LibXray.stopXray()
    } catch (e: Exception) {
      Log.e(TAG, "Xray stop failed", e)
    }
  }

  fun socksPort(): Int = SOCKS_PORT
}

class SuProxyVpnEngine(
  private val service: SuProxyVpnService,
) {
  private var vpnInterface: ParcelFileDescriptor? = null

  fun start(configJson: String): String? {
    XrayRunner.init(service.applicationContext) { fd -> service.protect(fd) }

    val xrayError = XrayRunner.start(configJson)
    if (xrayError != null) {
      return xrayError
    }

    val builder = service.Builder()
    builder.setSession("SuProxy")
    builder.setMtu(1500)
    builder.addAddress("10.8.0.2", 32)
    builder.addRoute("0.0.0.0", 0)
    builder.addDnsServer("1.1.1.1")
    builder.addDnsServer("8.8.8.8")
    builder.setBlocking(true)

    vpnInterface = builder.establish()
      ?: return "Failed to establish VPN interface"

    val fd = vpnInterface!!.fd
    if (!service.protect(fd)) {
      stop()
      return "Failed to protect VPN socket"
    }

    return null
  }

  fun runTunnel(): String? {
    val fd = vpnInterface?.fd ?: return "VPN interface is not ready"
    return try {
      TProxyService.start(
        service.applicationContext,
        fd,
        XrayRunner.socksPort(),
      )
      null
    } catch (e: Exception) {
      Log.e("SuProxyVpn", "Tun2Socks failed", e)
      e.message ?: "TUN routing failed"
    }
  }

  fun stop() {
    try {
      TProxyService.stop()
    } catch (_: Exception) {
      // optional during teardown
    }
    XrayRunner.stop()
    try {
      vpnInterface?.close()
    } catch (_: Exception) {
    }
    vpnInterface = null
  }
}
