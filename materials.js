'use strict';
const materialsDialog=document.createElement('dialog');materialsDialog.className='import-dialog materials-dialog';document.body.append(materialsDialog);
let materialsDraft=null;
function materialsProgress(value,message){const meter=materialsDialog.querySelector('progress'),text=materialsDialog.querySelector('[role="status"]');if(meter)meter.value=value;if(text)text.textContent=message;}
function observeMaterialUpdates(){
 if(materialsDraft?.token){const song=librarySongs.find(s=>s.id===materialsDraft.song.id),revision=song?.replacement;if(revision?.token===materialsDraft.token&&!materialsDraft.uploading){materialsProgress(revision.progress,revision.message+(revision.status==='processing'?'（处理百分比按阶段估算）':''));const close=materialsDialog.querySelector('[data-close]');if(close)close.disabled=false;}}
 const latest=librarySongs.find(s=>s.id===selectedSong?.id);if(latest?.mediaRevision&&latest.mediaRevision!==selectedSong.mediaRevision){loadSong(latest);status('当前曲目的素材已更新，已载入新版；请试听核对动态跟谱。');}
}
async function materialsRequest(path,data){const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Error(result.error||'素材更新失败');return result;}
function openMaterials(song){
 if(!ownerAccess||song.id==='builtin')return;
 materialsDraft={song,files:[],uploading:false,token:null};materialsDialog.replaceChildren();
 const heading=document.createElement('h2');heading.textContent='修改素材 · '+song.title;
 const intro=document.createElement('p');intro.textContent='可只换谱子、只换音频，或一起替换。曲目编号、名称和顺序保留；处理成功后自动同步公开课堂。旧版保留在本机私有备份。';
 const close=document.createElement('button');close.type='button';close.dataset.close='';close.textContent='关闭';close.onclick=()=>materialsDialog.close();
 const meter=document.createElement('progress');meter.max=100;meter.value=0;meter.setAttribute('aria-label','素材更新进度');const message=document.createElement('p');message.setAttribute('role','status');materialsDialog.append(close,heading,intro,meter,message);
 const revision=song.replacement;
 if(revision&&['uploading','processing','promoting'].includes(revision.status)){
  materialsDraft.token=revision.token;materialsProgress(revision.progress,revision.message);
  if(revision.status==='uploading'){const cancel=document.createElement('button');cancel.textContent='取消未完成上传';cancel.onclick=async()=>{cancel.disabled=true;try{await materialsRequest('/api/admin/materials/cancel?token='+revision.token,{});await refreshLibrary();openMaterials(librarySongs.find(s=>s.id===song.id)||song)}catch(error){materialsProgress(0,error.message);cancel.disabled=false}};materialsDialog.append(cancel)}
  materialsDialog.showModal();return;
 }
 const form=document.createElement('form');
 form.innerHTML='<label class="materials-choice"><input type="checkbox" name="replaceScore" checked> 替换谱子</label><section data-score><p>选择完整的新版谱图，将替换这首歌全部旧谱页。可调整顺序，不是追加页。</p><label>新版谱图（1至20张，每张不超过20 MB）<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><ol class="replacement-pages"></ol></section><label class="materials-choice"><input type="checkbox" name="replaceAudio"> 替换音频 / MV</label><section data-audio hidden><label>新版音频或视频（不超过500 MB）<input name="media" type="file" accept="audio/*,video/*,.mp4,.mp3,.wav,.m4a,.flac,.aac,.mov,.mkv,.webm"></label><p>将重新生成伴奏、真人导唱及歌词时间。请上传完整录音；不能用单独伴奏代替含人声的MV来生成真人导唱。</p></section><p class="hint">只换谱子会复用原音轨。新版谱面和录音会重新对齐；自动识别仍可能需要核对，不表示逐音准确性已验收。</p><button type="submit">保存并重新对齐</button>';
 materialsDialog.append(form);const score=form.elements.replaceScore,audio=form.elements.replaceAudio,photos=form.elements.photos;
 const draft=materialsDraft;
 function renderPages(){const list=form.querySelector('ol');list.replaceChildren();draft.files.forEach((file,index)=>{const item=document.createElement('li'),name=document.createElement('span');name.textContent=`第${index+1}页 · ${file.name}`;item.append(name);for(const [text,offset] of [['上移',-1],['下移',1],['移除',0]]){const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',text+'第'+(index+1)+'页');button.disabled=offset===-1&&index===0||offset===1&&index===draft.files.length-1;button.onclick=()=>{if(offset===0)draft.files.splice(index,1);else [draft.files[index],draft.files[index+offset]]=[draft.files[index+offset],draft.files[index]];renderPages()};item.append(button)}list.append(item)})}
 photos.onchange=()=>{draft.files=Array.from(photos.files);renderPages()};score.onchange=()=>form.querySelector('[data-score]').hidden=!score.checked;audio.onchange=()=>form.querySelector('[data-audio]').hidden=!audio.checked;
 form.onsubmit=async event=>{
  event.preventDefault();const replaceScore=score.checked,replaceAudio=audio.checked,media=form.elements.media.files[0],files=replaceScore?draft.files:[];
  if(!replaceScore&&!replaceAudio){materialsProgress(0,'请至少选择替换一种素材');return}
  if(replaceScore&&(!files.length||files.length>20||files.some(file=>file.size>20*1024*1024||!file.size))){materialsProgress(0,'请选择1至20张完整谱图，每张不超过20 MB');return}
  if(replaceAudio&&(!media||!media.size||media.size>500*1024*1024)){materialsProgress(0,'请选择500 MB以内的新版音频或MV');return}
  draft.uploading=true;close.disabled=true;form.querySelectorAll('input,button').forEach(input=>input.disabled=true);
  try{
   const session=await materialsRequest('/api/admin/materials',{id:song.id,replaceScore,replaceAudio,imageCount:files.length});draft.token=session.token;
   const uploads=[...files.map((file,index)=>({file,kind:'score',index:index+1})),...(replaceAudio?[{file:media,kind:'audio',index:0}]:[])],total=uploads.reduce((sum,item)=>sum+item.file.size,0);let sent=0;
   for(const upload of uploads){await uploadWithProgress(`/api/admin/materials/file?token=${session.token}&kind=${upload.kind}&index=${upload.index}`,upload.file,percent=>materialsProgress((sent+upload.file.size*percent/100)/total*100,'上传新版素材 · '+Math.round((sent+upload.file.size*percent/100)/total*100)+'%'));sent+=upload.file.size;}
   await materialsRequest('/api/admin/materials/start?token='+session.token,{});materialsProgress(1,'上传完成，正在处理新版素材并重新对齐（按阶段估算）；可以关闭此窗口。');form.hidden=true;managementMode='';selection.clear();await refreshLibrary();
  }catch(error){
   materialsProgress(0,error.message+'。原曲目保留。');
   if(draft.token)try{await materialsRequest('/api/admin/materials/cancel?token='+draft.token,{});draft.token=null}catch{}
   form.querySelectorAll('input,button').forEach(input=>input.disabled=false);renderPages();
  }finally{draft.uploading=false;close.disabled=false;}
 };
 materialsProgress(0,'选择要修改的素材，然后保存并重新对齐。');materialsDialog.showModal();
}
materialsDialog.addEventListener('cancel',event=>{if(materialsDraft?.uploading)event.preventDefault()});
