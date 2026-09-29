# SplitIt — kompaktni računi, sudionici i vlastite stavke

## Važno: ova verzija uključuje API i migraciju baze

Nemoj zamijeniti samo mobilne datoteke. U ovoj verziji prava autora provjerava server. Redoslijed je **migracija baze → novi API → web → mobilni build**. Ne pokreći `prisma migrate reset` i ne mijenjaj postojeći DATABASE_URL.

Zadrži vlastite `mobile/app.json`, `mobile/eas.json`, sve `.env` datoteke, Expo project ID, owner, Android package i signing key. Predložak app.json u ZIP-u nema tvoj stvarni project ID. Ne pokreći ponovno EAS init ako je projekt povezan.

## Datoteke za prijenos iz ovog ZIP-a

Ako koristiš prethodnu nadogradnju:

| Dio projekta | Prenesi |
| --- | --- |
| Mobilna aplikacija | Sadržaj `mobile/src/`, uključujući novi `ItemCheck.tsx` |
| API | Sadržaj `apps/api/src/` |
| Prisma | `apps/api/prisma/schema.prisma` i novu mapu `apps/api/prisma/migrations/202609240001_bill_ownership/` |
| Web | `apps/web/src/api.ts`, `apps/web/src/types.ts`, `apps/web/src/pages/GroupPage.tsx` |

Ostale postojeće migracije ostaju. Nema novih npm ovisnosti. Prije zamjene spremi kopiju lokalnih izmjena i baze. ZIP sadrži cijeli projekt, ali gore su datoteke ove dorade.

## Migracija i objava

Na okruženju koje ima produkcijski DATABASE_URL, iz mape `apps/api`:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run build
```

Ove naredbe primijeni u svom postojećem Render postupku objave prije pokretanja nove API verzije. Migracija dodaje nullable `creatorKey` u tablice `expenses` i `expense_drafts`; ne briše račune. Stare autore koji su zabilježeni kao prijavljeni korisnici u povijesti povezuje s njihovim korisničkim ID-em.

Za lokalnu provjeru iz korijena projekta:

```powershell
npm ci
npm run db:generate
npm run build -w @splitit/api
npm run build -w @splitit/web
node --import tsx --test apps/api/src/services/bill-permissions.test.ts apps/api/src/services/expense-edit.validation.test.ts
```

Objavi novi API na postojećem Render servisu i web na postojećem Vercel projektu. Novi API dodaje `/guest-session`, vlastite kvačice na `/groups/:slug/draft-expenses/:draftId/items/:itemId/mine` i `/groups/:slug/expenses/:expenseId/items/:itemId/mine`. Rute prihvaćaju samo `{ "selected": true }` ili `false`; ne prihvaćaju cijene, platitelje ili proizvoljan popis udjela.

Za prijavljene korisnike API mora koristiti vlastiti siguran `JWT_SECRET` u Render environmentu, kao i postojeća autentifikacija; razvojni zadani ključ nije za produkciju. Ključ nikad ne ide u mobile ili web env.

CORS u `apps/api/src/app.ts` uključuje `localhost:8081`, web domenu i zaglavlja `X-SplitIt-Participant-Id` te `X-SplitIt-Guest-Token`. Ako koristiš svoju dodatnu CORS konfiguraciju, sačuvaj ostale dopuštene domene i dodaj nova zaglavlja.

## Što je promijenjeno

- Računi su kompaktni retci: datum lijevo, ikona, naslov i platitelj u sredini, vlastiti iznos posuđenog/dugovanog desno. Dodir otvara stavke i postojeće detalje.
- U izradi grupe pristup je iznad sudionika. Svaka osoba ima zasebno polje; `+ Dodaj osobu` dodaje red, a `−` ga uklanja. Imena se više ne dijele zarezima.
- `Više osoba` prikazuje svaku osobu uz polje za uplatu. Novi iznosi počinju od 0. Nule se ne spremaju kao platitelji. Potvrda zahtijeva da zbroj uplata odgovara ukupnoj cijeni u centima. U uređivanju postojećeg računa ostaju stvarne uplate.
- Svaka nova stavka početno uključuje sve osobe. Nema posebnog gumba `Svi`. Kvačice možeš pojedinačno maknuti; `Promijeni / poništi` prazni odabir te stavke, nakon čega biraš osobe.
- U draftu i otvorenom potvrđenom računu svaki sudionik označava svoje stavke. Prije toga u Sudionicima mora odabrati svoj profil. Promjene se odmah spremaju.
- Autor može uređivati cijeli račun, podjelu i platitelje, potvrditi draft te obrisati potvrđeni račun. Ostali vide podatke i vlastite kvačice; API odbija njihove zahtjeve za potpuno uređivanje, izmjenu platitelja, potvrđivanje ili brisanje.
- Promjena sudjelovanja ponovno jednako dijeli samo promijenjenu stavku. Ostale stavke i njihove eventualne posebne podjele ostaju. Server ponovno izračunava ukupne udjele i salda. Ponavljanje iste kvačice ne mijenja postojeće udjele.
- Draft može imati stavke bez sudionika, ali se tada ne može potvrditi. Potvrđena stavka mora imati barem jednog sudionika; posljednji se ne može odznačiti dok se druga osoba ne uključi.
- Istodobne promjene obrađuju se transakcijski. Pri sukobu aplikacija traži osvježavanje i ponovni odabir, umjesto tihog prepisivanja druge promjene.
- Tri okomita gumba, Draft lista, pozivnice kodom i prethodne mogućnosti ostaju.

## Autorstvo i postojeći računi

Prijavljenom autoru račun pripada preko njegova korisničkog ID-a, pa ga može uređivati i s weba i s mobitela kada je prijavljen istim računom.

Gost se prepoznaje po nasumičnom ključu spremljenom na uređaju (SecureStore na mobitelu, lokalna pohrana u web pregledniku). Autorstvo gosta vrijedi u tom klijentu; drugi preglednik ili uređaj nema isti ključ. Sačuvaj podatke aplikacije pri nadogradnji. Sam odabir istog imena sudionika ne daje pravo autora.

U načinu Bez računa profil sudionika i dalje je samostalni odabir, kao u postojećoj aplikaciji; nije provjeren identitet osobe. Kvačice se odnose na odabrani profil. Zaštita autora zasniva se na odvojenom ključu, a ne na tom imenu ili zaglavlju sudionika.

Stariji anonimni računi i draftovi nemaju pouzdano zabilježenog autora. Nismo ga poistovjetili s platiteljem niti dodijelili prvom korisniku. Ostaju vidljivi i dopuštaju vlastite kvačice, ali su potpuno uređivanje/brisanje i potvrda takvih starih draftova zaključani. Stari prijavljeni autori prenose se kada postoji prethodni vjerodostojni zapis u povijesti.

## Pokretanje mobilne aplikacije

`mobile/.env` i EAS preview environment:

```dotenv
EXPO_PUBLIC_API_URL=https://splitit-djh6.onrender.com
EXPO_PUBLIC_WEB_URL=https://split-it-web-three.vercel.app
```

Iz mape `mobile`:

```powershell
npm ci
npm run check
npm test
npx expo start --clear
```

Za novi APK, nakon objave API-ja i migracije:

```powershell
npx eas-cli@latest project:info
npx eas-cli@latest build -p android --profile preview
```

Zadrži postojeći Expo projekt i `android.buildType: "apk"` u preview profilu. Kod lokalnog upravljanja verzijama povećaj `android.versionCode` iznad zadnjeg builda. Gornji razmak ostaje vezan uz safe area uređaja.

## Provjere

TypeScript i buildovi API-ja/weba, mobilni testovi te Android JavaScript export provjereni su. Testovi API-ja pokrivaju zabranu uređivanja tuđih računa, skrivanje ključeva autora, centne izračune i očuvanje drugih sudionika pri promjeni kvačice.

Prikaz u Chromiumu s mock API-jem provjerava kompaktne račune, dodavanje osoba preko +, nulte početne uplate, zbroj više platitelja, čuvanje udjela pri uređivanju i prikaz ograničenih kontrola sudioniku. Slike su u `pregled/`.

Migracija nije izvršena na tvojoj produkcijskoj bazi. Prave PostgreSQL transakcije, dva fizička mobitela, kamera i EAS build nisu testirani ovdje. Nakon deploya provjeri jedan testni draft s autorom i drugim klijentom prije dijeljenja novog APK-a.
