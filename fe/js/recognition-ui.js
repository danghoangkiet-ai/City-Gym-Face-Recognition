import {DemoRecognitionClient,HttpRecognitionClient,validateFeature} from './recognition-client.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
export function setupRecognition({session,authorize,notify,onUnauthorized}) {
  let client, mode, feature = null, previewUrl = null, busy = false, epoch = 0, controller;
  let faces = [], gallery = [], status = null;
  const nav = document.querySelector('nav');
  nav.insertAdjacentHTML('beforeend','<button data-page="recognition" class="nav-item"><span>◎</span> Recognition</button><button data-page="faces" class="nav-item"><span>▣</span> FaceInfo</button><button data-page="terminals" class="nav-item"><span>▦</span> Terminal / gallery</button>');
  $('login-form').querySelector('label').insertAdjacentHTML('beforebegin','<label>Chế độ làm việc<select id="login-mode"><option value="demo">Demo giao diện · không chạy AI</option><option value="api">Backend API · cùng origin</option></select></label>');
  $('login-mode').onchange=()=>{const api=$('login-mode').value==='api';document.querySelector('.demo-note').hidden=api;$('login-form').elements.email.value=api?'':'manager@citygym.local';$('login-form').elements.password.value='';$('login-form').elements.password.placeholder=api?'Nhập mật khẩu Manager':'Nhập mật khẩu demo';$('login-error').textContent='';};
  document.querySelector('.content').insertAdjacentHTML('beforeend',`
    <div id="recognition-context" hidden>
      <div class="connection-banner"><div><strong id="recognition-mode"></strong><span id="recognition-mode-description"></span></div></div>
      <div class="recognition-toolbar"><label>Terminal đang quản trị<select id="recognition-terminal" aria-label="Terminal đang quản trị"></select></label><button id="refresh-recognition" class="secondary">↻ Làm mới dữ liệu</button><button id="reload-terminals" class="text-button">Tải lại terminal</button><span id="recognition-loading" role="status"></span></div>
      <p id="recognition-error" class="error" role="alert"></p>
    </div>
    <section id="page-recognition" class="page" hidden>
      <div class="stats recognition-stats"><article class="stat"><span>Service</span><strong id="service-ready" class="stat-text">—</strong><small id="service-time">Chưa cập nhật</small></article><article class="stat"><span>Workers / đang xử lý / chờ</span><strong id="service-workers" class="stat-text">—</strong><small>Trạng thái tại lần cập nhật cuối</small></article><article class="stat"><span>Embedding active</span><strong id="service-enrolled">—</strong><small>Trong gallery của terminal</small></article></div>
      <div class="recognition-grid"><article class="card"><h2>Ảnh đầu vào</h2><label class="image-picker">Chọn ảnh JPEG / PNG / WebP<input id="recognition-image" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="image-preview"><img id="recognition-preview" alt="Ảnh đầu vào đang chọn" hidden><span id="image-placeholder">Ảnh chỉ giữ trong bộ nhớ trong lúc thao tác.</span></div><p id="image-name" class="help">Tối đa 10 MB · 24 megapixels</p><button id="clear-image" class="text-button">Xóa ảnh và feature</button><label id="demo-scenario-label">Kịch bản mô phỏng (không phân tích ảnh)<select id="demo-scenario"><option value="match">Match với gallery</option><option value="unknown">Không match</option><option value="NO_FACE">NO_FACE</option><option value="MULTIPLE_FACES">MULTIPLE_FACES</option><option value="SERVICE_NOT_READY">Service chưa sẵn sàng</option><option value="FORBIDDEN">Không có quyền</option></select></label></article>
      <article class="card"><h2>Thao tác nhận diện</h2><label>FaceInfo đích (chỉ dùng để enroll / xóa)<select id="recognition-face"></select></label><div class="recognition-actions"><button id="enroll-image" class="primary">Đăng ký khuôn mặt</button><button id="extract-feature" class="secondary">Trích xuất feature</button><button id="identify-image" class="secondary">Nhận diện bằng ảnh</button><button id="identify-feature" class="secondary">Nhận diện bằng feature</button></div><div id="feature-summary" class="feature-summary">Chưa có feature trong bộ nhớ.</div><button id="clear-feature" class="text-button">Xóa feature khỏi bộ nhớ</button><div class="settings-divider"></div><button id="delete-embedding" class="danger">Xóa embedding của FaceInfo</button><p class="help">Thao tác này không xóa hồ sơ hội viên hoặc FaceInfo.</p></article></div>
      <article class="card result-card"><div class="card-heading"><h2>Kết quả thao tác</h2><span id="result-duration" class="muted"></span></div><div id="recognition-result" role="status">Chưa thực hiện thao tác.</div></article>
    </section>
    <section id="page-faces" class="page" hidden><article class="card"><div class="table-toolbar"><input id="face-search" type="search" aria-label="Tìm FaceInfo" placeholder="Tìm tên, mã hoặc FaceInfo ID…"></div><div class="table-scroll"><table><thead><tr><th>FaceInfo</th><th>Mã hội viên</th><th>Trạng thái</th><th>Embedding</th><th>Chi tiết</th></tr></thead><tbody id="face-rows"></tbody></table></div><p id="face-empty" class="empty" hidden>Chưa có FaceInfo thuộc terminal này.</p><p class="help">FaceInfo lấy theo terminal. Hồ sơ hội viên local không tự động trở thành FaceInfo.</p><div id="face-detail" class="detail-panel" hidden></div></article></section>
    <section id="page-terminals" class="page" hidden><article class="card"><h2>Gallery theo terminal</h2><p class="muted">Chỉ hiển thị embedding active trong phạm vi terminal được chọn.</p><div class="table-scroll"><table><thead><tr><th>FaceInfo</th><th>Model</th><th>Pipeline</th><th>Số chiều</th></tr></thead><tbody id="gallery-rows"></tbody></table></div><p id="gallery-empty" class="empty" hidden>Gallery trống. Chọn FaceInfo và enroll để thêm embedding.</p></article></section>`);
  function clearFeature() { feature = null; $('feature-summary').textContent='Chưa có feature trong bộ nhớ.'; controls(); }
  function clearImage() { if(previewUrl) URL.revokeObjectURL(previewUrl); previewUrl=null; $('recognition-image').value=''; $('recognition-preview').removeAttribute('src'); $('recognition-preview').hidden=true; $('image-placeholder').hidden=false; $('image-name').textContent='Tối đa 10 MB · 24 megapixels'; clearFeature(); }
  function controls() {
    const available = Boolean($('recognition-terminal').value && status?.ready && !busy);
    const image = Boolean($('recognition-image').files[0] && previewUrl);
    ['enroll-image','extract-feature','identify-image'].forEach(id=>$(id).disabled=!available || !image || (id==='enroll-image' && !$('recognition-face').value));
    $('identify-feature').disabled=!available || !feature;
    $('delete-embedding').disabled=!available || !gallery.some(f=>f.id===$('recognition-face').value);
    ['recognition-terminal','recognition-face','recognition-image','refresh-recognition','reload-terminals','demo-scenario','clear-image','clear-feature'].forEach(id=>$(id).disabled=busy);
    $('recognition-loading').textContent=busy?'Đang xử lý…':'';
  }
  function render() {
    const overviewStatus=$('page-overview').querySelector('.stat-text');
    overviewStatus.textContent=mode==='demo'?'Mô phỏng':status?.ready?'Sẵn sàng':'Chưa kết nối';
    overviewStatus.nextElementSibling.textContent=mode==='demo'?'Không phân tích ảnh · chỉ kiểm tra giao diện':'YuNet + SFace · Trạng thái từ backend';
    document.querySelector('.module-status:last-child>span:last-child').textContent=mode==='demo'?'Mô phỏng':status?.ready?'Sẵn sàng':'Chưa kết nối';
    $('service-ready').textContent=status ? (status.ready?'Sẵn sàng':'Chưa sẵn sàng'):'Không xác định';
    $('service-workers').textContent=status?`${status.workerCount} / ${status.active} / ${status.pending}`:'—';
    $('service-enrolled').textContent=status?.enrolledFaces ?? '—';
    const query=$('face-search').value.toLocaleLowerCase('vi');
    const filtered=faces.filter(f=>`${f.id} ${f.fullName} ${f.memberCode}`.toLocaleLowerCase('vi').includes(query));
    $('face-rows').innerHTML=filtered.map(f=>`<tr><td><strong>${esc(f.fullName)}</strong><small class="record-id">${esc(f.id)}</small></td><td>${esc(f.memberCode)}</td><td>${esc(f.status)}</td><td>${gallery.some(g=>g.id===f.id)?'Đã đăng ký':'Chưa đăng ký'}</td><td><button class="text-button" data-face-detail="${esc(f.id)}">Xem</button></td></tr>`).join('');
    $('face-empty').hidden=filtered.length>0;
    $('gallery-rows').innerHTML=gallery.map(f=>`<tr><td>${esc(f.fullName)}<small class="record-id">${esc(f.id)}</small></td><td>${esc(f.model)}</td><td class="pipeline-cell">${esc(f.pipeline)}</td><td>${esc(f.dimension)}</td></tr>`).join('');
    $('gallery-empty').hidden=gallery.length>0; controls();
  }
  async function refresh(signal) {
    const id=$('recognition-terminal').value;
    if(!id) { faces=[];gallery=[];status=null;render();return; }
    const values=await Promise.all([client.status(id,signal),client.faceInfos(id,signal),client.gallery(id,signal)]);
    if(signal.aborted) return;
    [status,faces,gallery]=values;
    const selected=$('recognition-face').value;
    $('recognition-face').innerHTML='<option value="">Chọn FaceInfo đích</option>'+faces.filter(f=>f.status==='active').map(f=>`<option value="${esc(f.id)}">${esc(f.fullName)} · ${esc(f.memberCode)}</option>`).join('');
    if(faces.some(f=>f.id===selected)) $('recognition-face').value=selected;
    $('service-time').textContent=`Cập nhật ${new Date().toLocaleTimeString('vi-VN')}`;
    $('face-detail').hidden=true; render();
  }
  async function run(work) {
    if(busy || !authorize()) return;
    busy=true;controls();$('recognition-error').textContent='';
    const ownEpoch=epoch;controller=new AbortController();
    try { await work(controller.signal); }
    catch(e) {
      if(ownEpoch!==epoch) return;
      $('recognition-error').textContent=`${e.code ?? 'ERROR'}: ${e.message}`;
      if(e.status===401) { onUnauthorized(); return; }
      if(['SERVICE_NOT_READY','NETWORK_ERROR','REQUEST_CANCELLED','INVALID_RESPONSE'].includes(e.code))status=null;
      render();
    } finally { if(ownEpoch===epoch) {busy=false;controls();} }
  }
  function result(title,data,started) {
    const safe={...data};delete safe.vector;
    $('recognition-result').innerHTML=`<strong>${mode==='demo'?'MÔ PHỎNG · ':''}${esc(title)}</strong><pre>${esc(JSON.stringify(safe,null,2))}</pre>`;
    $('result-duration').textContent=`${Math.round(performance.now()-started)} ms`;
  }
  async function action(name) {
    const started=performance.now();
    await run(async signal=>{
      if(name==='extract')clearFeature();
      $('recognition-result').textContent='Đang xử lý…';
      const id=$('recognition-terminal').value;
      const data=name==='feature' ? await client.identifyFeature(id,feature,signal,$('demo-scenario').value) : await client.image(name,{terminalId:id,faceInfoId:$('recognition-face').value,file:$('recognition-image').files[0],scenario:$('demo-scenario').value},signal);
      if(signal.aborted) return;
      if(name==='extract') { feature=validateFeature(data,mode==='demo'); $('feature-summary').textContent=`${mode==='demo'?'Feature giả lập · ':''}${feature.dimension} chiều · ${feature.model} · ${feature.pipeline}`; }
      result(name==='enroll'?'Đã đăng ký embedding':name==='extract'?'Đã trích xuất feature':data.found?'Tìm thấy kết quả phù hợp':'Không tìm thấy kết quả phù hợp',data,started);
      if(name==='enroll') await refresh(signal);
    });
    if($('recognition-error').textContent) $('recognition-result').textContent='Thao tác không hoàn tất. Xem thông báo lỗi phía trên.';
  }
  async function loadTerminals(signal) {
    const terminals=await client.terminals(signal); if(signal.aborted)return;
    const selected=$('recognition-terminal').value;
    $('recognition-terminal').innerHTML=terminals.length?terminals.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} · ${esc(t.id)}</option>`).join(''):'<option value="">Không có terminal được cấp quyền</option>';
    if(terminals.some(t=>t.id===selected))$('recognition-terminal').value=selected;
    clearImage(); await refresh(signal);
  }
  $('refresh-recognition').onclick=()=>run(refresh);
  $('reload-terminals').onclick=()=>run(loadTerminals);
  $('recognition-terminal').onchange=()=>{clearImage();faces=[];gallery=[];status=null;$('recognition-result').textContent='Đã đổi terminal. Chọn ảnh để thao tác.';render();run(refresh);};
  $('recognition-face').onchange=controls;
  $('face-search').oninput=render;
  $('clear-image').onclick=clearImage;$('clear-feature').onclick=clearFeature;
  $('recognition-image').onchange=async()=>{
    clearFeature(); if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;
    $('recognition-preview').hidden=true;$('image-placeholder').hidden=false;
    const file=$('recognition-image').files[0];controls();if(!file)return;
    try {
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024||!file.size)throw new Error('Chọn ảnh JPEG/PNG/WebP có dung lượng tối đa 10 MB.');
      const bitmap=await createImageBitmap(file);const pixels=bitmap.width*bitmap.height;bitmap.close();
      if(pixels>24000000)throw new Error('Ảnh vượt quá 24 megapixels.');
      if($('recognition-image').files[0]!==file)return;
      previewUrl=URL.createObjectURL(file);$('recognition-preview').src=previewUrl;$('recognition-preview').hidden=false;$('image-placeholder').hidden=true;$('image-name').textContent=`${file.name} · ${(file.size/1024).toFixed(0)} KB`;
      $('recognition-error').textContent='';
    }catch(e){if($('recognition-image').files[0]!==file)return;clearImage();$('recognition-error').textContent=e.message;} controls();
  };
  $('enroll-image').onclick=()=>action('enroll');$('extract-feature').onclick=()=>action('extract');$('identify-image').onclick=()=>action('identify');$('identify-feature').onclick=()=>action('feature');
  $('delete-embedding').onclick=()=>{
    const id=$('recognition-face').value;const face=faces.find(f=>f.id===id);
    if(!face||!confirm(`Xóa embedding của ${face.fullName}? Hồ sơ hội viên và FaceInfo vẫn được giữ.`))return;
    run(async signal=>{await client.deleteEmbedding($('recognition-terminal').value,id,signal);if(signal.aborted)return;clearFeature();result('Đã xóa embedding',{faceInfoId:id},performance.now());await refresh(signal);});
  };
  $('face-rows').onclick=event=>{
    const id=event.target.closest('[data-face-detail]')?.dataset.faceDetail;const f=faces.find(f=>f.id===id);if(!f)return;
    $('face-detail').hidden=false;$('face-detail').textContent=JSON.stringify({...f,embedding:gallery.find(g=>g.id===id)??null},null,2);
  };
  return {
    async start() { this.stop();mode=session()?.mode==='api'?'api':'demo';client=mode==='api'?new HttpRecognitionClient():new DemoRecognitionClient();$('recognition-mode').textContent=mode==='demo'?'DEMO GIAO DIỆN · Không chạy AI':'BACKEND API · Dữ liệu từ server';$('recognition-mode-description').textContent=mode==='demo'?'Ảnh không được phân tích. Kết quả theo kịch bản mô phỏng; dữ liệu recognition chỉ tồn tại trong phiên này.':'Các thao tác nhận diện sử dụng API và quyền của tài khoản Manager.';$('demo-scenario-label').hidden=mode!=='demo';await run(loadTerminals); },
    show(name) {$('recognition-context').hidden=!['recognition','faces','terminals'].includes(name);},
    stop() { epoch++;controller?.abort();busy=false;clearImage();faces=[];gallery=[];status=null;$('recognition-terminal').innerHTML='';$('recognition-face').innerHTML='';$('recognition-result').textContent='Chưa thực hiện thao tác.';$('recognition-error').textContent='';$('face-detail').hidden=true;$('face-detail').textContent='';$('result-duration').textContent='';render(); }
  };
}
