import { Camera, Crosshair, X } from 'lucide-react-native';
import React, { useState } from 'react';
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
};

export function PortionScannerEntry({ foodName }: Props) {
  const [checking, setChecking] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [support, setSupport] = useState<PortionScannerSupport | null>(null);
  const [reading, setReading] = useState<PortionDepthReading | null>(null);
  const [capturedReading, setCapturedReading] = useState<PortionDepthReading | null>(null);
  const [scannerStatus, setScannerStatus] = useState<PortionScannerStatusEvent>({
    state: 'idle',
    message: 'Move slowly around the plate when the scanner opens.'
  });

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

  const quality = depthQuality(reading?.coverage ?? 0);
  const ready = support?.depthSupported === true;

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
              Open a live ARCore depth camera for {foodName}. This first build measures real camera distance before we turn the 3D surface into volume and grams.
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
            {checking ? 'Checking ARCore…' : ready ? 'Open depth camera' : 'Start depth scanner'}
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
                <Text style={styles.scannerEyebrow}>ARCORE DEPTH</Text>
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
              <View style={styles.reticleOuter}>
                <Crosshair size={34} color="#58E6B1" strokeWidth={1.8} />
              </View>
              <Text style={styles.reticleLabel}>KEEP ON FOOD</Text>
            </View>

            <View style={styles.hud}>
              <Text style={styles.hudInstruction}>
                Move slowly around the plate. Keep the center marker on the same food surface.
              </Text>

              <View style={styles.readingRow}>
                <View style={styles.readingBlock}>
                  <Text style={styles.readingLabel}>CENTER DEPTH</Text>
                  <Text style={styles.readingValue}>
                    {reading ? `${reading.distanceCm.toFixed(1)} cm` : '—'}
                  </Text>
                </View>
                <View style={styles.readingBlockRight}>
                  <Text style={styles.readingLabel}>DEPTH QUALITY</Text>
                  <Text style={[styles.qualityValue, { color: quality.color }]}>{quality.label}</Text>
                </View>
              </View>

              <View style={styles.statusRow}>
                <View style={[styles.statusDot, scannerStatus.state === 'tracking' && styles.statusDotReady]} />
                <Text style={styles.scannerStatus}>{scannerStatus.message}</Text>
              </View>

              {capturedReading ? (
                <View style={styles.captureResult}>
                  <Text style={styles.captureResultLabel}>TEST POINT CAPTURED</Text>
                  <Text style={styles.captureResultValue}>{capturedReading.distanceCm.toFixed(1)} cm</Text>
                  <Text style={styles.captureResultHint}>
                    This proves live depth is reaching MealTrack. Volume and gram estimation comes next.
                  </Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Capture current depth test point"
                disabled={!reading}
                onPress={() => reading && setCapturedReading(reading)}
                style={({ pressed }) => [
                  styles.captureButton,
                  !reading && styles.captureButtonDisabled,
                  pressed && reading && styles.buttonPressed
                ]}
              >
                <Crosshair size={18} color="#05251B" strokeWidth={2.4} />
                <Text style={styles.captureButtonText}>Capture test point</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

function depthQuality(coverage: number) {
  if (coverage >= 0.7) return { label: 'Good', color: '#55E4AF' };
  if (coverage >= 0.35) return { label: 'Fair', color: '#F0CA6B' };
  return { label: 'Low', color: '#FF8B8B' };
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
  scannerShadeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.36)'
  },
  scannerShadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 330,
    backgroundColor: 'rgba(0,0,0,0.42)'
  },
  scannerOverlay: { flex: 1, justifyContent: 'space-between' },
  scannerHeader: {
    minHeight: 70,
    paddingHorizontal: 18,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  scannerHeaderCopy: { flex: 1, paddingRight: 12 },
  scannerEyebrow: { color: '#55E4AF', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  scannerTitle: { color: '#F6F8F7', fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 2 },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(10,15,14,0.72)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  reticleWrap: { position: 'absolute', top: '38%', alignSelf: 'center', alignItems: 'center' },
  reticleOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'rgba(85,228,175,0.50)',
    backgroundColor: 'rgba(5,18,14,0.14)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  reticleLabel: {
    color: '#D7F8EB',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 9,
    backgroundColor: 'rgba(0,0,0,0.46)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  hud: {
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 17,
    borderRadius: 25,
    backgroundColor: 'rgba(11,16,15,0.93)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)'
  },
  hudInstruction: { color: '#C9D1CE', fontSize: 12.5, lineHeight: 18 },
  readingRow: { flexDirection: 'row', marginTop: 16 },
  readingBlock: { flex: 1 },
  readingBlockRight: { flex: 1, alignItems: 'flex-end' },
  readingLabel: { color: '#697572', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  readingValue: { color: '#F6F8F7', fontSize: 26, lineHeight: 32, fontWeight: '900', marginTop: 2 },
  qualityValue: { fontSize: 20, lineHeight: 28, fontWeight: '900', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 13 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F0CA6B', marginRight: 8 },
  statusDotReady: { backgroundColor: '#55E4AF' },
  scannerStatus: { flex: 1, color: '#89938F', fontSize: 10.5, lineHeight: 15 },
  captureResult: {
    marginTop: 14,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(85,228,175,0.08)'
  },
  captureResultLabel: { color: '#55E4AF', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  captureResultValue: { color: '#F6F8F7', fontSize: 20, fontWeight: '900', marginTop: 3 },
  captureResultHint: { color: '#7C8985', fontSize: 10, lineHeight: 14, marginTop: 3 },
  captureButton: {
    minHeight: 50,
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#55E4AF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  captureButtonDisabled: { opacity: 0.38 },
  captureButtonText: { color: '#05251B', fontSize: 13, fontWeight: '900' }
});
