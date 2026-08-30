from pathlib import Path
import re

path = Path('src/PortionScannerEntry.tsx')
s = path.read_text()

s = s.replace('reading && reading.rawVolumeMl > 0', 'reading && (reading.rawVolumeMl ?? 0) > 0')
s = s.replace('reading?.rawVolumeMl > 0', '(reading?.rawVolumeMl ?? 0) > 0')
s = s.replace('reading.rawVolumeMl > 0', '(reading.rawVolumeMl ?? 0) > 0')
s = s.replace('Math.round(reading.rawVolumeMl)', 'Math.round(reading.rawVolumeMl ?? 0)')

old_status = '''                <View style={[
                  styles.statusDot,
                  assessment.ready && styles.statusDotReady,
                  !assessment.ready && reading && styles.statusDotWarning
                ]} />'''
new_status = '''                <View style={[
                  styles.statusDot,
                  canCapture && styles.statusDotReady,
                  !canCapture && reading && styles.statusDotWarning
                ]} />'''
if old_status not in s:
    raise SystemExit('Missing status-dot assessment block')
s = s.replace(old_status, new_status, 1)

pattern = r'''function estimateGrams\(reading: PortionDepthReading, density: DensityEstimate\) \{.*?\n\}'''
replacement = '''function estimateGrams(reading: PortionDepthReading, density: DensityEstimate) {
  const rawVolumeMl = reading.rawVolumeMl ?? 0;
  const volumeMl = rawVolumeMl > 0 ? rawVolumeMl : reading.estimatedVolumeMl;
  if (volumeMl <= 0) return 0;
  return volumeMl * density.gramsPerMl;
}'''
s, count = re.subn(pattern, replacement, s, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'estimateGrams fix failed ({count})')

path.write_text(s)
