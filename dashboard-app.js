// ==========================================
//  UNIVERSIO DASHBOARD  (Unified build 2025-10)
//  Includes:
//    • Onboarding gate / redirect
//    • Gradient, red scrub & glass tint
//    • Icon/eligibility helpers
//    • Bubble rail + hello bubble
//    • Grid visibility via Supabase
//    • Analytics push
//  ==========================================

// 1) GRADIENT + RED SCRUB BASE
(function injectBaseGradients(){
  const css = `
html,body{
  background:
    radial-gradient(1200px 800px at 0% 0%,rgba(214,236,255,.95)0%,rgba(214,236,255,0)80%),
    radial-gradient(1100px 720px at 100% 0%,rgba(236,209,255,.92)0%,rgba(236,209,255,0)120%),
    linear-gradient(to bottom,rgba(248,248,255,0)0%,rgba(248,248,255,0)70%,rgba(235,236,240,1)100%)!important;
  background-repeat:no-repeat!important;
  background-size:cover!important;
  background-color:transparent!important;
}
#page-content{background:transparent!important;}
[data-block-id="e10d0f66-ec99-43c8-94f1-a44a569bb7ca"],
[data-block-id="e10d0f66-ec99-43c8-94f1-a44a569bb7ca"] *{
  background:#fff!important;
  background-color:#fff!important;
}
/* scrub Softr white/gray → transparent */
#page-content section.sw-background-color-f3f5f8,
#page-content header.sw-background-color-f3f5f8,
#page-content .sw-background-color-f3f5f8,
#page-content [style*="#f3f5f8"],
#page-content [style*="rgb(243,245,248)"],
#page-content [style*="rgb(243, 245, 248)"]{
  background:transparent!important;background-color:transparent!important;
}
/* table/list deep scrub */
[data-block-id="debd0e99-31da-4492-a18f-d4dd56169e13"] table,
[data-block-id="debd0e99-31da-4492-a18f-d4dd56169e13"] tr,
[data-block-id="debd0e99-31da-4492-a18f-d4dd56169e13"] td,
#page-content .sw-table,
#page-content .sw-table *{
  background:transparent!important;background-color:transparent!important;
}
`;
  if (!document.getElementById('um-gradient-and-red-fix')) {
    const style = document.createElement('style');
    style.id = 'um-gradient-and-red-fix';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();

// 2) GLASS TINT
(function injectGlassTint(){
  const css = `
#page-content [style*="#f8f8f8"]{
  background:rgba(248,248,248,.5)!important;
  background-color:rgba(248,248,248,.5)!important;
}
[data-block-id="debd0e99-31da-4492-a18f-d4dd56169e13"] .card,
[data-block-id="debd0e99-31da-4492-a18f-d4dd56169e13"] .list-item{
  background:rgba(248,248,248,.5)!important;
  backdrop-filter:blur(6px);
  border-color:rgba(255,255,255,.18)!important;
}
`;
  if (!document.getElementById('um-glass-card-tint')) {
    const style = document.createElement('style');
    style.id = 'um-glass-card-tint';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();

// 🩵 UNIVERSIO DASHBOARD: Softr pre-hydration hard gate
(function ensureSoftrUserReady(){
  const deadline = () => performance.now() + 800; // wait up to 0.8 s
  let cachedEmail = null;

  const fromSession = () => {
    if (cachedEmail) return cachedEmail;
    try {
      const stored = sessionStorage.getItem("universio:profile");
      const parsed = stored ? JSON.parse(stored) : null;
      cachedEmail = parsed?.softr_user_email || parsed?.email || null;
    } catch (e) {}
    return cachedEmail;
  };

  const ready = () => {
    const email =
      window.logged_in_user?.softr_user_email ||
      window.logged_in_user?.email ||
      window.Softr?.currentUser?.softr_user_email ||
      window.__U?.profile?.softr_user_email ||
      window.__U?.profile?.email ||
      fromSession();
    if (email) cachedEmail = email;
    return email;
  };

  // 🧩 Hold Softr rendering until user context ready
  const origAddEvent = window.addEventListener;
  origAddEvent.call(window, "universio:bootstrapped", (e)=>{
    const detail = e?.detail || {};
    cachedEmail =
      detail.profile?.softr_user_email ||
      detail.profile?.email ||
      cachedEmail;
  });
  window.addEventListener = function(type, listener, opts){
    if (type === 'load' || type === 'softr:pageLoaded') {
      // Delay only when the event actually fires; avoid eager waiting on registration
      const gatedListener = (event)=>{
        if (ready()) return listener.call(this, event);
        const start = performance.now();
        const limit = deadline();
        const poll = ()=>{
          if (ready() || performance.now() >= limit){
            listener.call(this, event);
            console.debug(`[BOOT PATCH] Softr ready after ${Math.round(performance.now()-start)} ms`);
            return;
          }
          requestAnimationFrame(poll);
        };
        poll();
      };

      // If the event already fired, fall back to running the listener immediately
      const alreadyLoaded = type === 'load' && document.readyState === 'complete';
      if (alreadyLoaded) {
        gatedListener(new Event('load'));
      } else {
        origAddEvent.call(window, type, gatedListener, opts);
      }
    } else {
      origAddEvent.call(window, type, listener, opts);
    }
  };
})();

// Pre-hide grids immediately at parse to kill any flash
(function preHide(){
  ["grid1","grid2","grid3","grid4","grid5"].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.style.setProperty("display","none","important");
    el.style.setProperty("visibility","hidden","important");
    el.style.setProperty("opacity","0","important");
  });
})();

// 3) RUNTIME RED SCRUBBER
(function(){
  const NAV_ID="e10d0f66-ec99-43c8-94f1-a44a569bb7ca";
  const NAV_SEL=`[data-block-id="${NAV_ID}"]`;
  const isRGB=(c,r,g,b)=>{const m=(c||'').replace(/\s+/g,'').toLowerCase().match(/^rgba?\((\d+),(\d+),(\d+)/);return !!m&&+m[1]===r&&+m[2]===g&&+m[3]===b;};
  function scrub(){
    const root=document.getElementById('page-content'); if(!root)return;
    root.querySelectorAll('*').forEach(el=>{
      if(el.closest(NAV_SEL))return;
      const cs=getComputedStyle(el);
      if(cs.backgroundImage!=='none')return;
      if(isRGB(cs.backgroundColor,243,245,248)){
        el.style.setProperty('background','transparent','important');
        el.style.setProperty('background-color','transparent','important');
      }
    });
  }
  const run=()=>scrub();
  run();
  window.addEventListener('@softr/page-content-loaded',run);
  new MutationObserver(run).observe(document.getElementById('page-content')||document.documentElement,{childList:true,subtree:true,attributes:true});
})();

// 4) ELIGIBLE ICONS + ALIGNMENT
(function injectEligibleAlign(){
  const css = `
[data-block-id="debd0e99-31da-4492-a18f-d4dd56169e13"] [data-field="eligible_reason"],
[data-block-id="debd0e99-31da-4492-a18f-d4dd56169e13"] [data-field="_mxw5o0b15"]{
  text-align:left!important;
}
`;
  if (!document.getElementById('um-eligible-align-left')) {
    const style = document.createElement('style');
    style.id = 'um-eligible-align-left';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();

(function(){
'use strict';
const BLOCK_ID='debd0e99-31da-4492-a18f-d4dd56169e13';
const FIELDS=['eligible_reason','_mxw5o0b15'];
const MAP={locked:{html:'🔒',label:'Locked'},eligible:{html:'🟢',label:'Eligible'},in_progress:{html:'▶️',label:'In progress'},complete:{html:'✅',label:'Complete'}};
const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,'_');
function apply(el,state){if(el.dataset.umIconified)return 0;const m=MAP[state];if(!m)return 0;el.dataset.umIconified='1';el.innerHTML=`<span data-um-state="${state}" aria-label="${m.label}">${m.html}</span>`;el.style.removeProperty('text-align');el.style.removeProperty('min-width');el.style.removeProperty('display');return 1;}
function swap(scope){let n=0;FIELDS.forEach(k=>{scope.querySelectorAll(`[data-field="${k}"]`).forEach(el=>n+=apply(el,norm(el.textContent)));});
scope.querySelectorAll('table').forEach(t=>{const heads=[...t.querySelectorAll('thead th')].map(th=>norm(th.textContent));const idx=heads.indexOf('eligible_reason');if(idx<0)return;t.querySelectorAll('tbody tr').forEach(tr=>{const td=tr.querySelectorAll('td')[idx];if(!td)return;n+=apply(td,norm(td.textContent));});});return n;}
function run(){const s=document.querySelector(`[data-block-id="${BLOCK_ID}"]`);if(!s)return;swap(s);}
window.addEventListener('@softr/page-content-loaded',run);
(document.readyState!=='loading')?run():document.addEventListener('DOMContentLoaded',run);
new MutationObserver(run).observe(document.getElementById('page-content')||document.body,{childList:true,subtree:true});
})();

// 5) DASHBOARD RAIL + BUBBLES
(function injectBubbleTokens(){
  const css = `
:root{--um-bbl-bg:#fff;--um-bbl-fg:#0F1222;--um-bbl-radius:9999px;--um-bbl-pad-y:10px;--um-bbl-pad-x:14px;--um-bbl-border:1px solid rgba(15,18,34,.10);--um-bbl-weight:400;--um-bbl-size:clamp(14px,0.95rem,16px);}
@keyframes umBubbleIn{0%{opacity:0;transform:translateY(4px)scale(.98)}60%{opacity:.98;transform:translateY(0)scale(1)}100%{opacity:1}}
.uni-bubble.tutor.um-section,.uni-bubble.tutor.um-dash-hello{
 display:inline-flex!important;align-items:center;gap:.4rem;background:var(--um-bbl-bg)!important;color:var(--um-bbl-fg)!important;
 border-radius:var(--um-bbl-radius)!important;padding:var(--um-bbl-pad-y) var(--um-bbl-pad-x)!important;
 border:var(--um-bbl-border)!important;line-height:1.45!important;font-weight:var(--um-bbl-weight);font-size:var(--um-bbl-size);
 width:fit-content!important;max-width:92vw!important;white-space:nowrap!important;animation:umBubbleIn 420ms ease-out both;
}
.um-dash-hello{margin:0 0 10px 0!important;}
`;
  if (!document.getElementById('um-bubble-tokens')) {
    const style = document.createElement('style');
    style.id = 'um-bubble-tokens';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();

(function injectBubbleHideNav(){
  const css = `
@media(max-width:768px){.softr-navbar--opened .um-dash-rail{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:opacity .2s ease;}}
`;
  if (!document.getElementById('um-bubble-hide-nav')) {
    const style = document.createElement('style');
    style.id = 'um-bubble-hide-nav';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();

// section bubbleization
(function(){
'use strict';
if(window.__umSectionBubbleizeInstalled)return;
window.__umSectionBubbleizeInstalled=true;
const TARGETS=[
 {blockId:'90235312-fe34-41b7-9e85-30fbe520ad6a',selectors:['#grid1'],textMatch:/Try\s+your\s+first\s+lesson/i},
 {selectors:['#grid2'],textMatch:/(Pick\s*up|Resume)/i},
 {selectors:['#grid3'],textMatch:/Completed 👌/i},
 {selectors:['#grid4'],textMatch:/Certificates/i},
 {selectors:['#grid5'],textMatch:/Microcourse/i}
];
function isVis(e){if(!e)return false;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}
function rootsFor(t){const o=[];(t.selectors||[]).forEach(s=>o.push(...document.querySelectorAll(s)));if(t.blockId)o.push(...document.querySelectorAll(`[data-block-id="${t.blockId}"]`));return Array.from(new Set(o));}
function bubbleize(h){if(!h||h.dataset.umBubbled==='1'||h.querySelector('.uni-bubble'))return;const t=(h.textContent||'').trim();if(!t)return;const s=document.createElement('span');s.className='uni-bubble tutor um-section um-fade-in';s.textContent=t;h.dataset.umBubbled='1';h.textContent='';h.appendChild(s);}
function within(r,t){const hs=[...r.querySelectorAll('h1,h2,h3,h4')].filter(isVis);const h=hs.find(el=>t.test((el.textContent||'').trim()))||hs[0];if(h)bubbleize(h);}
function run(){TARGETS.forEach(t=>{rootsFor(t).forEach(r=>within(r,t.textMatch));});}
(document.readyState!=='loading')?run():document.addEventListener('DOMContentLoaded',run);
window.addEventListener('@softr/page-content-loaded',run);
new MutationObserver(run).observe(document.getElementById('page-content')||document.body,{childList:true,subtree:true});
})();

// hello bubble
(function(){
'use strict';

const GRID_IDS = ['grid1','grid2','grid3','grid4','grid5'];
const SAFE_DELAY_MS = 80;            // small initial wait
const MIN_VISIBLE_PX = 16;           // smaller threshold = more tolerant
let hello = null, host = null, retryCount = 0, maxRetries = 20;

function toFirst(s){return String(s||'').trim().split(/\s+/)[0]||'';}
function fromEmailPrefix(e){
  if(typeof e!=='string'||!e.includes('@'))return '';
  const b=e.split('@')[0].replace(/[._-]+/g,' ').trim();
  return b.replace(/\b\w/g,c=>c.toUpperCase()).split(/\s+/)[0]||'';
}
function getFirstName(){
  try{
    const u = window.logged_in_user || window.Softr?.currentUser || window.__U?.profile || {};
    return toFirst(u.softr_user_full_name) || fromEmailPrefix(u.softr_user_email || u.email) || 'there';
  }catch{return 'there';}
}
function isShown(e){
  if(!e) return false;
  const cs = getComputedStyle(e);
  if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false;
  const r=e.getBoundingClientRect();
  return r.width>0 && r.height>0;
}
function visiblePixels(e){
  if(!isShown(e)) return 0;
  const r=e.getBoundingClientRect();
  const vh=Math.min(window.innerHeight,r.bottom)-Math.max(0,r.top);
  return Math.max(0,vh);
}
function topGrid(){
  let pick=null,bestTop=Infinity,bestVis=0;
  for(const id of GRID_IDS){
    const el=document.getElementById(id);
    if(!el) continue;
    const vis=visiblePixels(el);
    if(vis<MIN_VISIBLE_PX) continue;
    const t=Math.max(0,el.getBoundingClientRect().top);
    if(t<bestTop-1||(Math.abs(t-bestTop)<=1&&vis>bestVis)){pick=el;bestTop=t;bestVis=vis;}
  }
  return pick;
}
function findHeading(g){return g?.querySelector('h1,h2,h3,h4')||null;}
function ensureHello(){
  if(hello) return hello;
  hello=document.createElement('div');
  hello.className='uni-bubble tutor um-section um-dash-hello';
  hello.textContent=`Hello again, ${getFirstName()} 👋`;
  hello.style.margin='0 0 12px 0';
  hello.style.transition='opacity .4s ease';
  hello.style.opacity='0';
  requestAnimationFrame(()=>{hello.style.opacity='1';});
  return hello;
}
function placeHello(g){
  if(!g) return false;
  const h=findHeading(g);
  if(!h||!h.parentNode) return false;
  const e=ensureHello();
  if(e.parentNode!==h.parentNode||e.nextSibling!==h){
    h.parentNode.insertBefore(e,h);
  }
  host=g;
  return true;
}
function refresh(){
  const g=topGrid();
  if(!g){ return; }
  if(g!==host){ placeHello(g); }
}
function tryUntilVisible(){
  refresh();
  const bubble=hello;
  const ok=bubble && bubble.offsetParent!==null && bubble.offsetHeight>0;
  if(ok || retryCount>=maxRetries){
    if(!ok) console.warn("⚠️ Hello bubble never became visible; check grid visibility sequence.");
    return;
  }
  retryCount++;
  setTimeout(tryUntilVisible, 250);
}
function boot(){
  setTimeout(()=>{
    refresh();
    tryUntilVisible();
    window.addEventListener('scroll',refresh,{passive:true});
    window.addEventListener('resize',refresh,{passive:true});
    // re-inject after Softr refreshes or your gating reruns
    window.addEventListener('@softr/page-content-loaded',()=>{setTimeout(tryUntilVisible,200);});
  },SAFE_DELAY_MS);
}

(document.readyState!=='loading') ? boot() : document.addEventListener('DOMContentLoaded',boot);
window.addEventListener('load',boot,{once:true});

})();

// 6) GRID VISIBILITY VIA SUPABASE
function toggleGridsUnified(){
  const $=id=>document.getElementById(id);

  /* ⬇️ EDITED: only the body of `show` changed */
  const show=(el,val)=>{
    if(!el) return;
    el.style.setProperty("display",val,"important");
    if(val!=="none"){
      // reveal: remove CSS hiding so no opacity/visibility conflicts
      el.style.removeProperty("visibility");
      el.style.removeProperty("opacity");
    }else{
      // hide: reinforce invisibility to prevent flicker during gating
      el.style.setProperty("visibility","hidden","important");
      el.style.setProperty("opacity","0","important");
    }
  };

  const DISPLAY_MODE={grid1:"block",grid2:"flex",grid3:"flex",grid4:"flex",grid5:"flex"};
  const applyStates=states=>{
    Object.entries(DISPLAY_MODE).forEach(([id,mode])=>{
      const el=$(id);
      show(el,states[id]?mode:"none");
    });
  };
  const showFreshUser=()=>applyStates({grid1:true,grid2:false,grid3:false,grid4:false,grid5:false});

  const hideAll=()=>applyStates({grid1:false,grid2:false,grid3:false,grid4:false,grid5:false});

  console.groupCollapsed("🔍 Universio Dashboard Debug");
  hideAll();

  try{
    const u=window.logged_in_user||(window.Softr&&window.Softr.currentUser)||(window.__U&&window.__U.profile);
    const email=u?.email||u?.softr_user_email||null;
    console.debug("User context →",u);
    if(!email){console.warn("⚠️ No user email found; aborting");showFreshUser();console.groupEnd();return;}

    const fetcher=(typeof apiFetch==="function")?apiFetch:fetch;
    const headers=new Headers({"Content-Type":"application/json"});
    if(!headers.has("Authorization") && window.__U?.cwt){headers.set("Authorization",`Bearer ${window.__U.cwt}`);} 
    const init={method:"POST",headers,body:JSON.stringify({email})};
    const doFetch=async()=>{
      if(fetcher===fetch && typeof ensureFreshToken==="function"){
        try{await ensureFreshToken();}catch(err){console.warn("[dashboard] token refresh skipped",err);} 
      }
      return fetcher("https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/fetch-profiles",init);
    };

    doFetch()
    .then(r=>r.json())
    .then(res=>{
      console.debug("Returned JSON →",res);
      const data = res.data || res; // accept either shape
      const error = res.error;
      if(error||!data){showFreshUser();console.groupEnd();return;}

      const inProgress        = Number(data.in_progress_count||0);
      const completed         = Number(data.completed_count||0); // legacy fallback
      const certCount         = Number(data.User_CertificateEnrollments||0);
      const completedNodes    = Number(data.completed_node_count||0);

      // NEW: status-based completion from User_CertificateEnrollment
      // (Edge function should return has_completed_cert and/or completed_cert_count)
      const hasCompletedCert =
        !!(data.has_completed_cert) ||
        Number(data.completed_cert_count || 0) > 0;

      const hasCompletedNode =
        !!(data.has_completed_node) ||
        completedNodes > 0;

      const states={
        grid1: inProgress === 0,
        grid2: inProgress >= 1,
        // REPLACE old rule:
        // if (completed >= 1) show($("grid3"), "flex");
        // WITH status-based rule + safe fallback:
        grid3: (hasCompletedCert || completed >= 1),
        grid4: certCount >= 1,
        grid5: hasCompletedNode
      };

      if(!Object.values(states).some(Boolean)) states.grid1=true;

      applyStates(states);

      // Re-run bubbleization after showing grids
      window.dispatchEvent(new CustomEvent('@softr/page-content-loaded'));

      console.groupEnd();
    })
    .catch(e=>{console.error("❌ Fetch failed:",e);showFreshUser();console.groupEnd();});
  }catch(e){console.error("❌ toggleGridsUnified crashed:",e);showFreshUser();console.groupEnd();}
}
(function(){
 let hasRun=false;
 const runOnce=()=>{if(hasRun)return;hasRun=true;console.log("⚡ Universio grids initializing");toggleGridsUnified();};
 window.addEventListener("softr:pageLoaded",runOnce,{once:true});
 /* Optional: also listen to Softr's other load event without removing yours */
 window.addEventListener("@softr/page-content-loaded",runOnce,{once:true});
 document.addEventListener("DOMContentLoaded",()=>setTimeout(runOnce,1500));
})();

// 7) ANALYTICS
(function(){
  window.dataLayer=window.dataLayer||[];
  window.dataLayer.push({
    event:"dashboard_loaded",
    user_plan:"pro",
    course_count:3,
    active_node_id:"abc123",
    page_location:window.location.href,
    page_title:"Dashboard",
  });
})();
