import fs from 'node:fs';
const tabs=await (await fetch('http://127.0.0.1:9225/json')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(d.error):p.resolve(d.result);}else if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text);else if(d.method==='Log.entryAdded'&&d.params.entry.level==='error')errors.push(d.params.entry.text);};
function cmd(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function evalJS(expression){const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Log.enable');await cmd('Log.clear');errors.length=0;await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
for(const route of ['/','/builds','/configurator']){
 await cmd('Page.navigate',{url:'http://127.0.0.1:8010'+route});await wait(route==='/builds'?1500:6500);if(route==='/')for(let n=0;n<30;n++){if(await evalJS("!document.querySelector('#hero-status').textContent.includes('????????')"))break;await wait(1000);}
 console.log(route,await evalJS(`({title:document.title,overflow:document.documentElement.scrollWidth>innerWidth,css:getComputedStyle(document.body).backgroundColor,canvas:!!document.querySelector('canvas')})`));
 if(route==='/configurator'){
  await evalJS(`for(const b of document.querySelectorAll('#categories button'))if(b.textContent.includes('Материнская'))b.click();document.querySelector('#products button').click()`);await wait(4000);
  await evalJS(`for(const b of document.querySelectorAll('#categories button'))if(b.textContent.includes('Процессор'))b.click();document.querySelectorAll('#products button')[1].click()`);await wait(4000);
  console.log('conflict',await evalJS(`({warning:document.querySelector('#warnings').textContent,disabled:document.querySelector('#checkout-button').disabled,scene:document.querySelector('#scene-status').textContent})`));
  await evalJS(`document.querySelectorAll('#products button')[0].click()`);await wait(2500);
  for(const category of ['ОЗУ','Видеокарта','Накопитель','Корпус','Блок питания']){await evalJS(`for(const b of document.querySelectorAll('#categories button'))if(b.textContent.includes(${JSON.stringify(category)}))b.click();document.querySelector('#products button').click()`);await wait(2000);}
  console.log('full',await evalJS(`({warning:document.querySelector('#warnings').textContent,disabled:document.querySelector('#checkout-button').disabled,scene:document.querySelector('#scene-status').textContent})`));
 }
 const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync('logs/'+(route==='/'?'home':route.slice(1))+'.png',Buffer.from(shot.data,'base64'));
}
await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await wait(1000);console.log('mobile overflow',await evalJS('document.documentElement.scrollWidth>innerWidth'));const shot=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync('logs/mobile.png',Buffer.from(shot.data,'base64'));console.log('ERRORS',errors);ws.close();if(errors.length)process.exitCode=1;

