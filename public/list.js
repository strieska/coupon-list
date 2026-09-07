const listId = window.location.pathname.split('/')[2] || '';
const listStatus = document.getElementById('list-status');
const couponList = document.getElementById('coupon-list');
const errorBox = document.getElementById('error-box');
let expandedCouponId = null;

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function hideError() {
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

function renderCard(coupon, listMode) {
  const title = coupon.title || 'Hidden coupon';
  const statusText = coupon.status === 'redeemed'
    ? 'Redeemed'
    : coupon.status === 'skipped'
      ? 'Skipped'
      : coupon.status === 'active'
        ? 'Active'
        : coupon.status === 'locked'
          ? 'Locked'
          : 'Available';

  if (coupon.status === 'locked') {
    return `
      <article class="coupon-card locked" data-id="${coupon.id}">
        <div class="card-header">
          <span class="card-number">#${coupon.id.split('-').pop()}</span>
          <span class="badge">Locked</span>
        </div>
        <div class="locked-label"><span class="locked-dot"></span> Locked</div>
      </article>
    `;
  }

  const descriptionVisible = String(expandedCouponId) === String(coupon.id) || coupon.status === 'active';
  const actions = coupon.status === 'active' && listMode === 'sequential'
    ? `
      <div class="card-actions">
        <button class="action-button redeem" type="button" data-action="redeem" data-id="${coupon.id}">Redeem</button>
        <button class="action-button skip" type="button" data-action="skip" data-id="${coupon.id}">Skip</button>
      </div>
    `
    : coupon.status === 'available' && listMode === 'open'
      ? `
        <div class="card-actions">
          <button class="action-button redeem" type="button" data-action="redeem" data-id="${coupon.id}">Redeem</button>
        </div>
      `
      : '';

  return `
    <article class="coupon-card ${coupon.status} ${descriptionVisible ? 'expanded' : 'collapsed'}" data-id="${coupon.id}">
      <div class="card-header">
        <span class="card-number">#${coupon.id.split('-').pop()}</span>
        <span class="badge">${statusText}</span>
      </div>
      <h2 class="card-title">${title}</h2>
      ${descriptionVisible ? `<p class="card-description">${coupon.description || 'No description available.'}</p>` : ''}
      ${descriptionVisible ? actions : ''}
    </article>
  `;
}

async function fetchList() {
  const response = await fetch(`/api/lists/${listId}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Unable to load the list.');
  }
  return response.json();
}

async function redeemCoupon(couponId, action) {
  const response = await fetch(`/api/lists/${listId}/coupons/${couponId}/${action}`, {
    method: 'POST'
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Unable to update the list.');
  }

  renderList(payload);
}

function renderList(list) {
  hideError();

  if (!list?.coupons?.length) {
    couponList.innerHTML = '<div class="empty-state">This list is empty.</div>';
    return;
  }

  const activeCoupon = list.coupons.find((coupon) => coupon.status === 'active');
  if (activeCoupon && expandedCouponId === null) {
    expandedCouponId = activeCoupon.id;
  }

  couponList.innerHTML = list.coupons.map((coupon) => renderCard(coupon, list.mode)).join('');

  couponList.querySelectorAll('.coupon-card:not(.locked)').forEach((card) => {
    card.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-action]');
      if (actionButton) {
        return;
      }

      const couponId = card.dataset.id;
      if (expandedCouponId === couponId) {
        expandedCouponId = null;
      } else {
        expandedCouponId = couponId;
      }
      fetchList().then(renderList).catch((error) => showError(error.message));
    });
  });

  couponList.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const { action, id } = button.dataset;
      try {
        await redeemCoupon(id, action);
      } catch (error) {
        showError(error.message);
      }
    });
  });

  const modeLabel = list.mode === 'sequential' ? 'Sequential mode' : 'Open mode';
  listStatus.textContent = `${modeLabel} • ${list.coupons.filter((coupon) => coupon.status === 'redeemed' || coupon.status === 'skipped').length}/${list.coupons.length} resolved`;
}

(async function init() {
  try {
    const list = await fetchList();
    renderList(list);
  } catch (error) {
    showError(error.message);
  }
})();
