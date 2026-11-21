package app.nacall.callservice

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NacallCallServiceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NacallCallService")

    // Liga o serviço em primeiro plano (precisa ser chamado com o app aberto e o microfone já liberado).
    Function("start") { title: String, message: String ->
      val context = appContext.reactContext ?: return@Function
      val intent = Intent(context, CallForegroundService::class.java)
        .putExtra(CallForegroundService.EXTRA_TITLE, title)
        .putExtra(CallForegroundService.EXTRA_MESSAGE, message)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }

    Function("stop") {
      val context = appContext.reactContext ?: return@Function
      context.stopService(Intent(context, CallForegroundService::class.java))
    }
  }
}
