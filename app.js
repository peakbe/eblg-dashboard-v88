/* ----------------------------------------------------------
   CONSTANTES
---------------------------------------------------------- */

const AVWX_API_KEY = "ersegQzkf2Dfal-o26B4b5uzMrXBeHK2jOpOaY7nffc";
const PROXY = "https://eblg-proxy.onrender.com/proxy?url=";
const FIDS_ARR = PROXY + encodeURIComponent("https://fids.liegeairport.com/api/flights/Arrivals");
const FIDS_DEP = PROXY + encodeURIComponent("https://fids.liegeairport.com/api/flights/Departures");

const MAP_CENTER = [50.6374, 5.4432];
const MAP_ZOOM   = 12;

/* ----------------------------------------------------------
   MAP LEAFLET
---------------------------------------------------------- */

let map;
let runwayLayer;
let sonometerLayer;
let sonometers = {}; // {id: {lat, lon, marker, status}}

function initMap() {
  map = L.map("map", {
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    preferCanvas: true
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  runwayLayer = L.layerGroup().addTo(map);
  sonometerLayer = L.layerGroup().addTo(map);

  initSonometers();
}

function initSonometers() {
 /* ----------------------------------------------------------
   SONOMÈTRES
---------------------------------------------------------- */
const SONOS = [
  { id:"F017", lat:50.764883, lon:5.630606 },
  { id:"F001", lat:50.737, lon:5.608833 },
  { id:"F014", lat:50.718894, lon:5.573164 },
  { id:"F015", lat:50.688839, lon:5.526217 },
  { id:"F005", lat:50.639331, lon:5.323519 },
  { id:"F003", lat:50.601167, lon:5.3814 },
  { id:"F011", lat:50.601142, lon:5.356006 },
  { id:"F008", lat:50.594878, lon:5.35895 },
  { id:"F002", lat:50.588414, lon:5.370522 },
  { id:"F007", lat:50.590756, lon:5.345225 },
  { id:"F009", lat:50.580831, lon:5.355417 },
  { id:"F004", lat:50.605414, lon:5.321406 },
  { id:"F010", lat:50.599392, lon:5.313492 },
  { id:"F013", lat:50.586914, lon:5.308678 },
  { id:"F016", lat:50.619617, lon:5.295345 },
  { id:"F006", lat:50.609594, lon:5.271403 },
  { id:"F012", lat:50.621917, lon:5.254747 }
];

  data.forEach(s => {
    const marker = L.circleMarker([s.lat, s.lon], {
      radius: 6,
      color: "#4b5563",
      fillColor: "#9ca3af",
      fillOpacity: 0.9
    }).addTo(sonometerLayer);

    sonometers[s.id] = {
      id: s.id,
      lat: s.lat,
      lon: s.lon,
      marker,
      status: "neutral"
    };
  });
}

/* ----------------------------------------------------------
   METAR
---------------------------------------------------------- */

async function fetchMetar() {
  const res = await fetch(METAR_URL);
  if (!res.ok) throw new Error("METAR error");
  return res.json();
}

function updateMetarUI(metar) {
  const el = document.getElementById("meteo-summary");
  if (!metar) {
    el.textContent = "METAR indisponible";
    return;
  }

  // Adapte selon ton format METAR
  const txt = `${metar.station || "EBLG"} ${metar.time || ""} 
Vent ${metar.wind || "-"} 
Visibilité ${metar.visibility || "-"} 
Ciel ${metar.clouds || "-"}`;

  el.textContent = txt;
}

/* ----------------------------------------------------------
   FIDS : FETCH
---------------------------------------------------------- */

async function fetchFIDS() {
  const [arr, dep] = await Promise.all([
    fetch(FIDS_ARR).then(r => r.json()),
    fetch(FIDS_DEP).then(r => r.json())
  ]);

  return {
    arrivals: Array.isArray(arr) ? arr : [],
    departures: Array.isArray(dep) ? dep : []
  };
}

/* ----------------------------------------------------------
   HELPERS FIDS
---------------------------------------------------------- */

// Heure locale
function formatLocal(t) {
  if (!t) return "-";
  return new Date(t).toLocaleTimeString("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Brussels"
  });
}

// "dans X minutes"
function minutesFromNow(time) {
  if (!time) return "-";
  const now = new Date();
  const t = new Date(time);
  const diffMin = Math.round((t - now) / 60000);

  if (diffMin < -5) return `il y a ${Math.abs(diffMin)} min`;
  if (diffMin < 1) return "maintenant";
  return `dans ${diffMin} min`;
}

// Détection retard
function isDelayed(v) {
  const sched = v.sTx || v.scheduled;
  const est = v.eTx;
  const act = v.aTx;

  if (!sched) return false;

  const s = new Date(sched);
  if (act && new Date(act) > s) return true;
  if (est && new Date(est) > s) return true;

  return false;
}

// Couleur cargo vs pax
function flightColor(v) {
  if (v.flightPax && v.flightPax.startsWith("C")) return "#0ea5e9"; // Cargo
  return "#10b981"; // Pax
}

/* ----------------------------------------------------------
   MINI TABLEAU : Prochains vols
---------------------------------------------------------- */

function renderNextFlights(arrivals, departures) {
  const container = document.getElementById("next-flights");

  let html = "<strong>Arrivées</strong><br>";
  arrivals.forEach(f => {
    html += `
      <div class="flight-row">
        <strong>${f.flightPax || f.flight}</strong> → ${formatLocal(f.eTx)}
        <span style="color:#6b7280;">(${minutesFromNow(f.eTx)})</span>
      </div>
    `;
  });

  html += "<br><strong>Départs</strong><br>";
  departures.forEach(f => {
    html += `
      <div class="flight-row">
        <strong>${f.flightPax || f.flight}</strong> → ${formatLocal(f.eTx)}
        <span style="color:#6b7280;">(${minutesFromNow(f.eTx)})</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

/* ----------------------------------------------------------
   LISTE FIDS PRINCIPALE (compacte + RETARD + couleurs)
---------------------------------------------------------- */

function updateFlightsUI(f) {
  const el = document.getElementById("flights-list");

  if ((!f.arrivals || f.arrivals.length === 0) && (!f.departures || f.departures.length === 0)) {
    el.textContent = "Aucun vol FIDS disponible.";
    return;
  }

  let html = "";

  // ARRIVÉES
  html += "<strong>Arrivées</strong><br>";
  f.arrivals.forEach(v => {
    const delayed = isDelayed(v);
    const color = flightColor(v);

    html += `
      <div class="flight-row" style="border-left:4px solid ${color}; padding-left:6px; margin-bottom:6px;">
        <strong>${v.flightPax || v.flight}</strong> → ${formatLocal(v.eTx)}
        <span style="color:#6b7280;">(${minutesFromNow(v.eTx)})</span>
        ${delayed ? `<span style="color:#b91c1c; font-weight:bold;"> RETARD</span>` : ""}
      </div>
    `;
  });

  html += "<br>";

  // DÉPARTS
  html += "<strong>Départs</strong><br>";
  f.departures.forEach(v => {
    const delayed = isDelayed(v);
    const color = flightColor(v);

    html += `
      <div class="flight-row" style="border-left:4px solid ${color}; padding-left:6px; margin-bottom:6px;">
        <strong>${v.flightPax || v.flight}</strong> → ${formatLocal(v.eTx)}
        <span style="color:#6b7280;">(${minutesFromNow(v.eTx)})</span>
        ${delayed ? `<span style="color:#b91c1c; font-weight:bold;"> RETARD</span>` : ""}
      </div>
    `;
  });

  el.innerHTML = html;
}

/* ----------------------------------------------------------
   LIMITATION À 10 VOLS
---------------------------------------------------------- */

function limitNextFlights(list) {
  return list
    .filter(f => f.scheduled)
    .sort((a, b) => new Date(a.scheduled) - new Date(b.scheduled))
    .slice(0, 10);
}

/* ----------------------------------------------------------
   RUNWAY
---------------------------------------------------------- */

let currentRunway = null;

function extractRunway(fids) {
  const all = [...fids.arrivals, ...fids.departures];
  if (!all.length) return null;

  // Exemple simple : on prend la piste la plus fréquente
  const counts = {};
  all.forEach(v => {
    if (!v.runway) return;
    counts[v.runway] = (counts[v.runway] || 0) + 1;
  });

  const entries = Object.entries(counts);
  if (!entries.length) return null;

  entries.sort((a, b) => b[1] - a[1]);
  return { name: entries[0][0] };
}

function drawRunwayAxis(rw) {
  runwayLayer.clearLayers();
  if (!rw) return;

  // Exemple très simplifié : segment fixe selon la piste
  let coords;
  if (rw.name === "22") {
    coords = [
      [50.64594, 5.44375],
      [50.65480, 5.46530]
    ];
  } else if (rw.name === "04") {
    coords = [
      [50.65480, 5.46530],
      [50.64594, 5.44375]
    ];
  } else {
    return;
  }

  L.polyline(coords, {
    color: "#f97316",
    weight: 4
  }).addTo(runwayLayer);

  currentRunway = rw.name;
  document.getElementById("runway-info").textContent = `Piste active : ${rw.name}`;
}

/* ----------------------------------------------------------
   BOUTONS CARTE
---------------------------------------------------------- */

function initMapButtons() {
  const resetBtn = document.getElementById("reset-map");
  const zoomRunwayBtn = document.getElementById("zoom-runway");
  const zoomImpactedBtn = document.getElementById("zoom-impacted");
  const zoomGlobalBtn = document.getElementById("zoom-global");

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      map.setView(MAP_CENTER, MAP_ZOOM);
    });
  }

  if (zoomRunwayBtn) {
    zoomRunwayBtn.addEventListener("click", () => {
      if (!currentRunway) return;

      if (currentRunway === "22") {
        map.fitBounds([
          [50.64594, 5.44375],
          [50.65480, 5.46530]
        ]);
      } else if (currentRunway === "04") {
        map.fitBounds([
          [50.65480, 5.46530],
          [50.64594, 5.44375]
        ]);
      }
    });
  }

  if (zoomImpactedBtn) {
    zoomImpactedBtn.addEventListener("click", () => {
      const impacted = Object.values(sonometers).filter(s => s.status === "impact");
      if (!impacted.length) return;

      const bounds = L.latLngBounds(impacted.map(s => [s.lat, s.lon]));
      map.fitBounds(bounds.pad(0.3));
    });
  }

  if (zoomGlobalBtn) {
    zoomGlobalBtn.addEventListener("click", () => {
      map.setView(MAP_CENTER, MAP_ZOOM);
    });
  }
}

/* ----------------------------------------------------------
   REFRESH GLOBAL
---------------------------------------------------------- */

async function refresh() {
  try {
    const metar = await fetchMetar();
    updateMetarUI(metar);
  } catch (e) {
    document.getElementById("meteo-summary").textContent = "METAR indisponible";
  }

  /* FIDS */
  const fids = await fetchFIDS();

  fids.arrivals = limitNextFlights(fids.arrivals);
  fids.departures = limitNextFlights(fids.departures);

  updateFlightsUI(fids);
  renderNextFlights(fids.arrivals, fids.departures);

  /* RUNWAY */
  const rw = extractRunway(fids);
  if (!rw) {
    document.getElementById("runway-info").textContent = "Piste non déterminée.";
    return;
  }

  drawRunwayAxis(rw);

  // Ici tu peux aussi mettre à jour les sonomètres selon la piste / phase
}

/* ----------------------------------------------------------
   INIT
---------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initMapButtons();
  refresh();
  setInterval(refresh, 60_000); // rafraîchissement chaque minute
});
