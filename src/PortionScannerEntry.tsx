import { Camera, Crosshair, Gauge, Ruler, X } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  PermissionsAndroid,
  Platform,
  PanResponder,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getPortionScannerSupportAsync,
  PortionDepthView,
  type PortionDepthReading,
  type PortionScannerStatusEvent,
  type PortionScannerSupport
} from '../modules/portion-scanner/src/PortionScanner';

type Props = {
  foodName: string;
  onEstimateGrams?: (grams: number) => void;
};

type ScanMode = 'food' | 'object';

type DensityEstimate = {
  gramsPerMl: number;
  label: string;
  confidence: 'known' | 'generic';
};

type Gate = {
  key: string;
  label: string;
  ok: boolean;
};

type ScanAssessment = {
  distanceOk: boolean;
  baseOk: boolean;
  framingOk: boolean;
  samplesOk: boolean;
  stabilityOk: boolean;
  confidenceOk: boolean;
  geometryValid: boolean;
  ready: boolean;
  gates: Gate[];
  headline: string;
  instruction: string;
};

const REQUIRED_FRAMES = 6;
const GOOD_BASE_RESIDUAL_MM = 12;
const MIN_STABILITY = 0.62;
const MIN_CONFIDENCE = 0.54;
const ROI_CENTER_Y = 0.45;
const DEFAULT_ROI_WIDTH = 0.64;
const DEFAULT_ROI_HEIGHT = 0.30;
const MIN_ROI_WIDTH = 0.28;
const MAX_ROI_WIDTH = 0.82;
const MIN_ROI_HEIGHT = 0.18;
const MAX_ROI_HEIGHT = 0.55;

export function PortionScannerEntry({ foodName, onEstimateGrams }: Props) {
  const [checking, setChecking] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('food');
  const [support, setSupport] = useState<PortionScannerSupport | null>(null);
  const [reading, setReading] = useState<PortionDepthReading | null>(null);
  const [capturedReading, setCapturedReading] = useState<PortionDepthReading | null>(null);
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
  const [scannerStatus, setScannerStatus] = useState<PortionScannerStatusEvent>({
    state: 'idle',
    message: 'Move slowly around the item when the scanner opens.'
  });

  const density = useMemo(() => densityForFood(foodName), [foodName]);
  const liveGrams = reading ? estimateGrams(reading, density) : 0;
  const capturedGrams = capturedReading ? estimateGrams(capturedReading, density) : 0;
  const ready = support?.depthSupported === true;
  const canCapture = Boolean(reading && (reading.rawVolumeMl ?? 0) > 0);

  const openScanner = async (mode: ScanMode) => {
    if (Platform.OS !== 'android') {
      Alert.alert('Android prototype', 'This scanner currently uses ARCore Depth on Android.');
      return;
    }

    setChecking(true);
    setScanMode(mode);
    try {
      const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: 'Camera access for depth measurement',
        message: 'MealTrack uses the camera and ARCore depth to measure physical geometry.',
        buttonPositive: 'Continue',
        buttonNegative: 'Cancel'
      });

      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Camera permission needed', 'Allow camera access to use ARCore depth measurement.');
        return;
      }

      const result = await getPortionScannerSupportAsync();
      setSupport(result);

      if (!result.depthSupported) {
        Alert.alert('Depth scanner unavailable', result.message);
        return;
      }

      setReading(null);
      setCapturedReading(null);
      setScannerStatus({
        state: 'starting',
        message: 'Starting ARCore Depth. Move slowly around the item.'
      });
      setScannerOpen(true);
    } catch {
      Alert.alert('Scanner check failed', 'MealTrack could not start ARCore Depth on this device.');
    } finally {
      setChecking(false);
    }
  };

  const closeScanner = () => {
    setScannerOpen(false);
    setReading(null);
    setCapturedReading(null);
  };

  const captureEstimate = () => {
    if (!reading || !canCapture) return;
    setCapturedReading(reading);
  };

  const useEstimate = () => {
    if (scanMode !== 'food' || !capturedReading || capturedGrams <= 0) return;

    if (onEstimateGrams) {
      onEstimateGrams(capturedGrams);
      closeScanner();
      return;
    }

    Alert.alert(
      'Estimated portion',
      `MealTrack estimates about ${Math.round(capturedGrams)} g. Verify the estimate against a scale while calibrating.`
    );
  };

  const modeTitle = scanMode === 'food' ? `Scan ${foodName}` : 'Measure object';
  const guideLabel = scanMode === 'food'
    ? 'ONE FOOD PORTION · FLAT BASE AROUND IT'
    : 'ONE OBJECT · FLAT HARD BASE AROUND IT';

  const showMeasurement = Boolean(reading && (reading.rawVolumeMl ?? 0) > 0);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.iconShell}>
            <Camera size={20} color="#42D8A0" strokeWidth={2.2} />
          </View>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Live scanner</Text>
              <View style={styles.betaPill}>
                <Text style={styles.betaText}>BASIC</Text>
              </View>
            </View>
            <Text style={styles.description}>
              Basic mode shows raw depth measurements immediately. No framing, stability or confidence gate blocks capture.
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Scan food portion for ${foodName}`}
            disabled={checking}
            onPress={() => openScanner('food')}
            style={({ pressed }) => [
              styles.modeButton,
              styles.modeButtonPrimary,
              pressed && styles.buttonPressed,
              checking && styles.buttonDisabled
            ]}
          >
            <Camera size={16} color="#06241A" strokeWidth={2.4} />
            <Text style={styles.modeButtonPrimaryText}>{checking ? 'Checking…' : 'Scan food'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Test depth scanner on a normal object"
            disabled={checking}
            onPress={() => openScanner('object')}
            style={({ pressed }) => [
              styles.modeButton,
              styles.modeButtonSecondary,
              pressed && styles.buttonPressed,
              checking && styles.buttonDisabled
            ]}
          >
            <Crosshair size={16} color="#DCE4E1" strokeWidth={2.2} />
            <Text style={styles.modeButtonSecondaryText}>Test object</Text>
          </Pressable>
        </View>

        <Text style={[styles.status, ready && styles.statusReady]}>
          {support?.message ?? 'Use one item on a hard, flat surface. Object mode reports outside geometric volume.'}
        </Text>
      </View>

      <Modal
        visible={scannerOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeScanner}
      >
        <View style={styles.scannerRoot}>
          <StatusBar hidden />

          <PortionDepthView
            style={StyleSheet.absoluteFill}
            roiWidthFraction={roiWidth}
            roiHeightFraction={roiHeight}
            onDepthUpdate={(event) => setReading(event.nativeEvent)}
            onScannerStatus={(event) => setScannerStatus(event.nativeEvent)}
          />

          <View pointerEvents="none" style={styles.scannerShadeTop} />
          <View pointerEvents="none" style={styles.scannerShadeBottom} />

          <SafeAreaView style={styles.scannerOverlay} edges={['top', 'bottom']}>
            <View style={styles.scannerHeader}>
              <View style={styles.scannerHeaderCopy}>
                <Text style={styles.scannerEyebrow}>
                  {scanMode === 'food' ? 'ARCORE PORTION' : 'ARCORE OBJECT VOLUME'}
                </Text>
                <Text numberOfLines={1} style={styles.scannerTitle}>{modeTitle}</Text>
                <Text style={styles.focusLine}>
                  {reading?.autofocusEnabled === false ? 'Focus: fixed fallback' : 'Focus: continuous autofocus'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close depth scanner"
                hitSlop={10}
                onPress={closeScanner}
                style={({ pressed }) => [styles.closeButton, pressed && styles.buttonPressed]}
              >
                <X size={22} color="#F6F8F7" strokeWidth={2.2} />
              </Pressable>
            </View>

            <View
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
              ]}>
                <View style={styles.scanGuideCornerTL} />
                <View style={styles.scanGuideCornerTR} />
                <View style={styles.scanGuideCornerBL} />
                <View style={styles.scanGuideCornerBR} />
                <Crosshair size={31} color="#58E6B1" strokeWidth={1.7} />
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
              <Text style={styles.resizeHint}>Drag the green corner handle until only the target sits inside the frame.</Text>
            </View>

            <View style={styles.hud}>
              <View style={styles.guidanceHeader}>
                <Text style={styles.guidanceHeadline}>
                  {(reading?.rawVolumeMl ?? 0) > 0 ? 'Depth detected' : 'Find one item'}
                </Text>
                <Text style={styles.guidanceText}>
                  Raw mode is active. Keep the item inside the adjustable frame and capture whenever a volume appears.
                </Text>
              </View>

              <View style={styles.metricGrid}>
                <ScannerMetric
                  icon={<Gauge size={15} color="#55E4AF" strokeWidth={2.2} />}
                  label={scanMode === 'food' ? 'VOLUME' : 'OUTER VOLUME'}
                  value={showMeasurement && reading ? `${Math.round(reading.rawVolumeMl ?? 0)} ml` : '—'}
                />
                <ScannerMetric
                  icon={<Ruler size={15} color="#55E4AF" strokeWidth={2.2} />}
                  label={scanMode === 'food' ? 'EST. WEIGHT' : 'MAX HEIGHT'}
                  value={scanMode === 'food'
                    ? (showMeasurement && liveGrams > 0 ? `${Math.round(liveGrams)} g` : '—')
                    : (showMeasurement && reading ? `${(reading.estimatedHeightMm / 10).toFixed(1)} cm` : '—')}
                  alignRight
                />
                <ScannerMetric
                  label="DISTANCE"
                  value={reading?.distanceCm ? `${Math.round(reading.distanceCm)} cm` : '—'}
                />
                <ScannerMetric
                  label="SAMPLES"
                  value={reading ? String(reading.sampleWindow) : '0'}
                  alignRight
                />
              </View>

              <View style={styles.statusRow}>
                <View style={[
                  styles.statusDot,
                  canCapture && styles.statusDotReady,
                  !canCapture && reading && styles.statusDotWarning
                ]} />
                <Text style={styles.scannerStatus}>
                  {(reading?.rawVolumeMl ?? 0) > 0 ? 'Live raw measurement available.' : scannerStatus.message}
                </Text>
              </View>

              {reading ? (
                <View style={styles.diagnosticRow}>
                  <Text style={styles.diagnosticText}>
                    {Math.round(reading.distanceCm)} cm · {reading.sampleWindow}/9 frames · base error ±{Math.round(reading.planeResidualMm)} mm
                  </Text>
                  <Text style={styles.diagnosticText}>
                    stability {Math.round(reading.stability * 100)}% · confidence {Math.round(reading.estimateConfidence * 100)}%
                    {__DEV__ ? ` · raw ${Math.round(reading.rawVolumeMl ?? 0)} ml` : ''}
                  </Text>
                </View>
              ) : null}

              {scanMode === 'food' ? (
                <Text style={styles.densityNote}>
                  Density: {density.gramsPerMl.toFixed(2)} g/ml · {density.label}
                  {density.confidence === 'generic' ? ' · generic assumption' : ''}
                </Text>
              ) : (
                <Text style={styles.objectNote}>
                  Measures the object’s outside shape above the base. It cannot tell how much liquid is inside a bottle.
                </Text>
              )}

              {capturedReading ? (
                <View style={styles.captureResult}>
                  <Text style={styles.captureResultLabel}>
                    {scanMode === 'food' ? 'PORTION ESTIMATE' : 'OBJECT MEASUREMENT'}
                  </Text>
                  <View style={styles.captureValueRow}>
                    <Text style={styles.captureResultValue}>
                      {scanMode === 'food'
                        ? `${Math.round(capturedGrams)} g`
                        : `${Math.round(capturedReading.estimatedVolumeMl)} ml`}
                    </Text>
                    <Text style={styles.captureVolume}>
                      {Math.round(capturedReading.estimatedVolumeMl)} cm³
                    </Text>
                  </View>
                  <Text style={styles.captureResultHint}>
                    Basic raw reading. Advanced validation is intentionally disabled for now.
                  </Text>
                  {scanMode === 'food' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Use estimated grams"
                      onPress={useEstimate}
                      style={({ pressed }) => [styles.useButton, pressed && styles.buttonPressed]}
                    >
                      <Text style={styles.useButtonText}>
                        {onEstimateGrams ? 'Use this amount' : `Use ~${Math.round(capturedGrams)} g`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Capture stabilized measurement"
                disabled={!canCapture}
                onPress={captureEstimate}
                style={({ pressed }) => [
                  styles.captureButton,
                  !canCapture && styles.captureButtonDisabled,
                  pressed && canCapture && styles.buttonPressed
                ]}
              >
                <Crosshair size={18} color="#05251B" strokeWidth={2.4} />
                <Text style={styles.captureButtonText}>
                  {canCapture ? 'Capture reading' : 'Waiting for depth'}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

function assessScan(reading: PortionDepthReading | null): ScanAssessment {
  if (!reading) {
    return {
      distanceOk: false,
      baseOk: false,
      framingOk: false,
      samplesOk: false,
      stabilityOk: false,
      confidenceOk: false,
      geometryValid: false,
      ready: false,
      gates: [
        { key: 'distance', label: 'Distance', ok: false },
        { key: 'base', label: 'Flat base', ok: false },
        { key: 'frame', label: 'Framing', ok: false },
        { key: 'stable', label: 'Stable', ok: false }
      ],
      headline: 'Start scanning',
      instruction: 'Use one item on a hard flat table. Keep empty table visible around it.'
    };
  }

  const distanceOk = reading.distanceOk && reading.distanceCm >= 45 && reading.distanceCm <= 90;
  const baseOk = Number.isFinite(reading.planeResidualMm) && reading.planeResidualMm <= GOOD_BASE_RESIDUAL_MM;
  const framingOk = !reading.componentTouchesGuide && reading.objectPixelRatio >= 0.015 && reading.objectPixelRatio <= 0.72;
  const samplesOk = reading.sampleWindow >= REQUIRED_FRAMES;
  const stabilityOk = reading.stability >= MIN_STABILITY;
  const confidenceOk = reading.estimateConfidence >= MIN_CONFIDENCE;
  const geometryValid = distanceOk && baseOk && framingOk && reading.estimatedVolumeMl >= 5;
  const ready = geometryValid && samplesOk && stabilityOk && confidenceOk;

  let headline = 'Hold steady';
  let instruction = `Collecting stable depth frames (${Math.min(reading.sampleWindow, REQUIRED_FRAMES)}/${REQUIRED_FRAMES}).`;

  if (!distanceOk) {
    headline = reading.distanceCm < 45 ? 'Move farther away' : 'Move closer';
    instruction = `Current distance is ${Math.round(reading.distanceCm)} cm. Aim for about 50–75 cm.`;
  } else if (!baseOk) {
    headline = 'Use a hard flat surface';
    instruction = `Base error is ±${Math.round(reading.planeResidualMm)} mm. Avoid bedsheets, cushions, folds and clutter.`;
  } else if (!framingOk) {
    headline = 'Center one item';
    instruction = reading.componentTouchesGuide
      ? 'The object reaches the green guide. Move back slightly or use a smaller object.'
      : 'Keep one object centered with empty flat surface visible around every edge.';
  } else if (!samplesOk) {
    headline = 'Hold steady';
    instruction = `Geometry is valid. Keep still while frames build (${reading.sampleWindow}/${REQUIRED_FRAMES}).`;
  } else if (!stabilityOk) {
    headline = 'Keep the phone still';
    instruction = `Stability is ${Math.round(reading.stability * 100)}%. Wait for the measurement to settle.`;
  } else if (!confidenceOk) {
    headline = 'Improve the scan';
    instruction = 'Move slightly side-to-side, then hold still. Better surface texture and lighting can help depth confidence.';
  } else {
    headline = 'Ready';
    instruction = 'Distance, flat-base fit, framing and stability all passed.';
  }

  return {
    distanceOk,
    baseOk,
    framingOk,
    samplesOk,
    stabilityOk,
    confidenceOk,
    geometryValid,
    ready,
    gates: [
      { key: 'distance', label: 'Distance', ok: distanceOk },
      { key: 'base', label: 'Flat base', ok: baseOk },
      { key: 'frame', label: 'Framing', ok: framingOk },
      { key: 'stable', label: 'Stable', ok: samplesOk && stabilityOk && confidenceOk }
    ],
    headline,
    instruction
  };
}

function ScannerMetric({
  icon,
  label,
  value,
  alignRight = false,
  valueColor = '#F6F8F7'
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  alignRight?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={[styles.scannerMetric, alignRight && styles.scannerMetricRight]}>
      <View style={[styles.metricLabelRow, alignRight && styles.metricLabelRowRight]}>
        {icon}
        <Text style={styles.readingLabel}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function estimateGrams(reading: PortionDepthReading, density: DensityEstimate) {
  const rawVolumeMl = reading.rawVolumeMl ?? 0;
  const volumeMl = rawVolumeMl > 0 ? rawVolumeMl : reading.estimatedVolumeMl;
  if (volumeMl <= 0) return 0;
  return volumeMl * density.gramsPerMl;
}

function estimateQuality(reading: PortionDepthReading | null, assessment: ScanAssessment) {
  if (!reading) return { label: 'Waiting', color: '#88928F' };
  if (!assessment.distanceOk) return { label: 'Distance', color: '#F0CA6B' };
  if (!assessment.baseOk) return { label: 'Base', color: '#FF9A7A' };
  if (!assessment.framingOk) return { label: 'Reframe', color: '#F0CA6B' };
  if (assessment.ready) return { label: 'Good', color: '#55E4AF' };
  if (reading.stability >= 0.45) return { label: 'Fair', color: '#F0CA6B' };
  return { label: 'Building', color: '#A0AAA7' };
}

function stabilityLabel(reading: PortionDepthReading | null) {
  if (!reading || reading.sampleWindow < 3) return 'Building';
  if (reading.stability >= 0.72 && reading.sampleWindow >= REQUIRED_FRAMES) return 'Good';
  if (reading.stability >= 0.45) return 'Fair';
  return 'Low';
}

function densityForFood(foodName: string): DensityEstimate {
  const name = foodName.toLowerCase();
  const known = (gramsPerMl: number, label: string): DensityEstimate => ({
    gramsPerMl,
    label,
    confidence: 'known'
  });

  if (name.includes('rice') && name.includes('cooked')) return known(0.78, 'cooked rice');
  if (name.includes('pasta') && name.includes('cooked')) return known(0.66, 'cooked pasta');
  if (name.includes('quinoa') && name.includes('cooked')) return known(0.72, 'cooked quinoa');
  if (name.includes('lentil') && name.includes('cooked')) return known(0.82, 'cooked lentils');
  if (name.includes('chickpea') && name.includes('cooked')) return known(0.78, 'cooked chickpeas');
  if (name.includes('bean') && name.includes('cooked')) return known(0.76, 'cooked beans');
  if (name.includes('chicken')) return known(1.02, 'cooked chicken');
  if (name.includes('turkey')) return known(1.02, 'cooked turkey');
  if (name.includes('beef')) return known(1.03, 'cooked beef');
  if (name.includes('salmon') || name.includes('cod') || name.includes('tuna') || name.includes('shrimp')) return known(1.01, 'cooked seafood');
  if (name.includes('potato')) return known(0.90, 'cooked potato');
  if (name.includes('broccoli')) return known(0.38, 'cooked broccoli');
  if (name.includes('spinach')) return known(0.10, 'leafy greens');
  if (name.includes('tomato') || name.includes('cucumber')) return known(0.95, 'fresh vegetable');
  if (name.includes('banana')) return known(0.94, 'banana');
  if (name.includes('apple') || name.includes('orange')) return known(0.86, 'fresh fruit');
  if (name.includes('blueberr') || name.includes('strawberr')) return known(0.64, 'berries');
  if (name.includes('avocado')) return known(0.70, 'avocado');
  if (name.includes('greek yogurt') || name.includes('cottage cheese')) return known(1.03, 'dairy');
  if (name.includes('milk')) return known(1.03, 'milk');
  if (name.includes('olive oil')) return known(0.91, 'olive oil');
  if (name.includes('hummus')) return known(0.96, 'hummus');
  if (name.includes('peanut butter')) return known(1.08, 'peanut butter');

  return {
    gramsPerMl: 0.90,
    label: 'generic solid food',
    confidence: 'generic'
  };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111817',
    borderRadius: 20,
    padding: 16,
    marginTop: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)'
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start' },
  iconShell: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#0B2A21',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  copy: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  title: { color: '#F5F7F5', fontSize: 16, fontWeight: '800' },
  betaPill: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: '#17372D'
  },
  betaText: { color: '#42D8A0', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  description: { color: '#929C99', fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
  modeButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7
  },
  modeButtonPrimary: { backgroundColor: '#42D8A0' },
  modeButtonSecondary: {
    backgroundColor: '#1B2321',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  modeButtonPrimaryText: { color: '#06241A', fontSize: 12.5, fontWeight: '900' },
  modeButtonSecondaryText: { color: '#DCE4E1', fontSize: 12.5, fontWeight: '800' },
  buttonPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  buttonDisabled: { opacity: 0.55 },
  status: { color: '#707B78', fontSize: 10.5, lineHeight: 16, marginTop: 9 },
  statusReady: { color: '#66CFA7' },

  scannerRoot: { flex: 1, backgroundColor: '#030505' },
  scannerShadeTop: {
    position: 'absolute', left: 0, right: 0, top: 0, height: 155,
    backgroundColor: 'rgba(0,0,0,0.34)'
  },
  scannerShadeBottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 430,
    backgroundColor: 'rgba(0,0,0,0.46)'
  },
  scannerOverlay: { flex: 1, justifyContent: 'space-between' },
  scannerHeader: {
    minHeight: 80,
    paddingHorizontal: 18,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  scannerHeaderCopy: { flex: 1, paddingRight: 12 },
  scannerEyebrow: { color: '#55E4AF', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  scannerTitle: { color: '#F6F8F7', fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 2 },
  focusLine: { color: '#A4B0AC', fontSize: 10.5, fontWeight: '700', marginTop: 3 },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: 'rgba(10,15,14,0.75)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  reticleWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
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
  scanGuideCornerTL: {
    position: 'absolute', top: 0, left: 0, width: 42, height: 42,
    borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#58E6B1', borderTopLeftRadius: 24
  },
  scanGuideCornerTR: {
    position: 'absolute', top: 0, right: 0, width: 42, height: 42,
    borderTopWidth: 2, borderRightWidth: 2, borderColor: '#58E6B1', borderTopRightRadius: 24
  },
  scanGuideCornerBL: {
    position: 'absolute', bottom: 0, left: 0, width: 42, height: 42,
    borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#58E6B1', borderBottomLeftRadius: 24
  },
  scanGuideCornerBR: {
    position: 'absolute', bottom: 0, right: 0, width: 42, height: 42,
    borderBottomWidth: 2, borderRightWidth: 2, borderColor: '#58E6B1', borderBottomRightRadius: 24
  },
  reticleLabel: {
    color: '#D7F8EB',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 9,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8
  },
  hud: {
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 17,
    borderRadius: 25,
    backgroundColor: 'rgba(9,15,13,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)'
  },
  guidanceHeader: { marginBottom: 10 },
  guidanceHeadline: { color: '#F5F7F5', fontSize: 15, fontWeight: '900' },
  guidanceText: { color: '#A7B1AE', fontSize: 11, lineHeight: 16, marginTop: 3 },
  gatesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gate: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)'
  },
  gateOk: { backgroundColor: 'rgba(85,228,175,0.08)', borderColor: 'rgba(85,228,175,0.20)' },
  gateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7D8985' },
  gateText: { color: '#8C9894', fontSize: 9, fontWeight: '800' },
  gateTextOk: { color: '#8DEAC8' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 13, rowGap: 10 },
  scannerMetric: { width: '50%' },
  scannerMetricRight: { alignItems: 'flex-end' },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricLabelRowRight: { justifyContent: 'flex-end' },
  readingLabel: { color: '#697572', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  metricValue: { fontSize: 25, lineHeight: 31, fontWeight: '900', marginTop: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 11 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF8B8B', marginRight: 8 },
  statusDotReady: { backgroundColor: '#55E4AF' },
  statusDotWarning: { backgroundColor: '#F0CA6B' },
  scannerStatus: { flex: 1, color: '#929D99', fontSize: 10.5, lineHeight: 15 },
  diagnosticRow: {
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.035)'
  },
  diagnosticText: { color: '#6F7B77', fontSize: 9.5, lineHeight: 14 },
  densityNote: { color: '#71807A', fontSize: 10, lineHeight: 15, marginTop: 8 },
  objectNote: {
    color: '#89958F',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 8,
    paddingLeft: 9,
    borderLeftWidth: 2,
    borderLeftColor: '#355A4B'
  },
  captureResult: {
    marginTop: 11,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(85,228,175,0.08)'
  },
  captureResultLabel: { color: '#55E4AF', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  captureValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 2 },
  captureResultValue: { color: '#F6F8F7', fontSize: 25, fontWeight: '900' },
  captureVolume: { color: '#93A19C', fontSize: 13, fontWeight: '800' },
  captureResultHint: { color: '#7C8985', fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  useButton: {
    minHeight: 40,
    borderRadius: 13,
    marginTop: 9,
    backgroundColor: '#1F3A31',
    alignItems: 'center',
    justifyContent: 'center'
  },
  useButtonText: { color: '#7DE7BF', fontSize: 11.5, fontWeight: '900' },
  captureButton: {
    minHeight: 50,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: '#55E4AF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  captureButtonDisabled: { opacity: 0.36 },
  captureButtonText: { color: '#05251B', fontSize: 13, fontWeight: '900' }
});