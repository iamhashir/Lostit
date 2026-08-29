# FatLoss 90 — React Native / Expo MVP

A dark, green-accent React Native app based on the seven fat-loss planning ideas in the supplied screenshots:

1. Master 90-day plan
2. Calories and macros
3. Practical meal plan
4. Strength-training plan
5. Daily behavior system
6. Progress tracking
7. 90-day execution roadmap

## Included

- Expo + React Native + TypeScript
- Onboarding for age, height, weight, goal, activity, training days, equipment, and preferred foods
- Mifflin-St Jeor-based maintenance estimate
- Moderate starting calorie deficit
- Protein / carbohydrate / fat targets
- Meal structure and swaps
- Strength program and cardio guidance
- Habit checklist
- Weight logging and simple trend logic
- Weekly review questions
- 90-day phased roadmap
- No API key stored in the mobile app

## Run it

Requires Node.js 22.13+ for Expo SDK 57.

```bash
npm install
npx expo start
```

Then open the project in Expo Go or an Android/iOS simulator.

## Important implementation note

This MVP generates plans locally with deterministic rules. If you want AI-personalized meal plans, training plans, weekly reviews, or chat coaching, put the AI call behind a secure backend or serverless function. Do **not** ship an OpenAI API key inside the React Native bundle.

A production version should also add:

- authentication
- persistent storage / cloud sync
- progress photos
- waist / steps / sleep tracking
- push reminders
- clinician-safety flows where appropriate
- backend-generated AI plans with structured JSON output
- subscriptions if this will be commercial
- proper analytics, crash reporting, and privacy disclosures
