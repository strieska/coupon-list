const params = new URLSearchParams(window.location.search);
const listId = window.location.pathname.split('/')[2] || '';
const managementKey = params.get('key');
const form = document.getElementById('manage-form');
const modeInput = document.getElementById('mode');
const titleInput = document.getElementById('title');
const expiresAtInput = document.getElementById('expiresAt');
const couponsInput = document.getElementById('coupons');
const deleteButton = document.getElementById('delete-button');
const statusBox = document.getElementById('status-box');
const errorBox = document.getElementById('error-box');

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function hideError() {
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

function formatListForTextarea(coupons) {
  return JSON.stringify(
    coupons.map((coupon) => ({
      title: coupon.title,
      description: coupon.description
    })),
    null,
    2
  );
}

async function loadList() {
  if (!listId || !managementKey) {
    throw new Error('Missing list ID or management key.');
  }

  const response = await fetch(`/api/lists/${listId}/manage?key=${encodeURIComponent(managementKey)}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Unable to load the list.');
  }

  modeInput.value = payload.mode || 'sequential';
  titleInput.value = payload.title || 'Coupon chain';
  expiresAtInput.value = payload.expiresAt ? new Date(payload.expiresAt).toISOString().slice(0, 16) : '';
  couponsInput.value = formatListForTextarea(payload.coupons || []);
  statusBox.textContent = `List ID: ${payload.id}`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideError();

  try {
    const payload = {
      title: titleInput.value,
      mode: modeInput.value,
      expiresAt: expiresAtInput.value ? new Date(expiresAtInput.value).toISOString() : null,
      coupons: JSON.parse(couponsInput.value)
    };

    const response = await fetch(`/api/lists/${listId}?key=${encodeURIComponent(managementKey)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'Unable to save the list.');
    }

    statusBox.textContent = `Saved successfully. List ID: ${result.id}`;
  } catch (error) {
    showError(error.message);
  }
});

deleteButton.addEventListener('click', async () => {
  try {
    const response = await fetch(`/api/lists/${listId}?key=${encodeURIComponent(managementKey)}`, {
      method: 'DELETE'
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to delete the list.');
    }

    statusBox.textContent = 'This list was deleted.';
    form.classList.add('hidden');
  } catch (error) {
    showError(error.message);
  }
});

loadList().catch((error) => {
  showError(error.message);
});
