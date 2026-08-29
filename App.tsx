import React, { useState } from 'react';
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { HabitsScreen } from './src/screens/HabitsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { RoutineScreen } from './src/screens/RoutineScreen';
import { FocusScreen } from './src/screens/FocusScreen';
import { RoadmapScreen } from './src/screens/RoadmapScreen';
import { TrackingScreen } from './src/screens/TrackingScreen';
import { theme } from './src/theme';
import { AppScreen, Profile, ProgressEntry } from './src/types';

const tabs: { key: AppScreen; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'plan', label: 'Plan' },
  { key: 'focus', label: 'Focus' },
  { key: 'tracking', label: 'Track' }
];

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<AppScreen>('home');
  const [progress, setProgress] = useState<ProgressEntry[]>([]);

  if (!profile) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
        <OnboardingScreen onComplete={setProfile} />
      </>
    );
  }

  const content = (() => {
    switch (screen) {
      case 'plan': return <PlanScreen profile={profile} />;
      case 'routine': return <RoutineScreen profile={profile} />;
      case 'focus': return <FocusScreen profile={profile} />;
      case 'habits': return <HabitsScreen />;
      case 'tracking': return <TrackingScreen entries={progress} onAdd={(score, note) => setProgress((p) => [...p, { day: p.length + 1, score, note }])} />;
      case 'roadmap': return <RoadmapScreen />;
      default: return <HomeScreen profile={profile} entries={progress} onNavigate={setScreen} />;
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
            <Pressable key={tab.key} onPress={() => setScreen(tab.key)} style={styles.tab}>
              <View style={[styles.tabPill, active && styles.tabPillActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
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
  tabBar: { position: 'absolute', left: 14, right: 14, bottom: 10, minHeight: 64, borderRadius: 22, backgroundColor: '#111719F2', borderWidth: 1, borderColor: theme.border, flexDirection: 'row', padding: 7 },
  tab: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabPill: { minWidth: 64, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 9, alignItems: 'center' },
  tabPillActive: { backgroundColor: theme.greenSoft },
  tabText: { color: theme.muted, fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: theme.green }
});
