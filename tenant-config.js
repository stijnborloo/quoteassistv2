/* ═══════════════════════════════════════════════════════════════════════════
   TENANT CONFIG — Multi-tenant configuratie voor QuoteStudio SaaS
   ═══════════════════════════════════════════════════════════════════════════
   
   Dit bestand vervangt alle hardcoded Ricoh-waarden door een dynamisch
   config-object dat bij opstart geladen wordt vanuit Supabase.
   
   GEBRUIK:
   - TC.get("primaryColor")      → "#BE1622" (of de kleur van de tenant)
   - TC.get("companyName")       → "Ricoh Belgium NV" (of de naam van de tenant)
   - TC.logo()                   → <img> tag met tenant logo
   - TC.applyTheme()             → past CSS variabelen aan
   
   RICOH BACKWARD COMPATIBLE:
   - Alle Ricoh-waarden zijn de defaults → bestaande Ricoh-installatie blijft werken
   - Pas als er een tenant_id in de URL/sessie zit, worden waarden overschreven
   
   ═══════════════════════════════════════════════════════════════════════════ */

var TC = (function() {

  // ─── DEFAULTS (= huidige Ricoh-waarden, voor backward compatibility) ──────
  var _defaults = {

    // ── Identiteit ──────────────────────────────────────
    tenantId:         null,
    slug:             "ricoh",
    appName:          "Easy Quotation",
    appNameShort:     "Offerte",
    companyName:      "RICOH Belgium NV",
    companyNameShort: "RICOH Belgium",

    // ── Branding / kleuren ──────────────────────────────
    primaryColor:     "#BE1622",
    primaryDark:      "#9b1019",
    primaryLight:     "#fdf0f1",
    primaryRgb:       "190,22,34",     // voor rgba() gebruik
    accentColor:      "#D31D3F",       // logo-kleur in SVG

    // ── Logo ────────────────────────────────────────────
    // logoUrl vervangt RICOH_LOGO_SVG. Als null → val terug op ingebouwde SVG
    logoUrl:          null,
    logoHeight:       "26px",          // hoogte in offerte-footer/cover
    logoSvgInline:    null,            // voor PDF: inline SVG string (optioneel)

    // ── Bedrijfsgegevens ────────────────────────────────
    address:          "Medialaan 28A, 1800 Vilvoorde",
    phone:            "02/558.26.00",
    fax:              "02/558.27.15",
    email:            "",
    website:          "ricoh.be",
    vatNumber:        "BE 0418.856.193",
    rszNumber:        "010 -160 1843- 44",
    vatLabel:         "Ondernemingsnummer bij de BTW",
    rszLabel:         "Inschrijvingsnummer bij de RSZ",

    // ── Zone-terminologie ───────────────────────────────
    // "Vergaderzaal" wordt generiek. Verander dit per sector.
    zoneLabel:        "Vergaderzaal",    // enkelvoud
    zoneLabelPlural:  "Vergaderzalen",   // meervoud
    zoneTabLabel:     "Zalen",           // tab-naam in de UI
    zoneLabelFr:      "Salle de réunion",
    zoneLabelPluralFr:"Salles de réunion",
    zoneLabelEn:      "Meeting room",
    zoneLabelPluralEn:"Meeting rooms",

    // ── Offerte-instellingen ────────────────────────────
    currency:         "EUR",
    currencySymbol:   "€",
    defaultVatPct:    21,
    defaultLanguage:  "nl",
    defaultCoverTitle:"Gedetailleerde\nbudgetraming",

    // ── Leasing / As-a-Service ──────────────────────────
    leasingEnabled:   true,
    leasingLabel:     "MRaaS",
    leasingLabelFull: "Meeting Room as a Service",
    leasingLabelFr:   "Salle de réunion en tant que service",
    leasingLabelEn:   "Meeting Room as a Service",

    // ── Voorwaarden (offerte-PDF) ───────────────────────
    conditionsIntro: "Deze aanbieding is gebaseerd op de volgende voorwaarden en principes",
    conditions: [
      "De ruimte moet schoon en bruikbaar zijn voor aanvang der werken.",
      "Het openen/sluiten van verlaagde wanden of plafonds valt niet onder de verantwoordelijkheid van {companyNameShort}.",
      "Ricoh voldoet aan HDCP-voorschriften (High Bandwidth Digital Content Protection)."
    ],
    clientResponsibilities: [
      "Snij-, breek- en freeswerk en bouwkundige uithollingen.",
      "Verstevigingen voor montage van luidsprekers, flatscreens of projectoren.",
      "Installatie van bekabeling, LAN-aansluitpunten en 230V aansluitpunten.",
      "Alle kosten verbonden aan parkeren en wachttijd."
    ],
    maintenanceText: "Het onderhoudscontract omvat volledige ontzorging van de geïnstalleerde AV-oplossing vanaf de installatiedatum.",
    maintenanceItems: [
      "Helpdesk via online portaal — automatische tickettoewijzing",
      "Gedetailleerd field rapport na elke interventie",
      "Hersteltijd: next business day",
      "Eerste evaluatie na 1 maand gebruik"
    ],
    proposalItems: [
      "Projectmanagement",
      "Levering en terugname verpakkingen",
      "Installatie & testen"
    ],

    // ── Contactpagina (offerte-PDF) ─────────────────────
    contactSubtitle:    "Uw aanspreekpunten bij {companyNameShort}",
    contactPhotoCaption:"Uw {companyNameShort} Customer Contact Center staat elke werkdag voor u klaar",
    cccTitle:           "Customer Contact Center",
    cccHours:           "Elke werkdag, 8u – 17u",

    // ── Ondertekenpagina ────────────────────────────────
    signingLegalText:  "Door uw handtekening te plaatsen bevestigt u uw akkoord met deze offerte en de algemene voorwaarden van {companyName}",
    signingLegalUrl:   "https://www.ricoh.be/nl/company/legal",
    signingLegalLabel: "ricoh.be/nl/company/legal",
    signingCheckbox:   "Ik aanvaard de algemene voorwaarden van {companyName}",
    signingFooter:     "{companyName} — {address} — {website}",

    // ── Login-pagina ────────────────────────────────────
    loginTitle:        "Welkom terug",
    loginSubtitle:     "Meld je aan met je {companyNameShort}-account",
    loginEmailPlaceholder: "naam@ricoh.be",
    loginFooter:       "© {companyName} · Uitnodiging vereist — neem contact op met de beheerder",
    loginTagline:      "Professionele AV-offertes — sneller, slimmer en altijd correct opgemaakt.",

    // ── AI-prompts ──────────────────────────────────────
    aiRole:            "Je bent AV & meeting room specialist bij {companyNameShort}.",
    aiRoleFr:          "Tu es spécialiste AV & salles de réunion chez {companyNameShort}.",
    aiRoleEn:          "You are an AV & meeting room specialist at {companyNameShort}.",
    aiTranslateRole:   "You are a professional translator and AV specialist at {companyNameShort}. Translate accurately and naturally.",

    // ── Bestandsformaat ─────────────────────────────────
    sessionFileExtension: ".ricoh",     // wordt bv. ".quote" of ".qs"
    sessionFileLabel:     "Sessie opslaan (.ricoh)",
    sessionLoadLabel:     "Sessie laden (.ricoh)",

    // ── localStorage-prefix (per tenant uniek) ──────────
    storagePrefix:      "ricoh_",

    // ── Dashboard kolom-labels ──────────────────────────
    dashboardOwnerLabel:   "Ricoh medewerker",
    dashboardOwnerLabelFr: "Collaborateur Ricoh",
    dashboardOwnerLabelEn: "Ricoh employee",

    // ── PWA manifest ────────────────────────────────────
    pwaName:           "Ricoh Offerte Studio Pro v5",
    pwaShortName:      "Ricoh Offerte",
    pwaThemeColor:     "#BE1622",
    pwaBackgroundColor:"#BE1622",
  };

  // ─── RUNTIME CONFIG (defaults + tenant overrides) ──────────────────────────
  var _config = {};
  var _loaded = false;
  var _onLoadCallbacks = [];

  // ─── INIT: kopie van defaults ──────────────────────────────────────────────
  function _reset() {
    _config = {};
    for (var k in _defaults) {
      if (_defaults.hasOwnProperty(k)) _config[k] = _defaults[k];
    }
  }
  _reset();

  // ─── TEMPLATE-INTERPOLATIE ─────────────────────────────────────────────────
  // Vervangt {companyName}, {companyNameShort}, {address}, {website} in strings
  function _interpolate(val) {
    if (typeof val !== "string") return val;
    return val
      .replace(/\{companyName\}/g,      _config.companyName || "")
      .replace(/\{companyNameShort\}/g,  _config.companyNameShort || "")
      .replace(/\{address\}/g,           _config.address || "")
      .replace(/\{website\}/g,           _config.website || "")
      .replace(/\{phone\}/g,             _config.phone || "")
      .replace(/\{email\}/g,             _config.email || "")
      .replace(/\{vatNumber\}/g,         _config.vatNumber || "")
      .replace(/\{zoneLabel\}/g,         _config.zoneLabel || "Zone")
      .replace(/\{zoneLabelPlural\}/g,   _config.zoneLabelPlural || "Zones");
  }

  // ─── PUBLIC API ────────────────────────────────────────────────────────────

  return {

    // Haal een waarde op (met template-interpolatie)
    get: function(key) {
      var val = _config.hasOwnProperty(key) ? _config[key] : _defaults[key];
      return _interpolate(val);
    },

    // Haal een raw waarde op (zonder interpolatie)
    getRaw: function(key) {
      return _config.hasOwnProperty(key) ? _config[key] : _defaults[key];
    },

    // Stel een waarde in (runtime override)
    set: function(key, val) {
      _config[key] = val;
    },

    // Bulk override vanuit een object (bv. Supabase tenant_settings)
    apply: function(overrides) {
      if (!overrides) return;
      for (var k in overrides) {
        if (overrides.hasOwnProperty(k) && overrides[k] !== null && overrides[k] !== undefined) {
          _config[k] = overrides[k];
        }
      }
    },

    // Reset naar defaults
    reset: _reset,

    // Is tenant-config al geladen?
    isLoaded: function() { return _loaded; },

    // ── THEME: pas CSS variabelen aan op basis van tenant-kleuren ────────────
    applyTheme: function() {
      var root = document.documentElement;
      root.style.setProperty("--red",  _config.primaryColor);
      root.style.setProperty("--rd",   _config.primaryDark);
      root.style.setProperty("--rl",   _config.primaryLight);

      // Meta theme-color
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", _config.primaryColor);

      // Update titel
      document.title = _config.appName + " — " + _config.companyNameShort;
    },

    // ── LOGO: geeft HTML terug voor het logo ────────────────────────────────
    logo: function(height) {
      var h = height || _config.logoHeight || "26px";
      if (_config.logoUrl) {
        return '<img src="' + _config.logoUrl + '" alt="' + (_config.companyNameShort||"Logo") 
             + '" style="display:block;height:' + h + ';width:auto" crossorigin="anonymous">';
      }
      // Fallback: inline SVG (voor Ricoh of als logoSvgInline is ingesteld)
      if (_config.logoSvgInline) {
        return _config.logoSvgInline;
      }
      // Laatste fallback: tekst
      return '<span style="font-size:16px;font-weight:900;color:' + _config.primaryColor + '">' 
           + (_config.companyNameShort||"Logo") + '</span>';
    },

    // ── LOGO voor PDF (SVG string of img tag) ───────────────────────────────
    logoPdf: function() {
      if (_config.logoSvgInline) return _config.logoSvgInline;
      if (_config.logoUrl) {
        return '<img src="' + _config.logoUrl + '" alt="" crossorigin="anonymous" '
             + 'style="display:block;height:' + (_config.logoHeight||"26px") + ';width:auto">';
      }
      return '<span style="font-size:16px;font-weight:900;color:' + _config.primaryColor + '">'
           + (_config.companyNameShort||"") + '</span>';
    },

    // ── FOOTER voor offerte-PDF ─────────────────────────────────────────────
    pdfFooter: function() {
      var parts = [_config.companyName];
      if (_config.address) parts.push(_config.address);
      if (_config.phone)   parts.push(_config.phone);
      return parts.join(" \u2014 ");
    },

    // ── STORAGE KEYS (met tenant-prefix) ────────────────────────────────────
    storageKey: function(key) {
      return (_config.storagePrefix || "qs_") + key;
    },

    // ── SESSIE-BESTANDSEXTENSIE ─────────────────────────────────────────────
    fileExt: function() {
      return _config.sessionFileExtension || ".quote";
    },

    // ── LADEN VANUIT SUPABASE ───────────────────────────────────────────────
    loadFromSupabase: async function(supaClient, tenantId) {
      if (!supaClient || !tenantId) {
        console.warn("TC.loadFromSupabase: geen client of tenantId");
        _loaded = true;
        return;
      }

      try {
        var resp = await supaClient
          .from("tenant_settings")
          .select("*")
          .eq("tenant_id", tenantId)
          .single();

        if (resp.error) {
          console.error("TC laden mislukt:", resp.error);
        } else if (resp.data) {
          // Map Supabase kolommen naar config-keys
          var d = resp.data;
          TC.apply({
            tenantId:          tenantId,
            companyName:       d.company_name,
            companyNameShort:  d.company_name_short || d.company_name,
            appName:           d.app_name || _defaults.appName,
            primaryColor:      d.primary_color,
            primaryDark:       d.accent_color || _darken(d.primary_color),
            primaryLight:      d.light_color  || _lighten(d.primary_color),
            logoUrl:           d.logo_url,
            address:           d.address,
            phone:             d.phone,
            fax:               d.fax,
            email:             d.email,
            website:           d.website,
            vatNumber:         d.vat_number,
            rszNumber:         d.rsz_number,
            vatLabel:          d.vat_label,
            rszLabel:          d.rsz_label,
            zoneLabel:         d.zone_label,
            zoneLabelPlural:   d.zone_label_plural,
            zoneTabLabel:      d.zone_tab_label,
            currency:          d.currency,
            defaultVatPct:     d.default_vat_pct,
            defaultLanguage:   d.default_language,
            leasingEnabled:    d.leasing_enabled,
            leasingLabel:      d.leasing_label,
            leasingLabelFull:  d.leasing_label_full,
            conditions:        d.conditions,
            clientResponsibilities: d.client_responsibilities,
            maintenanceText:   d.maintenance_text,
            maintenanceItems:  d.maintenance_items,
            proposalItems:     d.proposal_items,
            signingLegalText:  d.signing_legal_text,
            signingLegalUrl:   d.signing_legal_url,
            contactSubtitle:   d.contact_subtitle,
            aiRole:            d.ai_role,
            loginEmailPlaceholder: d.login_email_placeholder,
            loginTagline:      d.login_tagline,
            storagePrefix:     d.storage_prefix || (tenantId.substring(0,8) + "_"),
            sessionFileExtension: d.session_file_extension,
          });
          TC.applyTheme();
        }
      } catch(e) {
        console.error("TC laden exception:", e);
      }

      _loaded = true;
      // Fire callbacks
      _onLoadCallbacks.forEach(function(fn){ try{fn();}catch(e){} });
      _onLoadCallbacks = [];
    },

    // Registreer callback voor als config geladen is
    onLoad: function(fn) {
      if (_loaded) { try{fn();}catch(e){} }
      else _onLoadCallbacks.push(fn);
    },

    // ── DEBUG: toon alle config ─────────────────────────────────────────────
    dump: function() {
      console.table(_config);
      return _config;
    },

    // ── EXPORT: voor opslaan in sessiebestand ───────────────────────────────
    exportBranding: function() {
      return {
        companyName:      _config.companyName,
        companyNameShort: _config.companyNameShort,
        primaryColor:     _config.primaryColor,
        logoUrl:          _config.logoUrl,
        address:          _config.address,
        phone:            _config.phone,
        website:          _config.website,
        vatNumber:        _config.vatNumber,
      };
    }
  };

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  function _darken(hex) {
    if (!hex) return "#333";
    try {
      var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      r = Math.max(0, Math.floor(r * 0.75));
      g = Math.max(0, Math.floor(g * 0.75));
      b = Math.max(0, Math.floor(b * 0.75));
      return "#" + r.toString(16).padStart(2,"0") + g.toString(16).padStart(2,"0") + b.toString(16).padStart(2,"0");
    } catch(e) { return hex; }
  }
  function _lighten(hex) {
    if (!hex) return "#f8f9fa";
    try {
      var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      r = Math.min(255, Math.floor(r + (255-r) * 0.92));
      g = Math.min(255, Math.floor(g + (255-g) * 0.92));
      b = Math.min(255, Math.floor(b + (255-b) * 0.92));
      return "#" + r.toString(16).padStart(2,"0") + g.toString(16).padStart(2,"0") + b.toString(16).padStart(2,"0");
    } catch(e) { return hex; }
  }

})();
