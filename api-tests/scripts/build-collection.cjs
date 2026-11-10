const fs=require('node:fs');
const path=require('node:path');
const YAML=require('yaml');
const ExcelJS=require('../../backend/node_modules/exceljs');
const cases=require('./cases.cjs');
const root=path.resolve(__dirname,'../OLMS Backend');
function write(name,value){fs.writeFileSync(path.join(root,name),YAML.stringify(value,{lineWidth:0}));}
async function ensureFixtures(){
  const fixturesDir=path.join(root,'fixtures');
  fs.mkdirSync(fixturesDir,{recursive:true});
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('Participants');
  ws.addRow(['student_code','full_name','email']);
  ws.addRow(['BRU_IMP_01','Bruno Imported Student','bru_imp_01@example.invalid']);
  ws.addRow(['BRU_IMP_BAD','','']);
  await wb.xlsx.writeFile(path.join(fixturesDir,'participants.xlsx'));
}
function splitStatements(code){
  if(!code)return [];
  const trimmed=code.trim();
  if(trimmed.includes('\n'))return [trimmed];
  const out=[];let cur='',quote=null,esc=false,paren=0,brace=0,bracket=0;
  for(const ch of trimmed){
    cur+=ch;
    if(esc){esc=false;continue;}
    if(quote){if(ch==='\\')esc=true;else if(ch===quote)quote=null;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='(')paren++;else if(ch===')'&&paren>0)paren--;
    else if(ch==='{')brace++;else if(ch==='}'&&brace>0)brace--;
    else if(ch==='[')bracket++;else if(ch===']'&&bracket>0)bracket--;
    else if(ch===';'&&paren===0&&brace===0&&bracket===0){out.push(cur.trim());cur='';}
  }
  if(cur.trim())out.push(cur.trim());
  return out;
}
function indentBlock(code,spaces=2){
  const pad=' '.repeat(spaces);
  return splitStatements(code).join('\n').split('\n').map(line=>line?pad+line:'').join('\n');
}
function captureExpr(capture,capturePath='id',expectedStatus=200){
  if(!capture)return '';
  const chain=capturePath.split('.').map(p=>`?.[${JSON.stringify(p)}]`).join('');
  return [
    `if (res.status === ${expectedStatus}) {`,
    `  const captured = res.body?.data${chain};`,
    `  if (captured) {`,
    `    bru.setVar(${JSON.stringify(capture)}, captured);`,
    `  }`,
    `}`
  ].join('\n');
}
async function build(){
  await ensureFixtures();
  write('opencollection.yml',{opencollection:'1.0.0',info:{name:'OLMS Backend'},request:{auth:{type:'bearer',token:'{{token}}'}},bundled:false,extensions:{bruno:{ignore:['node_modules','.git','API.yml'],scripts:{flow:'sequential'}}}});
  fs.mkdirSync(path.join(root,'environments'),{recursive:true});
  const names={base_url:'BASE_URL',root_url:'ROOT_URL',run_id:'RUN_ID',single_choice_type_id:'SINGLE_CHOICE_TYPE_ID',archive_ready_exam_id:'ARCHIVE_READY_EXAM_ID',opens_at:'OPENS_AT',closes_at:'CLOSES_AT',api_user_password:'API_USER_PASSWORD',api_user_new_password:'API_USER_NEW_PASSWORD'};
  for(const role of ['admin','teacher','other_teacher','student'])for(const field of ['username','password'])names[role+'_'+field]=(role+'_'+field).toUpperCase();
  write('environments/Local.yml',{name:'Local',variables:Object.entries(names).map(([name,key])=>({name,value:`{{process.env.OLMS_TEST_${key}}}`}))});
  const runtimeKeys=[...new Set(cases.flatMap(item=>[item.capture,item.token,item.flag,...(item.deps||[])]).filter(Boolean))];
  for(const c of cases){
    const reset=c.name==='Health Check'?[
      `const runtimeKeys = [`,
      ...runtimeKeys.map((key,i)=>`  ${JSON.stringify(key)}${i<runtimeKeys.length-1?',':''}`),
      `];`,
      `runtimeKeys.forEach((key) => bru.deleteVar(key));`
    ].join('\n'):'';
    const dependencies=c.deps?.length?[
      `const missing = ${JSON.stringify(c.deps)}.filter((key) => !bru.getVar(key));`,
      `if (missing.length) {`,
      `  bru.runner.skipRequest();`,
      `}`
    ].join('\n'):'';
    const before=[reset,dependencies,c.before].filter(Boolean).join('\n\n');
    const tokenBlock=c.token?[
      `if (res.status === ${c.status} && res.body?.data?.access_token) {`,
      `  bru.setVar(${JSON.stringify(c.token)}, res.body.data.access_token);`,
      `}`
    ].join('\n'):'';
    const flagBlock=c.flag?[
      `if (res.status === ${c.status}) {`,
      `  bru.setVar(${JSON.stringify(c.flag)}, true);`,
      `}`
    ].join('\n'):'';
    const after=[captureExpr(c.capture,c.capturePath||'id',c.status),tokenBlock,flagBlock,c.after].filter(Boolean).join('\n\n');
    const testBlocks=[
      `const body = res.getBody();`,
      [
        `test("HTTP ${c.status} (actual " + res.getStatus() + " " + (body?.code || body?.status || "") + ")", () => {`,
        `  expect(res.getStatus()).to.equal(${c.status});`,
        `});`
      ].join('\n'),
      c.url==='@root/health'?'':[
        `test("response success flag", () => {`,
        `  expect(body.success).to.equal(${c.status<400});`,
        `});`
      ].join('\n'),
      c.check?[
        `test("response contract", () => {`,
        indentBlock(c.check,2),
        `});`
      ].join('\n'):''
    ].filter(Boolean);
    const tests=testBlocks.join('\n\n');
    const scripts=[before?{type:'before-request',code:before}:null,after?{type:'after-response',code:after}:null,{type:'tests',code:tests}].filter(Boolean);
    const http={method:c.method,url:c.url.startsWith('@root')?c.url.replace('@root','{{root_url}}'):'{{base_url}}'+c.url,auth:c.auth==='none'?undefined:c.auth?{type:'bearer',token:`{{${c.auth}}}`}:'inherit'};
    if(c.headers)http.headers=Object.entries(c.headers).map(([name,value])=>({name,value}));
    if(c.body)http.body={type:'json',data:JSON.stringify(c.body,null,2)};
    if(c.multipart)http.body={type:'multipart-form',data:c.multipart};
    write(c.file,{info:{name:c.name,type:'http',seq:c.seq,tags:['olms',c.status>=400?'negative':'positive']},http,runtime:{scripts},settings:{encodeUrl:true,timeout:30000,followRedirects:false},docs:`Expected HTTP ${c.status}. ${c.deps?.length?'Requires runtime variables: '+c.deps.join(', ')+'. ':''}${c.limitation?'Known limitation: '+c.limitation+'. ':''}Run the collection sequentially with Local environment.`});
  }
  // This existing request targets a paid third-party AI API, not an OLMS endpoint.
  // Preserve it for manual use but exclude it from the OLMS collection run.
  const external=path.join(root,'API.yml');
  if(fs.existsSync(external)){const data=YAML.parse(fs.readFileSync(external,'utf8'));data.info.tags=['external','manual'];fs.writeFileSync(external,YAML.stringify(data,{lineWidth:0}));}
  console.log(`Built ${cases.length} Bruno scenarios (OpenCollection YAML with executable scripts/tests).`);
}
module.exports=build;
if(require.main===module)build().catch(e=>{console.error(e);process.exitCode=1;});
