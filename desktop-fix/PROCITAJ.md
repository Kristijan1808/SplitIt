# Desktop raspored i unos stavki

Ovaj mali dodatak ne zamjenjuje tvoje stranice niti komponente. Namijenjen je webu iz prethodnog paketa SplitIt-Web-popravci, s klasama draftItemEditor, rpQty i expenses-container.

## Primjena

1. Mapu desktop-fix iz ZIP-a kopiraj u korijen repozitorija, uz apps i glavni package.json.
2. Zaustavi npm run dev.
3. Iz korijena pokreni:

    node desktop-fix/primijeni.cjs
    npm run build -w @splitit/web
    npm run dev

Ako primijeni.cjs prijavi nepoznat oblik obrasca/datuma, neće ništa mijenjati. Pošalji aktualni apps/web, bez .env, node_modules i dist.

Za Git commit uključi izmijenjene apps/web/src/main.tsx, apps/web/src/pages/GroupAddExpensePage.tsx, novi apps/web/src/styles/desktopReceiptLayout.css i uklanjanje starih .jsx.backup ako su bili praćeni. Ne dodaj .splitit-backups u Git. Mapu desktop-fix nakon uspješne primjene smiješ ukloniti.

## Što se mijenja

- Popis računa na desktopu zauzima cijelu širinu svojeg sadržaja umjesto prve ćelije stare mreže.
- Filtri se raspoređuju u retke bez odrezivanja sadržaja.
- Naziv, cijena i količina stavke nalaze se u istome redu od širine 370 px; ispod toga naziv ima zaseban red, kao u dostupnom mobilnom kodu.
- Količina ostaje kompaktna kontrola minus / broj / plus.
- Broj stavke i uklanjanje su u gornjem retku kartice; podjela je ispod unosa.
- Uklanja se samo vidljivi odabir datuma. Postojeća logika spremanja datuma i očuvanja datuma pri uređivanju ostaje.
- .jsx.backup datoteke premještaju se iz src u .splitit-backups samo ako postoji istoimeni .tsx. Ako kod sadrži referencu na .backup, sve ostaju radi ručne provjere. To nije konverzija JSX-a u TypeScript.

## Usporedba s mobilnom aplikacijom

Ne tvrdim da su web i mobilna aplikacija 100 % jednaki.

Potvrđeno u dostupnom mobilnom izvornom kodu:
- Datum računa pohranjuje se, ali nije ponuđen korisniku kao polje. Dodatak time usklađuje web.
- Naziv, cijena i količina su u retku, uz prelamanje ispod 370 px. Dodatak usklađuje taj raspored.
- Mobilna ima automatske kategorije, jednog/više platitelja, podjelu po komadima i zajedničke stavke. Prethodni paket ih je prenio na web; ovaj dodatak ne mijenja njihovu logiku.
- Web ostaje u apps/web, mobilna u splitit-mobile/mobile. Nema automatskog preslikavanja izvornog koda.

Preostale razlike u dostupnim verzijama:
- Mobilna ograničava početni popis računa na 30 i omogućuje postupno prikazivanje; web filtrira i prikazuje cijeli popis.
- Filtri i dio postavki podjele na mobilnoj otvaraju se na zahtjev. Na webu su neki prikazani odmah.
- Kamera, galerija, dozvole i ponašanje bez interneta ovise o platformi. Web iz prethodnog paketa podržava ručni unos nakon gubitka veze u već učitanoj aplikaciji; nije potvrđeno offline otvaranje zatvorene web aplikacije.
- Tvoje nove .tsx komponente nastale preimenovanjem nisu dostavljene. Njihovi tipovi, importi i funkcionalnosti nisu provjereni.

## Provjera ovog dodatka

- Isprobana primjena i ponovljena primjena bez dupliciranja CSS importa.
- Provjereno uklanjanje ciljanog polja datuma bez uklanjanja ostalih polja.
- Provjereno premještanje .jsx.backup s TSX parom i zadržavanje datoteke bez para.
- TypeScript provjera i Vite produkcijski build prolaze na dostupnoj testnoj kopiji weba.
- Nije provedena vizualna provjera u stvarnom pregledniku: u ovom okruženju nedostaje Chromium. Nije provjeren tvoj lokalni repozitorij niti produkcijski API.
