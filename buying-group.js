/* ═══════════════════════════════════════════════════════════════════════
   buying-group.js — Slimme Inkoop- & Bundelingsmodule v2
   ───────────────────────────────────────────────────────────────────────
   Uitgebreid: per-vestiging overzicht, inline formulieren, KPI's,
   tabbladen (Overzicht / Per Vestiging / Bundels), statusbeheer,
   import vanuit offerte.
   ═══════════════════════════════════════════════════════════════════════ */
(function(global){
  "use strict";

  function _esc(s){ return typeof global.esc==="function"?global.esc(s):String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function _toast(m){ if(typeof global.toast==="function") global.toast(m); else console.log("[buying-group]",m); }
  function _fE(n){ return typeof global.fE==="function"?global.fE(n):("€\u00a0"+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,".")); }
  function _tenantId(){ return (global.TC&&global.TC.tenant)||"default"; }
  function _el(id){ return document.getElementById(id); }

  /* ─── Status configs ─── */
  var NEED_ST = {
    open:      {l:"Open",       bg:"#E3F2FD",clr:"#1565C0",icon:"🔵"},
    bundled:   {l:"Gebundeld",  bg:"#FFF3E0",clr:"#E65100",icon:"📦"},
    ordered:   {l:"Besteld",    bg:"#E8F5E9",clr:"#2E7D32",icon:"✅"},
    delivered: {l:"Geleverd",   bg:"#F3E5F5",clr:"#7B1FA2",icon:"🚚"},
    cancelled: {l:"Geannuleerd",bg:"#FFEBEE",clr:"#C62828",icon:"❌"}
  };
  var BUNDLE_ST = {
    proposed: {l:"Voorstel",    bg:"#FFF3E0",clr:"#E65100",icon:"📋"},
    approved: {l:"Goedgekeurd", bg:"#E3F2FD",clr:"#1565C0",icon:"👍"},
    ordered:  {l:"Besteld",     bg:"#E8F5E9",clr:"#2E7D32",icon:"🛒"},
    delivered:{l:"Geleverd",    bg:"#F3E5F5",clr:"#7B1FA2",icon:"🚚"},
    closed:   {l:"Afgesloten",  bg:"#f0f0f0",clr:"#555",   icon:"🔒"}
  };

  function _badge(cfg,st){
    var c=cfg[st]||{l:st,bg:"#eee",clr:"#555",icon:"•"};
    return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:600;background:'+c.bg+';color:'+c.clr+'">'+c.icon+' '+_esc(c.l)+'</span>';
  }

  /* ─── Cached data ─── */
  var _entities=[], _needs=[], _overlaps=[], _bundles=[];
  var _activeTab="overview";    // overview | entity | bundles
  var _selectedEntity=null;     // entity id for detail view
  var _needFilter="all";        // all | open | bundled | ordered | delivered

  /* ═══════════════════════════════════════════════════════════════
     SUPABASE CRUD
     ═══════════════════════════════════════════════════════════════ */
  async function listEntities(){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("buying_entities").select("*").order("name");
    if(r.error) throw new Error(r.error.message);
    return r.data||[];
  }
  async function createEntity(data){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("buying_entities").insert(data).select().single();
    if(r.error) throw new Error(r.error.message);
    return r.data;
  }
  async function updateEntity(id,data){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("buying_entities").update(data).eq("id",id);
    if(r.error) throw new Error(r.error.message);
  }
  async function deleteEntity(id){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("buying_entities").delete().eq("id",id);
    if(r.error) throw new Error(r.error.message);
  }
  async function listNeeds(entityId){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var q=cl.from("buying_needs").select("*, buying_entities(name,code)").order("created_at",{ascending:false});
    if(entityId) q=q.eq("entity_id",entityId);
    var r=await q.limit(500);
    if(r.error) throw new Error(r.error.message);
    return r.data||[];
  }
  async function createNeed(entityId, data){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var u=await cl.auth.getUser();
    var email=(u&&u.data&&u.data.user)?u.data.user.email:"";
    var r=await cl.from("buying_needs").insert({
      entity_id:entityId, product_ref:data.product_ref||"",
      product_name:data.product_name||"", category:data.category||"",
      quantity:Number(data.quantity)||1, unit_price_estimate:Number(data.unit_price_estimate)||0,
      needed_by:data.needed_by||null, notes:data.notes||"", user_email:email
    }).select().single();
    if(r.error) throw new Error(r.error.message);
    return r.data;
  }
  async function updateNeed(id,data){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    data.updated_at=new Date().toISOString();
    var r=await cl.from("buying_needs").update(data).eq("id",id);
    if(r.error) throw new Error(r.error.message);
  }
  async function deleteNeed(id){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("buying_needs").delete().eq("id",id);
    if(r.error) throw new Error(r.error.message);
  }
  async function detectOverlaps(){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.rpc("detect_buying_overlaps",{p_tenant:_tenantId()});
    if(r.error) throw new Error(r.error.message);
    return r.data||[];
  }
  async function createBundlesRPC(){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.rpc("create_bundles_from_overlaps",{p_tenant:_tenantId()});
    if(r.error) throw new Error(r.error.message);
    return r.data;
  }
  async function listBundles(){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("buying_bundles").select("*").order("created_at",{ascending:false}).limit(100);
    if(r.error) throw new Error(r.error.message);
    return r.data||[];
  }
  async function updateBundleStatus(id,status){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("buying_bundles").update({status:status,updated_at:new Date().toISOString()}).eq("id",id);
    if(r.error) throw new Error(r.error.message);
  }
  async function getBundleLines(bundleId){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("buying_bundle_lines").select("*, buying_entities:entity_id(name,code), buying_needs:need_id(product_name,quantity,unit_price_estimate)").eq("bundle_id",bundleId);
    if(r.error) throw new Error(r.error.message);
    return r.data||[];
  }

  /* ═══════════════════════════════════════════════════════════════
     DATA LOAD
     ═══════════════════════════════════════════════════════════════ */
  async function loadAll(){
    var root=_el("bg-content");
    if(root) root.innerHTML='<div style="text-align:center;padding:30px;color:#999"><span class="spin spin-r"></span> Laden…</div>';
    try{
      var results=await Promise.all([listEntities(),listNeeds(),detectOverlaps(),listBundles()]);
      _entities=results[0]; _needs=results[1]; _overlaps=results[2]; _bundles=results[3];
    }catch(e){ _toast("⚠ "+e.message); return; }
    renderAll();
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER — MAIN
     ═══════════════════════════════════════════════════════════════ */
  function renderAll(){
    var root=_el("bg-content");
    if(!root) return;

    // KPIs
    var totalNeeds=_needs.length;
    var openNeeds=_needs.filter(function(n){return n.status==="open";}).length;
    var bundledNeeds=_needs.filter(function(n){return n.status==="bundled";}).length;
    var orderedNeeds=_needs.filter(function(n){return n.status==="ordered";}).length;
    var totalQty=_needs.reduce(function(a,n){return a+Number(n.quantity);},0);
    var totalValue=_needs.reduce(function(a,n){return a+(Number(n.quantity)*Number(n.unit_price_estimate));},0);
    var activeBundles=_bundles.filter(function(b){return b.status!=="closed";}).length;

    var html='';

    // ── KPI ROW ──
    html+='<div class="bg-kpi-row">'
      +_kpi("Vestigingen",_entities.length,"#1565C0")
      +_kpi("Open behoeften",openNeeds,"#E65100")
      +_kpi("Gebundeld",bundledNeeds,"#7B1FA2")
      +_kpi("Besteld / geleverd",orderedNeeds,"#2E7D32")
      +_kpi("Totaal stuks",totalQty,"var(--gr)")
      +_kpi("Indicatieve waarde",_fE(totalValue),"var(--red)")
      +'</div>';

    // ── TABS ──
    html+='<div class="bg-tabs">'
      +_tab("overview","📊 Overzicht")
      +_tab("entity","🏢 Per vestiging")
      +_tab("bundles","📦 Bundels ("+activeBundles+")")
      +'</div>';

    // ── TAB CONTENT ──
    html+='<div id="bg-tab-content">';
    if(_activeTab==="overview")      html+=renderOverview();
    else if(_activeTab==="entity")   html+=renderEntityTab();
    else if(_activeTab==="bundles")  html+=renderBundlesTab();
    html+='</div>';

    root.innerHTML=html;
  }

  function _kpi(label,val,color){
    return '<div class="bg-kpi"><div class="bg-kpi-lbl">'+label+'</div>'
      +'<div class="bg-kpi-val" style="color:'+color+'">'+val+'</div></div>';
  }
  function _tab(id,label){
    return '<button class="bg-tab'+(_activeTab===id?' bg-tab-on':'')+'" onclick="bgSwitchTab(\''+id+'\')">'+label+'</button>';
  }

  /* ═══════════════════════════════════════════════════════════════
     TAB 1 — OVERZICHT
     ═══════════════════════════════════════════════════════════════ */
  function renderOverview(){
    var h='';

    // ── Vestigingen grid met samenvattingen ──
    h+='<div class="bg-section-hdr"><span>🏢 Vestigingen</span>'
      +'<button class="bg-btn" onclick="bgShowEntityForm()">＋ Vestiging toevoegen</button></div>'
      +'<div id="bg-entity-form-slot"></div>';

    if(!_entities.length){
      h+='<div class="bg-empty">Nog geen vestigingen. Voeg er een toe om te starten.</div>';
    } else {
      h+='<div class="bg-entity-grid">';
      _entities.forEach(function(e){
        var eNeeds=_needs.filter(function(n){return n.entity_id===e.id;});
        var eOpen=eNeeds.filter(function(n){return n.status==="open";}).length;
        var eBundled=eNeeds.filter(function(n){return n.status==="bundled";}).length;
        var eOrdered=eNeeds.filter(function(n){return n.status==="ordered"||n.status==="delivered";}).length;
        var eQty=eNeeds.reduce(function(a,n){return a+Number(n.quantity);},0);
        var eVal=eNeeds.reduce(function(a,n){return a+(Number(n.quantity)*Number(n.unit_price_estimate));},0);

        h+='<div class="bg-entity-card" onclick="bgSwitchTab(\'entity\');bgSelectEntity(\''+e.id+'\')">'
          +'<div class="bg-ec-hdr">'
          +'<div><div class="bg-ec-name">'+_esc(e.name)+'</div>'
          +'<div class="bg-ec-meta">'+_esc(e.code||"—")+' · '+_esc(e.country||"")+(e.contact_email?' · '+_esc(e.contact_email):'')+'</div></div>'
          +'<div class="bg-ec-qty">'+eQty+'<span>stuks</span></div>'
          +'</div>'
          +'<div class="bg-ec-stats">'
          +'<div class="bg-ec-stat"><span class="bg-ec-dot" style="background:#1565C0"></span>Open <b>'+eOpen+'</b></div>'
          +'<div class="bg-ec-stat"><span class="bg-ec-dot" style="background:#E65100"></span>Gebundeld <b>'+eBundled+'</b></div>'
          +'<div class="bg-ec-stat"><span class="bg-ec-dot" style="background:#2E7D32"></span>Besteld <b>'+eOrdered+'</b></div>'
          +'</div>'
          +'<div class="bg-ec-val">'+_fE(eVal)+'</div>'
          +'</div>';
      });
      h+='</div>';
    }

    // ── Overlap-detectie ──
    h+='<div class="bg-section-hdr" style="margin-top:20px"><span>🔍 Overlap-detectie ('+_overlaps.length+')</span>'
      +'<button class="bg-btn bg-btn-accent" onclick="bgCreateBundles()"'
      +(_overlaps.length?'':' disabled')+'>⚡ Bundels genereren</button></div>';

    if(!_overlaps.length){
      h+='<div class="bg-empty">Geen overlappende behoeften gevonden tussen vestigingen.</div>';
    } else {
      h+='<div class="bg-tbl-wrap"><table class="bg-tbl">'
        +'<thead><tr><th>Product</th><th>Artikelcode</th><th>Categorie</th>'
        +'<th style="text-align:center">Totaal qty</th><th style="text-align:center">Vestigingen</th>'
        +'<th>Wie</th><th style="text-align:right">Volumekorting</th></tr></thead><tbody>';
      _overlaps.forEach(function(o){
        var sav=Number(o.saving_pct)||0;
        h+='<tr>'
          +'<td style="font-weight:600">'+_esc(o.product_name||o.product_ref)+'</td>'
          +'<td><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:10px">'+_esc(o.product_ref)+'</code></td>'
          +'<td>'+_esc(o.category||"—")+'</td>'
          +'<td style="text-align:center"><span class="bg-qty-badge">'+o.total_qty+'</span></td>'
          +'<td style="text-align:center"><span class="bg-ent-badge">'+o.entity_count+'</span></td>'
          +'<td style="font-size:11px">'+_esc(o.entity_names)+'</td>'
          +'<td style="text-align:right;font-weight:700;color:'+(sav>0?'#2E7D32':'#ccc')+'">'+
          (sav>0?'−'+sav.toFixed(1)+'%':'—')+'</td></tr>';
      });
      h+='</tbody></table></div>';
    }

    // ── Recente behoeften (cross-entity) ──
    h+='<div class="bg-section-hdr" style="margin-top:20px"><span>📋 Alle behoeften ('+_needs.length+')</span></div>';
    h+=renderNeedsTable(_needs, true);

    return h;
  }

  /* ═══════════════════════════════════════════════════════════════
     TAB 2 — PER VESTIGING
     ═══════════════════════════════════════════════════════════════ */
  function renderEntityTab(){
    var h='';

    // Entity selector
    h+='<div class="bg-entity-selector">';
    if(!_entities.length){
      h+='<div class="bg-empty">Nog geen vestigingen.</div>';
      return h+'</div>';
    }

    h+='<div class="bg-entity-pills">';
    _entities.forEach(function(e){
      var sel=_selectedEntity===e.id;
      var cnt=_needs.filter(function(n){return n.entity_id===e.id;}).length;
      h+='<button class="bg-pill'+(sel?' bg-pill-on':'')+'" onclick="bgSelectEntity(\''+e.id+'\')">'
        +_esc(e.name)+' <span class="bg-pill-count">'+cnt+'</span></button>';
    });
    h+='</div></div>';

    if(!_selectedEntity && _entities.length) _selectedEntity=_entities[0].id;
    if(!_selectedEntity) return h;

    var ent=_entities.find(function(e){return e.id===_selectedEntity;});
    if(!ent) return h;

    var eNeeds=_needs.filter(function(n){return n.entity_id===_selectedEntity;});

    // ── Entity header ──
    h+='<div class="bg-ent-detail-hdr">'
      +'<div>'
      +'<div style="font-size:18px;font-weight:800;color:var(--gr)">'+_esc(ent.name)+'</div>'
      +'<div style="font-size:12px;color:#94a3b8;margin-top:2px">'+_esc(ent.code||"")+' · '+_esc(ent.country||"")
      +(ent.contact_email?' · '+_esc(ent.contact_email):'')+'</div>'
      +'</div>'
      +'<div style="display:flex;gap:6px">'
      +'<button class="bg-btn" onclick="bgShowNeedFormInline(\''+ent.id+'\')">＋ Behoefte toevoegen</button>'
      +'<button class="bg-btn" onclick="bgImportFromQuote(\''+ent.id+'\')">📥 Import uit offerte</button>'
      +'<button class="bg-btn" style="color:#c0392b" onclick="bgEditEntity(\''+ent.id+'\')">✎ Bewerk</button>'
      +'</div></div>';

    // ── Inline add form slot ──
    h+='<div id="bg-need-form-slot"></div>';

    // ── Entity KPIs ──
    var eOpen=eNeeds.filter(function(n){return n.status==="open";}).length;
    var eBundled=eNeeds.filter(function(n){return n.status==="bundled";}).length;
    var eOrdered=eNeeds.filter(function(n){return n.status==="ordered";}).length;
    var eDelivered=eNeeds.filter(function(n){return n.status==="delivered";}).length;
    var eQty=eNeeds.reduce(function(a,n){return a+Number(n.quantity);},0);
    var eVal=eNeeds.reduce(function(a,n){return a+(Number(n.quantity)*Number(n.unit_price_estimate));},0);

    h+='<div class="bg-kpi-row bg-kpi-row-sm">'
      +_kpi("Totaal items",eNeeds.length,"var(--gr)")
      +_kpi("Open",eOpen,"#1565C0")
      +_kpi("Gebundeld",eBundled,"#E65100")
      +_kpi("Besteld",eOrdered,"#2E7D32")
      +_kpi("Geleverd",eDelivered,"#7B1FA2")
      +_kpi("Stuks",eQty,"var(--gr)")
      +_kpi("Waarde",_fE(eVal),"var(--red)")
      +'</div>';

    // ── Status filter ──
    h+='<div class="bg-need-filters">';
    ["all","open","bundled","ordered","delivered","cancelled"].forEach(function(st){
      var label=st==="all"?"Alles":(NEED_ST[st]?NEED_ST[st].l:st);
      var cnt=st==="all"?eNeeds.length:eNeeds.filter(function(n){return n.status===st;}).length;
      h+='<button class="bg-filter-btn'+(_needFilter===st?' bg-filter-on':'')+'" onclick="bgSetNeedFilter(\''+st+'\')">'
        +label+' ('+cnt+')</button>';
    });
    h+='</div>';

    // ── Needs table filtered ──
    var filtered=eNeeds;
    if(_needFilter!=="all") filtered=eNeeds.filter(function(n){return n.status===_needFilter;});
    h+=renderNeedsTable(filtered, false);

    return h;
  }

  /* ─── Shared needs table ─── */
  function renderNeedsTable(needs, showEntity){
    if(!needs.length) return '<div class="bg-empty">Geen behoeften gevonden.</div>';

    var h='<div class="bg-tbl-wrap"><table class="bg-tbl"><thead><tr>';
    if(showEntity) h+='<th>Vestiging</th>';
    h+='<th>Product</th><th>Artikelcode</th><th>Categorie</th>'
      +'<th style="text-align:center">Qty</th><th style="text-align:right">Prijs/st</th>'
      +'<th style="text-align:right">Totaal</th><th>Nodig vóór</th>'
      +'<th>Status</th><th>Notities</th><th></th></tr></thead><tbody>';

    needs.forEach(function(n){
      var ent=n.buying_entities||{};
      var lineTotal=Number(n.quantity)*Number(n.unit_price_estimate);
      var statusOpts=Object.keys(NEED_ST).map(function(k){
        return '<option value="'+k+'"'+(k===n.status?' selected':'')+'>'+NEED_ST[k].l+'</option>';
      }).join('');

      h+='<tr>';
      if(showEntity) h+='<td><span style="font-weight:600">'+_esc(ent.name||"—")+'</span>'
        +'<span style="font-size:10px;color:#999;margin-left:4px">'+_esc(ent.code||"")+'</span></td>';
      h+='<td style="font-weight:600">'+_esc(n.product_name)+'</td>'
        +'<td><code class="bg-code">'+_esc(n.product_ref||"—")+'</code></td>'
        +'<td>'+_esc(n.category||"—")+'</td>'
        +'<td style="text-align:center;font-weight:700;font-size:14px">'+n.quantity+'</td>'
        +'<td style="text-align:right;font-variant-numeric:tabular-nums">'+_fE(n.unit_price_estimate)+'</td>'
        +'<td style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums">'+_fE(lineTotal)+'</td>'
        +'<td style="font-size:11px;color:'+(n.needed_by?'var(--gr)':'#ccc')+'">'+_esc(n.needed_by||"—")+'</td>'
        +'<td>'+_badge(NEED_ST,n.status)+'</td>'
        +'<td style="font-size:11px;color:#64748b;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+_esc(n.notes||"")+'">'+_esc(n.notes||"")+'</td>'
        +'<td style="white-space:nowrap">'
        +'<select onchange="bgUpdateNeedStatus(\''+n.id+'\',this.value)" style="font-size:10px;padding:2px 4px;border:1px solid var(--bd);border-radius:4px;background:#fff;font-family:inherit">'+statusOpts+'</select> '
        +'<button class="bg-act" onclick="bgEditNeed(\''+n.id+'\')" title="Bewerk">✎</button>'
        +'<button class="bg-act" onclick="bgDeleteNeed(\''+n.id+'\')" title="Verwijder" style="color:#c0392b">✕</button>'
        +'</td></tr>';
    });
    h+='</tbody></table></div>';
    return h;
  }

  /* ═══════════════════════════════════════════════════════════════
     TAB 3 — BUNDELS
     ═══════════════════════════════════════════════════════════════ */
  function renderBundlesTab(){
    var h='';
    var active=_bundles.filter(function(b){return b.status!=="closed";});
    var closed=_bundles.filter(function(b){return b.status==="closed";});

    h+='<div class="bg-section-hdr"><span>📦 Actieve bundels ('+active.length+')</span>'
      +'<button class="bg-btn bg-btn-accent" onclick="bgCreateBundles()" style="margin-left:auto">⚡ Nieuwe bundels detecteren</button></div>';

    if(!active.length){
      h+='<div class="bg-empty">Geen actieve bundels. Ga naar Overzicht → Overlap-detectie → Bundels genereren.</div>';
    } else {
      h+='<div class="bg-bundle-grid">';
      active.forEach(function(b){ h+=renderBundleCard(b); });
      h+='</div>';
    }

    if(closed.length){
      h+='<div class="bg-section-hdr" style="margin-top:20px"><span>🔒 Afgesloten bundels ('+closed.length+')</span></div>';
      h+='<div class="bg-bundle-grid">';
      closed.forEach(function(b){ h+=renderBundleCard(b); });
      h+='</div>';
    }
    return h;
  }

  function renderBundleCard(b){
    var sav=Number(b.estimated_saving_pct)||0;
    var statusOpts=Object.keys(BUNDLE_ST).map(function(k){
      return '<option value="'+k+'"'+(k===b.status?' selected':'')+'>'+BUNDLE_ST[k].l+'</option>';
    }).join('');

    return '<div class="bg-bundle-card">'
      +'<div class="bg-bc-hdr">'
      +'<div><code class="bg-code" style="font-size:11px">'+_esc(b.bundle_ref)+'</code>'
      +'<div style="font-size:14px;font-weight:700;margin-top:4px">'+_esc(b.product_name||b.product_ref)+'</div>'
      +'<div style="font-size:11px;color:#94a3b8">'+_esc(b.category||"")+'</div></div>'
      +_badge(BUNDLE_ST,b.status)
      +'</div>'
      +'<div class="bg-bc-metrics">'
      +'<div class="bg-bc-m"><div class="bg-bc-m-val">'+b.total_qty+'</div><div class="bg-bc-m-lbl">Totaal stuks</div></div>'
      +'<div class="bg-bc-m"><div class="bg-bc-m-val">'+b.entity_count+'</div><div class="bg-bc-m-lbl">Vestigingen</div></div>'
      +(sav>0?'<div class="bg-bc-m"><div class="bg-bc-m-val" style="color:#2E7D32">−'+sav.toFixed(1)+'%</div><div class="bg-bc-m-lbl">Besparing</div></div>':'')
      +'</div>'
      +'<div class="bg-bc-actions">'
      +'<select onchange="bgUpdateBundleStatus(\''+b.id+'\',this.value)" class="bg-select-full">'+statusOpts+'</select>'
      +'<button class="bg-btn" onclick="bgShowBundleDetail(\''+b.id+'\')">📋 Details</button>'
      +'</div></div>';
  }

  /* ═══════════════════════════════════════════════════════════════
     INLINE FORMS
     ═══════════════════════════════════════════════════════════════ */

  // ── Vestiging toevoegen ──
  global.bgShowEntityForm=function(){
    var slot=_el("bg-entity-form-slot");
    if(!slot) return;
    slot.innerHTML=
      '<div class="bg-form">'
      +'<div class="bg-form-title">Nieuwe vestiging</div>'
      +'<div class="bg-form-row">'
      +'<div class="bg-form-field"><label>Naam *</label><input id="bgf-ent-name" placeholder="bv. Antwerpen HQ"></div>'
      +'<div class="bg-form-field"><label>Code</label><input id="bgf-ent-code" placeholder="bv. BE-ANT"></div>'
      +'<div class="bg-form-field"><label>Land</label><input id="bgf-ent-country" value="BE" placeholder="BE"></div>'
      +'<div class="bg-form-field"><label>Contact e-mail</label><input id="bgf-ent-email" type="email" placeholder="inkoop@..."></div>'
      +'</div>'
      +'<div class="bg-form-actions">'
      +'<button class="bg-btn bg-btn-accent" onclick="bgSaveEntity()">✓ Opslaan</button>'
      +'<button class="bg-btn" onclick="document.getElementById(\'bg-entity-form-slot\').innerHTML=\'\'">Annuleren</button>'
      +'</div></div>';
    _el("bgf-ent-name").focus();
  };

  global.bgSaveEntity=async function(){
    var name=(_el("bgf-ent-name")||{}).value||"";
    if(!name.trim()){ _toast("Vul een naam in"); return; }
    try{
      await createEntity({
        name:name.trim(),
        code:(_el("bgf-ent-code")||{}).value||"",
        country:(_el("bgf-ent-country")||{}).value||"BE",
        contact_email:(_el("bgf-ent-email")||{}).value||""
      });
      _toast("✓ Vestiging toegevoegd");
      loadAll();
    }catch(e){ _toast("⚠ "+e.message); }
  };

  // ── Behoefte toevoegen (inline in entity tab) ──
  global.bgShowNeedFormInline=function(entityId){
    var slot=_el("bg-need-form-slot");
    if(!slot) return;
    slot.innerHTML=
      '<div class="bg-form">'
      +'<div class="bg-form-title">Nieuwe inkoopbehoefte</div>'
      +'<div class="bg-form-row">'
      +'<div class="bg-form-field" style="flex:2"><label>Productnaam *</label><input id="bgf-n-name" placeholder="bv. Samsung QM55R"></div>'
      +'<div class="bg-form-field"><label>Artikelcode</label><input id="bgf-n-ref" placeholder="bv. QM55R"></div>'
      +'<div class="bg-form-field"><label>Categorie</label><input id="bgf-n-cat" placeholder="bv. displays"></div>'
      +'</div>'
      +'<div class="bg-form-row">'
      +'<div class="bg-form-field"><label>Aantal *</label><input id="bgf-n-qty" type="number" value="1" min="1"></div>'
      +'<div class="bg-form-field"><label>Indicatieve prijs/st (€)</label><input id="bgf-n-price" type="number" step="0.01" value="0"></div>'
      +'<div class="bg-form-field"><label>Nodig vóór</label><input id="bgf-n-date" type="date"></div>'
      +'</div>'
      +'<div class="bg-form-row">'
      +'<div class="bg-form-field" style="flex:3"><label>Notities</label><input id="bgf-n-notes" placeholder="Optioneel: specificaties, leverancier, …"></div>'
      +'</div>'
      +'<div class="bg-form-actions">'
      +'<button class="bg-btn bg-btn-accent" onclick="bgSaveNeed(\''+entityId+'\')">✓ Toevoegen</button>'
      +'<button class="bg-btn bg-btn-accent" onclick="bgSaveNeedAndMore(\''+entityId+'\')">✓ Toevoegen + nog een</button>'
      +'<button class="bg-btn" onclick="document.getElementById(\'bg-need-form-slot\').innerHTML=\'\'">Annuleren</button>'
      +'</div></div>';
    _el("bgf-n-name").focus();
  };

  function _collectNeedForm(){
    return {
      product_name: (_el("bgf-n-name")||{}).value||"",
      product_ref:  (_el("bgf-n-ref")||{}).value||"",
      category:     (_el("bgf-n-cat")||{}).value||"",
      quantity:     (_el("bgf-n-qty")||{}).value||"1",
      unit_price_estimate: (_el("bgf-n-price")||{}).value||"0",
      needed_by:    (_el("bgf-n-date")||{}).value||null,
      notes:        (_el("bgf-n-notes")||{}).value||""
    };
  }

  global.bgSaveNeed=async function(entityId){
    var d=_collectNeedForm();
    if(!d.product_name.trim()){ _toast("Vul een productnaam in"); return; }
    try{
      await createNeed(entityId,d);
      _toast("✓ Behoefte toegevoegd");
      loadAll();
    }catch(e){ _toast("⚠ "+e.message); }
  };

  global.bgSaveNeedAndMore=async function(entityId){
    var d=_collectNeedForm();
    if(!d.product_name.trim()){ _toast("Vul een productnaam in"); return; }
    try{
      await createNeed(entityId,d);
      _toast("✓ Toegevoegd — vul het volgende product in");
      // Reset form fields but keep it open
      if(_el("bgf-n-name")) _el("bgf-n-name").value="";
      if(_el("bgf-n-ref"))  _el("bgf-n-ref").value="";
      if(_el("bgf-n-qty"))  _el("bgf-n-qty").value="1";
      if(_el("bgf-n-price"))_el("bgf-n-price").value="0";
      if(_el("bgf-n-notes"))_el("bgf-n-notes").value="";
      _el("bgf-n-name").focus();
      // Refresh data in background
      _needs=await listNeeds();
      _overlaps=await detectOverlaps();
    }catch(e){ _toast("⚠ "+e.message); }
  };

  /* ═══════════════════════════════════════════════════════════════
     IMPORT UIT OFFERTE
     ═══════════════════════════════════════════════════════════════ */
  global.bgImportFromQuote=function(entityId){
    // Haal items uit huidige offerte-sessie
    var zalen=global.zalen||[];
    if(!zalen.length||!zalen.some(function(z){return z.items&&z.items.length;})){
      _toast("⚠ Geen items in de huidige offerte");
      return;
    }
    var count=0;
    var promises=[];
    zalen.forEach(function(z){
      (z.items||[]).forEach(function(it){
        promises.push(createNeed(entityId,{
          product_name: it.name||"",
          product_ref:  it.ref||"",
          category:     "",
          quantity:     Number(it.qty)||1,
          unit_price_estimate: Number(it.price)||0,
          notes:        "Import uit offerte — zaal: "+(z.name||"?")
        }));
        count++;
      });
    });
    Promise.all(promises).then(function(){
      _toast("✓ "+count+" items geïmporteerd uit offerte");
      loadAll();
    }).catch(function(e){ _toast("⚠ "+e.message); });
  };

  /* ═══════════════════════════════════════════════════════════════
     ACTION HANDLERS
     ═══════════════════════════════════════════════════════════════ */
  global.bgSwitchTab=function(tab){
    _activeTab=tab;
    renderAll();
  };

  global.bgSelectEntity=function(id){
    _selectedEntity=id;
    _needFilter="all";
    if(_activeTab!=="entity") _activeTab="entity";
    renderAll();
  };

  global.bgSetNeedFilter=function(st){
    _needFilter=st;
    renderAll();
  };

  global.bgUpdateNeedStatus=async function(id,status){
    try{
      await updateNeed(id,{status:status});
      _toast("✓ "+NEED_ST[status].l);
      _needs=await listNeeds();
      renderAll();
    }catch(e){ _toast("⚠ "+e.message); }
  };

  global.bgDeleteNeed=function(id){
    if(!confirm("Behoefte verwijderen?")) return;
    deleteNeed(id).then(function(){
      _toast("✓ Verwijderd");
      loadAll();
    }).catch(function(e){ _toast("⚠ "+e.message); });
  };

  global.bgEditNeed=function(id){
    var n=_needs.find(function(x){return x.id===id;});
    if(!n) return;
    var newQty=prompt("Aantal:",n.quantity);
    if(newQty===null) return;
    var newPrice=prompt("Prijs/st (€):",n.unit_price_estimate);
    if(newPrice===null) return;
    var newNotes=prompt("Notities:",n.notes||"");
    updateNeed(id,{quantity:parseInt(newQty)||n.quantity,unit_price_estimate:parseFloat(newPrice)||0,notes:newNotes||""})
      .then(function(){ _toast("✓ Bijgewerkt"); loadAll(); })
      .catch(function(e){ _toast("⚠ "+e.message); });
  };

  global.bgEditEntity=function(id){
    var e=_entities.find(function(x){return x.id===id;});
    if(!e) return;
    var name=prompt("Naam:",e.name);
    if(!name) return;
    var code=prompt("Code:",e.code||"");
    var email=prompt("Contact e-mail:",e.contact_email||"");
    updateEntity(id,{name:name,code:code||"",contact_email:email||""})
      .then(function(){ _toast("✓ Bijgewerkt"); loadAll(); })
      .catch(function(e){ _toast("⚠ "+e.message); });
  };

  global.bgCreateBundles=async function(){
    try{
      var count=await createBundlesRPC();
      if(count>0) _toast("✓ "+count+" bundel(s) aangemaakt");
      else _toast("Geen nieuwe bundels gevonden");
      loadAll();
    }catch(e){ _toast("⚠ "+e.message); }
  };

  global.bgUpdateBundleStatus=function(id,status){
    updateBundleStatus(id,status).then(function(){
      _toast("✓ "+BUNDLE_ST[status].l);
      loadAll();
    }).catch(function(e){ _toast("⚠ "+e.message); });
  };

  global.bgShowBundleDetail=async function(id){
    try{
      var lines=await getBundleLines(id);
      var b=_bundles.find(function(x){return x.id===id;});
      var html='<div style="padding:16px"><h3 style="margin-bottom:12px">'+_esc((b&&b.bundle_ref)||id)
        +' — '+_esc((b&&b.product_name)||"")+'</h3>';

      if(!lines.length){
        html+='<p style="color:#999">Geen detail-regels gevonden.</p>';
      } else {
        html+='<table style="width:100%;border-collapse:collapse;font-size:12px">'
          +'<thead><tr style="background:#f8fafc"><th style="padding:8px;text-align:left">Vestiging</th>'
          +'<th style="padding:8px;text-align:center">Qty</th>'
          +'<th style="padding:8px;text-align:right">Prijs/st</th></tr></thead><tbody>';
        lines.forEach(function(l){
          var ent=l.buying_entities||{};
          var need=l.buying_needs||{};
          html+='<tr style="border-bottom:1px solid #eee">'
            +'<td style="padding:8px;font-weight:600">'+_esc(ent.name||"—")+' <span style="color:#999;font-size:10px">'+_esc(ent.code||"")+'</span></td>'
            +'<td style="padding:8px;text-align:center;font-weight:700">'+l.quantity+'</td>'
            +'<td style="padding:8px;text-align:right">'+_fE(need.unit_price_estimate||0)+'</td></tr>';
        });
        html+='</tbody></table>';
      }
      html+='<div style="margin-top:12px;text-align:right"><button class="bg-btn" onclick="this.closest(\'.bg-modal-wrap\').remove()">Sluiten</button></div></div>';

      var wrap=document.createElement("div");
      wrap.className="bg-modal-wrap";
      wrap.style.cssText="position:fixed;inset:0;z-index:99000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px";
      wrap.innerHTML='<div style="background:#fff;border-radius:12px;max-width:600px;width:100%;max-height:80vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">'+html+'</div>';
      wrap.onclick=function(e){if(e.target===wrap)wrap.remove();};
      document.body.appendChild(wrap);
    }catch(e){ _toast("⚠ "+e.message); }
  };

  /* ═══════════════════════════════════════════════════════════════
     PANEL INJECTIE + CSS
     ═══════════════════════════════════════════════════════════════ */
  function injectPanel(){
    if(document.getElementById("p-buying-group")) return;

    var panel=document.createElement("div");
    panel.className="panel";
    panel.id="p-buying-group";
    panel.style.cssText="max-width:none!important;width:100%;padding:0;box-sizing:border-box";

    panel.innerHTML=
      '<style>'
      /* Base */
      +'#p-buying-group{font-family:"Inter",Arial,sans-serif;-webkit-font-smoothing:antialiased}'
      +'#p-buying-group *{box-sizing:border-box}'

      /* KPI row */
      +'.bg-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;padding:16px 16px 0}'
      +'.bg-kpi-row-sm{padding:0 0 8px}'
      +'.bg-kpi{background:#fff;border:1px solid var(--bd);border-radius:10px;padding:12px}'
      +'.bg-kpi-lbl{font-size:10px;font-weight:600;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px}'
      +'.bg-kpi-val{font-size:18px;font-weight:800;letter-spacing:-.5px;line-height:1}'

      /* Tabs */
      +'.bg-tabs{display:flex;gap:0;border-bottom:2px solid var(--bd);margin:16px 16px 0;overflow-x:auto}'
      +'.bg-tab{padding:10px 18px;font-size:12px;font-weight:600;color:#94a3b8;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;cursor:pointer;white-space:nowrap;font-family:inherit}'
      +'.bg-tab:hover{color:var(--gr)}'
      +'.bg-tab-on{color:var(--red);border-bottom-color:var(--red)}'

      /* Sections */
      +'.bg-section-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 16px;margin-bottom:10px;margin-top:16px;flex-wrap:wrap}'
      +'.bg-section-hdr>span{font-size:14px;font-weight:700;color:var(--gr)}'

      /* Buttons */
      +'.bg-btn{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--bd);border-radius:8px;background:#fff;padding:7px 14px;font-size:11px;font-weight:600;color:var(--gr);cursor:pointer;font-family:inherit;white-space:nowrap}'
      +'.bg-btn:hover{background:#f8fafc}'
      +'.bg-btn:disabled{opacity:.4;cursor:default}'
      +'.bg-btn-accent{background:var(--red);color:#fff;border-color:var(--red)}'
      +'.bg-btn-accent:hover{opacity:.9}'
      +'.bg-act{background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px}'

      /* Entity grid */
      +'.bg-entity-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;padding:0 16px}'
      +'.bg-entity-card{background:#fff;border:1px solid var(--bd);border-radius:12px;padding:14px;cursor:pointer;transition:box-shadow .15s;box-shadow:0 1px 3px rgba(0,0,0,.04)}'
      +'.bg-entity-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08)}'
      +'.bg-ec-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}'
      +'.bg-ec-name{font-size:14px;font-weight:700;color:var(--gr)}'
      +'.bg-ec-meta{font-size:10px;color:#94a3b8;margin-top:2px}'
      +'.bg-ec-qty{text-align:right;font-size:22px;font-weight:800;color:var(--red);line-height:1}'
      +'.bg-ec-qty span{display:block;font-size:10px;color:#94a3b8;font-weight:600}'
      +'.bg-ec-stats{display:flex;gap:12px;margin-bottom:8px}'
      +'.bg-ec-stat{font-size:11px;color:#64748b;display:flex;align-items:center;gap:4px}'
      +'.bg-ec-stat b{font-weight:700}'
      +'.bg-ec-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}'
      +'.bg-ec-val{font-size:12px;font-weight:700;color:var(--gr);text-align:right}'

      /* Entity pills (tab 2) */
      +'.bg-entity-selector{padding:16px 16px 0}'
      +'.bg-entity-pills{display:flex;gap:6px;flex-wrap:wrap}'
      +'.bg-pill{padding:7px 16px;border-radius:99px;border:1px solid var(--bd);background:#fff;font-size:12px;font-weight:600;color:#64748b;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px}'
      +'.bg-pill:hover{border-color:#94a3b8}'
      +'.bg-pill-on{background:var(--red);color:#fff;border-color:var(--red)}'
      +'.bg-pill-count{background:rgba(0,0,0,.1);padding:1px 7px;border-radius:99px;font-size:10px}'
      +'.bg-pill-on .bg-pill-count{background:rgba(255,255,255,.3)}'

      /* Entity detail header */
      +'.bg-ent-detail-hdr{display:flex;justify-content:space-between;align-items:flex-start;padding:16px;gap:10px;flex-wrap:wrap}'

      /* Need filters */
      +'.bg-need-filters{display:flex;gap:4px;padding:0 16px 10px;flex-wrap:wrap}'
      +'.bg-filter-btn{padding:5px 12px;border-radius:99px;border:1px solid var(--bd);background:#fff;font-size:11px;color:#64748b;cursor:pointer;font-family:inherit}'
      +'.bg-filter-btn:hover{border-color:#94a3b8}'
      +'.bg-filter-on{background:var(--gr);color:#fff;border-color:var(--gr)}'

      /* Tables */
      +'.bg-tbl-wrap{border:1px solid var(--bd);border-radius:10px;overflow:auto;background:#fff;margin:0 16px;box-shadow:0 1px 3px rgba(0,0,0,.04)}'
      +'.bg-tbl{width:100%;border-collapse:collapse;font-size:11.5px;min-width:700px}'
      +'.bg-tbl thead th{background:#f8fafc;padding:9px 10px;text-align:left;font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid var(--bd);white-space:nowrap}'
      +'.bg-tbl tbody tr{border-bottom:1px solid #f3f3f1}'
      +'.bg-tbl tbody tr:hover{background:#fafaf8}'
      +'.bg-tbl td{padding:8px 10px;vertical-align:middle}'
      +'.bg-code{background:#f1f5f9;padding:2px 7px;border-radius:4px;font-size:10px;font-family:monospace}'

      /* Badges */
      +'.bg-qty-badge{display:inline-flex;align-items:center;justify-content:center;background:var(--red);color:#fff;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:800;min-width:30px}'
      +'.bg-ent-badge{display:inline-flex;align-items:center;justify-content:center;background:#E3F2FD;color:#1565C0;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700}'

      /* Bundle grid */
      +'.bg-bundle-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;padding:0 16px}'
      +'.bg-bundle-card{background:#fff;border:1px solid var(--bd);border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)}'
      +'.bg-bc-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}'
      +'.bg-bc-metrics{display:flex;gap:20px;margin-bottom:14px}'
      +'.bg-bc-m-val{font-size:22px;font-weight:800;line-height:1}'
      +'.bg-bc-m-lbl{font-size:10px;color:#94a3b8;font-weight:600;margin-top:2px}'
      +'.bg-bc-actions{display:flex;gap:6px}'
      +'.bg-select-full{flex:1;font-size:11px;padding:7px 10px;border:1px solid var(--bd);border-radius:8px;background:#fff;font-family:inherit}'

      /* Forms */
      +'.bg-form{background:#f8fafc;border:1px solid var(--bd);border-radius:10px;padding:16px;margin:10px 16px}'
      +'.bg-form-title{font-size:13px;font-weight:700;color:var(--gr);margin-bottom:12px}'
      +'.bg-form-row{display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap}'
      +'.bg-form-field{flex:1;min-width:120px}'
      +'.bg-form-field label{display:block;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px}'
      +'.bg-form-field input{width:100%;padding:8px 10px;border:1px solid var(--bd);border-radius:6px;font-size:12px;font-family:inherit;outline:none;background:#fff}'
      +'.bg-form-field input:focus{border-color:var(--red);box-shadow:0 0 0 3px rgba(37,99,235,.08)}'
      +'.bg-form-actions{display:flex;gap:6px;margin-top:4px}'

      /* Empty state */
      +'.bg-empty{color:#94a3b8;font-size:12px;text-align:center;padding:24px;background:#fff;border:1px solid var(--bd);border-radius:10px;margin:0 16px}'

      /* Mobile */
      +'@media(max-width:600px){'
      +'.bg-kpi-row{grid-template-columns:repeat(3,1fr)}'
      +'.bg-entity-grid{grid-template-columns:1fr}'
      +'.bg-bundle-grid{grid-template-columns:1fr}'
      +'.bg-form-row{flex-direction:column}'
      +'.bg-form-field{min-width:100%}'
      +'.bg-ent-detail-hdr{flex-direction:column}'
      +'}'
      +'</style>'

      +'<div style="padding:16px 16px 0;display:flex;align-items:flex-end;justify-content:space-between;gap:10px;flex-wrap:wrap">'
      +'<div style="font-size:19px;font-weight:800;letter-spacing:-.4px;color:var(--gr)">📦 Slimme Inkoop & Bundeling</div>'
      +'<button class="bg-btn" onclick="loadBuyingGroupData()">↻ Vernieuwen</button>'
      +'</div>'
      +'<div id="bg-content"><div style="text-align:center;padding:30px;color:#999">Laden…</div></div>';

    var ref=document.getElementById("supa-modal")||document.body.lastChild;
    ref.parentNode.insertBefore(panel, ref);

    // Menu button
    var advMenu=document.getElementById("adv-menu");
    if(advMenu){
      var btn=document.createElement("button");
      btn.className="am-item";
      btn.innerHTML='<span>📦</span>Inkoop & Bundeling';
      btn.onclick=function(){ global.goPanel("p-buying-group"); loadAll(); };
      advMenu.appendChild(btn);
    }
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",injectPanel);
  else injectPanel();

  /* Public API */
  global.BuyingGroup={
    listEntities:listEntities, createEntity:createEntity, deleteEntity:deleteEntity,
    listNeeds:listNeeds, createNeed:createNeed, updateNeed:updateNeed, deleteNeed:deleteNeed,
    detectOverlaps:detectOverlaps, createBundles:createBundlesRPC,
    listBundles:listBundles, updateBundleStatus:updateBundleStatus,
    reload:loadAll
  };
  global.loadBuyingGroupData=loadAll;

})(typeof window!=="undefined"?window:this);
