const dialog = document.querySelector('#checkout');
const form = document.querySelector('#order-form');
let payload = null;
export function openCheckout(value) {
  payload = structuredClone(value);
  document.querySelector('#order-message').textContent = '';
  form.querySelector('[type=submit]').disabled = false;
  dialog.showModal();
}
document.querySelector('#close-checkout').onclick = () => dialog.close();
document.querySelectorAll('[data-build]').forEach(button => {
  button.onclick = () => openCheckout({type: 'ready', build_id: Number(button.dataset.build)});
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!payload) return;
  const button = form.querySelector('[type=submit]');
  const message = document.querySelector('#order-message');
  button.disabled = true;
  try {
    const response = await fetch('/api/orders', {
      method: 'POST', headers: {'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name=csrf-token]').content},
      body: JSON.stringify({...payload, ...Object.fromEntries(new FormData(form))}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Не удалось отправить заявку. Попробуй ещё раз.');
    message.textContent = `Заявка №${result.id} принята. Мы свяжемся с тобой.`;
    payload = null; form.reset(); window.dispatchEvent(new Event('order-created'));
  } catch (error) { message.textContent = error.message; button.disabled = false; }
});
