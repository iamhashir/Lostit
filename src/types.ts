export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high';
export type SexForEstimate = 'male' | 'female';

export type Profile = {
  age: number;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number;
  sexForEstimate: SexForEstimate;
  activity: ActivityLevel;
  trainingDays: number;
  equipment: string;
  foods: string;
};

export type MacroTargets = {
  maintenance: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type WeightEntry = {
  day: number;
  weightKg: number;
};

export type AppScreen =
  | 'home'
  | 'nutrition'
  | 'meals'
  | 'training'
  | 'habits'
  | 'tracking'
  | 'roadmap';
