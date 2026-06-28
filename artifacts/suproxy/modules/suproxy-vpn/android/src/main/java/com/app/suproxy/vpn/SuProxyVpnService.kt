package com.app.suproxy.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat

class SuProxyVpnService : VpnService() {
  companion object {
    const val ACTION_START = "com.app.suproxy.vpn.START"
    const val ACTION_STOP = "com.app.suproxy.vpn.STOP"
    const val EXTRA_CONFIG = "config_json"
    const val NOTIFICATION_ID = 9001
    const val CHANNEL_ID = "suproxy_vpn"

    @Volatile
    var instance: SuProxyVpnService? = null

    @Volatile
    var status: String = "disconnected"
    
    @Volatile
    var connectedAtMs: Long = 0  // Connection start timestamp for timer sync
  }

  private var engine: SuProxyVpnEngine? = null
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun onCreate() {
    super.onCreate()
    instance = this
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        // Async stop: non-blocking
        stopTunnelAsync()
        return START_NOT_STICKY
      }

      ACTION_START -> {
        val config = intent.getStringExtra(EXTRA_CONFIG)
        if (config.isNullOrBlank()) {
          mainHandler.post { VpnStatusEmitter.emit("error") }
          stopSelf()
          return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, buildNotification("Connecting…"))
        mainHandler.post { VpnStatusEmitter.emit("connecting") }

        Thread {
          try {
            Log.i("SuProxyVpn", "VPN start thread: creating engine")
            engine = SuProxyVpnEngine(this)
            
            Log.i("SuProxyVpn", "VPN start: establishing interface and starting Xray")
            val error = engine?.start(config)
            if (error != null) {
              Log.e("SuProxyVpn", "Engine.start() failed: $error")
              mainHandler.post { VpnStatusEmitter.emit("error") }
              stopTunnelAsync()
              stopForeground(STOP_FOREGROUND_REMOVE)
              stopSelf()
              return@Thread
            }
            Log.i("SuProxyVpn", "Engine.start() successful, now starting tunnel routing")

            // VPN interface + Xray core started successfully
            // Now start tunnel (blocking call on this thread)
            val tunError = engine?.runTunnel()
            if (tunError != null) {
              Log.e("SuProxyVpn", "TProxyService.start() failed: $tunError")
              mainHandler.post { VpnStatusEmitter.emit("error") }
              stopTunnelAsync()
              stopForeground(STOP_FOREGROUND_REMOVE)
              stopSelf()
              return@Thread
            }
            Log.i("SuProxyVpn", "Tunnel routing started, now waiting for stop signal")

            // Tunnel started successfully
            status = "connected"
            connectedAtMs = System.currentTimeMillis()  // Save connection start time for timer
            mainHandler.post {
              VpnStatusEmitter.emit("connected")
              val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
              manager.notify(NOTIFICATION_ID, buildNotification("Connected"))
            }
            Log.i("SuProxyVpn", "VPN connected at $connectedAtMs, waiting for tunnel to end")

            // Blocks until TProxyStopService() is called (ACTION_STOP or onDestroy)
            engine?.waitTunnel()
            Log.i("SuProxyVpn", "Tunnel stopped, cleaning up")

            // Clean shutdown
            status = "disconnected"
            connectedAtMs = 0  // Reset connection time
            mainHandler.post { VpnStatusEmitter.emit("disconnected") }
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
          } catch (e: Exception) {
            Log.e("SuProxyVpn", "VPN start failed with exception", e)
            mainHandler.post { VpnStatusEmitter.emit("error") }
            stopTunnelAsync()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
          }
        }.start()

        return START_STICKY
      }
    }

    return START_NOT_STICKY
  }

  override fun onDestroy() {
    status = "disconnected"
    connectedAtMs = 0  // Reset connection time
    instance = null
    stopTunnelAsync()
    mainHandler.post { VpnStatusEmitter.emit("disconnected") }
    super.onDestroy()
  }

  override fun onRevoke() {
    status = "disconnected"
    connectedAtMs = 0  // Reset connection time
    stopTunnelAsync()
    mainHandler.post { VpnStatusEmitter.emit("disconnected") }
    super.onRevoke()
  }

  private fun stopTunnelAsync() {
    val engineRef = engine
    engine = null
    // Run stop on a fresh thread - NOT the single stopExecutor which could
    // be blocked from a prior stop attempt
    Thread {
      try {
        engineRef?.stop()
      } catch (e: Exception) {
        Log.e("SuProxyVpn", "Failed to stop tunnel", e)
      }
    }.also { it.isDaemon = true }.start()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "SuProxy VPN",
      NotificationManager.IMPORTANCE_LOW,
    )
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(text: String): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("SuProxy")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_lock_lock)
      .setOngoing(true)
      .setContentIntent(pendingIntent)
      .build()
  }
}
