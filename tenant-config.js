/* ═══════════════════════════════════════════════════════════════════════
   tenant-config.js — QuoteStudio multi-tenant configuratielaag
   ───────────────────────────────────────────────────────────────────────
   Losstaande white-label versie: neutraal, zonder klant-specifieke branding.
   Nieuwe tenants voeg je toe in de TENANTS-registry hieronder óf — beter —
   als rij in de Supabase 'tenants'-tabel (zie supabase/tenants.sql).

   Levert het globale TC-object dat index.html verwacht:

     TC.get(key)        → string, met {token}-interpolatie
     TC.logoPdf()       → logo-HTML/SVG voor PDF & preview (auto-woordmerk)
     TC.pdfFooter()     → voettekst onderaan PDF-pagina's
     TC.tenant          → id van de actieve tenant
     TC.all()           → volledig config-object van de actieve tenant
     TC.set(id)         → wissel actieve tenant (+ herbrandt de UI)
     TC.apply()         → past kleur/titel/theme-color/manifest toe
     TC.load(supabase)  → async: overschrijf statische config uit Supabase

   Tenant-resolutie (eerste match wint):
     1. ?tenant=<id> in de URL
     2. localStorage "qs_tenant"
     3. subdomein  (acme.quotestudio.app → "acme")
     4. fallback   → "default"
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  /* ═══════════════════════════════════════════════════════════════
     1. TENANT-REGISTER  (statische fallback / offline-modus)
        Supabase kan deze waarden runtime overschrijven via TC.load().
     ═══════════════════════════════════════════════════════════════ */
  var TENANTS = {

    /* ── Standaard white-label baseline ─────────────────────────── */
    "default": {
      slug:             "default",
      companyName:      "QuoteStudio Demo BV",
      companyNameShort: "QuoteStudio",
      primaryColor:     "#2563eb",
      website:          "www.quotestudio.app",
      address:          "",
      rszLabel:         "Inschrijvingsnummer bij de RSZ",
      rszNumber:        "",
      vatLabel:         "Ondernemingsnummer bij de BTW",
      vatNumber:        "",
      signingLegalUrl:  "",
      contactSubtitle:  "Uw aanspreekpunten bij {companyNameShort}",
      pwaName:          "QuoteStudio — Offerte Studio",
      pwaShortName:     "QuoteStudio",
      logo:             "",          /* leeg → auto-woordmerk (zie logoPdf) */
      logoWhite:        "",
      pdfFooter:        "{companyName} — {website}"
    }

    /* Nieuwe tenant toevoegen? Kopieer het blok hierboven met een eigen
       slug, of zet de rij in de Supabase 'tenants'-tabel (aanbevolen).
       Voeg voor een eigen logo een SVG-string toe onder 'logo'/'logoWhite'. */
  };

  /* ═══════════════════════════════════════════════════════════════
     2. HULPFUNCTIES
     ═══════════════════════════════════════════════════════════════ */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* {token} → waarde uit de tenant; max. 3 niveaus diep (voorkomt loops) */
  function interp(str, t, depth) {
    if (typeof str !== "string" || str.indexOf("{") === -1) return str;
    if (depth == null) depth = 0;
    if (depth > 3) return str;
    return str.replace(/\{(\w+)\}/g, function (_, k) {
      var v = t[k];
      return v == null ? "" : interp(String(v), t, depth + 1);
    });
  }

  function resolveTenantId() {
    /* 1. expliciete override in de URL */
    try {
      var q = new URLSearchParams(global.location.search).get("tenant");
      if (q && TENANTS[q]) return q;
    } catch (e) {}
    /* 2. door de app gezette voorkeur */
    try {
      var ls = global.localStorage.getItem("qs_tenant");
      if (ls && TENANTS[ls]) return ls;
    } catch (e) {}
    /* 3. subdomein */
    try {
      var host = global.location.hostname.split(".");
      if (host.length > 2 && TENANTS[host[0]]) return host[0];
    } catch (e) {}
    /* 4. fallback */
    return "default";
  }

  /* ═══════════════════════════════════════════════════════════════
     3. HET TC-OBJECT
     ═══════════════════════════════════════════════════════════════ */
  var TC = {
    tenant: resolveTenantId(),

    all: function () {
      return TENANTS[TC.tenant] || TENANTS["default"];
    },

    get: function (key) {
      var t = TC.all();
      var v = t[key];
      if (v == null) return "";
      return interp(v, t);
    },

    logoPdf: function () {
      var t = TC.all();
      if (t.logo) return t.logo;
      /* geen SVG → automatische woordmerk-fallback in de merkkleur */
      return '<span style="font-family:Inter,Arial,sans-serif;font-weight:800;'
           + 'font-size:20px;letter-spacing:-.5px;color:' + t.primaryColor + '">'
           + esc(t.companyNameShort) + '</span>';
    },

    logoWhitePdf: function () {
      var t = TC.all();
      if (t.logoWhite) return t.logoWhite;
      return '<span style="font-family:Inter,Arial,sans-serif;font-weight:800;'
           + 'font-size:20px;letter-spacing:-.5px;color:#fff">'
           + esc(t.companyNameShort) + '</span>';
    },

    pdfFooter: function () {
      var t = TC.all();
      return interp(t.pdfFooter || "{companyName}", t);
    },

    /* Wissel actieve tenant en herbrand de UI */
    set: function (id) {
      if (!TENANTS[id]) { console.warn("[TC] onbekende tenant:", id); return; }
      TC.tenant = id;
      try { global.localStorage.setItem("qs_tenant", id); } catch (e) {}
      TC.apply();
    },

    /* Registreer/overschrijf een tenant runtime (gebruikt door TC.load) */
    register: function (id, cfg) {
      TENANTS[id] = Object.assign({}, TENANTS[id] || {}, cfg, { slug: id });
    },

    /* Pas kleur, documenttitel, theme-color en manifest toe op de pagina */
    apply: function () {
      var t = TC.all();
      try {
        var root = document.documentElement;
        root.style.setProperty("--red", t.primaryColor);
        root.style.setProperty("--rl", hexToRgba(t.primaryColor, 0.08));
      } catch (e) {}
      try {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", t.primaryColor);
      } catch (e) {}
      try {
        if (document.title && /QuoteStudio/i.test(document.title)) {
          document.title = (t.pwaName || t.companyNameShort) + " — Offerte Studio";
        }
      } catch (e) {}
      TC.applyManifest();
    },

    /* Genereer een tenant-specifieke manifest en hang hem in de <head> */
    applyManifest: function () {
      try {
        var t = TC.all();
        var base = (function () {
          try { return new URL(".", global.location.href).pathname; }
          catch (e) { return "/"; }
        })();
        var mf = {
          name:             t.pwaName || (t.companyNameShort + " — Offerte Studio"),
          short_name:       t.pwaShortName || t.companyNameShort,
          description:      "Professionele offertetool — " + t.companyName,
          start_url:        base,
          scope:            base,
          display:          "standalone",
          background_color:  t.primaryColor,
          theme_color:       t.primaryColor,
          orientation:      "any",
          lang:             "nl",
          icons: [
            { src: base + "icon192.png",        sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: base + "icon512.png",        sizes: "512x512", type: "image/png", purpose: "any maskable" },
            { src: base + "appletouchicon.png", sizes: "180x180", type: "image/png" }
          ],
          categories: ["business", "productivity"]
        };
        var blob = new Blob([JSON.stringify(mf)], { type: "application/manifest+json" });
        var url  = URL.createObjectURL(blob);
        var link = document.querySelector('link[rel="manifest"]');
        if (!link) {
          link = document.createElement("link");
          link.rel = "manifest";
          document.head.appendChild(link);
        }
        link.href = url;
      } catch (e) { /* manifest optioneel — nooit blokkeren */ }
    },

    /* ── Async: overschrijf statische config met een Supabase-rij ──
       Verwacht een geïnitialiseerde supabase-js client.
       Tabel 'tenants' met kolom 'slug' (zie supabase/tenants.sql). */
    load: async function (supa) {
      try {
        if (!supa || !supa.from) return TC.all();
        var res = await supa.from("tenants").select("*").eq("slug", TC.tenant).maybeSingle();
        if (res && res.data) {
          TC.register(TC.tenant, mapRow(res.data));
          TC.apply();
        }
      } catch (e) {
        console.log("[TC] Supabase-config overslaan:", e && e.message);
      }
      return TC.all();
    }
  };

  /* DB-kolommen → config-sleutels (snake_case → camelCase waar nodig) */
  function mapRow(r) {
    var out = {};
    var map = {
      company_name: "companyName", company_name_short: "companyNameShort",
      primary_color: "primaryColor", website: "website", address: "address",
      rsz_label: "rszLabel", rsz_number: "rszNumber",
      vat_label: "vatLabel", vat_number: "vatNumber",
      signing_legal_url: "signingLegalUrl", contact_subtitle: "contactSubtitle",
      pwa_name: "pwaName", pwa_short_name: "pwaShortName",
      logo_svg: "logo", logo_svg_white: "logoWhite", pdf_footer: "pdfFooter"
    };
    Object.keys(map).forEach(function (k) {
      if (r[k] != null && r[k] !== "") out[map[k]] = r[k];
    });
    return out;
  }

  function hexToRgba(hex, a) {
    try {
      hex = String(hex).replace("#", "");
      if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
      var n = parseInt(hex, 16);
      return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
    } catch (e) { return "rgba(37,99,235," + a + ")"; }
  }

  /* ═══════════════════════════════════════════════════════════════
     4. INITIALISATIE — brand direct toepassen (script staat in <head>)
     ═══════════════════════════════════════════════════════════════ */
  global.TC = TC;
  function boot() { try { TC.apply(); } catch (e) {} }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
    try { document.documentElement.style.setProperty("--red", TC.all().primaryColor); } catch (e) {}
  } else {
    boot();
  }

})(typeof window !== "undefined" ? window : this);
