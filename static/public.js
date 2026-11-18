const dialog = document.querySelector('#checkout');
const form = document.querySelector('#order-form');
const submit = form.querySelector('[type=submit]');
const message = document.querySelector('#order-message');
let payload = null;

export function openCheckout(value) {
  payload = structuredClone(value);
  message.textContent = '';
  message.classList.remove('error');
  submit.disabled = false;
  submit.textContent = 'Отправить заявку';
  dialog.showModal();
}

document.querySelector('#close-checkout').onclick = () => dialog.close();
document.querySelectorAll('[data-build]').forEach(button => {
  button.onclick = () => openCheckout({type: 'ready', build_id: Number(button.dataset.build)});
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!payload) return;
  submit.disabled = true;
  message.classList.remove('error');
  const data = Object.fromEntries(new FormData(form));
  data.consent = form.querySelector('[name=consent]').checked;
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name=csrf-token]').content,
      },
      body: JSON.stringify({...payload, ...data}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Не удалось отправить заявку. Попробуй ещё раз.');
    message.textContent = `Заявка №${result.id} принята. Менеджер свяжется с тобой, чтобы уточнить комплектацию и сроки.`;
    submit.textContent = 'Заявка отправлена';
    payload = null;
    form.reset();
    window.dispatchEvent(new Event('order-created'));
  } catch (error) {
    message.textContent = error.message;
    message.classList.add('error');
    submit.disabled = false;
  }
});
