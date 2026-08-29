import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, ScreenTitle, uiStyles } from '../components/UI';
import { theme } from '../theme';

const habits = [
  'Review today’s top priority',
  'Complete one focused work block',
  'Remove one avoidable distraction',
  'Do the smallest next action',
  'Capture loose tasks and ideas',
  'Review progress before ending the day',
  'Prepare tomorrow’s first action'
];

export function HabitsScreen() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle eyebrow="Module 4" title="Daily habit system" subtitle="Keep a small set of actions visible so consistency requires less decision-making." />
      <Card>
        <Text style={uiStyles.section}>Today</Text>
        {habits.map((habit) => {
          const checked = !!done[habit];
          return (
            <Pressable key={habit} style={styles.habit} onPress={() => setDone((p) => ({ ...p, [habit]: !checked }))}>
              <View style={[styles.box, checked && styles.boxChecked]}><Text style={styles.check}>{checked ? '✓' : ''}</Text></View>
              <Text style={[styles.habitText, checked && styles.habitDone]}>{habit}</Text>
            </Pressable>
          );
        })}
      </Card>
      <Card>
        <Text style={uiStyles.section}>Rules for difficult days</Text>
        <Text style={styles.rule}><Text style={styles.ruleTitle}>Too busy: </Text>Reduce the plan to one essential action instead of abandoning the day.</Text>
        <Text style={styles.rule}><Text style={styles.ruleTitle}>Distracted: </Text>Write the distraction down, close unnecessary apps, and restart with a short timer.</Text>
        <Text style={styles.rule}><Text style={styles.ruleTitle}>Missed day: </Text>Resume at the next opportunity. Do not create a backlog as punishment.</Text>
        <Text style={styles.rule}><Text style={styles.ruleTitle}>Unclear next step: </Text>Turn the goal into an action that can be started in under two minutes.</Text>
        <Text style={styles.rule}><Text style={styles.ruleTitle}>Low motivation: </Text>Use the minimum version of the routine and protect continuity.</Text>
      </Card>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg }, content: { padding: 20, paddingTop: 32 },
  habit: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }, box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  boxChecked: { backgroundColor: theme.green, borderColor: theme.green }, check: { color: '#04150F', fontWeight: '900' }, habitText: { color: theme.text, fontSize: 15, flex: 1 }, habitDone: { color: theme.muted, textDecorationLine: 'line-through' },
  rule: { color: theme.muted, fontSize: 14, lineHeight: 21, marginBottom: 12 }, ruleTitle: { color: theme.text, fontWeight: '900' }
});
