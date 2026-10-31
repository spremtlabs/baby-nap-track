package expo.modules.testphone

import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Google's test phones, the ones Play installs every new build on for its pre-launch report, carry
// `firebase.test.lab` set to `true` in the phone's system settings. A parent's phone never does.
class TestPhoneModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TestPhone")

    Constant("isTestPhone") {
      val resolver = appContext.reactContext?.contentResolver
      resolver != null && runCatching { Settings.System.getString(resolver, "firebase.test.lab") == "true" }.getOrDefault(false)
    }
  }
}
