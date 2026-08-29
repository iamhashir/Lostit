import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Choice, Field, PrimaryButton, ScreenTitle } from '../components/UI';
import { theme } from '../theme';
import { ActivityLevel, Profile, SexForEstimate } from '../types';

const defaults: Profile = {
  age: 30,
  heightCm: 175,
  weightKg: 80,
  goalWeightKg: 72,
  sexForEstimate: 'male',
  activity: 'moderate',
  trainingDays: 4,
  equipment: 'Full gym',
  foods: 'Chicken, rice, eggs, yogurt, fruit, vegetables'
};

export function OnboardingScreen({
  onComplete
}: {
  onComplete: (profile: Profile) => void;
}) {
  const [form, setForm] = useState(defaults);

  const numeric = (key: keyof Profile, value: string) => {
    const n = Number(value.replace(',', '.'));
    setForm((p) => ({ ...p, [key]: Number.isFinite(n) ? n : 0 }));
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenTitle
        eyebrow="90-day setup"
        title="Build your fat-loss plan"
        subtitle="Enter a few basics. The app creates starting calorie, macro, training, habit, and tracking targets."
      />

      <Field
        label="Age"
        keyboardType="number-pad"
        value={String(form.age)}
        onChangeText={(v) => numeric('age', v)}
      />
      <Field
        label="Height (cm)"
        keyboardType="decimal-pad"
        value={String(form.heightCm)}
        onChangeText={(v) => numeric('heightCm', v)}
      />
      <Field
        label="Current weight (kg)"
        keyboardType="decimal-pad"
        value={String(form.weightKg)}
        onChangeText={(v) => numeric('weightKg', v)}
      />
      <Field
        label="Goal weight (kg)"
        keyboardType="decimal-pad"
        value={String(form.goalWeightKg)}
        onChangeText={(v) => numeric('goalWeightKg', v)}
      />

      <Text style={styles.label}>Sex used for calorie estimate</Text>
      <View style={styles.wrap}>
        {(['male', 'female'] as SexForEstimate[]).map((value) => (
          <Choice
            key={value}
            label={value === 'male' ? 'Male' : 'Female'}
            selected={form.sexForEstimate === value}
            onPress={() => setForm((p) => ({ ...p, sexForEstimate: value }))}
          />
        ))}
      </View>

      <Text style={styles.label}>Activity level</Text>
      <View style={styles.wrap}>
        {(
          [
            ['sedentary', 'Sedentary'],
            ['light', 'Light'],
            ['moderate', 'Moderate'],
            ['high', 'High']
          ] as [ActivityLevel, string][]
        ).map(([value, label]) => (
          <Choice
            key={value}
            label={label}
            selected={form.activity === value}
            onPress={() => setForm((p) => ({ ...p, activity: value }))}
          />
        ))}
      </View>

      <Text style={styles.label}>Strength-training days</Text>
      <View style={styles.wrap}>
        {[2, 3, 4, 5, 6].map((value) => (
          <Choice
            key={value}
            label={`${value} days`}
            selected={form.trainingDays === value}
            onPress={() => setForm((p) => ({ ...p, trainingDays: value }))}
          />
        ))}
      </View>

      <Field
        label="Equipment"
        value={form.equipment}
        onChangeText={(equipment) => setForm((p) => ({ ...p, equipment }))}
        placeholder="Full gym, dumbbells, home only..."
      />
      <Field
        label="Foods you like"
        multiline
        value={form.foods}
        onChangeText={(foods) => setForm((p) => ({ ...p, foods }))}
        placeholder="List foods you actually enjoy"
      />

      <View style={styles.note}>
        <Text style={styles.noteText}>
          This is a planning tool, not medical care. If you are pregnant, under 18,
          have an eating disorder history, or a medical condition affecting diet or
          exercise, use clinician-guided targets instead of automated estimates.
        </Text>
      </View>

      <PrimaryButton
        label="Create my 90-day plan"
        onPress={() => onComplete(form)}
        disabled={
          form.age < 18 ||
          form.heightCm <= 0 ||
          form.weightKg <= 0 ||
          form.goalWeightKg <= 0
        }
      />
      <View style={{ height: 36 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 58 },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10
  },
  label: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7
  },
  note: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5D5130',
    backgroundColor: '#252014',
    padding: 13,
    marginTop: 2
  },
  noteText: {
    color: '#D6CBAA',
    fontSize: 12,
    lineHeight: 18
  }
});
