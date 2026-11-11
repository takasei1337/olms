const fs = require('node:fs');
const path = require('node:path');
const {randomBytes, randomUUID} = require('node:crypto');
const dotenv = require('../../backend/node_modules/dotenv');
const bcrypt = require('../../backend/node_modules/bcrypt');
const {createClient} = require('../../backend/node_modules/@supabase/supabase-js');
const ROOT = path.resolve(__dirname, '../..');
const TESTS = path.join(ROOT, 'api-tests');
const COLLECTION = path.join(TESTS, 'OLMS Backend');
function config(file) { return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {}; }
function setDotEnv(file, values) {
  let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  for (const [name,value] of Object.entries(values)) {
    const line = `${name}=${JSON.stringify(String(value))}`;
    const regex = new RegExp(`^${name}=.*$`, 'm');
    content = regex.test(content) ? content.replace(regex,line) : content.trimEnd()+'\n'+line+'\n';
  }
  fs.writeFileSync(file,content);
}
async function setup() {
  const backend = config(path.join(ROOT,'backend/.env'));
  const options = {...config(path.join(TESTS,'.env')), ...Object.fromEntries(Object.entries(process.env).filter(([k])=>k.startsWith('OLMS_TEST_')))};
  if (!backend.SUPABASE_URL || !backend.SUPABASE_SERVICE_ROLE_KEY || !backend.JWT_ACCESS_SECRET) throw new Error('Configure backend/.env first (Supabase URL, service key, JWT secret).');
  const db = createClient(backend.SUPABASE_URL,backend.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const stateFile=path.join(TESTS,'.bruno.local.json');
  let state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{accounts:{}};
  for (const role of ['admin','teacher','other_teacher','student']) {
    let account=state.accounts[role];
    if (account) {
      const {data,error}=await db.from('users').select('id,status,username,role').eq('id',account.id).is('deleted_at',null).maybeSingle();
      if (error) throw new Error(`Cannot verify test account: ${error.code}`);
      if (!data || data.status!=='ACTIVE' || data.username!==account.username) account=null;
    }
    if (!account) {
      const suffix=Date.now().toString(36)+randomBytes(2).toString('hex');
      account={id:randomUUID(),username:`olms_bru_${suffix}_${role}`,password:`Bru!9a${randomBytes(16).toString('hex')}`};
      const record={id:account.id,username:account.username,password_hash:await bcrypt.hash(account.password,12),full_name:`Bruno isolated ${role}`,email:`${account.username}@example.invalid`,role:role==='admin'?'ADMIN':role==='student'?'STUDENT':'TEACHER',status:'ACTIVE'};
      const {error}=await db.from('users').insert(record);
      if(error)throw new Error(`Test-account bootstrap failed: ${error.code}`);
      state.accounts[role]=account;
      fs.writeFileSync(stateFile,JSON.stringify(state,null,2)+'\n');
    }
  }
  const {data:types,error}=await db.from('question_types').select('id,code').is('deleted_at',null);
  if(error)throw new Error(`Cannot read question types: ${error.code}`);
  const single=types.find(t=>t.code==='SINGLE_CHOICE');
  if(!single)throw new Error('SINGLE_CHOICE question type must exist before running this collection.');
  const runId='br'+Date.now().toString(36)+randomBytes(2).toString('hex');
  // Results publishing has no implemented HTTP handler yet. Seed only this
  // isolated precondition; archive itself is exercised by Bruno through HTTP.
  const archiveSubjectId=randomUUID();
  const archiveExamId=randomUUID();
  const {error:archiveSubjectError}=await db.from('subjects').insert({id:archiveSubjectId,code:`${runId}_AR`,name:`Bruno ${runId} archive fixture`,created_by:state.accounts.teacher.id});
  if(archiveSubjectError)throw new Error(`Archive subject fixture failed: ${archiveSubjectError.code}`);
  const {error:archiveExamError}=await db.from('exams').insert({id:archiveExamId,code:`${runId}_ARCHIVE`,name:`Bruno ${runId} results published fixture`,subject_id:archiveSubjectId,status:'RESULT_PUBLISHED',delivery_mode:'ONLINE',total_questions:1,duration_minutes:30,opens_at:new Date(Date.now()-7200000).toISOString(),closes_at:new Date(Date.now()-3600000).toISOString(),total_score:1,result_visibility_mode:'HIDDEN',result_published_at:new Date().toISOString(),result_published_by:state.accounts.teacher.id,created_by:state.accounts.teacher.id});
  if(archiveExamError)throw new Error(`Archive exam fixture failed: ${archiveExamError.code}`);

  // Seed an isolated IN_PROGRESS exam whose closes_at has already passed so Bruno can test
  // automatic exam completion + result publishing + student visibility/review flows via HTTP.
  const pubChapterId=randomUUID();
  const pubLessonId=randomUUID();
  const pubQuestionId=randomUUID();
  const pubVersionId=randomUUID();
  const pubExamId=randomUUID();
  const pubRootVarId=randomUUID();
  const pubVar101Id=randomUUID();
  const pubProfileId=randomUUID();
  const pubParticipantId=randomUUID();
  const pubSubmissionId=randomUUID();
  const pastOpen=new Date(Date.now()-7200000).toISOString();
  const pastClose=new Date(Date.now()-60000).toISOString();
  const pubSpec={schema_version:1,kind:'SINGLE_CHOICE',choices:[{id:'0199ac14-a9bc-7001-8000-000000000901',text:'5',order_no:1,is_correct:true},{id:'0199ac14-a9bc-7001-8000-000000000902',text:'6',order_no:2,is_correct:false}]};
  const must = async (label, promise) => {
    const {error} = await promise;
    if (error) throw new Error(`Publish fixture ${label} failed: ${error.message}`);
  };
  await must('chapter', db.from('chapters').insert({id:pubChapterId,subject_id:archiveSubjectId,code:`${runId}_C`,name:'Publish fixture chapter',order_no:1}));
  await must('lesson', db.from('lessons').insert({id:pubLessonId,chapter_id:pubChapterId,code:`${runId}_L`,name:'Publish fixture lesson',order_no:1}));
  await must('question', db.from('questions').insert({id:pubQuestionId,lesson_id:pubLessonId,type_id:single.id,topic_tag:`${runId}_PUB`,status:'ACTIVE',ai_check_status:'CHECKED',ai_similarity_score:0,created_by:state.accounts.teacher.id}));
  await must('question_version', db.from('question_versions').insert({id:pubVersionId,question_id:pubQuestionId,version_no:1,type_id:single.id,difficulty_level:'EASY',content:`Bruno ${runId} publish fixture: 2 + 3?`,explanation:'2 + 3 = 5.',options_snapshot:pubSpec,is_current:true,created_by:state.accounts.teacher.id}));
  await must('exam', db.from('exams').insert({id:pubExamId,code:`${runId}_PUB`,name:`Bruno ${runId} closed exam fixture`,subject_id:archiveSubjectId,status:'DRAFT',delivery_mode:'ONLINE',total_questions:1,duration_minutes:30,opens_at:pastOpen,closes_at:pastClose,total_score:1,result_visibility_mode:'HIDDEN',created_by:state.accounts.teacher.id}));
  await must('matrix', db.from('exam_matrices').insert({exam_id:pubExamId,chapter_id:pubChapterId,lesson_id:pubLessonId,question_type_id:single.id,difficulty_level:'EASY',num_questions:1,score_per_question:1,max_questions_per_topic:1}));
  await must('grading_rules', db.from('exam_grading_rules').insert({exam_id:pubExamId,question_type_id:single.id,scoring_mode:'EXACT_MATCH',allow_negative_marking:false,penalty_for_wrong:false,case_sensitive:false,rounding_precision:2,rounding_rule:'ROUND_HALF_UP'}));
  await must('variants', db.from('exam_variants').insert([{id:pubRootVarId,exam_id:pubExamId,variant_code:'ROOT',is_root:true},{id:pubVar101Id,exam_id:pubExamId,variant_code:'101',is_root:false}]));
  await must('variant_questions', db.from('exam_variant_questions').insert([
    {variant_id:pubRootVarId,question_version_id:pubVersionId,position_in_variant:1,option_order:['0199ac14-a9bc-7001-8000-000000000901','0199ac14-a9bc-7001-8000-000000000902'],score:1},
    {variant_id:pubVar101Id,question_version_id:pubVersionId,position_in_variant:1,option_order:['0199ac14-a9bc-7001-8000-000000000902','0199ac14-a9bc-7001-8000-000000000901'],score:1}
  ]));
  for(const st of ['GENERATED','PUBLISHED','IN_PROGRESS']){
    await must(`transition ${st}`, db.from('exams').update({status:st}).eq('id',pubExamId));
  }
  const pubStudentCode=`${runId}_PUBSV`;
  await must('student_profile', db.from('student_profiles').insert({id:pubProfileId,student_code:pubStudentCode,full_name:'Bruno Publish Student'}));
  await must('participant', db.from('participants').insert({id:pubParticipantId,exam_id:pubExamId,student_user_id:state.accounts.student.id,student_profile_id:pubProfileId,student_code:pubStudentCode,full_name_snapshot:'Bruno Publish Student',variant_id:pubVar101Id,status:'COMPLETED',attendance_status:'PRESENT'}));
  await must('submission', db.from('submissions').insert({id:pubSubmissionId,participant_id:pubParticipantId,exam_id:pubExamId,variant_id:pubVar101Id,source:'ONLINE',started_at:new Date(Date.now()-300000).toISOString(),submitted_at:new Date(Date.now()-120000).toISOString(),submit_token:randomUUID(),status:'SUBMITTED'}));

  const base=options.OLMS_TEST_BASE_URL||'http://127.0.0.1:3301/api/v1';
  const values={OLMS_TEST_BASE_URL:base,OLMS_TEST_ROOT_URL:base.replace(/\/api\/v1\/?$/,''),OLMS_TEST_RUN_ID:runId,OLMS_TEST_SINGLE_CHOICE_TYPE_ID:single.id,OLMS_TEST_ARCHIVE_READY_EXAM_ID:archiveExamId,OLMS_TEST_PUBLISH_READY_EXAM_ID:pubExamId,OLMS_TEST_ALREADY_OPEN_AT:new Date(Date.now()-60000).toISOString(),OLMS_TEST_OPENS_AT:new Date(Date.now()+86400000).toISOString(),OLMS_TEST_CLOSES_AT:new Date(Date.now()+90000000).toISOString(),OLMS_TEST_API_USER_PASSWORD:`Test!7a${randomBytes(12).toString('hex')}`,OLMS_TEST_API_USER_NEW_PASSWORD:`New!8b${randomBytes(12).toString('hex')}`};
  for(const [role,account] of Object.entries(state.accounts)) {
    values[`OLMS_TEST_${role.toUpperCase()}_USERNAME`]=account.username;
    values[`OLMS_TEST_${role.toUpperCase()}_PASSWORD`]=account.password;
  }
  setDotEnv(path.join(COLLECTION,'.env'),values);
  console.log(`Bruno setup ready: ${runId}; 4 isolated accounts; no existing business records changed.`);
  return {ROOT,TESTS,COLLECTION,backend,options,values,state,runId,base};
}
module.exports={setup,ROOT,TESTS,COLLECTION};
if(require.main===module)setup().catch(e=>{console.error(e.message);process.exitCode=1;});
