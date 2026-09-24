# SplitIt – web + React Native mobilna aplikacija

**Već imaš instaliranu aplikaciju? Prvo pročitaj [NADOGRADNJA.md](NADOGRADNJA.md).** Ondje su nove funkcionalnosti i nadogradnja uz zadržavanje postojećeg Expo projekta. Upute ispod služe početnom postavljanju.

U mapi `mobile/` nalazi se izvorna React Native aplikacija s Expo SDK-om 55. Koristi React Native komponente, a ne WebView. Postojeći `apps/web`, `apps/api` i `packages/shared` ostaju u projektu. Mobilni projekt ima zaseban `package.json` i lockfile kako se React 19 mobilne aplikacije ne bi miješao s Reactom postojeće web aplikacije.

## Najbrže pokretanje u VS Codeu

1. Raspakiraj ZIP i otvori mapu `SplitIt-main` u VS Codeu.
2. Instaliraj Node.js 22 LTS (najmanje 22.13) i otvori **Terminal → New Terminal**.
3. Pokreni:

```powershell
cd mobile
npm ci
Copy-Item .env.example .env
```

Na macOS/Linuxu umjesto `Copy-Item` koristi `cp .env.example .env`.

4. U `mobile/.env` unesi stvarne adrese:

```dotenv
EXPO_PUBLIC_API_URL=https://adresa-tvog-api-ja
EXPO_PUBLIC_WEB_URL=https://adresa-tvoje-web-aplikacije
```

**API adresa mora biti ista kao `VITE_API_URL` postojeće web aplikacije.** To nije adresa web stranice, nego Express API-ja. Nemoj dodavati `/groups`. APK ne sadrži Express server ili bazu. Za dijeljenje podataka web i mobitel moraju koristiti isti API i istu bazu. Ne pokreći drugu praznu bazu ako želiš vidjeti postojeće podatke.

5. Pokreni razvoj:

```powershell
npm start
```

Na Android mobitelu koristi Expo Go kompatibilan sa SDK-om 55 (https://expo.dev/go). Skeniraj QR kod. Za emulator pokreni Android Studio emulator i u terminalu pritisni `a`. Mobitel i računalo trebaju moći komunicirati preko mreže. Metro služi razvojni kod; nije potreban za samostalni preview APK.

Ako mijenjaš `.env`, ponovno pokreni Metro naredbom `npx expo start --clear`.

## Izradi samostalni APK iz VS Code terminala

Ove naredbe izvodi iz mape `mobile/`. Potreban je tvoj Expo račun. Build se izvodi na EAS serveru, pa lokalni Android Studio nije potreban.

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
```

Pri `init` odaberi svoj Expo račun/projekt. Naredba upisuje stvarni EAS `projectId` u konfiguraciju. U `app.json` prije prve distribucije promijeni `android.package` iz `com.splitit.mobile` u svoj jedinstveni identifikator, npr. `hr.tvojeime.splitit`. Nakon prve objave nemoj ga mijenjati za istu aplikaciju.

**Obavezno postavi javne adrese i za cloud build.** Lokalni `.env` je ignoriran Gitom; ne oslanjaj se na to da će biti poslan u EAS. Unesi stvarne vrijednosti u sljedećim naredbama:

```powershell
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://adresa-tvog-api-ja --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_WEB_URL --value https://adresa-tvoje-web-aplikacije --visibility plaintext
npx eas-cli@latest build -p android --profile preview
```

Ako varijabla već postoji, promijeni je u postavkama EAS projekta umjesto ponovnog stvaranja. Ako EAS zatraži Android keystore, za novi projekt dopusti generiranje novoga; za postojeću objavljenu aplikaciju koristi njezin postojeći ključ. Sačuvaj pristup računu i potpisnom ključu.

Profil `preview` u `eas.json` već sadrži `android.buildType: apk`. Kad build završi, terminal daje poveznicu za preuzimanje `.apk` datoteke. Otvori je na Android mobitelu i dopusti instalaciju iz tog izvora. APK se pokreće bez računala, ali za podatke i skeniranje treba dostupan API.

Za Google Play koristi `--profile production` (AAB), uz iste dvije varijable u EAS okruženju `production`. Ovdje nije automatski objavljena aplikacija niti je pokrenut build na tvojem računu.

Službene upute: https://docs.expo.dev/build-reference/apk/

## Lokalno testiranje s Android SDK-om

Instaliraj Android Studio, Android SDK i JDK 17; postavi `ANDROID_HOME` i otvori emulator. Zatim iz `mobile/`:

```powershell
npx expo run:android
```

To generira `android/` i instalira razvojnu verziju. Za ručno generiranje debug APK-a na Windowsu:

```powershell
npx expo prebuild --platform android
cd android
.\gradlew.bat assembleDebug
```

Datoteka: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Debug verzija očekuje razvojni Metro server. Za samostalni instalacijski APK koristi EAS `preview` postupak iznad. Na macOS/Linuxu Gradle se pokreće kao `./gradlew assembleDebug`.

## Lokalni API i povezivanje

Najjednostavnije je koristiti postojeći HTTPS API. `localhost` na mobitelu označava **mobitel**, a ne računalo. Android emulator pristupa računalu preko `10.0.2.2`; fizički mobitel preko LAN IP adrese računala. Za native release preporučen je HTTPS, jer Android može blokirati obični HTTP. Za lokalni razvoj možeš izložiti razvojni API HTTPS tunelom. Expo `--tunnel` tunelira Metro, ne tvoj Express API.

Ako pokrećeš izvorni backend lokalno, iz korijena projekta instaliraj njegove ovisnosti (`npm ci`), pripremi `apps/api/.env` prema izvornom README-u i pokreni `npm run db:generate`, zatim `npm run dev`. Migracije baze pokreći samo namjerno i na odgovarajućoj bazi. Dodaj stvarni `JWT_SECRET`; za AI čitanje računa potreban je server-side `OPENAI_API_KEY`. Ključ se nikad ne upisuje u `EXPO_PUBLIC_*` ni u mobilni kod.

## Kako rade web i mobitel zajedno

- Prijava i registracija koriste postojeće `/auth` rute i JWT.
- Grupu otvorenu na webu dodaj na mobitel kodom i lozinkom. Imena, stavke, nacrti, platitelji i obračuni dolaze iz istih `/groups` ruta.
- „Moje grupe”, odabir „Tko si ti?”, jezik i tema spremaju se lokalno na uređaj, jednako konceptu izvornog weba. Browser localStorage nije dostupan mobitelu. Samo prijavljivanje ne povlači popis svih grupa jer izvorni API nema takvu rutu.
- Token se na Androidu/iOS-u čuva kroz Expo SecureStore.
- Mobilna aplikacija osvježava grupu nakon vlastitih izmjena, pri povratku iz pozadine i povlačenjem prema dolje. Web osvježi nakon izmjena na mobitelu. Nema novog WebSocket servisa niti automatske sinkronizacije bez osvježavanja na oba klijenta.
- Pozivnica dijeli web poveznicu `/join?code=...` i `splitit://join?code=...`. Lozinka se ne dijeli automatski. HTTPS app links nisu konfigurirani bez tvoje domene i Android potpisnog certifikata.

## Dizajn i padding

Zelena paleta, svijetle/tamne kartice, donja navigacija, velik čitljiv iznos i dodirne mete od najmanje 44 dp. Glavni ekran dodaje `insets.top` **samo jednom**. Zaglavlje je 52 dp, sadržaj počinje s dodatnih 12 dp; nema drugog SafeAreaViewa ili ručnog zbrajanja visine statusne trake. Modal kotača koristi vlastiti SafeAreaView. Donji rub prati sistemsku navigaciju, a iOS tipkovnica koristi KeyboardAvoidingView.

## Prenesene mogućnosti

| Web mogućnost | Mobilni zaslon |
|---|---|
| Početna, lokalne grupe, uklanjanje prečaca uz potvrdu | Početna / Grupe |
| Kreiranje grupe, lozinka, sudionici, 3 tipa pristupa | Nova grupa |
| Pridruživanje kodom i lozinkom | Pridruži se |
| Prijava, registracija, odjava | Profil |
| Odabir identiteta sudionika | Grupa → Sudionici |
| Dodavanje sudionika, uređivanje i uklanjanje preko postojećih API ruta | Grupa → Sudionici |
| Zaključavanje i otključavanje vlasnika | Grupa → Sudionici |
| Ručni unos stavki i više platitelja | Novi trošak |
| Kamera i slika računa, AI čitanje | Novi trošak → Skeniraj / Galerija |
| Jednaka podjela odabranim sudionicima po stavci | Novi trošak / Nacrti |
| Nacrti, dodjela „Ovo je moje”, završna potvrda | Grupa → nacrti iznad donjih gumba |
| Nasumična podjela stavke ili cijelog računa, potvrda/ponavljanje | Zavrti |
| Pregled računa, platitelji, stavke i udjeli | Grupa → Troškovi / Dugovanja |
| Salda i predložena poravnanja | Grupa → Troškovi / Dugovanja |
| Povijest promjena | Grupa → Povijest |
| HR/EN i svijetla/tamna tema | Profil |
| Dijeljenje i kopiranje koda | Grupa → Sudionici → Pozovi / Kopiraj kod |

Kotač čuva web pravilo: sve kombinacije 1–4 odabrane osobe i 3 dodatna ishoda jednake podjele. Animacija je dekorativna; rezultat je ispisan prije potvrde. Prikaz rezultata u centima je pregled; konačne udjele, uključujući zaokruživanje, uvijek određuje postojeći API.

Izvorni README spominje uređivanje/brisanje pojedinačnih uplata, ali dostavljeni API ne registrira PATCH/DELETE `/payments/:id`, a trenutačni web ih ne prikazuje kao funkcionalne kontrole. Mobilna verzija zato koristi stvarni sustav računa/nacrta; dodatno omogućuje postojeće API rute za uređivanje platitelja nacrta i brisanje cijelog troška. Backend ostaje izvor obračuna i autorizacije.

## Provjere i ograničenja

Iz `mobile/`:

```powershell
npm test
npm run check
npx expo install --check
npx expo export --platform android
```

Testovi provjeravaju decimalne zareze, valjanost iznosa, očuvanje centa pri podjeli, uvjete potvrde te raspodjelu nasumičnih ishoda. Export provjerava Android JavaScript paket; **nije APK build**.

Stvarna prijava, kamera na uređaju, AI obrada, baza i komunikacija web ↔ mobitel zahtijevaju tvoje adrese i pristup postojećem backendu. APK build i test na fizičkom mobitelu ovdje nisu obavljeni. Prije distribucije prođi scenarij: otvori istu grupu na oba uređaja, stvori nacrt, dodijeli stavke na drugom klijentu, osvježi, potvrdi račun, usporedi iznose, provjeri kameru, zaključavanje i odjavu. Posebno provjeri gornji razmak na svojem modelu mobitela.

Potvrđeno pri pripremi paketa: TypeScript provjera bez grešaka, 4 uspješna testa, Expo provjera verzija prema lokalnom SDK manifestu, uspješan Android Hermes export i web export. Vizualni pregled u browseru/emulatoru nije dovršen jer preglednik nije bio dostupan u radnom okruženju.
