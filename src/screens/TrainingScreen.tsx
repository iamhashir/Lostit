import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bullet, Card, ScreenTitle, uiStyles } from '../components/UI';
import { theme } from '../theme';
import { Profile } from '../types';

const fourDay = [
  ['Day 1 — Upper A', ['Bench press 3×5–8', 'Row 3×6–10', 'Overhead press 2×6–10', 'Pulldown 2×8–12', 'Lateral raise 2×12–20', 'Curl + triceps 2×10–15']],
  ['Day 2 — Lower A', ['Squat 3×5–8', 'Romanian deadlift 3×6–10', 'Leg press 2×8–12', 'Leg curl 2×10–15', 'Calves 2×10–15']],
  ['Day 3 — Upper B', ['Incline press 3×6–10', 'Chest-supported row 3×6–10', 'Pulldown 2×8–12', 'Machine press 2×8–12', 'Lateral raise 2×12–20', 'Curl + triceps 2×10–15']],
  ['Day 4 — Lower B', ['Deadlift or hinge 2×4–6', 'Front/hack squat 3×6–10', 'Split squat 2×8–12', 'Leg curl 2×10–15', 'Calves 2×10–15']]
];

export function TrainingScreen({ profile }: { profile: Profile }) {
  const visibleDays = Math.min(profile.trainingDays, fourDay.length);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle
        eyebrow="Module 3"
        title="Training plan"
        subtitle={`${profile.trainingDays} days/week · Equipment: ${profile.equipment}`}
      />

      <Card>
        <Text style={uiStyles.section}>Training rules</Text>
        <Bullet>Leave about 1–3 reps in reserve on most working sets.</Bullet>
        <Bullet>When you reach the top of a rep range with solid form, add a small amount of load.</Bullet>
        <Bullet>Use 2–3 minutes rest for large compounds and 1–2 minutes for smaller lifts.</Bullet>
        <Bullet>Keep technique and strength retention ahead of chasing fatigue.</Bullet>
      </Card>

      {fourDay.slice(0, visibleDays).map(([name, exercises]) => (
        <Card key={String(name)}>
          <Text style={styles.day}>{name as string}</Text>
          {(exercises as string[]).map((exercise) => (
            <Text style={styles.exercise} key={exercise}>• {exercise}</Text>
          ))}
        </Card>
      ))}

      {profile.trainingDays > 4 ? (
        <Card>
          <Text style={uiStyles.section}>Optional extra day</Text>
          <Text style={uiStyles.muted}>
            Use additional days for low-fatigue accessories, technique practice, or easy cardio instead of simply duplicating hard volume.
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={uiStyles.section}>Cardio & steps</Text>
        <Bullet>Start with 7,000–10,000 daily steps if practical.</Bullet>
        <Bullet>Add 2–3 easy cardio sessions of 20–30 minutes if recovery remains good.</Bullet>
        <Bullet>Avoid adding so much cardio that leg recovery or gym performance materially deteriorates.</Bullet>
      </Card>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 32 },
  day: { color: theme.green, fontWeight: '900', fontSize: 17, marginBottom: 10 },
  exercise: { color: theme.text, fontSize: 14, lineHeight: 23 }
});
