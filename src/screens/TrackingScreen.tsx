import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, ProgressBar, ScreenTitle, uiStyles } from '../components/UI';
import { theme } from '../theme';
import { ProgressEntry } from '../types';

export function TrackingScreen({ entries, onAdd }: { entries: ProgressEntry[]; onAdd: (score: number, note?: string) => void }) {
  const [score, setScore] = useState('');
  const [note, setNote] = useState('');
  const recent = entries.slice(-7);
  const average = useMemo(() => recent.length ? recent.reduce((sum, item) => sum + item.score, 0) / recent.length : 0, [recent]);

  const add = () => {
    const value = Number(score);
    if (Number.isFinite(value) && value >= 0 && value <= 100) {
      onAdd(value, note.trim() || undefined);
      setScore('');
      setNote('');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle eyebrow="Module 5" title="Track progress" subtitle="Log a quick consistency score and use weekly reflection to decide what changes next." />
      <Card>
        <Text style={uiStyles.section}>Daily check-in</Text>
        <View style={styles.inputRow}>
          <TextInput value={score} onChangeText={setScore} keyboardType="number-pad" placeholder="0–100" placeholderTextColor="#667176" style={styles.input} />
          <Pressable style={styles.addButton} onPress={add}><Text style={styles.addText}>Add</Text></Pressable>
        </View>
        <TextInput value={note} onChangeText={setNote} placeholder="Optional note: what helped or got in the way?" placeholderTextColor="#667176" style={[styles.input, { marginTop: 10 }]} />
        <Text style={[uiStyles.muted, { marginTop: 10 }]}>Recent average: {Math.round(average)}%</Text>
        <View style={{ marginTop: 12 }}><ProgressBar value={average} /></View>
      </Card>
      <Card>
        <Text style={uiStyles.section}>Recent entries</Text>
        {entries.length === 0 ? <Text style={uiStyles.muted}>No entries yet.</Text> : entries.slice(-10).reverse().map((entry) => (
          <View style={styles.entry} key={`${entry.day}-${entry.score}`}><View><Text style={styles.entryDay}>Day {entry.day}</Text>{entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}</View><Text style={styles.entryScore}>{entry.score}%</Text></View>
        ))}
      </Card>
      <Card>
        <Text style={uiStyles.section}>Weekly review</Text>
        {['What moved the goal forward most this week?','Which actions were easy to repeat?','Where did I lose time or attention?','What should I stop, start, or simplify?','Is the goal still clear and important?','What is next week’s single most important outcome?','What is the smallest useful adjustment?'].map((q, i) => <Text style={styles.question} key={q}>{i + 1}. {q}</Text>)}
      </Card>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg }, content: { padding: 20, paddingTop: 32 }, inputRow: { flexDirection: 'row' },
  input: { flex: 1, backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border, borderRadius: 14, color: theme.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  addButton: { marginLeft: 9, minWidth: 70, borderRadius: 14, backgroundColor: theme.green, alignItems: 'center', justifyContent: 'center' }, addText: { color: '#03150E', fontWeight: '900' },
  entry: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }, entryDay: { color: theme.text, fontWeight: '800' }, entryScore: { color: theme.green, fontWeight: '900' }, note: { color: theme.muted, fontSize: 12, marginTop: 3, maxWidth: 240 },
  question: { color: theme.text, fontSize: 14, lineHeight: 21, marginBottom: 9 }
});
