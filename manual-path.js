(function(scope){
'use strict';
function pointAt(segment,t){
 const p=segment.points;let lo=0,hi=p.length-1;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(p[mid].t<=t)lo=mid;else hi=mid-1}
 const a=p[lo],b=p[lo+1],result={t,x:a.x,track:a.track};if(a.jump&&Math.abs(t-a.t)<1e-8)result.jump=true;if(!b||b.jump||a.track!==b.track)return result;
 const u=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t)));result.x=a.x+(b.x-a.x)*u;return result;
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
function shift(segment,delta){return {...segment,start:segment.start+delta,end:segment.end+delta,points:segment.points.map(p=>({...p,t:p.t+delta}))};}
function resample(segment,width=850){
 const times=[segment.start,segment.end];for(let i=1;segment.start+i/30<segment.end;i++)times.push(segment.start+i/30);
 for(const p of segment.points)if(p.jump)times.push(p.t);
 times.sort((a,b)=>a-b);const base=times.filter((t,i)=>!i||t-times[i-1]>1e-8).map(t=>pointAt(segment,t)),sampled={...segment,points:base};
 for(const p of segment.points){const q=pointAt(sampled,p.t);if(q.track!==p.track||Math.abs(q.x-p.x)*width>2)times.push(p.t)}
 times.sort((a,b)=>a-b);return {...segment,points:times.filter((t,i)=>!i||t-times[i-1]>1e-8).map(t=>pointAt(segment,t))};
}
function applyCorrection(layer,regions,a,b,proposal){
 if(!Number.isFinite(a)||!Number.isFinite(b)||b-a<.05||b-a>60)throw Error('请选择0.05至60秒的校准片段');
 const out=JSON.parse(JSON.stringify(layer)),trackIds=new Set(out.tracks.map(t=>t.id));
 const usable=regions.map((n,i)=>({...n,regionId:i})).filter(n=>!n.holding);
 function auto(n,x){const id='text-p'+n.page+'r'+(n.row??Math.round((n.followY??n.y)*100));if(!trackIds.has(id)){const row=regions.filter(v=>v.page===n.page&&(v.row??Math.round((v.followY??v.y)*100))===(n.row??Math.round((n.followY??n.y)*100))&&!v.holding);const y=Math.max(0,Math.min(...row.map(v=>v.followY??v.y))-.006),bottom=Math.min(1,Math.max(...row.map(v=>(v.followY??v.y)+(v.followH??v.h)))+.006);out.tracks.push({id,page:n.page,y,h:bottom-y});trackIds.add(id)}return {track:id,x};}
 function at(t){const m=positionAt(layer,t);if(m){const seg=layer.segments.find(s=>t>=s.start&&t<s.end);return pointAt(seg,t)}const n=regions.find(n=>t>=n.start&&t<n.end);if(!n||n.holding)throw Error('选区含未定位位置，请先框选谱行并人工录制');const u=Math.max(0,Math.min(1,(t-n.start)/(n.end-n.start)));return auto(n,n.x+n.w*u)}
 let points=[];
 if(proposal.type==='warp'){
  const anchors=proposal.anchors;
  if(!Array.isArray(anchors)||anchors.length<2||anchors.length>100||Math.abs(anchors[0].at-a)>1e-6||Math.abs(anchors.at(-1).at-b)>1e-6)throw Error('时间锚点必须覆盖所选范围');
  anchors.forEach((p,i)=>{if(![p.at,p.source].every(Number.isFinite)||p.source<a||p.source>b||p.at<a||p.at>b||i&&p.at<=anchors[i-1].at)throw Error('时间锚点无效')});
  const times=[a,b,...anchors.map(p=>p.at)];for(let i=1;a+i/30<b;i++)times.push(a+i/30);
  const boundaries=[...regions.flatMap(n=>[n.start,n.end]),...layer.segments.flatMap(s=>[s.start,s.end,...s.points.filter(p=>p.jump).map(p=>p.t)])];
  for(let i=1;i<anchors.length;i++){const x=anchors[i-1],y=anchors[i];if(y.source===x.source)continue;for(const t of boundaries){const u=(t-x.source)/(y.source-x.source);if(u>0&&u<1){const target=x.at+u*(y.at-x.at);times.push(target,Math.max(a,target-.00001))}}}
  const sorted=[...new Set(times)].sort((x,y)=>x-y).filter((t,i,all)=>!i||t-all[i-1]>1e-8);
  points=sorted.map(t=>{let i=anchors.findIndex(p=>p.at>t);if(i<0)i=anchors.length-1;const x=anchors[Math.max(0,i-1)],y=anchors[i],u=(t-x.at)/(y.at-x.at||1),source=x.source+(y.source-x.source)*u;return {...at(Math.min(b-1e-7,source)),t}});
 }else if(proposal.type==='route'){
  if(!Array.isArray(proposal.points)||proposal.points.length<2||proposal.points.length>3000)throw Error('路线点数量无效');
  points=proposal.points.map((p,i)=>{const n=usable.find(n=>n.regionId===p.regionId);if(!n||![p.t,p.offset].every(Number.isFinite)||p.offset<0||p.offset>1||p.t<a||p.t>b||i&&p.t<=proposal.points[i-1].t)throw Error('路线目标或时间无效');return {t:p.t,...auto(n,n.x+n.w*p.offset),...(p.jump?{jump:true}:{})}});
  if(Math.abs(points[0].t-a)>1e-6||Math.abs(points.at(-1).t-b)>1e-6)throw Error('路线必须覆盖选区边界');
 }else throw Error('只接受时间锚点或现有谱位路线');
 points.forEach((p,i)=>{const prev=points[i-1];if(prev&&(prev.track!==p.track||p.x<prev.x-2/850))p.jump=true;if(!Number.isFinite(p.x)||p.x<0||p.x>1)throw Error('光标坐标超出谱面')});
 const take=resample({id:'text-'+Date.now(),start:a,end:b,points});out.segments=insert(out.segments,take);
 if(out.segments.reduce((n,s)=>n+s.points.length,0)>60000)throw Error('路径点数超限，请缩小范围');return out;
}
const api={pointAt,positionAt,clip,subtract,insert,trim,shift,resample,applyCorrection};scope.ManualPath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
