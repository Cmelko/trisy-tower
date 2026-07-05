# Nastavenie globálneho rebríčka (scores.txt)

Hra načítava skóre z `scores.txt` v repozitári pri každom spustení.
Uloženie funguje cez GitHub Actions workflow `save-score.yml`.

## Rýchle nastavenie (odporúčané) — Cloudflare Worker

1. Vytvor **Fine-grained GitHub token**:
   - GitHub → Settings → Developer settings → Fine-grained tokens
   - Repo: `trisy-tower`
   - Oprávnenia: **Actions (Read and write)**, **Contents (Read and write)**

2. Nainštaluj Wrangler a nasaď worker:
   ```powershell
   cd worker
   npm install -g wrangler
   wrangler login
   wrangler secret put GITHUB_TOKEN
   wrangler deploy
   ```

3. Skopíruj URL workera (napr. `https://trisy-tower-save.tvojucet.workers.dev`)

4. V GitHub repozitári nastav **Variable**:
   - Settings → Secrets and variables → Actions → Variables
   - Názov: `TRISY_SAVE_URL`
   - Hodnota: URL workera

5. Pushni akýkoľvek commit (okrem samotného `scores.txt`) — workflow **Deploy Pages** vloží URL do `config.js`.

## Alternatíva — token priamo v hre

V Secrets pridaj `LEADERBOARD_TOKEN` (rovnaký GitHub token).
Deploy workflow ho vloží do `config.js`.
Menej bezpečné (token je viditeľný v prehliadači), ale jednoduchšie.

## Formát scores.txt

```
# score	name	height	combo	floor	date
2500	Pato	480	22	2	2026-07-05
```

- **floor** = index prostredia (0 Les, 1 Ľad, 2 Peklo, …)
- Pre každé meno sa drží **najlepšie skóre**
- Pri spustení hry sa vždy načíta aktuálny súbor z GitHubu

## Budúce skiny Popa

Modul `progress.js` ukladá lokálne:
- najvyššie dosiahnuté poschodie
- odomknuté skiny (Ľad od poschodia 2, Peklo od 3, …)

Keď dorobíme grafiku skinov, stačí ich prepojiť s `TrisyProgress.getProgress(meno)`.
