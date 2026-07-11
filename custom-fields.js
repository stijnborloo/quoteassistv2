/* ═══════════════════════════════════════════════════════════════════════════
   CUSTOM FIELDS ENGINE — Dynamische velden voor zones en items
   ═══════════════════════════════════════════════════════════════════════════
   
   Maakt QuoteStudio volledig sector-agnostisch:
   - Elke tenant definieert zelf welke velden een zone heeft
   - Elke tenant definieert zelf welke velden een item heeft
   - Velden verschijnen automatisch in de UI, PDF en AI-prompts
   - Sectorpresets (AV, Security, Solar, ...) als startpunt
   
   GEBRUIK:
   - CF.zoneFields()      → array van velddefinities voor zones
   - CF.itemFields()      → array van velddefinities voor items
   - CF.renderForm(...)   → genereert HTML-formulier voor een zone/item
   - CF.getValue(obj,key) → haalt waarde op (met fallback)
   - CF.applyPreset("security") → laadt sectorpreset
   
   ═══════════════════════════════════════════════════════════════════════════ */

var CF = (function() {

  // ─── VELDTYPEN ────────────────────────────────────────────────────────────
  // Elk veld heeft: key, label, type, options (bij select/multi), unit, 
  //                 default, required, showInPdf, showInList, group, hint
  //
  // Types: text, number, select, multi, textarea, toggle, photo, color,
  //        computed (berekend veld), url, email, date

  // ─── STANDAARD ZONE-VELDEN (altijd aanwezig) ─────────────────────────────
  var _coreZoneFields = [
    { key: "name",  label: "Naam",        type: "text",     required: true,  showInPdf: true, showInList: true, core: true },
    { key: "desc",  label: "Beschrijving",type: "textarea", required: false, showInPdf: true, showInList: false, core: true },
    { key: "img",   label: "Foto",        type: "photo",    required: false, showInPdf: true, showInList: true, core: true },
  ];

  // ─── STANDAARD ITEM-VELDEN (altijd aanwezig) ─────────────────────────────
  var _coreItemFields = [
    { key: "name",     label: "Productnaam",   type: "text",   required: true,  showInPdf: true,  showInList: true, core: true },
    { key: "ref",      label: "Referentie",    type: "text",   required: false, showInPdf: true,  showInList: true, core: true },
    { key: "qty",      label: "Aantal",        type: "number", required: true,  showInPdf: true,  showInList: true, core: true, default: 1 },
    { key: "price",    label: "Eenheidsprijs", type: "number", required: false, showInPdf: true,  showInList: true, core: true, unit: "€" },
    { key: "desc",     label: "Beschrijving",  type: "textarea",required:false, showInPdf: true,  showInList: false,core: true },
    { key: "img",      label: "Foto",          type: "photo",  required: false, showInPdf: true,  showInList: true, core: true },
    { key: "optional", label: "Optioneel",     type: "toggle", required: false, showInPdf: true,  showInList: true, core: true, default: false },
  ];

  // ─── SECTOR PRESETS ───────────────────────────────────────────────────────
  var _presets = {

    // ── AV / Vergaderzalen (= huidige Ricoh-configuratie) ───────────────────
    av: {
      id: "av",
      name: "AV & Vergaderzalen",
      icon: "🎬",
      zoneLabel: "Vergaderzaal",
      zoneLabelPlural: "Vergaderzalen",
      zoneFields: [
        { key: "capacity",    label: "Capaciteit",     type: "number",  unit: "personen", showInPdf: true, group: "Specificaties" },
        { key: "roomType",    label: "Type",           type: "select",  options: ["Vergaderzaal","Boardroom","Huddle room","Training room","Auditorium","Lobby/onthaal","Andere"], showInPdf: true, group: "Specificaties" },
        { key: "connectivity",label: "Connectiviteit", type: "multi",   options: ["HDMI","USB-C","Wireless","Bluetooth","Dante/AES67"], showInPdf: true, group: "Specificaties" },
        { key: "existingAv",  label: "Bestaande AV",   type: "textarea",showInPdf: false, group: "Context", hint: "Wat zit er nu al? (voor AI-beschrijving)" },
      ],
      itemFields: [
        { key: "brand",       label: "Merk",           type: "text",    showInPdf: true,  showInList: true, group: "Product" },
        { key: "category",    label: "Categorie",      type: "select",  options: ["Display","Camera","Speaker","Microfoon","Versterker","Controller","Bekabeling","Montage","Software","Andere"], showInPdf: true, group: "Product" },
        { key: "warranty",    label: "Garantie",        type: "select",  options: ["1 jaar","2 jaar","3 jaar","5 jaar"], showInPdf: true, group: "Service" },
      ],
      leasingEnabled: true,
      leasingLabel: "MRaaS",
      aiContext: "AV-integratie voor vergaderzalen: displays, camera's, geluid, besturing, bekabeling",
    },

    // ── Security / Camerabewaking ───────────────────────────────────────────
    security: {
      id: "security",
      name: "Security & Camerabewaking",
      icon: "📹",
      zoneLabel: "Zone",
      zoneLabelPlural: "Zones",
      zoneFields: [
        { key: "area",       label: "Oppervlakte",    type: "number",  unit: "m²",    showInPdf: true, group: "Specificaties" },
        { key: "zoneType",   label: "Type zone",      type: "select",  options: ["Ingang/uitgang","Parking","Gang","Kantoor","Magazijn","Buitenomgeving","Serverruimte","Publieke ruimte","Andere"], showInPdf: true, group: "Specificaties" },
        { key: "lightCond",  label: "Lichtomstandigheden", type: "select", options: ["Goed verlicht","Matig","Donker/nacht","Wisselend"], showInPdf: false, group: "Context" },
        { key: "coverage",   label: "Dekkingsvereiste",type: "select",  options: ["Volledig (360°)","Breed (180°)","Gericht","Corridor"], showInPdf: true, group: "Specificaties" },
      ],
      itemFields: [
        { key: "brand",      label: "Merk",           type: "text",    showInPdf: true, group: "Product" },
        { key: "category",   label: "Categorie",      type: "select",  options: ["IP Camera","Analoge camera","NVR/DVR","Sensor","Toegangscontrole","Alarm","Bekabeling","Voeding/PoE","Software/VMS","Montage","Andere"], showInPdf: true, group: "Product" },
        { key: "resolution", label: "Resolutie",      type: "select",  options: ["2MP (1080p)","4MP (1440p)","5MP","8MP (4K)","12MP","N.v.t."], showInPdf: true, group: "Specs" },
        { key: "nightVision",label: "Nachtzicht",     type: "select",  options: ["IR 30m","IR 50m","IR 80m","ColorVu","Geen","N.v.t."], showInPdf: true, group: "Specs" },
        { key: "ip67",       label: "IP-bescherming", type: "select",  options: ["IP67 (outdoor)","IP66","IP44 (indoor)","Geen"], showInPdf: true, group: "Specs" },
        { key: "storageDays",label: "Opslag",         type: "number",  unit: "dagen",  showInPdf: true, group: "Specs", hint: "Aantal dagen beeldopslag" },
      ],
      leasingEnabled: true,
      leasingLabel: "Security-as-a-Service",
      aiContext: "Beveiligingsinstallatie: IP-camera's, NVR, toegangscontrole, alarmsystemen, bekabeling",
    },

    // ── Zonnepanelen & Energie ───────────────────────────────────────────────
    solar: {
      id: "solar",
      name: "Zonnepanelen & Energie",
      icon: "☀️",
      zoneLabel: "Installatielocatie",
      zoneLabelPlural: "Installatielocaties",
      zoneFields: [
        { key: "roofType",    label: "Type dak",       type: "select",  options: ["Plat dak","Hellend dak (pannen)","Hellend dak (leien)","Golfplaten","Carport","Grond","Andere"], showInPdf: true, group: "Locatie" },
        { key: "orientation", label: "Oriëntatie",     type: "select",  options: ["Zuid","Zuidoost","Zuidwest","Oost","West","Oost-West","Plat (multi)"], showInPdf: true, group: "Locatie" },
        { key: "tilt",        label: "Hellingshoek",   type: "number",  unit: "°",     showInPdf: true, group: "Locatie" },
        { key: "area",        label: "Beschikbare oppervlakte", type: "number", unit: "m²", showInPdf: true, group: "Locatie" },
        { key: "shading",     label: "Schaduw",        type: "select",  options: ["Geen","Minimaal","Gedeeltelijk","Veel"], showInPdf: false, group: "Context" },
        { key: "meterType",   label: "Type meter",     type: "select",  options: ["Digitale meter","Terugdraaiende meter","Onbekend"], showInPdf: true, group: "Aansluiting" },
        { key: "connectionKva",label:"Aansluitvermogen",type:"number",  unit: "kVA",   showInPdf: true, group: "Aansluiting" },
      ],
      itemFields: [
        { key: "brand",      label: "Merk",           type: "text",    showInPdf: true, group: "Product" },
        { key: "category",   label: "Categorie",      type: "select",  options: ["Zonnepaneel","Omvormer","Batterij","Laadpaal","Bekabeling","Montagesysteem","Monitoring","Andere"], showInPdf: true, group: "Product" },
        { key: "wattPeak",   label: "Vermogen",       type: "number",  unit: "Wp",    showInPdf: true, group: "Specs", hint: "Wattpiek per paneel" },
        { key: "kwhYear",    label: "Verwachte opbrengst", type: "number", unit: "kWh/jaar", showInPdf: true, group: "Specs" },
        { key: "warranty",   label: "Garantie",       type: "select",  options: ["10 jaar","15 jaar","20 jaar","25 jaar","30 jaar"], showInPdf: true, group: "Service" },
        { key: "perfWarranty",label:"Rendementsgarantie",type:"select", options: ["25 jaar (80%)","25 jaar (85%)","30 jaar (80%)","30 jaar (85%)","N.v.t."], showInPdf: true, group: "Service" },
      ],
      // Solar-specifieke berekeningen
      computedFields: [
        { key: "totalKwp",     label: "Totaal vermogen",     unit: "kWp",      formula: "SUM(items.wattPeak * items.qty) / 1000", scope: "zone", showInPdf: true },
        { key: "totalKwhYear", label: "Verwachte jaaropbrengst", unit: "kWh",  formula: "SUM(items.kwhYear * items.qty)", scope: "zone", showInPdf: true },
        { key: "roiYears",     label: "Terugverdientijd",    unit: "jaar",     formula: "zone.totalExclVat / (zone.totalKwhYear * 0.28)", scope: "zone", showInPdf: true },
        { key: "co2Savings",   label: "CO₂-besparing",       unit: "ton/jaar", formula: "zone.totalKwhYear * 0.000233", scope: "zone", showInPdf: true },
      ],
      leasingEnabled: true,
      leasingLabel: "Solar-as-a-Service",
      aiContext: "Zonne-energie installatie: PV-panelen, omvormers, batterijopslag, laadpalen, monitoring",
    },

    // ── Interieur & Inrichting ───────────────────────────────────────────────
    interior: {
      id: "interior",
      name: "Interieur & Inrichting",
      icon: "🪑",
      zoneLabel: "Ruimte",
      zoneLabelPlural: "Ruimtes",
      zoneFields: [
        { key: "area",       label: "Oppervlakte",    type: "number",  unit: "m²",   showInPdf: true, group: "Afmetingen" },
        { key: "height",     label: "Plafondhoogte",  type: "number",  unit: "m",    showInPdf: true, group: "Afmetingen" },
        { key: "roomFunc",   label: "Functie",        type: "select",  options: ["Woonkamer","Slaapkamer","Keuken","Badkamer","Bureau","Vergaderzaal","Lobby","Restaurant","Winkel","Andere"], showInPdf: true, group: "Specificaties" },
        { key: "style",      label: "Stijl",          type: "select",  options: ["Modern","Klassiek","Scandinavisch","Industrieel","Minimalistisch","Bohemian","Art Deco","Andere"], showInPdf: false, group: "Context" },
        { key: "floorType",  label: "Vloer",          type: "select",  options: ["Parket","Tegels","Beton","Tapijt","Vinyl","Andere","Nog te bepalen"], showInPdf: true, group: "Specificaties" },
        { key: "colorPalette",label:"Kleurenpalet",   type: "text",    showInPdf: false, group: "Context", hint: "Hoofdkleuren / sfeer" },
      ],
      itemFields: [
        { key: "brand",      label: "Merk",           type: "text",    showInPdf: true, group: "Product" },
        { key: "category",   label: "Categorie",      type: "select",  options: ["Zitmeubel","Tafel","Kast/opberging","Verlichting","Textiel","Decoratie","Vloerbekleding","Wandafwerking","Maatwerk","Andere"], showInPdf: true, group: "Product" },
        { key: "material",   label: "Materiaal",      type: "text",    showInPdf: true, group: "Specs" },
        { key: "dimensions", label: "Afmetingen",     type: "text",    showInPdf: true, group: "Specs", hint: "B x D x H" },
        { key: "color",      label: "Kleur/afwerking",type: "text",    showInPdf: true, group: "Specs" },
        { key: "leadTime",   label: "Levertijd",      type: "select",  options: ["Op voorraad","2 weken","4 weken","6 weken","8+ weken","Op bestelling"], showInPdf: true, group: "Service" },
      ],
      leasingEnabled: false,
      aiContext: "Interieurinrichting: meubels, verlichting, decoratie, maatwerk, materialen",
    },

    // ── Elektriciteit ───────────────────────────────────────────────────────
    electrical: {
      id: "electrical",
      name: "Elektriciteit",
      icon: "⚡",
      zoneLabel: "Verdieping",
      zoneLabelPlural: "Verdiepingen",
      zoneFields: [
        { key: "circuits",   label: "Aantal kringen", type: "number",  showInPdf: true, group: "Specificaties" },
        { key: "mainFuse",   label: "Hoofdzekering",  type: "select",  options: ["25A","40A","63A","80A","100A","160A","Andere"], showInPdf: true, group: "Specificaties" },
        { key: "phases",     label: "Fases",           type: "select",  options: ["1-fasig (230V)","3-fasig (400V)"], showInPdf: true, group: "Specificaties" },
        { key: "normRef",    label: "Keuringsreferentie",type: "text", showInPdf: true, group: "Conformiteit" },
      ],
      itemFields: [
        { key: "brand",      label: "Merk",           type: "text",    showInPdf: true, group: "Product" },
        { key: "category",   label: "Categorie",      type: "select",  options: ["Verdeelbord","Zekering/automaat","Schakelaar","Stopcontact","Bekabeling","Verlichting","Domotica","Aarding","Andere"], showInPdf: true, group: "Product" },
        { key: "ampere",     label: "Ampère",          type: "number",  unit: "A",    showInPdf: true, group: "Specs" },
        { key: "certification",label:"Certificering", type: "select",  options: ["CE","AREI-conform","VDE","Geen","N.v.t."], showInPdf: true, group: "Specs" },
      ],
      leasingEnabled: false,
      aiContext: "Elektriciteitswerken: verdeelborden, bekabeling, schakelaars, verlichting, domotica, AREI-conform",
    },

    // ── HVAC / Klimaat ──────────────────────────────────────────────────────
    hvac: {
      id: "hvac",
      name: "HVAC & Klimaat",
      icon: "❄️",
      zoneLabel: "Zone",
      zoneLabelPlural: "Zones",
      zoneFields: [
        { key: "area",        label: "Oppervlakte",    type: "number", unit: "m²",   showInPdf: true, group: "Specificaties" },
        { key: "volume",      label: "Volume",         type: "number", unit: "m³",   showInPdf: true, group: "Specificaties" },
        { key: "usage",       label: "Gebruik",        type: "select", options: ["Kantoor","Winkel","Restaurant","Woning","Magazijn","Serverruimte","Andere"], showInPdf: true, group: "Specificaties" },
        { key: "heatSource",  label: "Warmtebron",     type: "select", options: ["Gas","Warmtepomp","Elektrisch","Stookolie","Hybride","Nog te bepalen"], showInPdf: true, group: "Specificaties" },
      ],
      itemFields: [
        { key: "brand",       label: "Merk",           type: "text",   showInPdf: true, group: "Product" },
        { key: "category",    label: "Categorie",      type: "select", options: ["Airco (split)","Airco (multi-split)","Warmtepomp","Ventilatie","Ketel","Radiatoren","Kanaalwerk","Thermostaat","Andere"], showInPdf: true, group: "Product" },
        { key: "btuCapacity", label: "Capaciteit",     type: "number", unit: "BTU/h", showInPdf: true, group: "Specs" },
        { key: "energyLabel", label: "Energielabel",   type: "select", options: ["A+++","A++","A+","A","B","C","N.v.t."], showInPdf: true, group: "Specs" },
        { key: "refrigerant", label: "Koelmiddel",     type: "select", options: ["R32","R410A","R290","Andere","N.v.t."], showInPdf: true, group: "Specs" },
      ],
      leasingEnabled: true,
      leasingLabel: "Comfort-as-a-Service",
      aiContext: "HVAC-installatie: airconditioning, warmtepompen, ventilatie, verwarming, klimaatregeling",
    },

    // ── Events / Verhuur ────────────────────────────────────────────────────
    events: {
      id: "events",
      name: "Events & Verhuur",
      icon: "🎪",
      zoneLabel: "Eventzone",
      zoneLabelPlural: "Eventzones",
      zoneFields: [
        { key: "capacity",    label: "Capaciteit",     type: "number",  unit: "personen", showInPdf: true, group: "Specificaties" },
        { key: "eventType",   label: "Type event",     type: "select",  options: ["Conferentie","Concert","Feest","Beurs","Workshop","Ceremonie","Festival","Andere"], showInPdf: true, group: "Specificaties" },
        { key: "indoor",      label: "Locatie",        type: "select",  options: ["Indoor","Outdoor","Hybride"], showInPdf: true, group: "Specificaties" },
        { key: "duration",    label: "Duur",           type: "text",    showInPdf: true, group: "Planning", hint: "bv. 2 dagen, 19:00-01:00" },
        { key: "loadIn",      label: "Opbouw",         type: "text",    showInPdf: false, group: "Planning", hint: "Opbouwtijd en -dag" },
      ],
      itemFields: [
        { key: "brand",       label: "Merk",           type: "text",    showInPdf: true, group: "Product" },
        { key: "category",    label: "Categorie",      type: "select",  options: ["Geluid","Licht","Video/LED","Rigging","Podium/decor","Meubilair","Stroom","Andere"], showInPdf: true, group: "Product" },
        { key: "rentalPeriod",label: "Huurperiode",    type: "select",  options: ["Per dag","Per weekend","Per week","Forfait"], showInPdf: true, group: "Prijs" },
        { key: "crewNeeded",  label: "Technici nodig", type: "number",  unit: "pers.",  showInPdf: true, group: "Service" },
      ],
      leasingEnabled: false,
      aiContext: "Eventtechniek en -verhuur: geluid, licht, video, rigging, podiumtechniek",
    },

    // ── Generiek (leeg startpunt) ───────────────────────────────────────────
    generic: {
      id: "generic",
      name: "Generiek / Custom",
      icon: "📋",
      zoneLabel: "Zone",
      zoneLabelPlural: "Zones",
      zoneFields: [],
      itemFields: [],
      leasingEnabled: false,
      aiContext: "Professionele offerte voor producten en diensten",
    },
  };

  // ─── ACTIEVE CONFIGURATIE ─────────────────────────────────────────────────
  var _customZoneFields = [];
  var _customItemFields = [];
  var _computedFields   = [];
  var _activePresetId   = null;

  // ─── PUBLIC API ───────────────────────────────────────────────────────────
  return {

    // ── Presets ophalen ─────────────────────────────────────────────────────
    getPresets: function() {
      return Object.keys(_presets).map(function(k) {
        var p = _presets[k];
        return { id: p.id, name: p.name, icon: p.icon };
      });
    },

    getPreset: function(id) {
      return _presets[id] || _presets.generic;
    },

    // ── Preset toepassen ────────────────────────────────────────────────────
    applyPreset: function(presetId) {
      var preset = _presets[presetId] || _presets.generic;
      _activePresetId   = preset.id;
      _customZoneFields = JSON.parse(JSON.stringify(preset.zoneFields || []));
      _customItemFields = JSON.parse(JSON.stringify(preset.itemFields || []));
      _computedFields   = JSON.parse(JSON.stringify(preset.computedFields || []));

      // Pas ook tenant-config aan
      if (typeof TC !== "undefined") {
        TC.set("zoneLabel",       preset.zoneLabel);
        TC.set("zoneLabelPlural", preset.zoneLabelPlural);
        TC.set("leasingEnabled",  preset.leasingEnabled);
        if (preset.leasingLabel)  TC.set("leasingLabel", preset.leasingLabel);
        if (preset.aiContext)     TC.set("aiSectorContext", preset.aiContext);
      }

      return preset;
    },

    // ── Actieve preset ──────────────────────────────────────────────────────
    activePreset: function() { return _activePresetId; },

    // ── Alle velden (core + custom) ─────────────────────────────────────────
    zoneFields: function() {
      return _coreZoneFields.concat(_customZoneFields);
    },

    itemFields: function() {
      return _coreItemFields.concat(_customItemFields);
    },

    computedFields: function() {
      return _computedFields;
    },

    // ── Custom velden beheren ───────────────────────────────────────────────
    addZoneField: function(fieldDef) {
      if (!fieldDef.key) fieldDef.key = "z_" + Date.now();
      _customZoneFields.push(fieldDef);
    },

    addItemField: function(fieldDef) {
      if (!fieldDef.key) fieldDef.key = "i_" + Date.now();
      _customItemFields.push(fieldDef);
    },

    removeZoneField: function(key) {
      _customZoneFields = _customZoneFields.filter(function(f) { return f.key !== key; });
    },

    removeItemField: function(key) {
      _customItemFields = _customItemFields.filter(function(f) { return f.key !== key; });
    },

    updateField: function(target, key, updates) {
      var arr = target === "zone" ? _customZoneFields : _customItemFields;
      var f = arr.find(function(f) { return f.key === key; });
      if (f) Object.assign(f, updates);
    },

    // ── Veldwaarde ophalen uit een zone/item object ─────────────────────────
    getValue: function(obj, key) {
      if (!obj) return null;
      // Kernvelden direct
      if (obj.hasOwnProperty(key)) return obj[key];
      // Custom velden in .custom sub-object
      if (obj.custom && obj.custom.hasOwnProperty(key)) return obj.custom[key];
      return null;
    },

    // ── Veldwaarde instellen ────────────────────────────────────────────────
    setValue: function(obj, key, value) {
      // Kernvelden direct
      var coreKeys = ["id","name","ref","qty","price","desc","img","optional","replacesId","qtyIfChosen"];
      if (coreKeys.indexOf(key) !== -1) {
        obj[key] = value;
      } else {
        if (!obj.custom) obj.custom = {};
        obj.custom[key] = value;
      }
    },

    // ── HTML renderen voor een velddefinitie ────────────────────────────────
    renderField: function(field, value, idPrefix) {
      var id = (idPrefix || "cf") + "-" + field.key;
      var lbl = '<label for="' + id + '" style="font-size:11px;color:#555;display:block;margin-bottom:2px">' 
              + (field.label||field.key) 
              + (field.unit ? ' <span style="color:#999">(' + field.unit + ')</span>' : '')
              + '</label>';
      var hint = field.hint ? '<div style="font-size:10px;color:#aaa;margin-top:1px">' + field.hint + '</div>' : '';
      var html = '';

      switch (field.type) {
        case "text":
        case "url":
        case "email":
          html = lbl + '<input type="' + (field.type==="text"?"text":field.type) + '" id="' + id + '" value="' + (value||"") + '"'
               + ' style="width:100%;font-size:12px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-family:inherit"'
               + ' data-cf-key="' + field.key + '">' + hint;
          break;

        case "number":
          html = lbl + '<input type="number" id="' + id + '" value="' + (value!=null?value:"") + '" step="any"'
               + ' style="width:100%;font-size:12px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-family:inherit"'
               + ' data-cf-key="' + field.key + '">' + hint;
          break;

        case "textarea":
          html = lbl + '<textarea id="' + id + '" rows="3"'
               + ' style="width:100%;font-size:12px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-family:inherit;resize:vertical"'
               + ' data-cf-key="' + field.key + '">' + (value||"") + '</textarea>' + hint;
          break;

        case "select":
          html = lbl + '<select id="' + id + '"'
               + ' style="width:100%;font-size:12px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-family:inherit"'
               + ' data-cf-key="' + field.key + '">'
               + '<option value="">— Kies —</option>'
               + (field.options||[]).map(function(o) {
                   var sel = (value===o) ? ' selected' : '';
                   return '<option value="' + o + '"' + sel + '>' + o + '</option>';
                 }).join('')
               + '</select>' + hint;
          break;

        case "multi":
          html = lbl + '<div id="' + id + '" data-cf-key="' + field.key + '" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px">'
               + (field.options||[]).map(function(o) {
                   var checked = (Array.isArray(value) && value.indexOf(o) !== -1);
                   return '<label style="font-size:11px;display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border:1px solid #ddd;border-radius:12px;cursor:pointer;background:'+(checked?'#e3f2fd':'#fff')+'">'
                        + '<input type="checkbox" value="' + o + '"' + (checked?' checked':'') + ' style="margin:0"> ' + o + '</label>';
                 }).join('')
               + '</div>' + hint;
          break;

        case "toggle":
          html = '<label style="font-size:11px;display:inline-flex;align-items:center;gap:6px;cursor:pointer">'
               + '<input type="checkbox" id="' + id + '" data-cf-key="' + field.key + '"' + (value?' checked':'') + '>'
               + (field.label||field.key) + '</label>' + hint;
          break;

        case "date":
          html = lbl + '<input type="date" id="' + id + '" value="' + (value||"") + '"'
               + ' style="width:100%;font-size:12px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-family:inherit"'
               + ' data-cf-key="' + field.key + '">' + hint;
          break;

        default:
          html = lbl + '<input type="text" id="' + id + '" value="' + (value||"") + '"'
               + ' data-cf-key="' + field.key + '">' + hint;
      }

      return '<div style="margin-bottom:8px" data-cf-group="' + (field.group||"") + '">' + html + '</div>';
    },

    // ── Volledig formulier renderen (alle custom velden) ─────────────────────
    renderZoneForm: function(zone, idPrefix) {
      return CF.zoneFields().filter(function(f){ return !f.core; }).map(function(f) {
        return CF.renderField(f, CF.getValue(zone, f.key), idPrefix || "zf");
      }).join('');
    },

    renderItemForm: function(item, idPrefix) {
      return CF.itemFields().filter(function(f){ return !f.core; }).map(function(f) {
        return CF.renderField(f, CF.getValue(item, f.key), idPrefix || "if");
      }).join('');
    },

    // ── Formulierwaarden uitlezen ───────────────────────────────────────────
    readFormValues: function(container) {
      var vals = {};
      container.querySelectorAll("[data-cf-key]").forEach(function(el) {
        var key = el.getAttribute("data-cf-key");
        if (el.type === "checkbox" && !el.closest("[data-cf-key]").querySelector("input[type=checkbox][value]")) {
          // Single toggle
          vals[key] = el.checked;
        } else if (el.querySelectorAll && el.querySelectorAll("input[type=checkbox]").length > 0) {
          // Multi-select
          vals[key] = Array.from(el.querySelectorAll("input[type=checkbox]:checked")).map(function(cb){ return cb.value; });
        } else if (el.type === "number") {
          vals[key] = el.value !== "" ? parseFloat(el.value) : null;
        } else {
          vals[key] = el.value;
        }
      });
      return vals;
    },

    // ── PDF-velden: alleen velden met showInPdf=true ────────────────────────
    pdfZoneFields: function(zone) {
      return CF.zoneFields().filter(function(f) {
        return !f.core && f.showInPdf && CF.getValue(zone, f.key);
      });
    },

    pdfItemFields: function(item) {
      return CF.itemFields().filter(function(f) {
        return !f.core && f.showInPdf && CF.getValue(item, f.key);
      });
    },

    // ── AI-context: bouw een samenvatting voor AI-prompts ───────────────────
    aiZoneContext: function(zone) {
      var parts = [];
      CF.zoneFields().filter(function(f){ return !f.core; }).forEach(function(f) {
        var v = CF.getValue(zone, f.key);
        if (v && (!Array.isArray(v) || v.length > 0)) {
          parts.push(f.label + ": " + (Array.isArray(v) ? v.join(", ") : v) + (f.unit ? " " + f.unit : ""));
        }
      });
      return parts.join(" | ");
    },

    // ── Configuratie opslaan/laden ──────────────────────────────────────────
    exportConfig: function() {
      return {
        presetId:     _activePresetId,
        zoneFields:   _customZoneFields,
        itemFields:   _customItemFields,
        computedFields: _computedFields,
      };
    },

    importConfig: function(config) {
      if (!config) return;
      _activePresetId   = config.presetId || null;
      _customZoneFields = config.zoneFields || [];
      _customItemFields = config.itemFields || [];
      _computedFields   = config.computedFields || [];
    },

    // ── Laden vanuit Supabase ───────────────────────────────────────────────
    loadFromSupabase: async function(supaClient, tenantId) {
      if (!supaClient || !tenantId) return;
      try {
        var resp = await supaClient
          .from("tenant_field_config")
          .select("*")
          .eq("tenant_id", tenantId)
          .single();

        if (!resp.error && resp.data) {
          CF.importConfig({
            presetId:       resp.data.preset_id,
            zoneFields:     resp.data.zone_fields,
            itemFields:     resp.data.item_fields,
            computedFields: resp.data.computed_fields,
          });
          // Als er een preset is, pas ook TC-settings toe
          if (resp.data.preset_id && _presets[resp.data.preset_id]) {
            var p = _presets[resp.data.preset_id];
            if (typeof TC !== "undefined") {
              TC.set("zoneLabel",       p.zoneLabel);
              TC.set("zoneLabelPlural", p.zoneLabelPlural);
            }
          }
        }
      } catch(e) {
        console.error("CF laden mislukt:", e);
      }
    },

    // ── Opslaan naar Supabase ───────────────────────────────────────────────
    saveToSupabase: async function(supaClient, tenantId) {
      if (!supaClient || !tenantId) return;
      try {
        await supaClient.from("tenant_field_config").upsert({
          tenant_id:       tenantId,
          preset_id:       _activePresetId,
          zone_fields:     _customZoneFields,
          item_fields:     _customItemFields,
          computed_fields: _computedFields,
          updated_at:      new Date().toISOString(),
        }, { onConflict: "tenant_id" });
      } catch(e) {
        console.error("CF opslaan mislukt:", e);
      }
    },
  };

})();
