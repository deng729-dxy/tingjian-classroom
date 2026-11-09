(function(scope){
'use strict';
function pointAt(segment,t){
 const p=segment.points;let lo=0,hi=p.length-1;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(p[mid].t<=t)lo=mid;else hi=mid-1}
 const a=p[lo],b=p[lo+1];if(!b||b.jump||a.track!==b.track)return {...a,t};
 const u=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t)));return {...a,t,x:a.x+(b.x-a.x)*u};
}
function positionAt(layer,t){
 const segment=layer?.segments?.find(s=>t>=s.start&&t<s.end);if(!segment)return null;
 const p=pointAt(segment,t),track=layer.tracks.find(r=>r.id===p.track);if(!track)return null;
 return {page:track.page,x:p.x,y:track.y,h:track.h,source:'manual',index:-1,segmentId:segment.id};
}
function clip(segment,a,b){
 a=Math.max(a,segment.start);b=Math.min(b,segment.end);if(b-a<.001)return null;
 return {...segment,id:segment.id+'-'+Math.round(a*1000),start:a,end:b,points:[pointAt(segment,a),...segment.points.filter(p=>p.t>a&&p.t<b),pointAt(segment,b)]};
}
function subtract(segments,a,b){return segments.flatMap(s=>s.end<=a||s.start>=b?[s]:[clip(s,s.start,a),clip(s,b,s.end)].filter(Boolean));}
function insert(segments,take){return [...subtract(segments,take.start,take.end),take].sort((a,b)=>a.start-b.start);}
function trim(segment,a,b){return clip(segment,a,b);}
const api={pointAt,positionAt,clip,subtract,insert,trim};scope.ManualPath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
