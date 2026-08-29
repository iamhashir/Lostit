import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bullet, Card, ScreenTitle, uiStyles } from '../components/UI';
import { theme } from '../theme';
import { Profile } from '../types';

export function FocusScreen({ profile }: { profile: Profile }) {
  const block = Math.max(15, Math.min(60, profile.dailyMinutes));
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle eyebrow="Module 3" title="Focus sessions" subtitle="Make progress by protecting a small amount of deliberate attention instead of waiting for the perfect day." />
      <Card>
        <Text style={uiStyles.section}>Default session</Text>
        <Text style={styles.timer}>{block} min</Text>
        <Bullet>Define one concrete finish line before starting.</Bullet>
        <Bullet>Silence notifications and close anything unrelated.</Bullet>
        <Bullet>Work on one task until the block ends or the finish line is reached.</Bullet>
        <Bullet>Write the next action before switching away.</Bullet>
      </Card>
      <Card>
        <Text style={uiStyles.section}>If you have more time</Text>
        <Bullet>Take a short break after the first block.</Bullet>
        <Bullet>Use a second block for the next highest-impact action.</Bullet>
        <Bullet>Stop adding blocks when attention quality drops sharply.</Bullet>
      </Card>
      <Card>
        <Text style={uiStyles.section}>Session rules</Text>
        <Text style={uiStyles.muted}>The target is not maximum busyness. The target is enough uninterrupted work on the right thing, repeated often enough to compound.</Text>
      </Card>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg }, content: { padding: 20, paddingTop: 32 },
  timer: { color: theme.green, fontSize: 42, fontWeight: '900', marginBottom: 18 }
});
