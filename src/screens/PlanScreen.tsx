import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bullet, Card, Metric, ScreenTitle, uiStyles } from '../components/UI';
import { theme } from '../theme';
import { Profile } from '../types';

export function PlanScreen({ profile }: { profile: Profile }) {
  const weeklyMinutes = profile.dailyMinutes * profile.focusDays;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle eyebrow="Module 1" title="Goal plan" subtitle="Turn the 90-day outcome into a small number of repeatable weekly actions." />
      <Card>
        <Text style={uiStyles.section}>Primary goal</Text>
        <Text style={styles.goal}>{profile.primaryGoal}</Text>
        <Text style={styles.label}>Success looks like</Text>
        <Text style={uiStyles.muted}>{profile.successDefinition}</Text>
      </Card>
      <View style={styles.metrics}>
        <Metric label="Focus days / week" value={profile.focusDays} />
        <Metric label="Planned time / week" value={weeklyMinutes} suffix="min" />
      </View>
      <Card>
        <Text style={uiStyles.section}>Weekly planning rules</Text>
        <Bullet>Choose one weekly outcome that clearly moves the main goal forward.</Bullet>
        <Bullet>Break that outcome into actions small enough to schedule.</Bullet>
        <Bullet>Decide the first action before the week begins.</Bullet>
        <Bullet>Leave some capacity unplanned so interruptions do not destroy the system.</Bullet>
        <Bullet>At the end of the week, keep what worked and simplify what did not.</Bullet>
      </Card>
      <Card>
        <Text style={uiStyles.section}>Why this matters</Text>
        <Text style={uiStyles.muted}>{profile.motivation || 'Add a clear personal reason in setup so the goal remains connected to something meaningful.'}</Text>
      </Card>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg }, content: { padding: 20, paddingTop: 32 },
  goal: { color: theme.text, fontSize: 21, lineHeight: 29, fontWeight: '900', marginBottom: 18 },
  label: { color: theme.green, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 },
  metrics: { flexDirection: 'row', marginHorizontal: -4, marginBottom: 12 }
});
