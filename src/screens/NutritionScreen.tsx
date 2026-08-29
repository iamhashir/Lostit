import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bullet, Card, Metric, ScreenTitle, uiStyles } from '../components/UI';
import { theme } from '../theme';
import { MacroTargets, Profile } from '../types';
import { safeWeeklyLossRange } from '../utils/nutrition';

export function NutritionScreen({
  profile,
  macros
}: {
  profile: Profile;
  macros: MacroTargets;
}) {
  const weekly = safeWeeklyLossRange(profile.weightKg);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle
        eyebrow="Module 1"
        title="Calories & macros"
        subtitle="Use ranges and trend-based adjustments instead of pretending calorie estimates are exact."
      />

      <Card>
        <Text style={uiStyles.section}>Starting targets</Text>
        <View style={styles.metrics}>
          <Metric label="Maintenance estimate" value={macros.maintenance} suffix="kcal" />
          <Metric label="Fat-loss target" value={macros.calories} suffix="kcal" />
          <Metric label="Protein" value={macros.protein} suffix="g" />
          <Metric label="Carbs" value={macros.carbs} suffix="g" />
          <Metric label="Fat" value={macros.fat} suffix="g" />
        </View>
      </Card>

      <Card>
        <Text style={uiStyles.section}>How to adjust</Text>
        <Bullet>Track morning body weight consistently and judge the 7-day average.</Bullet>
        <Bullet>
          A reasonable initial loss range is about {weekly.low}–{weekly.high} kg per week for your current weight.
        </Bullet>
        <Bullet>
          If the average is flat for 2–3 weeks and adherence is good, reduce intake by about 100–200 kcal/day or add modest activity.
        </Bullet>
        <Bullet>
          If weight is falling too quickly for multiple weeks, performance is dropping, or hunger is excessive, add roughly 100–200 kcal/day.
        </Bullet>
        <Bullet>Keep protein high while dieting and spread it across 3–5 meals.</Bullet>
      </Card>

      <Card>
        <Text style={uiStyles.section}>Why the scale moves</Text>
        <Text style={uiStyles.muted}>
          Carbohydrate intake, sodium, digestion, hydration, sleep, stress, and training can shift scale weight without reflecting a matching change in body fat.
        </Text>
      </Card>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 32 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }
});
