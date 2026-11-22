# Web

Web se pokreće iz svog foldera preko Vitea. Ne pokreće Expo, ne učitava izvornu mobilnu mapu i ne koristi unified.mjs. Zasloni su u src/pages, dijeljene vizualne komponente u src/components, API i lokalni red računa u src/services. React Native Web prikazuje te komponente kao elemente preglednika. U src/App.jsx su stanje aplikacije, navigacija i povezivanje zaslona.

U korijenu projekta: npm ci, zatim npm run dev. Samo web: npm run dev -w @splitit/web. Produkcija: npm run build -w @splitit/web. Izlaz: apps/web/dist. Na hostingu postavi VITE_API_URL; na lokalnom računalu zadano je http://localhost:4000. Izborno: VITE_WEB_URL i VITE_GOOGLE_CLIENT_ID. Promjene ovih vrijednosti zahtijevaju ponovni web build.

Grupni računi i korisničke prijave ostaju u istom API-ju; ne treba migracija baze. Očuvaj istu domenu i sadržaj apps/web/.env. Lokalna memorija gosta vezana je uz njegov preglednik i domenu. Kamera koristi odabir slike s capture=environment; preglednik i uređaj određuju hoće li se izravno otvoriti kamera ili odabir datoteke.
