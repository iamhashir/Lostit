import React, { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View
} from 'react-native';
import { theme } from '../theme';

export function ScreenTitle({
  eyebrow,
  title,
  subtitle
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  style
}: {
  children: ReactNode;
  style?: object;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !disabled && { opacity: 0.82 },
        disabled && { opacity: 0.45 }
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function Choice({
  label,
  selected,
  onPress
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.choice,
        selected && { borderColor: theme.green, backgroundColor: theme.greenSoft }
      ]}
    >
      <Text style={[styles.choiceText, selected && { color: theme.text }]}> 
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#667176"
        {...props}
        style={[styles.input, props.multiline && { minHeight: 88, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export function Metric({
  label,
  value,
  suffix
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>
        {value}
        {suffix ? <Text style={styles.metricSuffix}> {suffix}</Text> : null}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function ProgressBar({
  value,
  max = 100
}: {
  value: number;
  max?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

export function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  body: {
    color: theme.text,
    fontSize: 15,
    lineHeight: 22
  },
  muted: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 21
  },
  section: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10
  }
});

const styles = StyleSheet.create({
  eyebrow: {
    color: theme.green,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 7
  },
  title: {
    color: theme.text,
    fontWeight: '900',
    fontSize: 31,
    lineHeight: 36
  },
  subtitle: {
    color: theme.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8
  },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14
  },
  primaryButton: {
    backgroundColor: theme.green,
    borderRadius: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 8
  },
  primaryButtonText: {
    color: '#02130D',
    fontSize: 16,
    fontWeight: '900'
  },
  choice: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: theme.surface
  },
  choiceText: {
    color: theme.muted,
    fontWeight: '700'
  },
  label: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    backgroundColor: theme.surface2,
    color: theme.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  metric: {
    flex: 1,
    minWidth: 120,
    padding: 12,
    borderRadius: 15,
    backgroundColor: theme.surface2,
    margin: 4
  },
  metricValue: {
    color: theme.text,
    fontSize: 23,
    fontWeight: '900'
  },
  metricSuffix: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  metricLabel: {
    color: theme.muted,
    fontSize: 12,
    marginTop: 4
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#263034',
    borderRadius: 999,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.green,
    borderRadius: 999
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 9
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: theme.green,
    marginTop: 8,
    marginRight: 10
  },
  body: {
    color: theme.text,
    fontSize: 15,
    lineHeight: 22,
    flex: 1
  }
});
