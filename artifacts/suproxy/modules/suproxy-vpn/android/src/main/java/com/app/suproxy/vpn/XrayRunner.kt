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
      Log.i(TAG, "Xray core startLoop() called - core is starting")
      null
    } catch (e: Exception) {
      Log.e(TAG, "Xray start failed", e)
      e.message
    }
  }

  /**
   * Check if SOCKS proxy port is ready and accepting connections.
   * @return true if port is listening, false otherwise
   */
  fun isPortReady(): Boolean {
    return try {
      val controller = coreController ?: return false
      // Check if core is running
      if (!controller.getIsRunning()) {
        return false
      }
      
      // Try to connect to SOCKS port
      val socket = java.net.Socket()
      try {
        socket.connect(java.net.InetSocketAddress("127.0.0.1", SOCKS_PORT), 500)
        socket.close()
        true
      } catch (e: Exception) {
        false
      }
    } catch (e: Exception) {
      Log.e(TAG, "Port readiness check failed", e)
      false
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
    Log.i(TAG, "Xray core started, waiting for SOCKS port to be ready...")

    // FAST PATH + RETRY: Wait for SOCKS port to be ready (NO fixed delay)
    // This prevents "connected but no traffic" problem
    val portReadyStartTime = System.currentTimeMillis()
    val portReadyTimeout = 5000L // 5 seconds max
    var portReady = false
    
    while (System.currentTimeMillis() - portReadyStartTime < portReadyTimeout) {
      if (XrayRunner.isPortReady()) {
        portReady = true
        val elapsed = System.currentTimeMillis() - portReadyStartTime
        Log.i(TAG, "SOCKS port ready in ${elapsed}ms")
        break
      }
      // Short sleep between retries
      Thread.sleep(100)
    }
    
    if (!portReady) {
      Log.e(TAG, "SOCKS port failed to become ready within timeout")
      XrayRunner.stop()
      return "SOCKS proxy port failed to initialize"
    }

    Log.i(TAG, "SOCKS port ready, now establishing VPN interface")

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
