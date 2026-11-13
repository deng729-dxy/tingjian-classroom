'use strict';
const $=id=>document.getElementById(id), audios=[new Audio(),new Audio()];
audios.forEach((a,i)=>{a.id=i?'vocalTrack':'backingTrack';a.hidden=true;document.body.append(a)});
let ctx,gains,playing=false,events=[],duration=0,lastNote=-1,urls=[];
const bufferProgress=new AudioBufferProgress(audios,$("audioBuffer"));
const seekController=new DualTrackSeek(audios);let dragging=false,dragResume=false,previewTime=null,seekResume=false;
let pitchCandidates=[],seekEpoch=0;
let lastFollowLine='';
let activeBeats=[],activeManual=null,manualEditorOpen=false;
const reducedFollowMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let paintedCursor=null, paintedSweep=null, paintedRow='', paintedMapStatus='';
function clearFollowPaint(){
 if(paintedCursor)paintedCursor.hidden=true;
 if(paintedSweep)paintedSweep.hidden=true;
 paintedCursor=paintedSweep=null;
 paintedRow='';
}
function renderFollow(t){
 if(manualEditorOpen){manualEditorRender(t);return;}
 const here=ManualPath.positionAt(activeManual,t)||scorePositionAt(events,t);
 if(!here){clearFollowPaint();return;}
 const note=events[here.index];
 if($('scores').dataset.mode==='melody_alignment'){
  const message=here.source==='manual'?'教师人工路径 · 已保存片段':note.holding?note.text+' · 当前位置保持':'旋律跟随 · 音符 '+note.text+' · 自动对齐';
  if(message!==paintedMapStatus||$('mapStatus').textContent!==message)$('mapStatus').textContent=paintedMapStatus=message;
 }
 const page=$('scores').querySelector(`[data-page="${here.page}"]`);
 if(!page){clearFollowPaint();return;}
 if($('showBar').checked){
  if(paintedCursor?.parentElement!==page){
   clearFollowPaint();
   paintedCursor=page.querySelector('.follow-bar')||page.appendChild(document.createElement('div'));
   paintedCursor.className='follow-bar follow-edge';
   paintedSweep=page.querySelector('.follow-sweep')||page.appendChild(document.createElement('div'));
   paintedSweep.className='follow-sweep';
  }
  const rowKey=here.page+':'+here.y+':'+here.h;
  if(rowKey!==paintedRow){
   for(const layer of [paintedCursor,paintedSweep]){
    layer.style.top=Math.max(0,here.y-.008)*100+'%';
    layer.style.height=(here.h+.016)*100+'%';
   }
   paintedRow=rowKey;
  }
  paintedCursor.hidden=false;
  paintedCursor.style.transform=`translateX(${here.x*100}%)`;
  const sweep=$('followStyle').value==='sweep'&&!note?.holding;
  paintedSweep.hidden=!sweep;
  if(sweep){
   const start=scoreSweepStart(events,here);
   paintedSweep.style.transform=`translateX(${start*100}%) scaleX(${Math.max(0,here.x-start)})`;
  }
 }else clearFollowPaint();
 if(!$('follow').checked)return;
 // Preview the upcoming location without moving the current-time indicator ahead.
 const ahead=ManualPath.positionAt(activeManual,t+Number($('lookAhead').value)*Number($('speed').value))||scorePositionAt(events,t+Number($('lookAhead').value)*Number($('speed').value))||here;
 const key=ahead.page+':'+Math.round(ahead.y*100);
 if(key===lastFollowLine)return;
 lastFollowLine=key;
 const nextPage=document.querySelector(`[data-page="${ahead.page}"]`);
 if(!nextPage)return;
 const y=nextPage.getBoundingClientRect().top+ahead.y*nextPage.clientHeight;
 if(y>innerHeight-document.querySelector('footer').offsetHeight-90||y<100)window.scrollTo({top:Math.max(0,scrollY+y-innerHeight*.32),behavior:'smooth'});
}
$('follow').onchange=()=>{lastFollowLine='';renderFollow(audios[0].currentTime||0)};
$('lookAhead').onchange=()=>{lastFollowLine='';renderFollow(audios[0].currentTime||0)};
$('showBar').onchange=$('followStyle').onchange=()=>renderFollow(audios[0].currentTime||0);
const status=t=>$('status').textContent=t;
const clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
function pause(){seekResume=false;audios.forEach(a=>a.pause());playing=false;$('play').textContent='▶ 播放';}
async function init(){if(ctx)return;ctx=new (window.AudioContext||window.webkitAudioContext)();gains=audios.map(a=>{const g=ctx.createGain();ctx.createMediaElementSource(a).connect(g).connect(ctx.destination);return g});volume();}
function volume(){['bg','vg'].forEach((id,i)=>{const v=Number($(id).value)/100;$(id+'Value').value=Math.round(v*100)+'%';if(gains)gains[i].gain.setTargetAtTime(v,ctx.currentTime,.015)})}
['bg','vg'].forEach(id=>$(id).oninput=volume);
['backFile','voiceFile'].forEach((id,i)=>$(id).onchange=()=>{pause();const f=$(id).files[0];if(!f)return;if(urls[i])URL.revokeObjectURL(urls[i]);urls[i]=URL.createObjectURL(f);audios[i].src=urls[i];$('play').disabled=true;audios[i].load();bufferProgress.start();status('正在加载 '+f.name)});
audios.forEach(a=>{a.preload='auto';a.preservesPitch=true;a.onloadedmetadata=()=>{if(audios.every(x=>Number.isFinite(x.duration)&&x.duration>0)){duration=Math.min(...audios.map(x=>x.duration));$('seek').max=duration;$('seek').disabled=false;$('play').disabled=false;status('双轨已加载；起点和逐音同步尚需人工核验。'+(Math.abs(audios[0].duration-audios[1].duration)>.2?' 两轨时长不一致，播放以较短音轨为准。':''))}};a.onerror=()=>{pause();$('play').disabled=true;status('音频读取失败，请检查文件格式。')};a.onended=pause;});
$('play').onclick=async()=>{if(seekController.busy){seekController.cancel();pause();return}if(playing){pause();return}try{await init();await ctx.resume();seekResume=true;await seek(audios[0].currentTime>=duration-.05?0:audios[0].currentTime);status('双轨试听中 · 音频内容与同步尚未验收')}catch(e){pause();status('无法播放：'+e.message)}};
async function seek(t){
 const epoch=++seekEpoch;
 t=Math.max(0,Math.min(duration,t));const resume=playing||seekResume;seekResume=resume;playing=false;audios.forEach(a=>a.pause());lastNote=-1;
 try{const done=await seekController.seek(t,resume);if(done&&epoch===seekEpoch){playing=resume;seekResume=false;$('play').textContent=playing?'Ⅱ 暂停':'▶ 播放';render();}}catch(error){if(epoch===seekEpoch){pause();status(error.message)}}
}
function beginScrub(){if(dragging)return;dragging=true;dragResume=playing||seekResume;seekController.cancel();pause();previewTime=audios[0].currentTime;}
function previewScrub(t){previewTime=Math.max(0,Math.min(duration,t));renderFollow(previewTime);$('time').textContent=`${clock(previewTime)} / ${clock(duration)}`;}
function endScrub(){if(!dragging)return;const t=previewTime;dragging=false;previewTime=null;seekResume=dragResume;seek(t);}
$('seek').onpointerdown=beginScrub;
$('seek').oninput=()=>{if(!dragging)beginScrub();previewScrub(Number($('seek').value))};
$('seek').onchange=endScrub;$('seek').onpointerup=endScrub;$('seek').onpointercancel=endScrub;$('seek').onkeyup=endScrub;
$('speed').onchange=()=>audios.forEach(a=>{a.preservesPitch=true;a.playbackRate=Number($('speed').value)});
// A stalled stem must never leave the other stem playing alone.
audios.forEach(a=>a.addEventListener('waiting',()=>{if(playing&&!seekController.busy){pause();status('音轨正在缓冲，已同步暂停；加载完成后请继续播放。')}}));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){pause();status('页面进入后台，已暂停双轨。')}});
function validate(data){if(data.version!==1||!Array.isArray(data.notes)||!data.notes.length)throw Error('需要 version:1 和非空 notes 数组');let prev=-1;for(const n of data.notes){if(![n.start,n.end,n.midi,n.x,n.y,n.w,n.h].every(Number.isFinite)||![1,2].includes(n.page)||n.start<prev||n.end<=n.start||n.start<0||n.midi<0||n.midi>127||n.x<0||n.y<0||n.w<=0||n.h<=0||n.x+n.w>1||n.y+n.h>1)throw Error('标注时间、音高或页面坐标无效');prev=n.start}return data.notes}
$('mapFile').onchange=async()=>{try{const f=$('mapFile').files[0];if(!f)return;const parsed=validate(JSON.parse(await f.text()));events=parsed;document.querySelectorAll('.notes').forEach(e=>e.replaceChildren());events.forEach((n,i)=>{const b=document.createElement('button');b.className='note';b.style.cssText=`left:${n.x*100}%;top:${n.y*100}%;width:${n.w*100}%;height:${n.h*100}%`;b.setAttribute('aria-label',`跳转到 ${clock(n.start)}，音高 ${n.midi}`);b.onclick=()=>{if(!duration){status('请先加载双轨音频');return}seek(n.start)};b.dataset.index=i;document.querySelector(`[data-page="${n.page}"] .notes`).append(b)});$('mapStatus').textContent=`已载入 ${events.length} 个音符标注 · 内容待核验`;$('contourEmpty').hidden=true;draw();lastNote=-1;}catch(e){status('标注未加载：'+e.message)}};
function draw(){const pitched=events.filter(n=>!n.rest&&!n.holding&&n.midi>0);if(!pitched.length){$('contour').replaceChildren();return}const max=events.at(-1)?.end||1,lo=Math.min(...pitched.map(n=>n.midi))-2,hi=Math.max(...pitched.map(n=>n.midi))+2;const points=pitched.map(n=>`${n.start/max*1000},${55-(n.midi-lo)/(hi-lo)*50}`).join(' ');$('contour').innerHTML=`<polyline points="${points}" fill="none" stroke="#4e8b71" stroke-width="2"/><line id="cursor" x1="0" x2="0" y1="0" y2="60" stroke="#153e32" stroke-width="3"/>`;}
function scrub(e){if((!events.length&&!pitchCandidates.length)||!duration)return;const r=$('contour').getBoundingClientRect();previewScrub((e.clientX-r.left)/r.width*(events.at(-1)?.end||duration))}
$('contour').onpointerdown=e=>{$('contour').setPointerCapture(e.pointerId);beginScrub();scrub(e)};$('contour').onpointermove=e=>{if($('contour').hasPointerCapture(e.pointerId))scrub(e)};
$('contour').onpointerup=endScrub;$('contour').onpointercancel=endScrub;
function render(){if(manualEditorOpen){manualEditorRender(audios[0].currentTime||0);return}if(dragging){renderFollow(previewTime||0);return}const t=audios[0].currentTime||0;renderFollow(t);$('time').textContent=`${clock(t)} / ${clock(duration)}`;$('seek').value=t;let idx=events.findIndex(n=>t>=n.start&&t<n.end);const manual=ManualPath.positionAt(activeManual,t);if(manual){idx=events.findIndex(n=>!n.holding&&n.page===manual.page&&manual.x>=n.x&&manual.x<=n.x+n.w&&Math.abs((n.followY??n.y)-manual.y)<manual.h);}if(idx!==lastNote){for(const index of [lastNote,lastNote+1])if(index>=0)document.querySelector(`.note[data-index="${index}"]`)?.classList.remove('active','next');if(idx>=0){document.querySelector(`.note[data-index="${idx}"]`)?.classList.add('active');document.querySelector(`.note[data-index="${idx+1}"]`)?.classList.add('next');}if(false){const next=events[Math.min(idx+1,events.length-1)];const p=document.querySelector(`[data-page="${next.page}"]`);const y=p.getBoundingClientRect().top+next.y*p.clientHeight;if(y>innerHeight-260||y<120)window.scrollTo({top:Math.max(0,scrollY+y-innerHeight*.3),behavior:'smooth'})}lastNote=idx}const cursor=$('cursor');if(cursor){const x=t/events.at(-1).end*1000;cursor.setAttribute('x1',x);cursor.setAttribute('x2',x)}}
setInterval(()=>{if(playing){if(audios[0].currentTime>=duration){pause();return}const drift=audios[1].currentTime-audios[0].currentTime,rate=Number($('speed').value);if(!seekController.busy){if(Math.abs(drift)>.4){seek(audios[0].currentTime);return}/* Playback rate changes only when the teacher selects a speed. */}}render()},250);
function animationFrame(){if(playing||dragging)render();requestAnimationFrame(animationFrame)}requestAnimationFrame(animationFrame);
// Built-in stems share the untouched MV timeline. No automatic playback.
// The library selects the initial song; do not download the built-in tracks first.
$('reference').addEventListener('play',pause);
const oldPlay=$('play').onclick;
$('play').onclick=async()=>{$('reference').pause();await oldPlay()};
fetch('assets/pitch-candidates.json').then(r=>{if(!r.ok)throw Error('missing');return r.json()}).then(data=>{
 pitchCandidates=data.points;
 if(events.length||!pitchCandidates.length)return;
 const max=269.420476,lo=40,hi=90;
 const points=pitchCandidates.filter(p=>p[1]>=lo&&p[1]<=hi).map(p=>`${p[0]/max*1000},${55-(p[1]-lo)/(hi-lo)*50}`).join(' ');
 $('contour').innerHTML=`<polyline points="${points}" fill="none" stroke="#7b9c87" stroke-width="1.2"/>`;
 $('contourEmpty').textContent='自动识别人声音高 · 未逐音核对，可拖动定位音频';
}).catch(()=>{});
