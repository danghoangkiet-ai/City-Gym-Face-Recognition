let csrfToken = '';
export class ApiError extends Error {
  constructor(code, message, status = 0) { super(message); this.code = code; this.status = status; }
}
export function setCsrf(token = '') { csrfToken = token; }
export async function request(path, {method = 'GET', body, signal} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, {once:true});
  if (signal?.aborted) controller.abort();
  const headers = {'Accept':'application/json'};
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  try {
    const response = await fetch(`/api${path}`, {method,body,headers,credentials:'same-origin',signal:controller.signal});
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(data?.code ?? `HTTP_${response.status}`, data?.message ?? 'Không thể hoàn thành yêu cầu.', response.status);
    if (response.status !== 204 && data === null) throw new ApiError('INVALID_RESPONSE','API không trả JSON hợp lệ.');
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? 'REQUEST_CANCELLED' : 'NETWORK_ERROR', controller.signal.aborted ? 'Yêu cầu đã hủy hoặc quá thời gian 30 giây.' : 'Không kết nối được backend.');
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort',abort); }
}
