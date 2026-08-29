import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bullet, Card, ScreenTitle, uiStyles } from '../components/UI';
import { theme } from '../theme';

const phases = [
  ['Weeks 1–2', 'Calibration', 'Learn portions, establish step baseline, settle into training, and avoid changing calories based on early water-weight noise.'],
  ['Weeks 3–4', 'Consistency', 'Aim for repeatable adherence. Review weight trend, waist, hunger, and gym performance.'],
  ['Weeks 5–8', 'Build momentum', 'Keep strength stable, progress lifts where possible, and make only small calorie/activity adjustments if the trend stalls.'],
  ['Weeks 9–12', 'Finish sustainably', 'Protect recovery and avoid panic cuts. Keep the same behaviors that you can continue after day 90.'],
  ['Days 85–90', 'Transition', 'Review results, set maintenance or next-phase calories, and keep training rather than immediately rebounding into old habits.']
];

export function RoadmapScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle
        eyebrow="Module 6"
        title="90-day roadmap"
        subtitle="A week-by-week structure with deliberate checkpoints instead of constant changes."
      />

      {phases.map(([range, name, description]) => (
        <Card key={range}>
          <Text style={styles.range}>{range}</Text>
          <Text style={styles.name}>{name}</Text>
          <Text style={uiStyles.muted}>{description}</Text>
        </Card>
      ))}

      <Card>
        <Text style={uiStyles.section}>Adjustment hierarchy</Text>
        <Bullet>First check whether adherence was actually consistent.</Bullet>
        <Bullet>Then check 2–3 weeks of average weight and waist trend.</Bullet>
        <Bullet>Change only one or two variables at a time.</Bullet>
        <Bullet>Prefer a small calorie change or modest activity increase over an aggressive cut.</Bullet>
        <Bullet>Reverse course if recovery, performance, or well-being deteriorates materially.</Bullet>
      </Card>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 32 },
  range: { color: theme.green, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  name: { color: theme.text, fontSize: 20, fontWeight: '900', marginTop: 5, marginBottom: 8 }
});
