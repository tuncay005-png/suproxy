package hev.socks5

import android.content.Context
import java.io.File

object TProxyService {
  init {
    System.loadLibrary("hev-socks5-tunnel")
  }

  @JvmStatic
  private external fun TProxyStartService(configPath: String, fd: Int)

  @JvmStatic
  private external fun TProxyStopService()

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
  }

  @JvmStatic
  fun stop() {
    TProxyStopService()
  }
}
