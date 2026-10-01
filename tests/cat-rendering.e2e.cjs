const {_electron,expect:baseExpect}=require('@playwright/test');
const esbuild=require('esbuild'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const expect=baseExpect.configure({timeout:10000});

(async()=>{
  const root=path.resolve(__dirname,'..');
  const output=process.env.ORACLE_QA_DIR?path.resolve(process.env.ORACLE_QA_DIR):await fs.mkdtemp(path.join(os.tmpdir(),'oracle-cat-rendering-'));
  await fs.mkdir(output,{recursive:true});
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'oracle-cat-rendering-data-'));
  await fs.writeFile(path.join(data,'oracle-state.json'),JSON.stringify({settings:{alwaysOnTop:false,catAlwaysOnTop:false,catEnabled:true,catIdleEnabled:false,catSize:480}}));
  const bundle=await esbuild.build({entryPoints:[path.join(__dirname,'fixtures/cat-rendering.js')],bundle:true,write:false,
    format:'iife',globalName:'globalThis.__catRenderingQA',platform:'browser',target:'chrome140'});
  const env={...process.env,ORACLE_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;
  let app;const errors=[];
  try{
    // Browser plugin not available. Follow the project's existing Playwright
    // Electron path, using separate settings/history and no external requests.
    app=await _electron.launch({args:[root],env});
    app.on('window',page=>page.on('pageerror',error=>errors.push(error.message)));
    await expect.poll(()=>app.windows().some(page=>page.url().includes('window=cat'))).toBe(true);
    const cat=app.windows().find(page=>page.url().includes('window=cat'));
    await cat.locator('.cat-art').waitFor();
    await expect(cat.getByTestId('cat-companion')).toHaveAttribute('data-ready','true');
    await cat.emulateMedia({reducedMotion:'no-preference'});
    await cat.evaluate(bundle.outputFiles[0].text);
    const result=await cat.evaluate(()=>globalThis.__catRenderingQA.runCatRenderingChecks());
    for(const [name,url] of Object.entries(result.images))await fs.writeFile(path.join(output,name+'.png'),Buffer.from(url.split(',')[1],'base64'));
    delete result.images;
    result.environment={url:cat.url(),title:await cat.title(),browser:'Playwright Electron',data};
    result.pageErrors=errors;
    await fs.writeFile(path.join(output,'cat-rendering-report.json'),JSON.stringify(result,null,2));
    assert.deepEqual(errors,[],'Electron page errors');
    assert.deepEqual(result.failures,[],'rendering regressions; evidence: '+output);
    console.log(JSON.stringify({passed:true,checks:result.checks.length,frames:result.frames,output}));
  }catch(error){
    await fs.writeFile(path.join(output,'cat-rendering-error.txt'),error.stack||String(error));throw error;
  }finally{if(app)await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
