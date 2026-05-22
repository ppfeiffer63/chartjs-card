# CLAUDE.md – ChartJS Card

Diese Datei enthält den Entwicklungskontext für Claude Code.

---

## Projekt-Übersicht

**Typ:** Home Assistant Lovelace Custom Card  
**Card-Typ:** `custom:chartjs-card`  
**Version:** 1.0.0  
**Repos:**
- Forgejo (primär): `https://git.pfeiffer-privat.de/ppfeiffer/chartjs-card`
- GitHub (Mirror, für HACS): `https://github.com/ppfeiffer63/chartjs-card`
- Mirror: Forgejo → GitHub automatisch per Push-Mirror (`sync_on_commit: true`)

---

## Dateistruktur

```
chartjs-card/
├── dist/
│   └── chartjs-card.js   ← Haupt-Datei (HACS installiert diese)
├── hacs.json             ← HACS-Metadaten (content_in_root: false)
├── README.md             ← Dokumentation (wird in HACS angezeigt)
└── CLAUDE.md             ← Diese Datei
```

---

## Technische Basis

### Geladene Bibliotheken (CDN, in dieser Reihenfolge)

| Bibliothek | Version | URL |
|---|---|---|
| Luxon | 3.4.4 | `cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js` |
| Chart.js | 4.4.0 | `cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js` |
| chartjs-adapter-luxon | 1.3.1 | `cdn.jsdelivr.net/npm/chartjs-adapter-luxon@1.3.1/dist/chartjs-adapter-luxon.umd.min.js` |

**Warum Luxon?** Chart.js 4.x braucht für die Zeitachse (`type: "time"`) einen Date-Adapter. Luxon ist der empfohlene Adapter und liefert korrekte `de`-Formatierung.

**Ladereihenfolge ist kritisch:** Luxon → Chart.js → Adapter. Der Adapter registriert sich selbst bei Chart.js beim Laden.

### Datenquelle: HA History API

```
GET /api/history/period/<ISO_START>
  ?filter_entity_id=<entity_id1>,<entity_id2>
  &end_time=<ISO_END>
  &minimal_response=true
  &no_attributes=true
```

Aufruf über `this._hass.callApi("GET", "history/period/...")`.  
Antwort: Array von Arrays — je ein Array pro Entity, sortiert nach Übergabe-Reihenfolge.  
Jeder Eintrag: `{ entity_id, state, last_changed, last_updated }`.

**Wichtig:** `minimal_response=true` und `no_attributes=true` reduzieren die Datenmenge erheblich.

---

## Unterstützte Chart-Typen

| `chart_type` | Chart.js Typ | Beschreibung |
|---|---|---|
| `line` | `line` | Liniendiagramm, optional mit Flächenfüllung |
| `bar` | `bar` | Balkendiagramm |

---

## Alle konfigurierbaren Parameter

### Karten-Ebene

| Parameter | Typ | Default | Beschreibung |
|---|---|---|---|
| `title` | string | "" | Titel der Karte |
| `chart_type` | string | `line` | `line` oder `bar` |
| `hours` | number | 24 | Zeitraum in Stunden (1–720) |
| `height` | number | 250 | Chart-Höhe in Pixel |
| `fill` | bool | false | Fläche unter allen Linien füllen (globaler Default) |
| `smooth` | bool | true | Glatte Bezier-Kurven (`tension: 0.4`) |
| `show_legend` | bool | true | Chart.js Legende anzeigen |
| `show_points` | bool | false | Datenpunkte als Kreise (radius: 3) |
| `refresh` | number | 300 | Auto-Refresh-Intervall in Sekunden |

### Entity-Ebene (unter `entities:`)

| Parameter | Typ | Default | Beschreibung |
|---|---|---|---|
| `entity` | string | – | HA Entity ID (Pflicht) |
| `name` | string | entity ID | Anzeigename in Legende & Tooltip |
| `color` | string | Auto | Farbe als `#rrggbb` |
| `unit` | string | "" | Einheit im Tooltip |
| `yaxis` | string | `left` | Y-Achse: `left` oder `right` |
| `fill` | bool | – | Fläche für diese Entity (überschreibt globales `fill`) |
| `hidden` | bool | false | Dataset standardmäßig ausgeblendet |

---

## Architektur-Details

### Lebenszyklus

```
setConfig()
  └── _init()
        ├── _renderSkeleton()    ← HTML-Gerüst in Shadow DOM
        ├── _loadLibs()          ← Luxon → Chart.js → Adapter (einmalig global)
        ├── _buildChart()        ← Chart.js Instanz anlegen (leere Datasets)
        └── _fetchAndUpdate()    ← History API → Datasets befüllen

set hass()
  ├── wenn kein Chart: _init()
  └── wenn refresh fällig: _fetchAndUpdate()

connectedCallback()  → _startRefreshTimer()
disconnectedCallback() → _stopRefreshTimer() + chart.destroy()
```

### Y-Achsen-Logik

- Immer eine linke Y-Achse (`y`)
- Rechte Y-Achse (`y2`) wird nur angelegt wenn mindestens eine Entity `yaxis: right` hat
- `gridLines` der rechten Achse deaktiviert (`drawOnChartArea: false`) um doppelte Gitterlinien zu vermeiden

### Refresh-Mechanismus

Zwei parallele Mechanismen:
1. `setInterval` alle `refresh` Sekunden (`_startRefreshTimer`)
2. Prüfung in `set hass()` ob `Date.now() - _lastFetch > refresh * 1000`

`_fetching`-Flag verhindert parallele API-Aufrufe.

---

## Bekannte Einschränkungen / Fallstricke

- **HA History API Limit:** Sehr lange Zeiträume (> 7 Tage) können langsam sein oder Timeout verursachen — abhängig von der HA-Instanz und Recorder-Konfiguration.
- **Entities ohne numerische States:** Werden herausgefiltert (`isNaN(parseFloat(s.state))`). `unavailable` und `unknown` werden explizit ausgeschlossen.
- **Chart.js 4.x Breaking Changes:** Falls Upgrade auf 4.5+, `scales.x.time.displayFormats` und Tooltip-API prüfen.
- **Bibliotheksreihenfolge:** Luxon muss vor Chart.js geladen sein, Adapter danach. Falsche Reihenfolge → `"No date adapter"` Fehler in der Konsole.

---

## Entwicklungs-Workflow

```bash
# Änderung machen
vim dist/chartjs-card.js

# Committen und pushen (Mirror synchronisiert GitHub automatisch)
git add dist/chartjs-card.js
git commit -m "feat/fix: beschreibung"
git push origin master
```

---

## Offene Punkte / Ideen

- [ ] Weitere Chart-Typen: `scatter`, `radar`, `doughnut`
- [ ] Statistik-API statt History API (für stündliche/tägliche Aggregate)
- [ ] `min_y` / `max_y` Parameter für feste Y-Achsen-Grenzen
- [ ] Annotation-Plugin für Schwellwert-Linien (`chartjs-plugin-annotation`)
- [ ] Export-Button (PNG/CSV)
- [ ] Zoom/Pan Plugin (`chartjs-plugin-zoom`)
- [ ] Offline-Modus: Bibliotheken lokal bündeln (webpack/rollup)
- [ ] Farbgradient entlang der Linie (z.B. grün→rot je nach Wert)
- [ ] `aggregation`: Datenpunkte zusammenfassen (min/max/avg pro Stunde) für lange Zeiträume

---

## Zusammenhang mit anderen Repos

- **`ppfeiffer/ha-dashboard-plugins`** – Index-Repo, listet dieses Plugin auf
- **`ppfeiffer/steelseries-gauge-addon`** – Schwester-Plugin (SteelSeries Gauges)
