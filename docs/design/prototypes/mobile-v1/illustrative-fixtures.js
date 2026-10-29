
// Design-only SVG fixtures, not application code or a simulation model.
// These deliberately do not claim realistic generation or measured energy flows.
const n=96;let state=42;const rand=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
const solar=Array.from({length:n},(_,i)=>Math.max(0,Math.min(2400,650+800*Math.sin(i*.083)+350*Math.sin(i*.41)+rand()*600)));
const home=Array.from({length:n},(_,i)=>Math.max(0,Math.min(2400,500+140*Math.sin(i*.2)+rand()*450)));
const battery=Array.from({length:n},(_,i)=>Math.max(0,Math.min(100,54+18*Math.cos(i*.06)+rand()*5)));
solar[n-1]=1200;home[n-1]=800;battery[n-1]=65;
function trace(values,max,w,h,color,id,area=false){const pts=values.map((v,i)=>[i/(values.length-1)*w,h-v/max*h]);const path=pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');return `${area?`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".17"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${path} L${w},${h} L0,${h}Z" fill="url(#${id})"/>`:''}<path d="${path}" fill="none" stroke="${color}" stroke-width="1.7" ${id==='home'?'stroke-dasharray="5 3"':''} stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${w}" cy="${pts.at(-1)[1]}" r="3" fill="${color}"/>`;}
document.querySelector('#power-chart').innerHTML=trace(solar,2400,500,155,'#f1ff16','solar',true)+trace(home,2400,500,155,'#36cbb0','home',true);
document.querySelector('#battery-chart').innerHTML=trace(battery,100,500,103,'#b7f36b','soc',true);
