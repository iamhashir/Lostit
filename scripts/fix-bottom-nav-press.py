from pathlib import Path


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing patch marker: {label}")
    return text.replace(old, new, 1)

path = Path('App.tsx')
s = path.read_text()

s = replace_required(
    s,
    "import React, { useEffect, useMemo, useState } from 'react';",
    "import React, { useEffect, useMemo, useRef, useState } from 'react';",
    'React useRef import'
)

s = replace_required(
    s,
    "import Animated, {\n  interpolate,\n  useAnimatedStyle,",
    "import Animated, {\n  cancelAnimation,\n  interpolate,\n  useAnimatedStyle,",
    'cancelAnimation import'
)

s = replace_required(
    s,
    "function PremiumTabBar({ state, navigation }: BottomTabBarProps) {\n  const insets = useSafeAreaInsets();\n  const activeRoute = state.routes[state.index]?.name;\n\n  if (activeRoute === 'History') return null;",
    "function PremiumTabBar({ state, navigation }: BottomTabBarProps) {\n  const insets = useSafeAreaInsets();\n  const activeRoute = state.routes[state.index]?.name;\n  const navigationLocked = useRef(false);\n\n  const safeNavigate = (routeName: 'Today' | 'AddMeal' | 'Foods') => {\n    if (activeRoute === routeName || navigationLocked.current) return;\n    navigationLocked.current = true;\n    navigation.navigate(routeName);\n    setTimeout(() => {\n      navigationLocked.current = false;\n    }, 220);\n  };\n\n  if (activeRoute === 'History') return null;",
    'navigation lock'
)

s = s.replace("onPress={() => navigation.navigate('Today')}", "onPress={() => safeNavigate('Today')}", 1)
s = s.replace("onPress={() => navigation.navigate('Foods')}", "onPress={() => safeNavigate('Foods')}", 1)
s = s.replace("onPress={() => navigation.navigate('AddMeal')}", "onPress={() => safeNavigate('AddMeal')}", 1)

old_tab = """  const progress = useSharedValue(active ? 1 : 0);\n\n  useEffect(() => {\n    progress.value = withTiming(active ? 1 : 0, { duration: 180 });\n  }, [active, progress]);\n\n  const animatedStyle = useAnimatedStyle(() => ({\n    opacity: interpolate(progress.value, [0, 1], [0.72, 1]),\n    transform: [\n      { translateY: interpolate(progress.value, [0, 1], [0, -2]) },\n      { scale: interpolate(progress.value, [0, 1], [1, 1.03]) }\n    ]\n  }));\n"""
new_tab = """  const progress = useSharedValue(active ? 1 : 0);\n  const pressScale = useSharedValue(1);\n\n  useEffect(() => {\n    cancelAnimation(progress);\n    progress.value = withTiming(active ? 1 : 0, { duration: 150 });\n  }, [active, progress]);\n\n  const pressIn = () => {\n    cancelAnimation(pressScale);\n    pressScale.value = withTiming(0.90, { duration: 70 });\n  };\n\n  const pressOut = () => {\n    cancelAnimation(pressScale);\n    pressScale.value = withSpring(1, {\n      damping: 17,\n      stiffness: 330,\n      mass: 0.45\n    });\n  };\n\n  const animatedStyle = useAnimatedStyle(() => ({\n    opacity: interpolate(progress.value, [0, 1], [0.72, 1]),\n    transform: [\n      { translateY: interpolate(progress.value, [0, 1], [0, -2]) },\n      { scale: interpolate(progress.value, [0, 1], [1, 1.03]) * pressScale.value }\n    ]\n  }));\n"""
s = replace_required(s, old_tab, new_tab, 'normal tab animation')

s = replace_required(
    s,
    "      hitSlop={8}\n      onPress={onPress}\n      style={styles.tabHit}",
    "      hitSlop={8}\n      onPressIn={pressIn}\n      onPressOut={pressOut}\n      onPress={onPress}\n      style={styles.tabHit}",
    'normal tab press handlers'
)

old_add = """  const progress = useSharedValue(active ? 1 : 0);\n\n  useEffect(() => {\n    progress.value = withSpring(active ? 1 : 0, {\n      damping: 18,\n      stiffness: 220,\n      mass: 0.7\n    });\n  }, [active, progress]);\n\n  const animatedStyle = useAnimatedStyle(() => ({\n    transform: [\n      { translateY: interpolate(progress.value, [0, 1], [0, -3]) },\n      { scale: interpolate(progress.value, [0, 1], [1, 1.045]) }\n    ]\n  }));\n"""
new_add = """  const progress = useSharedValue(active ? 1 : 0);\n  const pressScale = useSharedValue(1);\n\n  useEffect(() => {\n    cancelAnimation(progress);\n    progress.value = withSpring(active ? 1 : 0, {\n      damping: 18,\n      stiffness: 220,\n      mass: 0.7\n    });\n  }, [active, progress]);\n\n  const pressIn = () => {\n    cancelAnimation(pressScale);\n    pressScale.value = withTiming(0.90, { duration: 70 });\n  };\n\n  const pressOut = () => {\n    cancelAnimation(pressScale);\n    pressScale.value = withSpring(1, {\n      damping: 17,\n      stiffness: 330,\n      mass: 0.45\n    });\n  };\n\n  const animatedStyle = useAnimatedStyle(() => ({\n    transform: [\n      { translateY: interpolate(progress.value, [0, 1], [0, -3]) },\n      { scale: interpolate(progress.value, [0, 1], [1, 1.045]) * pressScale.value }\n    ]\n  }));\n"""
s = replace_required(s, old_add, new_add, 'add button animation')

s = replace_required(
    s,
    "      hitSlop={10}\n      onPress={onPress}\n      style={styles.addTabHit}",
    "      hitSlop={10}\n      onPressIn={pressIn}\n      onPressOut={pressOut}\n      onPress={onPress}\n      style={styles.addTabHit}",
    'add button press handlers'
)

path.write_text(s)
