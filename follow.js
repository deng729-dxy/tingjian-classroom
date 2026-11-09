// Positions are derived only from timed score annotations, never total song duration.
(function(scope){
function positionAt(notes,time){
 const i=notes.findIndex(n=>time>=n.start&&time<n.end);
 if(i<0)return null;
 const a=notes[i],b=notes[i+1],progress=(time-a.start)/(a.end-a.start);
 const y=a.followY??a.y,h=a.followH??a.h;
 const sameLine=b&&b.page===a.page&&Math.abs((b.followY??b.y)-y)<Math.max(h,b.followH??b.h)*.7&&b.x>a.x&&Math.abs(b.start-a.end)<.05;
 const localSweep=!a.holding&&(a.kind==='extension'||a.rest)?a.w*.5*progress:0;
 return {page:a.page,x:a.sweep?a.x+a.w*progress:a.x+a.w/2+(sameLine?(b.x+b.w/2-a.x-a.w/2)*progress:localSweep),y,h,index:i};
}
scope.scorePositionAt=positionAt;
function beatPulseAt(grid,time){
 let lo=0,hi=grid.length-1,found=-1;
 while(lo<=hi){const mid=(lo+hi)>>1;if(grid[mid].time<=time){found=mid;lo=mid+1}else hi=mid-1;}
 while(found>=0&&grid[found].isBeat===false)found--;
 if(found<0)return 0;const delta=time-grid[found].time;
 return delta<.18?Math.pow(1-delta/.18,2):0;
}
scope.scoreBeatPulseAt=beatPulseAt;
if(typeof module!=='undefined')module.exports={positionAt,beatPulseAt};
})(typeof window!=='undefined'?window:globalThis);
