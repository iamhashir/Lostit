from pathlib import Path


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing patch marker: {label}")
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    a = text.find(start)
    if a < 0:
        raise SystemExit(f"Missing start marker: {label}")
    b = text.find(end, a)
    if b < 0:
        raise SystemExit(f"Missing end marker: {label}")
    return text[:a] + replacement + text[b:]

# Native scanner: real adjustable ROI + sampling hysteresis.
native = Path('modules/portion-scanner/android/src/main/java/expo/modules/portionscanner/PortionDepthView.kt')
s = native.read_text()
s = replace_required(
    s,
    '  private var autofocusEnabled = false\n  private val history = ArrayDeque<HistorySample>()\n',
    '  private var autofocusEnabled = false\n  @Volatile private var roiWidthFraction = ROI_WIDTH_FRACTION\n  @Volatile private var roiHeightFraction = ROI_HEIGHT_FRACTION\n  private var invalidFrameStreak = 0\n  private val history = ArrayDeque<HistorySample>()\n',
    'native ROI state',
)
s = replace_required(
    s,
    '  private fun currentDisplayRotation(): Int = display?.rotation ?: Surface.ROTATION_0\n',
    '''  fun setRoiWidthFraction(value: Double) {
    val next = value.coerceIn(MIN_ROI_WIDTH_FRACTION, MAX_ROI_WIDTH_FRACTION)
    if (abs(next - roiWidthFraction) < 0.002) return
    roiWidthFraction = next
    invalidFrameStreak = 0
    clearHistory()
  }

  fun setRoiHeightFraction(value: Double) {
    val next = value.coerceIn(MIN_ROI_HEIGHT_FRACTION, MAX_ROI_HEIGHT_FRACTION)
    if (abs(next - roiHeightFraction) < 0.002) return
    roiHeightFraction = next
    invalidFrameStreak = 0
    clearHistory()
  }

  private fun currentDisplayRotation(): Int = display?.rotation ?: Surface.ROTATION_0
''',
    'native ROI setters',
)
# Make the displayed guide, depth ROI and AR plane hit use one vertical center.
s = s.replace('val centerY = image.height / 2', 'val centerY = (image.height * ROI_CENTER_Y_FRACTION).roundToInt().coerceIn(0, image.height - 1)', 1)
s = s.replace('val centerY = denseImage.height / 2', 'val centerY = (denseImage.height * ROI_CENTER_Y_FRACTION).roundToInt().coerceIn(0, denseImage.height - 1)', 1)
s = replace_required(s, '(denseImage.width * ROI_WIDTH_FRACTION / 2.0).toInt()', '(denseImage.width * roiWidthFraction / 2.0).toInt()', 'dynamic ROI width')
s = replace_required(s, '(denseImage.height * ROI_HEIGHT_FRACTION / 2.0).toInt()', '(denseImage.height * roiHeightFraction / 2.0).toInt()', 'dynamic ROI height')
s = replace_required(s, 'val centerY = surfaceHeight * HIT_CENTER_Y_FRACTION', 'val centerY = surfaceHeight * ROI_CENTER_Y_FRACTION.toFloat()', 'hit-test ROI center')
# A bad frame should pause sampling, not erase good samples immediately.
emit_start = '  private fun emitGuidance(\n'
emit_end = '  private fun estimateSurfaceDistance(\n'
a = s.find(emit_start)
b = s.find(emit_end, a)
if a < 0 or b < 0:
    raise SystemExit('Missing emitGuidance block')
emit_block = s[a:b].replace('        clearHistory()\n', '')
s = s[:a] + emit_block + s[b:]

new_stabilize = '''  private fun stabilize(
    raw: VolumeEstimate,
    geometryOk: Boolean,
    freshDepth: Boolean
  ): StabilizedEstimate {
    if (!geometryOk || raw.confidence < MIN_HISTORY_CONFIDENCE) {
      invalidFrameStreak += 1
      if (invalidFrameStreak >= MAX_INVALID_FRAME_STREAK) {
        history.clear()
      }
      return summarizeHistory(raw, paused = true)
    }

    invalidFrameStreak = 0

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
        history.clear()
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

    return summarizeHistory(raw, paused = false)
  }

  private fun summarizeHistory(
    fallback: VolumeEstimate,
    paused: Boolean
  ): StabilizedEstimate {
    if (history.isEmpty()) {
      return StabilizedEstimate(
        fallback.volumeMl,
        fallback.heightMm,
        fallback.confidence,
        0.0,
        0
      )
    }

    val volumes = history.map { it.volumeMl }.sorted()
    val heights = history.map { it.heightMm }.sorted()
    val medianVolume = percentileDouble(volumes, 0.5)
    val medianHeight = percentileDouble(heights, 0.5)
    val deviations = volumes.map { abs(it - medianVolume) }.sorted()
    val mad = percentileDouble(deviations, 0.5)
    val relativeMad = if (medianVolume <= 1.0) 1.0 else mad / medianVolume
    var stability = when {
      history.size < 3 -> 0.20
      history.size < MIN_CAPTURE_FRAMES ->
        (1.0 - relativeMad * 6.0).coerceIn(0.0, 0.78)
      else ->
        (1.0 - relativeMad * 5.2).coerceIn(0.0, 1.0)
    }
    if (paused) stability *= 0.82

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

'''
s = replace_between(s, '  private fun stabilize(\n', '  private fun clearHistory()', new_stabilize, 'stabilizer')
s = replace_required(
    s,
    '    private const val HIT_CENTER_Y_FRACTION = 0.39f\n',
    '',
    'old hit center constant',
)
s = replace_required(
    s,
    '    private const val ROI_WIDTH_FRACTION = 0.64\n    private const val ROI_HEIGHT_FRACTION = 0.52\n',
    '''    private const val ROI_CENTER_Y_FRACTION = 0.45
    private const val ROI_WIDTH_FRACTION = 0.64
    private const val ROI_HEIGHT_FRACTION = 0.30
    private const val MIN_ROI_WIDTH_FRACTION = 0.28
    private const val MAX_ROI_WIDTH_FRACTION = 0.82
    private const val MIN_ROI_HEIGHT_FRACTION = 0.18
    private const val MAX_ROI_HEIGHT_FRACTION = 0.55
''',
    'ROI constants',
)
s = replace_required(
    s,
    '    private const val HISTORY_RESET_BASE_JUMP_MM = 45.0\n',
    '    private const val HISTORY_RESET_BASE_JUMP_MM = 45.0\n    private const val MAX_INVALID_FRAME_STREAK = 3\n',
    'sampling grace constant',
)
native.write_text(s)

# Expo native view props.
module = Path('modules/portion-scanner/android/src/main/java/expo/modules/portionscanner/PortionScannerModule.kt')
s = module.read_text()
s = replace_required(
    s,
    '    View(PortionDepthView::class) {\n      Events("onDepthUpdate", "onScannerStatus")\n',
    '''    View(PortionDepthView::class) {
      Events("onDepthUpdate", "onScannerStatus")
      Prop("roiWidthFraction") { view: PortionDepthView, value: Double ->
        view.setRoiWidthFraction(value)
      }
      Prop("roiHeightFraction") { view: PortionDepthView, value: Double ->
        view.setRoiHeightFraction(value)
      }
''',
    'native view ROI props',
)
module.write_text(s)

# TypeScript bridge props.
ts = Path('modules/portion-scanner/src/PortionScanner.ts')
s = ts.read_text()
s = replace_required(
    s,
    'export type PortionDepthViewProps = ViewProps & {\n',
    'export type PortionDepthViewProps = ViewProps & {\n  roiWidthFraction?: number;\n  roiHeightFraction?: number;\n',
    'TS ROI props',
)
ts.write_text(s)

# Scanner UI: draggable corner resizes the same native ROI that is sampled.
ui = Path('src/PortionScannerEntry.tsx')
s = ui.read_text()
s = replace_required(s, "import React, { useMemo, useState } from 'react';", "import React, { useMemo, useRef, useState } from 'react';", 'React useRef')
s = replace_required(s, '  Pressable,\n  StatusBar,', '  PanResponder,\n  Pressable,\n  StatusBar,', 'PanResponder import')
s = replace_required(
    s,
    'const MIN_CONFIDENCE = 0.54;\n',
    '''const MIN_CONFIDENCE = 0.54;
const ROI_CENTER_Y = 0.45;
const DEFAULT_ROI_WIDTH = 0.64;
const DEFAULT_ROI_HEIGHT = 0.30;
const MIN_ROI_WIDTH = 0.28;
const MAX_ROI_WIDTH = 0.82;
const MIN_ROI_HEIGHT = 0.18;
const MAX_ROI_HEIGHT = 0.55;
''',
    'ROI UI constants',
)
s = replace_required(
    s,
    '  const [capturedReading, setCapturedReading] = useState<PortionDepthReading | null>(null);\n',
    '''  const [capturedReading, setCapturedReading] = useState<PortionDepthReading | null>(null);
  const [roiWidth, setRoiWidth] = useState(DEFAULT_ROI_WIDTH);
  const [roiHeight, setRoiHeight] = useState(DEFAULT_ROI_HEIGHT);
  const roiStart = useRef({ width: DEFAULT_ROI_WIDTH, height: DEFAULT_ROI_HEIGHT });
  const resizePan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      roiStart.current = { width: roiWidth, height: roiHeight };
      setCapturedReading(null);
    },
    onPanResponderMove: (_, gesture) => {
      const nextWidth = Math.max(MIN_ROI_WIDTH, Math.min(MAX_ROI_WIDTH, roiStart.current.width + gesture.dx / 390));
      const nextHeight = Math.max(MIN_ROI_HEIGHT, Math.min(MAX_ROI_HEIGHT, roiStart.current.height + gesture.dy / 780));
      setRoiWidth(nextWidth);
      setRoiHeight(nextHeight);
    }
  }), [roiHeight, roiWidth]);
''',
    'ROI UI state',
)
s = replace_required(
    s,
    '          <PortionDepthView\n            style={StyleSheet.absoluteFill}\n',
    '          <PortionDepthView\n            style={StyleSheet.absoluteFill}\n            roiWidthFraction={roiWidth}\n            roiHeightFraction={roiHeight}\n',
    'native ROI values',
)
s = replace_required(
    s,
    '            <View pointerEvents="none" style={styles.reticleWrap}>\n              <View style={[\n                styles.scanGuide,\n                reading?.componentTouchesGuide && styles.scanGuideWarning\n              ]}>',
    '''            <View
              pointerEvents="box-none"
              style={[
                styles.reticleWrap,
                { top: `${Math.max(6, (ROI_CENTER_Y - roiHeight / 2) * 100)}%` }
              ]}
            >
              <View style={[
                styles.scanGuide,
                { width: `${Math.round(roiWidth * 100)}%`, aspectRatio: roiWidth / roiHeight },
                reading?.componentTouchesGuide && styles.scanGuideWarning
              ]}>''',
    'adjustable guide',
)
s = replace_required(
    s,
    '                <Crosshair size={31} color="#58E6B1" strokeWidth={1.7} />\n              </View>\n              <Text style={styles.reticleLabel}>{guideLabel}</Text>',
    '''                <Crosshair size={31} color="#58E6B1" strokeWidth={1.7} />
                <View
                  accessibilityLabel="Resize measurement frame"
                  accessibilityRole="adjustable"
                  {...resizePan.panHandlers}
                  style={styles.resizeHandle}
                >
                  <View style={styles.resizeHandleDot} />
                </View>
              </View>
              <Text style={styles.reticleLabel}>{guideLabel}</Text>
              <Text style={styles.resizeHint}>Drag the green corner handle until only the target sits inside the frame.</Text>''',
    'resize handle',
)
s = replace_required(
    s,
    "  reticleWrap: { position: 'absolute', top: '30%', alignSelf: 'center', alignItems: 'center' },\n  scanGuide: { width: 230, height: 190, alignItems: 'center', justifyContent: 'center' },\n  scanGuideWarning: { opacity: 0.58 },\n",
    '''  reticleWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  scanGuide: { alignItems: 'center', justifyContent: 'center' },
  scanGuideWarning: { opacity: 0.58 },
  resizeHandle: {
    position: 'absolute',
    right: -19,
    bottom: -19,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center'
  },
  resizeHandleDot: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: '#58E6B1',
    borderWidth: 3,
    borderColor: '#07110E'
  },
  resizeHint: {
    color: '#C3CFCC',
    fontSize: 9.5,
    fontWeight: '700',
    lineHeight: 13,
    marginTop: 6,
    maxWidth: 285,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7
  },
''',
    'resize styles',
)
ui.write_text(s)
