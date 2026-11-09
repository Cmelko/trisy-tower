# Trisy Tower – sprite sheet plyšového jednorožca

Pripravil: Animátor Pohyblivo  
Cieľ: nové animácie ružového plyšového jednorožca pre 2D canvas hru.  
**Integráciu do appky robí Fyzikár Tomáš** (súbory len v `/workspace/trisy-art-pack/char/`, nič sa nezapisovalo do repozitára).

## Vzor postavy
- `/workspace/trisy-art-pack/ref/character-sheet.jpg`
- `/workspace/trisy-art-pack/ref/cover-3d.jpg`

Ružová huňatá plyšová postava, zlatý špirálový roh, ružová hriva a chvost, krémový ňufák, veľké oči, fialovo-hnedé kopytká/dlane. Pohľad 3/4 doprava.

## Súbory

| Súbor | Rozmery | Váha |
|---|---|---|
| `unicorn-idle.png` | 512×128 | 50.1 KB |
| `unicorn-walk.png` | 768×128 | 47.5 KB |
| `unicorn-run.png` | 768×128 | 42.4 KB |
| `unicorn-jump_up.png` | 384×128 | 34.2 KB |
| `unicorn-fall.png` | 384×128 | 40.6 KB |
| `unicorn-land.png` | 384×128 | 35.3 KB |
| `unicorn-win.png` | 768×128 | 46.6 KB |
| `unicorn-run_jump.png` | 384×128 | 36.0 KB |
| `unicorn-spritesheet.png` | 768×1024 | 325.5 KB |
| `unicorn-spritesheet-small.png` | 576×768 | 220.8 KB |
| `unicorn-spritesheet.json` | — | 1.3 KB |
| `unicorn-contact-sheet.png` | 768×1024 | 323.8 KB |
| `unicorn-preview-idle.gif` | 128×128 | 14.6 KB |
| `unicorn-preview-run.gif` | 128×128 | 14.0 KB |
| `unicorn-preview-jump_fall.gif` | 128×128 | 21.0 KB |
| `unicorn-preview-win.gif` | 128×128 | 14.8 KB |

Hlavný sheet: **768×1024** (6 stĺpcov × 8 riadkov, bunky **128×128**).  
Small sheet: **576×768** (bunky **96×96**) – vhodnejší na mobil, ak treba menšiu váhu.

## Animácie

| Riadok | Názov | Snímky | FPS | Loop | Popis |
|---|---|---|---|---|---|
| 0 | `idle` | 4 | 6 | áno | jemné dýchanie + mihnutie |
| 1 | `walk` | 6 | 10 | áno | chôdza |
| 2 | `run` | 6 | 14 | áno | beh tu-tu-tu, predklon |
| 3 | `jump_up` | 3 | 8 | nie | odraz + stúpanie, ruky hore |
| 4 | `fall` | 3 | 8 | áno | pád, rozhodené končatiny, 3. snímka kotrmelec |
| 5 | `land` | 3 | 12 | nie | drep a vyrovnanie |
| 6 | `win` | 6 | 10 | áno | víťazstvo, ruky hore, poskok |
| 7 | `run_jump` | 3 | 8 | nie | rozbehový skok |

JSON popis: `unicorn-spritesheet.json` (`name`, `row`, `frames`, `fps`, `loop`, `cell:128` + celkové rozmery).

## Základná línia a stred
- Bunka: **128×128** px
- Základná línia nôh: približne **y = 120** (spodok bunky)
- Horizontálny stred: **x = 64** (kotva `anchor: {x:0.5, y:0.9375}`)
- Pre `jump_up`, `fall`, `run_jump` je v rámci bunky zachovaný relatívny zdvih (vyššie dno snímky = vyššie vo vzduchu)

## Štýl – upozornenie
Hra Trisy Tower má dnes **pixel-art** štýl. Tento balík je **plyšový 3D / soft CGI** vzhľad podľa cover a character-sheet referencií. Pri integrácii zváž:
- či nechať ako prémiový „gold/plush“ skin,
- alebo neskôr dorobiť pixel-art variantu,
- PNG sheet je **~325 KB** (pod 400 KB); small verzia **~221 KB**.

## Kvalita / slabiny (čestne)
- **Silné:** idle (dýchanie+blink), walk, win, celková identita postavy (farby, roh, plyš), čistý chroma key bez zeleného lemu, zarovnanie nôh na baseline.
- **Dobré:** run (predklon a kroky čitateľné, mierne drobné rozdiely v hrúbke nôh/ňufáka medzi snímkami), jump_up (odraz → stúpanie → ruky hore), land (drep → stoj), run_jump (odraz + natiahnutie).
- **Slabšie:**
  - `fall`: 1. a 2. snímka sú si podobné; 3. je výrazný kotrmelec (hranatejší skok medzi pózami).
  - `run`: nie úplne dokonalý closed loop (jemné trhnutie pri opakovaní).
  - Generované snímky majú drobné AI rozdiely (tvar ňufáka, hustota hrivy) – nie je to ručne kreslený pixel-perfect sheet.
  - Idle dýchanie je jemné (najmä blink v 3. snímke je najviditeľnejší).
- Preview GIF-y majú ružové pozadie; `unicorn-contact-sheet.png` je na šachovnici na kontrolu priehľadnosti.

## Raw (pracovné)
Zelené generované stripy sú v `char/raw/` (JPG) – môžu ostať ako zdroj, do hry netreba.

## Ďalší krok
Odovzdané Bobovi / Tomášovi na integráciu do `game.js` (načítanie sheetu + prepínanie riadkov podľa stavu: idle/walk/run/jump/fall/land/win).
