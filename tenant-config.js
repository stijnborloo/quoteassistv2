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
     TC.apply()         → past kleur/titel/theme-color/manifest + merktekst toe
     TC.applyBrand()    → vervangt de tekst "QuoteStudio" overal door de
                          tenant-naam (ook in dynamische inhoud, via observer)
     TC.load(supabase)  → async: overschrijf statische config uit Supabase

   Merktekst-vervanging:
     De letterlijke tekst TC.brandToken ("QuoteStudio") wordt in alle zichtbare
     tekst vervangen door TC.brandName() (= companyNameShort van de tenant).
     Zet data-no-brand op een element om dat element over te slaan.

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
      coverColor:       "",          /* leeg → gebruikt primaryColor voor de cover */
      logoBackdrop:     false,        /* true → wit vlak achter het cover-logo */
      showMraas:        false,        /* true → toont de MRaaS-knop (Ricoh-specifiek) */
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

  /* Registreer/overschrijf een tenant in het register (statisch + lokaal) */
  function _register(id, cfg) {
    TENANTS[id] = Object.assign({}, TENANTS[id] || {}, cfg, { slug: id });
  }

  /* Laad tenants die in de app zijn geconfigureerd en lokaal bewaard
     (sleutel "qs_tenant_cfg:<slug>"), zodat ze na herladen herkend worden. */
  try {
    for (var _i = 0; _i < global.localStorage.length; _i++) {
      var _k = global.localStorage.key(_i);
      if (_k && _k.indexOf("qs_tenant_cfg:") === 0) {
        try { _register(_k.slice(14), JSON.parse(global.localStorage.getItem(_k))); }
        catch (e) {}
      }
    }
  } catch (e) {}

  /* ═══════════════════════════════════════════════════════════════
     2. HULPFUNCTIES
     ═══════════════════════════════════════════════════════════════ */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Render een logo (SVG of <img>) op een expliciete hoogte in px met
     proportionele breedte. Robuust tegen willekeurige SVG's:
       • forceert preserveAspectRatio="xMidYMid meet" → knipt nooit inhoud weg
         (hoogstens wat witruimte ernaast), lost 'slice'/'none'-clipping op;
       • zorgt dat er altijd een viewBox is (afgeleid uit width/height indien nodig);
       • expliciete px-afmetingen zodat de PDF-generator (html2canvas) niet uitrekt. */
  function fitLogo(html, h) {
    var H = (typeof h === "number" && h > 0) ? h : 28;
    var inner = String(html || "");

    if (/<svg\b/i.test(inner)) {
      inner = inner.replace(/<svg\b([^>]*)>/i, function (m, attrs) {
        /* originele afmetingen ophalen */
        var vb = attrs.match(/viewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
        var wA = attrs.match(/\bwidth\s*=\s*["']?([\d.]+)/i);
        var hA = attrs.match(/\bheight\s*=\s*["']?([\d.]+)/i);

        var vbW, vbH, vbStr;
        if (vb) {
          vbW = parseFloat(vb[3]); vbH = parseFloat(vb[4]);
          vbStr = vb[1] + " " + vb[2] + " " + vb[3] + " " + vb[4];
        } else if (wA && hA) {
          vbW = parseFloat(wA[1]); vbH = parseFloat(hA[1]);
          vbStr = "0 0 " + vbW + " " + vbH;   /* viewBox synthetiseren */
        }
        var aspect = (vbW && vbH) ? (vbW / vbH) : 3;
        if (!aspect || !isFinite(aspect)) aspect = 3;
        var W = Math.round(H * aspect);

        /* alles strippen wat we zelf gaan zetten */
        attrs = attrs
          .replace(/\swidth\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, "")
          .replace(/\sheight\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, "")
          .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/i, "")
          .replace(/\spreserveAspectRatio\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, "");
        if (vbStr && !/viewBox/i.test(attrs)) attrs += ' viewBox="' + vbStr + '"';

        return '<svg' + attrs +
               ' preserveAspectRatio="xMidYMid meet"' +
               ' width="' + W + '" height="' + H + '"' +
               ' style="width:' + W + 'px;height:' + H + 'px;display:block">';
      });
      return '<span style="display:inline-block;line-height:0">' + inner + '</span>';
    }

    if (/<img\b/i.test(inner)) {
      inner = inner.replace(/<img\b([^>]*)>/i, function (m, attrs) {
        attrs = attrs.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/i, "")
                     .replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, "");
        return '<img' + attrs + ' height="' + H +
               '" style="height:' + H + 'px;width:auto;display:block">';
      });
      return '<span style="display:inline-block;line-height:0">' + inner + '</span>';
    }

    return inner;
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

    /* De letterlijke merktekst in de HTML die vervangen wordt door de
       tenant-naam. Pas dit aan als je basismerk anders heet. */
    brandToken: "QuoteStudio",

    all: function () {
      return TENANTS[TC.tenant] || TENANTS["default"];
    },

    get: function (key) {
      var t = TC.all();
      var v = t[key];
      if (v == null) return "";
      return interp(v, t);
    },

    logoPdf: function (h) {
      var t = TC.all();
      var H = (typeof h === "number" && h > 0) ? h : 28;
      if (t.logo) return fitLogo(t.logo, H);
      /* geen logo → woordmerk in de merkkleur, geschaald naar de hoogte */
      return '<span style="font-family:Inter,Arial,sans-serif;font-weight:800;'
           + 'font-size:' + Math.round(H * 0.72) + 'px;line-height:1;letter-spacing:-.5px;color:'
           + t.primaryColor + '">' + esc(t.companyNameShort) + '</span>';
    },

    logoWhitePdf: function (h) {
      var t = TC.all();
      var H = (typeof h === "number" && h > 0) ? h : 28;
      if (t.logoWhite) return fitLogo(t.logoWhite, H);
      return '<span style="font-family:Inter,Arial,sans-serif;font-weight:800;'
           + 'font-size:' + Math.round(H * 0.72) + 'px;line-height:1;letter-spacing:-.5px;color:#fff">'
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
      _register(id, cfg);
    },

    /* Lijst van alle bekende tenant-slugs (statisch + lokaal geladen) */
    list: function () {
      return Object.keys(TENANTS);
    },

    /* Pas kleur, documenttitel, theme-color en manifest toe op de pagina */
    apply: function () {
      var t = TC.all();
      try {
        var root = document.documentElement;
        root.style.setProperty("--red", t.primaryColor);
        root.style.setProperty("--rl", hexToRgba(t.primaryColor, 0.08));
        /* cover-kleur (los instelbaar; valt terug op de merkkleur) */
        var cover = t.coverColor || t.primaryColor;
        root.style.setProperty("--cover", cover);
        root.style.setProperty("--cover-d", darken(cover, 0.28));
        /* optioneel wit vlak achter het cover-logo (leesbaar op elke kleur) */
        var chip = !!t.logoBackdrop;
        root.style.setProperty("--logo-bg", chip ? "#fff" : "transparent");
        root.style.setProperty("--logo-pad", chip ? "7px 11px" : "0");
        root.style.setProperty("--logo-radius", chip ? "6px" : "0");
        root.style.setProperty("--logo-shadow", chip ? "0 2px 10px rgba(0,0,0,.18)" : "none");
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
      TC.applyBrand();
      TC.applyHeaderLogo();
      /* MRaaS-knop is Ricoh-specifiek: enkel tonen als de tenant het aanzet */
      try {
        var mb = document.getElementById("mraas-btn");
        if (mb) mb.style.display = t.showMraas ? "" : "none";
      } catch (e) {}
    },

    /* Zet het tenant-logo helemaal links in de app-balk (#topbar-logo).
       Witte merktekst was onzichtbaar op de witte balk; dit toont het echte
       logo (of een zichtbaar woordmerk in de merkkleur als er geen logo is). */
    applyHeaderLogo: function () {
      try {
        var el = document.getElementById("topbar-logo");
        if (!el) return;
        el.setAttribute("data-no-brand", "");     /* niet door de merk-sweep laten aanraken */
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.innerHTML = TC.logoPdf(30);            /* logo óf woordmerk in merkkleur */
      } catch (e) {}
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

    /* De naam die de merktekst "QuoteStudio" op de pagina vervangt */
    brandName: function () {
      var t = TC.all();
      return t.companyNameShort || t.companyName || TC.brandToken;
    },

    /* Vervang overal de zichtbare merktekst door de tenant-naam +
       werk de head-metagegevens bij. Veilig bij default (dan geen wijziging). */
    applyBrand: function () {
      var name = TC.brandName();

      /* Head: apple-titel + omschrijving */
      try {
        var at = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (at) at.setAttribute("content", TC.all().pwaShortName || name);
        var ds = document.querySelector('meta[name="description"]');
        if (ds) ds.setAttribute("content", "Professionele offertetool — " + name);
      } catch (e) {}

      /* Niets te vervangen wanneer de tenant-naam gelijk is aan het merk-token */
      if (name === TC.brandToken) return;

      brandSweep(document.body, TC.brandToken, name);
      installBrandObserver();
    },

    /* ── Async: overschrijf statische config met een Supabase-rij ──
       Verwacht een geïnitialiseerde supabase-js client.
       Tabel 'tenants' met kolom 'slug' (zie supabase/tenants.sql). */
    load: async function (supa) {
      try {
        if (!supa || !supa.from) return TC.all();
        var res = await supa.from("qs_tenants").select("*").eq("slug", TC.tenant).maybeSingle();
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
      logo_svg: "logo", logo_svg_white: "logoWhite", pdf_footer: "pdfFooter",
      cover_color: "coverColor"
    };
    Object.keys(map).forEach(function (k) {
      if (r[k] != null && r[k] !== "") out[map[k]] = r[k];
    });
    if (typeof r.logo_backdrop !== "undefined" && r.logo_backdrop !== null) {
      out.logoBackdrop = (r.logo_backdrop === true || r.logo_backdrop === "true" || r.logo_backdrop === 1);
    }
    if (typeof r.show_mraas !== "undefined" && r.show_mraas !== null) {
      out.showMraas = (r.show_mraas === true || r.show_mraas === "true" || r.show_mraas === 1);
    }
    return out;
  }

  /* Vervang de merktekst in alle zichtbare tekstknopen onder 'root'.
     Slaat scripts, styles, invoervelden en [data-no-brand] over. */
  function brandSweep(root, from, to) {
    try {
      if (!root || from === to) return;
      var rx = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          var p = node.parentNode;
          if (!p) return NodeFilter.FILTER_REJECT;
          var tag = p.nodeName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA")
            return NodeFilter.FILTER_REJECT;
          if (p.closest && p.closest("[data-no-brand]"))
            return NodeFilter.FILTER_REJECT;
          return node.nodeValue.indexOf(from) !== -1
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
      });
      var nodes = [], n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(function (node) {
        var nv = node.nodeValue.replace(rx, to);
        if (nv !== node.nodeValue) node.nodeValue = nv;   /* enkel schrijven bij wijziging → geen lus */
      });

      /* Ook placeholder-attributen op invoervelden meenemen */
      try {
        var inputs = root.querySelectorAll ? root.querySelectorAll("[placeholder]") : [];
        Array.prototype.forEach.call(inputs, function (el) {
          var ph = el.getAttribute("placeholder");
          if (ph && ph.indexOf(from) !== -1) el.setAttribute("placeholder", ph.replace(rx, to));
        });
      } catch (e) {}
    } catch (e) { /* nooit blokkeren */ }
  }

  /* Houd de merktekst toegepast op dynamisch bijgerenderde inhoud */
  var _brandObserver = null;
  function installBrandObserver() {
    try {
      if (_brandObserver) return;
      if (TC.brandName() === TC.brandToken) return;   /* default → niet nodig */
      if (typeof MutationObserver === "undefined" || !document.body) return;
      var pending = false;
      _brandObserver = new MutationObserver(function () {
        if (pending) return;
        pending = true;
        var run = function () {
          pending = false;
          brandSweep(document.body, TC.brandToken, TC.brandName());
        };
        (global.requestAnimationFrame || function (f) { setTimeout(f, 16); })(run);
      });
      _brandObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) { /* observer optioneel */ }
  }

  function hexToRgba(hex, a) {
    try {
      hex = String(hex).replace("#", "");
      if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
      var n = parseInt(hex, 16);
      return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
    } catch (e) { return "rgba(37,99,235," + a + ")"; }
  }

  /* Maak een hex-kleur donkerder met factor f (0..1). Voor de cover-gradient. */
  function darken(hex, f) {
    try {
      hex = String(hex).replace("#", "");
      if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
      var n = parseInt(hex, 16);
      var r = Math.round(((n >> 16) & 255) * (1 - f));
      var g = Math.round(((n >> 8) & 255) * (1 - f));
      var b = Math.round((n & 255) * (1 - f));
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch (e) { return hex; }
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
