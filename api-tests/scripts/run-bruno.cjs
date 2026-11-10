const fs=require('node:fs');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const {setup}=require('./setup-bruno.cjs');
const build=require('./build-collection.cjs');
const cases=require('./cases.cjs');
const generateReport=require('./write-report.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function isReady(root){try{const r=await fetch(root+'/health',{signal:AbortSignal.timeout(1500)});const body=await r.json();return r.ok&&body.service==='olms-backend';}catch{return false;}}
async function main(){
  const ctx=await setup();build();
  const reports=path.join(ctx.TESTS,'reports',ctx.runId);fs.mkdirSync(reports,{recursive:true});
  let server;
  const serverLog=fs.openSync(path.join(reports,'backend.log'),'a');
  try{
    const root=ctx.values.OLMS_TEST_ROOT_URL;
    if(!await isReady(root)){
      if(ctx.options.OLMS_TEST_AUTO_START==='false')throw new Error('Backend is not reachable; start it or enable OLMS_TEST_AUTO_START.');
      const url=new URL(root);
      if(!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Auto-start requires a localhost BASE_URL.');
      server=spawn(process.execPath,['index.js'],{cwd:path.join(ctx.ROOT,'backend'),env:{...process.env,...ctx.backend,NODE_ENV:'test',PORT:url.port||'3301'},stdio:['ignore',serverLog,serverLog],windowsHide:true});
      for(let i=0;i<40&&!await isReady(root);i++)await delay(500);
      if(!await isReady(root))throw new Error('Backend did not become healthy; inspect the private reports backend.log.');
    }
    const cli=path.join(ctx.TESTS,'node_modules/@usebruno/cli/bin/bru.js');
    const output=path.join(reports,'bruno.json');
    const selected=process.argv.slice(2);
    const requests=selected.length?cases.filter(c=>selected.some(v=>c.name===v||c.file===v)):cases;
    if(!requests.length)throw new Error('No matching scenario names.');
    const args=[cli,'run',...requests.map(c=>c.file),'--env','Local','--sandbox','safe','--noproxy','--reporter-json',output,'--reporter-junit',path.join(reports,'junit.xml'),'--reporter-skip-all-headers','--reporter-skip-body'];
    const started=new Date().toISOString();
    console.log(`Running real Bruno CLI 4.3.0: ${requests.length} requests against ${ctx.base}.`);
    const run=spawnSync(process.execPath,args,{cwd:ctx.COLLECTION,env:{...process.env,NO_COLOR:'1'},encoding:'utf8',maxBuffer:20*1024*1024,windowsHide:true});
    const log=(run.stdout||'')+(run.stderr||'');
    fs.writeFileSync(path.join(reports,'cli.log'),log);
    // The reporter omits headers and bodies; no passwords, tokens or existing user data are published.
    const result=generateReport({...ctx,reports,output,started,finished:new Date().toISOString(),exitCode:run.status,selected:requests});
    console.log(log.slice(-4500));
    console.log(`Report written: docs/completed_api.md (${result.summary}).`);
    process.exitCode=run.status||0;
  }finally{
    if(server){server.kill();await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(resolve,3000);});}
    fs.closeSync(serverLog);
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
