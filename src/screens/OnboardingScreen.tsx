import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Choice, Field, PrimaryButton, ScreenTitle } from '../components/UI';
import { theme } from '../theme';
import { Profile, RoutineStyle } from '../types';

const defaults: Profile = {
  name: '',
  primaryGoal: '',
  successDefinition: '',
  motivation: '',
  dailyMinutes: 45,
  focusDays: 5,
  routineStyle: 'flexible',
  obstacles: ''
};

export function OnboardingScreen({ onComplete }: { onComplete: (profile: Profile) => void }) {
  const [form, setForm] = useState(defaults);
  const numeric = (key: 'dailyMinutes' | 'focusDays', value: string) => {
    const n = Number(value);
    setForm((p) => ({ ...p, [key]: Number.isFinite(n) ? n : 0 }));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenTitle eyebrow="90-day setup" title="Build your focus system" subtitle="Choose one meaningful goal and turn it into a plan you can actually follow." />
      <Field label="Name (optional)" value={form.name} onChangeText={(name) => setForm((p) => ({ ...p, name }))} placeholder="What should the app call you?" />
      <Field label="Primary goal" multiline value={form.primaryGoal} onChangeText={(primaryGoal) => setForm((p) => ({ ...p, primaryGoal }))} placeholder="What do you want to accomplish in the next 90 days?" />
      <Field label="What does success look like?" multiline value={form.successDefinition} onChangeText={(successDefinition) => setForm((p) => ({ ...p, successDefinition }))} placeholder="Describe a clear result you could recognize." />
      <Field label="Why does this matter?" multiline value={form.motivation} onChangeText={(motivation) => setForm((p) => ({ ...p, motivation }))} placeholder="Your reason for sticking with it." />
      <Field label="Minutes available on a normal day" keyboardType="number-pad" value={String(form.dailyMinutes)} onChangeText={(v) => numeric('dailyMinutes', v)} />
      <Text style={styles.label}>Focus days per week</Text>
      <View style={styles.wrap}>{[3,4,5,6,7].map((value) => <Choice key={value} label={`${value} days`} selected={form.focusDays === value} onPress={() => setForm((p) => ({ ...p, focusDays: value }))} />)}</View>
      <Text style={styles.label}>Preferred routine</Text>
      <View style={styles.wrap}>{(['morning','evening','split','flexible'] as RoutineStyle[]).map((value) => <Choice key={value} label={value[0]!.toUpperCase() + value.slice(1)} selected={form.routineStyle === value} onPress={() => setForm((p) => ({ ...p, routineStyle: value }))} />)}</View>
      <Field label="Common obstacles" multiline value={form.obstacles} onChangeText={(obstacles) => setForm((p) => ({ ...p, obstacles }))} placeholder="Busy days, distractions, low energy, unclear priorities..." />
      <PrimaryButton label="Create my 90-day plan" onPress={() => onComplete(form)} disabled={!form.primaryGoal.trim() || !form.successDefinition.trim() || form.dailyMinutes <= 0} />
      <View style={{ height: 36 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 58 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  label: { color: theme.text, fontSize: 13, fontWeight: '800', marginBottom: 7 }
});
