// Design-review state staging only. No requests, timers, browser-clock age or app implementation.
(() => {
  const surface=document.documentElement.dataset.stateSurface;
  const history=surface.startsWith('history');
  const mobile=surface.endsWith('mobile');
  const params=new URLSearchParams(location.search);
  const names=['loading','empty','error','stale','refreshing','retained','partial','ready'];
  let state=names.includes(params.get('state'))?params.get('state'):'loading';
  if(history&&state==='stale')state='partial';
  if(!history&&state==='partial'){
    location.replace(new URL(`../interface-states-v1/history-${mobile?'mobile':'desktop'}.html?state=partial`,document.baseURI));return;
  }
  const original=state;
  let pending=state==='loading'||state==='refreshing';
  let starts=pending?1:0;
  const cached=!['loading','empty','error'].includes(original);
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const root=q(history?(mobile?'.history-content':'.workspace'):(mobile?'.content':'.stage'));
  const measuredAt='2026-10-28T18:32:00Z';
  const lastAsOf='2026-10-28T18:32:15Z';
  const staleAsOf='2026-10-28T18:39:30Z';
  const successfulReference=[lastAsOf,staleAsOf].includes(params.get('asOf'))?params.get('asOf'):original==='stale'?staleAsOf:lastAsOf;
  const ageAt=(measurement,reference)=>(Date.parse(reference)-Date.parse(measurement))/1000;
  const isStaleAt=(measurement,reference)=>ageAt(measurement,reference)>300;
  const savedMinute=Number(params.get('minute'));
  if(history&&cached&&params.has('minute')&&Number.isInteger(savedMinute)&&savedMinute>=0&&savedMinute<=1440)window.historyDesignReview.select(savedMinute);
  const copies={
    loading:['Loading measurements…','Waiting for the first response.'],
    empty:['No measurements yet','Select Refresh after readings are added.'],
    error:["Couldn’t load measurements",'Select Retry to try again.'],
    stale:['Reading is 7 min 30 sec old','At the server check, 14:39:30. Select Refresh to check again.'],
    refreshing:['Refreshing measurements…','Showing the last successful snapshot.'],
    retained:["Readings couldn’t be updated",'Previous values shown; current freshness unverified. Select Retry.']
  };
  const button=q('.refresh');
  const action=button.cloneNode(true);action.removeAttribute('onclick');action.removeAttribute('title');button.replaceWith(action);
  const originalIcon=action.querySelector('svg')?.outerHTML||'';
  qa('.review-tools').forEach(e=>e.remove());
  q('#prototype-message')?.remove();q('#preview-notice')?.remove();
  const footer=q('footer');
  if(footer){footer.className='state-footer';footer.textContent='Interface States v1 · Illustrative design · Pending your approval';}
  const controls=document.createElement('section');controls.className='state-review-controls';controls.setAttribute('aria-label','Design preview completion controls');
  controls.innerHTML='<p>Design review only · Requests are simulated, never sent.</p><button type="button" data-finish="success">Complete successfully</button><button type="button" data-finish="failure">Fail preview</button><a href="../interface-states-v1/index.html">Back to state gallery</a>';
  document.body.append(controls);
  const attention=()=>['error','retained','stale'].includes(state);
  function notify(){
    if(!history){
      if(!copies[state])return;
      const old=q('.hero>.state-notice')||q('.hero>p');if(!old)return;
      const note=document.createElement('div');note.className='state-notice';note.dataset.tone=attention()?'attention':'neutral';note.setAttribute('role',['error','retained'].includes(state)?'alert':'status');
      note.setAttribute('aria-atomic','true');
      const [title,body]=copies[state];
      note.innerHTML=`<strong><span class="state-symbol" aria-hidden="true">${attention()?'!':'·'}</span>${title}</strong><p>${body}</p>`;old.replaceWith(note);
    }else{
      const checked=q('.checked');checked.classList.add('state-reference');
      const text={loading:['Server reference pending','Loading history…'],empty:['Checked 28 Oct, 14:32:15','No readings in this window.'],error:['Server reference unavailable',"Couldn’t load history. Select Retry."],refreshing:['Last successful check 28 Oct, 14:32:15','Refreshing history… Previous snapshot shown.'],retained:['Last successful check 28 Oct, 14:32:15',"Couldn’t refresh. Previous snapshot shown."],partial:['Last checked 28 Oct, 14:32:15','Partial history · No values estimated.']}[state];
      if(text){checked.innerHTML=`<span>${text[0]}</span><strong data-tone="${attention()?'attention':'neutral'}" role="${['error','retained'].includes(state)?'alert':'status'}">${text[1]}</strong>`;}
    }
  }
  function updateAction(){
    action.classList.add('state-action');action.disabled=pending;action.setAttribute('aria-disabled',String(pending));action.setAttribute('aria-busy',String(pending));
    const text=pending?(cached?'Refreshing…':'Loading…'):['error','retained'].includes(state)?'Retry':'Refresh';
    action.innerHTML=`${pending?'<span class="state-spinner" aria-hidden="true"></span>':originalIcon}${text}`;
    action.setAttribute('aria-label',`${text.replace('…','')} ${history?'history':'measurements'}`);
    qa('[data-finish]').forEach(b=>b.disabled=!pending);
    root?.setAttribute('aria-busy',String(pending));
    document.documentElement.dataset.displayState=state;
  }
  function skeleton(kind='number'){return `<span class="state-skeleton state-${kind}" aria-hidden="true"></span>`;}
  function maskPlot(svg,kind){
    const box=svg.viewBox.baseVal;const w=box.width||500,h=box.height||120;
    svg.innerHTML=kind==='loading'?`<rect x="0" y="${h*.13}" width="${w*.78}" height="${h*.12}" rx="5" fill="#243c2c"/><rect x="0" y="${h*.43}" width="${w*.58}" height="${h*.12}" rx="5" fill="#1c3023"/><rect x="0" y="${h*.73}" width="${w*.87}" height="${h*.12}" rx="5" fill="#243c2c"/>`:'';
    svg.classList.add('state-chart-disabled');svg.setAttribute('role','img');svg.setAttribute('tabindex','-1');
    if(kind==='loading')svg.closest('.plot')?.classList.add('state-plot-loading');
    if(kind==='loading')svg.closest('.card')?.classList.add('state-card-loading');
    ['aria-valuenow','aria-valuetext','aria-valuemin','aria-valuemax'].forEach(a=>svg.removeAttribute(a));
    svg.setAttribute('aria-label',kind==='loading'?'History is loading; no readings are displayed.':kind==='empty'?'No readings in this window.':'History could not be loaded; data availability is unknown.');
    const parent=svg.parentElement;parent.style.position='relative';parent.querySelectorAll('.state-overlay').forEach(e=>e.remove());
    if(history)parent.querySelector('.empty-overlay').hidden=true;
    if(kind!=='loading'){
      const overlay=document.createElement('div');overlay.className='state-overlay';
      overlay.innerHTML=kind==='empty'?'<strong>No readings yet</strong><p>Select Refresh after readings are added.</p>':"<strong>Couldn’t load history</strong><p>Select Retry to try again.</p>";
      parent.append(overlay);
    }
  }
  function maskOverview(kind){
    const loading=kind==='loading';
    qa(mobile?'.metric-value':'.metric .value').forEach(e=>{e.innerHTML=loading?skeleton():`—${mobile?'<span>W</span>':'<small>W</small>'}`;e.setAttribute('aria-label',loading?'Power is loading.':'Power is unavailable.');});
    const gauge=q('.gauge'),value=q(mobile?'.gauge-value':'.gauge .reading');
    value.innerHTML=loading?`<strong>${skeleton()}</strong><span class="${mobile?'support':'muted'}">State of charge</span>`:`<strong>—${mobile?'<span>%</span>':'<small>%</small>'}</strong><span class="${mobile?'support':'muted'}">State of charge</span>`;
    const svg=gauge.querySelector('svg'),size=mobile?112:146,center=size/2,r=mobile?46:60;
    svg.innerHTML=`<circle cx="${center}" cy="${center}" r="${r}" fill="none" stroke="#233126" stroke-width="${mobile?6:7}"/>`;
    svg.setAttribute('aria-label',loading?'Battery charge is loading.':'Battery charge is unavailable.');
    qa('.spark').forEach(e=>{e.innerHTML='';e.setAttribute('aria-label','No preview readings available.');});
    q('.latest .time').innerHTML=loading?skeleton('time'):'—';
    q('.latest .date').innerHTML=loading?skeleton('date'):'No measurement timestamp';
    const freshness=q(mobile?'.fresh':'.latest .fresh');freshness.classList.add('state-neutral');freshness.textContent=loading?'Checking reading…':kind==='empty'?'No reading to assess':'Unable to check';
    const checked=q(mobile?'.check-note':'.latest .checked');checked.innerHTML=loading?'Waiting for server reference.':kind==='empty'?'Checked <strong>14:32:15</strong><br>No reading to assess.':'No successful server check.<br>Freshness is unavailable.';
    qa('.battery-history .range,.soc-latest').forEach(e=>e.textContent=loading?'Loading…':'Latest —');
    qa('#power-chart,#battery-chart').forEach(svg=>maskPlot(svg,kind));
  }
  function overviewKnownState(){
    const fresh=q(mobile?'.fresh':'.latest .fresh'),checked=q(mobile?'.check-note':'.latest .checked');
    if(state==='stale'){
      fresh.textContent='Stale at last check';fresh.classList.add('state-attention');
      checked.innerHTML='Checked <strong>14:39:30</strong><br>7 min 30 sec old at that check.';
    }
    if(state==='retained'){
      const wasStale=successfulReference===staleAsOf;
      fresh.textContent=wasStale?'Last check: stale':'Last check: fresh';fresh.classList.add(wasStale?'state-attention':'state-neutral');
      checked.innerHTML=`Last success <strong>${wasStale?'14:39:30':'14:32:15'}</strong><br>At that check: ${wasStale?'7 min 30 sec':'15 sec'} old`;
    }
  }
  function maskHistory(kind){
    if(kind==='empty')window.historyDesignReview.setScenario('empty');
    else{
      q('#coverage-status').textContent=kind==='loading'?'Loading history…':'Query failed';
      q('#selected-title').textContent=kind==='loading'?'Loading reading':'Reading unavailable';
      q('#reading-status').textContent=kind==='loading'?'Waiting for response':'Availability unknown';
      q('#reading-status').classList.add('state-neutral');
      q('#selected-date').innerHTML=kind==='loading'?skeleton('date'):'No successful query';
      q('#selected-time').innerHTML=kind==='loading'?skeleton('time'):'—';
      ['solar','home','battery'].forEach(id=>{q('#selected-'+id).innerHTML=kind==='loading'?skeleton():'—';});
      qa('#power-chart,#battery-chart').forEach(svg=>maskPlot(svg,kind));
      q('#coverage-explanation').textContent=kind==='loading'?'History coverage will be available after the query completes.':'History coverage is unknown because the request failed.';
      const key=q('.coverage-note .missing-key');if(key)key.textContent=kind==='loading'?'Loading…':'Unknown';
      q('.coverage-note>.card-top>.gap-key')?.classList.add('state-hidden-accessible');
      q('.coverage-foot')?.replaceChildren(document.createTextNode('Coverage follows a successful history query.'));
      q('#coverage-intervals').hidden=true;q('#adjacent-readings').hidden=true;
      q('#availability-track').innerHTML='';q('#availability-track').style.background='#203426';q('#availability-track').setAttribute('aria-label','History coverage is not available.');
      q('#availability-track').classList.add('state-coverage-unavailable');
      q('#inspection-help').textContent=kind==='loading'?'Waiting for historical readings.':'Select Retry to load historical readings.';
    }
    qa('#minute-selector,#previous-minute,#next-minute').forEach(e=>e.disabled=true);
    qa('#power-chart,#battery-chart').forEach(e=>{e.setAttribute('aria-disabled','true');e.classList.add('state-chart-disabled');});
    q('#selection-note').textContent=kind==='loading'?'No readings have been received yet.':kind==='empty'?'No readings in this window.':'Readings could not be loaded.';
    q('#selection-summary').textContent=kind==='loading'?'Historical readings are loading.':kind==='empty'?'No historical readings.':'The historical query failed. Availability is unknown.';
    q('.snapshot-note')?.replaceChildren(document.createTextNode(kind==='empty'?'Successful empty response · Checked 28 Oct, 14:32:15':'No successful snapshot reference is available.'));
  }
  function apply(){
    notify();
    if(['loading','empty','error'].includes(state))history?maskHistory(state):maskOverview(state);
    else if(!history)overviewKnownState();
    else if(state==='retained'){
      q('#coverage-status').textContent='Update failed';
      q('.snapshot-note')?.replaceChildren(document.createTextNode('Previous snapshot · Last successful server reference: 28 Oct 2026, 14:32:15'));
    }else if(state==='refreshing')q('#coverage-status').textContent='Refreshing…';
    updateAction();
  }
  function beginRequest(){
    if(pending)return false;
    pending=true;starts++;state=cached?'refreshing':'loading';apply();return true;
  }
  function finishRequest(success){
    if(!pending)return false;
    pending=false;
    const url=new URL(location.href);url.searchParams.set('state',success?'ready':cached?'retained':'error');
    if(!success&&cached)url.searchParams.set('asOf',successfulReference);else url.searchParams.delete('asOf');
    if(history&&cached)url.searchParams.set('minute',String(window.historyDesignReview.getState().selected));else url.searchParams.delete('minute');
    location.assign(url);return true;
  }
  action.addEventListener('click',beginRequest);
  qa('[data-finish]').forEach(b=>b.addEventListener('click',()=>finishRequest(b.dataset.finish==='success')));
  window.solarWatchStatePreview={beginRequest,finishRequest,ageAt,isStaleAt,getState:()=>({surface,state,pending,starts,cached,measuredAt:['loading','empty','error'].includes(state)?null:measuredAt,asOf:['loading','error'].includes(state)?null:successfulReference,logicalRequestOnly:true})};
  apply();
})();
