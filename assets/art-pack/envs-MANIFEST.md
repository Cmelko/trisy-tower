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
| `forest` | Les | `bg-forest.webp` 540×960 | 41.3 | `plat-forest.png` 512×128 | 63.1 |
| `ice` | Ľadové hory | `bg-ice.webp` 540×960 | 45.9 | `plat-ice.png` 512×128 | 59.3 |
| `hell` | Peklo | `bg-hell.webp` 540×960 | 25.6 | `plat-hell.png` 512×128 | 59.5 |
| `space` | Vesmír | `bg-space.webp` 540×960 | 42.1 | `plat-space.png` 512×128 | 50.3 |
| `desert` | Púšť | `bg-desert.webp` 540×960 | 26.0 | `plat-desert.png` 512×128 | 49.1 |
| `ocean` | Oceán | `bg-ocean.webp` 540×960 | 56.3 | `plat-ocean.png` 512×128 | 65.6 |
| `cave` | Jaskyňa | `bg-cave.webp` 540×960 | 33.0 | `plat-cave.png` 512×128 | 55.0 |
| `clouds` | Oblaky | `bg-clouds.webp` 540×960 | 23.7 | `plat-clouds.png` 512×128 | 27.4 |
| `swamp` | Bažina | `bg-swamp.webp` 540×960 | 27.4 | `plat-swamp.png` 512×128 | 69.3 |
| `city` | Nočné mesto | `bg-city.webp` 540×960 | 27.4 | `plat-city.png` 512×128 | 34.9 |
| `candy` | Cukríkovo | `bg-candy.webp` 540×960 | 35.8 | `plat-candy.png` 512×128 | 53.2 |
| `rainbow` | Dúhová veža | `bg-rainbow.webp` 540×960 | 46.1 | `plat-rainbow.png` 512×128 | 29.2 |
| `crystal` | Kryštály | `bg-crystal.webp` 540×960 | 33.2 | `plat-crystal.png` 512×128 | 51.3 |
| `gold` | Zlatý vrch | `bg-gold.webp` 540×960 | 35.4 | `plat-gold.png` 512×128 | 48.4 |

**Celková váha sady (14 bg + 14 plat + preview): ~1425 KB**

## Poznámky k témam plošín
- `forest`: tráva + hlina (tráva **iba tu**)
- `ice`: sneh + modrý ľad + cencúle, bez trávy
- `hell`: čierny kameň + tečúca láva
- `space`: kov/asteroid + svietiace kryštály
- `desert`: pieskovec + piesok navrchu
- `ocean`: koral/mokrý kameň + riasy + perly
- `cave`: skala + svietiace huby/mach (bez trávnika)
- `clouds`: nadýchaná oblačná doska
- `swamp`: blato + mach + lekno/trsť
- `city`: betón + neónový pásik
- `candy`: ružová poleva / cukrová torta
- `rainbow`: sklenená dúhová doska
- `crystal`: tyrkysový kryštalický blok
- `gold`: zlaté tehly + trblietky

## Preview
- `preview-contact-sheet.jpg` — 7×2 mriežka, na každom pozadí plošiny ≈140 a ≈90 px.

## Kvalita / slabšie miesta
- `crystal` pozadie: teal kryštály OK, model občas pridá snežné stromčeky (vizuálne blízke `ice`); pri ďalšom kole by sa hodil čistejší gem-mine bez stromov.
- `rainbow` vs `crystal`: dúha je fialovo-ružová so sklenenými stĺpmi; crystal je tyrkysový — rozlíšiteľné, ale nie 100 % „sklenené dúhové pásy“.
- Plošiny `swamp`/`ocean`/`forest` mierne nad ideálom 60 KB (63–69 KB) kvôli detailu + alfe.
- Pri 9-slice naťahovaní zrkadlovým dlaždicovaním môžu byť na širokých plošinách viditeľné jemné švy (najmä hell/candy) — riešenie pri integrácii: menší tile strip alebo soft blend.