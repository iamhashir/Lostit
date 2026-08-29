import fs from 'node:fs';

const file = 'App.tsx';
let source = fs.readFileSync(file, 'utf8');

if (source.includes('navAddButton') && source.includes('navDockGlow')) {
  console.log('Next-gen navigation already installed.');
  process.exit(0);
}

const oldTabBar = `function TabBar({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  const tabs: { key: Screen; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'add', label: '+ Add' },
    { key: 'history', label: 'History' },
    { key: 'foods', label: 'Foods' }
  ];
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const active = tab.key === screen;
        return (
          <Pressable key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)}>
            <View style={[styles.tabPill, active && styles.tabPillActive]}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}`;

const newTabBar = `function TabBar({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
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
}`;

const oldStyles = `  tabBar: { position: 'absolute', left: 14, right: 14, bottom: 10, minHeight: 66, borderRadius: 22, backgroundColor: '#111719F2', borderWidth: 1, borderColor: theme.border, flexDirection: 'row', padding: 7 },
  tab: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabPill: { minWidth: 66, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 8, alignItems: 'center' },
  tabPillActive: { backgroundColor: theme.greenSoft },
  tabText: { color: theme.muted, fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: theme.green }`;

const newStyles = `  navDockWrap: { position: 'absolute', left: 12, right: 12, bottom: 10, height: 88, justifyContent: 'flex-end' },
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
  tabTextActive: { color: '#59E7B7' }`;

if (!source.includes(oldTabBar)) {
  throw new Error('Could not find the existing TabBar function. Navigation source changed unexpectedly.');
}
if (!source.includes(oldStyles)) {
  throw new Error('Could not find the existing TabBar styles. Navigation source changed unexpectedly.');
}

source = source.replace(oldTabBar, newTabBar).replace(oldStyles, newStyles);
fs.writeFileSync(file, source);
console.log('Installed next-gen MealTrack navigation dock.');
