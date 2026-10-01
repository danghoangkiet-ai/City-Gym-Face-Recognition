import test from 'node:test';
import assert from 'node:assert/strict';
import {DemoRecognitionClient,HttpRecognitionClient,validateFeature,MODEL,PIPELINE} from '../js/recognition-client.js';
import {request,setCsrf} from '../js/api.js';
test('demo enrollment and deletion affect gallery without deleting FaceInfo',async()=>{
  const client=new DemoRecognitionClient(),terminalId='demo-terminal-01';
  await client.deleteEmbedding(terminalId,'demo-face-01');
  assert.equal((await client.status(terminalId)).enrolledFaces,0);
  assert.equal((await client.faceInfos(terminalId)).length,2);
  await assert.rejects(()=>client.image('identify',{terminalId}),e=>e.code==='EMPTY_GALLERY');
  await client.image('enroll',{terminalId,faceInfoId:'demo-face-02'});
  assert.equal((await client.status(terminalId)).enrolledFaces,1);
});
test('gallery stays scoped to terminal',async()=>{
  const client=new DemoRecognitionClient();
  assert.equal((await client.gallery('demo-terminal-02')).length,0);
  await assert.rejects(()=>client.image('enroll',{terminalId:'demo-terminal-02',faceInfoId:'demo-face-01'}),e=>e.code==='FACE_NOT_ASSIGNED');
  await assert.rejects(()=>client.gallery('unauthorized'),e=>e.status===403);
});
test('demo no-face, multiple-face and not-found are distinct',async()=>{
  const client=new DemoRecognitionClient(),terminalId='demo-terminal-01';
  for(const scenario of ['NO_FACE','MULTIPLE_FACES','SERVICE_NOT_READY','FORBIDDEN'])await assert.rejects(()=>client.image('identify',{terminalId,scenario}),e=>e.code===scenario);
  assert.equal((await client.image('identify',{terminalId,scenario:'unknown'})).found,false);
});
test('synthetic features are never accepted by HTTP recognition',async()=>{
  const demo=new DemoRecognitionClient();
  const feature=await demo.image('extract',{terminalId:'demo-terminal-01'});
  assert.equal(validateFeature(feature,true).dimension,128);
  assert.throws(()=>new HttpRecognitionClient().identifyFeature('terminal',feature),e=>e.code==='INCOMPATIBLE_FEATURE');
  assert.throws(()=>validateFeature({...feature,demo:false,vector:Array(128).fill(NaN)}));
});
test('HTTP adapter sends multipart, excludes FaceInfo on identify, sends feature JSON and CSRF',async()=>{
  const calls=[],original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({found:false}),{status:200});};
  try{
    setCsrf('test-csrf');const client=new HttpRecognitionClient();
    await client.image('identify',{terminalId:'t/1',faceInfoId:'must-not-send',file:new File(['image'],'test.png',{type:'image/png'})});
    assert.equal(calls[0].options.body.get('faceInfoId'),null);
    assert.equal(calls[0].options.body.get('terminalId'),'t/1');
    assert.equal(calls[0].options.headers['Content-Type'],undefined);
    const feature={model:MODEL,pipeline:PIPELINE,dimension:128,vector:Array.from({length:128},(_,i)=>i===0?1:0)};
    await client.identifyFeature('t/1',feature);
    assert.deepEqual(JSON.parse(calls[1].options.body),{terminalId:'t/1',feature});
    assert.equal(calls[1].options.headers['X-CSRF-Token'],'test-csrf');
    assert.equal(calls[1].options.credentials,'same-origin');
  }finally{globalThis.fetch=original;setCsrf();}
});
test('HTTP error codes, unauthorized, malformed success and cancellation are propagated',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>new Response(JSON.stringify({code:'NO_FACE',message:'No face'}),{status:422});
    await assert.rejects(()=>request('/test'),e=>e.code==='NO_FACE');
    globalThis.fetch=async()=>new Response('',{status:401});
    await assert.rejects(()=>request('/test'),e=>e.status===401);
    globalThis.fetch=async()=>new Response('not-json',{status:200});
    await assert.rejects(()=>request('/test'),e=>e.code==='INVALID_RESPONSE');
    globalThis.fetch=async()=>{throw new Error('offline');};
    await assert.rejects(()=>request('/test'),e=>e.code==='NETWORK_ERROR');
    const abort=new AbortController();abort.abort();
    await assert.rejects(()=>request('/test',{signal:abort.signal}),e=>e.code==='REQUEST_CANCELLED');
  }finally{globalThis.fetch=original;}
});
