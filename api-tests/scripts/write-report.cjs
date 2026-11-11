const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const YAML=require('yaml');
const {createHash}=require('node:crypto');
function flatten(raw){
  if(Array.isArray(raw))return raw.flatMap(x=>Array.isArray(x.results)?x.results:[x]);
  if(Array.isArray(raw.results))return raw.results;
  if(Array.isArray(raw.iterations))return raw.iterations.flatMap(x=>x.results||[]);
  return [];
}
function key(method,url){return method.toUpperCase()+' '+url.replace(/\?.*$/,'').replace(/\{\{[^}]+\}\}|\{[^}]+\}|:[A-Za-z0-9_]+/g,'{}');}
function report(ctx){
  if(!fs.existsSync(ctx.output))throw new Error('Bruno did not produce a JSON report. See the private CLI log.');
  const raw=JSON.parse(fs.readFileSync(ctx.output,'utf8'));
  const results=flatten(raw);
  const brunoSummary=Array.isArray(raw)?raw[0]?.summary:raw.summary;
  const rows=ctx.selected.map(c=>{
    const r=results.find(r=>(r.name||r.requestName)===c.name||(r.test?.name===c.name));
    const tests=r?.testResults||[];
    const assertions=r?.assertionResults||[];
    const failed=[...tests,...assertions].filter(t=>t.status==='fail'||t.status==='failed'||t.passed===false);
    const actual=r?.response?.status??r?.response?.statusCode??r?.status;
    const skipped=!r||r.skipped||r.status==='skipped'||r.skipReason;
    const error=r?.error?String(typeof r.error==='string'?r.error:r.error.message||JSON.stringify(r.error)):null;
    const status=skipped?'BLOCKED':actual===c.status&&!failed.length&&!error&&tests.length?'PASS':'FAIL';
    return {name:c.name,method:c.method,path:c.url,expected:c.status,actual:typeof actual==='number'?actual:null,status,assertions:tests.length+assertions.length,failures:failed.map(t=>({name:t.description||t.name||t.testName||'',message:typeof t.error==='string'?t.error:t.error?.message||t.message||''})),error,limitation:c.limitation||null,dependencies:c.deps||[],file:c.file};
  });
  const spec=YAML.parse(fs.readFileSync(path.join(ctx.ROOT,'api-tests/06_OpenAPI_3.0.yaml'),'utf8'));
  const apis=[];
  for(const [p,obj] of Object.entries(spec.paths))for(const [method,op] of Object.entries(obj)){
    if(!['get','post','put','patch','delete'].includes(method)||!['implemented','placeholder'].includes(op['x-implementation']?.status))continue;
    const candidates=rows.filter(r=>key(r.method,r.path.replace('@root',''))===key(method,p));
    const positive=candidates.filter(r=>r.expected<400);
    const positivePass=positive.some(r=>r.status==='PASS');
    const failed=positive.filter(r=>r.status==='FAIL');
    let status=failed.length?'FAIL':positivePass?'PASS':candidates.some(r=>r.status==='PASS')?'PARTIAL':'BLOCKED';
    if(op['x-implementation'].status==='placeholder')status='PLACEHOLDER';
    apis.push({method:method.toUpperCase(),path:p,status,source:op['x-implementation'].source,cases:candidates.map(r=>r.name),positive_pass:positivePass,failures:failed.map(r=>r.name)});
  }
  const counts=Object.fromEntries(['PASS','FAIL','BLOCKED'].map(s=>[s,rows.filter(r=>r.status===s).length]));
  const apiCounts=Object.fromEntries(['PASS','FAIL','PARTIAL','BLOCKED','PLACEHOLDER'].map(s=>[s,apis.filter(r=>r.status===s).length]));
  const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:ctx.ROOT,encoding:'utf8'}).trim();
  const findings=[];
  const archiveChecks=['Reject Archive Before Results','Archive Exam','Reject Repeated Archive'];
  const archiveFixed=archiveChecks.every(name=>rows.some(r=>r.name===name&&r.status==='PASS'));
  const fixes=archiveFixed?[{id:'BRUNO-01',status:'FIXED',rule:'Only RESULT_PUBLISHED can transition to ARCHIVED.',regression:'ENDED returns 409 INVALID_EXAM_STATUS before any database write; RESULT_PUBLISHED archives with 200; repeated archive returns 409.',fixture:'The RESULT_PUBLISHED exam is an isolated database seed, not evidence that the results publishing API is implemented.'}]:[];
  const sourcePaths=['backend/src/services/exams.service.js','backend/package.json','api-tests/scripts/cases.cjs','api-tests/scripts/setup-bruno.cjs','api-tests/scripts/run-bruno.cjs','api-tests/scripts/write-report.cjs'];
  const sourceHashes=Object.fromEntries(sourcePaths.filter(p=>fs.existsSync(path.join(ctx.ROOT,p))).map(p=>[p,createHash('sha256').update(fs.readFileSync(path.join(ctx.ROOT,p))).digest('hex')]));
  const serverLog=path.join(ctx.reports,'backend.log');
  const backendLog=fs.existsSync(serverLog)?fs.readFileSync(serverLog,'utf8'):'';
  if(rows.some(r=>r.name==='Archive Exam'&&r.actual===500)&&backendLog.includes('Invalid exam state transition ENDED -> ARCHIVED'))findings.push({id:'BRUNO-01',api:'POST /api/v1/exams/{examId}/archive',http_status:500,database_code:'P0001',database_message:'Invalid exam state transition ENDED -> ARCHIVED',cause:'archiveExam accepts ENDED or RESULT_PUBLISHED; the SQL state-transition trigger only allows RESULT_PUBLISHED -> ARCHIVED.',service_source:'backend/src/services/exams.service.js',sql_source:'database/schema-pg17/03_indexes_and_fks.sql',recommendation:'Agree on the business rule, then align service and SQL; preserve this failing regression until fixed.'});
  const safe={run_id:ctx.runId,started_at:ctx.started,finished_at:ctx.finished,timezone:'Asia/Ho_Chi_Minh',source_commit:commit,source_worktree_sha256:sourceHashes,bruno_cli:'4.3.0',base_url:ctx.base,backend:'real Express application; existing configured Supabase/PostgreSQL; no mocks',exit_code:ctx.exitCode,bruno_summary:brunoSummary,counts,api_counts:apiCounts,findings,fixes,requests:rows,apis};
  fs.writeFileSync(path.join(ctx.reports,'summary.json'),JSON.stringify(safe,null,2)+'\n');
  fs.writeFileSync(path.join(ctx.TESTS,'reports/latest.json'),JSON.stringify(safe,null,2)+'\n');
  const docs=path.join(ctx.ROOT,'docs');fs.mkdirSync(docs,{recursive:true});
  const evidence=path.join(docs,'verification',`bruno-${ctx.runId}.json`);fs.mkdirSync(path.dirname(evidence),{recursive:true});fs.writeFileSync(evidence,JSON.stringify(safe,null,2)+'\n');
  const esc=s=>String(s??'').replace(/\|/g,'/').replace(/\r?\n/g,' ');
  const time=new Date(ctx.finished).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour12:false});
  let md=`# Báo cáo kiểm thử API OLMS bằng Bruno\n\nThời gian hoàn tất: **${time} (Asia/Saigon)**. Run ID: \`${ctx.runId}\`. Mốc source: \`${commit}\`.\n\n## 1 Môi trường và phạm vi\n\n- Bruno CLI **4.3.0**, OpenCollection YAML, môi trường **Local**; chạy request và assertion thật, không giả lập Bruno bằng script HTTP.\n- Backend Express thật tại \`${ctx.base}\`, kết nối Supabase/PostgreSQL từ backend/.env; không mock service/database/model.\n- Tài khoản ADMIN, TEACHER, TEACHER khác chủ và STUDENT dành riêng cho regression; credentials chỉ lưu trong các file local bị Git ignore.\n- Dữ liệu nghiệp vụ mới mang run_id, ID/token lấy từ response. Không sửa tài khoản hoặc dữ liệu nghiệp vụ có sẵn. Snapshot đề/test fixtures được giữ lại để đối soát, không hard-delete dữ liệu frozen.\n- Phạm vi: **${apis.length} method/path có handler** trong bảng tổng hợp. Request API.yml đến dịch vụ AI ngoài OLMS không thuộc đợt chạy này.\n\n## 2 Kết quả tổng hợp\n\n| Chỉ tiêu | Kết quả |\n| --- | --- |\n| Kịch bản | ${rows.length} |\n| PASS | ${counts.PASS} |\n| FAIL | ${counts.FAIL} |\n| BLOCKED do thiếu tiền điều kiện | ${counts.BLOCKED} |\n| API PASS luồng dương | ${apiCounts.PASS} |\n| API FAIL | ${apiCounts.FAIL} |\n| API PARTIAL chỉ có nhánh âm PASS | ${apiCounts.PARTIAL} |\n| API BLOCKED | ${apiCounts.BLOCKED} |\n\nPASS chỉ xác nhận các assertion đã chạy trong đợt này, không bao phủ toàn bộ NFR, race condition, RLS hoặc mọi dữ liệu đầu vào. FAIL ở kịch bản luồng dương vẫn được giữ, kể cả có nhánh âm PASS. BLOCKED không được tính thành PASS.\n\n## 3 Danh sách API\n\n| Method | Endpoint | Kết quả | Request Bruno và bằng chứng |\n| --- | --- | --- | --- |\n`;
  for(const api of apis){const names=api.cases.map(name=>{const r=rows.find(r=>r.name===name);return `${name}: ${r.status} (${r.actual??'không gửi'}/${r.expected})`;}).join('; ');md+=`| ${api.method} | ${api.path==='/health'?'/health':'/api/v1'+api.path} | **${api.status}** | ${esc(names||'Không có kịch bản khớp')} |\n`;}
  md+='\n## 4 Các kịch bản lỗi hoặc bị chặn\n\n| Kịch bản | Mong đợi | Thực tế | Trạng thái | Chi tiết |\n| --- | --- | --- | --- | --- |\n';
  for(const r of rows.filter(r=>r.status!=='PASS'))md+=`| ${esc(r.name)} | ${r.expected} | ${r.actual??'Không gửi'} | ${r.status} | ${esc(r.error||r.failures.map(f=>f.name+': '+f.message).join('; ')||'Thiếu biến tiền điều kiện: '+r.dependencies.join(', '))} |\n`;
  if(!rows.some(r=>r.status!=='PASS'))md+='\nKhông có kịch bản FAIL hoặc BLOCKED trong lượt chạy này.\n';
  if(brunoSummary)md+=`\nBruno ghi nhận **${brunoSummary.passedTests}/${brunoSummary.totalTests} test assertion PASS**, ${brunoSummary.failedTests} assertion FAIL, ${brunoSummary.skippedRequests} request bị skip.\n`;
  if(archiveFixed)md+='\n### BRUNO-01 Đã sửa lỗi archive\n\nĐồng bộ service với vòng đời chuẩn trong SQL và tài liệu gốc: chỉ RESULT_PUBLISHED → ARCHIVED. Trước đây service nhận ENDED rồi bị trigger từ chối thành HTTP 500. Hiện ENDED trả **409 INVALID_EXAM_STATUS** trước khi ghi database; RESULT_PUBLISHED lưu trữ thành công với **200**; gọi archive lần nữa trả **409**. Cả ba nhánh đã chạy qua Bruno. Không sửa trigger hoặc bỏ qua bước công bố kết quả.\n\nFixture ở trạng thái RESULT_PUBLISHED được setup tạo riêng trong database, không có dữ liệu thí sinh/bài thi thật; nó chỉ chuẩn bị tiền điều kiện cho archive. Điều này không chứng minh API công bố kết quả (vẫn 501) đã được triển khai. Hồi quy archive được kiểm bằng ba request Bruno nêu trên. Bằng chứng JSON ghi SHA-256 mã nguồn trong workspace để phân biệt bản sửa chưa commit với mốc HEAD.\n';
  for(const f of findings)md+=`\n### ${f.id} Lỗi lưu trữ kỳ thi\n\n\`${f.api}\` từ ENDED nhận HTTP 500. Backend log ghi PostgreSQL \`${f.database_code}\`: \`${f.database_message}\`. Service \`${f.service_source}\` (archiveExam) chấp nhận ENDED/RESULT_PUBLISHED, nhưng trigger \`${f.sql_source}\` chỉ có cạnh RESULT_PUBLISHED → ARCHIVED. Cần thống nhất quy tắc rồi đồng bộ service/SQL; không coi lỗi này là PASS hoặc đổi expected status thành 500. Chưa sửa backend trong đợt kiểm thử.\n`;
  md+='\n## 5 Cách kiểm thử lại\n\n```powershell\nnpm --prefix backend ci\nnpm --prefix api-tests ci\nnpm --prefix api-tests test\n```\n\nCấu hình Supabase/JWT ở backend/.env. Tùy chọn runner ở api-tests/.env theo api-tests/.env.example. Lệnh test tự chuẩn bị tài khoản fixture, cập nhật biến .env riêng cho Bruno, dựng collection, mở backend localhost nếu cần, chạy tuần tự, tạo báo cáo và dừng process backend do runner mở. Không dừng server đã có sẵn. Mỗi lần chạy dùng run_id mới.\n\nĐể chạy từ giao diện Bruno: `npm --prefix api-tests run setup`, mở thư mục `api-tests/OLMS Backend`, chọn **Local**, chạy collection theo seq; bật tự lưu/gửi cookie. Base URL, tài khoản, mật khẩu và lịch thi lấy qua process.env từ file .env local, không sửa trực tiếp YAML. Token và ID runtime tự nối qua response.\n\nCó thể chạy CLI trực tiếp từ thư mục collection sau setup:\n\n```powershell\n..\\node_modules\\.bin\\bru.cmd run --env Local --exclude-tags external --reporter-json ..\\reports\\manual.json --reporter-skip-all-headers --reporter-skip-body\n```\n\nChạy trực tiếp cần backend đang mở tại base_url. Runner dùng safe sandbox, không chạy paid external API request. Xem thêm `api-tests/README.md` về các biến và dữ liệu fixture giữ lại.\n\n## 6 Bằng chứng\n\n';
  md+=`- [Kết quả JSON đã lược bỏ dữ liệu nhạy cảm](verification/${path.basename(evidence)}).\n- Bruno JSON/JUnit/log local ở api-tests/reports/${ctx.runId}/; reporter bỏ request/response body và header.\n- Không đưa service key, JWT, cookie hoặc mật khẩu vào báo cáo.\n`;
  fs.writeFileSync(path.join(docs,'completed_api.md'),md);
  return {summary:`${counts.PASS} PASS / ${counts.FAIL} FAIL / ${counts.BLOCKED} BLOCKED`,safe};
}
module.exports=report;
