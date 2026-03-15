# Infant Tracker

An iOS app for parents to log and monitor baby activity — feedings, sleep, diapers, growth, and more.

## Tech Stack
- Next.js 16 (App Router, static export)
- TypeScript + Tailwind CSS
- Supabase (database, auth, realtime, push notifications)
- Capacitor 8 (iOS wrapper)
- Recharts

## Dev Workflow
```bash
npm run build        # build static export
npx cap sync ios     # sync to Xcode
npx cap open ios     # open Xcode
```
