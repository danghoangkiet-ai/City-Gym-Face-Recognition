import {readState, writeState} from './storage.js';
import {request} from './api.js';
// Replace this adapter with authenticated HTTP calls when the backend contract is supplied.
export class LocalManagementClient {
  async getData() { return readState(); }
  async saveData(state) { return writeState(state); }
  async recognitionStatus() { return {connected:false, message:'Chờ kết nối backend'}; }
}
export class HttpManagementClient {
  revision = null;
  async getData() { const response=await request('/management/workspace');this.revision=response.revision;return response.data; }
  async saveData(data) {
    const response=await request('/management/workspace',{method:'PUT',body:{data,expectedRevision:this.revision}});
    this.revision=response.revision;return response.data;
  }
}
