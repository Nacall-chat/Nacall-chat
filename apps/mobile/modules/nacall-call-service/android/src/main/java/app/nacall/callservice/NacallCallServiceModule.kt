package app.nacall.callservice

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NacallCallServiceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NacallCallService")

    // Liga o serviço em primeiro plano (precisa ser chamado com o app aberto e o microfone já liberado).
    // Chamar de novo, com `camera` diferente, troca o tipo do serviço sem derrubar a call: camera = true só depois de a
    // câmera estar liberada e ligada.
    Function("start") { title: String, message: String, camera: Boolean ->
      appContext.reactContext?.let { context ->
        val intent = Intent(context, CallForegroundService::class.java)
          .putExtra(CallForegroundService.EXTRA_TITLE, title)
          .putExtra(CallForegroundService.EXTRA_MESSAGE, message)
          .putExtra(CallForegroundService.EXTRA_CAMERA, camera)
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
