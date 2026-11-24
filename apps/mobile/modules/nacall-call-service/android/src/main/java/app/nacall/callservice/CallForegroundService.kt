package app.nacall.callservice

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

/**
 * Serviço em primeiro plano da call: enquanto ele existe, o Android não congela o app em segundo plano e o microfone
 * (e, com a câmera ligada, a câmera) continua captando. Mostra um aviso fixo ("Em call") que, ao tocar, volta para o NACALL.
 */
class CallForegroundService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "NACALL"
    val message = intent?.getStringExtra(EXTRA_MESSAGE) ?: "Call em andamento"
    val camera = intent?.getBooleanExtra(EXTRA_CAMERA, false) == true
    createChannel()
    val notification = buildNotification(title, message)
    startInForeground(notification, camera)
    acquireWakeLock()
    return START_NOT_STICKY
  }

  // Chamado de novo quando a câmera liga ou desliga: o aviso é o mesmo, só muda o tipo do serviço.
  private fun startInForeground(notification: Notification, camera: Boolean) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification)
      return
    }
    // Com a câmera ligada o Android só deixa o app continuar captando em segundo plano se o serviço também for do tipo câmera.
    // Esse tipo exige a permissão de câmera já liberada (Android 14+ derruba o app sem ela) e o app à vista; se algo disso
    // falhar, a call segue só com o microfone em vez de cair.
    if (camera && canUseCameraType()) {
      try {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA,
        )
        return
      } catch (e: Exception) {
        // cai para o serviço só de microfone
      }
    }
    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
  }

  private fun canUseCameraType(): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
      checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

  // O app foi fechado na lista de recentes: a call acaba junto, então o aviso também.
  override fun onTaskRemoved(rootIntent: Intent?) {
    stopSelf()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    releaseWakeLock()
    super.onDestroy()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Call em andamento", NotificationManager.IMPORTANCE_LOW)
    channel.description = "Aviso fixo enquanto você está numa call do NACALL"
    channel.setShowBadge(false)
    manager.createNotificationChannel(channel)
  }

  @Suppress("DEPRECATION")
  private fun buildNotification(title: String, message: String): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL_ID) else Notification.Builder(this)
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = launch?.let { PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) }
    return builder
      .setContentTitle(title)
      .setContentText(message)
      .setSmallIcon(android.R.drawable.stat_sys_phone_call)
      .setOngoing(true)
      .setContentIntent(pending)
      .build()
  }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NACALL:call").apply { acquire() }
  }

  private fun releaseWakeLock() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
  }

  companion object {
    const val EXTRA_TITLE = "title"
    const val EXTRA_MESSAGE = "message"
    const val EXTRA_CAMERA = "camera"
    private const val CHANNEL_ID = "nacall-call"
    private const val NOTIFICATION_ID = 4417
  }
}
