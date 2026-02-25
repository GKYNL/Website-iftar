// İftar (Maghrib) ve İmsak (Fajr) saatlerini AlAdhan API'den alır.
// + "Eğlence modu": particles + tilt + ripple.
// Not: Bu dosya komple yazıldı; önceki sürümle aynı mantık, daha fazla görsel efekt.

const $ = (id) => document.getElementById(id);

const ui = {
  locationLine: $("locationLine"),
  nextTitle: $("nextTitle"),
  countdown: $("countdown"),
  nextTime: $("nextTime"),
  dateLine: $("dateLine"),
  iftarToday: $("iftarToday"),
  imsakToday: $("imsakToday"),
  method: $("method"),
  city: $("city"),
  country: $("country"),
  btnGeo: $("btnGeo"),
  btnCity: $("btnCity"),
  btnRefresh: $("btnRefresh"),
  errorBox: $("errorBox"),
  arcFg: $("arcFg"),
  progressHint: $("progressHint"),
  fxCanvas: $("fxParticles"),
  modeBadge: $("modeBadge"),
};

let state = {
  mode: null, // "geo" | "city"
  lat: null,
  lon: null,
  city: null,
  country: null,
  method: Number(ui.method.value),
  timings: null,        // today's { fajr, maghrib }
  timingsTomorrow: null,
  lastFetchDateKey: null,
  ticker: null,
};

function pad2(n){ return String(n).padStart(2, "0"); }
function dateKeyLocal(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

function formatHMS(totalSeconds){
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

// HH:MM(:SS) parse, saniye varsa yukarı yuvarla (bazı sitelerle 1 dk farkı azaltır)
function normalizeTimeStr(t){
  if(!t) return null;
  const m = String(t).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if(!m) return null;

  let hh = Number(m[1]);
  let mm = Number(m[2]);
  const ss = Number(m[3] || 0);

  if (ss > 0) mm += 1;
  if (mm >= 60){ mm = 0; hh += 1; }
  if (hh >= 24) hh = hh % 24;

  return `${pad2(hh)}:${pad2(mm)}`;
}

function buildDateFromHHMM(baseDate, hhmm){
  const [hh, mm] = hhmm.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(hh, mm, 0, 0);
  return d;
}

function showError(msg){
  ui.errorBox.hidden = !msg;
  ui.errorBox.textContent = msg || "";
}

async function fetchTimingsByGeo(lat, lon, method, date){
  const base = "https://api.aladhan.com/v1";
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    method: String(method)
  });
  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth()+1);
  const yyyy = date.getFullYear();
  const url = `${base}/timings/${dd}-${mm}-${yyyy}?${params.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`API hata: ${res.status}`);
  const json = await res.json();
  if(json.code !== 200) throw new Error(`API cevap hatası: ${json.status || "unknown"}`);
  return json.data;
}

async function fetchTimingsByCity(city, country, method, date){
  const base = "https://api.aladhan.com/v1";
  const params = new URLSearchParams({ city, country, method: String(method) });
  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth()+1);
  const yyyy = date.getFullYear();
  const url = `${base}/timingsByCity/${dd}-${mm}-${yyyy}?${params.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`API hata: ${res.status}`);
  const json = await res.json();
  if(json.code !== 200) throw new Error(`API cevap hatası: ${json.status || "unknown"}`);
  return json.data;
}

function prettyLocationLine(){
  if(state.mode === "city") return `${state.city}, ${state.country}`;
  if(state.mode === "geo") return `Konumdan alındı`;
  return "Konum seçilmedi";
}

function setDateLine(d){
  const readable = new Intl.DateTimeFormat("tr-TR", {
    year: "numeric", month: "long", day: "2-digit", weekday: "long"
  }).format(d);
  ui.dateLine.textContent = readable;
}

async function loadTimings(){
  showError("");

  state.method = Number(ui.method.value);

  const now = new Date();
  const todayKey = dateKeyLocal(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  ui.nextTitle.textContent = "Vakitler alınıyor…";
  ui.countdown.textContent = "--:--:--";
  ui.nextTime.textContent = "--:--";
  ui.locationLine.textContent = "Yükleniyor…";

  let todayData, tomorrowData;

  if(state.mode === "geo"){
    todayData = await fetchTimingsByGeo(state.lat, state.lon, state.method, now);
    tomorrowData = await fetchTimingsByGeo(state.lat, state.lon, state.method, tomorrow);
  }else if(state.mode === "city"){
    todayData = await fetchTimingsByCity(state.city, state.country, state.method, now);
    tomorrowData = await fetchTimingsByCity(state.city, state.country, state.method, tomorrow);
  }else{
    throw new Error("Konum modu yok");
  }

  const fajr = normalizeTimeStr(todayData.timings.Fajr);
  const maghrib = normalizeTimeStr(todayData.timings.Maghrib);
  const fajr2 = normalizeTimeStr(tomorrowData.timings.Fajr);
  const maghrib2 = normalizeTimeStr(tomorrowData.timings.Maghrib);

  if(!fajr || !maghrib || !fajr2 || !maghrib2){
    throw new Error("Vakitler okunamadı (Fajr/Maghrib eksik)");
  }

  state.timings = { fajr, maghrib };
  state.timingsTomorrow = { fajr: fajr2, maghrib: maghrib2 };
  state.lastFetchDateKey = todayKey;

  ui.iftarToday.textContent = maghrib;
  ui.imsakToday.textContent = fajr;
  ui.locationLine.textContent = prettyLocationLine();
  setDateLine(now);

  startTicker();
}

function getArcLength(){
  try{ return ui.arcFg.getTotalLength(); }
  catch{ return 700; }
}
function setProgress01(p){
  const clamped = Math.max(0, Math.min(1, p));
  const len = getArcLength();
  ui.arcFg.style.strokeDasharray = String(len);
  ui.arcFg.style.strokeDashoffset = String(len * (1 - clamped));
}

function computeSchedule(now){
  const today = new Date(now);
  const fajrToday = buildDateFromHHMM(today, state.timings.fajr);
  const maghribToday = buildDateFromHHMM(today, state.timings.maghrib);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const fajrTomorrow = buildDateFromHHMM(tomorrow, state.timingsTomorrow.fajr);

  if(now < fajrToday){
    const start = new Date(today);
    start.setHours(0,0,0,0);
    return { kind:"imsak", label:"İmsaka kalan süre", start, target:fajrToday, targetHHMM: state.timings.fajr };
  }
  if(now < maghribToday){
    return { kind:"iftar", label:"İftara kalan süre", start:fajrToday, target:maghribToday, targetHHMM: state.timings.maghrib };
  }
  return { kind:"imsak", label:"İmsaka kalan süre", start:maghribToday, target:fajrTomorrow, targetHHMM: state.timingsTomorrow.fajr };
}

function startTicker(){
  if(state.ticker) clearInterval(state.ticker);

  const tick = async () => {
    if(!state.timings || !state.timingsTomorrow) return;

    const now = new Date();

    const key = dateKeyLocal(now);
    if(state.lastFetchDateKey && key !== state.lastFetchDateKey){
      try{ await loadTimings(); } catch(e){ showError(String(e.message || e)); }
      return;
    }

    const sch = computeSchedule(now);

    ui.nextTitle.textContent = sch.label;
    ui.nextTitle.setAttribute("data-glitch", sch.label);
    ui.nextTime.textContent = sch.targetHHMM;
    setDateLine(now);

    const totalSec = Math.max(1, (sch.target - sch.start) / 1000);
    const leftSec = Math.max(0, (sch.target - now) / 1000);

    ui.countdown.textContent = formatHMS(leftSec);

    const doneSec = totalSec - leftSec;
    const progress = doneSec / totalSec;
    setProgress01(progress);

    const pct = Math.round(progress * 100);
    const minsLeft = Math.ceil(leftSec / 60);

    ui.progressHint.textContent = `${pct}% • ~${minsLeft} dk`;
    ui.modeBadge.textContent = sch.kind === "iftar" ? "IFTAR" : "IMSAK";
  };

  tick();
  state.ticker = setInterval(tick, 1000);
}

function getGeo(){
  return new Promise((resolve, reject) => {
    if(!navigator.geolocation){
      reject(new Error("Tarayıcı konum özelliği desteklemiyor"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => {
        let msg;
        switch(err.code){
          case 1: msg = "Konum izni reddedildi. Lütfen tarayıcı ayarlarından konum iznini açın."; break;
          case 2: msg = "Konum bilgisi alınamadı. İnternet bağlantınızı kontrol edin."; break;
          case 3: msg = "Konum isteği zaman aşımına uğradı. Lütfen tekrar deneyin."; break;
          default: msg = err.message || "Konum alınamadı";
        }
        reject(new Error(msg));
      },
      { enableHighAccuracy: false, timeout: 25000, maximumAge: 600000 }
    );
  });
}

async function useGeo(){
  state.mode = "geo";
  ui.locationLine.textContent = "Konum alınıyor…";
  const coords = await getGeo();
  state.lat = coords.latitude;
  state.lon = coords.longitude;
  await loadTimings();
}

async function useCity(){
  // blur inputs so mobile keyboards commit autocomplete/pending values
  ui.city.blur();
  ui.country.blur();
  const city = ui.city.value.trim();
  const country = ui.country.value.trim();
  if(!city && !country) throw new Error("Şehir ve ülke alanlarını doldurun");
  if(!city) throw new Error("Şehir alanını doldurun");
  if(!country) throw new Error("Ülke alanını doldurun");

  state.mode = "city";
  state.city = city;
  state.country = country;
  await loadTimings();
}

/* ---------- FUN FX: ripple on buttons ---------- */
function enableRipple(){
  document.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("pointerdown", (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const s = Math.max(r.width, r.height) * 1.2;

      const el = document.createElement("span");
      el.style.position = "absolute";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.width = `${s}px`;
      el.style.height = `${s}px`;
      el.style.transform = "translate(-50%,-50%) scale(0)";
      el.style.borderRadius = "999px";
      el.style.background = "rgba(255,255,255,.22)";
      el.style.filter = "blur(.2px)";
      el.style.pointerEvents = "none";
      el.style.transition = "transform 520ms cubic-bezier(.16,.92,.24,1), opacity 520ms";
      el.style.opacity = "1";
      btn.appendChild(el);

      requestAnimationFrame(() => {
        el.style.transform = "translate(-50%,-50%) scale(1)";
        el.style.opacity = "0";
      });

      setTimeout(() => el.remove(), 560);
    });
  });
}

/* ---------- FUN FX: tilt ---------- */
function enableTilt(){
  // Disable tilt on touch devices – the 3D transform during touch
  // shifts button/input positions and breaks tap interactions.
  if("ontouchstart" in window || navigator.maxTouchPoints > 0) return;

  const els = document.querySelectorAll("[data-tilt]");
  const max = 10; // degrees
  els.forEach(el => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;  // 0..1
      const py = (e.clientY - r.top) / r.height;  // 0..1
      const rx = (py - 0.5) * -2 * max;
      const ry = (px - 0.5) *  2 * max;
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)";
    });
  });
}

/* ---------- FUN FX: particles canvas ---------- */
function startParticles(){
  const c = ui.fxCanvas;
  if(!c) return;
  const ctx = c.getContext("2d", { alpha: true });

  let w = 0, h = 0, dpr = 1;
  function resize(){
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);
    c.width = Math.floor(w * dpr);
    c.height = Math.floor(h * dpr);
    c.style.width = w + "px";
    c.style.height = h + "px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  window.addEventListener("resize", resize);

  const N = Math.min(140, Math.floor((w*h)/12000));
  const parts = Array.from({length:N}, () => ({
    x: Math.random()*w,
    y: Math.random()*h,
    r: 0.8 + Math.random()*1.8,
    vx: (-0.25 + Math.random()*0.5),
    vy: (0.10 + Math.random()*0.45),
    a: 0.06 + Math.random()*0.10,
    hue: 170 + Math.random()*120
  }));

  function line(p,q){
    const dx = p.x-q.x, dy = p.y-q.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if(dist > 130) return;
    const alpha = (1 - dist/130) * 0.10;
    ctx.strokeStyle = `rgba(106,166,255,${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
    ctx.lineTo(q.x,q.y);
    ctx.stroke();
  }

  function tick(){
    ctx.clearRect(0,0,w,h);

    for(let i=0;i<parts.length;i++){
      const p = parts[i];
      p.x += p.vx;
      p.y += p.vy;

      if(p.x < -50) p.x = w+50;
      if(p.x > w+50) p.x = -50;
      if(p.y > h+60) p.y = -60;

      ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fill();

      for(let j=i+1;j<parts.length;j++){
        line(p, parts[j]);
      }
    }

    requestAnimationFrame(tick);
  }
  tick();
}

/* ---------- UI Events ---------- */
ui.btnGeo.addEventListener("click", async () => {
  if(ui.btnGeo.disabled) return;
  ui.btnGeo.disabled = true;
  ui.btnGeo.textContent = "Konum alınıyor…";
  try{ await useGeo(); }
  catch(e){
    showError(String(e.message || e));
    ui.locationLine.textContent = "Konum alınamadı";
  }
  finally{
    ui.btnGeo.disabled = false;
    ui.btnGeo.textContent = "Konumdan Bul";
  }
});

ui.btnCity.addEventListener("click", async () => {
  if(ui.btnCity.disabled) return;
  ui.btnCity.disabled = true;
  ui.btnCity.textContent = "Aranıyor…";
  try{ await useCity(); }
  catch(e){ showError(String(e.message || e)); }
  finally{
    ui.btnCity.disabled = false;
    ui.btnCity.textContent = "Şehir/Ülke ile Bul";
  }
});

ui.btnRefresh.addEventListener("click", async () => {
  if(ui.btnRefresh.disabled) return;
  ui.btnRefresh.disabled = true;
  try{
    if(!state.mode) throw new Error("Önce konum seç");
    await loadTimings();
  }catch(e){ showError(String(e.message || e)); }
  finally{
    ui.btnRefresh.disabled = false;
  }
});

ui.method.addEventListener("change", async () => {
  try{
    if(!state.mode) return;
    await loadTimings();
  }catch(e){ showError(String(e.message || e)); }
});

/* ---------- Boot ---------- */
(function boot(){
  ui.locationLine.textContent = "Konum seç: Konumdan Bul veya Şehir/Ülke";
  ui.nextTitle.textContent = "Konum seç";
  ui.nextTitle.setAttribute("data-glitch", "Konum seç");
  ui.countdown.textContent = "--:--:--";
  ui.nextTime.textContent = "--:--";
  setProgress01(0);

  enableRipple();
  enableTilt();
  startParticles();
})();