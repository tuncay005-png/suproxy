package com.app.suproxy.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.Build
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
  }

  private var engine: SuProxyVpnEngine? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopTunnel()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        return START_NOT_STICKY
      }

      ACTION_START -> {
        val config = intent.getStringExtra(EXTRA_CONFIG)
        if (config.isNullOrBlank()) {
          VpnStatusEmitter.emit("error")
          stopSelf()
          return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, buildNotification("Connecting…"))
        VpnStatusEmitter.emit("connecting")

        Thread {
          try {
            engine = SuProxyVpnEngine(this)
            val error = engine?.start(config)
            if (error != null) {
              Log.e("SuProxyVpn", error)
              VpnStatusEmitter.emit("error")
              stopTunnel()
              stopForeground(STOP_FOREGROUND_REMOVE)
              stopSelf()
              return@Thread
            }

            status = "connected"
            VpnStatusEmitter.emit("connected")
            val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            manager.notify(NOTIFICATION_ID, buildNotification("Connected"))

            // Blocks until TProxyStopService() is called (ACTION_STOP or onDestroy)
            engine?.runTunnel()

            stopTunnel()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
          } catch (e: Exception) {
            Log.e("SuProxyVpn", "VPN start failed", e)
            VpnStatusEmitter.emit("error")
            stopTunnel()
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
    stopTunnel()
    instance = null
    status = "disconnected"
    VpnStatusEmitter.emit("disconnected")
    super.onDestroy()
  }

  override fun onRevoke() {
    stopTunnel()
    VpnStatusEmitter.emit("disconnected")
    super.onRevoke()
  }

  private fun stopTunnel() {
    status = "disconnecting"
    VpnStatusEmitter.emit("disconnecting")
    engine?.stop()
    engine = null
    status = "disconnected"
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
