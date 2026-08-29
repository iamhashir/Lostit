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
import com.google.ar.core.Plane
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
import kotlin.math.roundToInt
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
  private val history = ArrayDeque<HistorySample>()

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
        clearHistory()
        emitStatus("move", "Move slowly so ARCore can lock onto the surface.")
        return
      }

      val now = SystemClock.elapsedRealtime()
      if (now - lastDepthDispatchMs < DEPTH_EVENT_INTERVAL_MS) return
      lastDepthDispatchMs = now

      analyzeFrame(frame)
    } catch (_: CameraNotAvailableException) {
      clearHistory()
      emitStatus("error", "The camera became unavailable. Close the scanner and try again.")
    } catch (error: Throwable) {
      clearHistory()
      emitStatus("error", error.message ?: "ARCore depth frame failed.")
    }
  }

  private fun analyzeFrame(frame: Frame) {
    var denseDepth: Image? = null
    var rawDepth: Image? = null
    var rawConfidence: Image? = null

    try {
      denseDepth = frame.acquireDepthImage16Bits()
      try {
        rawDepth = frame.acquireRawDepthImage16Bits()
        rawConfidence = frame.acquireRawDepthConfidenceImage()
      } catch (_: NotYetAvailableException) {
        rawDepth?.close()
        rawDepth = null
        rawConfidence?.close()
        rawConfidence = null
      }

      val center = sampleCenterDepth(denseDepth)
      val estimate = estimateCentralVolume(frame, denseDepth, rawDepth, rawConfidence)
      val surfaceDistance = estimateSurfaceDistance(frame, estimate, center)

      val hasDistance = surfaceDistance.distanceMm in HARD_MIN_DISTANCE_MM..HARD_MAX_DISTANCE_MM
      val distanceOk = surfaceDistance.distanceMm in MIN_RECOMMENDED_DISTANCE_MM..MAX_RECOMMENDED_DISTANCE_MM
      val baseOk = estimate.baseDepthMm in HARD_MIN_DISTANCE_MM.toDouble()..HARD_MAX_DISTANCE_MM.toDouble() &&
        estimate.planeResidualMm <= MAX_CAPTURE_PLANE_RESIDUAL_MM
      val framingOk = !estimate.touchesGuide &&
        !estimate.multipleObjects &&
        estimate.centerOffset <= MAX_CENTER_OFFSET
      val geometryOk = hasDistance &&
        distanceOk &&
        baseOk &&
        framingOk &&
        estimate.volumeMl >= MIN_REPORTABLE_VOLUME_ML

      val freshDepth = rawDepth?.let { frame.timestamp == it.timestamp } ?: true
      val stabilized = stabilize(estimate, geometryOk, freshDepth)
      val ready = geometryOk &&
        stabilized.sampleWindow >= MIN_CAPTURE_FRAMES &&
        stabilized.stability >= MIN_REPORTABLE_STABILITY &&
        stabilized.confidence >= MIN_REPORTABLE_CONFIDENCE

      emitGuidance(surfaceDistance, estimate, stabilized, baseOk, framingOk, ready)

      val reportedDepthMm = if (hasDistance) surfaceDistance.distanceMm.roundToInt() else 0
      onDepthUpdate(
        mapOf(
          "depthMm" to reportedDepthMm,
          "distanceCm" to if (hasDistance) surfaceDistance.distanceMm / 10.0 else 0.0,
          "coverage" to max(center.coverage, estimate.coverage),
          "depthWidth" to denseDepth.width,
          "depthHeight" to denseDepth.height,
          "tracking" to true,
          "timestamp" to denseDepth.timestamp.toDouble(),
          "plateDepthMm" to estimate.baseDepthMm,
          "baseDepthMm" to estimate.baseDepthMm,
          "rawVolumeMl" to estimate.volumeMl,
          "estimatedVolumeMl" to stabilized.volumeMl,
          "estimatedHeightMm" to stabilized.heightMm,
          "foodPixelRatio" to estimate.objectPixelRatio,
          "objectPixelRatio" to estimate.objectPixelRatio,
          "planeResidualMm" to estimate.planeResidualMm,
          "estimateConfidence" to stabilized.confidence,
          "stability" to stabilized.stability,
          "sampleWindow" to stabilized.sampleWindow,
          "autofocusEnabled" to autofocusEnabled,
          "distanceOk" to distanceOk,
          "componentTouchesGuide" to (
            estimate.touchesGuide ||
              estimate.multipleObjects ||
              estimate.centerOffset > MAX_CENTER_OFFSET
            ),
          "focalLengthPx" to estimate.focalLengthPx,
          "rawDepthCoverage" to estimate.rawDepthCoverage,
          "multipleObjects" to estimate.multipleObjects,
          "centerOffset" to estimate.centerOffset,
          "baseValid" to baseOk,
          "measurementReady" to ready,
          "centerDepthMm" to center.depthMm,
          "hitDistanceMm" to surfaceDistance.hitDistanceMm,
          "distanceSource" to surfaceDistance.source
        )
      )
    } catch (_: NotYetAvailableException) {
      clearHistory()
      emitStatus("move", "Depth is initializing. Move slowly around the item.")
    } finally {
      rawConfidence?.close()
      rawDepth?.close()
      denseDepth?.close()
    }
  }

  private fun emitGuidance(
    surfaceDistance: SurfaceDistance,
    estimate: VolumeEstimate,
    stabilized: StabilizedEstimate,
    baseOk: Boolean,
    framingOk: Boolean,
    ready: Boolean
  ) {
    val distanceMm = surfaceDistance.distanceMm
    when {
      distanceMm <= 0.0 -> {
        clearHistory()
        emitStatus(
          "surface",
          "Searching for the flat base. Keep one item centered and move slowly so ARCore can lock onto the table."
        )
      }
      distanceMm < MIN_RECOMMENDED_DISTANCE_MM -> {
        clearHistory()
        emitStatus("distance", "Too close. Move back to about 50–75 cm.")
      }
      distanceMm > MAX_RECOMMENDED_DISTANCE_MM -> {
        clearHistory()
        emitStatus("distance", "Too far. Move closer to about 50–75 cm.")
      }
      !baseOk -> {
        clearHistory()
        emitStatus("base", "Base is not flat enough. Use a hard matte table with visible texture around the item.")
      }
      estimate.multipleObjects -> {
        clearHistory()
        emitStatus("multiple", "More than one raised object is inside the guide. Leave only one item.")
      }
      estimate.centerOffset > MAX_CENTER_OFFSET -> {
        clearHistory()
        emitStatus("center", "Center the item on the crosshair with empty base visible around it.")
      }
      estimate.touchesGuide -> {
        clearHistory()
        emitStatus("reframe", "The item reaches the guide edge. Move back slightly and keep it fully inside.")
      }
      !framingOk -> {
        clearHistory()
        emitStatus("reframe", "Keep one item centered with flat base visible around every side.")
      }
      stabilized.sampleWindow < MIN_CAPTURE_FRAMES ->
        emitStatus(
          "tracking",
          "Good geometry. Hold steady while the measurement settles (${stabilized.sampleWindow}/$MIN_CAPTURE_FRAMES)."
        )
      stabilized.stability < MIN_REPORTABLE_STABILITY ->
        emitStatus("tracking", "Hold the phone still. Waiting for the volume to stabilize.")
      ready -> emitStatus("measuring", "Measurement is stable and ready to capture.")
      else -> emitStatus("tracking", "Move slightly side-to-side, then hold still to improve depth confidence.")
    }
  }

  private fun estimateSurfaceDistance(
    frame: Frame,
    estimate: VolumeEstimate,
    center: DepthSample
  ): SurfaceDistance {
    val baseDepth = estimate.baseDepthMm.takeIf {
      it in HARD_MIN_DISTANCE_MM.toDouble()..HARD_MAX_DISTANCE_MM.toDouble() &&
        estimate.planeResidualMm <= MAX_DISTANCE_PLANE_RESIDUAL_MM
    }

    val hit = sampleBasePlaneHitDistance(frame)
    val hitDepth = hit?.distanceMm?.takeIf {
      it in HARD_MIN_DISTANCE_MM.toDouble()..HARD_MAX_DISTANCE_MM.toDouble()
    }

    if (baseDepth != null && hitDepth != null) {
      val disagreement = abs(baseDepth - hitDepth)
      if (disagreement <= MAX_DISTANCE_SOURCE_DISAGREEMENT_MM) {
        val hitWeight = if (hit!!.sampleCount >= 2 && hit.spreadMm <= GOOD_HIT_SPREAD_MM) 0.70 else 0.55
        return SurfaceDistance(
          distanceMm = hitDepth * hitWeight + baseDepth * (1.0 - hitWeight),
          source = "plane+depth",
          hitDistanceMm = hitDepth
        )
      }

      if (hit!!.sampleCount >= 2 && hit.spreadMm <= MAX_HIT_SPREAD_MM) {
        return SurfaceDistance(hitDepth, "plane-hit", hitDepth)
      }

      return SurfaceDistance(baseDepth, "depth-base", hitDepth)
    }

    if (hitDepth != null) {
      return SurfaceDistance(hitDepth, "plane-hit", hitDepth)
    }

    if (baseDepth != null) {
      return SurfaceDistance(baseDepth, "depth-base", 0.0)
    }

    val centerFallback = center.depthMm.toDouble().takeIf {
      center.coverage >= MIN_CENTER_FALLBACK_COVERAGE &&
        it in HARD_MIN_DISTANCE_MM.toDouble()..HARD_MAX_DISTANCE_MM.toDouble()
    }

    return if (centerFallback != null) {
      SurfaceDistance(centerFallback, "center-fallback", 0.0)
    } else {
      SurfaceDistance(0.0, "searching", 0.0)
    }
  }

  private fun sampleBasePlaneHitDistance(frame: Frame): PlaneHitSample? {
    if (surfaceWidth <= 0 || surfaceHeight <= 0) return null

    val centerX = surfaceWidth * HIT_CENTER_X_FRACTION
    val centerY = surfaceHeight * HIT_CENTER_Y_FRACTION
    val dx = surfaceWidth * HIT_RING_X_FRACTION
    val dy = surfaceHeight * HIT_RING_Y_FRACTION

    val points = arrayOf(
      floatArrayOf(centerX - dx, centerY),
      floatArrayOf(centerX + dx, centerY),
      floatArrayOf(centerX, centerY - dy),
      floatArrayOf(centerX, centerY + dy),
      floatArrayOf(centerX - dx * 0.72f, centerY - dy * 0.72f),
      floatArrayOf(centerX + dx * 0.72f, centerY - dy * 0.72f),
      floatArrayOf(centerX - dx * 0.72f, centerY + dy * 0.72f),
      floatArrayOf(centerX + dx * 0.72f, centerY + dy * 0.72f)
    )

    val distances = ArrayList<Double>()
    for (point in points) {
      val hits = try {
        frame.hitTest(point[0], point[1])
      } catch (_: Throwable) {
        emptyList()
      }

      for (hit in hits) {
        val trackable = hit.trackable
        if (
          trackable is Plane &&
          trackable.trackingState == TrackingState.TRACKING &&
          trackable.type == Plane.Type.HORIZONTAL_UPWARD_FACING &&
          trackable.isPoseInPolygon(hit.hitPose)
        ) {
          val mm = hit.distance.toDouble() * 1000.0
          if (mm in HARD_MIN_DISTANCE_MM.toDouble()..HARD_MAX_DISTANCE_MM.toDouble()) {
            distances.add(mm)
          }
          break
        }
      }
    }

    if (distances.isEmpty()) return null
    distances.sort()
    val median = percentileDouble(distances, 0.5)
    val spread = percentileDouble(distances, 0.90) - percentileDouble(distances, 0.10)
    return PlaneHitSample(median, spread, distances.size)
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
          emitStatus("starting", "ARCore resumed. Move slowly around one item on a flat base.")
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
      clearHistory()

      emitStatus(
        "starting",
        if (autofocusEnabled) {
          "ARCore Depth started with autofocus. Put one item on a hard flat surface."
        } else {
          "ARCore Depth started. Keep the item at least 50 cm away if the preview looks soft."
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
    clearHistory()
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
          val mm = readDepthMm(buffer, plane.rowStride, plane.pixelStride, x, y)
          if (mm in MIN_VALID_DEPTH_MM..MAX_VALID_DEPTH_MM) values.add(mm)
        }
        x += 2
      }
      y += 2
    }

    if (values.isEmpty()) return DepthSample(0, 0.0)
    values.sort()
    return DepthSample(
      values[values.size / 2],
      values.size.toDouble() / max(1, attempted).toDouble()
    )
  }

  private fun estimateCentralVolume(
    frame: Frame,
    denseImage: Image,
    rawImage: Image?,
    confidenceImage: Image?
  ): VolumeEstimate {
    val densePlane = denseImage.planes.firstOrNull() ?: return VolumeEstimate.empty()
    if (denseImage.width < 20 || denseImage.height < 20) return VolumeEstimate.empty()

    val denseBuffer = densePlane.buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
    val rawPlane = rawImage?.planes?.firstOrNull()
    val rawBuffer = rawPlane?.buffer?.duplicate()?.order(ByteOrder.LITTLE_ENDIAN)
    val confPlane = confidenceImage?.planes?.firstOrNull()
    val confBuffer = confPlane?.buffer?.duplicate()
    val rawUsable = rawImage != null &&
      confidenceImage != null &&
      rawImage.width == denseImage.width &&
      rawImage.height == denseImage.height &&
      confidenceImage.width == denseImage.width &&
      confidenceImage.height == denseImage.height

    val centerX = denseImage.width / 2
    val centerY = denseImage.height / 2
    val halfWidth = max(12, (denseImage.width * ROI_WIDTH_FRACTION / 2.0).toInt())
    val halfHeight = max(12, (denseImage.height * ROI_HEIGHT_FRACTION / 2.0).toInt())
    val xMin = max(0, centerX - halfWidth)
    val xMax = min(denseImage.width - 1, centerX + halfWidth)
    val yMin = max(0, centerY - halfHeight)
    val yMax = min(denseImage.height - 1, centerY + halfHeight)
    val roiWidth = max(1, xMax - xMin)
    val roiHeight = max(1, yMax - yMin)
    val stride = if (min(denseImage.width, denseImage.height) >= 180) 2 else 1

    val allSamples = ArrayList<DepthPointSample>()
    val borderDense = ArrayList<DepthPointSample>()
    val borderRaw = ArrayList<DepthPointSample>()
    var attempted = 0
    var rawTrusted = 0

    var y = yMin
    while (y <= yMax) {
      var x = xMin
      while (x <= xMax) {
        attempted += 1
        val denseMm = readDepthMm(
          denseBuffer,
          densePlane.rowStride,
          densePlane.pixelStride,
          x,
          y
        )
        if (denseMm in MIN_VALID_DEPTH_MM..MAX_VOLUME_DEPTH_MM) {
          val nx = (x - centerX).toDouble() / denseImage.width.toDouble()
          val ny = (y - centerY).toDouble() / denseImage.height.toDouble()
          val sample = DepthPointSample(x, y, nx, ny, denseMm)
          allSamples.add(sample)

          val xp = (x - xMin).toDouble() / roiWidth.toDouble()
          val yp = (y - yMin).toDouble() / roiHeight.toDouble()
          val isBorder =
            xp < BORDER_FRACTION ||
              xp > 1.0 - BORDER_FRACTION ||
              yp < BORDER_FRACTION ||
              yp > 1.0 - BORDER_FRACTION

          if (isBorder) {
            borderDense.add(sample)
            if (
              rawUsable &&
              rawPlane != null &&
              rawBuffer != null &&
              confPlane != null &&
              confBuffer != null
            ) {
              val confidence = readConfidence(
                confBuffer,
                confPlane.rowStride,
                confPlane.pixelStride,
                x,
                y
              )
              val rawMm = readDepthMm(
                rawBuffer,
                rawPlane.rowStride,
                rawPlane.pixelStride,
                x,
                y
              )
              if (
                confidence >= MIN_RAW_CONFIDENCE &&
                rawMm in MIN_VALID_DEPTH_MM..MAX_VOLUME_DEPTH_MM
              ) {
                borderRaw.add(DepthPointSample(x, y, nx, ny, rawMm))
                rawTrusted += 1
              }
            }
          }
        }
        x += stride
      }
      y += stride
    }

    val coverage = allSamples.size.toDouble() / max(1, attempted).toDouble()
    if (allSamples.size < MIN_TOTAL_SAMPLES || borderDense.size < MIN_BORDER_SAMPLES) {
      return VolumeEstimate.empty(coverage)
    }

    val planeSource = if (borderRaw.size >= MIN_RAW_BORDER_SAMPLES) borderRaw else borderDense
    val planeFit = robustPlaneFit(planeSource) ?: return VolumeEstimate.empty(coverage)

    val focal = depthFocalLengths(frame, denseImage.width, denseImage.height)
    if (focal.first <= 1.0 || focal.second <= 1.0) return VolumeEstimate.empty(coverage)

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
      if (
        sample.x !in innerLeft..innerRight ||
        sample.y !in innerTop..innerBottom
      ) continue

      innerValid += 1
      val baseDepth = planeFit.predict(sample.nx, sample.ny)
      val heightMm = baseDepth - sample.depthMm.toDouble()
      if (heightMm < MIN_OBJECT_HEIGHT_MM || heightMm > MAX_OBJECT_HEIGHT_MM) continue

      val col = (sample.x - xMin) / stride
      val row = (sample.y - yMin) / stride
      if (col !in 0 until cols || row !in 0 until rows) continue

      val index = row * cols + col
      heights[index] = heightMm
      depths[index] = sample.depthMm
    }

    if (innerValid == 0) return VolumeEstimate.emptyWithPlane(coverage, planeFit)

    val components = findComponents(heights, cols, rows)
      .filter { it.indices.size >= MIN_OBJECT_SAMPLES }
      .sortedByDescending { it.indices.size }

    if (components.isEmpty()) return VolumeEstimate.emptyWithPlane(coverage, planeFit)

    val centerCol = ((centerX - xMin) / stride).coerceIn(0, cols - 1)
    val centerRow = ((centerY - yMin) / stride).coerceIn(0, rows - 1)

    val selected = components.minByOrNull { component ->
      val dx = component.centroidCol - centerCol.toDouble()
      val dy = component.centroidRow - centerRow.toDouble()
      dx * dx + dy * dy
    } ?: components.first()

    val significantThreshold = max(
      MIN_OBJECT_SAMPLES,
      (selected.indices.size * SECOND_OBJECT_RATIO).toInt()
    )
    val multipleObjects = components.count { it.indices.size >= significantThreshold } > 1

    val centerDx = (selected.centroidCol - centerCol.toDouble()) / max(1.0, cols / 2.0)
    val centerDy = (selected.centroidRow - centerRow.toDouble()) / max(1.0, rows / 2.0)
    val centerOffset = sqrt(centerDx * centerDx + centerDy * centerDy)

    var volumeMm3 = 0.0
    var touchesGuide = false
    val componentHeights = ArrayList<Int>()

    for (index in selected.indices) {
      val row = index / cols
      val col = index % cols
      val x = xMin + col * stride
      val yy = yMin + row * stride
      val heightMm = heights[index]
      val zMm = depths[index].toDouble()
      if (zMm <= 0.0 || heightMm.isNaN()) continue

      val areaMm2 =
        (zMm * zMm / (focal.first * focal.second)) *
          stride.toDouble() *
          stride.toDouble()
      volumeMm3 += heightMm * areaMm2
      componentHeights.add(heightMm.toInt())

      if (
        x <= innerLeft + stride ||
        x >= innerRight - stride ||
        yy <= innerTop + stride ||
        yy >= innerBottom - stride
      ) {
        touchesGuide = true
      }
    }

    if (componentHeights.isEmpty()) return VolumeEstimate.emptyWithPlane(coverage, planeFit)
    componentHeights.sort()

    val volumeMl = volumeMm3 / 1000.0
    val heightMm = percentileInt(componentHeights, 0.90).toDouble()
    val objectRatio = selected.indices.size.toDouble() / innerValid.toDouble()
    val planeQuality =
      (1.0 - planeFit.residualMm / MAX_GOOD_PLANE_RESIDUAL_MM).coerceIn(0.0, 1.0)
    val componentQuality = when {
      objectRatio in 0.035..0.62 -> 1.0
      objectRatio in 0.015..0.75 -> 0.65
      else -> 0.25
    }
    val framingQuality = when {
      multipleObjects -> 0.10
      touchesGuide -> 0.35
      centerOffset > MAX_CENTER_OFFSET -> 0.35
      else -> 1.0
    }
    val rawCoverage =
      if (borderDense.isEmpty()) 0.0
      else rawTrusted.toDouble() / borderDense.size.toDouble()
    val rawBonus = if (borderRaw.size >= MIN_RAW_BORDER_SAMPLES) 1.0 else 0.72

    var confidence = (
      coverage.coerceIn(0.0, 1.0) * 0.18 +
        planeQuality * 0.38 +
        componentQuality * 0.22 +
        framingQuality * 0.14 +
        rawBonus * 0.08
      ).coerceIn(0.0, 1.0)

    if (planeFit.residualMm > MAX_CAPTURE_PLANE_RESIDUAL_MM) confidence *= 0.35
    if (multipleObjects) confidence *= 0.30
    if (
      volumeMl < MIN_REPORTABLE_VOLUME_ML ||
      volumeMl > MAX_REASONABLE_VOLUME_ML
    ) confidence *= 0.45

    return VolumeEstimate(
      coverage = coverage,
      baseDepthMm = planeFit.predict(0.0, 0.0),
      volumeMl = volumeMl.coerceIn(0.0, MAX_REASONABLE_VOLUME_ML * 1.5),
      heightMm = heightMm,
      objectPixelRatio = objectRatio,
      planeResidualMm = planeFit.residualMm,
      confidence = confidence,
      touchesGuide = touchesGuide,
      focalLengthPx = (focal.first + focal.second) / 2.0,
      multipleObjects = multipleObjects,
      centerOffset = centerOffset,
      rawDepthCoverage = rawCoverage
    )
  }

  private fun robustPlaneFit(samples: List<DepthPointSample>): DepthPlaneFit? {
    if (samples.size < MIN_BORDER_SAMPLES) return null

    val depths = samples.map { it.depthMm }.sorted()
    val median = percentileInt(depths, 0.5)
    var inliers = samples.filter { abs(it.depthMm - median) <= MAX_BORDER_OUTLIER_MM }
    if (inliers.size < MIN_BORDER_SAMPLES) return null

    var fit = fitDepthPlane(inliers) ?: return null
    repeat(3) {
      val residuals = inliers
        .map { abs(fit.predict(it.nx, it.ny) - it.depthMm.toDouble()) }
        .sorted()
      val medianResidual = percentileDouble(residuals, 0.5)
      val threshold = max(
        MIN_PLANE_INLIER_THRESHOLD_MM,
        min(MAX_PLANE_INLIER_THRESHOLD_MM, medianResidual * 2.35)
      )
      val refined = inliers.filter {
        abs(fit.predict(it.nx, it.ny) - it.depthMm.toDouble()) <= threshold
      }
      if (refined.size >= MIN_BORDER_SAMPLES) {
        inliers = refined
        fit = fitDepthPlane(inliers) ?: fit
      }
    }

    return fit
  }

  private fun findComponents(
    heights: DoubleArray,
    cols: Int,
    rows: Int
  ): List<Component> {
    val visited = BooleanArray(heights.size)
    val components = ArrayList<Component>()
    val queue = ArrayDeque<Int>()

    for (start in heights.indices) {
      if (visited[start] || heights[start].isNaN()) continue
      visited[start] = true
      queue.clear()
      queue.add(start)

      val indices = ArrayList<Int>()
      var sumCol = 0.0
      var sumRow = 0.0

      while (queue.isNotEmpty()) {
        val index = queue.removeFirst()
        if (heights[index].isNaN()) continue
        indices.add(index)

        val row = index / cols
        val col = index % cols
        sumCol += col
        sumRow += row

        for (dy in -1..1) {
          for (dx in -1..1) {
            if (dx == 0 && dy == 0) continue
            val nr = row + dy
            val nc = col + dx
            if (nr !in 0 until rows || nc !in 0 until cols) continue
            val neighbor = nr * cols + nc
            if (!visited[neighbor] && !heights[neighbor].isNaN()) {
              visited[neighbor] = true
              queue.add(neighbor)
            }
          }
        }
      }

      if (indices.isNotEmpty()) {
        components.add(
          Component(
            indices = indices,
            centroidCol = sumCol / indices.size.toDouble(),
            centroidRow = sumRow / indices.size.toDouble()
          )
        )
      }
    }

    return components
  }

  private fun depthFocalLengths(
    frame: Frame,
    depthWidth: Int,
    depthHeight: Int
  ): Pair<Double, Double> {
    return try {
      val intrinsics = frame.camera.imageIntrinsics
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

  private fun stabilize(
    raw: VolumeEstimate,
    geometryOk: Boolean,
    freshDepth: Boolean
  ): StabilizedEstimate {
    if (!geometryOk || raw.confidence < MIN_HISTORY_CONFIDENCE) {
      clearHistory()
      return StabilizedEstimate(raw.volumeMl, raw.heightMm, raw.confidence, 0.0, 0)
    }

    if (freshDepth) {
      val currentMedian =
        if (history.isEmpty()) 0.0
        else percentileDouble(history.map { it.volumeMl }.sorted(), 0.5)
      val currentBase =
        if (history.isEmpty()) raw.baseDepthMm
        else percentileDouble(history.map { it.baseDepthMm }.sorted(), 0.5)

      if (
        history.size >= 3 &&
        (
          (currentMedian > 1.0 &&
            abs(raw.volumeMl - currentMedian) / currentMedian > HISTORY_RESET_VOLUME_JUMP) ||
            abs(raw.baseDepthMm - currentBase) > HISTORY_RESET_BASE_JUMP_MM
          )
      ) {
        clearHistory()
      }

      history.addLast(
        HistorySample(
          raw.volumeMl,
          raw.heightMm,
          raw.baseDepthMm,
          raw.confidence
        )
      )
      while (history.size > STABILITY_WINDOW) history.removeFirst()
    }

    if (history.isEmpty()) {
      return StabilizedEstimate(raw.volumeMl, raw.heightMm, raw.confidence, 0.0, 0)
    }

    val volumes = history.map { it.volumeMl }.sorted()
    val heights = history.map { it.heightMm }.sorted()
    val medianVolume = percentileDouble(volumes, 0.5)
    val medianHeight = percentileDouble(heights, 0.5)
    val deviations = volumes.map { abs(it - medianVolume) }.sorted()
    val mad = percentileDouble(deviations, 0.5)
    val relativeMad = if (medianVolume <= 1.0) 1.0 else mad / medianVolume
    val stability = when {
      history.size < 3 -> 0.20
      history.size < MIN_CAPTURE_FRAMES ->
        (1.0 - relativeMad * 6.0).coerceIn(0.0, 0.78)
      else ->
        (1.0 - relativeMad * 5.2).coerceIn(0.0, 1.0)
    }

    val medianConfidence =
      percentileDouble(history.map { it.confidence }.sorted(), 0.5)
    val stabilizedConfidence =
      (medianConfidence * (0.72 + 0.28 * stability)).coerceIn(0.0, 1.0)

    return StabilizedEstimate(
      medianVolume,
      medianHeight,
      stabilizedConfidence,
      stability,
      history.size
    )
  }

  private fun clearHistory() = history.clear()

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

    for (s in samples) {
      sumX += s.nx
      sumY += s.ny
      sumZ += s.depthMm
      sumXX += s.nx * s.nx
      sumYY += s.ny * s.ny
      sumXY += s.nx * s.ny
      sumXZ += s.nx * s.depthMm
      sumYZ += s.ny * s.depthMm
    }

    val matrix = arrayOf(
      doubleArrayOf(sumXX, sumXY, sumX, sumXZ),
      doubleArrayOf(sumXY, sumYY, sumY, sumYZ),
      doubleArrayOf(sumX, sumY, samples.size.toDouble(), sumZ)
    )

    val solution = solveThreeByThree(matrix) ?: return null
    val fit = DepthPlaneFit(solution[0], solution[1], solution[2], 0.0)

    var squared = 0.0
    for (s in samples) {
      val error = fit.predict(s.nx, s.ny) - s.depthMm.toDouble()
      squared += error * error
    }

    return fit.copy(residualMm = sqrt(squared / samples.size.toDouble()))
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
    buffer: ByteBuffer,
    rowStride: Int,
    pixelStride: Int,
    x: Int,
    y: Int
  ): Int {
    val index = y * rowStride + x * pixelStride
    if (index < 0 || index + 1 >= buffer.limit()) return 0
    val low = buffer.get(index).toInt() and 0xFF
    val high = buffer.get(index + 1).toInt() and 0xFF
    return (high shl 8) or low
  }

  private fun readConfidence(
    buffer: ByteBuffer,
    rowStride: Int,
    pixelStride: Int,
    x: Int,
    y: Int
  ): Int {
    val index = y * rowStride + x * pixelStride
    if (index < 0 || index >= buffer.limit()) return 0
    return buffer.get(index).toInt() and 0xFF
  }

  private fun percentileInt(sorted: List<Int>, percentile: Double): Int {
    if (sorted.isEmpty()) return 0
    val index =
      ((sorted.size - 1) * percentile.coerceIn(0.0, 1.0)).toInt()
    return sorted[index]
  }

  private fun percentileDouble(sorted: List<Double>, percentile: Double): Double {
    if (sorted.isEmpty()) return 0.0
    val index =
      ((sorted.size - 1) * percentile.coerceIn(0.0, 1.0)).toInt()
    return sorted[index]
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

  private data class SurfaceDistance(
    val distanceMm: Double,
    val source: String,
    val hitDistanceMm: Double
  )

  private data class PlaneHitSample(
    val distanceMm: Double,
    val spreadMm: Double,
    val sampleCount: Int
  )

  private data class DepthPointSample(
    val x: Int,
    val y: Int,
    val nx: Double,
    val ny: Double,
    val depthMm: Int
  )

  private data class Component(
    val indices: List<Int>,
    val centroidCol: Double,
    val centroidRow: Double
  )

  private data class HistorySample(
    val volumeMl: Double,
    val heightMm: Double,
    val baseDepthMm: Double,
    val confidence: Double
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
    val baseDepthMm: Double,
    val volumeMl: Double,
    val heightMm: Double,
    val objectPixelRatio: Double,
    val planeResidualMm: Double,
    val confidence: Double,
    val touchesGuide: Boolean,
    val focalLengthPx: Double,
    val multipleObjects: Boolean,
    val centerOffset: Double,
    val rawDepthCoverage: Double
  ) {
    companion object {
      fun empty(coverage: Double = 0.0) = VolumeEstimate(
        coverage = coverage,
        baseDepthMm = 0.0,
        volumeMl = 0.0,
        heightMm = 0.0,
        objectPixelRatio = 0.0,
        planeResidualMm = 999.0,
        confidence = 0.0,
        touchesGuide = false,
        focalLengthPx = 0.0,
        multipleObjects = false,
        centerOffset = 1.0,
        rawDepthCoverage = 0.0
      )

      fun emptyWithPlane(
        coverage: Double,
        fit: DepthPlaneFit
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
        multipleObjects = false,
        centerOffset = 1.0,
        rawDepthCoverage = 0.0
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
    private const val DEPTH_EVENT_INTERVAL_MS = 220L

    private const val MIN_VALID_DEPTH_MM = 180
    private const val MAX_VALID_DEPTH_MM = 5000
    private const val MAX_VOLUME_DEPTH_MM = 1800
    private const val HARD_MIN_DISTANCE_MM = 200
    private const val HARD_MAX_DISTANCE_MM = 1500

    private const val MIN_RECOMMENDED_DISTANCE_MM = 450
    private const val MAX_RECOMMENDED_DISTANCE_MM = 900

    private const val HIT_CENTER_X_FRACTION = 0.50f
    private const val HIT_CENTER_Y_FRACTION = 0.39f
    private const val HIT_RING_X_FRACTION = 0.18f
    private const val HIT_RING_Y_FRACTION = 0.10f
    private const val MAX_DISTANCE_SOURCE_DISAGREEMENT_MM = 180.0
    private const val GOOD_HIT_SPREAD_MM = 90.0
    private const val MAX_HIT_SPREAD_MM = 180.0
    private const val MIN_CENTER_FALLBACK_COVERAGE = 0.55
    private const val MAX_DISTANCE_PLANE_RESIDUAL_MM = 28.0

    private const val ROI_WIDTH_FRACTION = 0.64
    private const val ROI_HEIGHT_FRACTION = 0.52
    private const val BORDER_FRACTION = 0.18

    private const val MIN_TOTAL_SAMPLES = 90
    private const val MIN_BORDER_SAMPLES = 30
    private const val MIN_RAW_BORDER_SAMPLES = 18
    private const val MIN_RAW_CONFIDENCE = 128
    private const val MIN_OBJECT_SAMPLES = 8
    private const val MAX_BORDER_OUTLIER_MM = 75
    private const val MIN_PLANE_INLIER_THRESHOLD_MM = 8.0
    private const val MAX_PLANE_INLIER_THRESHOLD_MM = 24.0
    private const val MAX_GOOD_PLANE_RESIDUAL_MM = 16.0
    private const val MAX_CAPTURE_PLANE_RESIDUAL_MM = 12.0

    private const val MIN_OBJECT_HEIGHT_MM = 8.0
    private const val MAX_OBJECT_HEIGHT_MM = 750.0
    private const val MIN_REPORTABLE_VOLUME_ML = 5.0
    private const val MAX_REASONABLE_VOLUME_ML = 5000.0
    private const val SECOND_OBJECT_RATIO = 0.28
    private const val MAX_CENTER_OFFSET = 0.34

    private const val MIN_HISTORY_CONFIDENCE = 0.42
    private const val MIN_REPORTABLE_CONFIDENCE = 0.54
    private const val MIN_REPORTABLE_STABILITY = 0.62
    private const val MIN_CAPTURE_FRAMES = 6
    private const val STABILITY_WINDOW = 9
    private const val HISTORY_RESET_VOLUME_JUMP = 0.45
    private const val HISTORY_RESET_BASE_JUMP_MM = 45.0
  }
}
