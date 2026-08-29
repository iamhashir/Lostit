import { Camera } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getPortionScannerSupportAsync,
  type PortionScannerSupport
} from '../modules/portion-scanner/src/PortionScanner';

type Props = {
  foodName: string;
};

export function PortionScannerEntry({ foodName }: Props) {
  const [checking, setChecking] = useState(false);
  const [support, setSupport] = useState<PortionScannerSupport | null>(null);

  const checkScanner = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Android prototype', 'The first depth-scanner prototype is being built for ARCore on Android.');
      return;
    }

    setChecking(true);
    try {
      const result = await getPortionScannerSupportAsync();
      setSupport(result);

      if (result.depthSupported) {
        Alert.alert(
          'Depth scanner ready',
          `ARCore Depth is available for ${foodName}. The native bridge is connected; the next layer is the live depth camera and volume measurement.`
        );
      } else {
        Alert.alert('Depth scanner unavailable', result.message);
      }
    } catch {
      Alert.alert('Scanner check failed', 'MealTrack could not check ARCore Depth on this device.');
    } finally {
      setChecking(false);
    }
  };

  const ready = support?.depthSupported === true;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconShell}>
          <Camera size={20} color="#42D8A0" strokeWidth={2.2} />
        </View>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Scan portion</Text>
            <View style={styles.betaPill}>
              <Text style={styles.betaText}>BETA</Text>
            </View>
          </View>
          <Text style={styles.description}>
            Use ARCore depth to measure the volume of {foodName}, then convert it to estimated grams.
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Check depth scanner for ${foodName}`}
        disabled={checking}
        onPress={checkScanner}
        style={({ pressed }) => [
          styles.button,
          ready && styles.buttonReady,
          pressed && styles.buttonPressed,
          checking && styles.buttonDisabled
        ]}
      >
        <Text style={[styles.buttonText, ready && styles.buttonTextReady]}>
          {checking ? 'Checking ARCore…' : ready ? 'Depth ready on this phone' : 'Check camera depth support'}
        </Text>
      </Pressable>

      {support ? (
        <Text style={[styles.status, ready && styles.statusReady]}>{support.message}</Text>
      ) : (
        <Text style={styles.status}>No AI recognition is used. You choose the food; depth is used only for geometry.</Text>
      )}
    </View>
  );
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
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { color: '#F5F7F5', fontSize: 16, fontWeight: '800' },
  betaPill: {
    marginLeft: 8,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: '#17372D'
  },
  betaText: { color: '#42D8A0', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  description: { color: '#929C99', fontSize: 13, lineHeight: 19, marginTop: 5 },
  button: {
    minHeight: 44,
    borderRadius: 14,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F3'
  },
  buttonReady: { backgroundColor: '#42D8A0' },
  buttonPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#121817', fontSize: 13, fontWeight: '900' },
  buttonTextReady: { color: '#06241A' },
  status: { color: '#707B78', fontSize: 11, lineHeight: 16, marginTop: 9 },
  statusReady: { color: '#66CFA7' }
});
