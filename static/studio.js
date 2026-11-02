import {PCScene} from './pc-scene.js';
import {checkCompatibility} from './compatibility.js';
import {SOCKETS} from './sockets.js';
import {openCheckout} from './public.js';
const $=s=>document.querySelector(s),selected=new Map();
const kinds={'Процессор':'cpu','Материнская плата':'motherboard','ОЗУ':'ram','Видеокарта':'gpu','Накопитель':'storage','Блок питания':'psu','Корпус':'case'};
let catalog,active,viewer;
const money=n=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
function el(tag,text,cls=''){const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;}
function typeOf(c){return kinds[catalog.categories.find(k=>k.id===c.category_id)?.name];}
try{viewer=new PCScene($('#scene'),{onStatus:message=>$('#scene-status').textContent=message,onSocket:id=>{$('#slot-label').textContent=id?SOCKETS[id].label:'Наведи на сокет или выбери его ниже';}});}catch(error){$('#scene-status').textContent='WebGL недоступен. Каталог продолжает работать.';console.error(error);}
function updateScene(){if(viewer)viewer.setParts([...selected.values()].map(c=>({...c,type:typeOf(c)})),checkCompatibility([...selected.values()]).ids);}
function paint(updateModels=true){
 const conflict=checkCompatibility([...selected.values()]);$('#categories').replaceChildren();
 for(const c of catalog.categories){const b=el('button',c.name+(selected.has(c.id)?' ✓':''),'category'+(active===c.id?' active':''));b.onclick=()=>{active=c.id;$('#search').value='';paint(false);};$('#categories').append(b);}
 $('#category-title').textContent=catalog.categories.find(c=>c.id===active)?.name||'Каталог';
 let products=catalog.components.filter(c=>c.category_id===active&&c.name.toLowerCase().includes($('#search').value.toLowerCase()));
 if($('#compatible-only').checked)products=products.filter(c=>{const candidate=new Map(selected);candidate.set(c.category_id,c);return !checkCompatibility([...candidate.values()]).ids.size;});
 if($('#sort').value==='price')products.sort((a,b)=>Number(a.price)-Number(b.price));if($('#sort').value==='name')products.sort((a,b)=>a.name.localeCompare(b.name));
 $('#product-count').textContent=products.length;$('#products').replaceChildren();
 for(const c of products){const chosen=selected.get(c.category_id)?.id===c.id,card=el('article','','product'+(chosen?' selected':''));const candidate=new Map(selected);candidate.set(c.category_id,c);const incompatible=checkCompatibility([...candidate.values()]).ids.has(c.id);
 card.append(el('h3',c.name),el('p',Object.values(c.specs_json||{}).join(' / ')),el('p',c.stock_quantity?'В наличии: '+c.stock_quantity:'Нет в наличии','stock'));
 if(incompatible)card.append(el('p','Есть конфликт совместимости','conflict-note'));
 const row=el('div','','product-bottom'),b=el('button',chosen?'Убрать':'Выбрать','button secondary compact');b.disabled=!chosen&&c.stock_quantity<1;b.onclick=()=>{chosen?selected.delete(c.category_id):selected.set(c.category_id,c);paint();};row.append(el('strong',money(c.price)),b);card.append(row);$('#products').append(card);}
 if(!products.length)$('#products').append(el('p','По этим фильтрам ничего не найдено.'));
 $('#basket').replaceChildren();for(const c of selected.values()){const b=el('button',c.name+' ×');b.setAttribute('aria-label','Убрать '+c.name);b.onclick=()=>{selected.delete(c.category_id);paint();};$('#basket').append(b);}
 $('#total').textContent=money([...selected.values()].reduce((sum,c)=>sum+Number(c.price),0));$('#count').textContent='Выбрано деталей: '+selected.size;$('#selection-count').textContent=selected.size+' / '+catalog.categories.length;
 $('#warnings').textContent=conflict.messages.join(' ')||(!selected.size?'Начни с выбора материнской платы.':selected.size===1?'Добавь остальные компоненты для проверки.':'Конфликтов сокета и типа памяти не найдено.');$('#warnings').classList.toggle('error',!!conflict.ids.size);$('#checkout-button').disabled=!selected.size||!!conflict.ids.size;
 $('#checkout-hint').textContent=conflict.ids.size?'Исправь несовместимость для оформления':'Наличие и окончательную комплектацию уточним перед заказом';if(updateModels)updateScene();
}
async function load(){try{const r=await fetch('/api/catalog');if(!r.ok)throw Error('Каталог недоступен');catalog=await r.json();active=active||catalog.categories.find(c=>kinds[c.name]==='motherboard')?.id||catalog.categories[0]?.id;$('#retry-catalog').hidden=true;paint();}catch(error){$('#products').textContent=error.message;$('#retry-catalog').hidden=false;}}
for(const id of ['search','compatible-only','sort'])$('#'+id).addEventListener(id==='search'?'input':'change',()=>paint(false));
$('#retry-catalog').onclick=load;$('#retry-models').onclick=updateScene;
$('#reset').onclick=()=>viewer?.reset();
for(const [id,key]of [['explode','expanded'],['show-case','caseVisible'],['show-slots','slotsVisible']])$('#'+id).onclick=()=>{if(!viewer)return;viewer[key]=!viewer[key];$('#'+id).setAttribute('aria-pressed',String(viewer[key]));if(id==='show-case')$('#'+id).textContent=viewer[key]?'Корпус виден':'Корпус скрыт';viewer.place();};
for(const [id,socket]of Object.entries(SOCKETS)){const b=el('button',socket.label);b.onmouseenter=()=>viewer?.setHighlight(id);b.onmouseleave=()=>viewer?.setHighlight(null);b.onfocus=()=>viewer?.setHighlight(id);b.onblur=()=>viewer?.setHighlight(null);b.onclick=()=>{if(!catalog)return;if(socket.type==='ram'&&viewer){viewer.ramSocket=id;viewer.place();}active=catalog.categories.find(c=>kinds[c.name]===socket.type)?.id;paint(false);};$('#slot-buttons').append(b);}
$('#checkout-button').onclick=()=>{if(checkCompatibility([...selected.values()]).ids.size)return;openCheckout({type:'config',component_ids:[...selected.values()].map(c=>c.id)});};
window.addEventListener('order-created',()=>{selected.clear();load();});load();
