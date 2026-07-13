/* ═══════════════════════════════════════════════════════════════════════
   invoice.js — Facturatie-uitbreiding voor QuoteStudio
   ───────────────────────────────────────────────────────────────────────
   Laden ná tenant-config.js:
       <script src="tenant-config.js"></script>
       <script src="invoice.js"></script>

   Vereist qs_invoices.sql (RPC's qs_create_invoice + qs_attach_invoice_html)
   en window.supaInit() dat een supabase-js client teruggeeft (zelfde bron als
   tenant-admin.js).

   Publieke API (window.Invoice):
     Invoice.createFromQuote(quote)   → maakt de factuur aan in Supabase en
                                        geeft de factuurrij terug (incl. nummer,
                                        vervaldatum en gestructureerde mededeling).
     Invoice.buildHtml(invoiceRow)    → volledige factuur-HTML (string) met de
                                        tenant-branding uit TC.
     Invoice.createAndPreview(quote)  → doet createFromQuote en opent de factuur
                                        in een nieuw venster (Ctrl/Cmd-P = PDF).

   ── quote-object (jij mapt je interne offerte-state hierop) ──────────────
     {
       source:   "signing-page-id of offerte-id",          // optioneel
       customer: { name, address, vatNumber, email },       // vrij, wordt als
                                                            //   snapshot bewaard
       lineItems: [ { description, qty, unitPrice, total } ],// total optioneel
       subtotal:  1000.00,     // excl. btw
       vat:        210.00,     // btw-bedrag
       total:     1210.00      // incl. btw
     }
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  if (typeof global.TC === "undefined") {
    console.warn("[invoice] TC ontbreekt — laad tenant-config.js eerst.");
    return;
  }
  var TC = global.TC;

  /* Tenant-factuurinstelling met fallback (uit qs_tenants / TC.all()) */
  function cfg(key, fallback) {
    var v = TC.all()[key];
    return (v == null || v === "") ? fallback : v;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function euro(n) {
    try { return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(Number(n) || 0); }
    catch (e) { return "€ " + (Number(n) || 0).toFixed(2); }
  }
  function dmy(d) {
    if (!d) return "";
    try { return new Date(d).toLocaleDateString("nl-BE"); } catch (e) { return String(d); }
  }
  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }

  function supa() {
    var cl = typeof global.supaInit === "function" ? global.supaInit() : null;
    if (!cl || !cl.rpc) throw new Error("Supabase-client ontbreekt (window.supaInit).");
    return cl;
  }

  /* ── Factuur aanmaken (nummer + snapshot komen uit de RPC) ─────────────── */
  async function createFromQuote(quote) {
    quote = quote || {};
    var cl = supa();

    var res = await cl.rpc("qs_create_invoice", {
      p_tenant:     TC.tenant,
      p_source:     quote.source || null,
      p_customer:   quote.customer || {},
      p_line_items: quote.lineItems || [],
      p_subtotal:   Number(quote.subtotal) || 0,
      p_vat:        Number(quote.vat) || 0,
      p_total:      Number(quote.total) || 0,
      p_due_days:   Number(cfg("paymentTermDays", 30)),
      p_prefix:     cfg("invoicePrefix", "")
    });
    if (res.error) throw new Error("Factuur aanmaken mislukt: " + res.error.message);

    var invoice = res.data;

    /* HTML-snapshot renderen en (write-once) terugkoppelen */
    try {
      var html = buildHtml(invoice);
      var att = await cl.rpc("qs_attach_invoice_html", { p_id: invoice.id, p_html: html });
      if (!att.error) invoice.html_content = html;
    } catch (e) {
      console.warn("[invoice] HTML-snapshot niet bewaard:", e && e.message);
    }
    return invoice;
  }

  /* ── HTML-template — hergebruikt TC-branding (logo, kleur, voettekst) ──── */
  function buildHtml(invoice) {
    invoice = invoice || {};
    var t         = TC.all();
    var color     = t.primaryColor || "#2563eb";
    var cust      = invoice.customer || {};
    var items     = Array.isArray(invoice.line_items) ? invoice.line_items : [];

    var rows = items.map(function (it) {
      var qty  = Number(it.qty != null ? it.qty : 1) || 0;
      var unit = Number(it.unitPrice != null ? it.unitPrice : 0) || 0;
      var line = it.total != null ? Number(it.total) : qty * unit;
      return (
        '<tr>' +
          '<td style="padding:9px 10px;border-bottom:1px solid #eef2f7">' + esc(it.description || "") + '</td>' +
          '<td style="padding:9px 10px;border-bottom:1px solid #eef2f7;text-align:right;white-space:nowrap">' + esc(qty) + '</td>' +
          '<td style="padding:9px 10px;border-bottom:1px solid #eef2f7;text-align:right;white-space:nowrap">' + euro(unit) + '</td>' +
          '<td style="padding:9px 10px;border-bottom:1px solid #eef2f7;text-align:right;white-space:nowrap;font-weight:600">' + euro(line) + '</td>' +
        '</tr>'
      );
    }).join("");

    function totalRow(label, value, strong) {
      return (
        '<tr>' +
          '<td style="padding:6px 10px;text-align:right;color:#64748b">' + esc(label) + '</td>' +
          '<td style="padding:6px 10px;text-align:right;white-space:nowrap;min-width:120px;' +
            (strong ? 'font-weight:800;font-size:15px;color:' + color : 'font-weight:600') + '">' +
            euro(value) + '</td>' +
        '</tr>'
      );
    }

    var vatNumber = cfg("vatNumber", "");
    var iban      = cfg("iban", "");
    var bic       = cfg("bic", "");
    var legal     = cfg("invoiceLegalText", "");

    return (
'<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1">' +
'<title>Factuur ' + esc(invoice.invoice_number || "") + '</title></head>' +
'<body style="margin:0;font-family:Inter,Arial,sans-serif;color:#0f172a;background:#fff">' +
'<div style="max-width:800px;margin:0 auto;padding:40px 44px">' +

  /* Kop: logo links, factuurblok rechts */
  '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:32px">' +
    '<div style="height:44px">' + TC.logoPdf() + '</div>' +
    '<div style="text-align:right">' +
      '<div style="font-size:24px;font-weight:800;letter-spacing:-.5px;color:' + color + '">FACTUUR</div>' +
      '<div style="font-size:13px;color:#334155;margin-top:6px">Nr. <b>' + esc(invoice.invoice_number || "") + '</b></div>' +
      '<div style="font-size:12px;color:#64748b">Datum: ' + dmy(invoice.issue_date) + '</div>' +
      '<div style="font-size:12px;color:#64748b">Vervaldatum: ' + dmy(invoice.due_date) + '</div>' +
    '</div>' +
  '</div>' +

  /* Van / Aan */
  '<div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:28px;font-size:12.5px;line-height:1.55">' +
    '<div>' +
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:4px">Van</div>' +
      '<div style="font-weight:700">' + esc(t.companyName || t.companyNameShort || "") + '</div>' +
      (t.address ? '<div style="color:#475569">' + nl2br(t.address) + '</div>' : '') +
      (vatNumber ? '<div style="color:#475569">' + esc(t.vatLabel || "BTW") + ': ' + esc(vatNumber) + '</div>' : '') +
      (t.website ? '<div style="color:#475569">' + esc(t.website) + '</div>' : '') +
    '</div>' +
    '<div style="text-align:right">' +
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:4px">Aan</div>' +
      '<div style="font-weight:700">' + esc(cust.name || "") + '</div>' +
      (cust.address ? '<div style="color:#475569">' + nl2br(cust.address) + '</div>' : '') +
      (cust.vatNumber ? '<div style="color:#475569">BTW: ' + esc(cust.vatNumber) + '</div>' : '') +
      (cust.email ? '<div style="color:#475569">' + esc(cust.email) + '</div>' : '') +
    '</div>' +
  '</div>' +

  /* Lijnen */
  '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px">' +
    '<thead><tr style="background:' + color + ';color:#fff">' +
      '<th style="padding:10px;text-align:left;font-weight:600">Omschrijving</th>' +
      '<th style="padding:10px;text-align:right;font-weight:600;white-space:nowrap">Aantal</th>' +
      '<th style="padding:10px;text-align:right;font-weight:600;white-space:nowrap">Eenheidsprijs</th>' +
      '<th style="padding:10px;text-align:right;font-weight:600;white-space:nowrap">Totaal</th>' +
    '</tr></thead>' +
    '<tbody>' + (rows || '<tr><td colspan="4" style="padding:14px;color:#94a3b8">Geen lijnen</td></tr>') + '</tbody>' +
  '</table>' +

  /* Totalen */
  '<div style="display:flex;justify-content:flex-end;margin-bottom:28px">' +
    '<table style="border-collapse:collapse;font-size:13px">' +
      totalRow("Subtotaal (excl. btw)", invoice.subtotal) +
      totalRow("Btw", invoice.vat_amount) +
      totalRow("Totaal te betalen", invoice.total, true) +
    '</table>' +
  '</div>' +

  /* Betaalblok */
  '<div style="background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:16px 18px;font-size:12.5px;line-height:1.6;margin-bottom:24px">' +
    '<div style="font-weight:700;color:' + color + ';margin-bottom:6px">Betaalgegevens</div>' +
    (iban ? '<div>IBAN: <b>' + esc(iban) + '</b>' + (bic ? '&nbsp;&nbsp;BIC: ' + esc(bic) : '') + '</div>' : '') +
    (invoice.structured_comm ? '<div>Gestructureerde mededeling: <b>' + esc(invoice.structured_comm) + '</b></div>' : '') +
    '<div>Te betalen vóór <b>' + dmy(invoice.due_date) + '</b> — bedrag: <b>' + euro(invoice.total) + '</b></div>' +
  '</div>' +

  (legal ? '<div style="font-size:10.5px;color:#94a3b8;line-height:1.5;margin-bottom:18px">' + nl2br(legal) + '</div>' : '') +

  /* Voettekst uit TC */
  '<div style="border-top:1px solid #eef2f7;padding-top:12px;font-size:10.5px;color:#94a3b8;text-align:center">' +
    esc(TC.pdfFooter()) +
  '</div>' +

'</div></body></html>'
    );
  }

  /* ── Aanmaken + openen voor print/PDF (fallback-pipeline) ──────────────── */
  async function createAndPreview(quote) {
    var invoice = await createFromQuote(quote);
    var html = invoice.html_content || buildHtml(invoice);
    try {
      var w = global.open("", "_blank");
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    } catch (e) { console.warn("[invoice] preview-venster geblokkeerd:", e && e.message); }
    return invoice;
  }

  /* ── Bestaande factuur voor een offerte opzoeken ──────────────────────── */
  /*    Voorkomt dubbele facturatie: één getekende offerte → één factuur.     */
  async function findBySource(sourceId) {
    if (!sourceId) return null;
    var cl = supa();
    var res = await cl.from("qs_invoices")
      .select("*")
      .eq("tenant_slug", TC.tenant)
      .eq("source_quote_id", sourceId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (res.error) throw new Error(res.error.message);
    return (res.data && res.data[0]) || null;
  }

  function openHtml(html) {
    try {
      var w = global.open("", "_blank");
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    } catch (e) { console.warn("[invoice] venster geblokkeerd:", e && e.message); }
  }

  /* ── Knop-helper: "Maak factuur" / "Factuur <nr>" ─────────────────────────
     opts:
       sourceId  : id van de offerte/signing-page (koppeling + dubbel-preventie)
       getQuote  : () => quote-object (of async), opgeroepen bij klik
       quote     : alternatief voor getQuote (statisch object)
       onDone    : (invoice) => {}  callback na aanmaken
       style     : inline-CSS voor de knop (optioneel)
       className : class voor de knop (optioneel)
     Geeft het knop-element terug. Bestaat er al een factuur, dan toont de knop
     meteen "Factuur <nr>" en opent hij bij klik de snapshot. */
  function mountButton(container, opts) {
    opts = opts || {};
    if (!container) return null;
    var btn = document.createElement("button");
    btn.type = "button";
    if (opts.className) btn.className = opts.className;
    if (opts.style) btn.style.cssText = opts.style;
    var busy = false;

    async function refresh() {
      try {
        var existing = opts.sourceId ? await findBySource(opts.sourceId) : null;
        if (existing) {
          btn.textContent = "Factuur " + existing.invoice_number;
          btn.onclick = function () { openHtml(existing.html_content || buildHtml(existing)); };
        } else {
          btn.textContent = "Maak factuur";
          btn.onclick = async function () {
            if (busy) return;
            busy = true; btn.disabled = true;
            var label = btn.textContent; btn.textContent = "Bezig…";
            try {
              var quote = typeof opts.getQuote === "function" ? await opts.getQuote() : opts.quote;
              var invoice = await createAndPreview(quote);
              if (typeof opts.onDone === "function") opts.onDone(invoice);
              await refresh();
            } catch (e) {
              alert("Factuur mislukt: " + (e && e.message));
              btn.textContent = label;
            } finally { btn.disabled = false; busy = false; }
          };
        }
      } catch (e) { console.warn("[invoice] mountButton:", e && e.message); }
    }

    refresh();
    container.appendChild(btn);
    return btn;
  }

  global.Invoice = {
    createFromQuote: createFromQuote,
    createAndPreview: createAndPreview,
    buildHtml: buildHtml,
    findBySource: findBySource,
    mountButton: mountButton
  };

})(typeof window !== "undefined" ? window : this);
