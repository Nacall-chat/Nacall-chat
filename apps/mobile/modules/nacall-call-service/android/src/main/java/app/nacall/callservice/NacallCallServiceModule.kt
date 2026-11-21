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
      appContext.reactContext?.let { context ->
        val intent = Intent(context, CallForegroundService::class.java)
          .putExtra(CallForegroundService.EXTRA_TITLE, title)
          .putExtra(CallForegroundService.EXTRA_MESSAGE, message)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
      }
      null
    }

    Function("stop") {
      appContext.reactContext?.let { context ->
        context.stopService(Intent(context, CallForegroundService::class.java))
      }
      null
    }
  }
}
