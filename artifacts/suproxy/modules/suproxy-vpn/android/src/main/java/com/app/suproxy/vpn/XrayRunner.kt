package com.app.suproxy.vpn

import android.content.Context
import android.os.ParcelFileDescriptor
import android.util.Log
import hev.socks5.TProxyService
import libv2ray.CoreCallbackHandler
import libv2ray.CoreController
import libv2ray.Libv2ray
import java.io.File

private const val TAG = "SuProxyVpn"

object XrayRunner {
  private const val SOCKS_PORT = 10808
  private var initialized = false
  private var coreController: CoreController? = null

  // Stored so the CoreCallbackHandler.protect() can call VpnService.protect()
  // to bypass the TUN for Xray's outbound sockets (prevents routing loop)
  private var protectFd: ((Int) -> Boolean)? = null

  private val callback = object : CoreCallbackHandler {
    override fun startup(): Long = 0L

    override fun shutdown(): Long = 0L

    override fun onEmitStatus(code: Long, msg: String?): Long {
      Log.i(TAG, "Xray status [$code]: $msg")
      return 0L
    }

    // libv2ray calls this to protect outbound sockets from being routed into TUN
    fun protect(fd: Long): Boolean {
      return protectFd?.invoke(fd.toInt()) ?: false
    }
  }

  fun init(context: Context, protect: (Int) -> Boolean) {
    protectFd = protect
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
        Log.i(TAG, "Xray already running")
        return null
      }
      Log.i(TAG, "Xray starting with config (length=${configJson.length})")
      // tunFd=0: SOCKS inbound + hev-socks5-tunnel handles TUN routing.
      controller.startLoop(configJson, 0)
      Log.i(TAG, "Xray started successfully")
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
    Log.i(TAG, "SuProxyVpnEngine.start(): initializing Xray")
    XrayRunner.init(service.applicationContext) { fd -> service.protect(fd) }

    val xrayError = XrayRunner.start(configJson)
    if (xrayError != null) {
      Log.e(TAG, "Xray startup error: $xrayError")
      return xrayError
    }
    Log.i(TAG, "Xray started, now establishing VPN interface")

    val builder = service.Builder()
    builder.setSession("SuProxy")
    builder.setMtu(1500)
    builder.addAddress("10.8.0.2", 32)
    builder.addRoute("0.0.0.0", 0)
    builder.addRoute("::", 0)
    builder.addDnsServer("1.1.1.1")
    builder.addDnsServer("8.8.8.8")
    builder.setBlocking(true)
    // Exclude this app from the TUN so Xray's outbound traffic (to the VPN
    // server) is not re-routed back into the tunnel — prevents routing loop
    builder.addDisallowedApplication(service.packageName)

    vpnInterface = builder.establish()
      ?: return "Failed to establish VPN interface"
    Log.i(TAG, "VPN interface established, fd=${vpnInterface?.fd}")

    return null
  }

  fun runTunnel(): String? {
    val fd = vpnInterface?.fd ?: return "VPN interface is not ready"
    Log.i(TAG, "Starting TUN tunnel routing (fd=$fd, socksPort=${XrayRunner.socksPort()})")
    return try {
      TProxyService.start(
        service.applicationContext,
        fd,
        XrayRunner.socksPort(),
      )
      Log.i(TAG, "TProxyService.start() returned successfully")
      null
    } catch (e: Exception) {
      Log.e(TAG, "TUN routing failed", e)
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
