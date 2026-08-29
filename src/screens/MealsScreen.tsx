import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bullet, Card, ScreenTitle, uiStyles } from '../components/UI';
import { theme } from '../theme';
import { MacroTargets, Profile } from '../types';

const mealRows = [
  ['Breakfast', 'Eggs + oats + fruit', 'Greek yogurt + granola', 'Protein oats + berries'],
  ['Lunch', 'Chicken rice bowl + vegetables', 'Lean beef wrap + salad', 'Tuna potato bowl'],
  ['Snack', 'Greek yogurt + fruit', 'Protein shake + banana', 'Cottage cheese + berries'],
  ['Dinner', 'Lean protein + rice/potatoes + vegetables', 'Chicken pasta + salad', 'Fish + potatoes + vegetables']
];

export function MealsScreen({
  profile,
  macros
}: {
  profile: Profile;
  macros: MacroTargets;
}) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTitle
        eyebrow="Module 2"
        title="Practical meal plan"
        subtitle={`Designed around approximately ${macros.calories} kcal and ${macros.protein} g protein per day.`}
      />

      <Card>
        <Text style={uiStyles.section}>Foods you said you like</Text>
        <Text style={uiStyles.muted}>{profile.foods}</Text>
      </Card>

      {mealRows.map(([name, main, alt1, alt2]) => (
        <Card key={name}>
          <Text style={styles.mealName}>{name}</Text>
          <Text style={styles.mainMeal}>{main}</Text>
          <Text style={styles.alt}>Swap 1: {alt1}</Text>
          <Text style={styles.alt}>Swap 2: {alt2}</Text>
        </Card>
      ))}

      <Card>
        <Text style={uiStyles.section}>Portion rule</Text>
        <Bullet>Build each main meal around a clear protein source.</Bullet>
        <Bullet>Use the nutrition label or a food scale initially to learn portions.</Bullet>
        <Bullet>Allocate more carbohydrate around training if it helps performance.</Bullet>
        <Bullet>Keep vegetables, fruit, and high-fiber foods in the plan for fullness.</Bullet>
        <Bullet>Hydrate regularly; use thirst and urine color as practical guides.</Bullet>
      </Card>

      <Card>
        <Text style={uiStyles.section}>Simple grocery list</Text>
        <Text style={uiStyles.muted}>
          Lean meat/fish, eggs, Greek yogurt, rice, potatoes, oats, wraps, fruit, vegetables,
          beans, low-calorie sauces, herbs/spices, and convenient high-protein snacks.
        </Text>
      </Card>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 32 },
  mealName: { color: theme.green, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  mainMeal: { color: theme.text, fontSize: 18, fontWeight: '900', marginTop: 7, marginBottom: 10 },
  alt: { color: theme.muted, fontSize: 13, lineHeight: 20 }
});
