# Lostit — 90-Day Focus System

Lostit is a React Native / Expo app for turning one important goal into a clear 90-day plan.

It is intentionally general-purpose. The app is built around focus, routines, habits, consistency, reflection, and progress — not any specific health, fitness, or lifestyle outcome.

## Core flow

1. Define one primary goal
2. Decide what success looks like
3. Build a weekly plan
4. Create repeatable daily routines
5. Track a small set of habits
6. Log progress and review each week
7. Follow a 90-day roadmap and adjust when needed

## Included

- Expo + React Native + TypeScript
- Simple onboarding for goal, motivation, available time, preferred routine, and common obstacles
- Goal breakdown into weekly actions
- Daily focus-session structure
- Routine templates
- Habit checklist
- Progress score logging
- Weekly review questions
- 90-day phased roadmap
- Dark interface with green accents
- No API key stored in the mobile app

## Run locally

Requires Node.js 22.13+ for Expo SDK 57.

```bash
npm install
npx expo start
```

Open the project with Expo Go or an Android/iOS simulator.

## Architecture

The current MVP works locally with deterministic planning rules and React state. A production version can add:

- authentication
- persistent local storage
- cloud sync
- notifications
- goal history
- custom habit templates
- analytics and crash reporting
- AI-generated plans through a secure backend

If AI features are added, keep provider credentials on the server. Do not place private API keys in the React Native bundle.

## Product direction

Lostit should stay outcome-agnostic: the user chooses the goal, and the app supplies the structure for planning, consistency, reviews, and course correction.