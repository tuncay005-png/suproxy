package hev.socks5

import android.content.Context
import android.util.Log
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

object TProxyService {
  init {
    System.loadLibrary("hev-socks5-tunnel")
  }

  @JvmStatic
  private external fun TProxyStartService(configPath: String, fd: Int)

  @JvmStatic
  private external fun TProxyStopService()  // Keep for JNI compatibility

  @JvmStatic
  private external fun TProxyGetStats(): LongArray

  @JvmStatic
  private external fun TProxyIsRunning(): Boolean

  private var tunnelStarted = AtomicBoolean(false)

  @JvmStatic
  fun start(context: Context, tunFd: Int, socksPort: Int, socksHost: String = "127.0.0.1") {
    val config = buildString {
      appendLine("misc:")
      appendLine(" task-stack-size: 81920")
      appendLine("tunnel:")
      appendLine(" mtu: 1500")
      appendLine("socks5:")
      appendLine(" port: $socksPort")
      appendLine(" address: '$socksHost'")
      appendLine(" udp: 'udp'")
    }

    val file = File(context.cacheDir, "suproxy-tproxy.yml")
    file.writeText(config)
    
    TProxyStartService(file.absolutePath, tunFd)
    tunnelStarted.set(true)
  }

  @JvmStatic
  fun stop() {
    // Non-blocking: send quit signal without waiting
    // Called on background thread to avoid main thread blocking
    try {
      TProxyStopService()  // This calls the non-blocking version in hev-jni.c
    } catch (e: Exception) {
      Log.e("TProxyService", "Stop signal failed", e)
    }
    tunnelStarted.set(false)
  }

  @JvmStatic
  fun waitRunning() {
    // Block until tunnel service finishes
    // This should be called on a background thread
    val maxWaitMs = 60_000L  // 60 second timeout
    val startTime = System.currentTimeMillis()
    
    while (tunnelStarted.get() && TProxyIsRunning()) {
      if (System.currentTimeMillis() - startTime > maxWaitMs) {
        Log.w("TProxyService", "Tunnel wait timeout")
        break
      }
      Thread.sleep(100)  // Poll every 100ms
    }
  }

  @JvmStatic
  fun stats(): LongArray = TProxyGetStats()
}
