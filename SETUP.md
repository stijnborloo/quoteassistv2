# 🚀 Easy Quotation v2 Interactive — Setup Gids

## Wat Heb Je Gekregen?

Een **volledige interactieve offertemaker** met:
- ✅ Live drag-drop editing
- ✅ Double-click tekst bewerken
- ✅ Mobiel support (touch)
- ✅ Data sync (wijzigingen direct opgeslagen)
- ✅ Split-screen UX (tabs links, preview rechts)
- ✅ PWA installeerbaar
- ✅ Claude AI integration via Cloudflare Worker

---

## 📦 Bestanden in Deze Repo

```
index.html                    (5000+ regels, volledig interactief)
manifest.json                 (PWA config)
sw.js                         (Service Worker, offline)
icon192.png, icon512.png      (App icons)
appletouchicon.png            (iPhone icon)
README.md                     (Volledige documentatie)
```

---

## ⚡ Stap 1: GitHub Repo Setup (5 minuten)

### 1.1 Maak een nieuwe repository aan

Op github.com:
- **Naam:** `easy-quotation-v2` (of `ricoh-offerte-interactive`)
- **Visibility:** Public (zodat je deze kan deployen)
- **Initialize with README:** Nee (we hebben al files)

### 1.2 Upload de bestanden

Clone je repo:
```bash
git clone https://github.com/jouwaccount/easy-quotation-v2.git
cd easy-quotation-v2
```

Copy alle bestanden van Downloads hierheen:
```bash
cp ~/Downloads/index.html .
cp ~/Downloads/manifest.json .
cp ~/Downloads/sw.js .
cp ~/Downloads/icon192.png .
cp ~/Downloads/icon512.png .
cp ~/Downloads/appletouchicon.png .
cp ~/Downloads/README.md .
```

Commit en push:
```bash
git add .
git commit -m "Initial interactive version"
git push origin main
```

### 1.3 Zet GitHub Pages aan

1. Ga naar repo → **Settings**
2. Klik op **Pages** (links)
3. **Source:** Deploy from branch → `main` → Save
4. GitHub geeft je een URL: `https://jouwaccount.github.io/easy-quotation-v2`

**Klaar!** De app is live. Open de URL en test.

---

## 🎮 Stap 2: First Test (2 minuten)

Open je app-URL in browser:

```
https://jouwaccount.github.io/easy-quotation-v2
```

Je ziet:
- Links: Tabs (Klant, Zalen, Foto's, Blokken, etc.)
- Rechts: **Interactieve live preview**

**Test nu:**

1. ✨ Sleep een blok naar beneden → beweegt live
2. 📷 Sleep een foto van bibliotheek → verschijnt in blok
3. ✏️ Double-click op een titel → edit de tekst
4. 📱 Op mobiel: sleep met je vinger

---

## 🔧 Stap 3: Configuratie (1 minuut)

De app is **al geconfigureerd** voor:
- ✅ Cloudflare Worker op `quoteassist.stijn-borloo.workers.dev`
- ✅ Interactieve mode aan (`INTERACTIVE_MODE = true`)
- ✅ Easy Quotation styling & layout

**Enige optie:** Wil je PDF-export? Dan zet je in `index.html`:

```javascript
// Regel ~1484
var INTERACTIVE_MODE = false;  // true = interactive, false = PDF
```

---

## 📋 Stap 4: Delen Met Collega's

Geef ze deze URL:
```
https://jouwaccount.github.io/easy-quotation-v2
```

Ze kunnen:
- ✅ Offerte aanmaken
- ✅ Slepen & editten
- ✅ Foto's toevoegen
- ✅ PDF exporteren
- ✅ App installeren (PWA)

**Offline werken:** Service Worker zorgt dat ze offline kunnen werken (draft offertes).

---

## 🔄 Stap 5: Updates & Aanpassingen

### Aanpassingen maken?

1. Edit `index.html` lokaal
2. Test in browser
3. Commit & push:
   ```bash
   git add index.html
   git commit -m "Fix drag-drop timing"
   git push origin main
   ```
4. GitHub Pages updated automatisch (1-2 minuten)

### Opties om aan te passen:

| Wat | Waar | Hoe |
|-----|------|-----|
| Kleur | CSS | Zoek `--accent`, `--gr`, etc. |
| Taal | UI dict | Zoek `"Klantgegevens"` in UI-dict |
| Blok types | JS | Zoek `createInteractiveBlock()` |
| PDF layout | JS | Zoek `renderInteractive()` |

---

## 📱 Mobile Deployment (Optional)

### iOS

1. Open app in Safari
2. **Share** → **Add to Home Screen**
3. Geeft notificatie dat het ingestalleerd is
4. Tap Home Screen icon → App opent fullscreen

### Android

1. Open app in Chrome
2. Menu (⋮) → **Install app**
3. App installed
4. Tap launcher icon → App opent fullscreen

**Offline:** Met service worker kunnen collega's werken zonder internet.

---

## 🚨 Troubleshooting

### Drag-drop werkt niet

- [ ] JavaScript errors in console? (F12)
- [ ] Probeer in Chrome i.p.v. Safari
- [ ] Hard refresh: Ctrl+Shift+R (Windows) of Cmd+Shift+R (Mac)

### Wijzigingen gaan verloren

- [ ] localStorage ingeschakeld? (Settings → Privacy)
- [ ] Private browsing uit?
- [ ] Cookies niet gedeleted?

### App laadt langzaam

- [ ] Veel grote foto's? Comprimeer ze
- [ ] Veel blokken (500+)? Verdeel in meerdere offertes
- [ ] Check netwerk in DevTools (F12)

### PDF ziet er raar uit

- Dat is normaal voor interactive mode
- Voor PDF export: zet `INTERACTIVE_MODE = false`

---

## 🔐 Security Notes

- 🔒 API-sleutel **verborgen** via Cloudflare Worker
- 🔒 Data opgeslagen **lokaal** in browser (localStorage)
- 🔒 Geen cloud-sync (offline-first)

---

## 📚 Verdere Documentatie

Open `README.md` in de repo voor:
- Volledige feature list
- Keyboard shortcuts
- Architectuur-details
- Integration gids
- Troubleshooting

---

## ✅ Checklist: Alles Klaar?

- [ ] GitHub repo aangemaakt
- [ ] Bestanden geupload & gepushed
- [ ] GitHub Pages ingeschakeld
- [ ] App opent zonder errors
- [ ] Drag-drop werkt
- [ ] Inline editing werkt (double-click)
- [ ] Foto's kunnen gesleept worden
- [ ] Collega's krijgen de URL

---

## 🎉 Klaar!

De interactive versie van Easy Quotation is live en klaar voor gebruik.

**Geniet van de verbeterde UX!** 🚀

---

*Vragen? Raadpleeg README.md of open DevTools (F12) voor errors.*
