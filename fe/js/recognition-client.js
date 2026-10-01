import {ApiError, request} from './api.js';
export const MODEL = 'opencv-sface-2021dec';
export const PIPELINE = 'yunet2023mar-similarity5-sface128-v1';
export function validateFeature(feature, demo = false) {
  if (!feature || feature.model !== MODEL || feature.pipeline !== PIPELINE || feature.dimension !== 128 || !Array.isArray(feature.vector) || feature.vector.length !== 128 || feature.vector.some(v => !Number.isFinite(v)) || !feature.vector.some(v => v !== 0) || Boolean(feature.demo) !== demo) throw new ApiError('INCOMPATIBLE_FEATURE','Feature không tương thích với chế độ hoặc pipeline hiện tại.');
  return feature;
}
export class HttpRecognitionClient {
  terminals(signal) { return request('/terminals',{signal}); }
  faceInfos(terminalId,signal) { return request(`/face-infos?terminalId=${encodeURIComponent(terminalId)}`,{signal}); }
  gallery(terminalId,signal) { return request(`/terminals/${encodeURIComponent(terminalId)}/gallery`,{signal}); }
  status(terminalId,signal) { return request(`/face-recognition/status?terminalId=${encodeURIComponent(terminalId)}`,{signal}); }
  image(action,{terminalId,faceInfoId,file},signal) {
    const body = new FormData(); body.append('terminalId',terminalId); body.append('file',file);
    if (action === 'enroll') body.append('faceInfoId',faceInfoId);
    const route = {enroll:'enroll/image',extract:'extract/feature',identify:'identify/image'}[action];
    return request(`/face-recognition/${route}`,{method:'POST',body,signal});
  }
  identifyFeature(terminalId,feature,signal) {
    validateFeature(feature);
    return request('/face-recognition/identify/feature',{method:'POST',body:{terminalId,feature},signal});
  }
  deleteEmbedding(terminalId,faceInfoId,signal) {
    return request(`/face-recognition/embeddings/${encodeURIComponent(faceInfoId)}?terminalId=${encodeURIComponent(terminalId)}&pipeline=${encodeURIComponent(PIPELINE)}`,{method:'DELETE',signal});
  }
}
// Deliberately synthetic fixtures; no image content is analyzed and no biometric data is persisted.
export class DemoRecognitionClient {
  constructor() {
    this.faces = [
      {id:'demo-face-01',memberId:null,fullName:'Hội viên mẫu A',memberCode:'DEMO-01',status:'active'},
      {id:'demo-face-02',memberId:null,fullName:'Hội viên mẫu B',memberCode:'DEMO-02',status:'active'}
    ];
    this.enrolled = new Set(['demo-face-01']);
  }
  async terminals() { return [{id:'demo-terminal-01',name:'Sảnh chính · Demo',status:'active'},{id:'demo-terminal-02',name:'Phòng tập · Gallery trống',status:'active'}]; }
  async faceInfos(id) { this.checkTerminal(id); return id === 'demo-terminal-01' ? structuredClone(this.faces) : []; }
  checkTerminal(id) { if (!['demo-terminal-01','demo-terminal-02'].includes(id)) throw new ApiError('FORBIDDEN','Terminal ngoài phạm vi quản trị.',403); }
  async gallery(id) { return (await this.faceInfos(id)).filter(f => this.enrolled.has(f.id)).map(f => ({...f,model:MODEL,pipeline:PIPELINE,dimension:128})); }
  async status(id) { return {demo:true,ready:true,workerCount:2,active:0,pending:0,enrolledFaces:(await this.gallery(id)).length}; }
  scenario(value) {
    const messages = {NO_FACE:'Không phát hiện khuôn mặt hợp lệ.',MULTIPLE_FACES:'Ảnh có nhiều hơn một khuôn mặt.',SERVICE_NOT_READY:'Recognition service chưa sẵn sàng.',FORBIDDEN:'Bạn không có quyền thực hiện thao tác.'};
    if (messages[value]) throw new ApiError(value,messages[value],value === 'FORBIDDEN' ? 403 : 422);
  }
  async image(action,{terminalId,faceInfoId,scenario = 'match'}) {
    this.checkTerminal(terminalId); this.scenario(scenario);
    if (action === 'enroll') {
      if (!(await this.faceInfos(terminalId)).some(f => f.id === faceInfoId)) throw new ApiError('FACE_NOT_ASSIGNED','Chọn FaceInfo thuộc terminal.');
      this.enrolled.add(faceInfoId); return {demo:true,faceInfoId,model:MODEL,pipeline:PIPELINE,dimension:128};
    }
    if (action === 'extract') return {demo:true,model:MODEL,pipeline:PIPELINE,dimension:128,vector:Array.from({length:128},(_,i) => i === 0 ? 1 : 0)};
    return this.match(terminalId,scenario);
  }
  async match(id,scenario) {
    this.scenario(scenario);
    const gallery = await this.gallery(id);
    if (!gallery.length) throw new ApiError('EMPTY_GALLERY','Terminal chưa có embedding active.');
    return scenario === 'unknown' ? {demo:true,found:false,score:0.2} : {demo:true,found:true,faceInfoId:gallery[0].id,fullName:gallery[0].fullName,memberCode:gallery[0].memberCode,score:0.92};
  }
  async identifyFeature(id,feature,_signal,scenario) { validateFeature(feature,true); return this.match(id,scenario); }
  async deleteEmbedding(id,faceInfoId) {
    if (!(await this.faceInfos(id)).some(f => f.id === faceInfoId)) throw new ApiError('FACE_NOT_ASSIGNED','FaceInfo không thuộc terminal.');
    this.enrolled.delete(faceInfoId);
  }
}
