import {login, logout, getSession, loginApi, restoreApiSession, logoutApi} from './auth.js';
import {emptyState, validateState} from './storage.js';
import {LocalManagementClient,HttpManagementClient} from './management-client.js';
import {setupRecognition} from './recognition-ui.js';
const $ = (id) => document.getElementById(id);
let client = new LocalManagementClient();
let state = emptyState();
let storageHealthy = true;
let toastTimer;
const labels = {overview:['Tổng quan','Theo dõi hội viên và không gian quản trị của bạn.'],members:['Hội viên','Quản lý hồ sơ và trạng thái hội viên.'],storage:['Lưu trữ','Sao lưu và khôi phục dữ liệu workspace.'],settings:['Cài đặt','Tùy chỉnh thông tin không gian làm việc.']};
Object.assign(labels,{recognition:['Recognition','Đăng ký và kiểm tra nhận diện khuôn mặt.'],faces:['FaceInfo','Tra cứu hồ sơ nhận diện theo terminal.'],terminals:['Terminal / gallery','Kiểm tra phạm vi nhận diện và embedding active.']});
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = (value) => new Intl.DateTimeFormat('vi-VN').format(new Date(value));
const badge = (m) => `<span class="badge ${m.status === 'paused' ? 'paused' : ''}">${m.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}</span>`;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4500); }
function signedIn() { if (getSession()) return true; showLogin(); toast('Phiên demo đã hết hạn. Vui lòng đăng nhập lại.'); return false; }
function showLogin() { recognition.stop(); $('workspace').hidden = true; $('login-view').hidden = false; $('member-dialog').close(); }
const recognition=setupRecognition({session:getSession,authorize:signedIn,notify:toast,onUnauthorized:()=>{logout();showLogin();toast('Phiên API hết hạn. Vui lòng đăng nhập lại.');}});
async function openWorkspace() {
  const api=getSession()?.mode==='api';
  client=api?new HttpManagementClient():new LocalManagementClient();
  try { state = await client.getData(); storageHealthy = true; }
  catch(error) { if(api && error.status===401){logout();showLogin();throw error;} toast(api?'Không tải được workspace từ API. Hãy đăng nhập lại để thử lại.':'Không thể đọc dữ liệu local. Vào Lưu trữ để nhập bản sao hoặc xóa dữ liệu lỗi.'); state = emptyState(); storageHealthy = false; }
  $('login-view').hidden = true; $('workspace').hidden = false; render();
  document.querySelector('.connection-banner strong').textContent=api?'Workspace kết nối qua Backend API':'Workspace demo · Dữ liệu mô phỏng';
  document.querySelector('.connection-banner div>span').textContent=api?'Dữ liệu quản trị và nhận diện được tải từ server.':'Hồ sơ lưu local. Recognition dùng kịch bản giả lập, không phân tích ảnh.';
  document.querySelector('.connection-banner>.pill').textContent=api?'BACKEND API':'LOCAL DEMO';
  document.querySelector('.profile small').textContent=api?'Quản trị viên · API':'Quản trị viên · Demo';
  document.querySelector('.local-badge').lastChild.textContent=api?' Backend API':' Local workspace';
  document.querySelector('.sidebar-bottom p').textContent=api?'Phiên Manager được xác thực bởi server.':'Hồ sơ lưu local. AI chỉ mô phỏng giao diện.';
  document.querySelector('[data-page="storage"]').hidden=api;
  $('page-settings').querySelector('.pill').textContent=api?'BACKEND API · /api':'DEMO · ĐỔI CHẾ ĐỘ TẠI MÀN HÌNH ĐĂNG NHẬP';
  $('page-settings').querySelector('p.muted').textContent=api?'Đang sử dụng API cùng origin và phiên Manager từ server.':'Đăng xuất và chọn Backend API để kết nối khi backend sẵn sàng.';
  page('overview'); await recognition.start();
}
async function save(next, recovery = false) {
  if (!signedIn()) throw new Error('Vui lòng đăng nhập.');
  if (!storageHealthy && (!recovery || getSession()?.mode==='api')) throw new Error('Dữ liệu chưa tải được. Hãy tải lại phiên trước khi thay đổi.');
  try { state = await client.saveData(next); storageHealthy = true; render(); }
  catch (error) { if(error.status===401){logout();showLogin();} throw new Error(`Không thể lưu: ${error.message}`); }
}
function page(name) {
  if (!signedIn() || !labels[name]) return;
  document.querySelectorAll('.page').forEach(el => el.hidden = el.id !== `page-${name}`);
  document.querySelectorAll('.nav-item').forEach(el => { el.classList.toggle('active', el.dataset.page === name); el.setAttribute('aria-current', el.dataset.page === name ? 'page' : 'false'); });
  $('page-title').textContent = labels[name][0]; $('breadcrumb').textContent = labels[name][0]; $('page-description').textContent = labels[name][1];
  $('add-member').hidden = !['overview','members'].includes(name);
  recognition.show(name);
  document.querySelector('.content>.connection-banner').hidden=['recognition','faces','terminals'].includes(name);
  if(name==='storage' && getSession()?.mode==='api') { $('page-storage').hidden=true;toast('Nhập/xuất bản sao local chỉ dùng ở chế độ Demo.'); }
}
function render() {
  $('location-label').textContent = `${state.settings.gymName} / ${state.settings.location}`;
  $('total-count').textContent = state.members.length;
  $('active-count').textContent = state.members.filter(m => m.status === 'active').length;
  const recent = [...state.members].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,5);
  $('recent-members').innerHTML = recent.length ? recent.map(m => `<div class="recent-row"><span class="avatar">${escapeHtml(m.name.trim().slice(0,1).toUpperCase())}</span><div><strong>${escapeHtml(m.name)}</strong><small>${escapeHtml(m.code)}</small></div>${badge(m)}</div>`).join('') : '<div class="empty"><span class="empty-symbol">♙</span>Chưa có hội viên nào.<br>Tạo hồ sơ đầu tiên để bắt đầu quản lý.</div>';
  $('storage-size').textContent = `${(new Blob([JSON.stringify(state)]).size / 1024).toFixed(1)} KB`;
  $('settings-form').elements.gymName.value = state.settings.gymName;
  $('settings-form').elements.location.value = state.settings.location;
  renderMembers();
}
function renderMembers() {
  const search = $('search').value.trim().toLocaleLowerCase('vi');
  const filter = $('status-filter').value;
  const members = state.members.filter(m => `${m.name} ${m.code}`.toLocaleLowerCase('vi').includes(search) && (filter === 'all' || m.status === filter));
  $('members-body').innerHTML = members.map(m => `<tr><td><strong>${escapeHtml(m.name)}</strong></td><td>${escapeHtml(m.code)}</td><td>${badge(m)}</td><td>${date(m.createdAt)}</td><td><button class="row-action" data-edit="${escapeHtml(m.id)}">Sửa</button><button class="row-action delete" data-delete="${escapeHtml(m.id)}">Xóa</button></td></tr>`).join('');
  $('members-empty').hidden = members.length !== 0;
  $('member-summary').textContent = `${members.length} / ${state.members.length} hội viên`;
}
function editMember(id) {
  if (!signedIn()) return;
  const member = state.members.find(m => m.id === id);
  const form = $('member-form'); form.reset();
  form.elements.id.value = member?.id ?? '';
  form.elements.name.value = member?.name ?? '';
  form.elements.code.value = member?.code ?? '';
  form.elements.status.value = member?.status ?? 'active';
  $('member-dialog-title').textContent = member ? 'Chỉnh sửa hội viên' : 'Thêm hội viên';
  $('member-error').textContent = ''; $('member-dialog').showModal(); form.elements.name.focus();
}
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget;
  const submit=form.querySelector('button[type=submit]');submit.disabled=true;
  try { if($('login-mode').value==='api')await loginApi(form.elements.email.value,form.elements.password.value);else login(form.elements.email.value, form.elements.password.value); form.elements.password.value = ''; $('login-error').textContent = ''; await openWorkspace(); }
  catch (error) { $('login-error').textContent = error.message; }
  finally {submit.disabled=false;}
});
$('logout').onclick = async () => { try { if(getSession()?.mode==='api')await logoutApi();else logout();showLogin(); }catch(e){toast(`Chưa đăng xuất được phiên server: ${e.message}`);} };
document.querySelectorAll('[data-page]').forEach(el => el.onclick = () => page(el.dataset.page));
$('add-member').onclick = $('quick-add').onclick = () => editMember();
$('close-dialog').onclick = $('cancel-dialog').onclick = () => $('member-dialog').close();
$('search').oninput = renderMembers; $('status-filter').onchange = renderMembers;
$('member-form').addEventListener('submit', async event => {
  event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const name = values.name.trim(), code = values.code.trim();
    if (!name || !code) throw new Error('Nhập họ tên và mã hội viên.');
    if (state.members.some(m => m.id !== values.id && m.code.toLowerCase() === code.toLowerCase())) throw new Error('Mã hội viên đã tồn tại.');
    const existing = state.members.find(m => m.id === values.id);
    const member = {id:existing?.id ?? crypto.randomUUID(),name,code,status:values.status,createdAt:existing?.createdAt ?? new Date().toISOString()};
    const members = existing ? state.members.map(m => m.id === member.id ? member : m) : [...state.members,member];
    await save({...state,members}); $('member-dialog').close(); toast('Đã lưu hồ sơ hội viên.');
  } catch (error) { $('member-error').textContent = error.message; }
});
$('members-body').onclick = async event => {
  const edit = event.target.closest('[data-edit]'); if (edit) return editMember(edit.dataset.edit);
  const remove = event.target.closest('[data-delete]');
  if (!remove || !signedIn()) return;
  const member = state.members.find(m => m.id === remove.dataset.delete);
  if (!member || !confirm(`Xóa hồ sơ ${member.name}?`)) return;
  try { await save({...state,members:state.members.filter(m => m.id !== member.id)}); toast('Đã xóa hồ sơ.'); } catch (e) { toast(e.message); }
};
$('settings-form').onsubmit = async event => {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
  try { await save({...state,settings:{gymName:data.gymName.trim(),location:data.location.trim()}}); toast('Đã lưu cài đặt.'); } catch (e) { toast(e.message); }
};
$('export-data').onclick = () => {
  if (!signedIn()) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `citygym-backup-${new Date().toISOString().slice(0,10)}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  toast('Đã xuất bản sao workspace.');
};
$('import-data').onchange = async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file || !signedIn()) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Tệp vượt quá 5 MB.');
    const next = validateState(JSON.parse(await file.text()));
    if (!confirm(`Thay thế dữ liệu hiện tại bằng ${next.members.length} hồ sơ từ bản sao?`)) return;
    await save(next, true); toast('Đã khôi phục dữ liệu.');
  } catch (e) { toast(`Nhập thất bại: ${e.message}`); }
};
$('reset-data').onclick = async () => {
  if (!signedIn() || !confirm('Xóa toàn bộ hồ sơ và cài đặt local? Hãy xuất bản sao trước nếu cần.')) return;
  try { await save(emptyState(), true); toast('Đã xóa dữ liệu workspace.'); } catch(e) { toast(e.message); }
};
window.addEventListener('storage', async event => { if (event.key === 'citygym.management.v1' && getSession() && getSession().mode!=='api') { try {state=await client.getData();storageHealthy=true;render();toast('Hồ sơ đã cập nhật từ tab khác.');}catch{storageHealthy=false;toast('Dữ liệu local bị lỗi.');} } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('workspace').hidden) signedIn(); });
try { if (getSession()) { if(getSession().mode==='api')await restoreApiSession();await openWorkspace(); } } catch(error) {logout();showLogin();$('login-error').textContent=error.message;}
