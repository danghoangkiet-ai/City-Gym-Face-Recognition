export const KEY = 'citygym.management.v1';
export const emptyState = () => ({version:1, members:[], settings:{gymName:'City Gym', location:'Chi nhánh trung tâm'}});
export function validateState(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.members) || state.members.length > 10000) throw new Error('Tệp dữ liệu không đúng định dạng.');
  const ids = new Set(), codes = new Set();
  for (const m of state.members) {
    if (!m || typeof m.id !== 'string' || !m.id || m.id.length > 100 || ids.has(m.id) || typeof m.name !== 'string' || !m.name.trim() || m.name.length > 100 || typeof m.code !== 'string' || !m.code.trim() || m.code.length > 40 || codes.has(m.code.toLowerCase()) || !['active','paused'].includes(m.status) || typeof m.createdAt !== 'string' || !Number.isFinite(Date.parse(m.createdAt))) throw new Error('Hồ sơ không hợp lệ hoặc trùng mã hội viên.');
    ids.add(m.id); codes.add(m.code.toLowerCase());
  }
  if (!state.settings || typeof state.settings.gymName !== 'string' || !state.settings.gymName.trim() || state.settings.gymName.length > 100 || typeof state.settings.location !== 'string' || state.settings.location.length > 100) throw new Error('Cấu hình không hợp lệ.');
  return {version:1, members:state.members.map(({id,name,code,status,createdAt}) => ({id,name,code,status,createdAt})), settings:{gymName:state.settings.gymName,location:state.settings.location}};
}
export function readState(storage = localStorage) {
  const raw = storage.getItem(KEY);
  return raw === null ? emptyState() : validateState(JSON.parse(raw));
}
export function writeState(state, storage = localStorage) {
  const clean = validateState(state);
  storage.setItem(KEY, JSON.stringify(clean));
  return clean;
}
