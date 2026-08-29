import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bullet, Card, ScreenTitle, uiStyles } from '../components/UI';
import { theme } from '../theme';
import { Profile } from '../types';

const routines = {
  morning: ['Review the day’s single most important outcome', 'Start one focused block before reactive work', 'Capture distractions instead of following them'],
  evening: ['Close open loops from the day', 'Complete one focused block', 'Set tomorrow’s first action before stopping'],
  split: ['Short planning block early', 'Main focus block when attention is strongest', 'Five-minute review at the end of the day'],
  flexible: ['Choose the day’s best available focus window', 'Protect one uninterrupted block', 'Do a brief review before the day ends']
} as const;

export function RoutineScreen({ profile }: { profile: Profile }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle eyebrow="Module 2" title="Daily routine" subtitle={`A ${profile.routineStyle} structure built around about ${profile.dailyMinutes} focused minutes.`} />
      <Card>
        <Text style={uiStyles.section}>Default sequence</Text>
        {routines[profile.routineStyle].map((item) => <Bullet key={item}>{item}</Bullet>)}
      </Card>
      <Card>
        <Text style={uiStyles.section}>Minimum viable day</Text>
        <Text style={styles.emphasis}>When the full routine is unrealistic, keep a 10-minute version.</Text>
        <Bullet>Open the project or task.</Bullet>
        <Bullet>Write the next concrete action.</Bullet>
        <Bullet>Work on it without switching tasks until the timer ends.</Bullet>
        <Bullet>Record what should happen next.</Bullet>
      </Card>
      <Card>
        <Text style={uiStyles.section}>Known obstacles</Text>
        <Text style={uiStyles.muted}>{profile.obstacles || 'No obstacles were entered during setup. Add them later when patterns become obvious.'}</Text>
      </Card>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg }, content: { padding: 20, paddingTop: 32 },
  emphasis: { color: theme.text, fontSize: 17, fontWeight: '900', lineHeight: 24, marginBottom: 14 }
});
