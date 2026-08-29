import { Camera, Crosshair, Gauge, Ruler, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  PermissionsAndroid,
  Platform,
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

export function PortionScannerEntry({ foodName, onEstimateGrams }: Props) {
  const [checking, setChecking] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('food');
  const [support, setSupport] = useState<PortionScannerSupport | null>(null);
  const [reading, setReading] = useState<PortionDepthReading | null>(null);
  const [capturedReading, setCapturedReading] = useState<PortionDepthReading | null>(null);
  const [scannerStatus, setScannerStatus] = useState<PortionScannerStatusEvent>({
    state: 'idle',
    message: 'Move slowly around the item when the scanner opens.'
  });

  const density = useMemo(() => densityForFood(foodName), [foodName]);
  const liveGrams = reading ? estimateGrams(reading, density) : 0;
  const capturedGrams = capturedReading ? estimateGrams(capturedReading, density) : 0;
  const quality = estimateQuality(reading);
  const ready = support?.depthSupported === true;
  const canCapture = Boolean(
    reading &&
      reading.estimatedVolumeMl >= 5 &&
      reading.estimateConfidence >= 0.58 &&
      reading.stability >= 0.62 &&
      reading.sampleWindow >= 6 &&
      reading.distanceOk &&
      !reading.componentTouchesGuide
  );

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
        message: 'Starting ARCore Depth. Move slowly around one item on a flat surface.'
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
      `MealTrack estimates about ${Math.round(capturedGrams)} g. Enter that amount in the grams field and verify it against a scale while calibrating.`
    );
  };

  const modeTitle = scanMode === 'food' ? `Scan ${foodName}` : 'Measure object';
  const guideLabel = scanMode === 'food'
    ? 'ONE PORTION INSIDE · HARD FLAT BASE AROUND EDGES'
    : 'ONE OBJECT INSIDE · HARD FLAT BASE AROUND EDGES';
  const trustedReading = Boolean(reading && reading.estimatedVolumeMl >= 5);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.iconShell}>
            <Camera size={20} color="#42D8A0" strokeWidth={2.2} />
          </View>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Depth measurement</Text>
              <View style={styles.betaPill}>
                <Text style={styles.betaText}>ROUND 2</Text>
              </View>
            </View>
            <Text style={styles.description}>
              Round 2 rejects bad distance, soft surfaces, multiple objects and unstable frames before it reveals a final volume.
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Scan food portion for ${foodName}`}
            disabled={checking}
            onPress={() => openScanner('food')}
            style={({ pressed }) => [styles.modeButton, styles.modeButtonPrimary, pressed && styles.buttonPressed, checking && styles.buttonDisabled]}
          >
            <Camera size={16} color="#06241A" strokeWidth={2.4} />
            <Text style={styles.modeButtonPrimaryText}>{checking ? 'Checking…' : 'Scan food'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Test depth scanner on a normal object"
            disabled={checking}
            onPress={() => openScanner('object')}
            style={({ pressed }) => [styles.modeButton, styles.modeButtonSecondary, pressed && styles.buttonPressed, checking && styles.buttonDisabled]}
          >
            <Crosshair size={16} color="#DCE4E1" strokeWidth={2.2} />
            <Text style={styles.modeButtonSecondaryText}>Test object</Text>
          </Pressable>
        </View>

        <Text style={[styles.status, ready && styles.statusReady]}>
          {support?.message ?? 'Use one object on a hard flat surface. Object mode reports outside geometric volume only.'}
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
            onDepthUpdate={(event) => setReading(event.nativeEvent)}
            onScannerStatus={(event) => setScannerStatus(event.nativeEvent)}
          />

          <View pointerEvents="none" style={styles.scannerShadeTop} />
          <View pointerEvents="none" style={styles.scannerShadeBottom} />

          <SafeAreaView style={styles.scannerOverlay} edges={['top', 'bottom']}>
            <View style={styles.scannerHeader}>
              <View style={styles.scannerHeaderCopy}>
                <Text style={styles.scannerEyebrow}>
                  {scanMode === 'food' ? 'ARCORE PORTION · ROUND 2' : 'ARCORE OBJECT VOLUME · ROUND 2'}
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

            <View pointerEvents="none" style={styles.reticleWrap}>
              <View style={[styles.scanGuide, reading?.componentTouchesGuide && styles.scanGuideWarning]}>
                <View style={styles.scanGuideCornerTL} />
                <View style={styles.scanGuideCornerTR} />
                <View style={styles.scanGuideCornerBL} />
                <View style={styles.scanGuideCornerBR} />
                <Crosshair size={31} color="#58E6B1" strokeWidth={1.7} />
              </View>
              <Text style={styles.reticleLabel}>{guideLabel}</Text>
            </View>

            <View style={styles.hud}>
              <Text style={styles.hudInstruction}>
                Use a hard table or counter. Keep only one item in the guide, stay about 50–90 cm away, move slowly left/right for depth, then hold steady.
              </Text>

              <View style={styles.metricGrid}>
                <ScannerMetric
                  icon={<Gauge size={15} color="#55E4AF" strokeWidth={2.2} />}
                  label={scanMode === 'food' ? 'VOLUME' : 'OUTER VOLUME'}
                  value={trustedReading && reading ? `${Math.round(reading.estimatedVolumeMl)} ml` : '—'}
                />
                <ScannerMetric
                  icon={<Ruler size={15} color="#55E4AF" strokeWidth={2.2} />}
                  label={scanMode === 'food' ? 'EST. WEIGHT' : 'MAX HEIGHT'}
                  value={scanMode === 'food'
                    ? (trustedReading && liveGrams > 0 ? `${Math.round(liveGrams)} g` : '—')
                    : (trustedReading && reading ? `${(reading.estimatedHeightMm / 10).toFixed(1)} cm` : '—')}
                  alignRight
                />
                <ScannerMetric
                  label={scanMode === 'food' ? 'MAX HEIGHT' : 'STABILITY'}
                  value={scanMode === 'food'
                    ? (trustedReading && reading ? `${(reading.estimatedHeightMm / 10).toFixed(1)} cm` : '—')
                    : stabilityLabel(reading)}
                />
                <ScannerMetric
                  label="CONFIDENCE"
                  value={quality.label}
                  valueColor={quality.color}
                  alignRight
                />
              </View>

              <View style={styles.statusRow}>
                <View style={[
                  styles.statusDot,
                  ['tracking', 'measuring'].includes(scannerStatus.state) && styles.statusDotReady,
                  ['distance', 'surface', 'multiple', 'reframe'].includes(scannerStatus.state) && styles.statusDotWarning
                ]} />
                <Text style={styles.scannerStatus}>{scannerStatus.message}</Text>
              </View>

              {reading ? (
                <View style={styles.diagnosticRow}>
                  <Text style={styles.diagnosticText}>
                    {Math.round(reading.distanceCm)} cm · clean frames {reading.sampleWindow}/6 · stability {Math.round(reading.stability * 100)}%
                  </Text>
                  <Text style={styles.diagnosticText}>
                    raw geometry {Math.round(reading.rawVolumeMl)} ml · base error ±{Math.round(reading.planeResidualMm)} mm
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
                  Object test measures the outside 3D shape above the flat base. It does not measure liquid remaining inside a bottle.
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
                      {scanMode === 'food'
                        ? `${Math.round(capturedReading.estimatedVolumeMl)} ml`
                        : `${Math.round(capturedReading.estimatedVolumeMl)} cm³`}
                    </Text>
                  </View>
                  <Text style={styles.captureResultHint}>
                    Only clean frames are included. Compare repeated scans with a known object or kitchen scale while calibrating.
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
                style={({ pressed }) => [styles.captureButton, !canCapture && styles.captureButtonDisabled, pressed && canCapture && styles.buttonPressed]}
              >
                <Crosshair size={18} color="#05251B" strokeWidth={2.4} />
                <Text style={styles.captureButtonText}>
                  {canCapture ? 'Capture stable estimate' : 'Waiting for valid scan…'}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
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
  if (reading.estimatedVolumeMl < 5 || reading.estimateConfidence < 0.5) return 0;
  return reading.estimatedVolumeMl * density.gramsPerMl;
}

function estimateQuality(reading: PortionDepthReading | null) {
  if (!reading) return { label: 'Waiting', color: '#88928F' };
  if (!reading.distanceOk) return { label: 'Distance', color: '#F0CA6B' };
  if (reading.componentTouchesGuide) return { label: 'Reframe', color: '#F0CA6B' };
  if (reading.estimatedVolumeMl >= 5 && reading.stability >= 0.62 && reading.sampleWindow >= 6) {
    return { label: 'Good', color: '#55E4AF' };
  }
  if (reading.sampleWindow >= 3) return { label: 'Building', color: '#F0CA6B' };
  return { label: 'Scanning', color: '#88928F' };
}

function stabilityLabel(reading: PortionDepthReading | null) {
  if (!reading || reading.sampleWindow < 3) return 'Building';
  if (reading.stability >= 0.72) return 'Good';
  if (reading.stability >= 0.55) return 'Fair';
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
  betaPill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#17372D' },
  betaText: { color: '#42D8A0', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  description: { color: '#929C99', fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
  modeButton: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  modeButtonPrimary: { backgroundColor: '#42D8A0' },
  modeButtonSecondary: { backgroundColor: '#1B2321', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modeButtonPrimaryText: { color: '#06241A', fontSize: 12.5, fontWeight: '900' },
  modeButtonSecondaryText: { color: '#DCE4E1', fontSize: 12.5, fontWeight: '800' },
  buttonPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  buttonDisabled: { opacity: 0.55 },
  status: { color: '#707B78', fontSize: 10.5, lineHeight: 16, marginTop: 9 },
  statusReady: { color: '#66CFA7' },
  scannerRoot: { flex: 1, backgroundColor: '#030505' },
  scannerShadeTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 155, backgroundColor: 'rgba(0,0,0,0.34)' },
  scannerShadeBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 390, backgroundColor: 'rgba(0,0,0,0.43)' },
  scannerOverlay: { flex: 1, justifyContent: 'space-between' },
  scannerHeader: { minHeight: 80, paddingHorizontal: 18, paddingTop: 8, flexDirection: 'row', alignItems: 'center' },
  scannerHeaderCopy: { flex: 1, paddingRight: 12 },
  scannerEyebrow: { color: '#55E4AF', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  scannerTitle: { color: '#F6F8F7', fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 2 },
  focusLine: { color: '#A4B0AC', fontSize: 10.5, fontWeight: '700', marginTop: 3 },
  closeButton: { width: 48, height: 48, borderRadius: 17, backgroundColor: 'rgba(10,15,14,0.75)', alignItems: 'center', justifyContent: 'center' },
  reticleWrap: { position: 'absolute', top: '31%', alignSelf: 'center', alignItems: 'center' },
  scanGuide: { width: 230, height: 190, alignItems: 'center', justifyContent: 'center' },
  scanGuideWarning: { opacity: 0.62 },
  scanGuideCornerTL: { position: 'absolute', top: 0, left: 0, width: 42, height: 42, borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#58E6B1', borderTopLeftRadius: 24 },
  scanGuideCornerTR: { position: 'absolute', top: 0, right: 0, width: 42, height: 42, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#58E6B1', borderTopRightRadius: 24 },
  scanGuideCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 42, height: 42, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#58E6B1', borderBottomLeftRadius: 24 },
  scanGuideCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 42, height: 42, borderBottomWidth: 2, borderRightWidth: 2, borderColor: '#58E6B1', borderBottomRightRadius: 24 },
  reticleLabel: { color: '#D7F8EB', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.85, marginTop: 9, backgroundColor: 'rgba(0,0,0,0.58)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  hud: { marginHorizontal: 14, marginBottom: 8, padding: 17, borderRadius: 25, backgroundColor: 'rgba(9,15,13,0.95)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  hudInstruction: { color: '#CDD5D2', fontSize: 12, lineHeight: 17 },
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
  diagnosticRow: { marginTop: 10, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.035)' },
  diagnosticText: { color: '#6F7B77', fontSize: 9.5, lineHeight: 14 },
  densityNote: { color: '#71807A', fontSize: 10, lineHeight: 15, marginTop: 8 },
  objectNote: { color: '#89958F', fontSize: 10, lineHeight: 15, marginTop: 8, paddingLeft: 9, borderLeftWidth: 2, borderLeftColor: '#355A4B' },
  captureResult: { marginTop: 11, borderRadius: 16, padding: 12, backgroundColor: 'rgba(85,228,175,0.08)' },
  captureResultLabel: { color: '#55E4AF', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  captureValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 2 },
  captureResultValue: { color: '#F6F8F7', fontSize: 25, fontWeight: '900' },
  captureVolume: { color: '#93A19C', fontSize: 13, fontWeight: '800' },
  captureResultHint: { color: '#7C8985', fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  useButton: { minHeight: 40, borderRadius: 13, marginTop: 9, backgroundColor: '#1F3A31', alignItems: 'center', justifyContent: 'center' },
  useButtonText: { color: '#7DE7BF', fontSize: 11.5, fontWeight: '900' },
  captureButton: { minHeight: 50, marginTop: 12, borderRadius: 16, backgroundColor: '#55E4AF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  captureButtonDisabled: { opacity: 0.38 },
  captureButtonText: { color: '#05251B', fontSize: 13, fontWeight: '900' }
});