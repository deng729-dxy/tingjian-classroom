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
    this.pending.push(cancel);a.addEventListener('seeked',check);a.addEventListener('canplay',check);a.addEventListener('error',failed);timer=setTimeout(()=>finish(Error('音轨仍在缓冲，请稍后播放')),10000);a.currentTime=time;check();
   })));
   if(serial!==this.serial)return false;
   if(resume)await Promise.all(this.tracks.map(a=>a.play()));return serial===this.serial;
  }finally{if(serial===this.serial)this.busy=false}
 }
}
scope.DualTrackSeek=DualTrackSeek;if(typeof module!=='undefined')module.exports={DualTrackSeek};
})(typeof window!=='undefined'?window:globalThis);
