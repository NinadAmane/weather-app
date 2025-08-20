// ==== CONFIG ====
const API_KEY = "794d21879a2c4dfda8675315251508"; // your provided key
// Use WeatherAPI forecast endpoint to get current + hourly + 7-day + alerts
const API_URL = (q) =>
  `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${encodeURIComponent(
    q
  )}&days=7&aqi=yes&alerts=yes`;

// ==== STATE ====
let unit = localStorage.getItem("unit") || "C"; // "C" or "F"
let theme = localStorage.getItem("theme") || "dark";
let hourlyChart, dailyChart;

// ==== DOM ====
const $ = (id) => document.getElementById(id);
const placeName = $("placeName");
const localTime = $("localTime");
const iconEl = $("conditionIcon");
const temperature = $("temperature");
const conditionText = $("conditionText");
const feelsLike = $("feelsLike");
const humidity = $("humidity");
const wind = $("wind");
const uv = $("uv");
const sunrise = $("sunrise");
const sunset = $("sunset");
const aqiBadge = $("aqiBadge");
const aqiNote = $("aqiNote");
const alertsEl = $("alerts");
const favoritesList = $("favoritesList");
const toast = $("toast");

const unitToggle = $("unitToggle");
const themeToggle = $("themeToggle");
const searchBtn = $("searchBtn");
const searchInput = $("searchInput");
const locBtn = $("locBtn");
const saveFavBtn = $("saveFavBtn");
const removeFavBtn = $("removeFavBtn");
const clearFavs = $("clearFavs");

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => (toast.hidden = true), 2000);
}

// ==== UTIL ====
const toUnit = (tempC) =>
  unit === "C"
    ? `${Math.round(tempC)}°C`
    : `${Math.round((tempC * 9) / 5 + 32)}°F`;
const windUnit = (kph) =>
  unit === "C" ? `${Math.round(kph)} kph` : `${Math.round(kph / 1.609)} mph`;

function classifyBackground(text, isNight = false) {
  const t = text.toLowerCase();
  if (t.includes("snow")) return "bg-snow";
  if (t.includes("rain") || t.includes("drizzle") || t.includes("shower"))
    return "bg-rainy";
  if (
    t.includes("cloud") ||
    t.includes("overcast") ||
    t.includes("mist") ||
    t.includes("fog")
  )
    return "bg-cloudy";
  // default sunny/clear
  return "bg-sunny";
}

function aqiExplain(usIndex) {
  // WeatherAPI 'us-epa-index' 1..6
  const map = {
    1: ["Good", "Air quality is considered satisfactory."],
    2: [
      "Moderate",
      "Acceptable; sensitive individuals should consider limiting prolonged outdoor exertion.",
    ],
    3: [
      "Unhealthy for Sensitive",
      "Sensitive groups may experience health effects; limit outdoor activity.",
    ],
    4: [
      "Unhealthy",
      "Everyone may begin to experience health effects; reduce prolonged outdoor exertion.",
    ],
    5: ["Very Unhealthy", "Health warnings; avoid outdoor activity."],
    6: ["Hazardous", "Emergency conditions; remain indoors with filtered air."],
  };
  return map[usIndex] || ["—", "—"];
}

function formatTime12h(s) {
  // s: "2025-08-15 14:45" or "07:10 AM" (WeatherAPI gives both styles)
  if (!s) return "—";
  if (s.includes("AM") || s.includes("PM")) return s;
  const dt = new Date(s.replace(/-/g, "/"));
  return dt.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Cache helpers
function cacheSet(key, data) {
  try {
    localStorage.setItem(`wx:${key}`, JSON.stringify({ ts: Date.now(), data }));
  } catch (e) {}
}
function cacheGet(key) {
  try {
    const v = JSON.parse(localStorage.getItem(`wx:${key}`));
    if (!v) return null;
    return v.data;
  } catch (e) {
    return null;
  }
}

// Favorites
function getFavs() {
  try {
    return JSON.parse(localStorage.getItem("wx:favs")) || [];
  } catch (e) {
    return [];
  }
}
function setFavs(list) {
  localStorage.setItem("wx:favs", JSON.stringify(list));
  renderFavs();
}

// ==== RENDER ====
function setBackgroundByCondition(text, isNight = false) {
  document.body.classList.remove(
    "bg-sunny",
    "bg-cloudy",
    "bg-rainy",
    "bg-snow"
  );
  document.body.classList.add(classifyBackground(text, isNight));
}

function renderCurrent(data) {
  const { location, current, forecast } = data;
  const isNight = current.is_day === 0;
  placeName.textContent = `${location.name}, ${location.country}`;
  localTime.textContent = `As of ${location.localtime}`;
  iconEl.src = `https:${current.condition.icon}`;
  iconEl.alt = current.condition.text || "condition";
  temperature.textContent = toUnit(current.temp_c);
  conditionText.textContent = current.condition.text;
  feelsLike.textContent = toUnit(current.feelslike_c);
  humidity.textContent = `${current.humidity}%`;
  wind.textContent = windUnit(current.wind_kph);
  uv.textContent = current.uv ?? "—";

  // sunrise/sunset from forecast today
  const todayAstro = forecast?.forecastday?.[0]?.astro;
  sunrise.textContent = formatTime12h(todayAstro?.sunrise);
  sunset.textContent = formatTime12h(todayAstro?.sunset);

  // AQI
  const epa = current?.air_quality?.["us-epa-index"];
  const [label, note] = aqiExplain(epa);
  aqiBadge.textContent = label;
  aqiBadge.style.background =
    epa <= 2
      ? "rgba(19,195,139,.2)"
      : epa <= 4
      ? "rgba(247,183,49,.2)"
      : "rgba(255,71,87,.25)";
  aqiBadge.style.border = "1px solid rgba(255,255,255,.18)";
  aqiNote.textContent = note;

  // Alerts
  alertsEl.innerHTML = "";
  const alerts = data.alerts?.alert || [];
  if (alerts.length) {
    alerts.forEach((a) => {
      const li = document.createElement("li");
      const sev = (a.severity || "Moderate").toLowerCase();
      li.className = sev.includes("minor")
        ? "sev-minor"
        : sev.includes("severe")
        ? "sev-severe"
        : "sev-moderate";
      li.innerHTML = `<strong>${a.event}</strong> — ${
        a.headline || ""
      }<br><span class="small muted">${a.areaDesc || ""}</span>`;
      alertsEl.appendChild(li);
    });
  }

  // Background
  setBackgroundByCondition(current.condition.text, isNight);

  // Fav buttons state
  const favs = getFavs();
  const isFav = favs.includes(location.name);
  saveFavBtn.style.display = isFav ? "none" : "inline-block";
  removeFavBtn.style.display = isFav ? "inline-block" : "none";
}

function renderDailyCards(data) {
  const daysWrap = $("dailyList");
  const f = data.forecast?.forecastday || [];
  daysWrap.innerHTML = "";
  f.forEach((d) => {
    const el = document.createElement("div");
    el.className = "day";
    const date = new Date(d.date.replace(/-/g, "/"));
    const label = date.toLocaleDateString(undefined, { weekday: "short" });
    el.innerHTML = `
      <div class="muted small">${label}</div>
      <img src="https:${d.day.condition.icon}" alt="${d.day.condition.text}">
      <div><span class="hi">${Math.round(
        d.day.maxtemp_c
      )}°</span> / <span class="muted">${Math.round(
      d.day.mintemp_c
    )}°</span></div>
    `;
    daysWrap.appendChild(el);
  });
}

function renderHourlyChart(data) {
  const ctx = $("hourlyChart").getContext("2d");
  const hours = data.forecast?.forecastday?.[0]?.hour || [];
  const labels = hours.slice(0, 24).map((h) => h.time.split(" ")[1]);
  const tempsC = hours.slice(0, 24).map((h) => h.temp_c);
  const temps = unit === "C" ? tempsC : tempsC.map((c) => (c * 9) / 5 + 32);

  if (hourlyChart) hourlyChart.destroy();
  hourlyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `Temp (${unit})`,
          data: temps,
          tension: 0.35,
          pointRadius: 2,
          borderWidth: 2,
          fill: true,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(255,255,255,.08)" } },
      },
    },
  });
}

function renderDailyChart(data) {
  const ctx = $("dailyChart").getContext("2d");
  const days = data.forecast?.forecastday || [];
  const labels = days.map((d) => {
    const day = new Date(d.date.replace(/-/g, "/")).toLocaleDateString(
      undefined,
      { weekday: "short" }
    );
    return day;
  });
  const highsC = days.map((d) => d.day.maxtemp_c);
  const lowsC = days.map((d) => d.day.mintemp_c);
  const highs = unit === "C" ? highsC : highsC.map((c) => (c * 9) / 5 + 32);
  const lows = unit === "C" ? lowsC : lowsC.map((c) => (c * 9) / 5 + 32);

  if (dailyChart) dailyChart.destroy();
  dailyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `High (${unit})`,
          data: highs,
          tension: 0.35,
          pointRadius: 2,
          borderWidth: 2,
          fill: false,
        },
        {
          label: `Low (${unit})`,
          data: lows,
          tension: 0.35,
          pointRadius: 2,
          borderWidth: 2,
          fill: false,
        },
      ],
    },
    options: {
      plugins: { legend: { display: true } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(255,255,255,.08)" } },
      },
    },
  });
}

function renderAll(data) {
  renderCurrent(data);
  renderDailyCards(data);
  renderHourlyChart(data);
  renderDailyChart(data);
}

// ==== FETCH ====
async function fetchWeather(query, { useCache = true } = {}) {
  try {
    const res = await fetch(API_URL(query));
    if (!res.ok) throw new Error("Failed to fetch");
    const data = await res.json();
    // WeatherAPI sometimes returns .error
    if (data.error) throw new Error(data.error.message || "Error");
    cacheSet(query.toLowerCase(), data);
    return data;
  } catch (err) {
    if (useCache) {
      const cached = cacheGet(query.toLowerCase());
      if (cached) {
        showToast("Offline: showing cached data");
        return cached;
      }
    }
    throw err;
  }
}

// ==== FAVORITES UI ====
function renderFavs() {
  favoritesList.innerHTML = "";
  const favs = getFavs();
  if (!favs.length) {
    const hint = document.createElement("span");
    hint.className = "muted small";
    hint.textContent = "Save your favorite cities for quick access.";
    favoritesList.appendChild(hint);
    return;
  }
  favs.forEach((city) => {
    const b = document.createElement("button");
    b.className = "fav";
    b.textContent = city;
    b.onclick = () => searchCity(city);
    favoritesList.appendChild(b);
  });
}

// ==== ACTIONS ====
async function searchCity(q) {
  if (!q) return;
  try {
    const data = await fetchWeather(q);
    renderAll(data);
    showToast(`Updated: ${data.location.name}`);
  } catch (e) {
    showToast(e.message || "Could not fetch weather");
  }
}

function toggleUnit() {
  unit = unit === "C" ? "F" : "C";
  localStorage.setItem("unit", unit);
  unitToggle.textContent = `°${unit}`;
  // Re-render with transformed values using cached last city if available
  const lastCity = placeName.textContent.split(",")[0];
  if (lastCity) {
    const cached = cacheGet(lastCity.toLowerCase());
    if (cached) renderAll(cached);
  }
}

function toggleTheme() {
  theme = theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", theme);
  applyTheme();
}

function applyTheme() {
  if (theme === "light") document.documentElement.classList.add("light");
  else document.documentElement.classList.remove("light");
}

function useMyLocation() {
  if (!navigator.geolocation) return showToast("Geolocation not supported");
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const q = `${coords.latitude},${coords.longitude}`;
      searchCity(q);
    },
    () => {
      showToast("Location permission denied");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function saveFav() {
  const city = placeName.textContent.split(",")[0];
  if (!city || city === "—") return;
  const favs = getFavs();
  if (!favs.includes(city)) {
    favs.push(city);
    setFavs(favs);
    showToast("Saved to favorites");
    saveFavBtn.style.display = "none";
    removeFavBtn.style.display = "inline-block";
  }
}

function removeFav() {
  const city = placeName.textContent.split(",")[0];
  if (!city || city === "—") return;
  const favs = getFavs().filter((c) => c !== city);
  setFavs(favs);
  showToast("Removed from favorites");
  saveFavBtn.style.display = "inline-block";
  removeFavBtn.style.display = "none";
}

function clearFavorites() {
  setFavs([]);
  showToast("Cleared favorites");
}

// ==== EVENTS ====
searchBtn.addEventListener("click", () => searchCity(searchInput.value.trim()));
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchCity(searchInput.value.trim());
});
locBtn.addEventListener("click", useMyLocation);
unitToggle.addEventListener("click", toggleUnit);
themeToggle.addEventListener("click", toggleTheme);
saveFavBtn.addEventListener("click", saveFav);
removeFavBtn.addEventListener("click", removeFav);
clearFavs.addEventListener("click", clearFavorites);

// ==== INIT ====
(function init() {
  unitToggle.textContent = `°${unit}`;
  applyTheme();
  renderFavs();
  // initial city fallback
  searchCity("London");
})();
