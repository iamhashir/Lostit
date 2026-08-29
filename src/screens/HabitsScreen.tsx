import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, ScreenTitle, uiStyles } from '../components/UI';
import { theme } from '../theme';

const habits = [
  'Hit protein target',
  'Stay near calorie target',
  'Reach step target',
  'Train or complete planned recovery',
  'Eat fruit/vegetables',
  'Hydrate consistently',
  'Protect sleep window'
];

export function HabitsScreen() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle
        eyebrow="Module 4"
        title="Make fat loss easier"
        subtitle="A repeatable daily system matters more than a perfect day."
      />

      <Card>
        <Text style={uiStyles.section}>Today</Text>
        {habits.map((habit) => {
          const checked = !!done[habit];
          return (
            <Pressable
              key={habit}
              style={styles.habit}
              onPress={() => setDone((p) => ({ ...p, [habit]: !checked }))}
            >
              <View style={[styles.box, checked && styles.boxChecked]}>
                <Text style={styles.check}>{checked ? '✓' : ''}</Text>
              </View>
              <Text style={[styles.habitText, checked && styles.habitDone]}>{habit}</Text>
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <Text style={uiStyles.section}>Rules for difficult situations</Text>
        <Text style={styles.rule}><Text style={styles.ruleTitle}>Eating out: </Text>Choose a protein-centered meal, add vegetables, and keep one indulgence rather than turning the meal into an all-day event.</Text>
        <Text style={styles.rule}><Text style={styles.ruleTitle}>Cravings: </Text>Delay 10–20 minutes, drink something, eat a planned high-protein snack, then decide deliberately.</Text>
        <Text style={styles.rule}><Text style={styles.ruleTitle}>Missed workout: </Text>Move it once if convenient. Otherwise continue the schedule; do not double the next session.</Text>
        <Text style={styles.rule}><Text style={styles.ruleTitle}>Weekend: </Text>Keep breakfast/lunch structured and reserve more calories for the social meal.</Text>
        <Text style={styles.rule}><Text style={styles.ruleTitle}>Bad day: </Text>Return to the next planned meal. Do not compensate with starvation or excessive cardio.</Text>
      </Card>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 32 },
  habit: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  box: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center', marginRight: 12
  },
  boxChecked: { backgroundColor: theme.green, borderColor: theme.green },
  check: { color: '#04150F', fontWeight: '900' },
  habitText: { color: theme.text, fontSize: 15, flex: 1 },
  habitDone: { color: theme.muted, textDecorationLine: 'line-through' },
  rule: { color: theme.muted, fontSize: 14, lineHeight: 21, marginBottom: 12 },
  ruleTitle: { color: theme.text, fontWeight: '900' }
});
