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

type DensityEstimate = {
  gramsPerMl: number;
  label: string;
  confidence: 'known' | 'generic';
};

export function PortionScannerEntry({ foodName, onEstimateGrams }: Props) {
  const [checking, setChecking] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [support, setSupport] = useState<PortionScannerSupport | null>(null);
  const [reading, setReading] = useState<PortionDepthReading | null>(null);
  const [capturedReading, setCapturedReading] = useState<PortionDepthReading | null>(null);
  const [scannerStatus, setScannerStatus] = useState<PortionScannerStatusEvent>({
    state: 'idle',
    message: 'Move slowly around the plate when the scanner opens.'
  });

  const density = useMemo(() => densityForFood(foodName), [foodName]);
  const liveGrams = reading ? estimateGrams(reading, density) : 0;
  const capturedGrams = capturedReading ? estimateGrams(capturedReading, density) : 0;
  const quality = estimateQuality(reading);
  const ready = support?.depthSupported === true;
  const canCapture = Boolean(
    reading &&
      reading.estimatedVolumeMl >= 8 &&
      reading.estimateConfidence >= 0.25
  );

  const openScanner = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Android prototype', 'This depth-scanner prototype currently uses ARCore on Android.');
      return;
    }

    setChecking(true);
    try {
      const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: 'Camera access for portion scanning',
        message: 'MealTrack uses the camera and ARCore depth only to measure food geometry.',
        buttonPositive: 'Continue',
        buttonNegative: 'Cancel'
      });

      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Camera permission needed', 'Allow camera access to use ARCore portion scanning.');
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
        message: 'Starting ARCore Depth. Move slowly around the plate.'
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
    if (!capturedReading || capturedGrams <= 0) return;
    if (onEstimateGrams) {
      onEstimateGrams(capturedGrams);
      closeScanner();
      return;
    }

    Alert.alert(
      'Estimated portion',
      `MealTrack estimates about ${Math.round(capturedGrams)} g. Close the scanner and enter that amount in the grams field.`
    );
  };

  return (
    <>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.iconShell}>
            <Camera size={20} color="#42D8A0" strokeWidth={2.2} />
          </View>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Scan portion</Text>
              <View style={styles.betaPill}>
                <Text style={styles.betaText}>DEPTH BETA</Text>
              </View>
            </View>
            <Text style={styles.description}>
              ARCore now estimates the food volume from the depth surface, then converts volume to grams using a stored density for {foodName}.
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open depth scanner for ${foodName}`}
          disabled={checking}
          onPress={openScanner}
          style={({ pressed }) => [
            styles.button,
            ready && styles.buttonReady,
            pressed && styles.buttonPressed,
            checking && styles.buttonDisabled
          ]}
        >
          <Camera size={16} color={ready ? '#06241A' : '#121817'} strokeWidth={2.4} />
          <Text style={[styles.buttonText, ready && styles.buttonTextReady]}>
            {checking ? 'Checking ARCore…' : ready ? 'Open portion scanner' : 'Start portion scanner'}
          </Text>
        </Pressable>

        <Text style={[styles.status, ready && styles.statusReady]}>
          {support?.message ?? 'No food-recognition AI is used. You choose the food; ARCore measures geometry.'}
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
                <Text style={styles.scannerEyebrow}>ARCORE VOLUME</Text>
                <Text numberOfLines={1} style={styles.scannerTitle}>Scan {foodName}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close portion scanner"
                hitSlop={10}
                onPress={closeScanner}
                style={({ pressed }) => [styles.closeButton, pressed && styles.buttonPressed]}
              >
                <X size={22} color="#F6F8F7" strokeWidth={2.2} />
              </Pressable>
            </View>

            <View pointerEvents="none" style={styles.reticleWrap}>
              <View style={styles.scanGuide}>
                <View style={styles.scanGuideCornerTL} />
                <View style={styles.scanGuideCornerTR} />
                <View style={styles.scanGuideCornerBL} />
                <View style={styles.scanGuideCornerBR} />
                <Crosshair size={31} color="#58E6B1" strokeWidth={1.7} />
              </View>
              <Text style={styles.reticleLabel}>FOOD INSIDE · PLATE VISIBLE AROUND EDGES</Text>
            </View>

            <View style={styles.hud}>
              <Text style={styles.hudInstruction}>
                Hold roughly 50–80 cm away, keep the phone nearly parallel to the plate, and move slowly. The edge of the guide is used to estimate the plate plane.
              </Text>

              <View style={styles.metricGrid}>
                <ScannerMetric
                  icon={<Gauge size={15} color="#55E4AF" strokeWidth={2.2} />}
                  label="VOLUME"
                  value={reading && reading.estimatedVolumeMl >= 8 ? `${Math.round(reading.estimatedVolumeMl)} ml` : '—'}
                />
                <ScannerMetric
                  icon={<Ruler size={15} color="#55E4AF" strokeWidth={2.2} />}
                  label="EST. WEIGHT"
                  value={liveGrams > 0 ? `${Math.round(liveGrams)} g` : '—'}
                  alignRight
                />
                <ScannerMetric
                  label="MAX HEIGHT"
                  value={reading && reading.estimatedHeightMm > 0 ? `${Math.round(reading.estimatedHeightMm / 10)} cm` : '—'}
                />
                <ScannerMetric
                  label="CONFIDENCE"
                  value={quality.label}
                  valueColor={quality.color}
                  alignRight
                />
              </View>

              <View style={styles.statusRow}>
                <View style={[styles.statusDot, ['tracking', 'measuring'].includes(scannerStatus.state) && styles.statusDotReady]} />
                <Text style={styles.scannerStatus}>{scannerStatus.message}</Text>
              </View>

              <Text style={styles.densityNote}>
                Density: {density.gramsPerMl.toFixed(2)} g/ml · {density.label}
                {density.confidence === 'generic' ? ' · generic assumption' : ''}
              </Text>

              {capturedReading ? (
                <View style={styles.captureResult}>
                  <Text style={styles.captureResultLabel}>PORTION ESTIMATE</Text>
                  <View style={styles.captureValueRow}>
                    <Text style={styles.captureResultValue}>{Math.round(capturedGrams)} g</Text>
                    <Text style={styles.captureVolume}>{Math.round(capturedReading.estimatedVolumeMl)} ml</Text>
                  </View>
                  <Text style={styles.captureResultHint}>
                    Prototype estimate — verify against a kitchen scale while we calibrate the scanner on your S23+.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Use estimated grams"
                    onPress={useEstimate}
                    style={({ pressed }) => [styles.useButton, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.useButtonText}>{onEstimateGrams ? 'Use this amount' : `Use ~${Math.round(capturedGrams)} g`}</Text>
                  </Pressable>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Capture current portion estimate"
                disabled={!canCapture}
                onPress={captureEstimate}
                style={({ pressed }) => [
                  styles.captureButton,
                  !canCapture && styles.captureButtonDisabled,
                  pressed && canCapture && styles.buttonPressed
                ]}
              >
                <Crosshair size={18} color="#05251B" strokeWidth={2.4} />
                <Text style={styles.captureButtonText}>Capture estimate</Text>
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
  if (reading.estimatedVolumeMl < 8 || reading.estimateConfidence < 0.2) return 0;
  return reading.estimatedVolumeMl * density.gramsPerMl;
}

function estimateQuality(reading: PortionDepthReading | null) {
  if (!reading) return { label: 'Waiting', color: '#88928F' };
  const confidence = reading.estimateConfidence;
  if (confidence >= 0.72) return { label: 'Good', color: '#55E4AF' };
  if (confidence >= 0.46) return { label: 'Fair', color: '#F0CA6B' };
  return { label: 'Low', color: '#FF8B8B' };
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
  button: {
    minHeight: 44,
    borderRadius: 14,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F1F5F3'
  },
  buttonReady: { backgroundColor: '#42D8A0' },
  buttonPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#121817', fontSize: 13, fontWeight: '900' },
  buttonTextReady: { color: '#06241A' },
  status: { color: '#707B78', fontSize: 10.5, lineHeight: 16, marginTop: 9 },
  statusReady: { color: '#66CFA7' },

  scannerRoot: { flex: 1, backgroundColor: '#030505' },
  scannerShadeTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 150, backgroundColor: 'rgba(0,0,0,0.36)' },
  scannerShadeBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 390, backgroundColor: 'rgba(0,0,0,0.46)' },
  scannerOverlay: { flex: 1, justifyContent: 'space-between' },
  scannerHeader: { minHeight: 70, paddingHorizontal: 18, paddingTop: 8, flexDirection: 'row', alignItems: 'center' },
  scannerHeaderCopy: { flex: 1, paddingRight: 12 },
  scannerEyebrow: { color: '#55E4AF', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  scannerTitle: { color: '#F6F8F7', fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 2 },
  closeButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(10,15,14,0.72)', alignItems: 'center', justifyContent: 'center' },
  reticleWrap: { position: 'absolute', top: '30%', left: 0, right: 0, alignItems: 'center' },
  scanGuide: {
    width: 222,
    height: 176,
    borderRadius: 28,
    backgroundColor: 'rgba(5,18,14,0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  scanGuideCornerTL: { position: 'absolute', left: 0, top: 0, width: 38, height: 38, borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#58E6B1', borderTopLeftRadius: 20 },
  scanGuideCornerTR: { position: 'absolute', right: 0, top: 0, width: 38, height: 38, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#58E6B1', borderTopRightRadius: 20 },
  scanGuideCornerBL: { position: 'absolute', left: 0, bottom: 0, width: 38, height: 38, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#58E6B1', borderBottomLeftRadius: 20 },
  scanGuideCornerBR: { position: 'absolute', right: 0, bottom: 0, width: 38, height: 38, borderBottomWidth: 2, borderRightWidth: 2, borderColor: '#58E6B1', borderBottomRightRadius: 20 },
  reticleLabel: { color: '#D7F8EB', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8, marginTop: 10, backgroundColor: 'rgba(0,0,0,0.48)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  hud: { marginHorizontal: 14, marginBottom: 10, padding: 17, borderRadius: 25, backgroundColor: 'rgba(11,16,15,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  hudInstruction: { color: '#C9D1CE', fontSize: 11.5, lineHeight: 17 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 15 },
  scannerMetric: { width: '50%', marginBottom: 12 },
  scannerMetricRight: { alignItems: 'flex-end' },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricLabelRowRight: { justifyContent: 'flex-end' },
  readingLabel: { color: '#697572', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  metricValue: { fontSize: 21, lineHeight: 27, fontWeight: '900', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F0CA6B', marginRight: 8 },
  statusDotReady: { backgroundColor: '#55E4AF' },
  scannerStatus: { flex: 1, color: '#89938F', fontSize: 10.5, lineHeight: 15 },
  densityNote: { color: '#65716D', fontSize: 9.5, lineHeight: 14, marginTop: 9 },
  captureResult: { marginTop: 12, borderRadius: 17, padding: 13, backgroundColor: 'rgba(85,228,175,0.08)' },
  captureResultLabel: { color: '#55E4AF', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  captureValueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2 },
  captureResultValue: { color: '#F6F8F7', fontSize: 26, fontWeight: '900' },
  captureVolume: { color: '#98A49F', fontSize: 13, fontWeight: '800' },
  captureResultHint: { color: '#7C8985', fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  useButton: { minHeight: 40, borderRadius: 13, marginTop: 10, backgroundColor: '#193A30', alignItems: 'center', justifyContent: 'center' },
  useButtonText: { color: '#70EAB9', fontSize: 12, fontWeight: '900' },
  captureButton: { minHeight: 50, marginTop: 13, borderRadius: 16, backgroundColor: '#55E4AF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  captureButtonDisabled: { opacity: 0.34 },
  captureButtonText: { color: '#05251B', fontSize: 13, fontWeight: '900' }
});
