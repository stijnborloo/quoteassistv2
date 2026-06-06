# Easy Quotation v2 — Interactive

Volledige interactieve offertemaker met **live drag-drop editing**, **inline tekst bewerking**, en **mobiel support**.

---

## 🚀 Snelle Start

### Prerequisites
- Cloudflare Worker draait op `quoteassist.stijn-borloo.workers.dev` (voor Claude AI)
- Browser met drag-drop support (Chrome, Firefox, Safari, Edge)

### Deploy

1. **Maak nieuwe GitHub repo aan:** `ricoh-offerte-interactive` (of `easy-quotation-v2`)
2. **Upload deze bestanden:**
   ```
   index.html                  (de app)
   manifest.json               (PWA config)
   sw.js                       (service worker)
   icon192.png                 (icon)
   icon512.png                 (icon)
   appletouchicon.png          (iPhone icon)
   ```

3. **Zet GitHub Pages aan:** Settings → Pages → Deploy from branch `main`
4. **App openen:** `https://jouwaccount.github.io/ricoh-offerte-interactive`

---

## ✨ Features

### ✅ Volledige Interactiviteit

- **Drag-drop blokken** — sleep offerte-onderdelen om ze te herschikken
- **Drag-drop items** — verplaats producten tussen zalen
- **Double-click editing** — klik twee keer op tekst om te bewerken
- **Foto's toevoegen** — sleep foto's van bibliotheek naar blokken
- **Live sync** — wijzigingen worden direct opgeslagen

### ✅ Split-Screen UX

- **Links:** Tabs voor klantinfo, zalen, blokken, bibliotheek
- **Rechts:** Live preview met volledige interactiviteit
- **Desktop & mobiel:** Werkt op alle schermgroottes

### ✅ Inline Editing

```
Double-click op:
  • Bloktitels → edit
  • Tekstvakken → edit
  • Productnamen → edit
  • Prijzen → edit
```

### ✅ AI-Powered Assist

- `✦ Claude` knop → AI helpt met tekst
- Cloudflare Worker verbergt API-key
- Werkt offline (Claude optioneel)

### ✅ PWA (installeerbaar)

- Werkt als app op desktop/telefoon
- Offline betaling (met service worker)
- Vollscherm modus

---

## 🎮 Gebruikshandleiding

### Voor Collega's

```
1. Open app → Klant instellen
2. Zaal toevoegen → Producten toevoegen
3. Foto's slepen naar blokken
4. Blokken herschikken via drag
5. Tekst aanpassen (double-click)
6. PDF genereren → Download
```

### Keyboard Shortcuts

| Toets | Actie |
|-------|-------|
| `Dbl-click` | Tekst bewerken |
| `Drag` | Blok/item verplaatsen |
| `Ctrl+Z` | Undo (browser) |
| `Ctrl+P` | Print → PDF |

---

## ⚙️ Architectuur

### Rendering Modes

```javascript
var INTERACTIVE_MODE = true;  // true = live interactive, false = PDF export
```

- **INTERACTIVE_MODE = true** (standaard)
  - Rendert live DOM
  - Draggable blokken
  - Editable content
  - Geen pagina-breaks

- **INTERACTIVE_MODE = false** (voor PDF)
  - Rendert multi-page A4 layout
  - PDF-exportable
  - Genummerde pagina's

### Data Flow

```
User sleept blok
  ↓
dragstart event
  ↓
drop event
  ↓
DOM bijgewerkt
  ↓
syncInteractiveToData()
  ↓
Data model (blocks[], zalen[], etc.) bijgewerkt
  ↓
Wijziging opgeslagen in localStorage
```

### Key Functions

| Functie | Doel |
|---------|------|
| `renderInteractive()` | Bouwt live DOM preview |
| `createInteractiveBlock()` | Maakt draggable blok |
| `attachInteractiveHandlers()` | Event listeners toevoegen |
| `syncInteractiveToData()` | DOM → data model sync |

---

## 🔧 Aanpassen

### Toggle Interactive Mode

In `index.html`, zoek naar:
```javascript
var INTERACTIVE_MODE = true;
```

Verander naar `false` om PDF-export te activeren.

### Custom Styling

CSS voor interactive mode:
```css
.interactive-offerte { /* hele offerte */ }
.int-block { /* blokken */ }
.int-item { /* producten */ }
.int-text { /* editable tekst */ }
.drag-handle { /* sleep-icoon */ }
```

### Add Custom Blocks

In `createInteractiveBlock()`:
```javascript
else if(block.type === "mijn-type"){
  // Custom rendering
}
```

---

## 📱 Mobile Support

- **Touch drag-drop:** Werkt met finger/stylus
- **Inline editing:** Double-tap om tekst te bewerken
- **Responsive layout:** Optimized voor tablets

Tested op:
- ✅ iPad/tablet
- ✅ Android (Chrome)
- ✅ iPhone Safari
- ✅ Desktop (Windows/Mac/Linux)

---

## 🚨 Limitations & Known Issues

| Issue | Status | Workaround |
|-------|--------|-----------|
| Very large files (500+ items) | Slow | Verdeel in meerdere offertes |
| Safari drag-drop | ⚠️ Limited | Gebruik Chrome/Firefox |
| Undo (Ctrl+Z) | Niet impl. | Browser history |
| Collaborative editing | Niet impl. | Niet multi-user |

---

## 🔌 Integration

### Met Externe Services

**Cloudflare Worker** (voor Claude AI):
```javascript
const response = await fetch("https://quoteassist.stijn-borloo.workers.dev", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ model: "claude-haiku...", ... })
});
```

**OpenRouter** (fallback):
```javascript
if (!_workerUrl && !_claudeKey) {
  // Use OpenRouter key
  var response = await fetch("https://openrouter.io/api/v1/chat/completions", { ... });
}
```

---

## 📝 Changelog

### v1.0 (2026-06-06)

- ✨ Volledig interactive live preview
- ✨ Drag-drop voor blokken & items
- ✨ Double-click inline editing
- ✨ Mobile drag-drop support
- ✨ Data-sync DOM ↔ model
- 🔧 Cloudflare Worker integration
- 🎨 Split-screen UI

---

## 🤝 Support

### Troubleshooting

**Drag-drop werkt niet:**
- Zeker dat je `draggable="true"` hebt?
- Browser-console checken voor errors

**Wijzigingen gaan verloren:**
- localStorage moet enabled zijn
- Private browsing uitschakelen

**PDF ziet er raar uit:**
- Zet `INTERACTIVE_MODE = false` in code
- Roep dan `render()` aan

---

## 📖 Gerelateerde Repos

- **`ricoh-offerte`** — Volledige pro-versie
- **`easy-quotation`** — Simpele versie (static preview)
- **`ricoh-offerte-proxy`** — Cloudflare Worker

---

**Vragen?** Raadpleeg de app zelf — hover over elementen voor tips!
