const fs=require('node:fs');
const path=require('node:path');
const YAML=require('yaml');
const cases=require('./cases.cjs');
const root=path.resolve(__dirname,'../OLMS Backend');
function write(name,value){fs.writeFileSync(path.join(root,name),YAML.stringify(value,{lineWidth:0}));}
function build(){
  write('opencollection.yml',{opencollection:'1.0.0',info:{name:'OLMS Backend'},request:{auth:{type:'bearer',token:'{{token}}'}},bundled:false,extensions:{bruno:{ignore:['node_modules','.git','API.yml'],scripts:{flow:'sequential'}}}});
  fs.mkdirSync(path.join(root,'environments'),{recursive:true});
  const names={base_url:'BASE_URL',root_url:'ROOT_URL',run_id:'RUN_ID',single_choice_type_id:'SINGLE_CHOICE_TYPE_ID',archive_ready_exam_id:'ARCHIVE_READY_EXAM_ID',opens_at:'OPENS_AT',closes_at:'CLOSES_AT',api_user_password:'API_USER_PASSWORD',api_user_new_password:'API_USER_NEW_PASSWORD'};
  for(const role of ['admin','teacher','other_teacher','student'])for(const field of ['username','password'])names[role+'_'+field]=(role+'_'+field).toUpperCase();
  write('environments/Local.yml',{name:'Local',variables:Object.entries(names).map(([name,key])=>({name,value:`{{process.env.OLMS_TEST_${key}}}`}))});
  for(const c of cases){
    const runtimeKeys=[...new Set(cases.flatMap(item=>[item.capture,item.token,item.flag,...(item.deps||[])]).filter(Boolean))];
    const reset=c.name==='Health Check'?`${JSON.stringify(runtimeKeys)}.forEach(key=>bru.deleteVar(key));`:'';
    const dependencies=c.deps?.length?`const missing=${JSON.stringify(c.deps)}.filter(key=>!bru.getVar(key));\nif(missing.length){bru.runner.skipRequest();}`:'';
    const before=[reset,dependencies,c.before].filter(Boolean).join('\n');
    const after=[c.capture?`if(res.status===${c.status} && res.body?.data?.id)bru.setVar(${JSON.stringify(c.capture)},res.body.data.id);`:'',c.token?`if(res.status===${c.status} && res.body?.data?.access_token)bru.setVar(${JSON.stringify(c.token)},res.body.data.access_token);`:'',c.flag?`if(res.status===${c.status})bru.setVar(${JSON.stringify(c.flag)},true);`:''].filter(Boolean).join('\n');
    const tests=`const body=res.getBody();\ntest("HTTP ${c.status} (actual "+res.getStatus()+" "+(body?.code||body?.status||"")+")",()=>{expect(res.getStatus()).to.equal(${c.status});});\n${c.url==='@root/health'?'':`test("response success flag",()=>expect(body.success).to.equal(${c.status<400}));`}\n${c.check?`test("response contract",()=>{${c.check}});`:''}`;
    const scripts=[before?{type:'before-request',code:before}:null,after?{type:'after-response',code:after}:null,{type:'tests',code:tests}].filter(Boolean);
    const http={method:c.method,url:c.url.startsWith('@root')?c.url.replace('@root','{{root_url}}'):'{{base_url}}'+c.url,auth:c.auth==='none'?undefined:c.auth?{type:'bearer',token:`{{${c.auth}}}`}:'inherit'};
    if(c.body)http.body={type:'json',data:JSON.stringify(c.body,null,2)};
    write(c.file,{info:{name:c.name,type:'http',seq:c.seq,tags:['olms',c.status>=400?'negative':'positive']},http,runtime:{scripts},settings:{encodeUrl:true,timeout:30000,followRedirects:false},docs:`Expected HTTP ${c.status}. ${c.deps?.length?'Requires runtime variables: '+c.deps.join(', ')+'. ':''}${c.limitation?'Known limitation: '+c.limitation+'. ':''}Run the collection sequentially with Local environment.`});
  }
  // This existing request targets a paid third-party AI API, not an OLMS endpoint.
  // Preserve it for manual use but exclude it from the OLMS collection run.
  const external=path.join(root,'API.yml');
  if(fs.existsSync(external)){const data=YAML.parse(fs.readFileSync(external,'utf8'));data.info.tags=['external','manual'];fs.writeFileSync(external,YAML.stringify(data,{lineWidth:0}));}
  console.log(`Built ${cases.length} Bruno scenarios (OpenCollection YAML with executable scripts/tests).`);
}
module.exports=build;
if(require.main===module)build();
