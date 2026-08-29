# MealTrack

MealTrack is a local-first React Native / Expo meal logger.

The app has one job: **log what you eat and calculate calories and nutrients without AI.**

## What it does

- Add a meal at any time
- Search a built-in food database
- Enter the amount eaten in grams
- Combine multiple foods into one meal
- Calculate calories instantly
- Calculate protein, carbohydrates, fat, fiber, sugar, and sodium
- Show daily nutrition totals
- Keep a meal history
- Create custom foods from package nutrition labels
- Save meals and custom foods locally on the device

## No AI and no nutrition API

There is no OpenAI integration, chatbot, image recognition, or AI estimation.

Nutrition is deterministic:

```text
food nutrient value per 100 g × grams eaten / 100
```

The built-in database contains generic values for common foods. Brand-specific foods can differ, so packaged foods should be entered as a custom food using the package label.

## Local storage

Meal history and custom foods are persisted with `@react-native-async-storage/async-storage`. No account or cloud connection is required for the core app.

## Technology

- Expo SDK 57
- React Native
- TypeScript
- AsyncStorage

## Run locally

```bash
npm install
npx expo start
```

## Android release build

The repository includes a GitHub Actions workflow that produces an optimized ARM64 release APK. Release builds use code minification, resource shrinking, and JavaScript bundle compression through `expo-build-properties`.

## Product scope

MealTrack is a food and nutrient logging tool. It does not prescribe diets, set body-weight goals, generate meal plans, or provide medical advice.
