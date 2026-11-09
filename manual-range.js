(function(scope){
'use strict';
function timeAt(x,left,width,start,end){return start+Math.max(0,Math.min(1,(x-left)/width))*(end-start);}
function candidates(events,layer,page,x,y,endpoint){
 const hits=[];
 const notes=events.filter(n=>!n.holding&&n.page===page&&Math.abs((n.followY??n.y)+(n.followH??n.h)/2-y)<Math.max(.018,(n.followH??n.h)*1.2));
 if(notes.length){const distance=Math.min(...notes.map(n=>Math.max(n.x-x,0,x-n.x-n.w)));if(distance<.06)for(const n of notes){if(Math.max(n.x-x,0,x-n.x-n.w)>distance+.002)continue;const t=endpoint==='end'?n.end:n.start;if(layer?.segments?.some(s=>t>=s.start&&t<s.end))continue;hits.push({time:t,label:'自动定位',page,x,y:(n.followY??n.y),h:n.followH??n.h})}}
 for(const segment of layer?.segments||[]){for(let i=0;i<segment.points.length-1;i++){const a=segment.points[i],b=segment.points[i+1],track=layer.tracks.find(r=>r.id===a.track);if(!track||track.page!==page||y<track.y-.012||y>track.y+track.h+.012)continue;
  if(b.jump||a.track!==b.track){if(Math.abs(x-a.x)<.015)hits.push({time:endpoint==='end'?b.t:a.t,label:'人工路径',page,x:a.x,y:track.y,h:track.h});continue}
  if(x<Math.min(a.x,b.x)-.005||x>Math.max(a.x,b.x)+.005)continue;
  const t=Math.abs(b.x-a.x)<.002?(endpoint==='end'?b.t:a.t):a.t+Math.max(0,Math.min(1,(x-a.x)/(b.x-a.x)))*(b.t-a.t);hits.push({time:t,label:'人工路径',page,x,y:track.y,h:track.h});
 }}
 hits.sort((a,b)=>a.time-b.time);const groups=[];for(const hit of hits){const last=groups.at(-1);if(!last||hit.time-last.at(-1).time>.08)groups.push([hit]);else last.push(hit)}return groups.map(g=>endpoint==='end'?g.at(-1):g[0]);
}
const api={timeAt,candidates};scope.ManualRange=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
