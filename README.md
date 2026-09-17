# AccessRide Rider + Agency

Two standalone Android apps for accessible transportation and emergency assistance in the United States.

## Included

- Rider app (`org.accessride.rider`): account login, profile review, password changes, one-way and round-trip requests, voice or keyboard input, ride changes, 711 support, and long-press SOS.
- Agency app (`org.accessride.agency`): staff login, rider directory, profile/account creation, account activation, multi-rider queue, request workflow, and SOS acknowledgement.
- Mobile shell: Capacitor configuration for iOS and Android.
- Backend schema: Supabase tables, audit history, realtime publication, and role-based row-level security.

## Run

Configure local rider and agency test accounts in your dedicated Supabase project. Do not commit account credentials.

## Mobile

```bash
npm install
npm run prepare:android
./android/gradlew -p android assembleRiderDebug assembleAgencyDebug
```

Open `ios/App/App.xcworkspace` in Xcode or `android` in Android Studio.

Before production:

1. Create a dedicated Supabase project and configure `.env` from `.env.example`.
2. Apply both migrations and deploy `supabase/functions/create-rider`.
3. Create the initial agency and dispatcher profile.
4. Connect push/SMS escalation and replace sample data.
5. Complete ADA/WCAG, privacy, retention, incident-response, and emergency-service legal reviews.
