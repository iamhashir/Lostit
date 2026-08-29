package expo.modules.portionscanner

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.Image
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.os.SystemClock
import android.view.Surface
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
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
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt
import kotlin.math.tan
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

class PortionDepthView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext), GLSurfaceView.Renderer {
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
  private var lastDepthDispatchMs = 0L
  private var lastStatusKey: String? = null

  init {
    setBackgroundColor(0xFF050707.toInt())
    addView(glSurfaceView)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    glSurfaceView.onResume()
    startSessionIfPossible()
  }

  override fun onDetachedFromWindow() {
    glSurfaceView.onPause()
    closeSession()
    super.onDetachedFromWindow()
  }

  override fun onWindowVisibilityChanged(visibility: Int) {
    super.onWindowVisibilityChanged(visibility)
    if (!isAttachedToWindow) return

    if (visibility == View.VISIBLE) {
      glSurfaceView.onResume()
      startSessionIfPossible()
    } else {
      glSurfaceView.onPause()
      pauseSession()
    }
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
          val centerSample = sampleCenterDepth(depthImage)
          val volumeEstimate = estimateCentralVolume(depthImage)

          if (centerSample.depthMm > 0) {
            val estimateReady = volumeEstimate.estimatedVolumeMl >= MIN_REPORTABLE_VOLUME_ML &&
              volumeEstimate.estimateConfidence >= MIN_REPORTABLE_CONFIDENCE

            emitStatus(
              if (estimateReady) "measuring" else "tracking",
              if (estimateReady) {
                "Volume estimate is live. Keep the plate centered and hold the phone nearly parallel to it."
              } else {
                "Depth locked. Keep food inside the guide with visible plate around it."
              }
            )

            onDepthUpdate(
              mapOf(
                "depthMm" to centerSample.depthMm,
                "distanceCm" to centerSample.depthMm / 10.0,
                "coverage" to max(centerSample.coverage, volumeEstimate.coverage),
                "depthWidth" to depthImage.width,
                "depthHeight" to depthImage.height,
                "tracking" to true,
                "timestamp" to depthImage.timestamp.toDouble(),
                "plateDepthMm" to volumeEstimate.plateDepthMm,
                "estimatedVolumeMl" to volumeEstimate.estimatedVolumeMl,
                "estimatedHeightMm" to volumeEstimate.estimatedHeightMm,
                "foodPixelRatio" to volumeEstimate.foodPixelRatio,
                "planeResidualMm" to volumeEstimate.planeResidualMm,
                "estimateConfidence" to volumeEstimate.estimateConfidence
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
      // Session may already be paused while the view is leaving the window.
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

  private fun currentDisplayRotation(): Int {
    return display?.rotation ?: Surface.ROTATION_0
  }

  private fun sampleCenterDepth(image: Image): DepthSample {
    val plane = image.planes.firstOrNull() ?: return DepthSample(0, 0.0)
    val buffer = plane.buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
    val centerX = image.width / 2
    val centerY = image.height / 2
    val radiusX = max(2, image.width / 48)
    val radiusY = max(2, image.height / 48)

    val values = ArrayList<Int>()
    var attempted = 0

    var y = centerY - radiusY
    while (y <= centerY + radiusY) {
      var x = centerX - radiusX
      while (x <= centerX + radiusX) {
        if (x in 0 until image.width && y in 0 until image.height) {
          attempted += 1
          val millimeters = readDepthMm(buffer, plane.rowStride, plane.pixelStride, x, y)
          if (millimeters in MIN_VALID_DEPTH_MM..MAX_VALID_DEPTH_MM) {
            values.add(millimeters)
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

  private fun estimateCentralVolume(image: Image): VolumeEstimate {
    val plane = image.planes.firstOrNull() ?: return VolumeEstimate.empty()
    if (image.width < 20 || image.height < 20) return VolumeEstimate.empty()

    val buffer = plane.buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
    val centerX = image.width / 2
    val centerY = image.height / 2
    val halfWidth = max(10, (image.width * ROI_WIDTH_FRACTION / 2.0).toInt())
    val halfHeight = max(10, (image.height * ROI_HEIGHT_FRACTION / 2.0).toInt())
    val xMin = max(0, centerX - halfWidth)
    val xMax = min(image.width - 1, centerX + halfWidth)
    val yMin = max(0, centerY - halfHeight)
    val yMax = min(image.height - 1, centerY + halfHeight)
    val roiWidth = max(1, xMax - xMin)
    val roiHeight = max(1, yMax - yMin)
    val stride = if (min(image.width, image.height) >= 180) 2 else 1

    val allSamples = ArrayList<DepthPointSample>()
    val borderSamples = ArrayList<DepthPointSample>()
    var attempted = 0

    var y = yMin
    while (y <= yMax) {
      var x = xMin
      while (x <= xMax) {
        attempted += 1
        val depthMm = readDepthMm(buffer, plane.rowStride, plane.pixelStride, x, y)
        if (depthMm in MIN_VALID_DEPTH_MM..MAX_VOLUME_DEPTH_MM) {
          val nx = (x - centerX).toDouble() / image.width.toDouble()
          val ny = (y - centerY).toDouble() / image.height.toDouble()
          val sample = DepthPointSample(x, y, nx, ny, depthMm)
          allSamples.add(sample)

          val xPosition = (x - xMin).toDouble() / roiWidth.toDouble()
          val yPosition = (y - yMin).toDouble() / roiHeight.toDouble()
          val isBorder = xPosition < BORDER_FRACTION ||
            xPosition > 1.0 - BORDER_FRACTION ||
            yPosition < BORDER_FRACTION ||
            yPosition > 1.0 - BORDER_FRACTION
          if (isBorder) borderSamples.add(sample)
        }
        x += stride
      }
      y += stride
    }

    val coverage = if (attempted == 0) 0.0 else allSamples.size.toDouble() / attempted.toDouble()
    if (allSamples.size < MIN_TOTAL_SAMPLES || borderSamples.size < MIN_BORDER_SAMPLES) {
      return VolumeEstimate.empty(coverage)
    }

    val borderDepths = borderSamples.map { it.depthMm }.sorted()
    val borderMedian = percentileInt(borderDepths, 0.5)
    val filteredBorder = borderSamples.filter {
      abs(it.depthMm - borderMedian) <= MAX_BORDER_OUTLIER_MM
    }

    if (filteredBorder.size < MIN_BORDER_SAMPLES) return VolumeEstimate.empty(coverage)

    val planeFit = fitDepthPlane(filteredBorder) ?: return VolumeEstimate.empty(coverage)
    val horizontalTanHalfFov = tan(Math.toRadians(APPROX_HORIZONTAL_FOV_DEGREES / 2.0))
    val verticalTanHalfFov = horizontalTanHalfFov * image.height.toDouble() / image.width.toDouble()

    val innerLeft = xMin + (roiWidth * BORDER_FRACTION).toInt()
    val innerRight = xMax - (roiWidth * BORDER_FRACTION).toInt()
    val innerTop = yMin + (roiHeight * BORDER_FRACTION).toInt()
    val innerBottom = yMax - (roiHeight * BORDER_FRACTION).toInt()

    var volumeMm3 = 0.0
    var innerValid = 0
    var foodPixels = 0
    val heights = ArrayList<Int>()

    for (sample in allSamples) {
      if (sample.x !in innerLeft..innerRight || sample.y !in innerTop..innerBottom) continue
      innerValid += 1

      val predictedPlateDepth = planeFit.predict(sample.nx, sample.ny)
      val heightMm = predictedPlateDepth - sample.depthMm.toDouble()
      if (heightMm < MIN_FOOD_HEIGHT_MM || heightMm > MAX_FOOD_HEIGHT_MM) continue

      foodPixels += 1
      heights.add(heightMm.toInt())

      val zMm = sample.depthMm.toDouble()
      val pixelWidthMm = (2.0 * zMm * horizontalTanHalfFov) / image.width.toDouble()
      val pixelHeightMm = (2.0 * zMm * verticalTanHalfFov) / image.height.toDouble()
      val sampledPixelAreaMm2 = pixelWidthMm * pixelHeightMm * stride.toDouble() * stride.toDouble()
      volumeMm3 += heightMm * sampledPixelAreaMm2
    }

    if (innerValid == 0 || foodPixels < MIN_FOOD_SAMPLES) {
      return VolumeEstimate(
        coverage = coverage,
        plateDepthMm = planeFit.predict(0.0, 0.0),
        estimatedVolumeMl = 0.0,
        estimatedHeightMm = 0.0,
        foodPixelRatio = 0.0,
        planeResidualMm = planeFit.residualMm,
        estimateConfidence = 0.0
      )
    }

    heights.sort()
    val volumeMl = volumeMm3 / 1000.0
    val estimatedHeightMm = percentileInt(heights, 0.9).toDouble()
    val foodPixelRatio = foodPixels.toDouble() / innerValid.toDouble()
    val planeQuality = (1.0 - planeFit.residualMm / MAX_GOOD_PLANE_RESIDUAL_MM).coerceIn(0.0, 1.0)
    val foodShapeQuality = when {
      foodPixelRatio in 0.04..0.72 -> 1.0
      foodPixelRatio in 0.02..0.86 -> 0.65
      else -> 0.25
    }
    var confidence = (
      coverage.coerceIn(0.0, 1.0) * 0.35 +
        planeQuality * 0.45 +
        foodShapeQuality * 0.20
      ).coerceIn(0.0, 1.0)

    if (volumeMl < MIN_REPORTABLE_VOLUME_ML || volumeMl > MAX_REASONABLE_VOLUME_ML) {
      confidence *= 0.45
    }

    return VolumeEstimate(
      coverage = coverage,
      plateDepthMm = planeFit.predict(0.0, 0.0),
      estimatedVolumeMl = volumeMl.coerceIn(0.0, MAX_REASONABLE_VOLUME_ML * 1.5),
      estimatedHeightMm = estimatedHeightMm,
      foodPixelRatio = foodPixelRatio,
      planeResidualMm = planeFit.residualMm,
      estimateConfidence = confidence
    )
  }

  private fun fitDepthPlane(samples: List<DepthPointSample>): DepthPlaneFit? {
    if (samples.size < 3) return null

    var sumX = 0.0
    var sumY = 0.0
    var sumZ = 0.0
    var sumXX = 0.0
    var sumYY = 0.0
    var sumXY = 0.0
    var sumXZ = 0.0
    var sumYZ = 0.0

    for (sample in samples) {
      val x = sample.nx
      val y = sample.ny
      val z = sample.depthMm.toDouble()
      sumX += x
      sumY += y
      sumZ += z
      sumXX += x * x
      sumYY += y * y
      sumXY += x * y
      sumXZ += x * z
      sumYZ += y * z
    }

    val matrix = arrayOf(
      doubleArrayOf(sumXX, sumXY, sumX, sumXZ),
      doubleArrayOf(sumXY, sumYY, sumY, sumYZ),
      doubleArrayOf(sumX, sumY, samples.size.toDouble(), sumZ)
    )

    val solution = solveThreeByThree(matrix) ?: return null
    val fit = DepthPlaneFit(solution[0], solution[1], solution[2], 0.0)

    var squaredError = 0.0
    for (sample in samples) {
      val error = fit.predict(sample.nx, sample.ny) - sample.depthMm.toDouble()
      squaredError += error * error
    }

    return fit.copy(residualMm = sqrt(squaredError / samples.size.toDouble()))
  }

  private fun solveThreeByThree(matrix: Array<DoubleArray>): DoubleArray? {
    for (column in 0..2) {
      var pivotRow = column
      var pivotValue = abs(matrix[column][column])
      for (row in column + 1..2) {
        val candidate = abs(matrix[row][column])
        if (candidate > pivotValue) {
          pivotValue = candidate
          pivotRow = row
        }
      }

      if (pivotValue < 1e-9) return null

      if (pivotRow != column) {
        val temp = matrix[column]
        matrix[column] = matrix[pivotRow]
        matrix[pivotRow] = temp
      }

      val pivot = matrix[column][column]
      for (cell in column..3) matrix[column][cell] /= pivot

      for (row in 0..2) {
        if (row == column) continue
        val factor = matrix[row][column]
        for (cell in column..3) {
          matrix[row][cell] -= factor * matrix[column][cell]
        }
      }
    }

    return doubleArrayOf(matrix[0][3], matrix[1][3], matrix[2][3])
  }

  private fun readDepthMm(
    buffer: java.nio.ByteBuffer,
    rowStride: Int,
    pixelStride: Int,
    x: Int,
    y: Int
  ): Int {
    val byteIndex = y * rowStride + x * pixelStride
    if (byteIndex < 0 || byteIndex + 1 >= buffer.limit()) return 0
    val low = buffer.get(byteIndex).toInt() and 0xFF
    val high = buffer.get(byteIndex + 1).toInt() and 0xFF
    return (high shl 8) or low
  }

  private fun percentileInt(sortedValues: List<Int>, percentile: Double): Int {
    if (sortedValues.isEmpty()) return 0
    val index = ((sortedValues.size - 1) * percentile.coerceIn(0.0, 1.0)).toInt()
    return sortedValues[index]
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

  private data class DepthPointSample(
    val x: Int,
    val y: Int,
    val nx: Double,
    val ny: Double,
    val depthMm: Int
  )

  private data class DepthPlaneFit(
    val a: Double,
    val b: Double,
    val c: Double,
    val residualMm: Double
  ) {
    fun predict(nx: Double, ny: Double): Double = a * nx + b * ny + c
  }

  private data class VolumeEstimate(
    val coverage: Double,
    val plateDepthMm: Double,
    val estimatedVolumeMl: Double,
    val estimatedHeightMm: Double,
    val foodPixelRatio: Double,
    val planeResidualMm: Double,
    val estimateConfidence: Double
  ) {
    companion object {
      fun empty(coverage: Double = 0.0) = VolumeEstimate(
        coverage = coverage,
        plateDepthMm = 0.0,
        estimatedVolumeMl = 0.0,
        estimatedHeightMm = 0.0,
        foodPixelRatio = 0.0,
        planeResidualMm = 0.0,
        estimateConfidence = 0.0
      )
    }
  }

  companion object {
    private const val DEPTH_EVENT_INTERVAL_MS = 250L
    private const val MIN_VALID_DEPTH_MM = 100
    private const val MAX_VALID_DEPTH_MM = 5000
    private const val MAX_VOLUME_DEPTH_MM = 1800
    private const val ROI_WIDTH_FRACTION = 0.58
    private const val ROI_HEIGHT_FRACTION = 0.50
    private const val BORDER_FRACTION = 0.17
    private const val MAX_BORDER_OUTLIER_MM = 120
    private const val MIN_TOTAL_SAMPLES = 80
    private const val MIN_BORDER_SAMPLES = 24
    private const val MIN_FOOD_SAMPLES = 12
    private const val MIN_FOOD_HEIGHT_MM = 7.0
    private const val MAX_FOOD_HEIGHT_MM = 180.0
    private const val APPROX_HORIZONTAL_FOV_DEGREES = 65.0
    private const val MAX_GOOD_PLANE_RESIDUAL_MM = 34.0
    private const val MIN_REPORTABLE_VOLUME_ML = 8.0
    private const val MAX_REASONABLE_VOLUME_ML = 1800.0
    private const val MIN_REPORTABLE_CONFIDENCE = 0.35
  }
}
