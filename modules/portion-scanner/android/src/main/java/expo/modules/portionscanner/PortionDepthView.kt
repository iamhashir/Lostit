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
import com.google.ar.core.Frame
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.CameraNotAvailableException
import com.google.ar.core.exceptions.NotYetAvailableException
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.ArrayDeque
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt
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

  @Volatile private var session: Session? = null
  @Volatile private var sessionResumed = false
  @Volatile private var surfaceWidth = 0
  @Volatile private var surfaceHeight = 0
  @Volatile private var displayGeometryDirty = true

  private var cameraTextureSession: Session? = null
  private var lastDepthDispatchMs = 0L
  private var lastStatusKey: String? = null
  private var autofocusEnabled = false
  private var lastRawDepthTimestamp = Long.MIN_VALUE
  private var lastFullDepthTimestamp = Long.MIN_VALUE
  private val measurementHistory = ArrayDeque<MeasurementSample>()

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
        activeSession.setDisplayGeometry(currentDisplayRotation(), surfaceWidth, surfaceHeight)
        displayGeometryDirty = false
      }

      val frame = activeSession.update()
      backgroundRenderer.draw(frame)

      if (frame.camera.trackingState != TrackingState.TRACKING) {
        measurementHistory.clear()
        emitStatus("move", "Move slowly so ARCore can lock onto the surface.")
        return
      }

      val now = SystemClock.elapsedRealtime()
      if (now - lastDepthDispatchMs < DEPTH_EVENT_INTERVAL_MS) return
      lastDepthDispatchMs = now

      try {
        frame.acquireDepthImage16Bits().use { fullDepth ->
          var rawDepth: Image? = null
          var rawConfidence: Image? = null
          try {
            rawDepth = frame.acquireRawDepthImage16Bits()
            rawConfidence = frame.acquireRawDepthConfidenceImage()
          } catch (_: NotYetAvailableException) {
            rawDepth?.close()
            rawDepth = null
            rawConfidence?.close()
            rawConfidence = null
          }

          try {
            processDepthFrame(frame, fullDepth, rawDepth, rawConfidence)
          } finally {
            rawConfidence?.close()
            rawDepth?.close()
          }
        }
      } catch (_: NotYetAvailableException) {
        emitStatus("move", "Depth is initializing. Move slowly around the item.")
      }
    } catch (_: CameraNotAvailableException) {
      emitStatus("error", "The camera became unavailable. Close the scanner and try again.")
    } catch (error: Throwable) {
      emitStatus("error", error.message ?: "ARCore depth frame failed.")
    }
  }

  private fun processDepthFrame(
    frame: Frame,
    fullDepth: Image,
    rawDepth: Image?,
    rawConfidence: Image?
  ) {
    val centerSample = sampleCenterDepth(fullDepth)
    if (centerSample.depthMm <= 0) {
      emitStatus("move", "Depth is initializing. Move slowly around the item.")
      return
    }

    val rawIsUsable = rawDepth != null && rawConfidence != null &&
      rawDepth.width == fullDepth.width && rawDepth.height == fullDepth.height &&
      rawConfidence.width == fullDepth.width && rawConfidence.height == fullDepth.height

    val newDepthData = if (rawIsUsable && rawDepth != null) {
      val isNew = rawDepth.timestamp != lastRawDepthTimestamp
      if (isNew) lastRawDepthTimestamp = rawDepth.timestamp
      isNew
    } else {
      val isNew = fullDepth.timestamp != lastFullDepthTimestamp
      if (isNew) lastFullDepthTimestamp = fullDepth.timestamp
      isNew
    }

    val rawEstimate = estimateCentralVolume(
      frame = frame,
      image = fullDepth,
      rawDepth = if (rawIsUsable) rawDepth else null,
      rawConfidence = if (rawIsUsable) rawConfidence else null
    )

    val distanceOk = centerSample.depthMm in MIN_RECOMMENDED_DISTANCE_MM..MAX_RECOMMENDED_DISTANCE_MM
    val geometryClean = rawEstimate.baseFlat &&
      !rawEstimate.multipleObjects &&
      !rawEstimate.touchesGuide

    if (!distanceOk || !geometryClean) measurementHistory.clear()

    val canEnterHistory = newDepthData &&
      distanceOk &&
      geometryClean &&
      rawEstimate.volumeMl >= MIN_REPORTABLE_VOLUME_ML &&
      rawEstimate.confidence >= MIN_HISTORY_CONFIDENCE

    val stabilized = stabilize(rawEstimate, canEnterHistory)
    val scanReady = distanceOk &&
      geometryClean &&
      stabilized.sampleWindow >= MIN_READY_FRAMES &&
      stabilized.stability >= MIN_REPORTABLE_STABILITY &&
      stabilized.confidence >= MIN_REPORTABLE_CONFIDENCE

    emitStatus(
      when {
        centerSample.depthMm < MIN_RECOMMENDED_DISTANCE_MM -> "distance"
        centerSample.depthMm > MAX_RECOMMENDED_DISTANCE_MM -> "distance"
        !rawEstimate.baseFlat -> "surface"
        rawEstimate.multipleObjects -> "multiple"
        rawEstimate.touchesGuide -> "reframe"
        scanReady -> "measuring"
        else -> "tracking"
      },
      when {
        centerSample.depthMm < MIN_RECOMMENDED_DISTANCE_MM ->
          "Too close. Move back to about 50–90 cm so depth and focus are more reliable."
        centerSample.depthMm > MAX_RECOMMENDED_DISTANCE_MM ->
          "Move closer. Keep the item around 50–90 cm away for this measurement mode."
        !rawEstimate.baseFlat ->
          "Base surface is not flat enough. Use a hard table or counter and remove cloth, folds, bowls and nearby clutter."
        rawEstimate.multipleObjects ->
          "More than one raised object is detected. Leave only one item inside the guide."
        rawEstimate.touchesGuide ->
          "The object reaches the scan boundary. Move back slightly and leave empty flat surface around all sides."
        scanReady ->
          "Measurement locked. Hold steady, or capture the stable estimate."
        rawEstimate.rawDepthAvailable && rawEstimate.rawConfidenceQuality < 0.35 ->
          "Depth confidence is still building. Move slowly left and right, then hold steady."
        else ->
          "Collecting clean depth ${stabilized.sampleWindow}/$MIN_READY_FRAMES. Move slowly around the item, then hold steady."
      }
    )

    onDepthUpdate(
      mapOf(
        "depthMm" to centerSample.depthMm,
        "distanceCm" to centerSample.depthMm / 10.0,
        "coverage" to max(centerSample.coverage, rawEstimate.coverage),
        "depthWidth" to fullDepth.width,
        "depthHeight" to fullDepth.height,
        "tracking" to true,
        "timestamp" to fullDepth.timestamp.toDouble(),
        "plateDepthMm" to rawEstimate.baseDepthMm,
        "baseDepthMm" to rawEstimate.baseDepthMm,
        "rawVolumeMl" to rawEstimate.volumeMl,
        "estimatedVolumeMl" to if (scanReady) stabilized.volumeMl else 0.0,
        "estimatedHeightMm" to if (scanReady) stabilized.heightMm else 0.0,
        "foodPixelRatio" to rawEstimate.objectPixelRatio,
        "objectPixelRatio" to rawEstimate.objectPixelRatio,
        "planeResidualMm" to rawEstimate.planeResidualMm,
        "estimateConfidence" to stabilized.confidence,
        "stability" to stabilized.stability,
        "sampleWindow" to stabilized.sampleWindow,
        "autofocusEnabled" to autofocusEnabled,
        "distanceOk" to distanceOk,
        "componentTouchesGuide" to rawEstimate.touchesGuide,
        "focalLengthPx" to rawEstimate.focalLengthPx
      )
    )
  }

  private fun startSessionIfPossible() {
    if (!isAttachedToWindow) return

    if (
      ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      emitStatus("permission", "Camera permission is required for depth measurement.")
      return
    }

    val existing = session
    if (existing != null) {
      if (!sessionResumed) {
        try {
          existing.resume()
          sessionResumed = true
          displayGeometryDirty = true
          emitStatus("starting", "ARCore resumed. Move around the item slowly.")
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
      autofocusEnabled = try {
        config.focusMode = Config.FocusMode.AUTO
        newSession.configure(config)
        true
      } catch (_: Throwable) {
        val fallback = newSession.config
        fallback.depthMode = Config.DepthMode.AUTOMATIC
        fallback.focusMode = Config.FocusMode.FIXED
        newSession.configure(fallback)
        false
      }

      newSession.resume()
      session = newSession
      sessionResumed = true
      cameraTextureSession = null
      displayGeometryDirty = true
      resetMeasurementState()

      emitStatus(
        "starting",
        if (autofocusEnabled) {
          "ARCore Depth started with continuous autofocus. Move slowly around one item on a flat surface."
        } else {
          "ARCore Depth started with fixed focus fallback. Keep the item at least 50 cm away."
        }
      )
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
      // Session may already be paused.
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
    resetMeasurementState()
  }

  private fun resetMeasurementState() {
    measurementHistory.clear()
    lastRawDepthTimestamp = Long.MIN_VALUE
    lastFullDepthTimestamp = Long.MIN_VALUE
  }

  private fun currentDisplayRotation(): Int = display?.rotation ?: Surface.ROTATION_0

  private fun sampleCenterDepth(image: Image): DepthSample {
    val plane = image.planes.firstOrNull() ?: return DepthSample(0, 0.0)
    val buffer = plane.buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
    val centerX = image.width / 2
    val centerY = image.height / 2
    val radiusX = max(2, image.width / 52)
    val radiusY = max(2, image.height / 52)
    val values = ArrayList<Int>()
    var attempted = 0

    var y = centerY - radiusY
    while (y <= centerY + radiusY) {
      var x = centerX - radiusX
      while (x <= centerX + radiusX) {
        if (x in 0 until image.width && y in 0 until image.height) {
          attempted += 1
          val millimeters = readDepthMm(buffer, plane.rowStride, plane.pixelStride, x, y)
          if (millimeters in MIN_VALID_DEPTH_MM..MAX_VALID_DEPTH_MM) values.add(millimeters)
        }
        x += 2
      }
      y += 2
    }

    if (values.isEmpty()) return DepthSample(0, 0.0)
    values.sort()
    return DepthSample(
      depthMm = values[values.size / 2],
      coverage = values.size.toDouble() / max(1, attempted).toDouble()
    )
  }

  private fun estimateCentralVolume(
    frame: Frame,
    image: Image,
    rawDepth: Image?,
    rawConfidence: Image?
  ): VolumeEstimate {
    val plane = image.planes.firstOrNull() ?: return VolumeEstimate.empty()
    if (image.width < 20 || image.height < 20) return VolumeEstimate.empty()

    val buffer = plane.buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
    val rawPlane = rawDepth?.planes?.firstOrNull()
    val confidencePlane = rawConfidence?.planes?.firstOrNull()
    val rawBuffer = rawPlane?.buffer?.duplicate()?.order(ByteOrder.LITTLE_ENDIAN)
    val confidenceBuffer = confidencePlane?.buffer?.duplicate()
    val rawAvailable = rawBuffer != null && confidenceBuffer != null && rawPlane != null && confidencePlane != null

    val centerX = image.width / 2
    val centerY = image.height / 2
    val halfWidth = max(12, (image.width * ROI_WIDTH_FRACTION / 2.0).toInt())
    val halfHeight = max(12, (image.height * ROI_HEIGHT_FRACTION / 2.0).toInt())
    val xMin = max(0, centerX - halfWidth)
    val xMax = min(image.width - 1, centerX + halfWidth)
    val yMin = max(0, centerY - halfHeight)
    val yMax = min(image.height - 1, centerY + halfHeight)
    val roiWidth = max(1, xMax - xMin)
    val roiHeight = max(1, yMax - yMin)
    val stride = if (min(image.width, image.height) >= 180) 2 else 1

    val allSamples = ArrayList<DepthPointSample>()
    val borderSamples = ArrayList<DepthPointSample>()
    val rawBorderSamples = ArrayList<DepthPointSample>()
    var attempted = 0
    var rawAttempted = 0
    var rawHighConfidence = 0
    var rawConfidenceSum = 0.0

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

          if (rawAvailable && rawBuffer != null && confidenceBuffer != null && rawPlane != null && confidencePlane != null) {
            rawAttempted += 1
            val rawMm = readDepthMm(rawBuffer, rawPlane.rowStride, rawPlane.pixelStride, x, y)
            val rawConfidenceValue = readConfidence(
              confidenceBuffer,
              confidencePlane.rowStride,
              confidencePlane.pixelStride,
              x,
              y
            )
            if (rawMm in MIN_VALID_DEPTH_MM..MAX_VOLUME_DEPTH_MM && rawConfidenceValue > 0) {
              rawConfidenceSum += rawConfidenceValue.toDouble() / 255.0
              if (rawConfidenceValue >= RAW_CONFIDENCE_THRESHOLD) {
                rawHighConfidence += 1
                if (isBorder) {
                  rawBorderSamples.add(DepthPointSample(x, y, nx, ny, rawMm))
                }
              }
            }
          }
        }
        x += stride
      }
      y += stride
    }

    val coverage = allSamples.size.toDouble() / max(1, attempted).toDouble()
    if (allSamples.size < MIN_TOTAL_SAMPLES || borderSamples.size < MIN_BORDER_SAMPLES) {
      return VolumeEstimate.empty(coverage, rawAvailable)
    }

    val rawConfidenceQuality = if (rawAttempted == 0) {
      0.5
    } else {
      val coverageQuality = rawHighConfidence.toDouble() / rawAttempted.toDouble()
      val meanQuality = if (rawHighConfidence == 0) 0.0 else rawConfidenceSum / max(1, rawHighConfidence).toDouble()
      (coverageQuality * 0.65 + meanQuality.coerceIn(0.0, 1.0) * 0.35).coerceIn(0.0, 1.0)
    }

    val planeSeedSamples = if (rawBorderSamples.size >= MIN_RAW_BORDER_SAMPLES) {
      rawBorderSamples
    } else {
      val borderDepths = borderSamples.map { it.depthMm }.sorted()
      val median = percentileInt(borderDepths, 0.5)
      borderSamples.filter { abs(it.depthMm - median) <= MAX_BORDER_OUTLIER_MM }
    }

    if (planeSeedSamples.size < MIN_BORDER_SAMPLES) return VolumeEstimate.empty(coverage, rawAvailable)

    var planeSamples = planeSeedSamples
    var planeFit = fitDepthPlane(planeSamples) ?: return VolumeEstimate.empty(coverage, rawAvailable)
    repeat(2) {
      val residuals = planeSamples.map {
        abs(planeFit.predict(it.nx, it.ny) - it.depthMm.toDouble())
      }.sorted()
      val medianResidual = percentileDouble(residuals, 0.5)
      val threshold = max(MIN_PLANE_INLIER_THRESHOLD_MM, medianResidual * 2.6)
      val refined = planeSamples.filter {
        abs(planeFit.predict(it.nx, it.ny) - it.depthMm.toDouble()) <= threshold
      }
      if (refined.size >= MIN_BORDER_SAMPLES) {
        planeSamples = refined
        planeFit = fitDepthPlane(planeSamples) ?: planeFit
      }
    }

    val fullBorderInliers = borderSamples.count {
      abs(planeFit.predict(it.nx, it.ny) - it.depthMm.toDouble()) <= FULL_BORDER_FLATNESS_TOLERANCE_MM
    }
    val borderInlierRatio = fullBorderInliers.toDouble() / max(1, borderSamples.size).toDouble()
    val baseFlat = planeFit.residualMm <= MAX_ACCEPTABLE_PLANE_RESIDUAL_MM &&
      borderInlierRatio >= MIN_BORDER_INLIER_RATIO

    val focal = depthFocalLengths(frame, image.width, image.height)
    if (focal.first <= 1.0 || focal.second <= 1.0) {
      return VolumeEstimate.emptyWithPlane(coverage, planeFit, rawAvailable, rawConfidenceQuality, baseFlat)
    }

    val innerLeft = xMin + (roiWidth * BORDER_FRACTION).toInt()
    val innerRight = xMax - (roiWidth * BORDER_FRACTION).toInt()
    val innerTop = yMin + (roiHeight * BORDER_FRACTION).toInt()
    val innerBottom = yMax - (roiHeight * BORDER_FRACTION).toInt()

    val cols = ((xMax - xMin) / stride) + 1
    val rows = ((yMax - yMin) / stride) + 1
    val heights = DoubleArray(cols * rows) { Double.NaN }
    val depths = IntArray(cols * rows)
    var innerValid = 0

    for (sample in allSamples) {
      if (sample.x !in innerLeft..innerRight || sample.y !in innerTop..innerBottom) continue
      innerValid += 1
      val predictedBaseDepth = planeFit.predict(sample.nx, sample.ny)
      val heightMm = predictedBaseDepth - sample.depthMm.toDouble()
      if (heightMm < MIN_OBJECT_HEIGHT_MM || heightMm > MAX_OBJECT_HEIGHT_MM) continue

      val col = (sample.x - xMin) / stride
      val row = (sample.y - yMin) / stride
      if (col !in 0 until cols || row !in 0 until rows) continue
      val index = row * cols + col
      heights[index] = heightMm
      depths[index] = sample.depthMm
    }

    if (innerValid == 0) {
      return VolumeEstimate.emptyWithPlane(coverage, planeFit, rawAvailable, rawConfidenceQuality, baseFlat)
    }

    val components = findComponents(
      heights = heights,
      cols = cols,
      rows = rows,
      xMin = xMin,
      yMin = yMin,
      stride = stride,
      centerX = centerX,
      centerY = centerY
    ).filter { it.indices.size >= MIN_OBJECT_SAMPLES }

    if (components.isEmpty()) {
      return VolumeEstimate.emptyWithPlane(coverage, planeFit, rawAvailable, rawConfidenceQuality, baseFlat)
    }

    val primary = components.minByOrNull { it.centerDistanceSquared }
      ?: return VolumeEstimate.emptyWithPlane(coverage, planeFit, rawAvailable, rawConfidenceQuality, baseFlat)

    val secondLargest = components
      .filter { it !== primary }
      .maxOfOrNull { it.indices.size }
      ?: 0
    val multipleObjects = secondLargest >= max(MIN_SECONDARY_OBJECT_SAMPLES, (primary.indices.size * SECONDARY_COMPONENT_RATIO).toInt())

    var volumeMm3 = 0.0
    var touchesGuide = false
    val componentHeights = ArrayList<Int>()

    for (index in primary.indices) {
      val row = index / cols
      val col = index % cols
      val x = xMin + col * stride
      val yPosition = yMin + row * stride
      val heightMm = heights[index]
      val zMm = depths[index].toDouble()
      if (zMm <= 0.0 || heightMm.isNaN()) continue

      val sampledPixelAreaMm2 =
        (zMm * zMm / (focal.first * focal.second)) * stride.toDouble() * stride.toDouble()
      volumeMm3 += heightMm * sampledPixelAreaMm2
      componentHeights.add(heightMm.toInt())

      if (
        x <= innerLeft + stride || x >= innerRight - stride ||
        yPosition <= innerTop + stride || yPosition >= innerBottom - stride
      ) {
        touchesGuide = true
      }
    }

    if (componentHeights.isEmpty()) {
      return VolumeEstimate.emptyWithPlane(coverage, planeFit, rawAvailable, rawConfidenceQuality, baseFlat)
    }

    componentHeights.sort()
    val volumeMl = volumeMm3 / 1000.0
    val estimatedHeightMm = percentileInt(componentHeights, 0.90).toDouble()
    val objectPixelRatio = primary.indices.size.toDouble() / max(1, innerValid).toDouble()
    val planeQuality = (1.0 - planeFit.residualMm / MAX_GOOD_PLANE_RESIDUAL_MM).coerceIn(0.0, 1.0)
    val flatnessQuality = borderInlierRatio.coerceIn(0.0, 1.0)
    val componentQuality = when {
      objectPixelRatio in 0.025..0.62 -> 1.0
      objectPixelRatio in 0.012..0.78 -> 0.68
      else -> 0.30
    }
    val guideQuality = if (touchesGuide) 0.2 else 1.0
    val ambiguityQuality = if (multipleObjects) 0.15 else 1.0
    val rawQuality = if (rawAvailable) rawConfidenceQuality.coerceIn(0.15, 1.0) else 0.55

    var confidence = (
      coverage.coerceIn(0.0, 1.0) * 0.14 +
        planeQuality * 0.22 +
        flatnessQuality * 0.18 +
        componentQuality * 0.16 +
        rawQuality * 0.12 +
        guideQuality * 0.09 +
        ambiguityQuality * 0.09
      ).coerceIn(0.0, 1.0)

    if (!baseFlat) confidence *= 0.45
    if (multipleObjects || touchesGuide) confidence *= 0.35
    if (volumeMl < MIN_REPORTABLE_VOLUME_ML || volumeMl > MAX_REASONABLE_VOLUME_ML) confidence *= 0.5

    return VolumeEstimate(
      coverage = coverage,
      baseDepthMm = planeFit.predict(0.0, 0.0),
      volumeMl = volumeMl.coerceIn(0.0, MAX_REASONABLE_VOLUME_ML * 1.5),
      heightMm = estimatedHeightMm,
      objectPixelRatio = objectPixelRatio,
      planeResidualMm = planeFit.residualMm,
      confidence = confidence,
      touchesGuide = touchesGuide,
      focalLengthPx = (focal.first + focal.second) / 2.0,
      baseFlat = baseFlat,
      multipleObjects = multipleObjects,
      rawDepthAvailable = rawAvailable,
      rawConfidenceQuality = rawConfidenceQuality,
      borderInlierRatio = borderInlierRatio
    )
  }

  private fun findComponents(
    heights: DoubleArray,
    cols: Int,
    rows: Int,
    xMin: Int,
    yMin: Int,
    stride: Int,
    centerX: Int,
    centerY: Int
  ): List<Component> {
    val visited = BooleanArray(heights.size)
    val components = ArrayList<Component>()
    val queue = ArrayDeque<Int>()

    for (start in heights.indices) {
      if (visited[start] || heights[start].isNaN()) continue
      visited[start] = true
      queue.add(start)
      val indices = ArrayList<Int>()
      var centerDistanceSquared = Double.MAX_VALUE

      while (queue.isNotEmpty()) {
        val index = queue.removeFirst()
        if (heights[index].isNaN()) continue
        indices.add(index)

        val row = index / cols
        val col = index % cols
        val x = xMin + col * stride
        val y = yMin + row * stride
        val dx = x - centerX
        val dy = y - centerY
        centerDistanceSquared = min(centerDistanceSquared, (dx * dx + dy * dy).toDouble())

        for (dr in -1..1) {
          for (dc in -1..1) {
            if (dr == 0 && dc == 0) continue
            val nr = row + dr
            val nc = col + dc
            if (nr !in 0 until rows || nc !in 0 until cols) continue
            val neighbor = nr * cols + nc
            if (!visited[neighbor] && !heights[neighbor].isNaN()) {
              visited[neighbor] = true
              queue.add(neighbor)
            }
          }
        }
      }

      if (indices.isNotEmpty()) components.add(Component(indices, centerDistanceSquared))
    }

    return components
  }

  private fun depthFocalLengths(frame: Frame, depthWidth: Int, depthHeight: Int): Pair<Double, Double> {
    return try {
      val intrinsics = frame.camera.textureIntrinsics
      val focal = intrinsics.focalLength
      val dimensions = intrinsics.imageDimensions
      if (dimensions[0] <= 0 || dimensions[1] <= 0) return Pair(0.0, 0.0)

      val imageRatio = dimensions[0].toDouble() / dimensions[1].toDouble()
      val depthRatio = depthWidth.toDouble() / depthHeight.toDouble()
      val rotatedRatio = dimensions[1].toDouble() / dimensions[0].toDouble()

      if (abs(imageRatio - depthRatio) <= abs(rotatedRatio - depthRatio)) {
        Pair(
          focal[0].toDouble() * depthWidth.toDouble() / dimensions[0].toDouble(),
          focal[1].toDouble() * depthHeight.toDouble() / dimensions[1].toDouble()
        )
      } else {
        Pair(
          focal[1].toDouble() * depthWidth.toDouble() / dimensions[1].toDouble(),
          focal[0].toDouble() * depthHeight.toDouble() / dimensions[0].toDouble()
        )
      }
    } catch (_: Throwable) {
      Pair(0.0, 0.0)
    }
  }

  private fun stabilize(raw: VolumeEstimate, acceptSample: Boolean): StabilizedEstimate {
    if (acceptSample) {
      measurementHistory.addLast(MeasurementSample(raw.volumeMl, raw.heightMm, raw.confidence))
      while (measurementHistory.size > STABILITY_WINDOW) measurementHistory.removeFirst()
    }

    if (measurementHistory.isEmpty()) {
      return StabilizedEstimate(raw.volumeMl, raw.heightMm, raw.confidence, 0.0, 0)
    }

    val volumes = measurementHistory.map { it.volumeMl }.sorted()
    val heights = measurementHistory.map { it.heightMm }.sorted()
    val medianVolume = percentileDouble(volumes, 0.5)
    val medianHeight = percentileDouble(heights, 0.5)
    val deviations = volumes.map { abs(it - medianVolume) }.sorted()
    val mad = percentileDouble(deviations, 0.5)
    val relativeMad = if (medianVolume <= 1.0) 1.0 else mad / medianVolume
    val stability = when {
      measurementHistory.size < 3 -> 0.18
      measurementHistory.size < MIN_READY_FRAMES -> (1.0 - relativeMad * 6.0).coerceIn(0.0, 0.72)
      else -> (1.0 - relativeMad * 5.2).coerceIn(0.0, 1.0)
    }
    val historyConfidence = measurementHistory.map { it.confidence }.average()
    val stabilizedConfidence =
      (historyConfidence * (0.68 + 0.32 * stability)).coerceIn(0.0, 1.0)

    return StabilizedEstimate(
      volumeMl = medianVolume,
      heightMm = medianHeight,
      confidence = stabilizedConfidence,
      stability = stability,
      sampleWindow = measurementHistory.size
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
        for (cell in column..3) matrix[row][cell] -= factor * matrix[column][cell]
      }
    }
    return doubleArrayOf(matrix[0][3], matrix[1][3], matrix[2][3])
  }

  private fun readDepthMm(buffer: ByteBuffer, rowStride: Int, pixelStride: Int, x: Int, y: Int): Int {
    val byteIndex = y * rowStride + x * pixelStride
    if (byteIndex < 0 || byteIndex + 1 >= buffer.limit()) return 0
    val low = buffer.get(byteIndex).toInt() and 0xFF
    val high = buffer.get(byteIndex + 1).toInt() and 0xFF
    return (high shl 8) or low
  }

  private fun readConfidence(buffer: ByteBuffer, rowStride: Int, pixelStride: Int, x: Int, y: Int): Int {
    val byteIndex = y * rowStride + x * pixelStride
    if (byteIndex < 0 || byteIndex >= buffer.limit()) return 0
    return buffer.get(byteIndex).toInt() and 0xFF
  }

  private fun percentileInt(sortedValues: List<Int>, percentile: Double): Int {
    if (sortedValues.isEmpty()) return 0
    val index = ((sortedValues.size - 1) * percentile.coerceIn(0.0, 1.0)).toInt()
    return sortedValues[index]
  }

  private fun percentileDouble(sortedValues: List<Double>, percentile: Double): Double {
    if (sortedValues.isEmpty()) return 0.0
    val index = ((sortedValues.size - 1) * percentile.coerceIn(0.0, 1.0)).toInt()
    return sortedValues[index]
  }

  private fun emitStatus(state: String, message: String) {
    val key = "$state|$message"
    if (key == lastStatusKey) return
    lastStatusKey = key
    onScannerStatus(mapOf("state" to state, "message" to message))
  }

  private data class DepthSample(val depthMm: Int, val coverage: Double)

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

  private data class Component(
    val indices: List<Int>,
    val centerDistanceSquared: Double
  )

  private data class MeasurementSample(
    val volumeMl: Double,
    val heightMm: Double,
    val confidence: Double
  )

  private data class VolumeEstimate(
    val coverage: Double,
    val baseDepthMm: Double,
    val volumeMl: Double,
    val heightMm: Double,
    val objectPixelRatio: Double,
    val planeResidualMm: Double,
    val confidence: Double,
    val touchesGuide: Boolean,
    val focalLengthPx: Double,
    val baseFlat: Boolean,
    val multipleObjects: Boolean,
    val rawDepthAvailable: Boolean,
    val rawConfidenceQuality: Double,
    val borderInlierRatio: Double
  ) {
    companion object {
      fun empty(coverage: Double = 0.0, rawAvailable: Boolean = false) = VolumeEstimate(
        coverage, 0.0, 0.0, 0.0, 0.0, 999.0, 0.0, false, 0.0,
        false, false, rawAvailable, 0.0, 0.0
      )

      fun emptyWithPlane(
        coverage: Double,
        fit: DepthPlaneFit,
        rawAvailable: Boolean,
        rawConfidenceQuality: Double,
        baseFlat: Boolean
      ) = VolumeEstimate(
        coverage = coverage,
        baseDepthMm = fit.predict(0.0, 0.0),
        volumeMl = 0.0,
        heightMm = 0.0,
        objectPixelRatio = 0.0,
        planeResidualMm = fit.residualMm,
        confidence = 0.0,
        touchesGuide = false,
        focalLengthPx = 0.0,
        baseFlat = baseFlat,
        multipleObjects = false,
        rawDepthAvailable = rawAvailable,
        rawConfidenceQuality = rawConfidenceQuality,
        borderInlierRatio = 0.0
      )
    }
  }

  private data class StabilizedEstimate(
    val volumeMl: Double,
    val heightMm: Double,
    val confidence: Double,
    val stability: Double,
    val sampleWindow: Int
  )

  companion object {
    private const val DEPTH_EVENT_INTERVAL_MS = 250L
    private const val MIN_VALID_DEPTH_MM = 180
    private const val MAX_VALID_DEPTH_MM = 5000
    private const val MAX_VOLUME_DEPTH_MM = 1800
    private const val MIN_RECOMMENDED_DISTANCE_MM = 500
    private const val MAX_RECOMMENDED_DISTANCE_MM = 1000

    private const val ROI_WIDTH_FRACTION = 0.64
    private const val ROI_HEIGHT_FRACTION = 0.52
    private const val BORDER_FRACTION = 0.18

    private const val MIN_TOTAL_SAMPLES = 90
    private const val MIN_BORDER_SAMPLES = 24
    private const val MIN_RAW_BORDER_SAMPLES = 16
    private const val MIN_OBJECT_SAMPLES = 8
    private const val MIN_SECONDARY_OBJECT_SAMPLES = 10
    private const val SECONDARY_COMPONENT_RATIO = 0.28
    private const val MAX_BORDER_OUTLIER_MM = 75
    private const val MIN_PLANE_INLIER_THRESHOLD_MM = 10.0
    private const val FULL_BORDER_FLATNESS_TOLERANCE_MM = 22.0
    private const val MIN_BORDER_INLIER_RATIO = 0.66
    private const val MAX_ACCEPTABLE_PLANE_RESIDUAL_MM = 14.0
    private const val MAX_GOOD_PLANE_RESIDUAL_MM = 12.0

    private const val RAW_CONFIDENCE_THRESHOLD = 128
    private const val MIN_OBJECT_HEIGHT_MM = 8.0
    private const val MAX_OBJECT_HEIGHT_MM = 750.0
    private const val MIN_REPORTABLE_VOLUME_ML = 5.0
    private const val MAX_REASONABLE_VOLUME_ML = 5000.0
    private const val MIN_HISTORY_CONFIDENCE = 0.34
    private const val MIN_REPORTABLE_CONFIDENCE = 0.58
    private const val MIN_REPORTABLE_STABILITY = 0.62
    private const val MIN_READY_FRAMES = 6
    private const val STABILITY_WINDOW = 9
  }
}
