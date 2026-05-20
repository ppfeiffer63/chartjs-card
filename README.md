# ChartJS Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://git.pfeiffer-privat.de/ppfeiffer/chartjs-card)

Linie & Balken Charts für Home Assistant Lovelace auf Basis von [Chart.js](https://www.chartjs.org/).  
Daten werden automatisch über die **HA History API** geladen.

---

## Installation via HACS

1. HACS → Frontend → **⋮** → Benutzerdefinierte Repositories
2. URL eintragen:
   ```
   https://github.com/ppfeiffer63/chartjs-card
   ```
   Kategorie: **Dashboard**
3. **ChartJS Card** installieren & Browser-Cache leeren (Shift+F5)

---

## Manuelle Installation

1. `dist/chartjs-card.js` nach `/config/www/` kopieren
2. **Einstellungen → Dashboards → ⋮ → Ressourcen → Hinzufügen**
   - URL: `/local/chartjs-card.js`
   - Typ: `JavaScript-Modul`

---

## Verwendung

### Einfach (eine Entity, Linie)

```yaml
type: custom:chartjs-card
title: Temperaturverlauf
chart_type: line
hours: 24
entities:
  - entity: sensor.temperature
    name: Temperatur
    color: "#e74c3c"
    unit: °C
```

### Mehrere Entities mit zwei Y-Achsen

```yaml
type: custom:chartjs-card
title: Temperatur & Luftfeuchtigkeit
chart_type: line
hours: 48
height: 300
fill: false
smooth: true
show_legend: true
show_points: false
refresh: 300
entities:
  - entity: sensor.temperature
    name: Temperatur
    color: "#e74c3c"
    unit: °C
    yaxis: left
  - entity: sensor.humidity
    name: Luftfeuchtigkeit
    color: "#3498db"
    unit: "%"
    yaxis: right
```

### Balken-Chart (Energieverbrauch)

```yaml
type: custom:chartjs-card
title: Energieverbrauch
chart_type: bar
hours: 72
height: 250
show_legend: true
entities:
  - entity: sensor.power_consumption
    name: Verbrauch
    color: "#f39c12"
    unit: W
```

---

## Alle Optionen

### Karten-Optionen

| Option        | Standard | Beschreibung                                   |
|---------------|----------|------------------------------------------------|
| `title`       | –        | Titel der Karte                                |
| `chart_type`  | `line`   | `line` oder `bar`                              |
| `hours`       | `24`     | Zeitraum in Stunden (1–720)                    |
| `height`      | `250`    | Höhe des Charts in Pixel                       |
| `fill`        | `false`  | Fläche unter allen Linien füllen               |
| `smooth`      | `true`   | Glatte Kurven (Bezier)                         |
| `show_legend` | `true`   | Legende anzeigen                               |
| `show_points` | `false`  | Datenpunkte als Kreise anzeigen                |
| `refresh`     | `300`    | Automatischer Refresh in Sekunden              |

### Entity-Optionen (unter `entities:`)

| Option   | Standard | Beschreibung                          |
|----------|----------|---------------------------------------|
| `entity` | –        | **Pflicht.** HA Entity ID             |
| `name`   | Entity ID| Anzeigename in Legende & Tooltip      |
| `color`  | Auto     | Farbe als `#rrggbb`                   |
| `unit`   | –        | Einheit im Tooltip (z.B. `°C`, `%`)   |
| `yaxis`  | `left`   | Y-Achse: `left` oder `right`          |
| `fill`   | –        | Fläche für diese Entity füllen        |
| `hidden` | `false`  | Entity standardmäßig ausblenden       |

---

## Lizenz

MIT
