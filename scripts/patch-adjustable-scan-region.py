from pathlib import Path


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing patch marker: {label}")
    return text.replace(old, new, 1)

native = Path('modules/portion-scanner/android/src/main/java/expo/modules/portionscanner/PortionDepthView.kt')
s = native.read_text()
s = replace_required(s, '  private var autofocusEnabled = false\n  private val history', '  private var autofocusEnabled = false\n  @Volatile private var roiWidthFraction = ROI_WIDTH_FRACTION\n  @Volatile private var roiHeightFraction = ROI_HEIGHT_FRACTION\n  private val history', 'native ROI state')
s = replace_required(s, '  private fun currentDisplayRotation(): Int = display?.rotation ?: Surface.ROTATION_0\n', '  fun setRoiWidthFraction(value: Double) {\n    roiWidthFraction = value.coerceIn(MIN_ROI_WIDTH_FRACTION, MAX_ROI_WIDTH_FRACTION)\n    clearHistory()\n  }\n\n  fun setRoiHeightFraction(value: Double) {\n    roiHeightFraction = value.coerceIn(MIN_ROI_HEIGHT_FRACTION, MAX_ROI_HEIGHT_FRACTION)\n    clearHistory()\n  }\n\n  private fun currentDisplayRotation(): Int = display?.rotation ?: Surface.ROTATION_0\n', 'native setters')
s = s.replace('(denseImage.width * ROI_WIDTH_FRACTION / 2.0).toInt()', '(denseImage.width * roiWidthFraction / 2.0).toInt()')
s = s.replace('(denseImage.height * ROI_HEIGHT_FRACTION / 2.0).toInt()', '(denseImage.height * roiHeightFraction / 2.0).toInt()')
s = replace_required(s, '    private const val ROI_HEIGHT_FRACTION = 0.52\n', '    private const val ROI_HEIGHT_FRACTION = 0.52\n    private const val MIN_ROI_WIDTH_FRACTION = 0.28\n    private const val MAX_ROI_WIDTH_FRACTION = 0.82\n    private const val MIN_ROI_HEIGHT_FRACTION = 0.24\n    private const val MAX_ROI_HEIGHT_FRACTION = 0.72\n', 'native ROI bounds')
native.write_text(s)

module = Path('modules/portion-scanner/android/src/main/java/expo/modules/portionscanner/PortionScannerModule.kt')
s = module.read_text()
s = replace_required(s, '    View(PortionDepthView::class) {\n      Events("onDepthUpdate", "onScannerStatus")\n', '    View(PortionDepthView::class) {\n      Events("onDepthUpdate", "onScannerStatus")\n      Prop("roiWidthFraction") { view: PortionDepthView, value: Double ->\n        view.setRoiWidthFraction(value)\n      }\n      Prop("roiHeightFraction") { view: PortionDepthView, value: Double ->\n        view.setRoiHeightFraction(value)\n      }\n', 'native view props')
module.write_text(s)

ts = Path('modules/portion-scanner/src/PortionScanner.ts')
s = ts.read_text()
s = replace_required(s, 'export type PortionDepthViewProps = ViewProps & {\n', 'export type PortionDepthViewProps = ViewProps & {\n  roiWidthFraction?: number;\n  roiHeightFraction?: number;\n', 'TS ROI props')
ts.write_text(s)

ui = Path('src/PortionScannerEntry.tsx')
s = ui.read_text()
s = replace_required(s, "import React, { useMemo, useState } from 'react';", "import React, { useMemo, useRef, useState } from 'react';", 'React useRef')
s = replace_required(s, '  Pressable,\n  StatusBar,', '  Pressable,\n  PanResponder,\n  StatusBar,', 'PanResponder import')
s = replace_required(s, 'const MIN_CONFIDENCE = 0.54;\n', 'const MIN_CONFIDENCE = 0.54;\nconst DEFAULT_ROI_WIDTH = 0.64;\nconst DEFAULT_ROI_HEIGHT = 0.52;\nconst MIN_ROI_WIDTH = 0.28;\nconst MAX_ROI_WIDTH = 0.82;\nconst MIN_ROI_HEIGHT = 0.24;\nconst MAX_ROI_HEIGHT = 0.72;\n', 'ROI constants')
s = replace_required(s, '  const [capturedReading, setCapturedReading] = useState<PortionDepthReading | null>(null);\n', '  const [capturedReading, setCapturedReading] = useState<PortionDepthReading | null>(null);\n  const [roiWidth, setRoiWidth] = useState(DEFAULT_ROI_WIDTH);\n  const [roiHeight, setRoiHeight] = useState(DEFAULT_ROI_HEIGHT);\n  const roiStart = useRef({ width: DEFAULT_ROI_WIDTH, height: DEFAULT_ROI_HEIGHT });\n  const resizePan = useMemo(() => PanResponder.create({\n    onStartShouldSetPanResponder: () => true,\n    onMoveShouldSetPanResponder: () => true,\n    onPanResponderGrant: () => {\n      roiStart.current = { width: roiWidth, height: roiHeight };\n    },\n    onPanResponderMove: (_, gesture) => {\n      const nextWidth = Math.max(MIN_ROI_WIDTH, Math.min(MAX_ROI_WIDTH, roiStart.current.width + gesture.dx / 430));\n      const nextHeight = Math.max(MIN_ROI_HEIGHT, Math.min(MAX_ROI_HEIGHT, roiStart.current.height + gesture.dy / 700));\n      setRoiWidth(nextWidth);\n      setRoiHeight(nextHeight);\n      setCapturedReading(null);\n    }\n  }), [roiHeight, roiWidth]);\n', 'ROI state')
s = replace_required(s, '          <PortionDepthView\n            style={StyleSheet.absoluteFill}\n', '          <PortionDepthView\n            style={StyleSheet.absoluteFill}\n            roiWidthFraction={roiWidth}\n            roiHeightFraction={roiHeight}\n', 'ROI native props')
s = replace_required(s, '            <View pointerEvents="none" style={styles.reticleWrap}>\n              <View style={[\n                styles.scanGuide,\n                reading?.componentTouchesGuide && styles.scanGuideWarning\n              ]}>', '            <View pointerEvents="box-none" style={styles.reticleWrap}>\n              <View style={[\n                styles.scanGuide,\n                { width: `${Math.round(roiWidth * 100)}%`, height: `${Math.round(roiHeight * 100)}%` },\n                reading?.componentTouchesGuide && styles.scanGuideWarning\n              ]}>', 'adjustable guide')
s = replace_required(s, '                <Crosshair size={31} color="#58E6B1" strokeWidth={1.7} />\n              </View>\n              <Text style={styles.reticleLabel}>{guideLabel}</Text>', '                <Crosshair size={31} color="#58E6B1" strokeWidth={1.7} />\n                <View\n                  accessibilityLabel="Resize measurement frame"\n                  accessibilityRole="adjustable"\n                  {...resizePan.panHandlers}\n                  style={styles.resizeHandle}\n                >\n                  <View style={styles.resizeHandleDot} />\n                </View>\n              </View>\n              <Text style={styles.reticleLabel}>{guideLabel}</Text>\n              <Text style={styles.resizeHint}>Drag the bottom-right handle to wrap the frame around one item.</Text>', 'resize handle')
s = replace_required(s, "  scanGuideWarning: {\n    borderColor: '#F0CA6B'\n  },", "  scanGuideWarning: {\n    borderColor: '#F0CA6B'\n  },\n  resizeHandle: {\n    position: 'absolute',\n    right: -18,\n    bottom: -18,\n    width: 48,\n    height: 48,\n    alignItems: 'center',\n    justifyContent: 'center'\n  },\n  resizeHandleDot: {\n    width: 22,\n    height: 22,\n    borderRadius: 11,\n    backgroundColor: '#58E6B1',\n    borderWidth: 3,\n    borderColor: '#07110E'\n  },\n  resizeHint: {\n    marginTop: 8,\n    color: 'rgba(246,248,247,0.78)',\n    fontSize: 12,\n    fontWeight: '600',\n    textAlign: 'center'\n  },", 'resize styles')
ui.write_text(s)
