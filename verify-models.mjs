import {MeshoptDecoder} from './static/vendor/meshopt_decoder.module.js';
import fs from 'node:fs';
await MeshoptDecoder.ready;
for (const name of ['cpu','gpu','motherboard','ram','storage']) {
  const b=fs.readFileSync(`frontend/assets/models/${name}.glb`), len=b.readUInt32LE(12);
  const doc=JSON.parse(b.subarray(20,20+len)), bin=b.subarray(28+len);
  let count=0;
  for (const view of doc.bufferViews||[]) {
    const e=view.extensions?.EXT_meshopt_compression;
    if(!e) continue;
    const target=new Uint8Array(e.count*e.byteStride);
    MeshoptDecoder.decodeGltfBuffer(target,e.count,e.byteStride,bin.subarray(e.byteOffset||0,(e.byteOffset||0)+e.byteLength),e.mode,e.filter);
    count++;
  }
  console.log(name, 'decoded', count, 'compressed buffers');
}
