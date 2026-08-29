import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Metric, ProgressBar, ScreenTitle, uiStyles } from '../components/UI';
import { theme } from '../theme';
import { AppScreen, Profile, ProgressEntry } from '../types';

const sections: { key: AppScreen; title: string; subtitle: string; number: string }[] = [
  { key: 'plan', title: 'Goal plan', subtitle: 'Turn the outcome into weekly actions', number: '01' },
  { key: 'routine', title: 'Daily routine', subtitle: 'Create a repeatable default day', number: '02' },
  { key: 'focus', title: 'Focus sessions', subtitle: 'Use your available time deliberately', number: '03' },
  { key: 'habits', title: 'Habit system', subtitle: 'Keep the essentials visible and simple', number: '04' },
  { key: 'tracking', title: 'Progress review', subtitle: 'Log consistency and reflect on results', number: '05' },
  { key: 'roadmap', title: '90-day roadmap', subtitle: 'Work through clear phases and checkpoints', number: '06' }
];

export function HomeScreen({ profile, entries, onNavigate }: { profile: Profile; entries: ProgressEntry[]; onNavigate: (screen: AppScreen) => void }) {
  const average = entries.length ? entries.slice(-7).reduce((sum, entry) => sum + entry.score, 0) / Math.min(entries.length, 7) : 0;
  const progress = Math.round(average);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle eyebrow="Lostit" title="Your 90-day focus system" subtitle={profile.primaryGoal} />
      <Card>
        <View style={styles.row}>
          <View><Text style={styles.small}>Recent consistency</Text><Text style={styles.big}>{progress}%</Text></View>
          <View style={styles.goalRight}><Text style={styles.small}>Weekly rhythm</Text><Text style={styles.goalValue}>{profile.focusDays} focus days</Text></View>
        </View>
        <ProgressBar value={progress} />
        <Text style={[uiStyles.muted, { marginTop: 10 }]}>{entries.length ? 'Use this score as a reflection tool, not a grade. Look for patterns and make the smallest useful adjustment.' : 'Start logging quick daily scores to make your progress visible.'}</Text>
      </Card>
      <View style={styles.metrics}>
        <Metric label="Daily focus time" value={profile.dailyMinutes} suffix="min" />
        <Metric label="Entries logged" value={entries.length} />
      </View>
      <Text style={styles.heading}>Plan modules</Text>
      {sections.map((item) => (
        <Pressable key={item.key} onPress={() => onNavigate(item.key)}>
          {({ pressed }) => (
            <View style={[styles.module, pressed && { opacity: 0.78 }]}>
              <Text style={styles.number}>{item.number}</Text>
              <View style={{ flex: 1 }}><Text style={styles.moduleTitle}>{item.title}</Text><Text style={styles.moduleSubtitle}>{item.subtitle}</Text></View>
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
  container: { flex: 1, backgroundColor: theme.bg }, content: { padding: 20, paddingTop: 32 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }, small: { color: theme.muted, fontSize: 12, fontWeight: '700' },
  big: { color: theme.text, fontSize: 36, fontWeight: '900', marginTop: 2 }, goalRight: { alignItems: 'flex-end' }, goalValue: { color: theme.green, fontSize: 17, fontWeight: '900', marginTop: 6 },
  metrics: { flexDirection: 'row', marginHorizontal: -4, marginBottom: 12 }, heading: { color: theme.text, fontSize: 19, fontWeight: '900', marginBottom: 10, marginTop: 4 },
  module: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 18, padding: 15, marginBottom: 10 },
  number: { color: theme.green, fontSize: 12, fontWeight: '900', width: 34 }, moduleTitle: { color: theme.text, fontSize: 16, fontWeight: '900' }, moduleSubtitle: { color: theme.muted, fontSize: 12, marginTop: 4 }, arrow: { color: theme.muted, fontSize: 30, marginLeft: 8, marginTop: -3 }
});
