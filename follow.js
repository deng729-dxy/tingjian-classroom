// Positions are derived only from timed score annotations, never total song duration.
(function(scope){
function positionAt(notes,time){
 const i=notes.findIndex(n=>time>=n.start&&time<n.end);
 if(i<0)return null;
 const a=notes[i],b=notes[i+1],progress=(time-a.start)/(a.end-a.start);
 const y=a.followY??a.y,h=a.followH??a.h;
 const sameLine=!a.holding&&b&&!b.holding&&b.page===a.page&&Math.abs((b.followY??b.y)-y)<Math.max(h,b.followH??b.h)*.7&&b.x>a.x&&Math.abs(b.start-a.end)<.05;
 const localSweep=!a.holding?a.w*.5*progress:0;
 return {page:a.page,x:a.sweep?a.x+a.w*progress:a.x+a.w/2+(sameLine?(b.x+b.w/2-a.x-a.w/2)*progress:localSweep),y,h,index:i};
}
function sweepStart(notes,position){
 const {page,y,h,index,x}=position;
 const sameRow=note=>note.page===page&&!note.holding&&Math.abs((note.followY??note.y)-y)<Math.max(h,note.followH??note.h)*.7;
 if(index<0){
  // Manual paths supply the active row and time. Find its printed left edge.
  const candidates=notes.filter(sameRow);
  return candidates.length?Math.min(x,...candidates.map(note=>note.x)):x;
 }
 let first=index;
 while(first>0&&sameRow(notes[first-1])&&notes[first].x>=notes[first-1].x)first--;
 return Math.min(x,notes[first].x);
}
scope.scoreSweepStart=sweepStart;
scope.scorePositionAt=positionAt;
function beatPulseAt(grid,time){
 let lo=0,hi=grid.length-1,found=-1;
 while(lo<=hi){const mid=(lo+hi)>>1;if(grid[mid].time<=time){found=mid;lo=mid+1}else hi=mid-1;}
 while(found>=0&&grid[found].isBeat===false)found--;
 if(found<0)return 0;const delta=time-grid[found].time;
 return delta<.18?Math.pow(1-delta/.18,2):0;
}
scope.scoreBeatPulseAt=beatPulseAt;
if(typeof module!=='undefined')module.exports={positionAt,beatPulseAt,sweepStart};
})(typeof window!=='undefined'?window:globalThis);
