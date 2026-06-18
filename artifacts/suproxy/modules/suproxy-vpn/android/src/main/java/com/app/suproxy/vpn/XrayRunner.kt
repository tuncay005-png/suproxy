package com.app.suproxy.vpn

import android.content.Context
import android.os.ParcelFileDescriptor
import android.util.Log
import hev.socks5.TProxyService
import libv2ray.CoreCallbackHandler
import libv2ray.CoreController
import libv2ray.Libv2ray
import java.io.File

object XrayRunner {
  private const val TAG = "SuProxyVpn"
  private const val SOCKS_PORT = 10808
  private var initialized = false
  private var coreController: CoreController? = null

  private val callback = object : CoreCallbackHandler {
    override fun startup(): Long = 0L

    override fun shutdown(): Long = 0L

    override fun onEmitStatus(code: Long, msg: String?): Long {
      Log.i(TAG, "Xray status [$code]: $msg")
      return 0L
    }
  }

  fun init(context: Context, @Suppress("UNUSED_PARAMETER") protect: (Int) -> Boolean) {
    if (initialized) return
    val assetDir = File(context.filesDir, "xray").apply { mkdirs() }
    Libv2ray.initCoreEnv(assetDir.absolutePath, "")
    coreController = Libv2ray.newCoreController(callback)
    initialized = true
  }

  fun start(configJson: String): String? {
    return try {
      val controller = coreController ?: return "Xray core not initialized"
      if (controller.getIsRunning()) {
        return null
      }
      // tunFd=0: SOCKS inbound + hev-socks5-tunnel handles TUN routing.
      controller.startLoop(configJson, 0)
      null
    } catch (e: Exception) {
      Log.e(TAG, "Xray start failed", e)
      e.message
    }
  }

  fun stop() {
    try {
      coreController?.stopLoop()
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
    builder.addRoute("::", 0)
    builder.addDnsServer("1.1.1.1")
    builder.addDnsServer("8.8.8.8")
    builder.setBlocking(true)

    vpnInterface = builder.establish()
      ?: return "Failed to establish VPN interface"

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
      Log.e("SuProxyVpn", "TUN routing failed", e)
      e.message ?: "TUN routing failed"
    }
  }

  fun waitTunnel(): String? {
    // Block until tunnel service stops (signals quit)
    return try {
      TProxyService.waitRunning()
      null
    } catch (e: Exception) {
      Log.e("SuProxyVpn", "Tunnel wait failed", e)
      e.message
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
