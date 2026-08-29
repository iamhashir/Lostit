import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bullet, Card, ScreenTitle, uiStyles } from '../components/UI';
import { theme } from '../theme';

const phases = [
  ['Weeks 1–2', 'Clarify', 'Define the outcome, remove ambiguity, establish a realistic weekly rhythm, and learn how much time the work actually takes.'],
  ['Weeks 3–4', 'Stabilize', 'Repeat the core routine until starting becomes easier. Keep the plan simple enough to survive busy days.'],
  ['Weeks 5–8', 'Build momentum', 'Increase the quality or difficulty of the work gradually while protecting the habits that are already reliable.'],
  ['Weeks 9–12', 'Finish deliberately', 'Prioritize the highest-impact remaining work, reduce distractions, and avoid unnecessary changes close to the finish.'],
  ['Days 85–90', 'Review and continue', 'Compare the result with the original definition of success, capture what worked, and decide the next cycle.']
];

export function RoadmapScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle eyebrow="Module 6" title="90-day roadmap" subtitle="Use a few deliberate phases instead of constantly redesigning the plan." />
      {phases.map(([range, name, description]) => (
        <Card key={range}><Text style={styles.range}>{range}</Text><Text style={styles.name}>{name}</Text><Text style={uiStyles.muted}>{description}</Text></Card>
      ))}
      <Card>
        <Text style={uiStyles.section}>Adjustment hierarchy</Text>
        <Bullet>Check whether the goal and next action are clear.</Bullet>
        <Bullet>Check whether the planned workload fits the time you actually have.</Bullet>
        <Bullet>Look at a full week of behavior before changing the system.</Bullet>
        <Bullet>Change one or two variables at a time.</Bullet>
        <Bullet>Prefer simplifying the process before adding more complexity.</Bullet>
      </Card>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg }, content: { padding: 20, paddingTop: 32 },
  range: { color: theme.green, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }, name: { color: theme.text, fontSize: 20, fontWeight: '900', marginTop: 5, marginBottom: 8 }
});
