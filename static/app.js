const $ = (s) => document.querySelector(s);
const money = (n) => new Intl.NumberFormat('ru-RU', {style:'currency', currency:'RUB', maximumFractionDigits:0}).format(n);
const csrf = $('meta[name="csrf-token"]').content;
let orderPayload = null, catalog = null, selected = new Map(), activeCategory = null;
function element(tag, text, className='') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
function openCheckout(payload) {
  orderPayload = payload; $('#order-message').textContent = ''; $('#order-form button[type="submit"]').disabled = false; $('#checkout').showModal();
}
document.querySelectorAll('[data-build]').forEach(b => b.addEventListener('click', () => openCheckout({type:'ready', build_id:Number(b.dataset.build)})));
$('.close').addEventListener('click', () => $('#checkout').close());
document.querySelectorAll('.delete-form').forEach(form => form.addEventListener('submit', event => {
  if (!confirm('Удалить эту запись? Действие необратимо.')) event.preventDefault();
}));
$('#order-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('#order-form button[type="submit"]'); button.disabled = true;
  const fields = Object.fromEntries(new FormData(event.target));
  try {
    const response = await fetch('/api/orders', {method:'POST', headers:{'Content-Type':'application/json', 'X-CSRF-Token':csrf}, body:JSON.stringify({...orderPayload,...fields})});
    const result = await response.json();
    if (!response.ok) throw Error(typeof result.detail === 'string' ? result.detail : 'Не удалось оформить заказ.');
    $('#order-message').textContent = result.message + ' · Заказ №' + result.id;
    event.target.reset();
    if (catalog) { selected.clear(); await loadCatalog(); }
  } catch (error) { $('#order-message').textContent = error.message; button.disabled = false; }
});
function conflict(items) {
  const byName = Object.fromEntries(items.map(c => [catalog.categories.find(k => k.id === c.category_id).name, c]));
  const cpu=byName['Процессор'], board=byName['Материнская плата'], ram=byName['ОЗУ'];
  if(cpu && board && cpu.specs_json.socket !== board.specs_json.socket) return 'Несовместимые сокеты процессора и платы';
  for(const [a,b] of [[cpu,board],[cpu,ram],[board,ram]]) {
    if(a && b && a.specs_json.ram_type && b.specs_json.ram_type && a.specs_json.ram_type !== b.specs_json.ram_type) return 'Несовместимый тип памяти';
  }
  return '';
}
function paint() {
  const categories=$('#categories'); categories.replaceChildren();
  catalog.categories.forEach(c => {
    const b=element('button',c.name + (selected.has(c.id)?' ✓':''), c.id === activeCategory?'category active':'category');
    b.addEventListener('click',()=>{ activeCategory=c.id; paint(); }); categories.append(b);
  });
  $('#category-title').textContent=catalog.categories.find(c=>c.id===activeCategory)?.name || 'Комплектующие';
  const products=$('#products'); products.replaceChildren();
  const items=catalog.components.filter(c=>c.category_id===activeCategory);
  if(!items.length) products.append(element('p','В этой категории пока нет товаров.'));
  items.forEach(c => {
    const card=element('article','','product');
    card.append(element('h3',c.name),element('p',Object.entries(c.specs_json).map(([k,v])=>k+': '+v).join(' · '),'muted'),element('strong',money(c.price)),element('small','На складе: '+c.stock_quantity));
    const candidate=new Map(selected); candidate.set(c.category_id,c);
    const warning=conflict([...candidate.values()]);
    const button=element('button',selected.get(c.category_id)?.id===c.id?'Выбрано':warning?'Несовместимо':c.stock_quantity?'Выбрать':'Нет в наличии','button secondary');
    button.disabled=!!warning || c.stock_quantity<1;
    if(warning) card.append(element('p',warning,'error'));
    button.addEventListener('click',()=>{ selected.set(c.category_id,c); paint(); });
    card.append(button); products.append(card);
  });
  const basket=$('#basket'); basket.replaceChildren();
  if(!selected.size) basket.append(element('p','Выберите первую деталь','muted'));
  selected.forEach(c=>{
    const row=element('div','','basket-row'), remove=element('button','×');
    remove.setAttribute('aria-label','Убрать '+c.name);
    remove.addEventListener('click',()=>{selected.delete(c.category_id);paint();});
    row.append(element('span',c.name),element('strong',money(c.price)),remove);basket.append(row);
  });
  $('#total').textContent=money([...selected.values()].reduce((sum,c)=>sum+Number(c.price),0));
  $('#config-checkout').disabled=!selected.size;
}
async function loadCatalog() {
  const response=await fetch('/api/catalog');
  if(!response.ok) throw Error('Каталог недоступен. Обновите страницу.');
  catalog=await response.json(); activeCategory=activeCategory || catalog.categories[0]?.id; paint();
}
if($('#categories')) {
  loadCatalog().catch(e=>{$('#config-error').textContent=e.message;$('#categories').textContent='Не удалось загрузить каталог';});
  $('#config-checkout').addEventListener('click',()=>openCheckout({type:'config',component_ids:[...selected.values()].map(c=>c.id)}));
}

