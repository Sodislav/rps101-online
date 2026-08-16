# RPS-101 Online

Online duel pro dva hráče podle původního 101-gesture RPS systému Davida C. Lovelace.

## Co umí

- soukromé místnosti přes 6znakový room code
- přesně 2 hráči
- 101 voleb
- volba soupeře se neodesílá druhému klientovi, dokud nejsou oba hráči locked
- server je autorita: znovu ověřuje každou volbu
- nesmyslný vstup hru nikdy neshodí
- překlepy typu `dragdkon` nabídnou `Dragon`
- `video-game`, `VIDEO GAME` atd. se bezpečně normalizují
- kompletní seznam 101 možností lze zobrazit a filtrovat
- klikací volby i ruční psaní
- random volba
- skóre a historie kol
- automatické uzavření místnosti při odpojení jednoho hráče
- jednoduché rate limiting kontroly proti event spamu

## Spuštění na vlastním PC

Potřebuješ Node.js 22–24.

```bash
npm install
npm test
npm start
```

Pak otevři:

```text
http://localhost:3000
```

## Jak hrát s kamarádem přes internet

Nejjednodušší je nasadit celý tento adresář jako jeden Node.js Web Service na hostingu, který podporuje WebSockety (např. Render).

Obecný postup:

1. Nahraj obsah projektu do GitHub repozitáře.
2. Na hostingu vytvoř nový Node/Express Web Service z tohoto repozitáře.
3. Build command: `npm install`
4. Start command: `npm start`
5. Otevři veřejnou HTTPS adresu služby.
6. Ty klikneš **Vytvořit místnost**.
7. Pošleš kamarádovi URL a 6znakový kód.
8. Kamarád zadá jméno + kód a klikne **Připojit se**.

Server čte port z `process.env.PORT`, takže je připravený pro běžné PaaS hostingy.

### Poznámka k free hostingu

Pokud free služba po neaktivitě usíná, první otevření může chvíli čekat na probuzení. Hra nepotřebuje databázi; místnosti a skóre jsou pouze v RAM. Po restartu serveru se tedy aktivní místnosti ztratí, což je pro krátkou duelovou minihru záměrně jednoduché řešení.

## Pravidla

Pole `GESTURES` v `lib/rules.js` obsahuje kanonické kruhové pořadí 101 gest. Každé gesto poráží následujících 50 gest a prohrává s předchozími 50. Díky tomu není nutné hardcodovat 5 050 dvojic.

Projekt záměrně nekopíruje původní slovní popisy všech 5 050 výsledků. Výsledek zobrazuje obecně jako např. `Dragon beats Diamond.`

## Bezpečnost a validace

Validace je dvouvrstvá:

1. klient odmítne neznámý text a nabídne blízkou platnou možnost,
2. server provede stejnou kontrolu znovu a neplatný tah nikdy neuloží.

Takže ani uživatel, který obejde UI a ručně odešle třeba `hasufhiaofhaiosf`, nerozbije stav hry.

Soupeřův konkrétní tah se během lock-in fáze neposílá druhému klientovi. Klient dostane pouze boolean `locked`. Až má server obě platné volby, odešle výsledek oběma současně.

## Struktura

```text
rps101-online/
├─ server.js
├─ package.json
├─ test-rules.js
├─ lib/
│  └─ rules.js
└─ public/
   ├─ index.html
   ├─ app.js
   └─ styles.css
```
