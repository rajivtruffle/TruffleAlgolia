// assets/app.js
(function () {
  const REPO = "TruffleAlgolia"; // <-- your GitHub Pages project repo

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
    return ["en", "fr", "de"].includes((lang || "").toLowerCase()) ? lang : "en";
  }
  function langUrl(lang) {
    return getBasePath() + lang + "/";
  }

  // ---------- UTM / Referrer ----------
  function parseUTMs() {
    const sp = new URLSearchParams(location.search);
    const pick = (k) => {
      const v = sp.get(k);
      return v ? decodeURIComponent(v) : null;
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
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0xf) >> 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  const sessionId = localStorage.getItem(SID_KEY) || (localStorage.setItem(SID_KEY, uuid()), localStorage.getItem(SID_KEY));
  const firstSeen = localStorage.getItem(FIRST_SEEN_KEY) || (localStorage.setItem(FIRST_SEEN_KEY, new Date().toISOString()), localStorage.getItem(FIRST_SEEN_KEY));
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

  // ---------- IP + Geo (async) ----------
  // Try ipapi.co first; if blocked, fallback to ipify (IP only)
  fetch("https://ipapi.co/json/")
    .then((r) => r.ok ? r.json() : Promise.reject(new Error("ipapi.co not OK")))
    .then((j) => {
      context.ipAddress = j.ip || null;
      context.geo = {
        country: j.country_name || null,
        countryCode: j.country || null,
        region: j.region || null,
        city: j.city || null,
        timezone: j.timezone || null,
      };
      console.log("🌐 IP:", context.ipAddress);
      console.log("🗺️ Geo:", context.geo);

      // If Embedded Messaging is already ready, push fields now as an update
      tryPushPrechatFields();
    })
    .catch(() =>
      fetch("https://api.ipify.org?format=json")
        .then((r) => r.json())
        .then((j) => {
          context.ipAddress = j.ip || null;
          console.log("🌐 IP:", context.ipAddress);
          tryPushPrechatFields();
        })
        .catch((e) => console.warn("IP lookup failed:", e))
    );

  // ---------- Expose globally ----------
  window.TruffleContext = context;

  // ---------- Language selector wiring ----------
  const sel = document.getElementById("langSelect");
  if (sel) {
    sel.value = currentLang();
    sel.addEventListener("change", (e) => {
      const chosen = e.target.value;
      window.location.assign(langUrl(chosen));
    });
  }

  // ---------- Swap hero image by language (optional) ----------
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
  function buildPrechatFields() {
    const fields = {
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
    };
    // Drop null/undefined
    Object.keys(fields).forEach((k) => (fields[k] == null ? delete fields[k] : 0));
    return fields;
  }

  function tryPushPrechatFields() {
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

  // When Embedded Messaging is ready, push the current snapshot
  window.addEventListener("onEmbeddedMessagingReady", () => {
    console.log("✅ onEmbeddedMessagingReady");
    // If you want to set ESW UI language from URL:
    try {
      if (window.embeddedservice_bootstrap && embeddedservice_bootstrap.settings) {
        const map = { en: "en_US", fr: "fr_FR", de: "de_DE" };
        embeddedservice_bootstrap.settings.language = map[currentLang()] || "en_US";
      }
    } catch (e) {
      console.warn("Could not set ESW language:", e);
    }
    tryPushPrechatFields();
  });
})();
// assets/app.js
(function () {
  const REPO = "TruffleAlgolia"; // <-- your GitHub Pages project repo

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
    return ["en", "fr", "de"].includes((lang || "").toLowerCase()) ? lang : "en";
  }
  function langUrl(lang) {
    return getBasePath() + lang + "/";
  }

  // ---------- UTM / Referrer ----------
  function parseUTMs() {
    const sp = new URLSearchParams(location.search);
    const pick = (k) => {
      const v = sp.get(k);
      return v ? decodeURIComponent(v) : null;
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
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0xf) >> 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  const sessionId = localStorage.getItem(SID_KEY) || (localStorage.setItem(SID_KEY, uuid()), localStorage.getItem(SID_KEY));
  const firstSeen = localStorage.getItem(FIRST_SEEN_KEY) || (localStorage.setItem(FIRST_SEEN_KEY, new Date().toISOString()), localStorage.getItem(FIRST_SEEN_KEY));
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

  // ---------- IP + Geo (async) ----------
  // Try ipapi.co first; if blocked, fallback to ipify (IP only)
  fetch("https://ipapi.co/json/")
    .then((r) => r.ok ? r.json() : Promise.reject(new Error("ipapi.co not OK")))
    .then((j) => {
      context.ipAddress = j.ip || null;
      context.geo = {
        country: j.country_name || null,
        countryCode: j.country || null,
        region: j.region || null,
        city: j.city || null,
        timezone: j.timezone || null,
      };
      console.log("🌐 IP:", context.ipAddress);
      console.log("🗺️ Geo:", context.geo);

      // If Embedded Messaging is already ready, push fields now as an update
      tryPushPrechatFields();
    })
    .catch(() =>
      fetch("https://api.ipify.org?format=json")
        .then((r) => r.json())
        .then((j) => {
          context.ipAddress = j.ip || null;
          console.log("🌐 IP:", context.ipAddress);
          tryPushPrechatFields();
        })
        .catch((e) => console.warn("IP lookup failed:", e))
    );

  // ---------- Expose globally ----------
  window.TruffleContext = context;

  // ---------- Language selector wiring ----------
  const sel = document.getElementById("langSelect");
  if (sel) {
    sel.value = currentLang();
    sel.addEventListener("change", (e) => {
      const chosen = e.target.value;
      window.location.assign(langUrl(chosen));
    });
  }

  // ---------- Swap hero image by language (optional) ----------
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
  function buildPrechatFields() {
    const fields = {
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
    };
    // Drop null/undefined
    Object.keys(fields).forEach((k) => (fields[k] == null ? delete fields[k] : 0));
    return fields;
  }

  function tryPushPrechatFields() {
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

  // When Embedded Messaging is ready, push the current snapshot
  window.addEventListener("onEmbeddedMessagingReady", () => {
    console.log("✅ onEmbeddedMessagingReady");
    // If you want to set ESW UI language from URL:
    try {
      if (window.embeddedservice_bootstrap && embeddedservice_bootstrap.settings) {
        const map = { en: "en_US", fr: "fr_FR", de: "de_DE" };
        embeddedservice_bootstrap.settings.language = map[currentLang()] || "en_US";
      }
    } catch (e) {
      console.warn("Could not set ESW language:", e);
    }
    tryPushPrechatFields();
  });
})();