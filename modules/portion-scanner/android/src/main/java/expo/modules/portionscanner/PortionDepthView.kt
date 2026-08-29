package expo.modules.portionscanner

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.Image
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.os.SystemClock
import android.view.Surface
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.LifecycleEventListener
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.CameraNotAvailableException
import com.google.ar.core.exceptions.NotYetAvailableException
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.nio.ByteOrder
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

class PortionDepthView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext), GLSurfaceView.Renderer, LifecycleEventListener {
  private val onDepthUpdate by EventDispatcher()
  private val onScannerStatus by EventDispatcher()

  private val glSurfaceView = GLSurfaceView(context).apply {
    setEGLContextClientVersion(2)
    setPreserveEGLContextOnPause(true)
    setRenderer(this@PortionDepthView)
    renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
    layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
  }

  private val backgroundRenderer = CameraBackgroundRenderer()

  @Volatile
  private var session: Session? = null

  @Volatile
  private var sessionResumed = false

  @Volatile
  private var surfaceWidth = 0

  @Volatile
  private var surfaceHeight = 0

  @Volatile
  private var displayGeometryDirty = true

  private var cameraTextureSession: Session? = null
  private var lifecycleRegistered = false
  private var lastDepthDispatchMs = 0L
  private var lastStatusKey: String? = null

  init {
    setBackgroundColor(0xFF050707.toInt())
    addView(glSurfaceView)
    registerLifecycleListener()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    registerLifecycleListener()
    startSessionIfPossible()
    glSurfaceView.onResume()
  }

  override fun onDetachedFromWindow() {
    glSurfaceView.onPause()
    closeSession()
    unregisterLifecycleListener()
    super.onDetachedFromWindow()
  }

  override fun onHostResume() {
    if (!isAttachedToWindow) return
    startSessionIfPossible()
    glSurfaceView.onResume()
  }

  override fun onHostPause() {
    glSurfaceView.onPause()
    pauseSession()
  }

  override fun onHostDestroy() {
    closeSession()
  }

  override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
    try {
      backgroundRenderer.createOnGlThread()
      cameraTextureSession = null
      emitStatus("starting", "Starting ARCore camera…")
    } catch (error: Throwable) {
      emitStatus("error", error.message ?: "OpenGL camera preview could not start.")
    }
  }

  override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
    surfaceWidth = width
    surfaceHeight = height
    displayGeometryDirty = true
    backgroundRenderer.resetGeometry()
    GLES20.glViewport(0, 0, width, height)
  }

  override fun onDrawFrame(gl: GL10?) {
    GLES20.glClearColor(0.02f, 0.025f, 0.025f, 1f)
    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)

    val activeSession = session ?: return
    if (!sessionResumed || backgroundRenderer.textureId < 0) return

    try {
      if (cameraTextureSession !== activeSession) {
        activeSession.setCameraTextureName(backgroundRenderer.textureId)
        cameraTextureSession = activeSession
      }

      if (displayGeometryDirty && surfaceWidth > 0 && surfaceHeight > 0) {
        activeSession.setDisplayGeometry(
          currentDisplayRotation(),
          surfaceWidth,
          surfaceHeight
        )
        displayGeometryDirty = false
      }

      val frame = activeSession.update()
      backgroundRenderer.draw(frame)

      if (frame.camera.trackingState != TrackingState.TRACKING) {
        emitStatus("move", "Move the phone slowly so ARCore can lock onto the plate.")
        return
      }

      val now = SystemClock.elapsedRealtime()
      if (now - lastDepthDispatchMs < DEPTH_EVENT_INTERVAL_MS) return
      lastDepthDispatchMs = now

      try {
        frame.acquireDepthImage16Bits().use { depthImage ->
          val sample = sampleCenterDepth(depthImage)
          if (sample.depthMm > 0) {
            emitStatus("tracking", "Depth locked. Keep the center marker on the food.")
            onDepthUpdate(
              mapOf(
                "depthMm" to sample.depthMm,
                "distanceCm" to sample.depthMm / 10.0,
                "coverage" to sample.coverage,
                "depthWidth" to depthImage.width,
                "depthHeight" to depthImage.height,
                "tracking" to true,
                "timestamp" to depthImage.timestamp.toDouble()
              )
            )
          } else {
            emitStatus("move", "Depth is initializing. Move slowly around the plate.")
          }
        }
      } catch (_: NotYetAvailableException) {
        emitStatus("move", "Depth is initializing. Move slowly around the plate.")
      }
    } catch (_: CameraNotAvailableException) {
      emitStatus("error", "The camera became unavailable. Close the scanner and try again.")
    } catch (error: Throwable) {
      emitStatus("error", error.message ?: "ARCore depth frame failed.")
    }
  }

  private fun startSessionIfPossible() {
    if (!isAttachedToWindow) return

    if (
      ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      emitStatus("permission", "Camera permission is required for portion scanning.")
      return
    }

    val existing = session
    if (existing != null) {
      if (!sessionResumed) {
        try {
          existing.resume()
          sessionResumed = true
          displayGeometryDirty = true
          emitStatus("starting", "ARCore resumed. Move around the plate slowly.")
        } catch (error: Throwable) {
          emitStatus("error", error.message ?: "ARCore could not resume the camera.")
        }
      }
      return
    }

    val availability = ArCoreApk.getInstance().checkAvailability(context)
    if (availability != ArCoreApk.Availability.SUPPORTED_INSTALLED) {
      emitStatus(
        "unavailable",
        when (availability) {
          ArCoreApk.Availability.SUPPORTED_NOT_INSTALLED ->
            "Google Play Services for AR is not installed."
          ArCoreApk.Availability.SUPPORTED_APK_TOO_OLD ->
            "Google Play Services for AR needs an update."
          ArCoreApk.Availability.UNSUPPORTED_DEVICE_NOT_CAPABLE ->
            "This device does not support ARCore."
          else -> "ARCore availability is still being checked."
        }
      )
      return
    }

    try {
      val newSession = Session(context)
      if (!newSession.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) {
        newSession.close()
        emitStatus("unsupported", "ARCore is installed, but Depth API is not supported.")
        return
      }

      val config = newSession.config
      config.depthMode = Config.DepthMode.AUTOMATIC
      newSession.configure(config)
      newSession.resume()

      session = newSession
      sessionResumed = true
      cameraTextureSession = null
      displayGeometryDirty = true
      emitStatus("starting", "ARCore Depth started. Move slowly around the plate.")
    } catch (error: Throwable) {
      emitStatus("error", error.message ?: "ARCore depth session could not start.")
    }
  }

  private fun pauseSession() {
    val activeSession = session ?: return
    if (!sessionResumed) return

    try {
      activeSession.pause()
    } catch (_: Throwable) {
      // Session may already be paused while the React activity is stopping.
    } finally {
      sessionResumed = false
    }
  }

  private fun closeSession() {
    pauseSession()
    session?.close()
    session = null
    cameraTextureSession = null
    lastStatusKey = null
  }

  private fun registerLifecycleListener() {
    if (lifecycleRegistered) return
    appContext.reactContext?.addLifecycleEventListener(this)
    lifecycleRegistered = true
  }

  private fun unregisterLifecycleListener() {
    if (!lifecycleRegistered) return
    appContext.reactContext?.removeLifecycleEventListener(this)
    lifecycleRegistered = false
  }

  private fun currentDisplayRotation(): Int {
    return display?.rotation ?: Surface.ROTATION_0
  }

  private fun sampleCenterDepth(image: Image): DepthSample {
    val plane = image.planes.firstOrNull() ?: return DepthSample(0, 0.0)
    val buffer = plane.buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
    val centerX = image.width / 2
    val centerY = image.height / 2
    val radiusX = maxOf(2, image.width / 48)
    val radiusY = maxOf(2, image.height / 48)

    val values = ArrayList<Int>()
    var attempted = 0

    var y = centerY - radiusY
    while (y <= centerY + radiusY) {
      var x = centerX - radiusX
      while (x <= centerX + radiusX) {
        if (x in 0 until image.width && y in 0 until image.height) {
          attempted += 1
          val byteIndex = y * plane.rowStride + x * plane.pixelStride
          if (byteIndex >= 0 && byteIndex + 1 < buffer.limit()) {
            val low = buffer.get(byteIndex).toInt() and 0xFF
            val high = buffer.get(byteIndex + 1).toInt() and 0xFF
            val millimeters = (high shl 8) or low
            if (millimeters in MIN_VALID_DEPTH_MM..MAX_VALID_DEPTH_MM) {
              values.add(millimeters)
            }
          }
        }
        x += 2
      }
      y += 2
    }

    if (values.isEmpty()) return DepthSample(0, 0.0)

    values.sort()
    val median = values[values.size / 2]
    val coverage = if (attempted == 0) 0.0 else values.size.toDouble() / attempted.toDouble()
    return DepthSample(median, coverage)
  }

  private fun emitStatus(state: String, message: String) {
    val key = "$state|$message"
    if (key == lastStatusKey) return
    lastStatusKey = key
    onScannerStatus(mapOf("state" to state, "message" to message))
  }

  private data class DepthSample(
    val depthMm: Int,
    val coverage: Double
  )

  companion object {
    private const val DEPTH_EVENT_INTERVAL_MS = 250L
    private const val MIN_VALID_DEPTH_MM = 100
    private const val MAX_VALID_DEPTH_MM = 5000
  }
}
