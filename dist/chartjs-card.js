/**
 * ChartJS Card for Home Assistant Lovelace  v1.0.0
 * Unterstützt: line, bar – einzelne und mehrere Entities – HA History API
 *
 * ─── YAML Beispiel (einfach) ────────────────────────────────────────────────
 * type: custom:chartjs-card
 * title: Temperaturverlauf
 * chart_type: line
 * hours: 24
 * entities:
 *   - entity: sensor.temperature
 *     name: Temperatur
 *     color: "#e74c3c"
 *
 * ─── YAML Beispiel (mehrere Entities) ───────────────────────────────────────
 * type: custom:chartjs-card
 * title: Sensoren
 * chart_type: bar
 * hours: 48
 * height: 300
 * fill: true
 * smooth: true
 * entities:
 *   - entity: sensor.temperature
 *     name: Temperatur
 *     color: "#e74c3c"
 *     unit: °C
 *     yaxis: left
 *   - entity: sensor.humidity
 *     name: Luftfeuchtigkeit
 *     color: "#3498db"
 *     unit: "%"
 *     yaxis: right
 * ────────────────────────────────────────────────────────────────────────────
 */

const CHARTJS_URL = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
const LUXON_URL   = "https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js";
const CHARTJS_ADAPTER_URL = "https://cdn.jsdelivr.net/npm/chartjs-adapter-luxon@1.3.1/dist/chartjs-adapter-luxon.umd.min.js";

let _libsLoaded = null;

function _loadLibs() {
  if (_libsLoaded) return _libsLoaded;
  _libsLoaded = new Promise((resolve, reject) => {
    const load = (src) => new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error("Konnte nicht laden: " + src));
      document.head.appendChild(s);
    });
    load(LUXON_URL)
      .then(() => load(CHARTJS_URL))
      .then(() => load(CHARTJS_ADAPTER_URL))
      .then(resolve)
      .catch(reject);
  });
  return _libsLoaded;
}

// Standard-Farben für automatische Zuweisung
const _COLORS = [
  "#e74c3c","#3498db","#2ecc71","#f39c12","#9b59b6",
  "#1abc9c","#e67e22","#34495e","#e91e63","#00bcd4",
];

// ── Haupt-Element ─────────────────────────────────────────────────────────────
class ChartjsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config    = {};
    this._chart     = null;
    this._hass      = null;
    this._fetching  = false;
    this._lastFetch = 0;
    this._interval  = null;
  }

  static getConfigElement() {
    return document.createElement("chartjs-card-editor");
  }

  static getStubConfig() {
    return {
      title: "Mein Chart",
      chart_type: "line",
      hours: 24,
      entities: [{ entity: "sensor.temperature", name: "Temperatur", color: "#e74c3c" }],
    };
  }

  setConfig(config) {
    if (!config.entities || !config.entities.length)
      throw new Error("[ChartjsCard] Mindestens eine Entity unter 'entities' erforderlich.");

    this._config = {
      title:       config.title       || "",
      chart_type:  config.chart_type  || "line",
      hours:       Number(config.hours || 24),
      height:      Number(config.height || 250),
      fill:        config.fill        === true,
      smooth:      config.smooth      !== false,
      show_legend: config.show_legend !== false,
      show_points: config.show_points === true,
      refresh:     Number(config.refresh || 300),   // Sekunden
      entities: config.entities.map((e, i) => ({
        entity:    e.entity,
        name:      e.name      || e.entity,
        color:     e.color     || _COLORS[i % _COLORS.length],
        unit:      e.unit      || "",
        yaxis:     e.yaxis     || "left",   // left | right
        fill:      e.fill      !== undefined ? e.fill : config.fill === true,
        hidden:    e.hidden    === true,
      })),
    };

    // Neuaufbau erzwingen
    this._chart = null;
    this._lastFetch = 0;
    if (this._hass) this._init();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._chart) {
      this._init();
    } else {
      // Periodischer Refresh
      const now = Date.now();
      if (now - this._lastFetch > this._config.refresh * 1000) {
        this._fetchAndUpdate();
      }
    }
  }

  connectedCallback() {
    this._startRefreshTimer();
  }

  disconnectedCallback() {
    this._stopRefreshTimer();
    if (this._chart) { this._chart.destroy(); this._chart = null; }
  }

  _startRefreshTimer() {
    this._stopRefreshTimer();
    const ms = (this._config.refresh || 300) * 1000;
    this._interval = setInterval(() => {
      if (this._hass) this._fetchAndUpdate();
    }, ms);
  }

  _stopRefreshTimer() {
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
  }

  async _init() {
    this._renderSkeleton();
    try { await _loadLibs(); }
    catch (e) { this._showError(e.message); return; }
    this._buildChart();
    this._fetchAndUpdate();
    this._startRefreshTimer();
  }

  _renderSkeleton() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 12px 16px 16px; box-sizing: border-box; }
        .title { font-size: 14px; font-weight: 500; color: var(--primary-text-color);
                 margin-bottom: 10px; }
        .chart-wrap { position: relative; width: 100%; }
        canvas { width: 100% !important; }
        .loading { color: var(--secondary-text-color); font-size: 13px;
                   padding: 20px; text-align: center; }
        .error { color: var(--error-color, red); font-size: 12px;
                 padding: 12px; text-align: center; }
        .footer { display: flex; justify-content: flex-end; align-items: center;
                  margin-top: 6px; gap: 8px; flex-wrap: wrap; }
        .last-update { font-size: 10px; color: var(--secondary-text-color); }
      </style>
      <ha-card>
        ${this._config.title ? `<div class="title">${this._config.title}</div>` : ""}
        <div class="chart-wrap">
          <span class="loading">⏳ Lade Chart.js…</span>
        </div>
        <div class="footer">
          <span class="last-update"></span>
        </div>
      </ha-card>`;
  }

  _buildChart() {
    const wrap = this.shadowRoot.querySelector(".chart-wrap");
    wrap.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.style.height = this._config.height + "px";
    wrap.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const cfg = this._config;
    const isBar = cfg.chart_type === "bar";

    // Y-Achsen bestimmen
    const scales = {
      x: {
        type: "time",
        time: { tooltipFormat: "dd.MM HH:mm", displayFormats: { hour: "HH:mm", day: "dd.MM" } },
        ticks: { color: "var(--secondary-text-color)", maxTicksLimit: 8 },
        grid:  { color: "rgba(128,128,128,0.15)" },
      },
      y: {
        position: "left",
        ticks: { color: "var(--secondary-text-color)" },
        grid:  { color: "rgba(128,128,128,0.15)" },
      },
    };

    const hasRight = cfg.entities.some(e => e.yaxis === "right");
    if (hasRight) {
      scales.y2 = {
        position: "right",
        ticks: { color: "var(--secondary-text-color)" },
        grid:  { drawOnChartArea: false },
      };
    }

    this._chart = new window.Chart(ctx, {
      type: isBar ? "bar" : "line",
      data: { datasets: [] },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        animation:           { duration: 400 },
        interaction:         { mode: "index", intersect: false },
        plugins: {
          legend: {
            display:  cfg.show_legend,
            position: "top",
            labels:   { color: "var(--primary-text-color)", boxWidth: 12, padding: 10 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const ds   = cfg.entities[ctx.datasetIndex] || {};
                const unit = ds.unit || "";
                return ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)} ${unit}`;
              },
            },
          },
        },
        scales,
      },
    });
  }

  async _fetchAndUpdate() {
    if (this._fetching || !this._hass || !this._chart) return;
    this._fetching = true;

    try {
      const end   = new Date();
      const start = new Date(end.getTime() - this._config.hours * 3600 * 1000);
      const entityIds = this._config.entities.map(e => e.entity).join(",");

      const history = await this._hass.callApi("GET",
        `history/period/${start.toISOString()}?filter_entity_id=${entityIds}&end_time=${end.toISOString()}&minimal_response=true&no_attributes=true`
      );

      // history ist Array von Arrays (je eine pro Entity)
      const datasets = [];
      history.forEach((entityHistory) => {
        if (!entityHistory || !entityHistory.length) return;
        const entityId = entityHistory[0].entity_id;
        const eCfg = this._config.entities.find(e => e.entity === entityId);
        if (!eCfg) return;

        const points = entityHistory
          .filter(s => s.state !== "unavailable" && s.state !== "unknown" && !isNaN(parseFloat(s.state)))
          .map(s => ({ x: new Date(s.last_changed || s.last_updated), y: parseFloat(s.state) }));

        if (!points.length) return;

        const isBar  = this._config.chart_type === "bar";
        const color  = eCfg.color;
        const fillOn = eCfg.fill;

        datasets.push({
          label:           eCfg.name,
          data:            points,
          yAxisID:         eCfg.yaxis === "right" ? "y2" : "y",
          hidden:          eCfg.hidden,
          borderColor:     color,
          backgroundColor: fillOn
            ? color.startsWith("#")
              ? this._hexToRgba(color, 0.2)
              : color
            : isBar ? this._hexToRgba(color, 0.7) : color,
          borderWidth:      isBar ? 0 : 2,
          fill:             fillOn && !isBar,
          tension:          this._config.smooth && !isBar ? 0.4 : 0,
          pointRadius:      this._config.show_points ? 3 : 0,
          pointHoverRadius: 5,
        });
      });

      this._chart.data.datasets = datasets;
      this._chart.update("active");
      this._lastFetch = Date.now();

      // Zeitstempel aktualisieren
      const lu = this.shadowRoot.querySelector(".last-update");
      if (lu) lu.textContent = "Aktualisiert: " + new Date().toLocaleTimeString("de-DE");

    } catch (e) {
      console.error("[ChartjsCard] Fetch-Fehler:", e);
    } finally {
      this._fetching = false;
    }
  }

  _showError(msg) {
    const wrap = this.shadowRoot.querySelector(".chart-wrap");
    if (wrap) wrap.innerHTML = `<div class="error">⚠️ ${msg}</div>`;
  }

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  getCardSize() { return Math.ceil((this._config.height || 250) / 50) + 2; }
}

customElements.define("chartjs-card", ChartjsCard);

// ── Visueller Editor ──────────────────────────────────────────────────────────
class ChartjsCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: "", chart_type: "line", hours: 24, height: 250,
      fill: false, smooth: true, show_legend: true, show_points: false, refresh: 300,
      entities: [],
      ...config,
    };
    this._render();
  }
  connectedCallback() { this._render(); }

  _render() {
    if (!this._config) return;
    const c = this._config;
    const entities = Array.isArray(c.entities) ? c.entities : [];

    this.innerHTML = `
      <style>
        .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:10px; }
        .full { grid-column:1/-1; }
        label { display:block; font-size:11px; color:var(--secondary-text-color); margin-bottom:2px; }
        input,select { width:100%; padding:5px 8px; border-radius:6px; border:1px solid var(--divider-color);
          background:var(--card-background-color); color:var(--primary-text-color);
          font-size:13px; box-sizing:border-box; }
        h4 { grid-column:1/-1; margin:10px 0 2px; font-size:11px; color:var(--secondary-text-color);
             text-transform:uppercase; letter-spacing:1px;
             border-bottom:1px solid var(--divider-color); padding-bottom:4px; }
        .entity-block { grid-column:1/-1; border:1px solid var(--divider-color);
          border-radius:8px; padding:10px; margin-bottom:4px; }
        .entity-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .entity-header { display:flex; justify-content:space-between; align-items:center;
          margin-bottom:8px; font-size:12px; font-weight:500; color:var(--primary-text-color); }
        .btn-del { padding:3px 8px; border-radius:4px; border:1px solid var(--error-color,red);
          background:transparent; color:var(--error-color,red); cursor:pointer; font-size:12px; }
        .btn-del:hover { background:var(--error-color,red); color:#fff; }
        .btn-add { grid-column:1/-1; padding:8px; border-radius:6px; border:1px dashed var(--divider-color);
          background:transparent; color:var(--primary-text-color); cursor:pointer; font-size:13px; }
        .btn-add:hover { background:var(--divider-color); }
        input[type="color"] { padding:2px 4px; height:34px; cursor:pointer; }
        .toggle-row { display:flex; align-items:center; gap:8px; }
        .toggle-row label { font-size:12px; color:var(--primary-text-color); margin:0; }
        input[type="checkbox"] { width:auto; cursor:pointer; }
      </style>
      <div class="grid">

        <div class="full"><label>Titel</label>
          <input id="title" value="${c.title||""}"/></div>

        <h4>Chart</h4>
        <div><label>Typ</label><select id="chart_type">
          <option value="line" ${(c.chart_type||"line")==="line"?"selected":""}>Linie</option>
          <option value="bar"  ${c.chart_type==="bar"?"selected":""}>Balken</option>
        </select></div>
        <div><label>Zeitraum (Stunden)</label>
          <input id="hours" type="number" min="1" max="720" value="${c.hours||24}"/></div>
        <div><label>Höhe (px)</label>
          <input id="height" type="number" min="100" max="800" value="${c.height||250}"/></div>
        <div><label>Refresh-Intervall (s)</label>
          <input id="refresh" type="number" min="30" value="${c.refresh||300}"/></div>

        <h4>Darstellung</h4>
        <div class="toggle-row">
          <input type="checkbox" id="fill"        ${c.fill?"checked":""}>
          <label for="fill">Fläche füllen</label>
        </div>
        <div class="toggle-row">
          <input type="checkbox" id="smooth"      ${c.smooth!==false?"checked":""}>
          <label for="smooth">Glatte Kurve</label>
        </div>
        <div class="toggle-row">
          <input type="checkbox" id="show_legend" ${c.show_legend!==false?"checked":""}>
          <label for="show_legend">Legende anzeigen</label>
        </div>
        <div class="toggle-row">
          <input type="checkbox" id="show_points" ${c.show_points?"checked":""}>
          <label for="show_points">Datenpunkte anzeigen</label>
        </div>

        <h4>Entities</h4>
        ${entities.map((e,i) => `
          <div class="entity-block" data-idx="${i}">
            <div class="entity-header">
              <span>Entity ${i+1}</span>
              <button class="btn-del" data-del="${i}">✕ Entfernen</button>
            </div>
            <div class="entity-grid">
              <div class="full"><label>Entity ID *</label>
                <input class="e-entity" data-idx="${i}" value="${e.entity||""}"/></div>
              <div><label>Name</label>
                <input class="e-name" data-idx="${i}" value="${e.name||""}"/></div>
              <div><label>Einheit</label>
                <input class="e-unit" data-idx="${i}" value="${e.unit||""}"/></div>
              <div><label>Farbe</label>
                <input class="e-color" type="color" data-idx="${i}" value="${e.color||_COLORS_FALLBACK[i%10]}"/></div>
              <div><label>Y-Achse</label>
                <select class="e-yaxis" data-idx="${i}">
                  <option value="left"  ${(e.yaxis||"left")==="left"?"selected":""}>Links</option>
                  <option value="right" ${e.yaxis==="right"?"selected":""}>Rechts</option>
                </select></div>
              <div class="toggle-row" style="align-self:end; padding-bottom:6px;">
                <input type="checkbox" class="e-fill" data-idx="${i}" ${e.fill?"checked":""}>
                <label>Fläche füllen</label>
              </div>
            </div>
          </div>`).join("")}
        <button class="btn-add full" id="add-entity">+ Entity hinzufügen</button>

      </div>`;

    // Basis-Felder
    ["title","chart_type","hours","height","refresh"].forEach(id => {
      const el = this.querySelector(`#${id}`);
      if (el) el.addEventListener("change", () => this._changed());
    });
    ["fill","smooth","show_legend","show_points"].forEach(id => {
      const el = this.querySelector(`#${id}`);
      if (el) el.addEventListener("change", () => this._changed());
    });

    // Entity-Felder
    this.querySelectorAll(".e-entity,.e-name,.e-unit,.e-color,.e-yaxis,.e-fill").forEach(el =>
      el.addEventListener("change", () => this._changed()));

    // Löschen
    this.querySelectorAll(".btn-del").forEach(btn =>
      btn.addEventListener("click", () => {
        this._config.entities.splice(parseInt(btn.dataset.del), 1);
        this._render(); this._dispatch();
      }));

    // Hinzufügen
    this.querySelector("#add-entity").addEventListener("click", () => {
      const i = this._config.entities.length;
      this._config.entities.push({
        entity: "", name: "", color: _COLORS_FALLBACK[i % 10], unit: "", yaxis: "left", fill: false,
      });
      this._render(); this._dispatch();
    });
  }

  _changed() {
    const g  = id => this.querySelector(`#${id}`);
    const gv = id => g(id)?.value || "";
    const gc = id => g(id)?.checked || false;

    // Entities aus DOM
    const entities = [];
    this.querySelectorAll(".entity-block").forEach(block => {
      const i = parseInt(block.dataset.idx);
      entities[i] = {
        entity: block.querySelector(".e-entity")?.value || "",
        name:   block.querySelector(".e-name")?.value   || "",
        unit:   block.querySelector(".e-unit")?.value   || "",
        color:  block.querySelector(".e-color")?.value  || _COLORS_FALLBACK[i%10],
        yaxis:  block.querySelector(".e-yaxis")?.value  || "left",
        fill:   block.querySelector(".e-fill")?.checked || false,
      };
    });

    this._config = { ...this._config,
      title:       gv("title"),
      chart_type:  gv("chart_type") || "line",
      hours:       parseInt(gv("hours"))   || 24,
      height:      parseInt(gv("height"))  || 250,
      refresh:     parseInt(gv("refresh")) || 300,
      fill:        gc("fill"),
      smooth:      gc("smooth"),
      show_legend: gc("show_legend"),
      show_points: gc("show_points"),
      entities,
    };
    this._dispatch();
  }

  _dispatch() {
    this.dispatchEvent(new CustomEvent("config-changed",
      { detail: { config: this._config }, bubbles: true, composed: true }));
  }
}

// Fallback-Farben für Editor (ohne Klassen-Zugriff)
const _COLORS_FALLBACK = [
  "#e74c3c","#3498db","#2ecc71","#f39c12","#9b59b6",
  "#1abc9c","#e67e22","#34495e","#e91e63","#00bcd4",
];

customElements.define("chartjs-card-editor", ChartjsCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        "chartjs-card",
  name:        "ChartJS Card",
  description: "Linie & Balken Charts mit HA History API (Chart.js)",
  preview:     false,
  editor:      "chartjs-card-editor",
});
