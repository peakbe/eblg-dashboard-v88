// ======================================================
// CONFIGURATION
// ======================================================

const PROXY = "https://eblg-proxy.onrender.com";

const ENDPOINTS = {
    metar: `${PROXY}/metar`,
    taf: `${PROXY}/taf`,
    fids: `${PROXY}/fids`,
    notam: `${PROXY}/notam`
};

// ======================================================
// FETCH HELPER (centralisé, robuste, réutilisable)
// ======================================================

async function fetchJSON(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error("Erreur fetch :", err);
        return { fallback: true, error: err.message };
    }
}

// ======================================================
// METAR
// ======================================================

async function loadMetar() {
    const data = await fetchJSON(ENDPOINTS.metar);
    updateMetarUI(data);
    updateStatusPanel("METAR", data);
}


function updateMetarUI(data) {
    const el = document.getElementById("metar");
    if (!el) return;

    if (data.fallback) {
        el.innerText = "METAR indisponible (fallback activé)";
        updateSonometers("UNKNOWN");
        return;
    }

    el.innerText = data.raw;

    const windDir = data.wind_direction?.value;
    const runway = getRunwayFromWind(windDir);

    updateSonometers(runway);
}
function updateSonometers(runway) {
    const color = getSonometerColor(runway);

    Object.values(sonometers).forEach(s => {
        s.marker.setStyle({
            color,
            fillColor: color
        });
        s.status = runway;
    });
}


/* ----------------------------------------------------------
   SONOMÈTRES EBLG
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

let sonometers = {}; // {id, lat, lon, marker, status}

function getRunwayFromWind(windDir) {
    if (!windDir) return "UNKNOWN";

    // Piste 22 = vent venant de 240–300°
    if (windDir >= 240 && windDir <= 300) return "25";

    // Piste 04 = vent venant de 060–120°
    if (windDir >= 60 && windDir <= 120) return "07";

    return "UNKNOWN";
}
function getSonometerColor(runway) {
    if (runway === "22") return "red";
    if (runway === "04") return "blue";
    return "gray";
}

/* ----------------------------------------------------------
   MAP LEAFLET
---------------------------------------------------------- */

let map;
let runwayLayer;
let sonometerLayer;

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

function initSonometers(map) {
    SONOS.forEach(s => {
        const marker = L.circleMarker([s.lat, s.lon], {
            radius: 6,
            color: "gray",
            fillColor: "gray",
            fillOpacity: 0.9
        }).addTo(map);

        sonometers[s.id] = {
            ...s,
            marker,
            status: "UNKNOWN"
        };
    });
}


// ======================================================
// TAF (prêt pour intégration future)
// ======================================================

async function loadTaf() {
    const data = await fetchJSON(ENDPOINTS.taf);
    updateTafUI(data);
}

function updateTafUI(data) {
    const el = document.getElementById("taf");
    if (!el) return;

    if (data.fallback) {
        el.innerText = "TAF indisponible (fallback activé)";
        return;
    }

    el.innerText = data.raw || "TAF disponible";
}

/* ----------------------------------------------------------
   FIDS AVEC FALLBACK ROBUSTE
---------------------------------------------------------- */
app.get("/fids", async (req, res) => {
  try {
    // Exemple de source FIDS (à remplacer plus tard)
    const url = "https://opensky-network.org/api/flights/departure?airport=EBLG&begin=0&end=0";

    let response;
    try {
      response = await fetch(url);
    } catch (networkError) {
      console.error("Erreur réseau FIDS :", networkError);
      throw new Error("NETWORK_FAIL");
    }

    if (!response.ok) throw new Error("HTTP_FAIL");

    const data = await response.json();
    return res.json(data);

  } catch (error) {
    console.error("FIDS DOWN → fallback activé :", error.message);

    return res.json([
      {
        flight: "N/A",
        destination: "N/A",
        time: "N/A",
        status: "Unavailable",
        fallback: true,
        timestamp: new Date().toISOString()
      }
    ]);
  }
});


// =========================
// PANEL D'ÉTAT GLOBAL
// =========================

function updateStatusPanel(service, data) {
    const panel = document.getElementById("status-panel");
    if (!panel) return;

    if (data.fallback) {
        panel.className = "status-fallback";
        panel.innerText = `${service} : fallback (source offline)`;
        return;
    }

    if (data.error) {
        panel.className = "status-offline";
        panel.innerText = `${service} : offline`;
        return;
    }

    panel.className = "status-ok";
    panel.innerText = `${service} : OK`;
}

// ======================================================
// INITIALISATION
// ======================================================

window.onload = () => {
    loadMetar();
    loadTaf();
    loadFids();
    // Tu pourras ajouter ici : loadNotam(), loadCorridors(), loadPistes(), etc.
};
