Web dizajn uređuje se u client/App.tsx i client/src/. Zajedničke boje i komponente unutar weba su u client/src/ui.tsx. Mapa src/ neposredno ispod apps/web sadrži raniji Vite prikaz i nije ulaz u aktivnu aplikaciju.

Iz korijena repozitorija:
- npm run dev -w @splitit/web — web na portu 5173
- npm run build -w @splitit/web — produkcijski rezultat u apps/web/dist
- npm run dev — API i web zajedno

Nakon uobičajene instalacije korijenskih ovisnosti, web skripta instalira ovisnosti u client pri prvom pokretanju i pri produkcijskom buildu. Postavke ostaju u apps/web/.env ili u okruženju hostinga (VITE_API_URL, VITE_WEB_URL, VITE_GOOGLE_CLIENT_ID). Za produkcijski build VITE_API_URL mora biti postavljen.

Mobilna aplikacija ostaje u splitit-mobile/mobile. Izmjene zaslona i prijevoda više se ne prenose automatski između platformi; ako izmjena treba vrijediti na obje, primijeni je u obje mape. Aplikacije mogu nastaviti koristiti isti API.
