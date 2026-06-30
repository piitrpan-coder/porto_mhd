# CLAUDE.md — Průvodce pobytem v cizím městě

## Co to je
PWA společník pro pár dní v cizím městě. Pomáhá se rychle zorientovat: **kde si dát
kafe, kde se najíst, kde nakoupit, co je kolem za podívanou**, jak se po městě pohybovat
a **jaké digitální nástroje a služby** člověku pobyt usnadní. Městská doprava je jedna
z vrstev, ne hlavní účel.

Zatím pokrývá **Porto** a **Lagos / Algarve**, koncept ale počítá s přidáváním dalších
měst. UI je v **češtině**, cílové zařízení **iPhone, Safari, nainstalováno jako PWA**
(standalone, tmavé téma).

## Pro koho a k čemu (priorita)
Uživatel je krátce v neznámém městě a chce rychlou, důvěryhodnou odpověď na „kde a co
teď". Na čem to stojí:

1. **Objevování poblíž** — kafe, jídlo, nákupy, co dělat. Hlavní otázky: je to blízko?
   je teď otevřeno? stojí to za to?
2. **Digitální nástroje** — hub užitečných utilit a odkazů na služby dostupné ve městě
   (viz Moduly).
3. **Doprava** — Tahák, odjezdy, časovač platnosti jízdenky.
4. **Moje místa** — ubytování, uložené body zájmu, oblíbené.

Když se rozhoduješ mezi „hezčí" a „spolehlivější na ulici v cizině", vyber spolehlivější.

## Moduly
- **Objevování:** hledání míst podle kategorie (kafe / jídlo / nákupy / co dělat),
  poblíž uživatele, s filtrem „otevřeno teď" a vzdáleností. Spíš tipy než syrový seznam.
- **Digitální nástroje:** sběrné místo pro drobné utility a odkazy, co se v cizině hodí.
  Kandidáti (scope potvrdí majitel): převod měny, spropitné, počasí, místní čas, nouzová
  čísla, offline mapa, užitečné fráze / překladač, doporučené místní appky (taxi, rozvoz),
  Wallet s e-jízdenkami. _Tahle kategorie je zatím otevřená — než něco přidáš, ověř, co
  z toho majitel opravdu chce a co má být vestavěné vs. jen odkaz ven._
- **Doprava:** to, co už appka umí kolem MHD (Tahák, řády, časovač jízdenky).
- **Moje místa:** ubytování a vlastní body, lokálně uložené.

## Data
Data o místech i dopravě se **tahají z API / ze sítě**. Pravidlo pro každé volání:

- vždy ošetři **načítání**, **chybu / výpadek** a **prázdnou odpověď** — appka nesmí
  jen zaseknout spinner ani spadnout;
- poslední úspěšnou odpověď **ulož do cache** a při výpadku ji ukaž s razítkem
  *„naposledy aktualizováno HH:MM"*;
- u objevování hlídej **polohu uživatele** (svolení, fallback když ji nemáš) a to, že
  **„otevřeno teď" se počítá v místním čase města**, ne podle telefonu;
- počítej s pomalou a nestabilní sítí v zahraničí: rozumné timeouty, omezený retry.

## Offline
Offline je **bonus, ne offline-first**. App shell a poslední načtená data drž v cache
(service worker), ať Tahák, poslední tipy a uložená místa něco ukážou i bez signálu.
Nestav plnou offline synchronizaci, dokud to není výslovně v zadání.

## Lokální stav (nezávislý na síti)
Časovač jízdenky, uložená místa a oblíbené žijí v `localStorage` a musí přežít zavření
i znovuotevření appky. Odpočet jízdenky se dopočítává z uloženého času aktivace.

## Stack a struktura
- **Žádný framework, žádný build step** — čisté HTML/CSS/JS, přímo v prohlížeči.
- **Tailwind CSS v4** přes CDN (`@tailwindcss/browser@4`), ne npm.
- Soubory:
  - `index.html` — výběr města (rozcestník)
  - `porto.html` — hlavní stránka pro Porto (MHD, Objevování, Počasí, Kurz, Moje místa)
  - `lagos.html` — hlavní stránka pro Lagos / Algarve
  - `hub.html` — **opuštěná vývojová větev**, soubor zůstává, ale nerozvíjet ani nemazat
  - `sw.js` — service worker, cache-first pro app shell
  - `manifest.json` — PWA manifest
- **Stav** žije výhradně v `localStorage` (jízdenky, uložená místa).
- **Routing** neexistuje — každé město je samostatná HTML stránka.
- **Deploy** — `deploy.sh` commituje a pushuje na `main`; GitHub Pages.

## Externě volané API
| Služba | Účel | Endpoint |
|---|---|---|
| **Overpass API** | Hledání míst poblíž (Objevování) | `overpass-api.de/api/interpreter` |
| **Open-Meteo** | Počasí (porto: lat 41.15, lon −8.61) | `api.open-meteo.com/v1/forecast` |
| **open.er-api.com** | Kurz EUR/CZK | `open.er-api.com/v6/latest/EUR` |
| **Nominatim** | Vyhledávání adres / geocoding | `nominatim.openstreetmap.org/search` |
| **STCP** | Live odjezdy MHD Porto | `stcp.pt/api/stops/{id}/realtime` přes CORS proxy |
| **Google Maps** | Navigační linky (ne API key) | URL schéma `maps/dir/?api=1&…` |

Všechna volání na síť musí procházet přes sdílenou API vrstvu (viz níže).

## API vrstva (sdílená)
Jedna funkce / wrapper pro všechna síťová volání. Stavy řeší wrapper, ne každý modul zvlášť.

**Chování:**
- **Načítání:** skeleton nebo indikátor — ne prázdná obrazovka.
- **Úspěch:** vrať data, ulož do `localStorage` pod klíčem dotazu spolu s časem uložení.
- **Chyba / timeout:** zkus 1× zopakovat; když to nevyjde, vrať poslední cachovaná data
  s razítkem *„naposledy aktualizováno HH:MM"* (čas se počítá z uloženého timestampu,
  ne z aktuálního času) a nenápadnou cedulkou „offline / stará data".
- **Prázdná odpověď:** odliš od chyby — „nic nenalezeno", ne error.

**Hotovo, když:**
- modul zavolá jednu funkci a stavy řeší wrapper, ne každá obrazovka zvlášť;
- po vypnutí sítě appka místo pádu ukáže poslední data + razítko;
- razítko vychází z času uložení, ne z aktuálního času.

**Mimo rozsah:** plná offline synchronizace, service-worker caching (řeší se zvlášť).

## Modul: Objevování
Poblíž uživatele najde místa v kategoriích kafe / jídlo / nákupy / co dělat.

**Chování:**
- **Bez svolení k poloze:** vyžádej ji; při odmítnutí fallback na střed města / ubytování
  a informuj uživatele, podle čeho hledáš.
- **Výsledky:** seznam seřazený podle vzdálenosti; u každého místa: kategorie, vzdálenost,
  hodnocení a „otevřeno teď" ano/ne.
- **„Otevřeno teď":** počítej z otevírací doby v **místním čase města** (ne podle hodin
  telefonu — uživatel může být v jiném časovém pásmu).
- **Načítání / chyba / prázdno:** řeší sdílená API vrstva (viz výše).
- **Přepínání kategorií:** bez znovunačtení celé obrazovky, pokud to jde.
- Data přichází z **Overpass API** (OpenStreetMap).

**Hotovo, když:**
- výsledky jsou reálně poblíž a seřazené podle vzdálenosti;
- „otevřeno teď" sedí i když je telefon v jiném časovém pásmu než město;
- bez signálu se ukážou naposledy načtená místa s razítkem.

**Mimo rozsah:** rezervace, psaní recenzí.

## Konvence
- **Ikony:** existující emoji v kódu zůstávají; nové prvky přidávej s SVG — cílem je
  postupná migrace k jednotné SVG sadě (zatím neurčena).
- Texty v UI česky, bez anglických zbytků.

## Mimo rozsah (dokud to nepadne v zadání)
Žádné účty / login, žádný vlastní backend (data z třetích stran), žádné placené služby
bez domluvy, žádné nové obrazovky „protože by to šlo".

## Jak pracovat na úkolu
1. Nejdřív **prozkoumej** relevantní soubory a napiš, cos pochopil.
2. **Navrhni plán celé změny najednou** — ne po krůčcích s doptáváním. Až pak implementuj.
3. Po implementaci **spusť / ověř** proti „hotovo, když…".
4. Drž se v rozsahu úkolu.
