import { MacroTargets, Profile } from '../types';

const activityFactors = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725
} as const;

export function calculateMacros(profile: Profile): MacroTargets {
  const sexOffset = profile.sexForEstimate === 'male' ? 5 : -161;
  const bmr =
    10 * profile.weightKg +
    6.25 * profile.heightCm -
    5 * profile.age +
    sexOffset;

  const maintenance = Math.round(bmr * activityFactors[profile.activity]);

  // Moderate starting deficit. The app then recommends adjusting from trend data,
  // not from single-day scale changes.
  const calories = Math.max(1200, Math.round(maintenance * 0.85));

  const protein = Math.round(profile.weightKg * 1.8);
  const fat = Math.round(profile.weightKg * 0.8);
  const remainingCalories = Math.max(
    0,
    calories - protein * 4 - fat * 9
  );
  const carbs = Math.round(remainingCalories / 4);

  return { maintenance, calories, protein, carbs, fat };
}

export function safeWeeklyLossRange(weightKg: number) {
  return {
    low: +(weightKg * 0.004).toFixed(2),
    high: +(weightKg * 0.008).toFixed(2)
  };
}
