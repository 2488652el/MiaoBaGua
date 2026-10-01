const {_electron}=require('@playwright/test'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'cat-canvas-diag-'));
  const env={...process.env,ORACLE_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({args:[path.resolve(__dirname,'..')],env});
  try{
    let cat;for(let i=0;i<40&&!cat;i++){cat=app.windows().find(p=>p.url().includes('window=cat'));if(!cat)await new Promise(r=>setTimeout(r,100));}
    await cat.waitForSelector('[data-ready="true"]');await cat.emulateMedia({reducedMotion:'reduce'});
    const samples=[];
    for(let i=0;i<6;i++){
      samples.push(await cat.evaluate(()=>{
        const c=document.querySelector('.cat-art'),gl=c.getContext('webgl2'),p=new Uint8Array(c.width*c.height*4);
        gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);
        let hash=2166136261;for(let n=0;n<p.length;n+=7)hash=Math.imul(hash^p[n],16777619);
        return {hash:hash>>>0,width:c.width,data:{...document.querySelector('.cat-companion').dataset},reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
      }));await cat.waitForTimeout(180);
    }console.log(JSON.stringify(samples,null,2));
  }finally{await app.close();}
})();
