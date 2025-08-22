// assets/app.js
(function () {
  const REPO = "TruffleAlgolia"; // <-- must match your repo name exactly

  // ---------- URL helpers ----------
  function getBasePath() {
    const parts = location.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf(REPO);
    if (idx !== -1) return "/" + parts.slice(0, idx + 1).join("/") + "/";
    return "/";
  }
  function currentLang() {
    const parts = location.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf(REPO);
    const lang = idx !== -1 ? parts[idx + 1] : null;
    return ["en", "fr", "de"].includes((lang || "").toLowerCase()) ? (lang || "en") : "en";
  }
  function langUrl(lang) {
    return getBasePath() + lang + "/";
  }

  // ---------- UTM / Referrer ----------
  function parseUTMs() {
    const sp = new URLSearchParams(location.search);
    const pick = (k) => {
      const v = sp.get(k);
      return v ? v : null;
    };
    return {
      utm_source: pick("utm_source"),
      utm_medium: pick("utm_medium"),
      utm_campaign: pick("utm_campaign"),
      utm_term: pick("utm_term"),
      utm_content: pick("utm_content"),
    };
  }
  const referrer = document.referrer || null;

  // ---------- Device ----------
  function deviceType() {
    return window.innerWidth < 768 ? "mobile" : "desktop";
  }

  // ---------- Session (anonymous id + timestamps) ----------
  const SID_KEY = "truffle_session_id";
  const FIRST_SEEN_KEY = "truffle_first_seen";
  const LAST_SEEN_KEY = "truffle_last_seen";
  function uuid() {
    const rnd = () =>
      (window.crypto && crypto.getRandomValues)
        ? crypto.getRandomValues(new Uint8Array(1))[0] & 15
        : Math.floor(Math.random() * 16);
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = rnd();
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  const sessionId =
    localStorage.getItem(SID_KEY) ||
    (localStorage.setItem(SID_KEY, uuid()), localStorage.getItem(SID_KEY));
  const firstSeen =
    localStorage.getItem(FIRST_SEEN_KEY) ||
    (localStorage.setItem(FIRST_SEEN_KEY, new Date().toISOString()), localStorage.getItem(FIRST_SEEN_KEY));
  localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  const lastSeen = localStorage.getItem(LAST_SEEN_KEY);

  // ---------- Core context (sync) ----------
  const context = {
    device: deviceType(),
    language: currentLang(),
    pageUrl: window.location.href,
    referrer,
    ...parseUTMs(),
    sessionId,
    firstSeen,
    lastSeen,
    ipAddress: null,
    geo: null, // { country, countryCode, region, city, timezone } when available
  };

  // Log sync context
  console.log("🧭 BasePath:", getBasePath());
  console.log("🌍 Language:", context.language);
  console.log("📱 Device:", context.device);
  console.log("📄 Page URL:", context.pageUrl);
  if (context.referrer) console.log("↩️ Referrer:", context.referrer);
  const { utm_source, utm_medium, utm_campaign, utm_term, utm_content } = context;
  if (utm_source || utm_medium || utm_campaign || utm_term || utm_content) {
    console.log("📊 UTM:", { utm_source, utm_medium, utm_campaign, utm_term, utm_content });
  }
  console.log("🆔 Session:", { sessionId: context.sessionId, firstSeen: context.firstSeen, lastSeen: context.lastSeen });

  // ---------- IP + Geo (async, CORS-friendly) ----------
  // Step 1: get public IP (ipify allows CORS)
  fetch("https://api.ipify.org?format=json")
    .then(r => r.json())
    .then(({ ip }) => {
      context.ipAddress = ip || null;
      console.log("🌐 IP:", context.ipAddress);

      // Step 2: get geo (ipwho.is allows CORS, no key required)
      if (!ip) throw new Error("No IP");
      return fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
    })
    .then(r => r.json())
    .then(j => {
      if (j && j.success) {
        context.geo = {
          country: j.country || null,
          countryCode: j.country_code || null,
          region: j.region || null,
          city: j.city || null,
          timezone: (j.timezone && j.timezone.id) || null,
        };
        console.log("🗺️ Geo:", context.geo);
      } else {
        console.warn("Geo lookup failed or unavailable:", j && j.message);
      }
      window.dispatchEvent(new Event("truffleContextUpdated"));
    })
    .catch(err => {
      console.warn("IP/Geo lookup failed:", err);
      window.dispatchEvent(new Event("truffleContextUpdated"));
    });

  // ---------- Expose globally ----------
  window.TruffleContext = context;

  // Keep device label fresh if user resizes significantly
  window.addEventListener("resize", (() => {
    let t;
    return () => {
      clearTimeout(t);
      t = setTimeout(() => (window.TruffleContext.device = deviceType()), 200);
    };
  })());

  // ---------- Language selector wiring ----------
  const sel = document.getElementById("langSelect");
  if (sel) {
    sel.value = currentLang();
    sel.addEventListener("change", (e) => {
      const chosen = e.target.value;
      window.location.assign(langUrl(chosen));
    });
  }

  // ---------- Swap hero image by language ----------
  const hero = document.querySelector("img.hero");
  const caption = document.querySelector(".caption");
  if (hero && caption) {
    const lang = currentLang();
    if (lang === "en") {
      hero.src = "../assets/Algolia_en.png";
      hero.alt = "English Image";
      caption.textContent = "English page";
    } else if (lang === "fr") {
      hero.src = "../assets/Algolia_fr.png";
      hero.alt = "Page Française";
      caption.textContent = "Page française";
    } else if (lang === "de") {
      hero.src = "../assets/Algolia_de.png";
      hero.alt = "Deutsche Seite";
      caption.textContent = "Deutsche Seite";
    }
  }

  // ---------- Embedded Messaging integration ----------
  function compact(obj) {
    const out = {};
    Object.keys(obj || {}).forEach((k) => {
      const v = obj[k];
      if (v !== null && v !== undefined && String(v).trim() !== "") out[k] = v;
    });
    return out;
  }

  function buildPrechatFields() {
    return compact({
      Device: context.device,
      Site_Language: context.language,
      Page_URL: context.pageUrl,
      Referrer_URL: context.referrer,
      UTM_Source: context.utm_source,
      UTM_Medium: context.utm_medium,
      UTM_Campaign: context.utm_campaign,
      UTM_Term: context.utm_term,
      UTM_Content: context.utm_content,
      Session_ID: context.sessionId,
      First_Seen_At: context.firstSeen,
      Last_Seen_At: context.lastSeen,
      IP_Address: context.ipAddress,
      Country: context.geo?.country,
      Country_Code: context.geo?.countryCode,
      Region: context.geo?.region,
      City: context.geo?.city,
      Timezone: context.geo?.timezone,
    });
  }

  function pushPrechatFields() {
    try {
      if (
        window.embeddedservice_bootstrap &&
        embeddedservice_bootstrap.prechatAPI &&
        typeof embeddedservice_bootstrap.prechatAPI.setHiddenPrechatFields === "function"
      ) {
        const fields = buildPrechatFields();
        embeddedservice_bootstrap.prechatAPI.setHiddenPrechatFields(fields);
        console.log("📨 Prechat fields sent:", fields);
      }
    } catch (e) {
      console.warn("Prechat push failed:", e);
    }
  }

  // On ESW ready
  window.addEventListener("onEmbeddedMessagingReady", () => {
    console.log("✅ onEmbeddedMessagingReady");
    try {
      if (window.embeddedservice_bootstrap && embeddedservice_bootstrap.settings) {
        const map = { en: "en_US", fr: "fr_FR", de: "de_DE" };
        embeddedservice_bootstrap.settings.language = map[currentLang()] || "en_US";
      }
    } catch (e) {
      console.warn("Could not set ESW language:", e);
    }
    pushPrechatFields();
  });

  // On async IP/Geo update
  window.addEventListener("truffleContextUpdated", () => {
    pushPrechatFields();
    console.log("🔁 Updated prechat fields with IP/Geo");
  });

  // ---- Ensure Salesforce Embedded Messaging loads & initializes exactly once ----
  (function ensureESW() {
    const BOOT_URL = "https://tr1755614761355.my.site.com/ESWAlgolia1755631261845/assets/js/bootstrap.min.js";
    const ORG_ID = "00DKY00000Ggx3e";
    const DEPLOY = "Algolia";
    const SNIPPET = "https://tr1755614761355.my.site.com/ESWAlgolia1755631261845";
    const SCRT2 = "https://tr1755614761355.my.salesforce-scrt.com";

    if (window.__TRUFFLE_ESW_INITTED) return;

    function setLanguageFromUrl() {
      try {
        const map = { en: "en_US", fr: "fr_FR", de: "de_DE" };
        const lang = (window.TruffleContext?.language) || "en";
        embeddedservice_bootstrap.settings.language = map[lang] || "en_US";
        console.log("🌐 ESW language set to:", embeddedservice_bootstrap.settings.language);
      } catch (e) {
        console.warn("Could not set ESW language:", e);
      }
    }

    function initESW() {
      if (!window.embeddedservice_bootstrap?.init) return false;
      if (window.__TRUFFLE_ESW_INITTED) return true;
      try {
        setLanguageFromUrl();
        embeddedservice_bootstrap.init(ORG_ID, DEPLOY, SNIPPET, { scrt2URL: SCRT2 });
        window.__TRUFFLE_ESW_INITTED = true;
        console.log("💬 Embedded Messaging initialized");
        return true;
      } catch (err) {
        console.error("Error loading Embedded Messaging:", err);
        return false;
      }
    }

    // If already present, init now
    if (initESW()) return;

    // If tag exists but not loaded yet, listen for it
    const existing = document.querySelector(`script[src="${BOOT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => initESW());
      existing.addEventListener("error", () => console.error("Failed to load ESW bootstrap:", BOOT_URL));
    } else {
      // Inject bootstrap
      const s = document.createElement("script");
      s.src = BOOT_URL;
      s.async = true;
      s.onload = () => initESW();
      s.onerror = () => console.error("Failed to load ESW bootstrap:", BOOT_URL);
      document.head.appendChild(s);
    }

    // Safety: poll up to 10s
    const start = Date.now();
    const timer = setInterval(() => {
      if (initESW()) clearInterval(timer);
      if (Date.now() - start > 10000) {
        clearInterval(timer);
        console.warn("Timed out waiting for ESW bootstrap.");
      }
    }, 100);
  })();
})();