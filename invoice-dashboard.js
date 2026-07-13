/* ═══════════════════════════════════════════════════════════════════════
   invoice-dashboard.js — "Maak factuur"-knop in het QuoteStudio-dashboard
   ───────────────────────────────────────────────────────────────────────
   Drop-in. Laadvolgorde in index.html:
       <script src="tenant-config.js"></script>
       <script src="invoice.js"></script>
       <script src="invoice-dashboard.js"></script>

   Werkwijze (zelfde patroon als tenant-admin.js): een interval scant
   #db-tbody en zet bij elke ONDERTEKENDE offerte een 🧾-knop in de
   actiekolom. De offertedata komt uit de bestaande globale _dbAllRows, dus
   er wordt niets uit de DOM geparset. Bestaat er al een factuur voor die
   offerte (via source_quote_id), dan opent de knop meteen die factuur.

   Vereist: window.Invoice (invoice.js), window.supaInit, window._dbAllRows.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  var VAT_RATE = 0.21;   /* België; pas aan indien nodig */

  function r2(x) { return Math.round((Number(x) || 0) * 100) / 100; }

  function openHtml(html) {
    try {
      var w = global.open("", "_blank");
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    } catch (e) {}
  }

  /* quote-id uit de bestaande verwijder-knop van de rij halen */
  function rowIdOf(tr) {
    var b = tr.querySelector("[onclick*='dbDeleteQuote'],[onclick*='cloudLoadQuote']");
    var oc = b ? (b.getAttribute("onclick") || "") : "";
    var m = oc.match(/\(\s*["']([^"']+)["']/);
    return m ? m[1] : null;
  }

  function findRow(id) {
    var rows = global._dbAllRows || [];
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
    return null;
  }

  /* Billing-adres + e-mail uit de sessie van die ene offerte halen */
  async function fetchCustomer(id, row) {
    var name = row.client || row.name || "";
    var out = { name: name, address: "", email: "", vatNumber: "" };
    try {
      var cl = global.supaInit && global.supaInit();
      if (cl && cl.from) {
        var q = await cl.from("quotes").select("session,client").eq("id", id).maybeSingle();
        var f = (q && q.data && q.data.session && q.data.session.fields) || {};
        out.name    = (q && q.data && q.data.client) || f["c-nm"] || name;
        out.address = f["c-ad"] || "";
        out.email   = f["c-em"] || "";
      }
    } catch (e) { /* val terug op enkel de naam */ }
    return out;
  }

  async function makeInvoiceForRow(id, row, btn) {
    if (!global.Invoice) { alert("invoice.js is niet geladen."); return; }
    var sig  = row._sig || {};
    var rent = sig.chosen_payment_mode === "rent";
    var base = rent ? Number(sig.chosen_monthly_amount || 0) : Number(sig.chosen_amount || 0);

    if (!(base > 0)) {
      alert("Geen bedrag gevonden op de handtekening. Open de offerte en controleer het gekozen bedrag.");
      return;
    }
    if (rent && !confirm(
        "Dit is een huur/MRaaS-contract (maandelijkse facturatie).\n\n" +
        "Er wordt nu één factuur gemaakt voor de maandelijkse vergoeding. " +
        "Terugkerende facturatie is nog niet geautomatiseerd. Doorgaan?")) {
      return;
    }

    var source = row._appQuoteId || row.app_quote_id || row.id;

    var label = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.innerHTML = "…"; }

    try {
      /* Al gefactureerd? Dan die factuur openen i.p.v. een tweede maken. */
      var existing = await global.Invoice.findBySource(source);
      if (existing) {
        openHtml(existing.html_content || global.Invoice.buildHtml(existing));
        markDone(btn, existing, id, row);
        return;
      }

      var customer = await fetchCustomer(id, row);
      var excl  = r2(base);
      var vat   = r2(excl * VAT_RATE);
      var total = r2(excl + vat);
      var sigDate = sig.signed_at || sig.signed_date;
      var when = sigDate ? new Date(sigDate).toLocaleDateString("nl-BE") : "";

      var desc = rent
        ? 'Maandelijkse MRaaS-vergoeding conform offerte "' + (row.name || "") + '"'
        : 'Levering en installatie AV-oplossing conform offerte "' + (row.name || "") + '"'
          + (sig.chosen_variant ? " – " + sig.chosen_variant : "")
          + (when ? " (getekend " + when + ")" : "");

      var invoice = await global.Invoice.createFromQuote({
        source:    source,
        customer:  customer,
        lineItems: [{ description: desc, qty: 1, unitPrice: excl, total: excl }],
        subtotal:  excl,
        vat:       vat,
        total:     total
      });

      openHtml(invoice.html_content || global.Invoice.buildHtml(invoice));
      markDone(btn, invoice, id, row);
    } catch (e) {
      alert("Factuur mislukt: " + (e && e.message));
      if (btn) btn.innerHTML = label;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* Knop na aanmaken/vinden ombouwen tot "open de factuur" */
  function markDone(btn, invoice, id, row) {
    if (!btn) return;
    btn.innerHTML = "&#129534;";
    btn.title = "Factuur " + (invoice.invoice_number || "");
    btn.style.color = "var(--green,#2E7D32)";
    btn.onclick = function () { openHtml(invoice.html_content || global.Invoice.buildHtml(invoice)); };
  }

  /* Eén 🧾-knop per getekende rij toevoegen (idempotent) */
  function decorate() {
    var tbody = document.getElementById("db-tbody");
    if (!tbody || !global._dbAllRows) return;

    Array.prototype.forEach.call(tbody.querySelectorAll("tr"), function (tr) {
      if (tr.querySelector("[data-qs-inv]")) return;                 /* al gedaan */
      var signed = tr.querySelector(".db-b-ondertekend, .db-b-gewonnen");
      if (!signed) return;                                           /* enkel getekend */
      var id = rowIdOf(tr);
      if (!id) return;
      var row = findRow(id);
      if (!row || !row._sig) return;

      var actions = tr.lastElementChild;                            /* actiekolom */
      if (!actions) return;

      var btn = document.createElement("button");
      btn.className = "db-act-btn";
      btn.setAttribute("data-qs-inv", "");
      btn.title = "Maak factuur";
      btn.style.color = "var(--red,#2563eb)";
      btn.innerHTML = "&#129534;";                                  /* 🧾 */
      btn.onclick = function () { makeInvoiceForRow(id, row, btn); };

      actions.insertBefore(btn, actions.firstChild);
      actions.insertBefore(document.createTextNode(" "), btn.nextSibling);
    });
  }

  function boot() {
    try { decorate(); } catch (e) {}
    try { setInterval(function () { try { decorate(); } catch (e) {} }, 1500); } catch (e) {}
  }

  if (typeof document === "undefined") return;    /* node/SSR: niets doen */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})(typeof window !== "undefined" ? window : this);
