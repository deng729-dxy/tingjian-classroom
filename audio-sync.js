(function(scope){
class DualTrackSeek {
 constructor(tracks){this.tracks=tracks;this.serial=0;this.busy=false;this.pending=[]}
 cancel(){this.serial++;this.pending.splice(0).forEach(fn=>fn());this.busy=false}
 async seek(time,resume){
  this.cancel();const serial=this.serial;this.busy=true;this.tracks.forEach(a=>a.pause());
  try{
   await Promise.all(this.tracks.map(a=>new Promise((resolve,reject)=>{
    let timer;const finish=error=>{clearTimeout(timer);a.removeEventListener('seeked',check);a.removeEventListener('canplay',check);a.removeEventListener('error',failed);this.pending=this.pending.filter(f=>f!==cancel);error?reject(error):resolve()};
    const check=()=>{if(!a.seeking&&a.readyState>=2&&Math.abs(a.currentTime-time)<.15)finish()};const failed=()=>finish(Error('音轨定位失败'));const cancel=()=>finish();
    this.pending.push(cancel);a.addEventListener('seeked',check);a.addEventListener('canplay',check);a.addEventListener('error',failed);timer=setTimeout(()=>finish(Error('音轨仍在缓冲，请稍后播放')),10000);
    // Reassigning the position even at 0 can restart the browser's range request.
    if(a.seeking||Math.abs(a.currentTime-time)>.001)a.currentTime=time;
    check();
   })));
   if(serial!==this.serial)return false;
   if(resume)await Promise.all(this.tracks.map(a=>a.play()));return serial===this.serial;
  }finally{if(serial===this.serial)this.busy=false}
 }
}
// Buffered time coverage is distinct from readiness at the playback position.
function bufferSnapshot(audio,expected){
 const pending=!!(expected&&audio.currentSrc&&audio.currentSrc!==expected);
 const duration=audio.duration,known=!pending&&Number.isFinite(duration)&&duration>0,ranges=[];
 if(known)for(let i=0;i<audio.buffered.length;i++){
  const start=Math.max(0,audio.buffered.start(i)),end=Math.min(duration,audio.buffered.end(i));
  if(end>start)ranges.push([start,end]);
 }
 ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
 for(const range of ranges){const last=merged[merged.length-1];if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push(range.slice())}
 const seconds=merged.reduce((sum,r)=>sum+r[1]-r[0],0);
 const percent=known?(seconds>=duration-.02?100:Math.min(99,Math.floor(seconds/duration*100))):null;
 return {percent,seconds,error:!pending&&!!audio.error,ready:!pending&&!audio.error&&!audio.seeking&&audio.readyState>=3};
}
class AudioBufferProgress{
 constructor(tracks,root){
  this.tracks=tracks;this.root=root;this.active=false;this.expected=[];this.waiting=new Set();
  this.rows=[...root.querySelectorAll('[data-buffer-track]')];this.message=root.querySelector('[data-buffer-message]');
  tracks.forEach((a,i)=>['loadstart','progress','durationchange','loadedmetadata','loadeddata','canplay','canplaythrough','waiting','stalled','seeking','seeked','error','emptied','playing'].forEach(type=>a.addEventListener(type,()=>{
   if(type==='waiting'||type==='stalled')this.waiting.add(i);
   if(['canplay','canplaythrough','playing','loadstart','emptied'].includes(type))this.waiting.delete(i);
   this.refresh();
  })));
 }
 reset(){this.active=false;this.waiting.clear();this.root.hidden=true;this.expected=[]}
 start(){this.expected=this.tracks.map(a=>a.src);this.waiting.clear();this.active=true;this.refresh()}
 refresh(){
  if(!this.active)return;this.root.hidden=false;
  const states=this.tracks.map((a,i)=>bufferSnapshot(a,this.expected[i]));
  states.forEach((s,i)=>{const row=this.rows[i],bar=row.querySelector('progress'),label=row.querySelector('output');
   if(s.percent===null)bar.removeAttribute('value');else bar.value=s.percent;
   label.textContent=s.error?'读取失败':s.percent===null?'正在连接':s.percent+'%';
  });
  const ready=states.every((s,i)=>s.ready&&!this.waiting.has(i));
  this.message.textContent=states.some(s=>s.error)?'音频读取失败，请重选曲目或检查网络':this.tracks.some(a=>a.seeking)?'正在定位，等待两条音轨就绪':ready?'当前位置已就绪，可以播放 · 可边缓冲边播放':'音轨正在缓冲，请稍候 · 按已缓冲时长显示';
 }
}
scope.DualTrackSeek=DualTrackSeek;scope.AudioBufferProgress=AudioBufferProgress;
if(typeof module!=='undefined')module.exports={DualTrackSeek,bufferSnapshot,AudioBufferProgress};
})(typeof window!=='undefined'?window:globalThis);
