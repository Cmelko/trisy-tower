# Trisy Tower — art pack (envs)

Sada pozadí a plošín pre 14 prostredí. **Neintegrované do repa** — integráciu robí Tomáš/Bob.

## Canvas / použitie

- Herný canvas: **480×720** (2:3).
- Pozadie: kresliť `cover`, **zarovnanie ku spodku**. Asset je 9:16 (540×960) → horných ~16 % sa orezá; dôležité detaily sú v spodných ~80 %.
- Steny po bokoch kreslí hra (~20 px z 480). Stred pozadia je voľný (bez plošín/postáv/UI).
- Plošina: kresliť cca **24–40 px vysokú** (zachovať pomer 512×128). Šírky v hre ~56–420 px na canvase.

## 9-slice plošiny

- Ľavá čiapka: **56 px**
- Pravá čiapka: **56 px**
- Stredný pás: **400 px** (pri naťahovaní dlaždicovať/zrkadlovo opakovať stredný pás).

## Tabuľka

| deco | prostredie | pozadie | KB | plošina | KB |
|---|---|---|---:|---|---:|
| `forest` | Les | `bg-forest.webp` 540×960 | 39.6 | `plat-forest.png` 512×128 | 63.1 |
| `ice` | Ľadové hory | `bg-ice.webp` 540×960 | 43.8 | `plat-ice.png` 512×128 | 59.3 |
| `hell` | Peklo | `bg-hell.webp` 540×960 | 24.0 | `plat-hell.png` 512×128 | 58.8 |
| `space` | Vesmír | `bg-space.webp` 540×960 | 38.9 | `plat-space.png` 512×128 | 50.3 |
| `desert` | Púšť | `bg-desert.webp` 540×960 | 24.3 | `plat-desert.png` 512×128 | 49.1 |
| `ocean` | Oceán | `bg-ocean.webp` 540×960 | 53.8 | `plat-ocean.png` 512×128 | 65.6 |
| `cave` | Jaskyňa | `bg-cave.webp` 540×960 | 30.1 | `plat-cave.png` 512×128 | 55.0 |
| `clouds` | Oblaky | `bg-clouds.webp` 540×960 | 22.3 | `plat-clouds.png` 512×128 | 47.2 |
| `swamp` | Bažina | `bg-swamp.webp` 540×960 | 25.0 | `plat-swamp.png` 512×128 | 69.3 |
| `city` | Nočné mesto | `bg-city.webp` 540×960 | 25.9 | `plat-city.png` 512×128 | 34.9 |
| `candy` | Cukríkovo | `bg-candy.webp` 540×960 | 33.2 | `plat-candy.png` 512×128 | 53.8 |
| `rainbow` | Dúhová veža | `bg-rainbow.webp` 540×960 | 12.4 | `plat-rainbow.png` 512×128 | 28.8 |
| `crystal` | Kryštály | `bg-crystal.webp` 540×960 | 37.7 | `plat-crystal.png` 512×128 | 51.3 |
| `gold` | Zlatý vrch | `bg-gold.webp` 540×960 | 31.9 | `plat-gold.png` 512×128 | 48.5 |

**Celková váha sady (14 bg + 14 plat + preview): ~1438 KB**

## Preview

- `preview-contact-sheet.jpg` — 7×2 mriežka, na každom pozadí plošiny ≈140 a ≈90 px.

## v2 zmeny (2026-11-09)

Záloha v1: `/workspace/trisy-art-pack/envs-v1-backup/`

### Zmenené súbory
| súbor | rozmery | KB | zmena |
|---|---|---:|---|
| `bg-crystal.webp` | 540×960 | 37.7 | čistá kryštálová baňa bez stromčekov + vinetácia |
| `bg-rainbow.webp` | 540×960 | 12.4 | čisté ploché dúhové pásy + vinetácia |
| `plat-clouds.png` | 512×128 | 47.2 | tmavomodrý obrys (aj vrch), blue-gray deck |
| `plat-hell.png` | 512×128 | 58.8 | soft-blend cap|mid + mirror edge |
| `plat-candy.png` | 512×128 | 53.8 | soft-blend cap|mid + mirror edge |
| `plat-rainbow.png` | 512×128 | 28.8 | nový asset + soft-join |
| `plat-gold.png` | 512×128 | 48.5 | soft-blend cap|mid |
| `bg-*.webp` (všetkých 14) | 540×960 | — | jemná bočná vinetácia ~4 % šírky k pixel stenám |
| `preview-contact-sheet.jpg` | — | 260.2 | aktualizovaný náhľad |

### Čo ostalo slabšie
- `plat-hell` / `plat-candy`: pri širokom 9-slice stále môžu byť jemné spoje na cap|mid (zjemnené, nie 100 % neviditeľné).
- `plat-rainbow`: horizontálny gradient + 9-slice = pri spojoch citlivý na farebný skok.
- `bg-rainbow`: ploché pásy OK; nie je maľovaný v rovnakom brush štýle ako ostatné AI bg (procedurálne).
- `plat-clouds`: kontrast výrazne lepší; na veľmi bielom pozadí stále overiť v hre.

Záloha v1: `/workspace/trisy-art-pack/envs-v1-backup/`
