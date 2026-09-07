const form = document.getElementById('create-form');
const resultBox = document.getElementById('result');
const errorBox = document.getElementById('error-box');
const redeemLinkEl = document.getElementById('redeem-link');
const manageLinkEl = document.getElementById('manage-link');
const qrCodeEl = document.getElementById('qr-code');
const fileInput = document.getElementById('coupon-file');
const couponsInput = document.getElementById('coupons');

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
  resultBox.classList.add('hidden');
}

function hideError() {
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  couponsInput.value = text;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideError();

  const formData = new FormData(form);
  const body = {
    mode: formData.get('mode'),
    expiresAt: formData.get('expiresAt') ? new Date(formData.get('expiresAt')).toISOString() : null,
    coupons: formData.get('coupons')
  };

  try {
    const response = await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Could not create the list.');
    }

    redeemLinkEl.href = payload.redeemLink;
    redeemLinkEl.textContent = payload.redeemLink;
    manageLinkEl.href = payload.managementLink;
    manageLinkEl.textContent = payload.managementLink;
    qrCodeEl.src = payload.qrCode;
    resultBox.classList.remove('hidden');
  } catch (error) {
    showError(error.message);
  }
});
