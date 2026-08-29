import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import {
  Card,
  Metric,
  ProgressBar,
  ScreenTitle,
  uiStyles
} from '../components/UI';
import { theme } from '../theme';
import { AppScreen, MacroTargets, Profile, WeightEntry } from '../types';
import { safeWeeklyLossRange } from '../utils/nutrition';

const sections: { key: AppScreen; title: string; subtitle: string; number: string }[] = [
  { key: 'nutrition', title: 'Calories & macros', subtitle: 'Starting targets + adjustment rules', number: '01' },
  { key: 'meals', title: 'Meal plan', subtitle: 'Practical meals, swaps, snacks, hydration', number: '02' },
  { key: 'training', title: 'Training plan', subtitle: 'Strength, cardio, progression, recovery', number: '03' },
  { key: 'habits', title: 'Daily system', subtitle: 'Steps, sleep, hunger and weekends', number: '04' },
  { key: 'tracking', title: 'Track progress', subtitle: 'Weight trend, waist, strength, adherence', number: '05' },
  { key: 'roadmap', title: '90-day roadmap', subtitle: 'Weekly phases and review rules', number: '06' }
];

export function HomeScreen({
  profile,
  macros,
  weights,
  onNavigate
}: {
  profile: Profile;
  macros: MacroTargets;
  weights: WeightEntry[];
  onNavigate: (screen: AppScreen) => void;
}) {
  const latest = weights.length ? weights[weights.length - 1]!.weightKg : profile.weightKg;
  const lost = Math.max(0, profile.weightKg - latest);
  const totalGoal = Math.max(0.1, profile.weightKg - profile.goalWeightKg);
  const progress = Math.min(100, (lost / totalGoal) * 100);
  const weekly = safeWeeklyLossRange(profile.weightKg);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle
        eyebrow="FatLoss 90"
        title="Your master plan"
        subtitle={`A sustainable starting plan built around ${profile.trainingDays} training days per week.`}
      />

      <Card>
        <View style={styles.row}>
          <View>
            <Text style={styles.small}>Goal progress</Text>
            <Text style={styles.big}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.goalRight}>
            <Text style={styles.small}>Current</Text>
            <Text style={styles.goalWeight}>{latest.toFixed(1)} kg</Text>
          </View>
        </View>
        <ProgressBar value={progress} />
        <Text style={[uiStyles.muted, { marginTop: 10 }]}>
          A reasonable initial trend for many adults is roughly {weekly.low}–{weekly.high} kg/week.
          Adjust using several weeks of trend data, not a single weigh-in.
        </Text>
      </Card>

      <View style={styles.metrics}>
        <Metric label="Daily calories" value={macros.calories} suffix="kcal" />
        <Metric label="Protein" value={macros.protein} suffix="g" />
      </View>

      <Text style={styles.heading}>Plan modules</Text>

      {sections.map((item) => (
        <Pressable key={item.key} onPress={() => onNavigate(item.key)}>
          {({ pressed }) => (
            <View style={[styles.module, pressed && { opacity: 0.78 }]}>
              <Text style={styles.number}>{item.number}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.moduleTitle}>{item.title}</Text>
                <Text style={styles.moduleSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </View>
          )}
        </Pressable>
      ))}

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 32 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  small: { color: theme.muted, fontSize: 12, fontWeight: '700' },
  big: { color: theme.text, fontSize: 36, fontWeight: '900', marginTop: 2 },
  goalRight: { alignItems: 'flex-end' },
  goalWeight: { color: theme.green, fontSize: 19, fontWeight: '900', marginTop: 6 },
  metrics: { flexDirection: 'row', marginHorizontal: -4, marginBottom: 12 },
  heading: { color: theme.text, fontSize: 19, fontWeight: '900', marginBottom: 10, marginTop: 4 },
  module: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    padding: 15,
    marginBottom: 10
  },
  number: { color: theme.green, fontSize: 12, fontWeight: '900', width: 34 },
  moduleTitle: { color: theme.text, fontSize: 16, fontWeight: '900' },
  moduleSubtitle: { color: theme.muted, fontSize: 12, marginTop: 4 },
  arrow: { color: theme.muted, fontSize: 30, marginLeft: 8, marginTop: -3 }
});
