export type RoutineStyle = 'morning' | 'evening' | 'split' | 'flexible';

export type Profile = {
  name: string;
  primaryGoal: string;
  successDefinition: string;
  motivation: string;
  dailyMinutes: number;
  focusDays: number;
  routineStyle: RoutineStyle;
  obstacles: string;
};

export type ProgressEntry = {
  day: number;
  score: number;
  note?: string;
};

export type AppScreen =
  | 'home'
  | 'plan'
  | 'routine'
  | 'focus'
  | 'habits'
  | 'tracking'
  | 'roadmap';
