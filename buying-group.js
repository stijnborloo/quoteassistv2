/* ═══════════════════════════════════════════════════════════════════════
   buying-group.js — Slimme Inkoop- & Bundelingsmodule
   ───────────────────────────────────────────────────────────────────────
   Inkoopbehoeften van meerdere entiteiten/vestigingen invoeren,
   automatisch overlap detecteren en volumes bundelen.
   Laad ná tenant-config.js.
   ═══════════════════════════════════════════════════════════════════════ */
(function(global){
  "use strict";

  function _esc(s){ return typeof global.esc==="function"?global.esc(s):String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function _toast(m){ if(typeof global.toast==="function") global.toast(m); else console.log("[buying-group]",m); }
  function _fE(n){ return typeof global.fE==="function"?global.fE(n):("€\u00a0"+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,".")); }
  function _tenantId(){ return (global.TC&&global.TC.tenant)||"default"; }

  /* ═══════════════════════════════════════════════════════════════
     1. ENTITEITEN (vestigingen / BU's)
     ═══════════════════════════════════════════════════════════════ */
  async function listEntities(){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("buying_entities").select("*").order("name");
    if(r.error) throw new Error(r.error.message);
    return r.data||[];
  }

  async function createEntity(name, code, country, email){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("buying_entities").insert({
      name:name, code:code||"", country:country||"BE", contact_email:email||""
    }).select().single();
    if(r.error) throw new Error(r.error.message);
    return r.data;
  }

  async function deleteEntity(id){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("buying_entities").delete().eq("id",id);
    if(r.error) throw new Error(r.error.message);
  }

  /* ═══════════════════════════════════════════════════════════════
     2. INKOOPBEHOEFTEN
     ═══════════════════════════════════════════════════════════════ */
  async function listNeeds(entityId){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var q=cl.from("buying_needs").select("*, buying_entities(name,code)").order("created_at",{ascending:false});
    if(entityId) q=q.eq("entity_id",entityId);
    var r=await q.limit(200);
    if(r.error) throw new Error(r.error.message);
    return r.data||[];
  }

  async function createNeed(entityId, data){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var u=await cl.auth.getUser();
    var email=(u&&u.data&&u.data.user)?u.data.user.email:"";
    var r=await cl.from("buying_needs").insert({
      entity_id:          entityId,
      product_ref:        data.product_ref||"",
      product_name:       data.product_name||"",
      category:           data.category||"",
      quantity:           Number(data.quantity)||1,
      unit_price_estimate: Number(data.unit_price_estimate)||0,
      needed_by:          data.needed_by||null,
      notes:              data.notes||"",
      user_email:         email
    }).select().single();
    if(r.error) throw new Error(r.error.message);
    return r.data;
  }

  async function updateNeed(id, data){
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

  /* ═══════════════════════════════════════════════════════════════
     3. OVERLAP-DETECTIE & BUNDELING
     ═══════════════════════════════════════════════════════════════ */
  async function detectOverlaps(){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.rpc("detect_buying_overlaps",{p_tenant:_tenantId()});
    if(r.error) throw new Error(r.error.message);
    return r.data||[];
  }

  async function createBundles(){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.rpc("create_bundles_from_overlaps",{p_tenant:_tenantId()});
    if(r.error) throw new Error(r.error.message);
    return r.data; // aantal aangemaakte bundels
  }

  async function listBundles(){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("buying_bundles").select("*").order("created_at",{ascending:false}).limit(50);
    if(r.error) throw new Error(r.error.message);
    return r.data||[];
  }

  async function updateBundleStatus(id, status){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("buying_bundles").update({status:status,updated_at:new Date().toISOString()}).eq("id",id);
    if(r.error) throw new Error(r.error.message);
  }

  /* ═══════════════════════════════════════════════════════════════
     4. VOLUMESTAFFELS
     ═══════════════════════════════════════════════════════════════ */
  async function listTiers(productRef){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var q=cl.from("volume_tiers").select("*").order("min_qty");
    if(productRef) q=q.eq("product_ref",productRef);
    var r=await q;
    if(r.error) throw new Error(r.error.message);
    return r.data||[];
  }

  async function upsertTier(data){
    var cl=global.supaInit(); if(!cl) throw new Error("Supabase niet beschikbaar");
    var r=await cl.from("volume_tiers").upsert(data);
    if(r.error) throw new Error(r.error.message);
  }

  /* ═══════════════════════════════════════════════════════════════
     5. UI — Panel injectie + rendering
     ═══════════════════════════════════════════════════════════════ */

  var NEED_STATUS = {
    open:      {label:"Open",      bg:"#E3F2FD", color:"#1565C0"},
    bundled:   {label:"Gebundeld", bg:"#FFF3E0", color:"#E65100"},
    ordered:   {label:"Besteld",   bg:"#E8F5E9", color:"#2E7D32"},
    delivered: {label:"Geleverd",  bg:"#F3E5F5", color:"#7B1FA2"},
    cancelled: {label:"Geannuleerd",bg:"#FFEBEE", color:"#C62828"}
  };

  var BUNDLE_STATUS = {
    proposed: {label:"Voorstel",   bg:"#FFF3E0", color:"#E65100"},
    approved: {label:"Goedgekeurd",bg:"#E3F2FD", color:"#1565C0"},
    ordered:  {label:"Besteld",    bg:"#E8F5E9", color:"#2E7D32"},
    delivered:{label:"Geleverd",   bg:"#F3E5F5", color:"#7B1FA2"},
    closed:   {label:"Afgesloten", bg:"#f0f0f0", color:"#555"}
  };

  function _badge(cfg,st){
    var c=cfg[st]||{label:st,bg:"#eee",color:"#555"};
    return '<span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:10px;font-weight:600;background:'+c.bg+';color:'+c.color+'">'+_esc(c.label)+'</span>';
  }

  /* ── Cached data ── */
  var _entities=[], _needs=[], _overlaps=[], _bundles=[];

  async function loadBuyingGroupData(){
    try{
      _entities=await listEntities();
      _needs=await listNeeds();
      _overlaps=await detectOverlaps();
      _bundles=await listBundles();
    }catch(e){
      _toast("⚠ "+e.message);
      return;
    }
    renderBuyingGroup();
  }

  function renderBuyingGroup(){
    var root=document.getElementById("bg-content");
    if(!root) return;

    /* ── Entiteiten-sectie ── */
    var entHtml='<div style="margin-bottom:20px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      +'<div style="font-size:14px;font-weight:700;color:var(--gr)">🏢 Vestigingen ('+_entities.length+')</div>'
      +'<button class="db-btn" onclick="bgAddEntity()">＋ Vestiging</button>'
      +'</div>';

    if(!_entities.length){
      entHtml+='<div style="color:#bbb;font-size:12px;text-align:center;padding:16px">Nog geen vestigingen. Voeg er een toe om te starten.</div>';
    } else {
      entHtml+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">';
      _entities.forEach(function(e){
        entHtml+='<div style="background:#fff;border:1px solid var(--bd);border-radius:10px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.04)">'
          +'<div style="font-weight:600;font-size:12px">'+_esc(e.name)+'</div>'
          +'<div style="font-size:10px;color:#999">'+_esc(e.code||"")+(e.country?' · '+_esc(e.country):'')+'</div>'
          +'<div style="margin-top:6px;display:flex;gap:4px">'
          +'<button class="db-act-btn" onclick="bgShowNeedForm(\''+e.id+'\',\''+_esc(e.name)+'\')" title="Behoefte toevoegen">＋</button>'
          +'<button class="db-act-btn" onclick="bgDeleteEntity(\''+e.id+'\')" title="Verwijderen" style="color:#c0392b">✕</button>'
          +'</div></div>';
      });
      entHtml+='</div>';
    }
    entHtml+='</div>';

    /* ── Overlap-detectie ── */
    var ovHtml='<div style="margin-bottom:20px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      +'<div style="font-size:14px;font-weight:700;color:var(--gr)">🔍 Gedetecteerde overlap ('+_overlaps.length+')</div>'
      +'<button class="db-btn" onclick="bgCreateBundles()" style="background:var(--red);color:#fff;border-color:var(--red)"'
      +(_overlaps.length?'':' disabled style="opacity:.4"')+'>⚡ Bundels genereren</button>'
      +'</div>';

    if(!_overlaps.length){
      ovHtml+='<div style="color:#bbb;font-size:12px;text-align:center;padding:16px;background:#fff;border:1px solid var(--bd);border-radius:10px">'
        +'Geen overlappende behoeften gevonden. Voeg behoeften toe bij 2+ vestigingen voor hetzelfde product.</div>';
    } else {
      ovHtml+='<div style="border:1px solid var(--bd);border-radius:10px;overflow:auto;background:#fff">'
        +'<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:500px">'
        +'<thead><tr style="background:#f8fafc"><th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Product</th>'
        +'<th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Categorie</th>'
        +'<th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Totaal qty</th>'
        +'<th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Vestigingen</th>'
        +'<th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Wie</th>'
        +'<th style="padding:9px 12px;text-align:right;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Besparing</th>'
        +'</tr></thead><tbody>';

      _overlaps.forEach(function(o){
        var saving=Number(o.saving_pct)||0;
        ovHtml+='<tr style="border-bottom:1px solid #f0f0f0">'
          +'<td style="padding:9px 12px;font-weight:600">'+_esc(o.product_name||o.product_ref)+'</td>'
          +'<td style="padding:9px 12px;color:#64748b">'+_esc(o.category||'—')+'</td>'
          +'<td style="padding:9px 12px;text-align:center;font-weight:700;font-size:14px">'+o.total_qty+'</td>'
          +'<td style="padding:9px 12px;text-align:center"><span style="background:#E3F2FD;color:#1565C0;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700">'+o.entity_count+'</span></td>'
          +'<td style="padding:9px 12px;font-size:11px;color:#64748b">'+_esc(o.entity_names)+'</td>'
          +'<td style="padding:9px 12px;text-align:right;font-weight:700;color:'+(saving>0?'#2E7D32':'#999')+'">'+
          (saving>0?'-'+saving.toFixed(1)+'%':'—')+'</td></tr>';
      });
      ovHtml+='</tbody></table></div>';
    }
    ovHtml+='</div>';

    /* ── Open behoeften ── */
    var openNeeds=_needs.filter(function(n){ return n.status==='open'; });
    var needsHtml='<div style="margin-bottom:20px">'
      +'<div style="font-size:14px;font-weight:700;color:var(--gr);margin-bottom:10px">📋 Open behoeften ('+openNeeds.length+')</div>';

    if(!openNeeds.length){
      needsHtml+='<div style="color:#bbb;font-size:12px;text-align:center;padding:16px;background:#fff;border:1px solid var(--bd);border-radius:10px">Geen open behoeften.</div>';
    } else {
      needsHtml+='<div style="border:1px solid var(--bd);border-radius:10px;overflow:auto;background:#fff">'
        +'<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:600px">'
        +'<thead><tr style="background:#f8fafc">'
        +'<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Vestiging</th>'
        +'<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Product</th>'
        +'<th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Qty</th>'
        +'<th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Prijs/st (indicatief)</th>'
        +'<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Nodig vóór</th>'
        +'<th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Status</th>'
        +'<th style="padding:8px 10px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase"></th>'
        +'</tr></thead><tbody>';

      openNeeds.forEach(function(n){
        var ent=n.buying_entities||{};
        needsHtml+='<tr style="border-bottom:1px solid #f0f0f0">'
          +'<td style="padding:8px 10px;font-weight:600">'+_esc(ent.name||'—')+' <span style="color:#999;font-size:10px">'+_esc(ent.code||'')+'</span></td>'
          +'<td style="padding:8px 10px">'+_esc(n.product_name||n.product_ref)+'<div style="font-size:10px;color:#999">'+_esc(n.category||'')+'</div></td>'
          +'<td style="padding:8px 10px;text-align:center;font-weight:700">'+n.quantity+'</td>'
          +'<td style="padding:8px 10px;text-align:right">'+_fE(n.unit_price_estimate)+'</td>'
          +'<td style="padding:8px 10px;font-size:11px">'+_esc(n.needed_by||'—')+'</td>'
          +'<td style="padding:8px 10px;text-align:center">'+_badge(NEED_STATUS,n.status)+'</td>'
          +'<td style="padding:8px 10px"><button class="db-act-btn" onclick="bgDeleteNeed(\''+n.id+'\')" title="Verwijderen" style="color:#c0392b">✕</button></td>'
          +'</tr>';
      });
      needsHtml+='</tbody></table></div>';
    }
    needsHtml+='</div>';

    /* ── Actieve bundels ── */
    var activeBundles=_bundles.filter(function(b){ return b.status!=='closed'; });
    var bundlesHtml='<div>'
      +'<div style="font-size:14px;font-weight:700;color:var(--gr);margin-bottom:10px">📦 Bundels ('+activeBundles.length+')</div>';

    if(!activeBundles.length){
      bundlesHtml+='<div style="color:#bbb;font-size:12px;text-align:center;padding:16px;background:#fff;border:1px solid var(--bd);border-radius:10px">Nog geen bundels. Detecteer overlap en genereer bundels hierboven.</div>';
    } else {
      bundlesHtml+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">';
      activeBundles.forEach(function(b){
        var saving=Number(b.estimated_saving_pct)||0;
        var statusOpts=Object.keys(BUNDLE_STATUS).map(function(k){
          return '<option value="'+k+'"'+(k===b.status?' selected':'')+'>'+BUNDLE_STATUS[k].label+'</option>';
        }).join('');

        bundlesHtml+='<div style="background:#fff;border:1px solid var(--bd);border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">'
          +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
          +'<div><div style="font-size:11px;font-weight:700;color:#94a3b8;font-family:monospace">'+_esc(b.bundle_ref)+'</div>'
          +'<div style="font-size:13px;font-weight:700;margin-top:2px">'+_esc(b.product_name||b.product_ref)+'</div></div>'
          +_badge(BUNDLE_STATUS,b.status)
          +'</div>'
          +'<div style="display:flex;gap:16px;margin-bottom:10px">'
          +'<div><div style="font-size:10px;color:#94a3b8;font-weight:600">Totaal qty</div><div style="font-size:18px;font-weight:800">'+b.total_qty+'</div></div>'
          +'<div><div style="font-size:10px;color:#94a3b8;font-weight:600">Vestigingen</div><div style="font-size:18px;font-weight:800">'+b.entity_count+'</div></div>'
          +(saving>0?'<div><div style="font-size:10px;color:#94a3b8;font-weight:600">Besparing</div><div style="font-size:18px;font-weight:800;color:#2E7D32">-'+saving.toFixed(1)+'%</div></div>':'')
          +'</div>'
          +'<select onchange="bgUpdateBundleStatus(\''+b.id+'\',this.value)" style="font-size:11px;padding:4px 8px;border:1px solid var(--bd);border-radius:6px;background:#fff;font-family:inherit;width:100%">'+statusOpts+'</select>'
          +'</div>';
      });
      bundlesHtml+='</div>';
    }
    bundlesHtml+='</div>';

    root.innerHTML=entHtml+ovHtml+needsHtml+bundlesHtml;
  }


  /* ═══════════════════════════════════════════════════════════════
     6. INTERACTIE-HANDLERS
     ═══════════════════════════════════════════════════════════════ */

  global.bgAddEntity=function(){
    var name=prompt("Naam vestiging (bv. 'Antwerpen', 'Amsterdam NL'):");
    if(!name) return;
    var code=prompt("Korte code (optioneel, bv. 'BE-ANT'):")||"";
    createEntity(name,code).then(function(){
      _toast("✓ Vestiging toegevoegd");
      loadBuyingGroupData();
    }).catch(function(e){ _toast("⚠ "+e.message); });
  };

  global.bgDeleteEntity=function(id){
    if(!confirm("Vestiging verwijderen? Alle bijhorende behoeften worden ook verwijderd.")) return;
    deleteEntity(id).then(function(){
      _toast("✓ Verwijderd");
      loadBuyingGroupData();
    }).catch(function(e){ _toast("⚠ "+e.message); });
  };

  global.bgShowNeedForm=function(entityId, entityName){
    var name=prompt("Productnaam:");
    if(!name) return;
    var ref=prompt("Artikelcode / SKU (optioneel):")||"";
    var cat=prompt("Categorie (bv. displays, cabling, mounts):")||"";
    var qty=parseInt(prompt("Aantal:")||"1",10)||1;
    var price=parseFloat(prompt("Indicatieve stukprijs (€):")||"0")||0;
    var date=prompt("Nodig vóór (YYYY-MM-DD, optioneel):")||null;

    createNeed(entityId,{
      product_ref:ref, product_name:name, category:cat,
      quantity:qty, unit_price_estimate:price, needed_by:date
    }).then(function(){
      _toast("✓ Behoefte toegevoegd voor "+entityName);
      loadBuyingGroupData();
    }).catch(function(e){ _toast("⚠ "+e.message); });
  };

  global.bgDeleteNeed=function(id){
    if(!confirm("Behoefte verwijderen?")) return;
    deleteNeed(id).then(function(){
      _toast("✓ Verwijderd");
      loadBuyingGroupData();
    }).catch(function(e){ _toast("⚠ "+e.message); });
  };

  global.bgCreateBundles=async function(){
    try{
      var count=await createBundles();
      if(count>0){
        _toast("✓ "+count+" bundel(s) aangemaakt");
      } else {
        _toast("Geen nieuwe bundels — overlap al gebundeld of niet gevonden");
      }
      loadBuyingGroupData();
    }catch(e){ _toast("⚠ "+e.message); }
  };

  global.bgUpdateBundleStatus=function(id,status){
    updateBundleStatus(id,status).then(function(){
      _toast("✓ Status: "+BUNDLE_STATUS[status].label);
      loadBuyingGroupData();
    }).catch(function(e){ _toast("⚠ "+e.message); });
  };


  /* ═══════════════════════════════════════════════════════════════
     7. PANEL INJECTIE
     ═══════════════════════════════════════════════════════════════ */
  function injectPanel(){
    if(document.getElementById("p-buying-group")) return;

    var panel=document.createElement("div");
    panel.className="panel";
    panel.id="p-buying-group";
    panel.style.cssText="max-width:none!important;width:100%;padding:16px;box-sizing:border-box";

    panel.innerHTML=
      '<div class="card" style="background:transparent;border:none;box-shadow:none;padding:0;margin:0">'
      +'<div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:16px;gap:10px;flex-wrap:wrap">'
      +'<div class="card-title" style="font-size:19px;font-weight:800;letter-spacing:-.4px;color:var(--gr);margin-bottom:0">📦 Slimme Inkoop & Bundeling</div>'
      +'<button class="db-btn" onclick="loadBuyingGroupData()">↻ Vernieuwen</button>'
      +'</div>'
      +'<div id="bg-content"><div style="color:#bbb;font-size:12px;text-align:center;padding:20px">Klik ↻ om te laden</div></div>'
      +'</div>';

    var ref=document.getElementById("supa-modal")||document.body.lastChild;
    ref.parentNode.insertBefore(panel, ref);

    // Menuknop
    var advMenu=document.getElementById("adv-menu");
    if(advMenu){
      var btn=document.createElement("button");
      btn.className="am-item";
      btn.innerHTML='<span>📦</span>Inkoop & Bundeling';
      btn.onclick=function(){ global.goPanel("p-buying-group"); loadBuyingGroupData(); };
      advMenu.appendChild(btn);
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", injectPanel);
  } else {
    injectPanel();
  }

  /* Exporteer */
  global.BuyingGroup = {
    listEntities: listEntities,
    createEntity: createEntity,
    deleteEntity: deleteEntity,
    listNeeds:    listNeeds,
    createNeed:   createNeed,
    updateNeed:   updateNeed,
    deleteNeed:   deleteNeed,
    detectOverlaps: detectOverlaps,
    createBundles: createBundles,
    listBundles:  listBundles,
    updateBundleStatus: updateBundleStatus,
    listTiers:    listTiers,
    upsertTier:   upsertTier,
    reload:       loadBuyingGroupData
  };

  global.loadBuyingGroupData=loadBuyingGroupData;

})(typeof window!=="undefined"?window:this);
