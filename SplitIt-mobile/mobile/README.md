# SplitIt Mobile

React Native + Expo SDK 55. Detaljne upute za VS Code, postojeći API i Android APK nalaze se u [POCNI-OVDJE.md](../POCNI-OVDJE.md).

```sh
npm ci
cp .env.example .env
# Uredi .env: isti API kao web.
npm start
```

U VS Codeu možeš koristiti **Terminal → Run Task → SplitIt: pokreni mobitel**. APK task koristi prethodno konfiguriran Expo račun i EAS projekt.

Za brzi pregled dizajna u pregledniku: `npx expo start --web`. Web pregled koristi iste RN komponente; nije zamjena za postojeći `apps/web`. U tom pregledu prijava traje samo do osvježavanja stranice. Android/iOS koriste SecureStore.

Provjere: `npm test`, `npm run check`, `npx expo export --platform android`.
