import {PCScene} from './pc-scene.js';
const status=document.querySelector('#hero-status');
try{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),view=new PCScene(document.querySelector('#hero-scene'),{hero:true,onStatus:message=>status.textContent=message});view.controls.autoRotate=!reduced.matches;
 const names=['motherboard','cpu','ram','gpu','storage','case','psu'];
 await view.setParts(names.map((type,id)=>({type,id,name:type,model_url:['case','psu'].includes(type)?null:'/models/'+type+'.glb'})));
 status.textContent='Иллюстративная сборка. Вращай, чтобы рассмотреть детали.';
 const button=document.querySelector('#hero-motion');function label(){button.textContent=view.controls.autoRotate?'Пауза':'Вращать';button.setAttribute('aria-pressed',String(!view.controls.autoRotate));}label();button.onclick=()=>{view.controls.autoRotate=!view.controls.autoRotate;label();};reduced.addEventListener('change',e=>{view.controls.autoRotate=!e.matches;label();});
}catch(error){status.textContent='Открой конфигуратор, чтобы выбрать комплектующие.';console.error(error);}
