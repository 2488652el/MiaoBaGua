// Independently painted parts include the belly that the moving arms uncover.
export const CAT_ARTWORK=Object.freeze({url:'./assets/cat/calico-articulated-parts-v2.png',size:512});
export const CAT_PARTS=Object.freeze({
  body:{source:[16,48,488,436],rect:[194,256,210,188]},
  head:{source:[507,0,479,489],rect:[159,59,245,250]},
  grip:{source:[985,145,380,314],rect:[279,307,103,85]},
  tail:{source:[1394,19,380,466],rect:[120,301,109,134]},
  nearUpper:{source:[141,493,227,394]},nearFore:{source:[580,513,204,363]},
  farUpper:{source:[1000,498,225,381]},farFore:{source:[1472,511,172,354]},
});
let pending;
export function loadCatArtwork(){
  if(!pending)pending=new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);
    image.onerror=()=>{pending=null;reject(new Error('手绘小猫分层素材未能加载'));};image.src=CAT_ARTWORK.url;
  });return pending;
}
export function createPartCanvas(image,name){
  const p=CAT_PARTS[name],canvas=document.createElement('canvas');
  canvas.width=p.source[2];canvas.height=p.source[3];
  canvas.getContext('2d').drawImage(image,...p.source,0,0,canvas.width,canvas.height);return canvas;
}
