import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

type Screen = 'today' | 'add' | 'history' | 'foods';

type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
};

type Food = {
  id: string;
  name: string;
  category: string;
  nutrients: Nutrition;
  source: 'built-in' | 'custom';
};

type MealItem = {
  id: string;
  food: Food;
  grams: number;
};

type Meal = {
  id: string;
  name: string;
  createdAt: string;
  items: MealItem[];
};

const theme = {
  bg: '#07090A',
  surface: '#13191B',
  surface2: '#1B2326',
  border: '#344044',
  text: '#F4F7F7',
  muted: '#9FAAAF',
  green: '#18C58F',
  greenSoft: '#073E31',
  danger: '#FF7A7A',
  yellow: '#F3C969'
};

const MEALS_KEY = 'mealtrack.meals.v2';
const CUSTOM_FOODS_KEY = 'mealtrack.customFoods.v2';

const n = (
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber: number,
  sugar: number,
  sodium: number
): Nutrition => ({ calories, protein, carbs, fat, fiber, sugar, sodium });

// Generic values per 100 g. Packaged foods vary by brand; users can add exact label values as custom foods.
const BUILT_IN_FOODS: Food[] = [
  { id: 'chicken-breast', name: 'Chicken breast, cooked', category: 'Protein', nutrients: n(165, 31, 0, 3.6, 0, 0, 74), source: 'built-in' },
  { id: 'chicken-thigh', name: 'Chicken thigh, cooked', category: 'Protein', nutrients: n(209, 26, 0, 10.9, 0, 0, 84), source: 'built-in' },
  { id: 'turkey-breast', name: 'Turkey breast, roasted', category: 'Protein', nutrients: n(135, 29, 0, 1.6, 0, 0, 104), source: 'built-in' },
  { id: 'salmon', name: 'Salmon, cooked', category: 'Protein', nutrients: n(206, 22, 0, 12.4, 0, 0, 59), source: 'built-in' },
  { id: 'cod', name: 'Cod, cooked', category: 'Protein', nutrients: n(105, 23, 0, 0.9, 0, 0, 78), source: 'built-in' },
  { id: 'shrimp', name: 'Shrimp, cooked', category: 'Protein', nutrients: n(99, 24, 0.2, 0.3, 0, 0, 111), source: 'built-in' },
  { id: 'tuna', name: 'Tuna, canned in water', category: 'Protein', nutrients: n(116, 25.5, 0, 0.8, 0, 0, 247), source: 'built-in' },
  { id: 'beef-90', name: 'Ground beef 90/10, cooked', category: 'Protein', nutrients: n(217, 26.1, 0, 11.8, 0, 0, 68), source: 'built-in' },
  { id: 'egg', name: 'Whole egg', category: 'Protein', nutrients: n(143, 12.6, 0.7, 9.5, 0, 0.4, 142), source: 'built-in' },
  { id: 'tofu', name: 'Tofu, firm', category: 'Protein', nutrients: n(144, 17.3, 2.8, 8.7, 2.3, 0.5, 14), source: 'built-in' },
  { id: 'rice-white', name: 'White rice, cooked', category: 'Grains', nutrients: n(130, 2.7, 28, 0.3, 0.4, 0.1, 1), source: 'built-in' },
  { id: 'rice-brown', name: 'Brown rice, cooked', category: 'Grains', nutrients: n(123, 2.7, 25.6, 1, 1.6, 0.2, 4), source: 'built-in' },
  { id: 'pasta', name: 'Pasta, cooked', category: 'Grains', nutrients: n(158, 5.8, 30.9, 0.9, 1.8, 0.6, 1), source: 'built-in' },
  { id: 'oats', name: 'Oats, dry', category: 'Grains', nutrients: n(389, 16.9, 66.3, 6.9, 10.6, 0.9, 2), source: 'built-in' },
  { id: 'quinoa', name: 'Quinoa, cooked', category: 'Grains', nutrients: n(120, 4.4, 21.3, 1.9, 2.8, 0.9, 7), source: 'built-in' },
  { id: 'bread-whole', name: 'Whole-wheat bread', category: 'Grains', nutrients: n(247, 13, 41, 4.2, 6.8, 5.7, 430), source: 'built-in' },
  { id: 'potato', name: 'Potato, boiled', category: 'Starches', nutrients: n(87, 1.9, 20.1, 0.1, 1.8, 0.9, 4), source: 'built-in' },
  { id: 'sweet-potato', name: 'Sweet potato, baked', category: 'Starches', nutrients: n(90, 2, 20.7, 0.2, 3.3, 6.5, 36), source: 'built-in' },
  { id: 'corn', name: 'Corn, cooked', category: 'Starches', nutrients: n(96, 3.4, 21, 1.5, 2.4, 4.5, 1), source: 'built-in' },
  { id: 'lentils', name: 'Lentils, cooked', category: 'Legumes', nutrients: n(116, 9, 20.1, 0.4, 7.9, 1.8, 2), source: 'built-in' },
  { id: 'chickpeas', name: 'Chickpeas, cooked', category: 'Legumes', nutrients: n(164, 8.9, 27.4, 2.6, 7.6, 4.8, 7), source: 'built-in' },
  { id: 'black-beans', name: 'Black beans, cooked', category: 'Legumes', nutrients: n(132, 8.9, 23.7, 0.5, 8.7, 0.3, 1), source: 'built-in' },
  { id: 'greek-yogurt', name: 'Greek yogurt, nonfat', category: 'Dairy', nutrients: n(59, 10.3, 3.6, 0.4, 0, 3.2, 36), source: 'built-in' },
  { id: 'milk-whole', name: 'Whole milk', category: 'Dairy', nutrients: n(61, 3.2, 4.8, 3.3, 0, 5, 43), source: 'built-in' },
  { id: 'cottage-cheese', name: 'Cottage cheese, low-fat', category: 'Dairy', nutrients: n(81, 11.1, 3.4, 2.3, 0, 2.7, 364), source: 'built-in' },
  { id: 'cheddar', name: 'Cheddar cheese', category: 'Dairy', nutrients: n(403, 24.9, 1.3, 33.1, 0, 0.5, 621), source: 'built-in' },
  { id: 'banana', name: 'Banana', category: 'Fruit', nutrients: n(89, 1.1, 22.8, 0.3, 2.6, 12.2, 1), source: 'built-in' },
  { id: 'apple', name: 'Apple', category: 'Fruit', nutrients: n(52, 0.3, 13.8, 0.2, 2.4, 10.4, 1), source: 'built-in' },
  { id: 'orange', name: 'Orange', category: 'Fruit', nutrients: n(47, 0.9, 11.8, 0.1, 2.4, 9.4, 0), source: 'built-in' },
  { id: 'blueberries', name: 'Blueberries', category: 'Fruit', nutrients: n(57, 0.7, 14.5, 0.3, 2.4, 10, 1), source: 'built-in' },
  { id: 'strawberries', name: 'Strawberries', category: 'Fruit', nutrients: n(32, 0.7, 7.7, 0.3, 2, 4.9, 1), source: 'built-in' },
  { id: 'dates', name: 'Dates, Medjool', category: 'Fruit', nutrients: n(277, 1.8, 75, 0.2, 6.7, 66.5, 1), source: 'built-in' },
  { id: 'broccoli', name: 'Broccoli, cooked', category: 'Vegetables', nutrients: n(35, 2.4, 7.2, 0.4, 3.3, 1.4, 41), source: 'built-in' },
  { id: 'spinach', name: 'Spinach, raw', category: 'Vegetables', nutrients: n(23, 2.9, 3.6, 0.4, 2.2, 0.4, 79), source: 'built-in' },
  { id: 'tomato', name: 'Tomato', category: 'Vegetables', nutrients: n(18, 0.9, 3.9, 0.2, 1.2, 2.6, 5), source: 'built-in' },
  { id: 'cucumber', name: 'Cucumber', category: 'Vegetables', nutrients: n(15, 0.7, 3.6, 0.1, 0.5, 1.7, 2), source: 'built-in' },
  { id: 'avocado', name: 'Avocado', category: 'Fats', nutrients: n(160, 2, 8.5, 14.7, 6.7, 0.7, 7), source: 'built-in' },
  { id: 'almonds', name: 'Almonds', category: 'Fats', nutrients: n(579, 21.2, 21.6, 49.9, 12.5, 4.4, 1), source: 'built-in' },
  { id: 'peanut-butter', name: 'Peanut butter', category: 'Fats', nutrients: n(588, 25, 20, 50, 6, 9, 17), source: 'built-in' },
  { id: 'olive-oil', name: 'Olive oil', category: 'Fats', nutrients: n(884, 0, 0, 100, 0, 0, 0), source: 'built-in' },
  { id: 'butter', name: 'Butter', category: 'Fats', nutrients: n(717, 0.9, 0.1, 81.1, 0, 0.1, 11), source: 'built-in' },
  { id: 'hummus', name: 'Hummus', category: 'Other', nutrients: n(166, 7.9, 14.3, 9.6, 6, 0.3, 379), source: 'built-in' },
  { id: 'honey', name: 'Honey', category: 'Other', nutrients: n(304, 0.3, 82.4, 0, 0.2, 82.1, 4), source: 'built-in' }
];

const ZERO: Nutrition = n(0, 0, 0, 0, 0, 0, 0);

function round(value: number, digits = 1) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function scaleNutrition(food: Food, grams: number): Nutrition {
  const factor = Math.max(0, grams) / 100;
  return {
    calories: food.nutrients.calories * factor,
    protein: food.nutrients.protein * factor,
    carbs: food.nutrients.carbs * factor,
    fat: food.nutrients.fat * factor,
    fiber: food.nutrients.fiber * factor,
    sugar: food.nutrients.sugar * factor,
    sodium: food.nutrients.sodium * factor
  };
}

function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
    sugar: a.sugar + b.sugar,
    sodium: a.sodium + b.sodium
  };
}

function totalForItems(items: MealItem[]): Nutrition {
  return items.reduce((total, item) => addNutrition(total, scaleNutrition(item.food, item.grams)), ZERO);
}

function totalForMeals(meals: Meal[]): Nutrition {
  return meals.reduce((total, meal) => addNutrition(total, totalForItems(meal.items)), ZERO);
}

function localDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultMealName() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Breakfast';
  if (hour < 15) return 'Lunch';
  if (hour < 19) return 'Snack';
  return 'Dinner';
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function numberOrZero(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('today');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [customFoods, setCustomFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [storedMeals, storedFoods] = await Promise.all([
          AsyncStorage.getItem(MEALS_KEY),
          AsyncStorage.getItem(CUSTOM_FOODS_KEY)
        ]);
        if (storedMeals) setMeals(JSON.parse(storedMeals) as Meal[]);
        if (storedFoods) setCustomFoods(JSON.parse(storedFoods) as Food[]);
      } catch {
        Alert.alert('Storage error', 'Saved data could not be loaded. New entries will still work for this session.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const addMeal = (meal: Meal) => {
    setMeals((previous) => {
      const next = [meal, ...previous];
      void AsyncStorage.setItem(MEALS_KEY, JSON.stringify(next));
      return next;
    });
    setScreen('today');
  };

  const deleteMeal = (mealId: string) => {
    setMeals((previous) => {
      const next = previous.filter((meal) => meal.id !== mealId);
      void AsyncStorage.setItem(MEALS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const addCustomFood = (food: Food) => {
    setCustomFoods((previous) => {
      const next = [food, ...previous];
      void AsyncStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const allFoods = useMemo(() => [...customFoods, ...BUILT_IN_FOODS], [customFoods]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
        <View style={styles.loadingWrap}>
          <Text style={styles.brand}>MEALTRACK</Text>
          <Text style={styles.loadingText}>Loading your food log…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <View style={styles.page}>
        {screen === 'today' && <TodayScreen meals={meals} onAdd={() => setScreen('add')} />}
        {screen === 'add' && <AddMealScreen foods={allFoods} onSave={addMeal} />}
        {screen === 'history' && <HistoryScreen meals={meals} onDelete={deleteMeal} />}
        {screen === 'foods' && <FoodsScreen foods={allFoods} onAddCustom={addCustomFood} />}
      </View>
      <TabBar screen={screen} onChange={setScreen} />
    </SafeAreaView>
  );
}

function TodayScreen({ meals, onAdd }: { meals: Meal[]; onAdd: () => void }) {
  const todayKey = localDateKey(new Date());
  const todayMeals = meals.filter((meal) => localDateKey(meal.createdAt) === todayKey);
  const total = totalForMeals(todayMeals);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.brand}>MEALTRACK</Text>
      <Text style={styles.h1}>Today</Text>
      <Text style={styles.subtitle}>Log food whenever you eat. Nutrition is calculated locally on your phone.</Text>

      <Card>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.cardLabel}>Calories</Text>
            <Text style={styles.heroNumber}>{Math.round(total.calories)}</Text>
            <Text style={styles.unit}>kcal today</Text>
          </View>
          <Pressable style={styles.addCircle} onPress={onAdd}>
            <Text style={styles.addCircleText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.divider} />
        <MacroGrid nutrition={total} />
      </Card>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today's meals</Text>
        <Pressable onPress={onAdd}><Text style={styles.link}>Add meal</Text></Pressable>
      </View>

      {todayMeals.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>Nothing logged yet</Text>
          <Text style={styles.muted}>Tap Add meal, search for a food, enter the amount in grams, then save the meal.</Text>
        </Card>
      ) : (
        todayMeals.map((meal) => <MealCard key={meal.id} meal={meal} />)
      )}

      <Text style={styles.footnote}>Built-in foods use generic values per 100 g. For packaged food, create a custom food using the nutrition label for the most accurate result.</Text>
      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

function AddMealScreen({ foods, onSave }: { foods: Food[]; onSave: (meal: Meal) => void }) {
  const [mealName, setMealName] = useState(defaultMealName());
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [draft, setDraft] = useState<MealItem[]>([]);

  const query = search.trim().toLowerCase();
  const results = foods
    .filter((food) => !query || food.name.toLowerCase().includes(query) || food.category.toLowerCase().includes(query))
    .slice(0, 14);
  const previewGrams = numberOrZero(grams);
  const preview = selectedFood ? scaleNutrition(selectedFood, previewGrams) : ZERO;
  const mealTotal = totalForItems(draft);

  const addSelected = () => {
    if (!selectedFood) {
      Alert.alert('Choose a food', 'Search for a food and select it first.');
      return;
    }
    if (previewGrams <= 0) {
      Alert.alert('Enter an amount', 'Enter the amount you ate in grams.');
      return;
    }
    setDraft((previous) => [...previous, { id: id('item'), food: selectedFood, grams: previewGrams }]);
    setSelectedFood(null);
    setSearch('');
    setGrams('100');
  };

  const saveMeal = () => {
    if (draft.length === 0) {
      Alert.alert('Meal is empty', 'Add at least one food before saving.');
      return;
    }
    onSave({
      id: id('meal'),
      name: mealName.trim() || defaultMealName(),
      createdAt: new Date().toISOString(),
      items: draft
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        <Text style={styles.brand}>ADD MEAL</Text>
        <Text style={styles.h1}>What did you eat?</Text>
        <Text style={styles.subtitle}>No AI. Pick a food from the local database or create your own food from a label.</Text>

        <Text style={styles.inputLabel}>Meal name</Text>
        <TextInput
          style={styles.input}
          value={mealName}
          onChangeText={setMealName}
          placeholder="Breakfast, lunch, snack…"
          placeholderTextColor="#657176"
        />

        <Text style={styles.inputLabel}>Search foods</Text>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={(value) => { setSearch(value); setSelectedFood(null); }}
          placeholder="Chicken, rice, banana…"
          placeholderTextColor="#657176"
          autoCapitalize="none"
        />

        <View style={styles.searchResults}>
          {results.map((food) => {
            const active = selectedFood?.id === food.id;
            return (
              <Pressable key={food.id} style={[styles.foodRow, active && styles.foodRowActive]} onPress={() => setSelectedFood(food)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.foodName}>{food.name}</Text>
                  <Text style={styles.foodMeta}>{food.category} · {Math.round(food.nutrients.calories)} kcal / 100 g{food.source === 'custom' ? ' · Custom' : ''}</Text>
                </View>
                <Text style={styles.chevron}>{active ? '✓' : '›'}</Text>
              </Pressable>
            );
          })}
        </View>

        {selectedFood ? (
          <Card>
            <Text style={styles.cardLabel}>Selected</Text>
            <Text style={styles.cardTitle}>{selectedFood.name}</Text>
            <Text style={styles.inputLabel}>Amount eaten (grams)</Text>
            <TextInput
              style={styles.input}
              value={grams}
              onChangeText={setGrams}
              keyboardType="decimal-pad"
              placeholder="100"
              placeholderTextColor="#657176"
            />
            <View style={styles.previewCaloriesRow}>
              <Text style={styles.previewCalories}>{Math.round(preview.calories)} kcal</Text>
              <Text style={styles.muted}>{round(preview.protein)} g protein · {round(preview.carbs)} g carbs · {round(preview.fat)} g fat</Text>
            </View>
            <Pressable style={styles.primaryButton} onPress={addSelected}>
              <Text style={styles.primaryButtonText}>Add to meal</Text>
            </Pressable>
          </Card>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Meal items</Text>
          <Text style={styles.link}>{Math.round(mealTotal.calories)} kcal</Text>
        </View>

        {draft.length === 0 ? (
          <Text style={styles.muted}>Select a food above to start building this meal.</Text>
        ) : (
          draft.map((item) => {
            const itemNutrition = scaleNutrition(item.food, item.grams);
            return (
              <View key={item.id} style={styles.draftRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.foodName}>{item.food.name}</Text>
                  <Text style={styles.foodMeta}>{round(item.grams, 0)} g · {Math.round(itemNutrition.calories)} kcal · P {round(itemNutrition.protein)} · C {round(itemNutrition.carbs)} · F {round(itemNutrition.fat)}</Text>
                </View>
                <Pressable onPress={() => setDraft((previous) => previous.filter((entry) => entry.id !== item.id))}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            );
          })
        )}

        {draft.length > 0 ? (
          <Card>
            <Text style={styles.cardLabel}>Meal total</Text>
            <Text style={styles.heroNumber}>{Math.round(mealTotal.calories)}</Text>
            <Text style={styles.unit}>kcal</Text>
            <MacroGrid nutrition={mealTotal} />
            <Pressable style={styles.primaryButton} onPress={saveMeal}>
              <Text style={styles.primaryButtonText}>Save meal now</Text>
            </Pressable>
          </Card>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HistoryScreen({ meals, onDelete }: { meals: Meal[]; onDelete: (id: string) => void }) {
  const sorted = [...meals].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const confirmDelete = (meal: Meal) => {
    Alert.alert('Delete meal?', `${meal.name} will be removed from your history.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(meal.id) }
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.brand}>HISTORY</Text>
      <Text style={styles.h1}>Meal log</Text>
      <Text style={styles.subtitle}>Every saved meal stays on this device until you delete it.</Text>

      {sorted.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.muted}>Saved meals will appear here with their calorie and nutrient totals.</Text>
        </Card>
      ) : (
        sorted.map((meal) => (
          <View key={meal.id}>
            <MealCard meal={meal} showDate />
            <Pressable style={styles.deleteButton} onPress={() => confirmDelete(meal)}>
              <Text style={styles.deleteText}>Delete this meal</Text>
            </Pressable>
          </View>
        ))
      )}
      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

function FoodsScreen({ foods, onAddCustom }: { foods: Food[]; onAddCustom: (food: Food) => void }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [sodium, setSodium] = useState('');

  const query = search.trim().toLowerCase();
  const results = foods.filter((food) => !query || food.name.toLowerCase().includes(query) || food.category.toLowerCase().includes(query));

  const saveCustom = () => {
    if (!name.trim()) {
      Alert.alert('Food name required', 'Enter the name shown on the package or your own description.');
      return;
    }
    onAddCustom({
      id: id('custom'),
      name: name.trim(),
      category: 'Custom',
      source: 'custom',
      nutrients: n(
        numberOrZero(calories),
        numberOrZero(protein),
        numberOrZero(carbs),
        numberOrZero(fat),
        numberOrZero(fiber),
        numberOrZero(sugar),
        numberOrZero(sodium)
      )
    });
    setName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setFiber('');
    setSugar('');
    setSodium('');
    setShowForm(false);
    Alert.alert('Food saved', 'Your custom food is now available in Add meal.');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        <Text style={styles.brand}>FOOD LIBRARY</Text>
        <Text style={styles.h1}>Foods</Text>
        <Text style={styles.subtitle}>Search the built-in database or add exact values from any nutrition label.</Text>

        <Pressable style={styles.primaryButton} onPress={() => setShowForm((value) => !value)}>
          <Text style={styles.primaryButtonText}>{showForm ? 'Close custom food form' : '+ Add custom food'}</Text>
        </Pressable>

        {showForm ? (
          <Card>
            <Text style={styles.cardTitle}>Nutrition per 100 g</Text>
            <Text style={styles.muted}>Enter the label values normalized to 100 g. If the package only gives values per serving, convert them before saving.</Text>
            <Text style={styles.inputLabel}>Food name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Example: My granola" placeholderTextColor="#657176" />
            <View style={styles.twoCol}>
              <MiniInput label="Calories" value={calories} onChange={setCalories} />
              <MiniInput label="Protein g" value={protein} onChange={setProtein} />
              <MiniInput label="Carbs g" value={carbs} onChange={setCarbs} />
              <MiniInput label="Fat g" value={fat} onChange={setFat} />
              <MiniInput label="Fiber g" value={fiber} onChange={setFiber} />
              <MiniInput label="Sugar g" value={sugar} onChange={setSugar} />
              <MiniInput label="Sodium mg" value={sodium} onChange={setSodium} />
            </View>
            <Pressable style={styles.primaryButton} onPress={saveCustom}>
              <Text style={styles.primaryButtonText}>Save custom food</Text>
            </Pressable>
          </Card>
        ) : null}

        <Text style={styles.inputLabel}>Search library</Text>
        <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Search food or category" placeholderTextColor="#657176" />

        {results.map((food) => (
          <View key={food.id} style={styles.libraryCard}>
            <View style={styles.libraryTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.foodName}>{food.name}</Text>
                <Text style={styles.foodMeta}>{food.category}{food.source === 'custom' ? ' · Custom' : ''} · per 100 g</Text>
              </View>
              <Text style={styles.libraryCalories}>{Math.round(food.nutrients.calories)} kcal</Text>
            </View>
            <Text style={styles.foodMeta}>Protein {round(food.nutrients.protein)} g · Carbs {round(food.nutrients.carbs)} g · Fat {round(food.nutrients.fat)} g · Fiber {round(food.nutrients.fiber)} g · Sugar {round(food.nutrients.sugar)} g · Sodium {Math.round(food.nutrients.sodium)} mg</Text>
          </View>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MiniInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.miniInputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#657176" />
    </View>
  );
}

function MacroGrid({ nutrition }: { nutrition: Nutrition }) {
  return (
    <View style={styles.macroGrid}>
      <Metric label="Protein" value={`${round(nutrition.protein)} g`} />
      <Metric label="Carbs" value={`${round(nutrition.carbs)} g`} />
      <Metric label="Fat" value={`${round(nutrition.fat)} g`} />
      <Metric label="Fiber" value={`${round(nutrition.fiber)} g`} />
      <Metric label="Sugar" value={`${round(nutrition.sugar)} g`} />
      <Metric label="Sodium" value={`${Math.round(nutrition.sodium)} mg`} />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function MealCard({ meal, showDate = false }: { meal: Meal; showDate?: boolean }) {
  const total = totalForItems(meal.items);
  const date = new Date(meal.createdAt);
  return (
    <Card>
      <View style={styles.mealHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{meal.name}</Text>
          <Text style={styles.foodMeta}>{showDate ? date.toLocaleDateString() + ' · ' : ''}{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {meal.items.length} item{meal.items.length === 1 ? '' : 's'}</Text>
        </View>
        <Text style={styles.mealCalories}>{Math.round(total.calories)} kcal</Text>
      </View>
      {meal.items.map((item) => {
        const itemTotal = scaleNutrition(item.food, item.grams);
        return (
          <View key={item.id} style={styles.mealItemRow}>
            <Text style={styles.mealItemName}>{item.food.name}</Text>
            <Text style={styles.mealItemValue}>{round(item.grams, 0)} g · {Math.round(itemTotal.calories)} kcal</Text>
          </View>
        );
      })}
      <View style={styles.divider} />
      <Text style={styles.foodMeta}>P {round(total.protein)} g · C {round(total.carbs)} g · F {round(total.fat)} g · Fiber {round(total.fiber)} g · Sugar {round(total.sugar)} g · Sodium {Math.round(total.sodium)} mg</Text>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function TabBar({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  const tabs: { key: Screen; label: string; icon: string }[] = [
    { key: 'today', label: 'Today', icon: '◉' },
    { key: 'add', label: 'Log', icon: '+' },
    { key: 'history', label: 'History', icon: '↺' },
    { key: 'foods', label: 'Foods', icon: '▦' }
  ];

  return (
    <View style={styles.navDockWrap}>
      <View style={styles.navDockGlow} />
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = tab.key === screen;
          const isAdd = tab.key === 'add';

          if (isAdd) {
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel="Log a meal"
                onPress={() => onChange(tab.key)}
                style={({ pressed }) => [styles.tab, styles.addTab, pressed && styles.navPressed]}
              >
                <View style={[styles.navAddHalo, active && styles.navAddHaloActive]}>
                  <View style={[styles.navAddButton, active && styles.navAddButtonActive]}>
                    <Text style={styles.navAddIcon}>{tab.icon}</Text>
                  </View>
                </View>
                <Text style={[styles.navAddLabel, active && styles.tabTextActive]}>LOG MEAL</Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(tab.key)}
              style={({ pressed }) => [styles.tab, pressed && styles.navPressed]}
            >
              <View style={[styles.tabPill, active && styles.tabPillActive]}>
                <View style={styles.navIconRow}>
                  <Text style={[styles.navIcon, active && styles.navIconActive]}>{tab.icon}</Text>
                  {active ? <View style={styles.navLiveDot} /> : null}
                </View>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  page: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: theme.muted, marginTop: 10, fontSize: 15 },
  brand: { color: theme.green, fontWeight: '900', fontSize: 13, letterSpacing: 1.4 },
  h1: { color: theme.text, fontWeight: '900', fontSize: 36, marginTop: 8, letterSpacing: -1 },
  subtitle: { color: theme.muted, fontSize: 16, lineHeight: 24, marginTop: 8, marginBottom: 22 },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 24, padding: 18, marginBottom: 14 },
  cardLabel: { color: theme.muted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardTitle: { color: theme.text, fontSize: 21, fontWeight: '900', marginTop: 5 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroNumber: { color: theme.text, fontSize: 48, fontWeight: '900', lineHeight: 54, marginTop: 4 },
  unit: { color: theme.muted, fontSize: 13, fontWeight: '700' },
  addCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: theme.green, alignItems: 'center', justifyContent: 'center' },
  addCircleText: { color: '#04251C', fontSize: 34, fontWeight: '500', marginTop: -3 },
  divider: { height: 1, backgroundColor: '#2B3539', marginVertical: 16 },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  metric: { width: '33.333%', paddingHorizontal: 5, marginBottom: 12 },
  metricValue: { color: theme.text, fontSize: 16, fontWeight: '900' },
  metricLabel: { color: theme.muted, fontSize: 12, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 12 },
  sectionTitle: { color: theme.text, fontSize: 22, fontWeight: '900' },
  link: { color: theme.green, fontSize: 14, fontWeight: '900' },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 6 },
  muted: { color: theme.muted, fontSize: 14, lineHeight: 21 },
  footnote: { color: '#748086', fontSize: 12, lineHeight: 18, marginTop: 8 },
  inputLabel: { color: theme.muted, fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border, color: theme.text, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  searchResults: { marginTop: 10, marginBottom: 14 },
  foodRow: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  foodRowActive: { borderColor: theme.green, backgroundColor: '#0D211B' },
  foodName: { color: theme.text, fontSize: 15, fontWeight: '800' },
  foodMeta: { color: theme.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  chevron: { color: theme.green, fontSize: 24, fontWeight: '700', marginLeft: 10 },
  previewCaloriesRow: { marginTop: 14, marginBottom: 8 },
  previewCalories: { color: theme.green, fontSize: 28, fontWeight: '900', marginBottom: 4 },
  primaryButton: { backgroundColor: theme.green, borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  primaryButtonText: { color: '#05251C', fontSize: 15, fontWeight: '900' },
  draftRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 14, marginBottom: 8 },
  remove: { color: theme.danger, fontSize: 12, fontWeight: '900', marginLeft: 10 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  mealCalories: { color: theme.green, fontSize: 18, fontWeight: '900', marginLeft: 12 },
  mealItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 11 },
  mealItemName: { color: theme.text, fontSize: 13, flex: 1, paddingRight: 10 },
  mealItemValue: { color: theme.muted, fontSize: 12 },
  deleteButton: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 18, paddingHorizontal: 4, paddingVertical: 4 },
  deleteText: { color: theme.danger, fontSize: 12, fontWeight: '800' },
  twoCol: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  miniInputWrap: { width: '50%', paddingHorizontal: 5 },
  libraryCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 18, padding: 15, marginTop: 9 },
  libraryTop: { flexDirection: 'row', alignItems: 'flex-start' },
  libraryCalories: { color: theme.green, fontSize: 15, fontWeight: '900', marginLeft: 10 },
  navDockWrap: { position: 'absolute', left: 12, right: 12, bottom: 10, height: 88, justifyContent: 'flex-end' },
  navDockGlow: { position: 'absolute', left: 28, right: 28, bottom: 0, height: 58, borderRadius: 30, backgroundColor: '#0B2B23', opacity: 0.55, transform: [{ scaleX: 0.94 }], elevation: 10 },
  tabBar: { height: 76, borderRadius: 30, backgroundColor: '#0E1416FA', borderWidth: 1, borderColor: '#2A373B', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 6, elevation: 24, shadowColor: '#000000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.44, shadowRadius: 24 },
  tab: { flex: 1, height: 64, justifyContent: 'center', alignItems: 'center' },
  addTab: { marginTop: -23 },
  navPressed: { transform: [{ scale: 0.92 }], opacity: 0.9 },
  tabPill: { minWidth: 64, minHeight: 58, borderRadius: 21, paddingVertical: 7, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  tabPillActive: { backgroundColor: '#12231F', borderColor: '#25463C' },
  navIconRow: { height: 27, minWidth: 30, alignItems: 'center', justifyContent: 'center' },
  navIcon: { color: '#76858A', fontSize: 22, lineHeight: 25, fontWeight: '800' },
  navIconActive: { color: theme.green },
  navLiveDot: { position: 'absolute', top: -1, right: -2, width: 5, height: 5, borderRadius: 3, backgroundColor: '#5FFFC9', shadowColor: '#5FFFC9', shadowOpacity: 0.9, shadowRadius: 5, elevation: 4 },
  navAddHalo: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#10191A', borderWidth: 1, borderColor: '#304039', alignItems: 'center', justifyContent: 'center', elevation: 18, shadowColor: theme.green, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.26, shadowRadius: 14 },
  navAddHaloActive: { borderColor: '#52E6B4', backgroundColor: '#0E211C' },
  navAddButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.green, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#68E7BC', elevation: 10 },
  navAddButtonActive: { backgroundColor: '#32D9A2', transform: [{ scale: 1.04 }] },
  navAddIcon: { color: '#03261C', fontSize: 36, lineHeight: 39, fontWeight: '400', marginTop: -4 },
  navAddLabel: { color: '#879399', fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginTop: 2 },
  tabText: { color: '#7F8C91', fontSize: 10, lineHeight: 12, fontWeight: '900', letterSpacing: 0.25, marginTop: 2 },
  tabTextActive: { color: '#59E7B7' }
});
