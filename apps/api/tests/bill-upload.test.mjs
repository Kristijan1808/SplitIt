import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { billRouter } from '../dist/routes/bill.routes.js';
import { errorHandler } from '../dist/middleware.error.js';
import { chatGptService } from '../dist/chatgpt.service.js';
import { billImage } from '../dist/services/bill-image.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
test('image validation: content, empty, fake MIME, malformed and oversized base64', () => {
  assert.equal(billImage({buffer:png}, undefined).mimeType, 'image/png');
  assert.deepEqual(billImage(undefined,png.toString('base64')).buffer,png);
  for (const bad of ['', 'file:///photo.jpg','[object Object]', 'AAAA=', 'a==='])
    assert.throws(()=>billImage(undefined,bad),e=>e.status===400);
  assert.throws(()=>billImage({buffer:Buffer.from('not an image')},undefined),e=>e.status===400);
  assert.throws(()=>billImage({buffer:Buffer.alloc(10*1024*1024+1)},undefined),e=>e.status===413);
  assert.throws(()=>billImage(undefined,'A'.repeat(14*1024*1024)),e=>e.status===413);
});
test('HTTP: Expo JSON and browser multipart both reach OCR with correct bytes', async () => {
  const original=chatGptService.extractBillItems;
  const received=[];
  chatGptService.extractBillItems=async (buffer,mime)=>{
    received.push({buffer,mime});return [{name:'Test',price:2}];
  };
  const app=express();
  app.use('/ai/parse-bill',express.json({limit:'14mb'}));
  app.use(express.json());app.use('/ai',billRouter);app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${server.address().port}/ai/parse-bill`;
  try {
    // Body larger than Express's default 100 KB verifies dedicated parser.
    const large=Buffer.concat([png,Buffer.alloc(120*1024)]);
    let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageBase64:large.toString('base64')})});
    assert.equal(r.status,200);assert.equal((await r.json()).items[0].price,2);
    assert.deepEqual(received[0],{buffer:large,mime:'image/png'});
    const form=new FormData();
    form.append('file',new Blob([png],{type:'application/octet-stream'}),'camera.heic');
    r=await fetch(url,{method:'POST',body:form});assert.equal(r.status,200);
    assert.deepEqual(received[1],{buffer:png,mime:'image/png'});
    r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    assert.equal(r.status,400);assert.equal((await r.json()).error,'Bill image is required');
    const fake=new FormData();fake.append('file',new Blob(['not an image'],{type:'image/jpeg'}),'fake.jpg');
    r=await fetch(url,{method:'POST',body:fake});assert.equal(r.status,400);
    assert.equal(received.length,2);
  } finally { chatGptService.extractBillItems=original;await new Promise(resolve=>server.close(resolve)); }
});
