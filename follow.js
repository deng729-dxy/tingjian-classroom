// Positions are derived only from timed score annotations, never total song duration.
(function(scope){
function positionAt(notes,time){
 const i=notes.findIndex(n=>time>=n.start&&time<n.end);
 if(i<0)return null;
 const a=notes[i],b=notes[i+1],progress=(time-a.start)/(a.end-a.start);
 const sameLine=b&&b.page===a.page&&Math.abs(b.y-a.y)<Math.max(a.h,b.h)*.7&&b.x>a.x&&Math.abs(b.start-a.end)<.05;
 return {page:a.page,x:a.sweep?a.x+a.w*progress:a.x+a.w/2+(sameLine?(b.x+b.w/2-a.x-a.w/2)*progress:0),y:a.y,h:a.h,index:i};
}
scope.scorePositionAt=positionAt;
if(typeof module!=='undefined')module.exports={positionAt};
})(typeof window!=='undefined'?window:globalThis);
