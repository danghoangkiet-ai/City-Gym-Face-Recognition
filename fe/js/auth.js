import {request, setCsrf} from './api.js';
// Demo sessions are local only; API mode uses a server-owned HttpOnly cookie.
const KEY = 'citygym.demo-session';
export const DEMO_EMAIL = 'manager@citygym.local';
export const DEMO_PASSWORD = 'CityGymDemo!';
export function login(email, password, storage = sessionStorage) {
  if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) throw new Error('Email hoặc mật khẩu demo chưa đúng.');
  const session = {name:'Quản lý City Gym', expiresAt:Date.now() + 8 * 60 * 60 * 1000};
  storage.setItem(KEY, JSON.stringify(session));
  return session;
}
export function getSession(storage = sessionStorage) {
  try {
    const value = JSON.parse(storage.getItem(KEY));
    if (value && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now()) return value;
  } catch { /* Invalid local session is treated as signed out. */ }
  storage.removeItem(KEY); return null;
}
export function logout(storage = sessionStorage) { storage.removeItem(KEY); }
export async function loginApi(email,password) {
  const csrf = await request('/auth/csrf'); setCsrf(csrf.csrfToken);
  const session = await request('/auth/login',{method:'POST',body:{email,password}});
  if (session.role !== 'Manager') throw new Error('Tài khoản không có quyền Manager.');
  if (!Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt)<=Date.now()) throw new Error('API trả thời hạn phiên không hợp lệ.');
  setCsrf(session.csrfToken);
  sessionStorage.setItem(KEY,JSON.stringify({name:session.name,mode:'api',expiresAt:Date.parse(session.expiresAt)}));
}
export async function restoreApiSession() {
  const session = await request('/auth/session');
  if (session.role !== 'Manager') throw new Error('Tài khoản không có quyền Manager.');
  if (!Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt)<=Date.now()) throw new Error('Phiên API đã hết hạn.');
  setCsrf(session.csrfToken);
  sessionStorage.setItem(KEY,JSON.stringify({name:session.name,mode:'api',expiresAt:Date.parse(session.expiresAt)}));
}
export async function logoutApi() { await request('/auth/logout',{method:'POST'}); setCsrf(); logout(); }
