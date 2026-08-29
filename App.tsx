import React, { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { HabitsScreen } from './src/screens/HabitsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MealsScreen } from './src/screens/MealsScreen';
import { NutritionScreen } from './src/screens/NutritionScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { RoadmapScreen } from './src/screens/RoadmapScreen';
import { TrackingScreen } from './src/screens/TrackingScreen';
import { TrainingScreen } from './src/screens/TrainingScreen';
import { theme } from './src/theme';
import { AppScreen, Profile, WeightEntry } from './src/types';
import { calculateMacros } from './src/utils/nutrition';

const tabs: { key: AppScreen; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'nutrition', label: 'Macros' },
  { key: 'training', label: 'Train' },
  { key: 'tracking', label: 'Track' }
];

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<AppScreen>('home');
  const [weights, setWeights] = useState<WeightEntry[]>([]);

  const macros = useMemo(
    () => (profile ? calculateMacros(profile) : null),
    [profile]
  );

  if (!profile || !macros) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
        <OnboardingScreen
          onComplete={(next) => {
            setProfile(next);
            setWeights([{ day: 1, weightKg: next.weightKg }]);
          }}
        />
      </>
    );
  }

  const content = (() => {
    switch (screen) {
      case 'nutrition':
        return <NutritionScreen profile={profile} macros={macros} />;
      case 'meals':
        return <MealsScreen profile={profile} macros={macros} />;
      case 'training':
        return <TrainingScreen profile={profile} />;
      case 'habits':
        return <HabitsScreen />;
      case 'tracking':
        return (
          <TrackingScreen
            profile={profile}
            weights={weights}
            onAddWeight={(weightKg) =>
              setWeights((current) => [
                ...current,
                { day: current.length + 1, weightKg }
              ])
            }
          />
        );
      case 'roadmap':
        return <RoadmapScreen />;
      default:
        return (
          <HomeScreen
            profile={profile}
            macros={macros}
            weights={weights}
            onNavigate={setScreen}
          />
        );
    }
  })();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <View style={styles.content}>{content}</View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = screen === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setScreen(tab.key)}
              style={styles.tab}
            >
              <View style={[styles.tabPill, active && styles.tabPillActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  content: { flex: 1 },
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 10,
    minHeight: 64,
    borderRadius: 22,
    backgroundColor: '#111719F2',
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    padding: 7
  },
  tab: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabPill: {
    minWidth: 64,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 9,
    alignItems: 'center'
  },
  tabPillActive: { backgroundColor: theme.greenSoft },
  tabText: { color: theme.muted, fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: theme.green }
});
