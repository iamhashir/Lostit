package expo.modules.portionscanner

import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Session
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PortionScannerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PortionScanner")

    AsyncFunction("getSupportStatusAsync") { promise: Promise ->
      val context = appContext.reactContext

      if (context == null) {
        promise.resolve(
          mapOf(
            "arCoreSupported" to false,
            "arCoreInstalled" to false,
            "depthSupported" to false,
            "rawDepthSupported" to false,
            "availability" to "NO_REACT_CONTEXT",
            "message" to "Android context is not available yet."
          )
        )
        return@AsyncFunction
      }

      ArCoreApk.getInstance().checkAvailabilityAsync(context) { availability ->
        if (availability != ArCoreApk.Availability.SUPPORTED_INSTALLED) {
          val message = when (availability) {
            ArCoreApk.Availability.SUPPORTED_NOT_INSTALLED ->
              "Google Play Services for AR is supported but not installed."
            ArCoreApk.Availability.SUPPORTED_APK_TOO_OLD ->
              "Google Play Services for AR needs to be updated."
            ArCoreApk.Availability.UNSUPPORTED_DEVICE_NOT_CAPABLE ->
              "This device does not support ARCore."
            else -> "ARCore availability is still being determined."
          }

          promise.resolve(
            mapOf(
              "arCoreSupported" to availability.isSupported,
              "arCoreInstalled" to false,
              "depthSupported" to false,
              "rawDepthSupported" to false,
              "availability" to availability.name,
              "message" to message
            )
          )
          return@checkAvailabilityAsync
        }

        var session: Session? = null
        try {
          session = Session(context)
          val depthSupported = session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)
          val rawDepthSupported = session.isDepthModeSupported(Config.DepthMode.RAW_DEPTH_ONLY)

          promise.resolve(
            mapOf(
              "arCoreSupported" to true,
              "arCoreInstalled" to true,
              "depthSupported" to depthSupported,
              "rawDepthSupported" to rawDepthSupported,
              "availability" to availability.name,
              "message" to if (depthSupported) {
                "ARCore Depth is ready on this device."
              } else {
                "ARCore is available, but the Depth API is not supported by this camera configuration."
              }
            )
          )
        } catch (error: Exception) {
          promise.resolve(
            mapOf(
              "arCoreSupported" to true,
              "arCoreInstalled" to true,
              "depthSupported" to false,
              "rawDepthSupported" to false,
              "availability" to "SESSION_ERROR",
              "message" to (error.message ?: "ARCore session could not be created.")
            )
          )
        } finally {
          session?.close()
        }
      }
    }

    View(PortionDepthView::class) {
      Events("onDepthUpdate", "onScannerStatus")
    }
  }
}
