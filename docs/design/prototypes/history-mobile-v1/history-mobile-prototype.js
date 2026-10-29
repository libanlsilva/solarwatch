// Mobile-only visual review adapted from the approved desktop fixtures. No API or application code.
(() => {
  const start = Date.parse('2026-10-27T18:32:00Z');
  const count = 1441;
  const gaps = [{start:0,end:89},{start:580,end:609}];
  let seed=42;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const fixtures=Array.from({length:count},(_,i)=>{
    const t=i/15.1578947368;
    const values={index:i,at:start+i*60000,solar:Math.round(Math.max(0,Math.min(2400,650+800*Math.sin(t*.083)+350*Math.sin(t*.41)+random()*80))),home:Math.round(500+140*Math.sin(t*.2)+random()*120),battery:Math.round(54+18*Math.cos(t*.06)+random())};
    if (i===1440) Object.assign(values,{solar:1200,home:800,battery:65});
    return gaps.some(g=>i>=g.start&&i<=g.end)?null:values;
  });
  const dateFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Havana',day:'2-digit',month:'short',year:'numeric'});
  const timeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Havana',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const shortFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Havana',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const number=new Intl.NumberFormat('en-US');
  const charts=[{id:'power-chart',height:210,max:2400,series:[['solar','#f1ff16'],['home','#36cbb0']]},{id:'battery-chart',height:116,max:100,series:[['battery','#b7f36b']]}];
  let selected=1060;
  let empty=false;
  let scenario='reading';
  const el=id=>document.getElementById(id);
  function segments() {
    const result=[];let current=[];
    for (let i=0;i<count;i++) {
      if (!empty&&fixtures[i]) current.push(fixtures[i]);
      else if (current.length) {result.push(current);current=[];}
    }
    if(current.length) result.push(current);
    return result;
  }
  function drawChart(config) {
    const {height:h,max,series,id}=config;
    const svg=el(id);
    let markup=`<defs><pattern id="${id}-gap" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#18281e" fill-opacity=".8"/><path d="M-2 2L2-2M0 8L8 0M6 10L10 6" stroke="#7e9380" stroke-opacity=".4" stroke-width="1"/></pattern></defs>`;
    for(let i=0;i<5;i++) markup+=`<line x1="0" x2="1000" y1="${i*h/4}" y2="${i*h/4}" stroke="#31513a" stroke-opacity=".55" vector-effect="non-scaling-stroke"/>`;
    const missing=empty?[{start:0,end:1440}]:gaps;
    for(const gap of missing) {
      const x=gap.start/1440*1000;
      const width=(Math.min(1440,gap.end+1)-gap.start)/1440*1000;
      markup+=`<rect class="gap-band" data-start="${gap.start}" data-end="${gap.end}" x="${x}" y="0" width="${width}" height="${h}" fill="url(#${id}-gap)"/>`;
    }
    for(const [key,color] of series) for(const run of segments()) {
      const path=run.map((v,j)=>`${j?'L':'M'}${(v.index/1440*1000).toFixed(2)},${(h-v[key]/max*h).toFixed(2)}`).join(' ');
      const first=run[0].index/1440*1000,last=run.at(-1).index/1440*1000;
      markup+=`<path class="series-area" d="${path} L${last},${h} L${first},${h} Z" fill="${color}" fill-opacity=".035"/>`;
      markup+=`<path class="data-line" data-series="${key}" data-start="${run[0].index}" data-end="${run.at(-1).index}" d="${path}" stroke="${color}" stroke-width="1.7" ${key==='home'?'stroke-dasharray="5 3"':''} fill="none" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    }
    markup+='<g class="inspection-cursor" aria-hidden="true"></g>';
    svg.innerHTML=markup;
    svg.setAttribute('role',empty?'img':'slider');
    svg.setAttribute('aria-label',empty?(id==='power-chart'?'No power readings in the displayed 24-hour window.':'No battery readings in the displayed 24-hour window.'):(id==='power-chart'?'Inspect historical power readings by minute':'Inspect historical battery readings by minute'));
    svg.setAttribute('tabindex',empty?'-1':'0');
    for(const [attribute,value] of [['aria-valuemin','0'],['aria-valuemax','1440']]) {if(empty) svg.removeAttribute(attribute);else svg.setAttribute(attribute,value);}
    svg.parentElement.querySelector('.empty-overlay').hidden=!empty;
  }
  function renderHistory() {
    charts.forEach(drawChart);
    el('coverage-status').textContent=empty?'No readings':'Partial history';
    el('inspection-help').innerHTML=empty?'There are no readings to inspect in this window.':'Tap a chart. Use −1 / +1 for exact minutes.';
    el('coverage-explanation').textContent=empty?'No measurements were recorded in the displayed 24-hour window. Values are unavailable.':'Some minutes have no recorded measurement. These areas stay blank on both charts.';
    el('coverage-intervals').hidden=empty;
    const spans=empty?[{start:0,end:1440}]:gaps;
    el('availability-track').innerHTML=spans.map(g=>`<span class="gap-block" style="left:${g.start/1440*100}%;width:${(Math.min(1440,g.end+1)-g.start)/1440*100}%"></span>`).join('');
    el('availability-track').setAttribute('aria-label',empty?'No readings in the entire 24-hour interval.':'An initial period without readings and an internal 30-minute missing interval.');
    document.querySelectorAll('[data-scenario]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scenario===scenario)));
    renderSelection();
  }
  function renderSelection() {
    const value=empty?null:fixtures[selected];
    const at=start+selected*60000;
    const available=!!value;
    el('selected-title').textContent=empty?'Selected window':available?'Selected reading':'Selected time';
    el('selected-date').textContent=empty?'27–28 Oct 2026':dateFormat.format(at);
    el('selected-time').textContent=empty?'—':timeFormat.format(at);
    el('reading-status').textContent=empty?'No readings':available?'Reading available':'No reading at this minute';
    el('reading-status').classList.toggle('unavailable',!available);
    el('selected-solar').textContent=available?number.format(value.solar):'—';
    el('selected-home').textContent=available?number.format(value.home):'—';
    el('selected-battery').textContent=available?number.format(value.battery):'—';
    el('selection-note').textContent=empty?'No values are available in this window.':available?'Values at the selected measurement time.':'Values are unavailable. No measurement is substituted or estimated.';
    el('adjacent-readings').hidden=available||empty;
    el('coverage-intervals').hidden=empty||!available;
    el('coverage-explanation').textContent=empty?'No measurements were recorded in the displayed 24-hour window. Values are unavailable.':available?'Some minutes have no recorded measurement. These areas stay blank on both charts.':'No measurement exists at the selected minute. The adjacent recorded times are shown below.';
    if(!available&&!empty) {
      let before=selected-1,after=selected+1;
      while(before>=0&&!fixtures[before]) before--;
      while(after<count&&!fixtures[after]) after++;
      const previous=before>=0?shortFormat.format(fixtures[before].at):'No earlier reading in this window';
      const next=after<count?shortFormat.format(fixtures[after].at):'No later reading in this window';
      el('adjacent-readings').innerHTML=`<p><span>Last reading before</span>${previous}</p><p><span>First reading after</span>${next}</p>`;
    }
    const summary=empty?'No readings in the displayed window.':`${dateFormat.format(at)}, ${timeFormat.format(at)}, America/Havana. ${available?`Solar generation ${value.solar} watts, home consumption ${value.home} watts, battery charge ${value.battery} percent.`:'No measurement at this minute. Values unavailable.'}`;
    el('selection-summary').textContent=summary;
    for(const config of charts) {
      const svg=el(config.id),cursor=svg.querySelector('.inspection-cursor');
      if(empty) {cursor.innerHTML='';svg.removeAttribute('aria-valuenow');svg.removeAttribute('aria-valuetext');continue;}
      svg.setAttribute('aria-valuenow',String(selected));svg.setAttribute('aria-valuetext',summary);
      const x=selected/1440*1000;
      cursor.innerHTML=`<line x1="${x}" x2="${x}" y1="0" y2="${config.height}" stroke="#d0ded2" stroke-opacity=".65" stroke-dasharray="3 5" vector-effect="non-scaling-stroke"/>`+(available?config.series.map(([key,color])=>`<circle cx="${x}" cy="${config.height-value[key]/config.max*config.height}" r="4" fill="${color}" stroke="#06110f" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`).join(''):'');
    }
    el('minute-selector').disabled=empty;
    el('minute-selector').value=String(selected);
    el('minute-selector').setAttribute('aria-valuetext',summary);
    el('previous-minute').disabled=empty||selected===0;
    el('next-minute').disabled=empty||selected===1440;
  }
  function select(index) {if(empty)return;selected=Math.min(1440,Math.max(0,Math.round(index)));renderSelection();}
  function setScenario(next) {scenario=next;empty=next==='empty';selected=next==='gap'?595:1060;renderHistory();}
  for(const config of charts) {
    const svg=el(config.id);
    const point=event=>{const box=svg.getBoundingClientRect();select((event.clientX-box.left)/box.width*1440);};
    let touchStart=null;
    svg.addEventListener('pointerdown',event=>{touchStart={x:event.clientX,y:event.clientY};});
    svg.addEventListener('pointerup',event=>{if(touchStart&&Math.hypot(event.clientX-touchStart.x,event.clientY-touchStart.y)<=10)point(event);touchStart=null;});
    svg.addEventListener('pointercancel',()=>{touchStart=null;});
    svg.addEventListener('keydown',event=>{
      if(empty)return;
      const next={ArrowLeft:selected-1,ArrowRight:selected+1,Home:0,End:1440}[event.key];
      if(next!==undefined) {event.preventDefault();select(next);}
    });
  }
  el('minute-selector').addEventListener('input',event=>select(Number(event.target.value)));
  el('previous-minute').addEventListener('click',()=>select(selected-1));
  el('next-minute').addEventListener('click',()=>select(selected+1));
  document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>setScenario(button.dataset.scenario)));
  document.querySelector('.refresh').addEventListener('click',()=>{el('preview-notice').hidden=false;});
  // Inspection surface for reproducible local visual checks; not an application API.
  window.historyDesignReview={select,setScenario,getState:()=>({selected,empty,scenario,measurement:empty?null:fixtures[selected],segments:segments().map(s=>({start:s[0].index,end:s.at(-1).index})),windowStart:start,windowEnd:start+1440*60000})};
  renderHistory();
})();
