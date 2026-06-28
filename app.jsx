// ════════════════════════════════════════════════════════════════════════════
//  iNDEED — Life System  (rebuilt from "Aura Workspace")
//  ----------------------------------------------------------------------------
//  This file is PRE-COMPILED plain JS in the shipped HTML (no Babel at
//  runtime). This .jsx copy is the readable source — re-run the build step
//  described in SETUP.md any time you edit it.
//
//  Search for "TODO(SETUP)" for the only things that need your own values
//  (Firebase project config). Everything else works out of the box.
// ════════════════════════════════════════════════════════════════════════════
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── FIREBASE CONFIG ──────────────────────────────────────────────────────────
// TODO(SETUP): paste your real config from Firebase Console → Project
// Settings → General → "Your apps" → Web app → SDK setup & config.
// Until you do this, FIREBASE_CONFIGURED is false and the app runs in
// "local mode": fully working, data saved to this browser's localStorage.
// The moment you fill this in (and enable Google sign-in + Firestore in the
// console — see SETUP.md), the app switches to cloud mode automatically.
const FIREBASE_CONFIG = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID",
};
const FIREBASE_CONFIGURED = !!(FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith("PASTE_"));

let fbAuth = null, fbDb = null;
if (FIREBASE_CONFIGURED && window.firebase) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    // Best-effort offline cache; harmless if unsupported.
    fbDb.enablePersistence && fbDb.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  } catch (e) {
    console.error("Firebase init failed:", e);
  }
}

// ── LIVE DATE ─────────────────────────────────────────────────────────────────
// BUG FIX #1 & #5: nothing here is computed once at module load anymore.
// getNow() is always a fresh Date(). useNow() (defined further down, inside
// the component tree) re-renders the app on an interval AND whenever the tab
// regains focus/visibility, so "today" self-corrects even if the tab was left
// open and asleep across midnight — no manual refresh required.
function getNow() { return new Date(); }

// ── MONTHS — generated per year, not hardcoded to 2026 ──────────────────────
// BUG FIX #1 (continued): year is a real parameter everywhere now, and
// February's day count is computed correctly for leap years instead of being
// a fixed "28".
const MONTH_META = [
  { n:1,  label:"January",   short:"JAN" },
  { n:2,  label:"February",  short:"FEB" },
  { n:3,  label:"March",     short:"MAR" },
  { n:4,  label:"April",     short:"APR" },
  { n:5,  label:"May",       short:"MAY" },
  { n:6,  label:"June",      short:"JUN" },
  { n:7,  label:"July",      short:"JUL" },
  { n:8,  label:"August",    short:"AUG" },
  { n:9,  label:"September", short:"SEP" },
  { n:10, label:"October",   short:"OCT" },
  { n:11, label:"November",  short:"NOV" },
  { n:12, label:"December",  short:"DEC" },
];
function daysInMonth(year, monthN) { return new Date(year, monthN, 0).getDate(); } // leap-year safe
function getMonthsForYear(year) { return MONTH_META.map(m => ({ ...m, days: daysInMonth(year, m.n) })); }

// Cell state relative to the REAL current date — "past" | "today" | "future"
function dayState(year, monthN, dayN) {
  const now = getNow();
  const ty = now.getFullYear(), tm = now.getMonth() + 1, td = now.getDate();
  if (year < ty) return "past";
  if (year > ty) return "future";
  if (monthN < tm) return "past";
  if (monthN > tm) return "future";
  if (dayN < td) return "past";
  if (dayN === td) return "today";
  return "future";
}

// Re-renders consumers on a tick AND on tab refocus/visibility change.
function useNow() {
  const [now, setNow] = useState(() => getNow());
  useEffect(() => {
    const tick = () => setNow(getNow());
    const t = setInterval(tick, 30000); // 30s is plenty for a day/clock display
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); window.removeEventListener("focus", tick); };
  }, []);
  return now;
}

// ── THEMES ────────────────────────────────────────────────────────────────────
const THEMES = [
  { id:"cyber",  name:"Cyber Lime",    acc:"#c8f135", acc2:"#ff6b35", bg:"#050508", dim:"rgba(200,241,53,.14)",  glow:"rgba(200,241,53,.22)"  },
  { id:"void",   name:"Void Violet",   acc:"#a78bfa", acc2:"#f59e0b", bg:"#05050c", dim:"rgba(167,139,250,.16)", glow:"rgba(167,139,250,.28)" },
  { id:"tokyo",  name:"Tokyo Crimson", acc:"#f43f5e", acc2:"#8b5cf6", bg:"#060305", dim:"rgba(244,63,94,.16)",  glow:"rgba(244,63,94,.28)"  },
  { id:"ocean",  name:"Deep Ocean",    acc:"#22d3ee", acc2:"#f59e0b", bg:"#020810", dim:"rgba(34,211,238,.14)", glow:"rgba(34,211,238,.24)"  },
];

// ── SCHEMA ────────────────────────────────────────────────────────────────────
// Content is unchanged from the original build, except timeline items now
// carry a stable `id` (used as the key for per-item reminder offsets and
// label overrides, so they survive even if you reorder the list later).
const SCHEMA = {
  quote:{ text:"Not every beautiful thing is beautiful. Overdose can harm even if it is of anything.", context:"System Anchor Manifesto // 2:38 AM" },
  metrics:{ activeDays:22, bufferDays:"7–9", rule:"3D Min Rule", bulkGoal:"+3kg Growth" },
  hierarchies:[
    { rank:"01", icon:"fa-person",   category:"Core Asset — Self",           metrics:"Physical optimization, sleep integrity, recovery balance. Always first." },
    { rank:"02", icon:"fa-microchip",category:"Cognitive Engine — Studies",  metrics:"Advanced DSA, security blueprints, algorithmic architecture." },
    { rank:"03", icon:"fa-link",     category:"Unified Relationship Link",   metrics:"9:30 PM – 11:30 PM dedicated block. Terminal link severance at 11:30 PM sharp." },
  ],
  timeline:[
    { id:"t1",  time:"06:30", action:"Wake Up & Hydrate Engine",         group:"somatic",       details:"Purified fluid intake. Raw sprouted moong and chana initialization. Clean metabolic fuel." },
    { id:"t2",  time:"06:45", action:"Calisthenics Split Routine",       group:"somatic",       details:"40-min structural layout. Concentrated splits. Total muscle density focus." },
    { id:"t3",  time:"07:30", action:"Nutritional Restoration Intake",   group:"somatic",       details:"High-calorie optimization. Full baseline meal. Add ghee to drive caloric surplus." },
    { id:"t4",  time:"09:00", action:"Functional Transit Interval",      group:"transit",       details:"Low-intensity steady-state cardio. Intentional walk for metabolic activation." },
    { id:"t5",  time:"13:30", action:"Midday Macro Fuel & Rest",         group:"somatic",       details:"Targeted protein booster. Balanced hydration. Physiological decompression." },
    { id:"t6",  time:"15:30", action:"Technical Library Focus Sequence", group:"cognitive",     details:"Deep structural DSA blocks. Zero notifications. Algorithm construction window." },
    { id:"t7",  time:"17:30", action:"System Return & Decompression",    group:"somatic",       details:"Cognitive reset. Short 20-min neurological nap if brain fatigue triggers." },
    { id:"t8",  time:"20:00", action:"Caloric Consolidation Dinner",     group:"somatic",       details:"Double macro portions. High-density intake targeting muscle volume scaling." },
    { id:"t9",  time:"20:40", action:"Skill Acquisition Sprint",         group:"cognitive",     details:"Mon/Wed/Fri: Video Post-Processing. Sun: GPU Architecture. Alt: Security track." },
    { id:"t10", time:"21:30", action:"Unified Connection Window",        group:"interpersonal", details:"Dedicated conversation block. Undivided presence. Earned cognitive reward." },
    { id:"t11", time:"23:30", action:"Hard Link Severance & Sleep Lock", group:"somatic",       details:"Non-negotiable terminal sleep protocol. Full device shutdown. Cellular repair." },
  ],
  sundays:[
    { phase:"Morning",   title:"Active Kinetic Recovery",       info:"Low stress loads. Flexibility, mobility expansion, optimized breathing." },
    { phase:"Afternoon", title:"Algorithmic Concept Sandbox",   info:"Practical synthesis of weekly frameworks. Test deep algorithmic logic." },
    { phase:"Afternoon", title:"Parallel Architecture Analysis",info:"45-min into parallel processing paradigms and device execution logic." },
    { phase:"Evening",   title:"System Performance Journaling", info:"20-min raw telemetry review. Isolate bottlenecks, clean behavioral metrics." },
    { phase:"Night",     title:"Interpersonal Reset",           info:"Full psychological unwinding. Strictly enforce 11:30 PM closure." },
  ],
  nutritionalUnits:[
    { element:"🌱 Sprouted Moong/Chana", strategy:"Prepared nightly. Consumed post-waking. Bio-available amino acids and early metabolic fuel injection." },
    { element:"🍛 Volumetric Macro Base",strategy:"Maximized intake protocols. Double macro distributions. Never end below full density parameters." },
    { element:"🥛 Cultured Fluid Hydrator",strategy:"Minimum single daily dose. Optimizes gut microbiome, speeds calorie absorption." },
    { element:"💛 Pure Ghee — Caloric Weapon",strategy:"High-potency kinetic fuel. Added across carb and protein portions to amplify density benchmarks." },
    { element:"💪 Volume Loading Phases",strategy:"High-protein recovery sequences during hyper-growth windows. Double standard portions in targeted meals." },
    { element:"💧 Mineralized Hydration",strategy:"3–4 litres precise daily. High humidity depletes minerals exponentially. Continuous saturation mandatory." },
  ],
  cognitiveRoadmap:{
    dsa:[
      { unit:"Week 01", focus:"Array Implementations & Multi-Pointer Tactics",    overview:"Iterative search logic, two-pointer boundaries, sliding windows, linear memory optimization." },
      { unit:"Week 02", focus:"Linked Structural Architectures",                   overview:"Singly and doubly linked layouts, pointer routines, loop detection, stack nodes." },
      { unit:"Week 03", focus:"Hierarchical Tree & Search Layouts",               overview:"Binary trees, DFS/BFS mechanics, recursion tracking, lookup validation." },
      { unit:"Week 04", focus:"Complex Partitioning & Search Strategy",           overview:"Logarithmic lookup, quick/merge sorts, divide-and-conquer, sorting boundary management." },
    ],
    security:[
      { unit:"Week 01", focus:"Framework Blueprint Selection",       focusDetails:"Finalize certification blueprint tracks mapping network control fundamentals." },
      { unit:"Week 02", focus:"Core Security Domain Overviews",      focusDetails:"Logical access paradigms, security topologies, and cryptographic foundations." },
      { unit:"Week 03", focus:"Diagnostic Assessments & Mock Trials",focusDetails:"Simulated diagnostics. Isolate gaps, analyze errors, study failed concepts." },
      { unit:"Week 04", focus:"Final Polish & Certification Prep",   focusDetails:"Summary blueprints, high-velocity flashcard reviews, definitive assessment matrix." },
    ],
  },
  operationalRules:[
    { directive:"Primal Instinct Monitoring",      operationalization:"Emotions occur normally. Mastery = conscious awareness without assigning steering access to them." },
    { directive:"11:30 PM Device Isolation",       operationalization:"Regardless of dopamine loops. Growth metrics take supreme leverage over micro-impulses." },
    { directive:"Non-Linear Pivot Recalibration",  operationalization:"When steps slip, initiate corrective measures instantly. Avoid guilt spirals. Execute immediately." },
  ],
  weatherTips:{
    sunny:   ["☀️ Elevate hydration to 4.5L immediately during peak temperature hours.","☀️ Consume post-workout sprouts while cool to regulate internal core body heat.","☀️ Use the 09:00 AM walk to gather solar timing cues for circadian alignment."],
    rainy:   ["🌧️ Monsoon Override: Swap outdoor walks to indoor calisthenics sets.","🌧️ Check meal temperatures carefully — high-moisture seasons carry elevated microbial loads.","🌧️ Leverage ambient rain signatures to drive deep technical focus blocks."],
    stormy:  ["⚡ Secure electronic hardware during DSA code sequences to prevent voltage flux.","⚡ Brighten workspace screens artificially to maintain energy markers in cloud cover.","⚡ High-isolation environment — run extended literature analysis tracks."],
    overcast:["☁️ Increase morning explosive output to trigger strong early adrenaline markers.","☁️ Overcast skies minimize glare — excellent for uninterrupted long-form screen sessions.","☁️ Low sunlight masks sweat output — maintain mineralized fluid schedule strictly."],
  },
  defaultTrackers:[
    { key:"calisthenics", title:"Functional Calisthenics",    brief:"40m daily physical split matrix" },
    { key:"dsa",          title:"DSA Architecture Engine",    brief:"Zero → Week 4 algorithmic targets" },
    { key:"literature",   title:"Workspace Reading",          brief:"30m Kevin Mitnick analysis log" },
    { key:"nutritional",  title:"Hyper-Caloric Bulking Track",brief:"Sprouts, double macros, ghee deployment" },
  ],
};

const GI = { somatic:"fa-heart-pulse", cognitive:"fa-brain", transit:"fa-person-walking", interpersonal:"fa-comments" };
const GC = { somatic:"text-emerald-400 bg-emerald-950/30 border-emerald-900", cognitive:"text-blue-400 bg-blue-950/30 border-blue-900", transit:"text-amber-400 bg-amber-950/30 border-amber-900", interpersonal:"text-purple-400 bg-purple-950/30 border-purple-900" };

// ── EDITABLE LABELS ───────────────────────────────────────────────────────────
// NEW FEATURE: every string here can be changed by the user from
// Settings → Customize Labels, with no code edits. Tracker names are edited
// from the existing "Manage Trackers" modal (now with a rename option) since
// they already live in their own persisted list.
const DEFAULT_LABELS = {
  appName: "iNDEED",
  tagline: "Performance Framework — All Year",
  nav: {
    "control-room":    "Control Room",
    "timeline-map":    "Daily Execution",
    "matrix-31":       "Month Matrix",
    "knowledge-vault": "Skill Forge",
    "somatic-bulk":    "Somatic & Mass",
    "settings":        "Settings",
  },
  headings: {
    "control-room":    "System Core Manifesto",
    "timeline-map":    "Daily Execution Flow",
    "matrix-31":       "Habit Matrix",
    "knowledge-vault": "Skill & Knowledge Forge",
    "somatic-bulk":    "Somatic Volume & Mass Blueprint",
  },
  // keyed by SCHEMA.timeline[].id — overrides the default `action` text
  timelineActions: {},
};

function mergeLabels(saved) {
  if (!saved) return JSON.parse(JSON.stringify(DEFAULT_LABELS));
  return {
    appName: saved.appName || DEFAULT_LABELS.appName,
    tagline: saved.tagline || DEFAULT_LABELS.tagline,
    nav: { ...DEFAULT_LABELS.nav, ...(saved.nav||{}) },
    headings: { ...DEFAULT_LABELS.headings, ...(saved.headings||{}) },
    timelineActions: { ...DEFAULT_LABELS.timelineActions, ...(saved.timelineActions||{}) },
  };
}

// ── DATA LAYER ───────────────────────────────────────────────────────────────
// Everything else in the app reads/writes through this layer only — it never
// touches localStorage or Firestore directly. That means once Firebase is
// configured, nothing in the component below needs to change.
//
// LOCAL MODE (no Firebase config yet): localStorage, keys prefixed "indeed-".
// CLOUD MODE (Firebase configured + signed in): Firestore at
//   users/{uid}/app/settings           → theme, trackers, labels, alarmOn,
//                                         reminderOffsets, weatherCity
//   users/{uid}/months/{year}-{monthN} → { cells: { "trackerKey-day": status } }
// — matching the "documents keyed by year-month" structure, and scoped so the
// security rules (see firestore.rules) only ever let a uid touch its own data.

const LOCAL_PREFIX = "indeed-";

function localGet(key, fallback) {
  try { const raw = localStorage.getItem(LOCAL_PREFIX + key); return raw != null ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function localSet(key, value) {
  try { localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value)); } catch {}
}

// One-time migration from the previous "Aura Workspace" build's "aw-" keys,
// so renaming the app doesn't lose anyone's existing local history.
function migrateLegacyLocalData() {
  if (localStorage.getItem(LOCAL_PREFIX + "migrated")) return;
  const map = { theme:"aw-theme", trackers:"aw-trackers", matrix:"aw-matrix" };
  Object.entries(map).forEach(([newKey, oldKey]) => {
    const old = localStorage.getItem(oldKey);
    if (old != null) { try { localStorage.setItem(LOCAL_PREFIX + newKey, old); } catch {} }
  });
  const oldAlarm = localStorage.getItem("aw-alarm");
  if (oldAlarm != null) localSet("alarmOn", oldAlarm !== "false");
  try { localStorage.setItem(LOCAL_PREFIX + "migrated", "1"); } catch {}
}

// BUG FIX #2: year is now part of the matrix cell key, so the same month
// number in different years can no longer collide/overwrite each other.
const cellKey = (year, monthN, trackerKey, day) => `${year}-${monthN}-${trackerKey}-${day}`;
function matrixKeyParts(k) {
  const parts = k.split("-");
  return { ym: parts[0] + "-" + parts[1], rest: parts.slice(2).join("-") };
}
function splitMatrixByMonth(matrix) {
  const buckets = {};
  Object.entries(matrix).forEach(([k, v]) => {
    const { ym, rest } = matrixKeyParts(k);
    if (!buckets[ym]) buckets[ym] = {};
    buckets[ym][rest] = v;
  });
  return buckets;
}
function mergeMonthDocsIntoMatrix(docs) {
  const matrix = {};
  docs.forEach(doc => { Object.entries(doc.cells || {}).forEach(([rest, v]) => { matrix[`${doc.id}-${rest}`] = v; }); });
  return matrix;
}

// Firestore helpers (only ever called when fbDb is initialized & a uid exists)
async function fsLoadSettings(uid) {
  const snap = await fbDb.collection("users").doc(uid).collection("app").doc("settings").get();
  return snap.exists ? snap.data() : null;
}
async function fsSaveSettings(uid, data) {
  await fbDb.collection("users").doc(uid).collection("app").doc("settings").set(data);
}
async function fsLoadAllMonths(uid) {
  const snap = await fbDb.collection("users").doc(uid).collection("months").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function fsSaveMonth(uid, ym, cells) {
  // Full overwrite of that month's cell map (small payload — at most a few
  // hundred entries) rather than a partial merge, to avoid any ambiguity
  // around Firestore's nested-map merge behavior.
  await fbDb.collection("users").doc(uid).collection("months").doc(ym).set({ cells, updatedAt: Date.now() });
}

// ── EXPORT / IMPORT ──────────────────────────────────────────────────────────
// NEW FEATURE: lets you back up everything to a JSON file before any
// destructive action, and restore it again later (same device, another
// device, or after switching between local/cloud mode).
function exportAllData(state) {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: "iNDEED",
    version: 1,
    theme: state.theme,
    trackers: state.trackers,
    matrix: state.matrix,
    labels: state.labels,
    alarmOn: state.alarmOn,
    reminderOffsets: state.reminderOffsets,
    weatherCity: state.weatherCity,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `indeed-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importAllDataFromFile(file, onLoaded, onError) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== "object") throw new Error("Not a valid backup file.");
      onLoaded(data);
    } catch (e) { onError(e); }
  };
  reader.onerror = () => onError(new Error("Could not read file."));
  reader.readAsText(file);
}

// ── NOTIFICATIONS ────────────────────────────────────────────────────────────
// NEW FEATURE: real Notification API + Service Worker reminders, with a
// custom lead time per timeline item (0 = at the exact time, or N minutes
// before).
//
// HONEST SCOPE: this fires reliably any time the browser/PWA process is
// alive — foregrounded, backgrounded, screen off but not killed. It cannot
// guarantee delivery if the app/browser has been fully force-closed,
// especially on iOS — no client-only website can do that; the only way to
// guarantee delivery to a fully closed app is real push (Firebase Cloud
// Messaging) triggered by a server, which needs backend infrastructure
// beyond a single static file. sw.js already has a `push` handler ready to
// go the day you add that.
async function registerAppSW() {
  if (!("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("sw.js"); }
  catch (e) { console.error("Service worker registration failed:", e); return null; }
}

function fireNotification(title, body, swReg) {
  const opts = { body, vibrate: [200, 80, 200], tag: title };
  try {
    if (swReg && swReg.showNotification) swReg.showNotification(title, opts);
    else if (window.Notification && Notification.permission === "granted") new Notification(title, opts);
  } catch (e) { console.error("Notification failed:", e); }
}

const REMINDER_CHOICES = [
  { v:0,  label:"At the exact time" },
  { v:10, label:"10 min before" },
  { v:30, label:"30 min before" },
  { v:60, label:"1 hour before" },
];

// ── APP ───────────────────────────────────────────────────────────────────────
function App() {
  const now = useNow();
  const todayY = now.getFullYear(), todayM = now.getMonth() + 1, todayD = now.getDate();

  // ── Auth (only meaningful if Firebase is configured) ──────────────────────
  const [authLoading, setAuthLoading] = useState(FIREBASE_CONFIGURED);
  const [user, setUser] = useState(null);
  const dataMode = (FIREBASE_CONFIGURED && user) ? "cloud" : "local";
  const [dataLoaded, setDataLoaded] = useState(!FIREBASE_CONFIGURED);

  useEffect(() => {
    if (!FIREBASE_CONFIGURED) return;
    const unsub = fbAuth.onAuthStateChanged(u => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    try { await fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch (e) { push("❌ Sign-in failed: " + (e.message || "unknown error"), "error"); }
  }, []);
  const signOutUser = useCallback(async () => {
    try { await fbAuth.signOut(); setDataLoaded(false); }
    catch (e) {}
  }, []);

  // ── Persisted state — initialised from localStorage (instant, local mode
  // default); overwritten from Firestore once cloud data finishes loading. ──
  useEffect(() => { migrateLegacyLocalData(); }, []);

  const [theme, setTheme]   = useState(() => localGet("theme", THEMES[0]));
  const [trackers, setTrackers] = useState(() => localGet("trackers", SCHEMA.defaultTrackers));
  const [matrix, setMatrix] = useState(() => localGet("matrix", {}));
  const [labels, setLabels] = useState(() => mergeLabels(localGet("labels", null)));
  const [alarmOn, setAlarmOn] = useState(() => localGet("alarmOn", true));
  const [reminderOffsets, setReminderOffsets] = useState(() => localGet("reminderOffsets", {}));
  const [weatherCity, setWeatherCity] = useState(() => localGet("weatherCity", ""));

  // Year + month selection — defaults to the real current year/month.
  const [selectedYear, setSelectedYear] = useState(todayY);
  const months = useMemo(() => getMonthsForYear(selectedYear), [selectedYear]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const init = getMonthsForYear(todayY);
    return init.find(m => m.n === todayM) || init[0];
  });
  // Keep day-count correct if the year changes (matters only for Feb in leap years).
  useEffect(() => { setSelectedMonth(sm => ({ ...sm, days: daysInMonth(selectedYear, sm.n) })); }, [selectedYear]);

  // Nav
  const [nav, setNav] = useState("control-room");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [newLabel, setNewLabel] = useState("");

  // Weather
  const [geoStatus, setGeoStatus] = useState("idle"); // idle|asking|loading|ok|denied|error
  const [weather, setWeather] = useState({ cond:"—", temp:null, humidity:null, location:null, label:"Not yet loaded" });
  const [weatherModal, setWeatherModal] = useState(false);
  const [cityInput, setCityInput] = useState("");

  // Clock (kept for the existing demo/simulate feature — unrelated to the
  // real reminder engine below, which always uses the real clock).
  const [realTime, setRealTime] = useState(() => new Date());
  const [simTime, setSimTime]   = useState("15:30");
  const [isSim, setIsSim]       = useState(false);
  const firedAlarms = useRef(new Set());     // for the simulate-mode demo overlay
  const firedReal   = useRef(new Set());     // for real-time notifications
  const swReg        = useRef(null);

  const [alarmOverlay, setAlarmOverlay] = useState(null);
  const [notifPermission, setNotifPermission] = useState(window.Notification ? Notification.permission : "unsupported");

  const [toasts, setToasts] = useState([]);
  const [trackerModal, setTrackerModal] = useState(false);
  const [monthModal, setMonthModal]     = useState(false);
  const [importBusy, setImportBusy]     = useState(false);

  // ── Toasts ─────────────────────────────────────────────────────────────────
  const push = useCallback((msg, type="info") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-4), { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dropToast = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // ── CLOUD LOAD — runs once when a user signs in ───────────────────────────
  useEffect(() => {
    if (dataMode !== "cloud" || dataLoaded) return;
    (async () => {
      try {
        const [settings, monthDocs] = await Promise.all([fsLoadSettings(user.uid), fsLoadAllMonths(user.uid)]);
        if (settings) {
          if (settings.theme) setTheme(settings.theme);
          if (settings.trackers) setTrackers(settings.trackers);
          if (settings.labels) setLabels(mergeLabels(settings.labels));
          if (typeof settings.alarmOn === "boolean") setAlarmOn(settings.alarmOn);
          if (settings.reminderOffsets) setReminderOffsets(settings.reminderOffsets);
          if (typeof settings.weatherCity === "string") setWeatherCity(settings.weatherCity);
        }
        setMatrix(mergeMonthDocsIntoMatrix(monthDocs));
        push(`☁️ Signed in as ${user.displayName || user.email}`, "success");
      } catch (e) {
        push("⚠️ Could not load cloud data — check Firestore rules/config.", "error");
      } finally {
        setDataLoaded(true);
      }
    })();
  }, [dataMode, dataLoaded, user]);

  // ── PERSIST — settings bundle (debounced cloud write, instant local mirror) ─
  const settingsTimer = useRef(null);
  useEffect(() => {
    if (!dataLoaded) return; // never write defaults over real cloud data mid-fetch
    const payload = { theme, trackers, labels, alarmOn, reminderOffsets, weatherCity };
    localSet("theme", theme); localSet("trackers", trackers); localSet("labels", labels);
    localSet("alarmOn", alarmOn); localSet("reminderOffsets", reminderOffsets); localSet("weatherCity", weatherCity);
    if (dataMode === "cloud") {
      clearTimeout(settingsTimer.current);
      settingsTimer.current = setTimeout(() => {
        fsSaveSettings(user.uid, payload).catch(() => push("⚠️ Cloud save failed — kept locally.", "error"));
      }, 600);
    }
  }, [theme, trackers, labels, alarmOn, reminderOffsets, weatherCity, dataMode, dataLoaded]);

  // Theme → CSS variables
  useEffect(() => {
    document.documentElement.style.setProperty("--acc",  theme.acc);
    document.documentElement.style.setProperty("--acc2", theme.acc2);
    document.documentElement.style.setProperty("--dim",  theme.dim);
    document.documentElement.style.setProperty("--glow", theme.glow);
    document.documentElement.style.setProperty("--bg",   theme.bg);
    document.body.style.backgroundColor = theme.bg;
  }, [theme]);

  // ── PERSIST — matrix (debounced, split by month for cloud) ────────────────
  const monthTimer = useRef(null);
  const dirtyMonths = useRef(new Set());
  useEffect(() => {
    if (!dataLoaded) return;
    localSet("matrix", matrix);
    if (dataMode !== "cloud") return;
    clearTimeout(monthTimer.current);
    monthTimer.current = setTimeout(() => {
      const buckets = splitMatrixByMonth(matrix);
      const toSave = Array.from(dirtyMonths.current);
      dirtyMonths.current.clear();
      toSave.forEach(ym => { fsSaveMonth(user.uid, ym, buckets[ym] || {}).catch(() => push(`⚠️ Cloud save failed for ${ym}`, "error")); });
    }, 600);
  }, [matrix, dataMode, dataLoaded]);

  // ── Real clock ─────────────────────────────────────────────────────────────
  useEffect(() => { const t = setInterval(() => setRealTime(new Date()), 1000); return () => clearInterval(t); }, []);

  // ── Simulated clock (existing demo feature, unchanged) ─────────────────────
  useEffect(() => {
    if (!isSim) return;
    const t = setInterval(() => {
      setSimTime(prev => {
        const [h, m] = prev.split(":").map(Number);
        let nm = m + 5, nh = h;
        if (nm >= 60) { nm = 0; nh = (h + 1) % 24; }
        return `${String(nh).padStart(2,"0")}:${String(nm).padStart(2,"0")}`;
      });
    }, 900);
    return () => clearInterval(t);
  }, [isSim]);

  useEffect(() => {
    if (!alarmOn || !isSim) return;
    const hit = SCHEMA.timeline.find(t => t.time === simTime);
    if (hit && !firedAlarms.current.has(simTime)) {
      firedAlarms.current.add(simTime);
      setAlarmOverlay(hit);
      push(`⏰ [${hit.time}] ${labels.timelineActions[hit.id] || hit.action}`);
    }
  }, [simTime, alarmOn, isSim, labels]);

  useEffect(() => { if (!isSim) firedAlarms.current.clear(); }, [isSim]);

  // ── Service worker registration (for background-tab notifications) ────────
  useEffect(() => { registerAppSW().then(r => { swReg.current = r; }); }, []);

  // ── REAL-TIME REMINDER ENGINE — uses the actual clock, not the simulator ──
  useEffect(() => {
    if (!alarmOn || notifPermission !== "granted") return;
    const check = () => {
      const t = getNow();
      SCHEMA.timeline.forEach(item => {
        const offset = reminderOffsets[item.id] ?? 0;
        const [ih, im] = item.time.split(":").map(Number);
        const target = new Date(t);
        target.setHours(ih, im, 0, 0);
        target.setMinutes(target.getMinutes() - offset);
        if (target.getHours() === t.getHours() && target.getMinutes() === t.getMinutes()) {
          const fireKey = `${item.id}-${t.toDateString()}-${offset}`;
          if (!firedReal.current.has(fireKey)) {
            firedReal.current.add(fireKey);
            const name = labels.timelineActions[item.id] || item.action;
            fireNotification(offset > 0 ? `In ${offset} min: ${name}` : name, item.details, swReg.current);
            push(`🔔 ${name}`, "info");
          }
        }
      });
    };
    check();
    const t = setInterval(check, 20000);
    return () => clearInterval(t);
  }, [alarmOn, notifPermission, reminderOffsets, labels]);

  const requestNotifPermission = useCallback(async () => {
    if (!window.Notification) { push("❌ Notifications aren't supported in this browser.", "error"); return; }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    push(perm === "granted" ? "🔔 Notifications enabled." : "🔕 Notifications blocked.", perm === "granted" ? "success" : "error");
  }, []);

  const sendTestNotification = useCallback(() => {
    fireNotification("iNDEED test reminder", "If you can see this, real reminders will work too.", swReg.current);
  }, []);

  // ── WEATHER — shared "apply result" step for both geolocation & manual city ─
  const applyWeatherFromCode = useCallback((code, tempC, hum, loc) => {
    let cond = "sunny", label = "Clear Skies";
    if ([51,53,55,61,63,65,80,81,82].includes(code)) { cond = "rainy"; label = "Regional Monsoon"; }
    else if ([71,73,75,77,85,86,95,96,99].includes(code)) { cond = "stormy"; label = "Atmospheric Instability"; }
    else if ([1,2,3,45,48].includes(code)) { cond = "overcast"; label = "Suppressed Exposure"; }
    setWeather({ cond, temp: `${tempC}°C`, humidity: hum ? `${hum}%` : "—", location: loc, label });
    setGeoStatus("ok");
  }, []);

  const extractHumidity = (wData) => {
    const hIdx = (wData.hourly?.time || []).indexOf((wData.current_weather?.time || "").substring(0,13) + ":00");
    return hIdx >= 0 ? wData.hourly?.relative_humidity_2m?.[hIdx] : null;
  };

  // Geolocation path (unchanged behaviour, explicit permission button)
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus("denied");
      setWeather({ cond:"sunny", temp:"N/A", humidity:"N/A", location:"Browser lacks Geolocation API", label:"Not supported" });
      push("❌ Your browser doesn't support geolocation.", "error");
      return;
    }
    setGeoStatus("loading");
    push("📡 Requesting your location…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude:lat, longitude:lon } = pos.coords;
        try {
          const [wRes, gRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m&timezone=auto`),
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`),
          ]);
          const wData = await wRes.json();
          const gData = await gRes.json();
          const city  = gData.city || gData.locality || gData.principalSubdivision || "Unknown";
          const state = gData.principalSubdivision || "";
          const loc   = [city, state].filter(Boolean).join(", ");
          applyWeatherFromCode(wData.current_weather?.weathercode ?? 0, Math.round(wData.current_weather.temperature), extractHumidity(wData), loc);
          setWeatherCity(""); // geolocation mode — no manual override stored
          push(`🌐 Live weather: ${Math.round(wData.current_weather.temperature)}°C at ${loc}`, "success");
        } catch (e) {
          setGeoStatus("error");
          setWeather({ cond:"sunny", temp:"—", humidity:"—", location:"Fetch failed — check internet", label:"API Error" });
          push("⚠️ Weather API fetch failed. Check your internet connection.", "error");
        }
      },
      (err) => {
        setGeoStatus("denied");
        setWeather({ cond:"sunny", temp:"—", humidity:"—", location:"Permission denied by user", label:"Geo Blocked" });
        push("🔒 Location permission denied. Weather unavailable.", "error");
      },
      { timeout:10000, enableHighAccuracy:false }
    );
  }, [applyWeatherFromCode]);

  // NEW: manual city path — no geolocation permission needed at all.
  const setCityManually = useCallback(async (cityName) => {
    const name = cityName.trim();
    if (!name) return;
    setGeoStatus("loading");
    push(`📡 Looking up ${name}…`);
    try {
      const gRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`);
      const gData = await gRes.json();
      const hit = gData.results && gData.results[0];
      if (!hit) { setGeoStatus("error"); setWeather(p => ({ ...p, location:"City not found" })); push("❌ Couldn't find that city.", "error"); return; }
      const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current_weather=true&hourly=relative_humidity_2m&timezone=auto`);
      const wData = await wRes.json();
      const loc = [hit.name, hit.admin1, hit.country].filter(Boolean).join(", ");
      applyWeatherFromCode(wData.current_weather?.weathercode ?? 0, Math.round(wData.current_weather.temperature), extractHumidity(wData), loc);
      setWeatherCity(name);
      push(`🌐 Live weather: ${loc}`, "success");
    } catch (e) {
      setGeoStatus("error");
      push("⚠️ Weather lookup failed. Check your internet connection.", "error");
    }
  }, [applyWeatherFromCode]);

  // Auto-load weather for a previously saved manual city, once, on mount.
  useEffect(() => {
    if (weatherCity && geoStatus === "idle") setCityManually(weatherCity);
  }, []); // eslint-disable-line

  // ── Matrix cell key + toggle (year-aware — BUG FIX #2) ─────────────────────
  const toggleCell = useCallback((year, monthN, trackerKey, day) => {
    const ds = dayState(year, monthN, day);
    if (ds === "future") { push("🔒 Chronological Lockout: Cannot log future days.", "error"); return; }
    const cycle = ["blank","done","miss","skip"];
    const k = cellKey(year, monthN, trackerKey, day);
    const cur = matrix[k] || "blank";
    const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
    dirtyMonths.current.add(`${year}-${monthN}`);
    setMatrix(prev => ({ ...prev, [k]: next }));
    if (next === "done") push(`🔥 Day ${day} — Done!`, "success");
  }, [matrix, push]);

  // ── Tracker management ─────────────────────────────────────────────────────
  const addTracker = () => {
    const label = newLabel.trim();
    if (!label) { push("Enter a tracker name first.", "error"); return; }
    const key = "c_" + Date.now();
    setTrackers(prev => [...prev, { key, title: label, brief: "Custom tracking node" }]);
    setNewLabel("");
    push(`✅ Tracker "${label}" added.`, "success");
  };
  const removeTracker = (key) => {
    setTrackers(prev => prev.filter(t => t.key !== key));
    setMatrix(prev => { const nb = { ...prev }; Object.keys(nb).forEach(k => { if (k.includes(`-${key}-`)) delete nb[k]; }); return nb; });
    push("Tracker removed.", "info");
  };
  // NEW: rename any tracker (default or custom) — covers "line item names"
  // from the customisable-labels request.
  const renameTracker = (key, title) => {
    setTrackers(prev => prev.map(t => t.key === key ? { ...t, title } : t));
  };

  // ── Export / Import wiring ──────────────────────────────────────────────────
  const doExport = () => { exportAllData({ theme, trackers, matrix, labels, alarmOn, reminderOffsets, weatherCity }); push("⬇️ Backup downloaded.", "success"); };
  const doImport = (file) => {
    setImportBusy(true);
    importAllDataFromFile(file, (data) => {
      if (data.theme) setTheme(data.theme);
      if (data.trackers) setTrackers(data.trackers);
      if (data.matrix) setMatrix(data.matrix);
      if (data.labels) setLabels(mergeLabels(data.labels));
      if (typeof data.alarmOn === "boolean") setAlarmOn(data.alarmOn);
      if (data.reminderOffsets) setReminderOffsets(data.reminderOffsets);
      if (typeof data.weatherCity === "string") setWeatherCity(data.weatherCity);
      setImportBusy(false);
      push("✅ Backup restored.", "success");
    }, (err) => { setImportBusy(false); push("❌ Import failed: " + err.message, "error"); });
  };
  // BUG FIX #4: reset now requires an export first — no more one-click,
  // no-backup data loss.
  const [resetExported, setResetExported] = useState(false);
  const doReset = () => {
    if (!resetExported) { push("⚠️ Export a backup first — button above.", "error"); return; }
    if (!confirm("Reset ALL tracking data for ALL months? This cannot be undone (you already have a backup).")) return;
    setMatrix({});
    setTrackers(SCHEMA.defaultTrackers);
    push("All data reset.", "info");
    setResetExported(false);
  };

  // ── Stats for selected month (year-aware) ──────────────────────────────────
  const monthStats = useMemo(() => {
    const mDays = selectedMonth.days;
    let totalDone = 0, totalPossible = 0;
    const per = trackers.map(t => {
      let done = 0, miss = 0, skip = 0;
      for (let d = 1; d <= mDays; d++) {
        const ds = dayState(selectedYear, selectedMonth.n, d);
        if (ds === "future") continue;
        totalPossible++;
        const v = matrix[cellKey(selectedYear, selectedMonth.n, t.key, d)] || "blank";
        if (v === "done") { done++; totalDone++; } else if (v === "miss") miss++; else if (v === "skip") skip++;
      }
      const loggedDays = done + miss + skip;
      return { ...t, done, miss, skip, pct: loggedDays ? Math.round((done / loggedDays) * 100) : 0, totalLogged: loggedDays };
    });
    return { per, overall: totalPossible ? Math.round((totalDone / totalPossible) * 100) : 0 };
  }, [matrix, trackers, selectedMonth, selectedYear]);

  // ── Formatted strings ─────────────────────────────────────────────────────
  const rtStr = `${String(realTime.getHours()).padStart(2,"0")}:${String(realTime.getMinutes()).padStart(2,"0")}:${String(realTime.getSeconds()).padStart(2,"0")}`;
  const rdStr = realTime.toLocaleDateString("en-IN", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const wIcon = { sunny:"☀️", rainy:"🌧️", stormy:"⚡", overcast:"☁️" }[weather.cond] || "🌤️";

  // ── RENDER: AUTH GATES (only reachable when Firebase is configured) ───────
  if (FIREBASE_CONFIGURED && authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor:theme.bg}}>
        <div className="text-center space-y-3">
          <span className="spin inline-block text-2xl" style={{color:theme.acc}}>⟳</span>
          <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Checking session…</p>
        </div>
      </div>
    );
  }
  if (FIREBASE_CONFIGURED && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{backgroundColor:theme.bg}}>
        <div className="max-w-sm w-full text-center space-y-6 fup">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-widest glow-text" style={{color:theme.acc}}>{labels.appName}</h1>
            <p className="text-[10px] text-neutral-600 font-mono mt-1">{labels.tagline}</p>
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed">Sign in to sync your trackers and settings across every device.</p>
          <button onClick={signIn} className="w-full py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider text-black flex items-center justify-center gap-2" style={{backgroundColor:theme.acc}}>
            <i className="fa-brands fa-google"></i> Sign in with Google
          </button>
        </div>
      </div>
    );
  }
  if (dataMode === "cloud" && !dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor:theme.bg}}>
        <div className="text-center space-y-3">
          <span className="spin inline-block text-2xl" style={{color:theme.acc}}>⟳</span>
          <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Loading your data…</p>
        </div>
      </div>
    );
  }

  // ── RENDER: MAIN APP ────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen relative">

      <div className={`mo-overlay ${sidebarOpen?"open":""}`} onClick={()=>setSidebarOpen(false)}/>

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`fixed lg:static top-0 left-0 h-screen z-50 lg:z-auto w-72 xl:w-80 bg-[#0a0a0f] border-r border-neutral-900/70 flex flex-col shrink-0 overflow-y-auto transition-transform duration-300 ease-out ${sidebarOpen?"translate-x-0":"-translate-x-full lg:translate-x-0"}`}>

        <div className="p-5 border-b border-neutral-900/60 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full ldot" style={{backgroundColor:theme.acc}}></span>
              <span className="font-mono text-[9px] tracking-widest uppercase text-neutral-500">{selectedYear} Life System</span>
            </div>
            <button onClick={()=>setSidebarOpen(false)} className="lg:hidden text-neutral-500 hover:text-white w-8 h-8 flex items-center justify-center">
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
          <h1 className="text-lg font-bold uppercase tracking-widest glow-text" style={{color:theme.acc}}>{labels.appName}</h1>
          <p className="text-[10px] text-neutral-600 font-mono mt-0.5">{labels.tagline}</p>
        </div>

        <div className="px-4 pt-4 shrink-0">
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-900/80">
            <div className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest mb-1">Live Clock</div>
            <div className="text-2xl font-mono font-bold tracking-widest text-white">{rtStr}</div>
            <div className="text-[9px] font-mono text-neutral-600 mt-0.5 truncate">{rdStr}</div>
          </div>
        </div>

        <div className="px-4 pt-3 shrink-0">
          <button onClick={()=>setMonthModal(true)} className="w-full p-3.5 rounded-xl bg-neutral-950 border border-neutral-900/80 hover:border-neutral-700 transition-all flex items-center justify-between gap-2 group">
            <div className="text-left">
              <div className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest">Active Month</div>
              <div className="text-sm font-bold text-white mt-0.5 tracking-wide">{selectedMonth.label} {selectedYear}</div>
              <div className="text-[9px] font-mono mt-0.5" style={{color:theme.acc}}>{selectedMonth.days} days tracked</div>
            </div>
            <i className="fa-solid fa-calendar-days text-neutral-600 group-hover:text-neutral-300 transition-all text-sm"></i>
          </button>
        </div>

        {/* Weather Card */}
        <div className="px-4 pt-3 shrink-0">
          {geoStatus === "idle" && (
            <div className="p-4 rounded-xl bg-amber-950/10 border geo-card space-y-2.5">
              <div className="flex items-center gap-2.5 cursor-pointer" onClick={requestLocation}>
                <span className="text-xl">📍</span>
                <div>
                  <div className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">Live Weather</div>
                  <div className="text-[9px] font-mono text-amber-500/70 mt-0.5">Location permission needed</div>
                </div>
              </div>
              <button onClick={requestLocation} className="w-full text-[9px] font-mono font-bold uppercase tracking-widest py-2 rounded-lg transition-all text-black" style={{backgroundColor:theme.acc}}>
                <i className="fa-solid fa-location-crosshairs mr-1.5"></i> Allow Location &amp; Load Weather
              </button>
              <div className="flex items-center gap-1.5 pt-1">
                <input value={cityInput} onChange={e=>setCityInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setCityManually(cityInput);}}}
                  placeholder="...or type a city name" className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-neutral-600 outline-none text-[10px] text-neutral-200 font-mono px-2.5 py-2 rounded-lg placeholder-neutral-600"/>
                <button onClick={()=>setCityManually(cityInput)} className="text-[9px] font-mono px-2.5 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300">
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>
          )}
          {geoStatus === "loading" && (
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-900/80 flex items-center gap-3">
              <span className="spin inline-block text-lg" style={{color:theme.acc}}>⟳</span>
              <div><div className="text-[10px] font-mono text-neutral-400">Fetching weather…</div><div className="text-[9px] font-mono text-neutral-600 mt-0.5">Open-Meteo</div></div>
            </div>
          )}
          {geoStatus === "ok" && (
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-900/80 hover:border-neutral-700 transition-all">
              <div onClick={()=>setWeatherModal(true)} className="flex items-center gap-3 cursor-pointer">
                <div className="text-2xl group-hover:scale-110 transition-transform">{wIcon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider">{weatherCity?"Manual City":"Live Weather"}</span>
                    {weather.temp && <span className="text-sm font-mono font-bold" style={{color:theme.acc}}>{weather.temp}</span>}
                  </div>
                  <p className="text-[9px] font-mono text-neutral-400 truncate mt-0.5">{weather.location}</p>
                </div>
              </div>
              <div className="flex justify-between items-center text-[8px] font-mono text-neutral-600 mt-2 pt-2 border-t border-neutral-900/50">
                <span>Humidity: <b className="text-neutral-400">{weather.humidity}</b></span>
                <button onClick={()=>{setGeoStatus("idle");setCityInput("");}} className="text-neutral-500 hover:text-white">Change source →</button>
              </div>
            </div>
          )}
          {(geoStatus==="denied"||geoStatus==="error") && (
            <div className="p-4 rounded-xl bg-neutral-950 border border-red-900/30 space-y-2">
              <div className="flex items-center gap-2 text-red-400">
                <i className={`fa-solid ${geoStatus==="denied"?"fa-lock":"fa-triangle-exclamation"} text-xs`}></i>
                <span className="text-[9px] font-mono uppercase tracking-widest">{geoStatus==="denied"?"Location Denied":"Fetch Error"}</span>
              </div>
              <p className="text-[9px] font-mono text-neutral-600">{weather.location}</p>
              <div className="flex gap-1.5">
                <button onClick={requestLocation} className="flex-1 text-[8px] font-mono font-bold uppercase tracking-widest py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all"><i className="fa-solid fa-rotate-right mr-1"></i> Retry GPS</button>
                <button onClick={()=>setGeoStatus("idle")} className="flex-1 text-[8px] font-mono font-bold uppercase tracking-widest py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all">Type City</button>
              </div>
            </div>
          )}
        </div>

        {/* Alarm Engine */}
        <div className="px-4 pt-3 shrink-0">
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-900/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest">Alarm Engine</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={alarmOn} onChange={e=>{setAlarmOn(e.target.checked);push(e.target.checked?"Alarms enabled.":"Alarms silenced.");}} className="sr-only peer"/>
                <div className="w-8 h-4 bg-neutral-800 rounded-full transition-colors" style={{backgroundColor:alarmOn?theme.acc:""}}>
                  <span className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform block" style={{transform:alarmOn?"translateX(16px)":"translateX(0)"}}></span>
                </div>
              </label>
            </div>
            {notifPermission!=="granted" && (
              <button onClick={requestNotifPermission} className="w-full mb-2 text-[8px] font-mono font-bold uppercase tracking-widest py-2 rounded-lg text-black" style={{backgroundColor:theme.acc}}>
                <i className="fa-solid fa-bell mr-1"></i> Enable Real Notifications
              </button>
            )}
            <div className="bg-neutral-900/60 rounded-lg p-2.5 border border-neutral-900 flex items-center justify-between gap-2">
              <span className="font-mono font-bold text-base text-white tracking-widest">{simTime}</span>
              <div className="flex gap-1.5">
                <button onClick={()=>setIsSim(p=>!p)} className="text-[8px] font-mono font-bold px-2.5 py-1 rounded transition-all" style={{backgroundColor:isSim?theme.acc2:"rgba(255,255,255,.06)",color:isSim?"#000":"#ccc"}}>{isSim?"PAUSE":"SIMULATE"}</button>
                <button onClick={()=>{setSimTime("15:30");setIsSim(false);firedAlarms.current.clear();}} className="text-[9px] bg-neutral-800 text-neutral-400 hover:text-white p-1.5 px-2 rounded transition-all"><i className="fa-solid fa-rotate-left"></i></button>
              </div>
            </div>
            <p className="text-[8px] font-mono text-neutral-700 mt-2">Simulate = demo only. Real reminders always use the actual clock — tune lead times in Settings.</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3 space-y-0.5 mt-4 flex-1 shrink-0">
          {[
            {id:"control-room",   icon:"fa-sliders"},
            {id:"timeline-map",   icon:"fa-network-wired"},
            {id:"matrix-31",      icon:"fa-braille"},
            {id:"knowledge-vault",icon:"fa-terminal"},
            {id:"somatic-bulk",   icon:"fa-dumbbell"},
            {id:"settings",       icon:"fa-gear"},
          ].map(tab=>(
            <button key={tab.id} onClick={()=>{setNav(tab.id);setSidebarOpen(false);}}
              className={`nb w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium tracking-wide transition-all ${nav===tab.id?"bg-neutral-900 text-white font-bold":"text-neutral-500 hover:text-neutral-200"}`}
              style={{borderLeft:nav===tab.id?`3px solid ${theme.acc}`:"3px solid transparent"}}>
              <i className={`fa-solid ${tab.icon} w-4 text-center`} style={{color:nav===tab.id?theme.acc:"inherit"}}></i>
              {labels.nav[tab.id]}
            </button>
          ))}
        </nav>

        {/* Account footer (theme picker moved to Settings) */}
        <div className="p-4 border-t border-neutral-900/50 mt-2 shrink-0">
          {FIREBASE_CONFIGURED && user ? (
            <div className="flex items-center gap-2.5">
              {user.photoURL ? <img src={user.photoURL} className="w-7 h-7 rounded-full" /> : <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-[9px]">{(user.displayName||"?")[0]}</div>}
              <div className="flex-1 min-w-0"><div className="text-[9px] font-bold text-neutral-300 truncate">{user.displayName||user.email}</div><div className="text-[8px] font-mono text-neutral-600">Synced ☁️</div></div>
              <button onClick={signOutUser} className="text-neutral-600 hover:text-red-400 w-7 h-7 flex items-center justify-center"><i className="fa-solid fa-right-from-bracket text-xs"></i></button>
            </div>
          ) : (
            <div className="text-[8px] font-mono text-neutral-600 text-center">{FIREBASE_CONFIGURED ? "Local-only fallback" : "Local mode — see Settings → Data"}</div>
          )}
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-neutral-900/60">
          <button onClick={()=>setSidebarOpen(true)} className="text-neutral-400 hover:text-white w-10 h-10 flex items-center justify-center"><i className="fa-solid fa-bars"></i></button>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-widest" style={{color:theme.acc}}>{labels.appName}</span>
            <span className="text-[9px] font-mono text-neutral-600">/ {selectedMonth.short}</span>
          </div>
          <span className="font-mono text-xs text-neutral-500">{rtStr.slice(0,5)}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8 max-w-[1320px] w-full mx-auto">

          <div className="mb-5 p-3.5 md:p-4 rounded-xl border border-neutral-900 bg-neutral-950/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 fup">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-sm">🛡️</div>
              <div>
                <p className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">System Active — {selectedMonth.label} {selectedYear}</p>
                <p className="text-[9px] text-neutral-600 font-mono mt-0.5">Only past &amp; today's cells are editable. Future days are locked chronologically.</p>
              </div>
            </div>
            <div className="font-mono text-right shrink-0">
              <span className="text-[9px] text-neutral-600 uppercase tracking-widest block">Compliance</span>
              <span className="text-xl font-bold" style={{color:theme.acc}}>{monthStats.overall}%</span>
            </div>
          </div>

          {/* ─── VIEW: CONTROL ROOM ─── */}
          {nav==="control-room" && (
            <div className="space-y-5 fup">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-950 via-[#0b090f] to-neutral-950 p-5 md:p-6 border border-neutral-900/80">
                <div className="absolute right-4 top-2 text-7xl font-mono font-bold opacity-[0.018] select-none">MANIFEST</div>
                <span className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 bg-neutral-900 text-neutral-500 rounded border border-neutral-800">{labels.headings["control-room"]}</span>
                <p className="mt-4 text-base md:text-lg italic text-neutral-200 leading-relaxed">&ldquo;{SCHEMA.quote.text}&rdquo;</p>
                <p className="text-[9px] font-mono text-neutral-600 mt-2 text-right">— {SCHEMA.quote.context}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-neutral-900/50">
                  {[
                    {val:`${SCHEMA.metrics.activeDays} Days`,label:"Active Target"},
                    {val:SCHEMA.metrics.bufferDays,label:"Buffer Window",col:theme.acc2},
                    {val:SCHEMA.metrics.rule,label:"Slippage Anchor",col:theme.acc},
                    {val:SCHEMA.metrics.bulkGoal,label:"Mass Target"},
                  ].map((m,i)=>(
                    <div key={i} className="bg-neutral-900/30 p-3 rounded-xl border border-neutral-900/50">
                      <span className="text-base font-mono font-bold block" style={{color:m.col||"#f0eae4"}}>{m.val}</span>
                      <span className="text-[8px] uppercase font-mono tracking-widest text-neutral-600">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="xl:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 flex items-center gap-2"><i className="fa-solid fa-chart-line"></i>{selectedMonth.label} Metrics</h3>
                    <button onClick={()=>setTrackerModal(true)} className="text-[9px] font-mono px-3 py-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 transition-all flex items-center gap-1.5"><i className="fa-solid fa-pen-to-square"></i> Manage</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {monthStats.per.map(h=>(
                      <div key={h.key} className="glass p-4 rounded-xl space-y-3">
                        <div className="flex justify-between items-start">
                          <div><h4 className="text-[11px] font-bold text-neutral-200 uppercase tracking-wide">{h.title}</h4><p className="text-[9px] text-neutral-600 font-mono mt-0.5">{h.brief}</p></div>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold" style={{background:h.pct<40?"rgba(239,68,68,.08)":"rgba(200,241,53,.08)",color:h.pct<40?"#f43f5e":theme.acc}}>{h.pct}%</span>
                        </div>
                        <div>
                          <div className="w-full bg-neutral-900 rounded-full h-1 overflow-hidden"><div className="bar h-full rounded-full" style={{width:`${h.pct}%`,backgroundColor:h.pct<40?"#f43f5e":theme.acc}}></div></div>
                          <div className="flex justify-between text-[8px] font-mono text-neutral-600 mt-1.5"><span>Done: <b className="text-neutral-300">{h.done}</b></span><span>Missed: <b className="text-red-400">{h.miss}</b></span><span>Skip: <b className="text-neutral-500">{h.skip}</b></span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 mt-1">
                    <h3 className="text-[9px] font-mono uppercase tracking-widest text-neutral-600">Priority Hierarchy Matrix</h3>
                    {SCHEMA.hierarchies.map(h=>(
                      <div key={h.rank} className="flex items-center gap-3.5 p-3.5 rounded-xl bg-neutral-950 border border-neutral-900/70">
                        <span className="font-mono text-[9px] font-bold text-neutral-600 bg-neutral-900 px-2 py-1 rounded shrink-0">{h.rank}</span>
                        <div><p className="text-[10px] font-bold text-neutral-200 uppercase tracking-wide flex items-center gap-1.5"><i className={`fa-solid ${h.icon} text-neutral-600 text-[8px]`}></i>{h.category}</p><p className="text-[9px] text-neutral-500 mt-0.5 leading-relaxed">{h.metrics}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">Behavioral Directives</h3>
                  <div className="p-5 rounded-2xl bg-[#09090e] border border-neutral-900 space-y-4">
                    {SCHEMA.operationalRules.map((r,i)=>(
                      <div key={i} className="space-y-1">
                        <div className="text-[9px] font-bold text-neutral-200 flex items-center gap-2 uppercase tracking-wide"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{backgroundColor:theme.acc2}}></span>{r.directive}</div>
                        <p className="text-[9px] text-neutral-500 leading-relaxed pl-3.5">{r.operationalization}</p>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-neutral-900"><div className="p-2.5 bg-neutral-900/50 rounded-lg text-[8px] font-mono text-center border border-neutral-900/60" style={{color:theme.acc2}}>⚙️ Link Severance armed for 23:30</div></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW: TIMELINE MAP ─── */}
          {nav==="timeline-map" && (
            <div className="space-y-5 fup">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div><h2 className="text-lg font-bold tracking-widest uppercase">{labels.headings["timeline-map"]}</h2><p className="text-[9px] text-neutral-500 font-mono mt-0.5">Today: {rdStr}</p></div>
                <span className="font-mono text-[9px] px-3 py-1.5 bg-neutral-950 border border-neutral-900 rounded-lg text-neutral-600 uppercase tracking-widest">Standard Sequence</span>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="xl:col-span-2 space-y-3 relative before:absolute before:left-[18px] before:top-3 before:bottom-3 before:w-px before:bg-neutral-900">
                  {SCHEMA.timeline.map((item,i)=>{
                    const isActive=simTime===item.time&&isSim;
                    const displayName = labels.timelineActions[item.id] || item.action;
                    return(
                      <div key={i} className={`relative pl-10 transition-all duration-300 ${isActive?"scale-[1.01]":""}`}>
                        <div className={`absolute left-[13px] top-3.5 w-3 h-3 rounded-full border-2 transition-all`} style={{backgroundColor:isActive?theme.acc:undefined,borderColor:isActive?theme.acc:"#333"}}></div>
                        <div className={`p-4 rounded-xl border transition-all ${isActive?"bg-neutral-900/70 shadow-lg":"bg-neutral-950/30 border-neutral-900/60 hover:bg-neutral-950/60"}`} style={{borderColor:isActive?theme.acc:undefined}}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded" style={{color:isActive?theme.acc:"#ccc"}}>{item.time}</span>
                              <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wide">{displayName}</h4>
                              {reminderOffsets[item.id]>0 && <span className="text-[8px] font-mono text-neutral-600"><i className="fa-solid fa-bell mr-0.5"></i>{reminderOffsets[item.id]}m before</span>}
                            </div>
                            <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-widest shrink-0 ${GC[item.group]||"text-neutral-400 bg-neutral-900 border-neutral-800"}`}><i className={`fa-solid ${GI[item.group]||"fa-circle"} mr-1`}></i>{item.group}</span>
                          </div>
                          <p className="text-[9px] text-neutral-500 leading-relaxed">{item.details}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 mb-2.5">Sunday Divergence Protocols</h3>
                    <div className="bg-neutral-950 border border-neutral-900 rounded-2xl p-4 space-y-3.5">
                      {SCHEMA.sundays.map((s,i)=>(
                        <div key={i} className="border-l-2 pl-3.5 border-neutral-900 hover:border-neutral-700 transition-all space-y-0.5">
                          <span className="text-[8px] uppercase font-mono text-neutral-600 block">{s.phase}</span>
                          <h5 className="text-[9px] font-bold text-neutral-300 uppercase tracking-wide">{s.title}</h5>
                          <p className="text-[9px] text-neutral-500 leading-relaxed">{s.info}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-neutral-950 to-[#14110b] border border-amber-900/30 space-y-3">
                    <div className="flex items-center gap-2 text-amber-500"><i className="fa-solid fa-cloud-bolt text-xs"></i><h3 className="text-[9px] font-mono uppercase tracking-widest">Minimal Override</h3></div>
                    <ul className="text-[9px] font-mono space-y-1.5 text-neutral-400 bg-neutral-900/40 p-3 rounded-lg border border-neutral-900">
                      <li>• Physical: 10 pushups absolute baseline.</li><li>• Technical: Review 1 conceptual code module.</li><li>• Skills: Boot workspace tools for 5 min.</li><li>• Sleep: Terminate before 00:00.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW: MATRIX ─── */}
          {nav==="matrix-31" && (
            <div className="space-y-5 fup">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-lg font-bold tracking-widest uppercase">{selectedMonth.label} {selectedYear} — {labels.headings["matrix-31"]}</h2>
                  <p className="text-[9px] text-neutral-500 font-mono mt-0.5">Tap a past or today cell to cycle: Blank → Done → Missed → Skipped</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={()=>setMonthModal(true)} className="text-[9px] font-mono px-3.5 py-2 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 transition-all flex items-center gap-1.5"><i className="fa-solid fa-calendar-days"></i> {selectedMonth.short} {selectedYear}</button>
                  <button onClick={()=>setTrackerModal(true)} className="text-[9px] font-mono px-3.5 py-2 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 transition-all flex items-center gap-1.5"><i className="fa-solid fa-plus"></i> Tracker</button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[8px] font-mono bg-neutral-950 p-3 rounded-xl border border-neutral-900">
                <span className="text-neutral-600 uppercase tracking-wider">Status:</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-neutral-900 border border-neutral-800 inline-block"></span>Blank</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{backgroundColor:theme.acc}}></span><b className="text-white">Done</b></span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-950/60 border border-red-900 inline-block"></span><span className="text-red-400">Missed</span></span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-neutral-800 border border-neutral-700 inline-block"></span>Skipped</span>
                <span className="flex items-center gap-1.5 ml-auto"><span className="w-3 h-3 rounded inline-block" style={{outline:`2px solid ${theme.acc}`,outlineOffset:"1px"}}></span><span style={{color:theme.acc}}>Today</span></span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-dashed border-neutral-700 opacity-30 inline-block"></span><span className="text-neutral-600">Future</span></span>
              </div>

              <div className="space-y-4">
                {trackers.map(tracker=>{
                  const ts=monthStats.per.find(x=>x.key===tracker.key);
                  const mDays=selectedMonth.days;
                  return(
                    <div key={tracker.key} className="p-4 md:p-5 rounded-2xl bg-neutral-950 border border-neutral-900/80 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div><h3 className="text-[11px] font-bold text-neutral-100 uppercase tracking-wide">{tracker.title}</h3><p className="text-[9px] text-neutral-600">{tracker.brief}</p></div>
                        <div className="flex items-center gap-3">
                          <div className="text-right font-mono text-[9px] text-neutral-500"><span className="font-bold text-white">{ts?.done??0}</span> / {mDays} done</div>
                          {tracker.key.startsWith("c_") && (
                            <button onClick={()=>{if(confirm(`Remove "${tracker.title}"?`))removeTracker(tracker.key);}} className="text-[9px] text-neutral-600 hover:text-red-400 transition-all px-2 py-1 rounded border border-neutral-900 hover:border-red-900"><i className="fa-solid fa-xmark"></i></button>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-1.5" style={{gridTemplateColumns:`repeat(${Math.min(mDays,16)}, minmax(0,1fr))`}}>
                        {Array.from({length:mDays},(_,i)=>{
                          const day=i+1;
                          const ds=dayState(selectedYear,selectedMonth.n,day);
                          const isFuture=ds==="future";
                          const isTodayCell=ds==="today";
                          const val=matrix[cellKey(selectedYear,selectedMonth.n,tracker.key,day)]||"blank";
                          let cls="bg-neutral-900 border border-neutral-800 text-neutral-500";
                          if(!isFuture){
                            if(val==="done") cls="text-black font-bold";
                            else if(val==="miss") cls="bg-red-950/60 text-red-400 border border-red-900";
                            else if(val==="skip") cls="bg-neutral-800 text-neutral-400 border border-neutral-700";
                          }
                          return(
                            <button key={day} onClick={()=>toggleCell(selectedYear,selectedMonth.n,tracker.key,day)}
                              className={`cb aspect-square rounded flex items-center justify-center text-[8px] font-mono transition-all ${cls} ${isFuture?"flocked":"cursor-pointer"} ${isTodayCell?"today-cell":""}`}
                              style={{backgroundColor:!isFuture&&val==="done"?theme.acc:undefined,boxShadow:!isFuture&&val==="done"?`0 0 8px ${theme.acc}30`:undefined,borderStyle:isFuture?"dashed":undefined}}
                              title={`${selectedMonth.label} ${day} — ${isFuture?"Future Locked":isTodayCell?"Today ("+val+")":val}`}
                              aria-label={`Day ${day}: ${isFuture?"future locked":val}`}>
                              {day}
                            </button>
                          );
                        })}
                      </div>
                      <div className="w-full bg-neutral-900 rounded-full h-0.5 overflow-hidden"><div className="bar h-full rounded-full" style={{width:`${ts?.pct||0}%`,backgroundColor:ts&&ts.pct<40?"#f43f5e":theme.acc}}></div></div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[8px] font-mono text-neutral-700 text-center pt-1">Need to wipe everything? Head to Settings → Data — export a backup first, it's required.</p>
            </div>
          )}

          {/* ─── VIEW: KNOWLEDGE VAULT ─── */}
          {nav==="knowledge-vault" && (
            <div className="space-y-5 fup">
              <div><h2 className="text-lg font-bold tracking-widest uppercase">{labels.headings["knowledge-vault"]}</h2><p className="text-[9px] text-neutral-500 font-mono mt-0.5">4-week programmatic milestones across algorithmic and security tracks.</p></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <h3 className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 flex items-center gap-2"><i className="fa-solid fa-code"></i>Data Structures &amp; Algorithms</h3>
                  <div className="space-y-2.5">
                    {SCHEMA.cognitiveRoadmap.dsa.map((w,i)=>(
                      <div key={i} className="p-4 rounded-xl bg-neutral-950 border border-neutral-900/80 hover:border-neutral-800 transition-all">
                        <span className="text-[8px] font-mono tracking-widest text-neutral-600 uppercase block mb-0.5">{w.unit}</span><h4 className="text-[10px] font-bold text-neutral-200 uppercase tracking-wide mb-1">{w.focus}</h4><p className="text-[9px] text-neutral-500 leading-relaxed">{w.overview}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 flex items-center gap-2"><i className="fa-solid fa-shield-halved"></i>Security Certification Track</h3>
                  <div className="space-y-2.5">
                    {SCHEMA.cognitiveRoadmap.security.map((w,i)=>(
                      <div key={i} className="p-4 rounded-xl bg-neutral-950 border border-neutral-900/80 hover:border-neutral-800 transition-all">
                        <span className="text-[8px] font-mono tracking-widest text-neutral-600 uppercase block mb-0.5">{w.unit}</span><h4 className="text-[10px] font-bold text-neutral-200 uppercase tracking-wide mb-1">{w.focus}</h4><p className="text-[9px] text-neutral-500 leading-relaxed">{w.focusDetails}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                {[
                  {tier:"Mandatory Core",asset:"The Art of Deception — Kevin Mitnick",purpose:"30-min daily. Social attack surfaces and analytical mindset frameworks."},
                  {tier:"Decompression",asset:"Elective Conceptual Reading",purpose:"Creative/philosophical texts. Zero operational demands. Purely for stress mitigation."},
                  {tier:"Parallel Track",asset:"GPU Hardware Logic Foundations",purpose:"45 min Sundays. Thread scheduling frameworks and device execution logic layers."},
                ].map((l,i)=>(
                  <div key={i} className="p-4 rounded-xl bg-neutral-950 border border-neutral-900 space-y-1.5">
                    <span className="text-[8px] font-mono tracking-widest text-neutral-600 uppercase block">{l.tier}</span><h4 className="text-[10px] font-bold text-neutral-200 uppercase tracking-wide">{l.asset}</h4><p className="text-[9px] text-neutral-500 leading-relaxed pt-1">{l.purpose}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── VIEW: SOMATIC & MASS ─── */}
          {nav==="somatic-bulk" && (
            <div className="space-y-5 fup">
              <div><h2 className="text-lg font-bold tracking-widest uppercase">{labels.headings["somatic-bulk"]}</h2><p className="text-[9px] text-neutral-500 font-mono mt-0.5">Caloric surplus and protein protocols mapped to skeletal mass scaling targets.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {SCHEMA.nutritionalUnits.map((n,i)=>(
                  <div key={i} className="glass p-5 rounded-2xl flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5"><h4 className="text-[10px] font-bold text-neutral-100 uppercase tracking-wide">{n.element}</h4><p className="text-[9px] text-neutral-500 leading-relaxed">{n.strategy}</p></div>
                    <span className="text-[8px] font-mono uppercase tracking-widest text-neutral-700 border-t border-neutral-900/50 pt-2 block">Mandatory Protocol</span>
                  </div>
                ))}
              </div>
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-900 space-y-4">
                <h3 className="text-[9px] font-mono uppercase tracking-widest text-neutral-400">Calisthenics Biomechanical Architecture</h3>
                <p className="text-[9px] text-neutral-500 leading-relaxed max-w-2xl">40-minute sessions every morning. Progressive internal leverage adjustments. Pure body-mechanics approach to muscle density development without external weight dependency.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    {l:"Anterior Push Vectors",s:"Pectorals // Lateral Triceps"},{l:"Posterior Pull Vectors",s:"Scapular Retraction // Biceps"},
                    {l:"Lower Kinetic Mass",s:"Quad Splits // Core Integration"},{l:"Kinetic Regeneration",s:"Sunday Joint Mobility Flows"},
                  ].map((s,i)=>(
                    <div key={i} className="p-3 bg-neutral-900/50 rounded-xl border border-neutral-900 text-center"><span className="block text-white font-bold text-[9px] uppercase tracking-wide mb-0.5">{s.l}</span><span className="text-neutral-600 text-[8px] font-mono">{s.s}</span></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW: SETTINGS (NEW) ─── */}
          {nav==="settings" && (
            <div className="space-y-5 fup max-w-3xl">
              <div><h2 className="text-lg font-bold tracking-widest uppercase">{labels.nav.settings}</h2><p className="text-[9px] text-neutral-500 font-mono mt-0.5">Appearance, labels, reminders, weather source, and your data — all in one place.</p></div>

              {/* Account */}
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-900 space-y-3">
                <h3 className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">Account</h3>
                {FIREBASE_CONFIGURED ? (
                  user ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? <img src={user.photoURL} className="w-9 h-9 rounded-full"/> : <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center text-xs">{(user.displayName||"?")[0]}</div>}
                        <div><div className="text-xs font-bold text-neutral-200">{user.displayName||user.email}</div><div className="text-[9px] font-mono text-neutral-600">Cloud sync active</div></div>
                      </div>
                      <button onClick={signOutUser} className="text-[9px] font-mono px-3 py-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:border-red-900 transition-all">Sign Out</button>
                    </div>
                  ) : <p className="text-[10px] text-neutral-500">Not signed in.</p>
                ) : (
                  <p className="text-[10px] text-neutral-500 leading-relaxed">Running in <b className="text-neutral-300">local mode</b> — Firebase isn't configured yet, so data stays in this browser only. See <code className="text-neutral-400">SETUP.md</code> to enable Google sign-in &amp; cross-device sync.</p>
                )}
              </div>

              {/* Appearance — theme picker MOVED here from the sidebar */}
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-900 space-y-3">
                <h3 className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">Appearance</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {THEMES.map(t=>(
                    <button key={t.id} onClick={()=>{setTheme(t);push(`Theme → ${t.name}`);}} className={`p-3 rounded-xl text-left transition-all border ${theme.id===t.id?"bg-neutral-900/80":"bg-transparent hover:bg-neutral-900/30"}`} style={{borderColor:theme.id===t.id?t.acc:"rgba(255,255,255,.05)"}}>
                      <div className="text-[9px] font-bold text-neutral-300 truncate leading-tight">{t.name}</div>
                      <div className="flex gap-1.5 mt-1.5"><div className="w-2 h-2 rounded-full" style={{backgroundColor:t.acc}}></div><div className="w-2 h-2 rounded-full" style={{backgroundColor:t.acc2}}></div></div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Customize Labels */}
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-900 space-y-4">
                <div><h3 className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">Customize Labels</h3><p className="text-[9px] text-neutral-600 mt-1">Rename anything below — it updates everywhere instantly. Tracker names are edited from "Manage Trackers" on the Month Matrix page.</p></div>

                <div className="space-y-2">
                  <label className="text-[8px] font-mono uppercase tracking-widest text-neutral-600 block">App Name</label>
                  <input value={labels.appName} onChange={e=>setLabels(p=>({...p,appName:e.target.value}))} className="w-full bg-neutral-900 border border-neutral-800 focus:border-neutral-600 outline-none text-xs text-neutral-200 px-3 py-2 rounded-lg"/>
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-mono uppercase tracking-widest text-neutral-600 block">Tagline</label>
                  <input value={labels.tagline} onChange={e=>setLabels(p=>({...p,tagline:e.target.value}))} className="w-full bg-neutral-900 border border-neutral-800 focus:border-neutral-600 outline-none text-xs text-neutral-200 px-3 py-2 rounded-lg"/>
                </div>

                <div className="space-y-2">
                  <label className="text-[8px] font-mono uppercase tracking-widest text-neutral-600 block">Tab Names</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.keys(DEFAULT_LABELS.nav).map(navId=>(
                      <div key={navId} className="flex items-center gap-2">
                        <span className="text-[8px] font-mono text-neutral-600 w-20 shrink-0 truncate">{navId}</span>
                        <input value={labels.nav[navId]} onChange={e=>setLabels(p=>({...p,nav:{...p.nav,[navId]:e.target.value}}))} className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-neutral-600 outline-none text-[10px] text-neutral-200 px-2.5 py-1.5 rounded-lg"/>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[8px] font-mono uppercase tracking-widest text-neutral-600 block">Section Headlines</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.keys(DEFAULT_LABELS.headings).map(hId=>(
                      <div key={hId} className="flex items-center gap-2">
                        <span className="text-[8px] font-mono text-neutral-600 w-20 shrink-0 truncate">{hId}</span>
                        <input value={labels.headings[hId]} onChange={e=>setLabels(p=>({...p,headings:{...p.headings,[hId]:e.target.value}}))} className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-neutral-600 outline-none text-[10px] text-neutral-200 px-2.5 py-1.5 rounded-lg"/>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[8px] font-mono uppercase tracking-widest text-neutral-600 block">Daily Timeline Item Names</label>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {SCHEMA.timeline.map(item=>(
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="text-[8px] font-mono text-neutral-600 w-12 shrink-0">{item.time}</span>
                        <input value={labels.timelineActions[item.id] ?? item.action} onChange={e=>setLabels(p=>({...p,timelineActions:{...p.timelineActions,[item.id]:e.target.value}}))} className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-neutral-600 outline-none text-[10px] text-neutral-200 px-2.5 py-1.5 rounded-lg"/>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notifications & Alarms */}
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-900 space-y-4">
                <h3 className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">Notifications &amp; Alarms</h3>
                <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/50 border border-neutral-900">
                  <div>
                    <div className="text-[10px] font-bold text-neutral-200">Browser permission</div>
                    <div className="text-[9px] font-mono text-neutral-600 mt-0.5">{notifPermission==="granted"?"Granted — real reminders are active.":notifPermission==="denied"?"Blocked — re-enable it in your browser's site settings.":"Not yet requested."}</div>
                  </div>
                  {notifPermission!=="granted" ? (
                    <button onClick={requestNotifPermission} className="text-[9px] font-mono font-bold px-3 py-2 rounded-lg text-black shrink-0" style={{backgroundColor:theme.acc}}>Enable</button>
                  ) : (
                    <button onClick={sendTestNotification} className="text-[9px] font-mono px-3 py-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white shrink-0">Send Test</button>
                  )}
                </div>
                <p className="text-[8px] font-mono text-neutral-600 leading-relaxed bg-neutral-900/30 p-3 rounded-lg border border-neutral-900">
                  ℹ️ Real reminders fire while this app/browser is running (foreground, background tab, or screen locked) — they can't wake a fully closed/killed app, especially on iOS. That last mile needs a push server (Firebase Cloud Messaging); see SETUP.md.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-mono uppercase tracking-widest text-neutral-600 block">Reminder lead time, per item</label>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {SCHEMA.timeline.map(item=>(
                      <div key={item.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-neutral-900/40">
                        <div className="min-w-0"><span className="text-[9px] font-mono text-neutral-500">{item.time}</span> <span className="text-[10px] text-neutral-300 ml-1">{labels.timelineActions[item.id]||item.action}</span></div>
                        <select value={reminderOffsets[item.id] ?? 0} onChange={e=>setReminderOffsets(p=>({...p,[item.id]:Number(e.target.value)}))} className="bg-neutral-900 border border-neutral-800 text-[9px] font-mono text-neutral-300 rounded-lg px-2 py-1.5 shrink-0">
                          {REMINDER_CHOICES.map(c=><option key={c.v} value={c.v}>{c.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Weather source */}
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-900 space-y-3">
                <h3 className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">Weather Source</h3>
                <p className="text-[9px] text-neutral-600">Current: <b className="text-neutral-300">{weather.location || "Not loaded"}</b></p>
                <div className="flex gap-2">
                  <input value={cityInput} onChange={e=>setCityInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")setCityManually(cityInput);}} placeholder="Type a city to switch manually" className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-neutral-600 outline-none text-[10px] text-neutral-200 px-3 py-2 rounded-lg"/>
                  <button onClick={()=>setCityManually(cityInput)} className="text-[9px] font-mono px-3 py-2 rounded-lg text-black font-bold shrink-0" style={{backgroundColor:theme.acc}}>Set</button>
                  <button onClick={requestLocation} className="text-[9px] font-mono px-3 py-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white shrink-0">Use GPS</button>
                </div>
              </div>

              {/* Data */}
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-900 space-y-3">
                <h3 className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">Data</h3>
                <button onClick={()=>{doExport();setResetExported(true);}} className="w-full py-2.5 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider text-black" style={{backgroundColor:theme.acc}}><i className="fa-solid fa-download mr-1.5"></i>Export Backup (JSON)</button>
                <label className="w-full block py-2.5 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-300 border border-neutral-800 text-center cursor-pointer hover:border-neutral-600">
                  <i className="fa-solid fa-upload mr-1.5"></i>{importBusy?"Importing…":"Import Backup (JSON)"}
                  <input type="file" accept="application/json" className="hidden" onChange={e=>{if(e.target.files[0])doImport(e.target.files[0]);e.target.value="";}}/>
                </label>
                <div className="pt-2 border-t border-neutral-900">
                  <button onClick={doReset} className={`w-full py-2.5 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${resetExported?"text-red-400 border border-red-900 hover:bg-red-950/20":"text-neutral-700 border border-neutral-900 cursor-not-allowed"}`}>
                    <i className="fa-solid fa-trash-can mr-1.5"></i> Reset All Data {!resetExported && "(export a backup first)"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ═══ MONTH PICKER MODAL (year-aware) ═══ */}
      {monthModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-900 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl fup">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">Select Month</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <button onClick={()=>setSelectedYear(y=>y-1)} className="w-6 h-6 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-400 flex items-center justify-center"><i className="fa-solid fa-chevron-left text-[9px]"></i></button>
                  <span className="text-[10px] font-mono text-neutral-400 w-12 text-center">{selectedYear}</span>
                  <button onClick={()=>setSelectedYear(y=>y+1)} className="w-6 h-6 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-400 flex items-center justify-center"><i className="fa-solid fa-chevron-right text-[9px]"></i></button>
                </div>
              </div>
              <button onClick={()=>setMonthModal(false)} className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"><i className="fa-solid fa-xmark text-xs"></i></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {months.map(m=>{
                const isCurrent = m.n===todayM && selectedYear===todayY;
                const isPast    = selectedYear<todayY || (selectedYear===todayY && m.n<todayM);
                const isSelected= m.n===selectedMonth.n;
                return(
                  <button key={m.n} onClick={()=>{setSelectedMonth(m);setMonthModal(false);push(`Switched to ${m.label} ${selectedYear}`);}}
                    className={`p-3 rounded-xl text-left transition-all border relative ${isSelected?"bg-neutral-900":"hover:bg-neutral-900/50 bg-transparent"}`}
                    style={{borderColor:isSelected?theme.acc:"rgba(255,255,255,.05)"}}>
                    <div className="text-[10px] font-bold text-neutral-200 tracking-widest">{m.short}</div>
                    <div className="text-[8px] font-mono mt-0.5" style={{color:isCurrent?theme.acc:isPast?"rgba(255,255,255,.3)":"rgba(255,255,255,.15)"}}>{isCurrent?"← TODAY":isPast?"Past":"Future"}</div>
                    <div className="text-[8px] font-mono text-neutral-700">{m.days}d</div>
                    {isSelected && <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{backgroundColor:theme.acc}}></div>}
                  </button>
                );
              })}
            </div>
            <p className="text-[8px] font-mono text-neutral-700 text-center">You can log past months retroactively. Future months are locked until arrival.</p>
          </div>
        </div>
      )}

      {/* ═══ TRACKER MODAL (now with rename) ═══ */}
      {trackerModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-900 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl fup max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
              <div><h3 className="text-sm font-bold uppercase tracking-wider text-white">Manage Trackers</h3><p className="text-[9px] font-mono text-neutral-600 mt-0.5">Add, rename, or remove habit trackers across all months</p></div>
              <button onClick={()=>setTrackerModal(false)} className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"><i className="fa-solid fa-xmark text-xs"></i></button>
            </div>
            <div className="space-y-2.5">
              <label className="text-[9px] font-mono uppercase tracking-widest text-neutral-600 block">Add New Tracker</label>
              <div className="flex gap-2">
                <input type="text" value={newLabel} onChange={e=>setNewLabel(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addTracker();}} placeholder="e.g. Advanced DSA Stack, ISC² Reading…" className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-neutral-600 outline-none text-xs text-neutral-200 font-mono px-3 py-2.5 rounded-xl placeholder-neutral-700 transition-colors" maxLength={60}/>
                <button onClick={addTracker} className="px-4 py-2.5 rounded-xl font-mono text-xs font-bold text-black transition-all shrink-0" style={{backgroundColor:theme.acc}}><i className="fa-solid fa-plus mr-1"></i>Add</button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-mono uppercase tracking-widest text-neutral-600 block">Active Trackers ({trackers.length})</label>
              {trackers.map(t=>{
                const ts=monthStats.per.find(x=>x.key===t.key);
                return(
                  <div key={t.key} className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/50 border border-neutral-900 gap-2">
                    <div className="flex-1 min-w-0">
                      <input value={t.title} onChange={e=>renameTracker(t.key,e.target.value)} className="text-xs font-bold text-neutral-200 bg-transparent border-b border-transparent hover:border-neutral-800 focus:border-neutral-600 outline-none w-full"/>
                      <div className="text-[8px] font-mono text-neutral-600 mt-0.5">{t.brief}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[8px] font-mono px-2 py-0.5 rounded" style={{background:"rgba(255,255,255,.04)",color:theme.acc}}>{ts?.done??0}/{selectedMonth.days}</span>
                      {t.key.startsWith("c_")?(
                        <button onClick={()=>{if(confirm(`Remove "${t.title}"?`))removeTracker(t.key);}} className="text-neutral-600 hover:text-red-400 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-950/30 transition-all"><i className="fa-solid fa-xmark text-xs"></i></button>
                      ):(<span className="text-[8px] font-mono text-neutral-700 px-2">core</span>)}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={()=>setTrackerModal(false)} className="w-full font-mono text-[9px] font-bold uppercase tracking-wider text-black py-3 rounded-xl" style={{backgroundColor:theme.acc}}>Done</button>
          </div>
        </div>
      )}

      {/* ═══ WEATHER TIPS MODAL ═══ */}
      {weatherModal && geoStatus==="ok" && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-900 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl fup">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{wIcon}</span>
                <div><h3 className="text-sm font-bold uppercase tracking-wider text-white">Tactical Weather Intel</h3><p className="text-[9px] font-mono text-neutral-500 mt-0.5">{weather.location} · {weather.temp} · {weather.humidity} RH</p></div>
              </div>
              <button onClick={()=>setWeatherModal(false)} className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"><i className="fa-solid fa-xmark text-xs"></i></button>
            </div>
            <div className="flex flex-wrap gap-1.5 bg-neutral-900/40 p-2.5 rounded-lg border border-neutral-900/60">
              <span className="text-[8px] font-mono text-neutral-600 uppercase mr-1 self-center">Simulate:</span>
              {["sunny","rainy","stormy","overcast"].map(c=>(
                <button key={c} onClick={()=>setWeather(p=>({...p,cond:c}))} className="text-[8px] font-mono px-2.5 py-1 rounded font-bold uppercase transition-all" style={{backgroundColor:weather.cond===c?theme.acc:"rgba(255,255,255,.06)",color:weather.cond===c?"#000":"#777"}}>{c}</button>
              ))}
            </div>
            <div className="space-y-2">
              <h4 className="text-[8px] font-mono uppercase tracking-widest text-neutral-600">Adaptive Execution Rules:</h4>
              {(SCHEMA.weatherTips[weather.cond]||[]).map((tip,i)=>(
                <div key={i} className="p-3 bg-neutral-900/40 border border-neutral-900 rounded-xl text-[9px] text-neutral-300 leading-relaxed flex items-start gap-2.5"><span className="text-neutral-600 shrink-0 mt-0.5">»</span><span>{tip}</span></div>
              ))}
            </div>
            <button onClick={()=>setWeatherModal(false)} className="w-full font-mono text-[9px] font-bold uppercase tracking-wider text-black py-3 rounded-xl" style={{backgroundColor:theme.acc}}>Close Interface</button>
          </div>
        </div>
      )}

      {/* ═══ ALARM OVERLAY (simulate-mode demo) ═══ */}
      {alarmOverlay && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-neutral-950 border border-neutral-900 p-6 rounded-2xl shadow-2xl text-center space-y-5 alarm-pulse fup relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse"></div>
            <span className="text-[8px] font-mono tracking-widest text-red-400 uppercase font-bold">⚠️ Calendar Alarm Interrupt</span>
            <div>
              <div className="text-4xl font-mono font-bold tracking-widest glow-text mb-1" style={{color:theme.acc}}>{alarmOverlay.time}</div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">{labels.timelineActions[alarmOverlay.id]||alarmOverlay.action}</h2>
            </div>
            <p className="text-[9px] text-neutral-500 leading-relaxed max-w-xs mx-auto">{alarmOverlay.details}</p>
            <span className={`inline-flex items-center gap-1.5 text-[8px] font-mono px-3 py-1.5 rounded-full border uppercase tracking-widest ${GC[alarmOverlay.group]||"text-neutral-400 border-neutral-800"}`}><i className={`fa-solid ${GI[alarmOverlay.group]||"fa-circle"}`}></i>{alarmOverlay.group}</span>
            <button onClick={()=>{setAlarmOverlay(null);push(`[${alarmOverlay.time}] acknowledged.`);}} className="w-full font-mono text-[9px] font-bold uppercase tracking-wider text-black py-3 rounded-xl" style={{backgroundColor:theme.acc}}>Dismiss</button>
          </div>
        </div>
      )}

      {/* ═══ TOAST STACK ═══ */}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
        {toasts.map(t=>(
          <div key={t.id} className="tin pointer-events-auto flex items-center gap-2.5 p-3 rounded-xl bg-neutral-900/95 border shadow-2xl text-[9px] font-mono text-neutral-200 backdrop-blur-sm" style={{borderColor:t.type==="error"?"rgba(244,63,94,.4)":t.type==="success"?"rgba(200,241,53,.25)":"rgba(255,255,255,.06)"}}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0 ldot" style={{backgroundColor:t.type==="error"?"#f43f5e":t.type==="success"?theme.acc:theme.acc2}}></span>
            <span className="flex-1 leading-relaxed">{t.msg}</span>
            <button onClick={()=>dropToast(t.id)} className="text-neutral-600 hover:text-white shrink-0 w-5 h-5 flex items-center justify-center"><i className="fa-solid fa-xmark text-[8px]"></i></button>
          </div>
        ))}
      </div>

    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
