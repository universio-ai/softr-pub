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
console.log("Nov 20 2025, 14:16 UTC");
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
[data-um-bubble-freeze="1"] #grid1 h1,[data-um-bubble-freeze="1"] #grid1 h2,[data-um-bubble-freeze="1"] #grid1 h3,[data-um-bubble-freeze="1"] #grid1 h4,
[data-um-bubble-freeze="1"] #grid2 h1,[data-um-bubble-freeze="1"] #grid2 h2,[data-um-bubble-freeze="1"] #grid2 h3,[data-um-bubble-freeze="1"] #grid2 h4,
[data-um-bubble-freeze="1"] #grid3 h1,[data-um-bubble-freeze="1"] #grid3 h2,[data-um-bubble-freeze="1"] #grid3 h3,[data-um-bubble-freeze="1"] #grid3 h4,
[data-um-bubble-freeze="1"] #grid4 h1,[data-um-bubble-freeze="1"] #grid4 h2,[data-um-bubble-freeze="1"] #grid4 h3,[data-um-bubble-freeze="1"] #grid4 h4,
[data-um-bubble-freeze="1"] #grid5 h1,[data-um-bubble-freeze="1"] #grid5 h2,[data-um-bubble-freeze="1"] #grid5 h3,[data-um-bubble-freeze="1"] #grid5 h4{
  visibility:hidden!important;
}
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
const FREEZE_ATTR='data-um-bubble-freeze';
document.documentElement.setAttribute(FREEZE_ATTR,'1');
let thawed=false;
const thawHeadings=()=>{if(thawed) return; thawed=true; document.documentElement.setAttribute(FREEZE_ATTR,'0');};
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
function run(){TARGETS.forEach(t=>{rootsFor(t).forEach(r=>within(r,t.textMatch));});thawHeadings();}
const start=()=>run();
(document.readyState!=='loading')?start():document.addEventListener('DOMContentLoaded',start);
window.addEventListener('@softr/page-content-loaded',start);
new MutationObserver(start).observe(document.getElementById('page-content')||document.body,{childList:true,subtree:true});
})();

// hello bubble
(function(){
'use strict';

if(window.__umHelloBubbleInstalled) return;
window.__umHelloBubbleInstalled = true;

const GRID_IDS = ['grid1','grid2','grid3','grid4','grid5'];
const MIN_VISIBLE_PX = 16;           // smaller threshold = more tolerant
let hello = null, trial = null, host = null, retryCount = 0, maxRetries = 60, hydrated = false;
let gridObserver = null, pendingCheck = null;

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
function normalizePlanCode(raw){
  const normalized=String(raw||'').trim().toLowerCase();
  if(!normalized) return '';
  return normalized.replace(/\s+/g,'_');
}
function resolveTrialStatus(){
  const u=window.logged_in_user||window.Softr?.currentUser||window.__U?.profile||{};
  const profile=window.__U?.profile||{};
  const planCode=normalizePlanCode(u.plan_code||profile.plan_code||u.billing_plan_code||'');
  const planStatus=String(u.plan_status||profile.plan_status||u.billing_status||'').trim().toLowerCase();
  const planName=String(u.plan_name||profile.plan_name||u.billing_plan||'').trim().toLowerCase();
  const trialEndAt=u.pro_trial_end_at||profile.pro_trial_end_at||null;
  const hasSignals=!!(planCode||planStatus||planName||trialEndAt);
  if(!hasSignals) return {state:'unknown'};
  const isTrialPlan=planCode==='pro_trial'||planStatus.includes('trial')||planName.includes('trial');
  if(!isTrialPlan) return {state:'not_trial'};
  const endAt=Date.parse(trialEndAt||'');
  if(!Number.isFinite(endAt)) return {state:'unknown_trial'};
  const diffMs=endAt-Date.now();
  if(diffMs<=0) return {state:'expired'};
  const daysLeft=Math.max(1,Math.ceil(diffMs/(24*60*60*1000)));
  return {state:'active',daysLeft};
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
  hello.style.transition='opacity .4s ease, visibility 0s linear .05s';
  hello.style.opacity='0';
  hello.style.visibility='hidden';
  return hello;
}
function ensureTrial(){
  if(trial) return trial;
  trial=document.createElement('div');
  trial.className='uni-bubble tutor um-section um-dash-trial';
  trial.style.margin='0 0 12px 0';
  trial.style.transition='opacity .4s ease, visibility 0s linear .05s';
  trial.style.opacity='0';
  trial.style.visibility='hidden';
  return trial;
}

function revealHello(){
  if(!hello||hydrated) return;
  hydrated=true;
  hello.style.visibility='visible';
  requestAnimationFrame(()=>{hello.style.opacity='1';});
}
function revealTrial(){
  if(!trial) return;
  trial.style.visibility='visible';
  requestAnimationFrame(()=>{trial.style.opacity='1';});
}
function placeHello(g){
  if(!g) return false;
  const h=findHeading(g);
  if(!h||!h.parentNode) return false;
  const e=ensureHello();
  if(e.parentNode!==h.parentNode||e.nextSibling!==h){
    h.parentNode.insertBefore(e,h);
  }
  placeTrial(h);
  host=g;
  revealHello();
  return true;
}
let trialRetryCount=0, maxTrialRetries=20;
function placeTrial(h){
  const status=resolveTrialStatus();
  if(status.state==='not_trial'||status.state==='expired'){
    if(trial?.parentNode) trial.parentNode.removeChild(trial);
    return;
  }
  if(status.state!=='active'){
    if(trialRetryCount<maxTrialRetries){
      trialRetryCount++;
      setTimeout(()=>placeTrial(h),400);
    }
    return;
  }
  const e=ensureTrial();
  const days=status.daysLeft;
  const text=`Just letting you know, you have ${days} day${days===1?'':'s'} left on your Pro Trial.`;
  if(e.textContent!==text) e.textContent=text;
  if(e.parentNode!==h.parentNode||e.nextSibling!==h){
    h.parentNode.insertBefore(e,h);
  }
  revealTrial();
}
function refresh(){
  const g=topGrid();
  if(!g){ return; }
  if(g!==host){ placeHello(g); }
  else{
    const h=findHeading(g);
    if(h) placeTrial(h);
  }
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

function scheduleVisibilityCheck(delay=120){
  if(pendingCheck) return;
  pendingCheck = setTimeout(()=>{ pendingCheck=null; tryUntilVisible(); }, delay);
}

function watchGrids(){
  if(gridObserver) gridObserver.disconnect();
  gridObserver = new MutationObserver(()=>scheduleVisibilityCheck(0));
  GRID_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    gridObserver.observe(el,{attributes:true,attributeFilter:['style','class']});
  });
}
let booted=false;
function boot(){
  if(booted) return; booted=true;
  refresh();
  watchGrids();
  tryUntilVisible();
  window.addEventListener('scroll',refresh,{passive:true});
  window.addEventListener('resize',refresh,{passive:true});
  // re-inject after Softr refreshes or your gating reruns
  window.addEventListener('@softr/page-content-loaded',()=>{watchGrids(); scheduleVisibilityCheck(60);});
}

(document.readyState!=='loading') ? boot() : document.addEventListener('DOMContentLoaded',boot);
window.addEventListener('load',boot,{once:true});

})();

// 6) GRID VISIBILITY VIA SUPABASE
function toggleGridsUnified(){
  const $=id=>document.getElementById(id);

  const CACHE_KEY='um.dashboard.gridStates';
  const readCache=()=>{try{return JSON.parse(sessionStorage.getItem(CACHE_KEY)||'null');}catch{return null;}};
  const writeCache=(states,email)=>{
    try{
      sessionStorage.setItem(CACHE_KEY,JSON.stringify({states,email:email||null,ts:Date.now()}));
    }catch{}
  };

  // Keep the opening loader around until we have a final decision
  const LOADER_ID='um-grid-loading';
  const LOADER_STYLE_ID='um-grid-loading-style';
  const ensureLoaderStyle=()=>{
    if(document.getElementById(LOADER_STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=LOADER_STYLE_ID;
    style.textContent=`
#${LOADER_ID}{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999;background:rgba(255,255,255,.92);backdrop-filter:blur(3px);transition:opacity .14s ease;}
#${LOADER_ID}[data-hidden="1"]{opacity:0;pointer-events:none;}

#${LOADER_ID} .um-grid-loader{display:inline-flex;gap:8px;align-items:center;justify-content:center;}

#${LOADER_ID} .um-grid-loader span {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  animation: umGridDot 1s ease-in-out infinite;
background: #a855f7;
background-size: 800% 800% !important;
background-position: calc(var(--i,0) * 200%) 0 !important;
-webkit-background-clip: padding-box !important;
background-clip: padding-box !important;


  opacity: .28;
  box-shadow: 0 2px 6px rgba(123,97,255,.3);
}

#${LOADER_ID} .um-grid-loader span:nth-child(1){
  animation-delay:-.20s;
  --i: 0;
}
#${LOADER_ID} .um-grid-loader span:nth-child(2){
  animation-delay:-.10s;
  --i: 1;
}
#${LOADER_ID} .um-grid-loader span:nth-child(3){
  animation-delay:0s;
  --i: 2;
}


@keyframes umGridDot {
  0%, 80%, 100% {
    transform: scale(.6);
    opacity: .25;
    filter: brightness(0.85);
  }
  40% {
    transform: scale(1);
    opacity: 1;
    filter: brightness(1.18) saturate(1.25);
  }
}
`;
  document.head.appendChild(style);
};
  const showLoader=()=>{
    ensureLoaderStyle();
    let scrim=document.getElementById(LOADER_ID);
    if(!scrim){
      scrim=document.createElement('div');
      scrim.id=LOADER_ID;
      scrim.setAttribute('role','status');
      scrim.setAttribute('aria-live','polite');
      scrim.innerHTML='<div class="um-grid-loader" aria-label="Loading your dashboard"><span></span><span></span><span></span></div>';
      document.body.appendChild(scrim);
    }
    scrim.dataset.hidden='0';
  };
  const hideLoader=()=>{
    const scrim=document.getElementById(LOADER_ID);
    if(!scrim) return;
    scrim.dataset.hidden='1';
    setTimeout(()=>scrim.remove(),160);
  };

  // Release the loader as soon as a grid is visibly present, even if Supabase
  // is still resolving in the background. This avoids the overlay lingering
  // when cached states have already painted the cards.
  let loaderReleased=false;
  const isGridShowing=()=>{
    return ['grid1','grid2','grid3','grid4','grid5'].some(id=>{
      const el=$(id);
      if(!el) return false;
      const cs=getComputedStyle(el);
      return cs.display!=='none' && cs.visibility!=='hidden' && +cs.opacity!==0;
    });
  };
  const releaseLoader=label=>{
    if(loaderReleased) return;
    if(!isGridShowing()) return;
    loaderReleased=true;
    console.debug(label||'Releasing loader');
    hideLoader();
  };

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
  const applyStates=(states,label)=>{
    Object.entries(DISPLAY_MODE).forEach(([id,mode])=>{
      const el=$(id);
      show(el,states[id]?mode:"none");
    });
    // Give the DOM a beat to paint, then drop the loader if something is visible
    // so users are never waiting on background confirmations.
    setTimeout(()=>releaseLoader(label||'Grids painted'),90);
  };
  const showFreshUser=()=>{
    const states={grid1:true,grid2:false,grid3:false,grid4:false,grid5:false};
    applyStates(states,"Fresh-user grids applied");
    return states;
  };

  const showResumeFallback=()=>{
    const states={grid1:false,grid2:true,grid3:false,grid4:false,grid5:false};
    applyStates(states,"Resume fallback applied");
    return states;
  };

  // Keep loader up-front; it will be dismissed once a visible grid exists
  showLoader();

  console.groupCollapsed("🔍 Universio Dashboard Debug");

  let resolvedEmail=null;

  let finalized=false, closed=false;
  const end=()=>{ if(!closed){ console.groupEnd(); closed=true; } };

  // Temporary apply that still allows Supabase to override (keeps grids responsive on slow mobile)
  const applyTemp=(states,label)=>{
    console.debug(label, states);
    applyStates(states,label);
  };

  const applyFinal=(states,label,cache=true)=>{
    if(finalized) return;
    finalized=true;
    clearTimeout(fallbackTimer);
    clearTimeout(finalGuard);
    console.debug(label, states);
    applyStates(states,label);
    if(cache) writeCache(states,resolvedEmail);
    // Ensure the loader is gone even if visibility checks fail (e.g., all grids hidden)
    setTimeout(hideLoader,220);
    end();
  };

  // If Supabase is slow, use a temporary fallback that remains overridable.
  // Cancelled the moment we finalize so it cannot overwrite real data.
  const fallbackTimer = setTimeout(()=>{
    console.debug("⏳ Still waiting on Supabase; keeping loader active and grids hidden");
  },2200);

  // Safety guard: prefer cached states when available; never cache a forced fallback.
  const finalGuard=setTimeout(()=>{
    if(finalized) return;
    const cached=readCache();
    if(cached?.states && cached?.email && cached.email===resolvedEmail){
      applyFinal(cached.states,"Final grid state (cached timeout)");
      return;
    }
    applyFinal(showFreshUser(),"Final grid state (timeout; not cached)",false);
  },12000);

// Keep all grids hidden until we have a final decision.
// This avoids the grid1 flash for returning users.
applyTemp(
  { grid1:false, grid2:false, grid3:false, grid4:false, grid5:false },
  "Keeping grids hidden while resolving user"
);

  // Cache is validated against the resolved user; we null it out immediately if
  // it does not belong to the current session to avoid leaking old states into
  // fallbacks.
  let cached=readCache();

  const resolveUserContext = (timeoutMs=12000)=>new Promise(resolve=>{
    const start=Date.now();
    (function loop(){
      const u=
        window.logged_in_user||
        (window.Softr&&window.Softr.currentUser)||
        (window.__U&&window.__U.profile)||
        window.user||
        window.__USER;
      const email=u?.email||u?.softr_user_email||u?.primary_email||null;
      if(email){
        console.debug("User context →",u);
        return resolve({u,email});
      }
      if(Date.now()-start>=timeoutMs){
        console.warn("⚠️ No user email resolved within",timeoutMs,"ms");
        return resolve(null);
      }
      setTimeout(loop,120);
    })();
  });

  const startUserResolution = (attempt=1, maxAttempts=3)=>{
    try{
      resolveUserContext().then(ctx=>{
        if(finalized) return;
        if(!ctx){
          applyFinal(showFreshUser(),`Final grid state (no email; attempt ${attempt}/${maxAttempts})`,false);
          if(attempt<maxAttempts){
            setTimeout(()=>startUserResolution(attempt+1,maxAttempts),1200);
          }
          return;
        }
        const {email} = ctx;
        resolvedEmail=email;
        window.__U = window.__U || {};
        window.__U.current_email = resolvedEmail;

        const cachedCwtEmail=(window.__U?.cwt_email||"").toLowerCase();
        if(cachedCwtEmail && cachedCwtEmail!==resolvedEmail.toLowerCase()){
          if(typeof clearCachedCWT==="function") clearCachedCWT("dashboard user switch");
          if(typeof clearSessionCaches==="function") clearSessionCaches("dashboard user switch");
        }

        // If the cached email doesn't match this session, drop the cache so
        // grids can't be borrowed from another user. If it matches, reuse it
        // while we wait for Supabase to respond.
        if(cached?.states){
          if(cached.email && cached.email===email){
            applyTemp(cached.states, "Applying cached grid states for user");
          }else{
            sessionStorage.removeItem(CACHE_KEY);
            cached=null; // prevent stale cache from being reused in fallbacks
          }
        }

        const fetcher=fetch;
        const refreshDashboardToken=async(label)=>{
          const targetEmail=(resolvedEmail||"").toLowerCase();
          if(!targetEmail) return;

          // Always reset before minting to avoid ever reusing a prior user's token.
          if(typeof clearCachedCWT==="function"){clearCachedCWT(label||"dashboard force refresh");}
          if(typeof clearSessionCaches==="function"){clearSessionCaches(label||"dashboard force refresh");}

          if(typeof refreshCWT==="function"){
            await refreshCWT(targetEmail,{retryOnMismatch:true,forceReset:true});
          }else if(typeof ensureFreshToken==="function"){
            await ensureFreshToken(resolvedEmail);
          }
          if((window.__U?.cwt_email||"").toLowerCase()!==targetEmail){
            clearCachedCWT("dashboard token email mismatch");
            throw new Error("dashboard token email mismatch");
          }
          if(!window.__U?.cwt){
            clearCachedCWT("dashboard missing cwt");
            throw new Error("dashboard missing cwt");
          }
        };

        const doFetch=async(attempt=1)=>{
          // Always mint a fresh token for the resolved email before sending the request.
          await refreshDashboardToken(attempt===1?"dashboard initial fetch":"dashboard retry fetch");

          const headers=new Headers({"Content-Type":"application/json"});
          if(!window.__U?.cwt){throw new Error("dashboard missing Authorization token");}
          headers.set("Authorization",`Bearer ${window.__U.cwt}`);
          const init={method:"POST",headers,body:JSON.stringify({email}),credentials:"omit",cache:"no-store"};
          headers.set("cache-control","no-store");
          const res=await fetcher("https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/fetch-profiles",init);

          // If the edge rejects with an email mismatch, clear and retry once
          // with a freshly minted token for the resolved email.
          if(attempt===1 && res.status===403){
            try{
              const body=await res.clone().json();
              if(body?.error && String(body.error).toLowerCase().includes("email mismatch") && typeof clearCachedCWT==="function"){
                await refreshDashboardToken("dashboard retry after mismatch");
                return doFetch(attempt+1);
              }
            }catch(err){console.warn("[dashboard] mismatch retry check failed",err);}
          }

          return res;
        };

        doFetch()
        .then(r=>r.json())
        .then(res=>{
          console.debug("Returned JSON →",res);
          const data = res.data || res; // accept either shape
          const error = res.error;
          if(error||!data){
            const cachedStates=cached?.states;
            cached=null;
            sessionStorage.removeItem(CACHE_KEY);
            const fallbackStates=cachedStates||showResumeFallback();
            applyFinal(fallbackStates,"Final grid state (error/empty response)",false);
            return;
          }

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
            grid1: (inProgress === 0),
            grid2: inProgress >= 1,
            grid3: hasCompletedCert,
            grid4: certCount >= 1,
            grid5: hasCompletedNode || hasCompletedCert,
          };

          if(!Object.values(states).some(Boolean)) states.grid1=true;

          applyFinal(states,"Final grid state (Supabase)");

          // Re-run bubbleization after showing grids
          window.dispatchEvent(new CustomEvent('@softr/page-content-loaded'));
        })
        .catch(e=>{
          console.error("❌ Fetch failed:",e);
          const cachedStates=cached?.states;
          cached=null;
          sessionStorage.removeItem(CACHE_KEY);
          const fallbackStates=cachedStates||showResumeFallback();
          applyFinal(fallbackStates,"Final grid state (fetch failed)",false);
        });
      });
    }catch(e){
      console.error("❌ toggleGridsUnified crashed:",e);
      cached=null;
      sessionStorage.removeItem(CACHE_KEY);
      const fallbackStates=showFreshUser();
      applyFinal(fallbackStates,"Final grid state (crash)",false);
    }
  };

  startUserResolution();
}
(function(){
 let hasRun=false;
 let softrReady=false;

 const userReady=()=>{
   const u=window.logged_in_user||(window.Softr&&window.Softr.currentUser)||(window.__U&&window.__U.profile);
   return !!(u && (u.email||u.softr_user_email));
 };

 const gridsReady=()=>['grid1','grid2','grid3','grid4','grid5'].some(id=>document.getElementById(id));

 const waitForReady=(timeout=1800)=>new Promise(resolve=>{
   const deadline=Date.now()+timeout;
   (function loop(){
     if(softrReady && userReady() && gridsReady()) return resolve();
     if(Date.now()>deadline) return resolve();
     requestAnimationFrame(loop);
   })();
 });

 const runOnce=()=>{
   if(hasRun || !softrReady) return;
   hasRun=true;
   waitForReady().then(()=>{
     console.log("⚡ Universio grids initializing");
     toggleGridsUnified();
   });
 };

 const markSoftrReady=()=>{ softrReady=true; runOnce(); };

window.addEventListener("softr:pageLoaded",markSoftrReady,{once:true});
/* Optional: also listen to Softr's other load event without removing yours */
window.addEventListener("@softr/page-content-loaded",markSoftrReady,{once:true});
document.addEventListener("DOMContentLoaded",()=>{ setTimeout(markSoftrReady, 60); },{once:true});
// In case the events above fired before this script executed, run after a short tick.
if (document.readyState !== 'loading') {
  setTimeout(markSoftrReady, 80);
}
})();

// 6b) EMPTY STATE WATCHER → REFRESH GRID VISIBILITY
(function(){
  const EMPTY_COPY = "No results found, try adjusting your search and filters.";
  const INTERVAL_MS = 900;
  const MAX_DURATION_MS = 12000;
  let intervalId=null, deadline=0, refreshed=false;

  const containsEmptyState=()=>{
    const scope=document.getElementById('page-content')||document.body;
    if(!scope) return false;
    return scope.textContent && scope.textContent.includes(EMPTY_COPY);
  };

  const refreshGrids=(reason)=>{
    if(refreshed) return;
    refreshed=true;
    console.debug(`🔁 Refreshing grid visibility (${reason})`);
    try{ toggleGridsUnified(); }catch(e){ console.error('❌ Grid visibility refresh failed:',e); }
  };

  const poll=()=>{
    if(Date.now()>deadline){
      clearInterval(intervalId); intervalId=null; return;
    }
    if(containsEmptyState()){
      clearInterval(intervalId); intervalId=null;
      refreshGrids('empty state detected');
    }
  };

  const startPolling=()=>{
    if(intervalId||refreshed) return;
    deadline=Date.now()+MAX_DURATION_MS;
    poll();
    intervalId=setInterval(poll,INTERVAL_MS);
  };

  window.addEventListener('load',startPolling,{once:true});
  window.addEventListener('@softr/page-content-loaded',startPolling,{once:true});
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
