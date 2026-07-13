/* ═══════════════════════════════════════════════════════════════════════
   invoices-panel.js — Facturenoverzicht voor QuoteStudio
   ───────────────────────────────────────────────────────────────────────
   Drop-in. Laadvolgorde in index.html:
       <script src="tenant-config.js"></script>
       <script src="invoice.js"></script>
       <script src="invoice-dashboard.js"></script>
       <script src="invoices-panel.js"></script>

   Toont een volledig factuuroverzicht uit de tabel qs_invoices: nummer,
   klant, bedrag (incl. btw), status (openstaand / vervallen / betaald /
   geannuleerd), datum en vervaldatum. Per rij: openen, en betaald/openstaand
   togglen of annuleren (via de RPC qs_set_invoice_status).

   Openen: knop "🧾 Facturen" naast de dashboard-vernieuwknop (self-healing),
   of roep window.openInvoices() aan vanuit een eigen menu-item.

   Vereist: window.TC, window.supaInit. window.Invoice is optioneel (fallback
   om HTML te renderen als een snapshot ontbreekt).
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  if (typeof global.TC === "undefined") {
    console.warn("[invoices-panel] TC ontbreekt — laad tenant-config.js eerst.");
    return;
  }
  var TC = global.TC;
  var _rows = [];

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
    try { return new Date(d).toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
    catch (e) { return String(d); }
  }
  function color() { return (TC.all().primaryColor) || "#2563eb"; }

  function supa() {
    var cl = typeof global.supaInit === "function" ? global.supaInit() : null;
    return (cl && cl.from) ? cl : null;
  }
  function openHtml(html) {
    try { var w = global.open("", "_blank"); if (w) { w.document.open(); w.document.write(html || ""); w.document.close(); } }
    catch (e) {}
  }

  /* Afgeleide weergavestatus (openstaand / vervallen / betaald / geannuleerd) */
  function displayStatus(r) {
    if (r.status === "paid")      return { key: "paid",      label: "Betaald",     bg: "#E8F5E9", fg: "#2E7D32" };
    if (r.status === "cancelled") return { key: "cancelled", label: "Geannuleerd", bg: "#f1f5f9", fg: "#64748b" };
    var overdue = r.due_date && new Date(r.due_date).setHours(23, 59, 59) < Date.now();
    if (overdue) return { key: "overdue", label: "Vervallen", bg: "#FDECEA", fg: "#C62828" };
    return { key: "open", label: "Openstaand", bg: "#E3F2FD", fg: "#1565C0" };
  }

  /* ── Modal ─────────────────────────────────────────────────────────────── */
  function buildModal() {
    if (document.getElementById("qs-invoices")) return;
    var wrap = document.createElement("div");
    wrap.id = "qs-invoices";
    wrap.setAttribute("data-no-brand", "");
    wrap.style.cssText =
      "display:none;position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.55);" +
      "align-items:center;justify-content:center;padding:16px;font-family:Inter,Arial,sans-serif";

    wrap.innerHTML =
      '<div style="background:#fff;border-radius:16px;max-width:980px;width:100%;max-height:92vh;' +
        'display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,.35)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #eef2f7">' +
          '<div style="font-weight:800;font-size:16px;color:#0f172a">&#129534; Facturen</div>' +
          '<button id="qs-inv-x" style="background:none;border:none;font-size:22px;cursor:pointer;color:#94a3b8;line-height:1">&times;</button>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:center;padding:12px 20px;border-bottom:1px solid #eef2f7;flex-wrap:wrap">' +
          '<input id="qs-inv-q" placeholder="Zoek op klant of nummer…" style="flex:1;min-width:180px;padding:8px 11px;border:1px solid #d1d5db;border-radius:8px;font-size:13px">' +
          '<select id="qs-inv-st" style="padding:8px 11px;border:1px solid #d1d5db;border-radius:8px;font-size:13px">' +
            '<option value="">Alle statussen</option>' +
            '<option value="open">Openstaand</option>' +
            '<option value="overdue">Vervallen</option>' +
            '<option value="paid">Betaald</option>' +
            '<option value="cancelled">Geannuleerd</option>' +
          '</select>' +
          '<button id="qs-inv-refresh" style="padding:8px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;font-size:13px;font-weight:600;cursor:pointer">&#8635; Vernieuwen</button>' +
        '</div>' +
        '<div id="qs-inv-summary" style="padding:8px 20px;font-size:12px;color:#64748b;border-bottom:1px solid #eef2f7"></div>' +
        '<div style="overflow:auto;padding:0 8px">' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
            '<thead><tr style="text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.4px">' +
              '<th style="padding:10px 12px">Nummer</th>' +
              '<th style="padding:10px 12px">Klant</th>' +
              '<th style="padding:10px 12px;text-align:right">Bedrag</th>' +
              '<th style="padding:10px 12px">Status</th>' +
              '<th style="padding:10px 12px">Datum</th>' +
              '<th style="padding:10px 12px">Vervalt</th>' +
              '<th style="padding:10px 12px"></th>' +
            '</tr></thead>' +
            '<tbody id="qs-inv-tbody"></tbody>' +
          '</table>' +
        '</div>' +
      '</div>';

    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
    document.getElementById("qs-inv-x").onclick = close;
    document.getElementById("qs-inv-refresh").onclick = load;
    document.getElementById("qs-inv-q").oninput = render;
    document.getElementById("qs-inv-st").onchange = render;
  }

  function close() {
    var el = document.getElementById("qs-invoices");
    if (el) el.style.display = "none";
  }

  /* ── Data laden (zonder de zware html_content) ─────────────────────────── */
  async function load() {
    var tb = document.getElementById("qs-inv-tbody");
    if (tb) tb.innerHTML = "<tr><td colspan='7' style='padding:20px;color:#94a3b8'>Laden…</td></tr>";
    var cl = supa();
    if (!cl) { if (tb) tb.innerHTML = "<tr><td colspan='7' style='padding:20px;color:#C62828'>Supabase niet beschikbaar</td></tr>"; return; }
    try {
      var res = await cl.from("qs_invoices")
        .select("id,invoice_number,issue_date,due_date,status,customer,total,source_quote_id,created_at")
        .eq("tenant_slug", TC.tenant)
        .order("created_at", { ascending: false })
        .limit(500);
      if (res.error) throw new Error(res.error.message);
      _rows = res.data || [];
      render();
    } catch (e) {
      if (tb) tb.innerHTML = "<tr><td colspan='7' style='padding:20px;color:#C62828'>" + esc(e.message) + "</td></tr>";
    }
  }

  function render() {
    var tb = document.getElementById("qs-inv-tbody");
    if (!tb) return;
    var q  = (document.getElementById("qs-inv-q")  || {}).value || "";
    var sf = (document.getElementById("qs-inv-st") || {}).value || "";
    q = q.toLowerCase().trim();

    var openTotal = 0, overdueCount = 0;
    var rows = _rows.filter(function (r) {
      var ds = displayStatus(r);
      if (ds.key === "open" || ds.key === "overdue") openTotal += Number(r.total) || 0;
      if (ds.key === "overdue") overdueCount++;
      if (sf && ds.key !== sf) return false;
      if (q) {
        var name = ((r.customer && r.customer.name) || "").toLowerCase();
        var num  = (r.invoice_number || "").toLowerCase();
        if (name.indexOf(q) < 0 && num.indexOf(q) < 0) return false;
      }
      return true;
    });

    var sum = document.getElementById("qs-inv-summary");
    if (sum) sum.innerHTML =
      "Openstaand: <b style='color:#0f172a'>" + euro(openTotal) + "</b>" +
      (overdueCount ? " &nbsp;·&nbsp; <b style='color:#C62828'>" + overdueCount + " vervallen</b>" : "") +
      " &nbsp;·&nbsp; " + _rows.length + " facturen";

    if (!rows.length) {
      tb.innerHTML = "<tr><td colspan='7' style='padding:20px;color:#94a3b8'>Geen facturen</td></tr>";
      return;
    }

    tb.innerHTML = rows.map(function (r) {
      var ds = displayStatus(r);
      var name = (r.customer && r.customer.name) || "—";
      var paidToggle = r.status === "paid"
        ? "<button class='qs-inv-act' data-act='open' data-id='" + esc(r.id) + "' title='Terug naar openstaand' style='" + actCss() + "'>&#8634;</button>"
        : "<button class='qs-inv-act' data-act='paid' data-id='" + esc(r.id) + "' title='Markeer als betaald' style='" + actCss("#2E7D32") + "'>&#10003; Betaald</button>";
      var cancelBtn = r.status === "cancelled" ? "" :
        "<button class='qs-inv-act' data-act='cancel' data-id='" + esc(r.id) + "' title='Annuleren' style='" + actCss("#C62828") + "'>&times;</button>";
      return "<tr style='border-top:1px solid #eef2f7'>" +
        "<td style='padding:9px 12px;font-weight:700;white-space:nowrap'>" + esc(r.invoice_number || "") + "</td>" +
        "<td style='padding:9px 12px'>" + esc(name) + "</td>" +
        "<td style='padding:9px 12px;text-align:right;white-space:nowrap;font-weight:600'>" + euro(r.total) + "</td>" +
        "<td style='padding:9px 12px'><span style='display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;background:" + ds.bg + ";color:" + ds.fg + "'>" + ds.label + "</span></td>" +
        "<td style='padding:9px 12px;color:#475569;white-space:nowrap'>" + dmy(r.issue_date) + "</td>" +
        "<td style='padding:9px 12px;color:#475569;white-space:nowrap'>" + dmy(r.due_date) + "</td>" +
        "<td style='padding:9px 12px;white-space:nowrap;text-align:right'>" +
          "<button class='qs-inv-act' data-act='view' data-id='" + esc(r.id) + "' title='Openen' style='" + actCss(color()) + "'>&#128065; Open</button> " +
          paidToggle + " " + cancelBtn +
        "</td>" +
      "</tr>";
    }).join("");

    Array.prototype.forEach.call(tb.querySelectorAll(".qs-inv-act"), function (b) {
      b.onclick = function () { onAction(b.getAttribute("data-act"), b.getAttribute("data-id"), b); };
    });
  }

  function actCss(fg) {
    return "border:1px solid #e2e8f0;background:#fff;border-radius:7px;padding:5px 9px;font-size:12px;" +
      "font-weight:600;cursor:pointer;color:" + (fg || "#475569") + ";margin-left:2px";
  }

  async function onAction(act, id, btn) {
    var cl = supa();
    if (!cl) return;

    if (act === "view") {
      var old = btn.innerHTML; btn.innerHTML = "…"; btn.disabled = true;
      try {
        var q = await cl.from("qs_invoices").select("*").eq("id", id).maybeSingle();
        var row = q && q.data;
        var html = (row && row.html_content) || (global.Invoice && row ? global.Invoice.buildHtml(row) : "");
        if (html) openHtml(html);
        else alert("Geen factuur-HTML beschikbaar.");
      } catch (e) { alert("Openen mislukt: " + e.message); }
      finally { btn.innerHTML = old; btn.disabled = false; }
      return;
    }

    var status = act === "paid" ? "paid" : act === "cancel" ? "cancelled" : "issued";
    if (act === "cancel" && !confirm("Factuur annuleren? Dit is zichtbaar in het overzicht maar verwijdert de factuur niet.")) return;

    btn.disabled = true;
    try {
      var res = await cl.rpc("qs_set_invoice_status", { p_id: id, p_status: status });
      if (res.error) throw new Error(res.error.message);
      var updated = res.data;
      for (var i = 0; i < _rows.length; i++) if (_rows[i].id === id) { _rows[i].status = (updated && updated.status) || status; break; }
      render();
    } catch (e) {
      alert("Status wijzigen mislukt: " + e.message);
      btn.disabled = false;
    }
  }

  /* ── Opener + toegangsknop ─────────────────────────────────────────────── */
  global.openInvoices = function () {
    buildModal();
    document.getElementById("qs-invoices").style.display = "flex";
    load();
  };

  /* Knop "🧾 Facturen" naast de dashboard-vernieuwknop (self-healing) */
  function injectButton() {
    var ref = document.getElementById("db-refresh-lbl");
    var host = ref ? ref.closest("button") : null;
    if (!host || !host.parentNode) return;
    if (host.parentNode.querySelector("[data-qs-inv-open]")) return;
    var b = document.createElement("button");
    b.setAttribute("data-qs-inv-open", "");
    b.className = host.className || "";
    b.type = "button";
    b.innerHTML = "&#129534; Facturen";
    b.style.marginLeft = "8px";
    b.onclick = global.openInvoices;
    host.parentNode.insertBefore(b, host.nextSibling);
  }

  function boot() {
    try { injectButton(); } catch (e) {}
    try { setInterval(function () { try { injectButton(); } catch (e) {} }, 1500); } catch (e) {}
  }

  if (typeof document === "undefined") return;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})(typeof window !== "undefined" ? window : this);
