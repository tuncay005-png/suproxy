package hev.socks5

import android.content.Context
import android.util.Log
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

object TProxyService {
  init {
    System.loadLibrary("hev-socks5-tunnel")
  }

  @JvmStatic
  private external fun TProxyStartService(configPath: String, fd: Int)

  @JvmStatic
  private external fun TProxyStopService()

  @JvmStatic
  private external fun TProxyGetStats(): LongArray

  // Latch: counts down to 0 when stop() is called, unblocking waitRunning()
  @Volatile
  private var stopLatch: CountDownLatch? = null

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

    // Create a fresh latch before starting so waitRunning() blocks correctly
    stopLatch = CountDownLatch(1)
    TProxyStartService(file.absolutePath, tunFd)
  }

  @JvmStatic
  fun stop() {
    try {
      TProxyStopService()
    } catch (e: Exception) {
      Log.e("TProxyService", "Stop signal failed", e)
    }
    // Signal waitRunning() to unblock
    stopLatch?.countDown()
  }

  @JvmStatic
  fun waitRunning() {
    // Block indefinitely until stop() is called (latch reaches 0)
    // Never timeout - this was causing premature disconnects at 60 seconds
    try {
      stopLatch?.await()
    } catch (e: InterruptedException) {
      Log.e("TProxyService", "waitRunning interrupted", e)
    }
  }

  @JvmStatic
  fun stats(): LongArray = TProxyGetStats()
}
