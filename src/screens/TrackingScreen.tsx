import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, ProgressBar, ScreenTitle, uiStyles } from '../components/UI';
import { theme } from '../theme';
import { Profile, WeightEntry } from '../types';

export function TrackingScreen({
  profile,
  weights,
  onAddWeight
}: {
  profile: Profile;
  weights: WeightEntry[];
  onAddWeight: (kg: number) => void;
}) {
  const [value, setValue] = useState('');
  const last7 = weights.slice(-7);
  const average = useMemo(() => {
    if (!last7.length) return profile.weightKg;
    return last7.reduce((s, x) => s + x.weightKg, 0) / last7.length;
  }, [last7, profile.weightKg]);

  const totalGoal = Math.max(0.1, profile.weightKg - profile.goalWeightKg);
  const lost = Math.max(0, profile.weightKg - average);
  const progress = Math.min(100, (lost / totalGoal) * 100);

  const add = () => {
    const kg = Number(value.replace(',', '.'));
    if (Number.isFinite(kg) && kg > 0) {
      onAddWeight(kg);
      setValue('');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle
        eyebrow="Module 5"
        title="Track the transformation"
        subtitle="Use trends across weight, waist, performance, steps, sleep, and adherence."
      />

      <Card>
        <Text style={uiStyles.section}>Log body weight</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder="e.g. 79.4"
            placeholderTextColor="#667176"
            style={styles.input}
          />
          <Pressable style={styles.addButton} onPress={add}>
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        </View>
        <Text style={[uiStyles.muted, { marginTop: 10 }]}>
          Current 7-entry average: {average.toFixed(1)} kg
        </Text>
        <View style={{ marginTop: 12 }}>
          <ProgressBar value={progress} />
        </View>
      </Card>

      <Card>
        <Text style={uiStyles.section}>Recent weigh-ins</Text>
        {weights.length === 0 ? (
          <Text style={uiStyles.muted}>No entries yet.</Text>
        ) : (
          weights.slice(-10).reverse().map((entry) => (
            <View style={styles.entry} key={`${entry.day}-${entry.weightKg}`}>
              <Text style={styles.entryDay}>Day {entry.day}</Text>
              <Text style={styles.entryWeight}>{entry.weightKg.toFixed(1)} kg</Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text style={uiStyles.section}>Weekly review questions</Text>
        {[
          'What was my 7-day average weight and how did it change?',
          'Did my waist measurement change?',
          'Was strength mostly stable?',
          'How many days did I hit calories and protein?',
          'What was my average daily step count?',
          'How was sleep, hunger, mood, and energy?',
          'What is the smallest useful adjustment for next week?'
        ].map((q, i) => (
          <Text style={styles.question} key={q}>{i + 1}. {q}</Text>
        ))}
      </Card>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 32 },
  inputRow: { flexDirection: 'row' },
  input: {
    flex: 1, backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border,
    borderRadius: 14, color: theme.text, paddingHorizontal: 14, fontSize: 16
  },
  addButton: {
    marginLeft: 9, minWidth: 70, borderRadius: 14, backgroundColor: theme.green,
    alignItems: 'center', justifyContent: 'center'
  },
  addText: { color: '#03150E', fontWeight: '900' },
  entry: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  entryDay: { color: theme.muted },
  entryWeight: { color: theme.text, fontWeight: '800' },
  question: { color: theme.text, fontSize: 14, lineHeight: 21, marginBottom: 9 }
});
