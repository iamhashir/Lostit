import 'react-native-gesture-handler';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import {
  ChevronLeft,
  Clock3,
  Home,
  LibraryBig,
  Plus,
  Search,
  Trash2,
  X,
  type LucideIcon
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets
} from 'react-native-safe-area-context';
import { PortionScannerEntry } from './src/PortionScannerEntry';

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

type RootTabParamList = {
  Today: undefined;
  AddMeal: undefined;
  Foods: undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const theme = {
  bg: '#080A0A',
  surface: '#121616',
  surface2: '#181D1D',
  surface3: '#202626',
  text: '#F5F7F5',
  muted: '#929C99',
  muted2: '#68726F',
  green: '#36D399',
  greenDark: '#0A2E23',
  line: 'rgba(255,255,255,0.07)',
  danger: '#FF7A7A'
};

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: theme.green,
    background: theme.bg,
    card: theme.surface,
    text: theme.text,
    border: theme.line,
    notification: theme.green
  }
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
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
        <NavigationContainer theme={navigationTheme}>
          <MealTrackTabs />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function MealTrackTabs() {
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
      <SafeAreaView style={styles.loadingSafe} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <View style={styles.loadingMark}>
            <LibraryBig size={22} color={theme.green} strokeWidth={2.2} />
          </View>
          <Text style={styles.loadingTitle}>MealTrack</Text>
          <Text style={styles.loadingText}>Loading your nutrition log</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Tab.Navigator
      initialRouteName="Today"
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bg },
        animation: 'shift'
      }}
    >
      <Tab.Screen name="Today">
        {({ navigation }) => (
          <TodayScreen meals={meals} onHistory={() => navigation.navigate('Foods')} />
        )}
      </Tab.Screen>
      <Tab.Screen name="AddMeal">
        {({ navigation }) => (
          <AddMealScreen
            foods={allFoods}
            onSave={(meal) => {
              addMeal(meal);
              navigation.navigate('Today');
            }}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Foods">
        {() => <MealsScreen meals={meals} onDelete={deleteMeal} />}
      </Tab.Screen>
      <Tab.Screen name="History">
        {({ navigation }) => (
          <HistoryScreen
            meals={meals}
            onDelete={deleteMeal}
            onBack={() => navigation.navigate('Today')}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function PremiumTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name;

  if (activeRoute === 'History') return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.tabBarOuter, { bottom: Math.max(insets.bottom, 10) }]}
    >
      <View style={styles.tabBarGlass}>
        <AnimatedTabButton
          label="Home"
          Icon={Home}
          active={activeRoute === 'Today'}
          onPress={() => navigation.navigate('Today')}
        />
        <View style={styles.tabCenterSpacer} />
        <AnimatedTabButton
          label="Meals"
          Icon={LibraryBig}
          active={activeRoute === 'Foods'}
          onPress={() => navigation.navigate('Foods')}
        />
      </View>

      <AnimatedAddButton
        active={activeRoute === 'AddMeal'}
        onPress={() => navigation.navigate('AddMeal')}
      />
    </View>
  );
}

function AnimatedTabButton({
  label,
  Icon,
  active,
  onPress
}: {
  label: string;
  Icon: LucideIcon;
  active: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.72, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -2]) },
      { scale: interpolate(progress.value, [0, 1], [1, 1.03]) }
    ]
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={styles.tabHit}
    >
      <Animated.View style={[styles.tabItem, animatedStyle]}>
        <View style={[styles.tabIconShell, active && styles.tabIconShellActive]}>
          <Icon
            size={20}
            strokeWidth={active ? 2.4 : 2}
            color={active ? theme.green : theme.muted2}
          />
        </View>
        <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function AnimatedAddButton({ active, onPress }: { active: boolean; onPress: () => void }) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, {
      damping: 18,
      stiffness: 220,
      mass: 0.7
    });
  }, [active, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -3]) },
      { scale: interpolate(progress.value, [0, 1], [1, 1.045]) }
    ]
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel="Add or scan"
      hitSlop={10}
      onPress={onPress}
      style={styles.addTabHit}
    >
      <Animated.View style={[styles.addTabContent, animatedStyle]}>
        <View style={[styles.addButton, active && styles.addButtonActive]}>
          <Plus size={27} strokeWidth={2.5} color="#06251B" />
        </View>
        <Text style={[styles.addTabLabel, active && styles.addTabLabelActive]}>Add/Scan</Text>
      </Animated.View>
    </Pressable>
  );
}

function TodayScreen({ meals, onHistory }: { meals: Meal[]; onHistory: () => void }) {
  const insets = useSafeAreaInsets();
  const todayKey = localDateKey(new Date());
  const todayMeals = meals.filter((meal) => localDateKey(meal.createdAt) === todayKey);
  const total = totalForMeals(todayMeals);
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 118 + insets.bottom }
        ]}
      >
        <ScreenHeader
          eyebrow="MealTrack"
          title="Home"
          subtitle={dateLabel}
          action={
            <IconButton label="Meal history" onPress={onHistory}>
              <Clock3 size={20} color={theme.text} strokeWidth={2.1} />
            </IconButton>
          }
        />

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Calories</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroNumber}>{Math.round(total.calories)}</Text>
            <Text style={styles.heroUnit}>kcal</Text>
          </View>
          <Text style={styles.heroCaption}>
            {todayMeals.length === 0
              ? 'Nothing logged today'
              : `${todayMeals.length} meal${todayMeals.length === 1 ? '' : 's'} logged`}
          </Text>
          <View style={styles.heroDivider} />
          <MacroGrid nutrition={total} />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>TODAY</Text>
            <Text style={styles.sectionTitle}>Meals</Text>
          </View>
          {meals.length > 0 ? (
            <Pressable onPress={onHistory} hitSlop={8}>
              <Text style={styles.sectionAction}>View history</Text>
            </Pressable>
          ) : null}
        </View>

        {todayMeals.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Plus size={18} color={theme.green} strokeWidth={2.2} />
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>Start with your next meal</Text>
              <Text style={styles.muted}>
                Use the center button below, choose a food, enter grams, and MealTrack calculates the nutrients.
              </Text>
            </View>
          </View>
        ) : (
          todayMeals.map((meal) => <MealCard key={meal.id} meal={meal} />)
        )}

        <Text style={styles.footnote}>
          Built-in foods use generic values per 100 g. For packaged food, save the exact nutrition label as a custom food.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function AddMealScreen({ foods, onSave }: { foods: Food[]; onSave: (meal: Meal) => void }) {
  const insets = useSafeAreaInsets();
  const [mealName, setMealName] = useState(defaultMealName());
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [draft, setDraft] = useState<MealItem[]>([]);

  const query = search.trim().toLowerCase();
  const results = foods
    .filter((food) => !query || food.name.toLowerCase().includes(query) || food.category.toLowerCase().includes(query))
    .slice(0, query ? 14 : 8);
  const previewGrams = numberOrZero(grams);
  const preview = selectedFood ? scaleNutrition(selectedFood, previewGrams) : ZERO;
  const mealTotal = totalForItems(draft);

  const addSelected = () => {
    if (!selectedFood) {
      Alert.alert('Choose a food', 'Search the food library and select an item first.');
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

    setMealName(defaultMealName());
    setSearch('');
    setSelectedFood(null);
    setGrams('100');
    setDraft([]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 118 + insets.bottom }
          ]}
        >
          <ScreenHeader
            eyebrow="Meal workflow"
            title="Add / Scan"
            subtitle="Search for the food, then scan the portion or enter grams manually."
          />

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>SCAN</Text>
              <Text style={styles.sectionTitle}>Live portion scanner</Text>
            </View>
          </View>
          <PortionScannerEntry
            foodName={selectedFood?.name ?? 'Food portion'}
            onEstimateGrams={(value) => setGrams(String(Math.max(1, Math.round(value))))}
          />

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>SEARCH & ADD</Text>
              <Text style={styles.sectionTitle}>Build the meal</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Meal name</Text>
          <TextInput
            style={styles.input}
            value={mealName}
            onChangeText={setMealName}
            placeholder="Breakfast"
            placeholderTextColor={theme.muted2}
          />

          <Text style={styles.fieldLabel}>Search food</Text>
          <View style={styles.searchInputWrap}>
            <Search size={18} color={theme.muted2} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={(value) => {
                setSearch(value);
                if (selectedFood && value !== selectedFood.name) setSelectedFood(null);
              }}
              placeholder="Chicken, rice, banana…"
              placeholderTextColor={theme.muted2}
              autoCorrect={false}
            />
            {search ? (
              <Pressable
                onPress={() => {
                  setSearch('');
                  setSelectedFood(null);
                }}
                hitSlop={8}
              >
                <X size={17} color={theme.muted2} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.searchResults}>
            {results.map((food) => {
              const active = selectedFood?.id === food.id;
              return (
                <Pressable
                  key={food.id}
                  onPress={() => {
                    setSelectedFood(food);
                    setSearch(food.name);
                  }}
                  style={[styles.foodSearchRow, active && styles.foodSearchRowActive]}
                >
                  <View style={styles.foodSearchCopy}>
                    <Text style={styles.foodName}>{food.name}</Text>
                    <Text style={styles.foodMeta}>
                      {food.category} · {Math.round(food.nutrients.calories)} kcal / 100 g
                    </Text>
                  </View>
                  {active ? <View style={styles.selectedDot} /> : null}
                </Pressable>
              );
            })}
          </View>

          {selectedFood ? (
            <View style={styles.editorCard}>
              <View style={styles.editorHeader}>
                <View style={styles.editorCopy}>
                  <Text style={styles.editorTitle}>{selectedFood.name}</Text>
                  <Text style={styles.foodMeta}>Amount eaten</Text>
                </View>
                <View style={styles.gramsInputWrap}>
                  <TextInput
                    style={styles.gramsInput}
                    value={grams}
                    onChangeText={setGrams}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                  />
                  <Text style={styles.gramsUnit}>g</Text>
                </View>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewCalories}>{Math.round(preview.calories)} kcal</Text>
                <Text style={styles.previewMacros}>
                  P {round(preview.protein)} · C {round(preview.carbs)} · F {round(preview.fat)}
                </Text>
              </View>


              <PrimaryButton label="Add to meal" onPress={addSelected} />
            </View>
          ) : null}

          {draft.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionKicker}>CURRENT MEAL</Text>
                  <Text style={styles.sectionTitle}>{draft.length} item{draft.length === 1 ? '' : 's'}</Text>
                </View>
                <Text style={styles.mealTotalSmall}>{Math.round(mealTotal.calories)} kcal</Text>
              </View>

              <View style={styles.draftList}>
                {draft.map((item) => {
                  const itemNutrition = scaleNutrition(item.food, item.grams);
                  return (
                    <View key={item.id} style={styles.draftRow}>
                      <View style={styles.draftCopy}>
                        <Text style={styles.foodName}>{item.food.name}</Text>
                        <Text style={styles.foodMeta}>
                          {round(item.grams, 0)} g · {Math.round(itemNutrition.calories)} kcal · P {round(itemNutrition.protein)} · C {round(itemNutrition.carbs)} · F {round(itemNutrition.fat)}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityLabel={`Remove ${item.food.name}`}
                        hitSlop={10}
                        onPress={() => setDraft((previous) => previous.filter((entry) => entry.id !== item.id))}
                        style={styles.trashButton}
                      >
                        <Trash2 size={17} color={theme.danger} strokeWidth={2} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              <View style={styles.totalCard}>
                <View>
                  <Text style={styles.heroEyebrow}>Meal total</Text>
                  <View style={styles.heroValueRow}>
                    <Text style={styles.totalNumber}>{Math.round(mealTotal.calories)}</Text>
                    <Text style={styles.heroUnit}>kcal</Text>
                  </View>
                </View>
                <MacroGrid nutrition={mealTotal} compact />
                <PrimaryButton label="Save meal" onPress={saveMeal} />
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function HistoryScreen({
  meals,
  onDelete,
  onBack
}: {
  meals: Meal[];
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  const sorted = [...meals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const confirmDelete = (meal: Meal) => {
    Alert.alert('Delete meal?', `${meal.name} will be removed from your history.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(meal.id) }
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 28 }
        ]}
      >
        <ScreenHeader
          eyebrow="Meal log"
          title="History"
          subtitle={`${sorted.length} saved meal${sorted.length === 1 ? '' : 's'}`}
          leading={
            <IconButton label="Back to today" onPress={onBack}>
              <ChevronLeft size={21} color={theme.text} strokeWidth={2.1} />
            </IconButton>
          }
        />

        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Clock3 size={18} color={theme.green} strokeWidth={2.2} />
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>No meal history yet</Text>
              <Text style={styles.muted}>Saved meals will appear here automatically.</Text>
            </View>
          </View>
        ) : (
          sorted.map((meal) => (
            <View key={meal.id} style={styles.historyBlock}>
              <MealCard meal={meal} showDate />
              <Pressable
                style={styles.deleteInline}
                onPress={() => confirmDelete(meal)}
                hitSlop={8}
              >
                <Trash2 size={14} color={theme.danger} strokeWidth={2} />
                <Text style={styles.deleteInlineText}>Delete</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MealsScreen({ meals, onDelete }: { meals: Meal[]; onDelete: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const sorted = [...meals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = sorted.filter((meal) => new Date(meal.createdAt).getTime() >= cutoff);
  const loggedDays = Math.max(1, new Set(recent.map((meal) => localDateKey(meal.createdAt))).size);
  const recentTotal = totalForMeals(recent);
  const forecast: Nutrition = {
    calories: recentTotal.calories / loggedDays,
    protein: recentTotal.protein / loggedDays,
    carbs: recentTotal.carbs / loggedDays,
    fat: recentTotal.fat / loggedDays,
    fiber: recentTotal.fiber / loggedDays,
    sugar: recentTotal.sugar / loggedDays,
    sodium: recentTotal.sodium / loggedDays
  };

  const confirmDelete = (meal: Meal) => {
    Alert.alert('Delete meal?', `${meal.name} will be removed from your meal log.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(meal.id) }
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 118 + insets.bottom }
        ]}
      >
        <ScreenHeader
          eyebrow="Meal log"
          title="Meals"
          subtitle={`${sorted.length} saved meal${sorted.length === 1 ? '' : 's'} · history and recent trend`}
        />

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Next-day forecast</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroNumber}>{Math.round(forecast.calories)}</Text>
            <Text style={styles.heroUnit}>kcal</Text>
          </View>
          <Text style={styles.heroCaption}>
            {recent.length === 0
              ? 'Log meals to build a recent-day forecast.'
              : `Based on ${loggedDays} logged day${loggedDays === 1 ? '' : 's'} from the last 7 days.`}
          </Text>
          <View style={styles.heroDivider} />
          <MacroGrid nutrition={forecast} />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>HISTORY</Text>
            <Text style={styles.sectionTitle}>All meals</Text>
          </View>
        </View>

        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Clock3 size={18} color={theme.green} strokeWidth={2.2} />
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>No meals yet</Text>
              <Text style={styles.muted}>Meals saved from Add/Scan will appear here.</Text>
            </View>
          </View>
        ) : (
          sorted.map((meal) => (
            <View key={meal.id} style={styles.historyBlock}>
              <MealCard meal={meal} showDate />
              <Pressable
                style={styles.deleteInline}
                onPress={() => confirmDelete(meal)}
                hitSlop={8}
              >
                <Trash2 size={14} color={theme.danger} strokeWidth={2} />
                <Text style={styles.deleteInlineText}>Delete</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  leading,
  action
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        {leading ? <View style={styles.headerLeading}>{leading}</View> : null}
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>{eyebrow}</Text>
          <Text style={styles.h1}>{title}</Text>
        </View>
        {action ? <View style={styles.headerAction}>{action}</View> : null}
      </View>
      {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function IconButton({
  label,
  onPress,
  children
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function MiniInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.miniInputWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={theme.muted2}
      />
    </View>
  );
}

function MacroGrid({ nutrition, compact = false }: { nutrition: Nutrition; compact?: boolean }) {
  return (
    <View style={[styles.macroGrid, compact && styles.macroGridCompact]}>
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
    <View style={styles.mealCard}>
      <View style={styles.mealHeader}>
        <View style={styles.mealHeaderCopy}>
          <Text style={styles.mealTitle}>{meal.name}</Text>
          <Text style={styles.foodMeta}>
            {showDate ? `${date.toLocaleDateString()} · ` : ''}
            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {meal.items.length} item{meal.items.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Text style={styles.mealCalories}>{Math.round(total.calories)} kcal</Text>
      </View>

      <View style={styles.mealItems}>
        {meal.items.map((item) => {
          const itemTotal = scaleNutrition(item.food, item.grams);
          return (
            <View key={item.id} style={styles.mealItemRow}>
              <Text style={styles.mealItemName}>{item.food.name}</Text>
              <Text style={styles.mealItemValue}>{round(item.grams, 0)} g · {Math.round(itemTotal.calories)} kcal</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.mealMacros}>
        P {round(total.protein)} g · C {round(total.carbs)} g · F {round(total.fat)} g · Fiber {round(total.fiber)} g
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: theme.bg },
  loadingSafe: { flex: 1, backgroundColor: theme.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  loadingMark: { width: 48, height: 48, borderRadius: 16, backgroundColor: theme.greenDark, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  loadingTitle: { color: theme.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  loadingText: { color: theme.muted, fontSize: 14, marginTop: 6 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  header: { marginBottom: 22 },
  headerTop: { minHeight: 56, flexDirection: 'row', alignItems: 'center' },
  headerLeading: { marginRight: 12 },
  headerCopy: { flex: 1 },
  headerAction: { marginLeft: 12 },
  headerEyebrow: { color: theme.green, fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 1.25, textTransform: 'uppercase' },
  h1: { color: theme.text, fontSize: 31, lineHeight: 36, fontWeight: '900', letterSpacing: -0.8, marginTop: 2 },
  headerSubtitle: { color: theme.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  headerPill: { minHeight: 40, borderRadius: 14, backgroundColor: theme.surface2, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerPillActive: { backgroundColor: theme.surface3 },
  headerPillText: { color: theme.green, fontSize: 12, fontWeight: '900' },
  headerPillTextActive: { color: theme.text },

  heroCard: { backgroundColor: theme.surface, borderRadius: 28, padding: 20, marginBottom: 26 },
  heroEyebrow: { color: theme.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroValueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 3 },
  heroNumber: { color: theme.text, fontSize: 58, lineHeight: 62, fontWeight: '900', letterSpacing: -2.6 },
  totalNumber: { color: theme.text, fontSize: 42, lineHeight: 48, fontWeight: '900', letterSpacing: -1.7 },
  heroUnit: { color: theme.muted, fontSize: 14, fontWeight: '800', marginLeft: 7, marginBottom: 9 },
  heroCaption: { color: theme.muted, fontSize: 13, marginTop: 2 },
  heroDivider: { height: 1, backgroundColor: theme.line, marginVertical: 18 },

  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  macroGridCompact: { marginTop: 14 },
  metric: { width: '33.333%', paddingHorizontal: 5, marginBottom: 13 },
  metricValue: { color: theme.text, fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  metricLabel: { color: theme.muted2, fontSize: 11, marginTop: 3, fontWeight: '700' },

  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 },
  sectionKicker: { color: theme.muted2, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: theme.text, fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.45, marginTop: 2 },
  sectionAction: { color: theme.green, fontSize: 12, fontWeight: '900', marginBottom: 3 },

  emptyState: { backgroundColor: theme.surface, borderRadius: 22, padding: 17, flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  emptyIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: theme.greenDark, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: theme.text, fontSize: 15, fontWeight: '900', marginBottom: 4 },
  muted: { color: theme.muted, fontSize: 13, lineHeight: 19 },
  footnote: { color: theme.muted2, fontSize: 11, lineHeight: 17, marginTop: 8 },

  fieldLabel: { color: theme.muted, fontSize: 11, fontWeight: '900', marginBottom: 7, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.7 },
  input: { minHeight: 50, backgroundColor: theme.surface2, color: theme.text, borderRadius: 16, paddingHorizontal: 14, fontSize: 15, borderWidth: 1, borderColor: theme.line },
  searchInputWrap: { minHeight: 52, backgroundColor: theme.surface2, borderRadius: 17, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: theme.line },
  searchInput: { flex: 1, color: theme.text, fontSize: 15, paddingVertical: 12 },
  searchResults: { marginTop: 10, marginBottom: 4 },
  foodSearchRow: { minHeight: 60, borderRadius: 17, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  foodSearchRowActive: { backgroundColor: '#10231D' },
  foodSearchCopy: { flex: 1, paddingRight: 12 },
  selectedDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.green },
  foodName: { color: theme.text, fontSize: 14, fontWeight: '800' },
  foodMeta: { color: theme.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },

  editorCard: { backgroundColor: theme.surface, borderRadius: 24, padding: 17, marginTop: 10, marginBottom: 18 },
  editorHeader: { flexDirection: 'row', alignItems: 'center' },
  editorCopy: { flex: 1, paddingRight: 12 },
  editorTitle: { color: theme.text, fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.3 },
  gramsInputWrap: { minWidth: 92, height: 48, borderRadius: 15, backgroundColor: theme.surface3, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' },
  gramsInput: { color: theme.text, fontSize: 18, fontWeight: '900', minWidth: 48, textAlign: 'right', paddingVertical: 8 },
  gramsUnit: { color: theme.muted, fontSize: 13, fontWeight: '800', marginLeft: 4 },
  previewRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 18 },
  previewCalories: { color: theme.green, fontSize: 22, fontWeight: '900' },
  previewMacros: { color: theme.muted, fontSize: 11, fontWeight: '800' },

  primaryButton: { minHeight: 50, borderRadius: 16, backgroundColor: theme.green, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  primaryButtonPressed: { opacity: 0.86, transform: [{ scale: 0.992 }] },
  primaryButtonText: { color: '#05251B', fontSize: 14, fontWeight: '900' },

  mealTotalSmall: { color: theme.green, fontSize: 14, fontWeight: '900', marginBottom: 3 },
  draftList: { backgroundColor: theme.surface, borderRadius: 22, overflow: 'hidden' },
  draftRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
  draftCopy: { flex: 1, paddingRight: 10 },
  trashButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,122,122,0.08)', alignItems: 'center', justifyContent: 'center' },
  totalCard: { backgroundColor: theme.surface, borderRadius: 24, padding: 18, marginTop: 14 },

  mealCard: { backgroundColor: theme.surface, borderRadius: 22, padding: 16, marginBottom: 10 },
  mealHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  mealHeaderCopy: { flex: 1, paddingRight: 10 },
  mealTitle: { color: theme.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.25 },
  mealCalories: { color: theme.green, fontSize: 15, fontWeight: '900' },
  mealItems: { marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line },
  mealItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  mealItemName: { color: theme.text, fontSize: 12, flex: 1, paddingRight: 8 },
  mealItemValue: { color: theme.muted, fontSize: 11 },
  mealMacros: { color: theme.muted2, fontSize: 10.5, lineHeight: 15, fontWeight: '700', marginTop: 4 },

  historyBlock: { marginBottom: 6 },
  deleteInline: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -4, marginBottom: 12, paddingVertical: 5, paddingHorizontal: 5 },
  deleteInlineText: { color: theme.danger, fontSize: 11, fontWeight: '900' },

  twoCol: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  miniInputWrap: { width: '50%', paddingHorizontal: 5 },
  libraryList: { backgroundColor: theme.surface, borderRadius: 22, marginTop: 14, overflow: 'hidden' },
  libraryRow: { paddingHorizontal: 15, paddingVertical: 14 },
  libraryRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line },
  libraryRowTop: { flexDirection: 'row', alignItems: 'flex-start' },
  libraryCopy: { flex: 1, paddingRight: 12 },
  libraryCalories: { color: theme.green, fontSize: 13, fontWeight: '900' },
  libraryMacros: { color: theme.muted2, fontSize: 10.5, lineHeight: 16, marginTop: 8 },

  tabBarOuter: { position: 'absolute', left: 18, right: 18, height: 82, alignItems: 'center', justifyContent: 'flex-end' },
  tabBarGlass: { width: '100%', height: 68, borderRadius: 24, backgroundColor: 'rgba(17,21,21,0.96)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.24, shadowRadius: 20, elevation: 16 },
  tabHit: { flex: 1, height: 62, alignItems: 'center', justifyContent: 'center' },
  tabItem: { minWidth: 68, alignItems: 'center', justifyContent: 'center' },
  tabIconShell: { width: 34, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tabIconShellActive: { backgroundColor: 'rgba(54,211,153,0.10)' },
  tabLabel: { color: theme.muted2, fontSize: 10, fontWeight: '800', marginTop: 2 },
  tabLabelActive: { color: theme.text },
  tabCenterSpacer: { width: 90 },
  addTabHit: { position: 'absolute', top: 0, width: 92, alignItems: 'center' },
  addTabContent: { alignItems: 'center' },
  addButton: { width: 58, height: 58, borderRadius: 20, backgroundColor: theme.green, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.24, shadowRadius: 12, elevation: 12 },
  addButtonActive: { backgroundColor: '#4BDBA5' },
  addTabLabel: { color: theme.muted, fontSize: 10, fontWeight: '900', marginTop: 4 },
  addTabLabelActive: { color: theme.text }
});
