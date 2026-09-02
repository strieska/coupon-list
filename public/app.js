const couponList = document.getElementById('coupon-list');
const clearAllButton = document.getElementById('clear-all');
const loadDemoButton = document.getElementById('load-demo');

const sampleCoupons = [
  {
    title: 'Free cold brew',
    description: 'Enjoy any cold brew on the house at your favourite café. Valid for one redemption only.'
  },
  {
    title: 'Dinner for two',
    description: 'A complimentary dinner voucher for two, redeemable during off-peak hours on weekdays.'
  },
  {
    title: 'Movie night',
    description: 'Claim two tickets for a late-evening screening and a complimentary small popcorn.'
  },
  {
    title: 'Weekend spa pass',
    description: 'Use this seasonal spa pass for a relaxing weekend reset with access to the lounge.'
  }
];

async function fetchCoupons() {
  const response = await fetch('/api/coupons');
  if (!response.ok) {
    throw new Error('Unable to load coupons.');
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.coupons || [];
}

async function loadDemoList() {
  const response = await fetch('/api/coupons/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sampleCoupons)
  });

  if (!response.ok) {
    throw new Error('Unable to replace coupons.');
  }

  await renderCoupons();
}

async function clearAllCoupons() {
  const response = await fetch('/api/coupons', { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Unable to clear coupons.');
  }

  await renderCoupons();
}

async function actOnCoupon(id, action) {
  const response = await fetch(`/api/coupons/${id}/${action}`, {
    method: 'POST'
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unable to update coupon.' }));
    throw new Error(error.error || 'Unable to update coupon.');
  }

  await renderCoupons();
}

function renderCard(coupon) {
  const title = coupon.title || 'Hidden coupon';
  const stateClass = coupon.status;

  if (coupon.status === 'locked') {
    return `
      <article class="coupon-card locked" data-id="${coupon.id}">
        <div class="card-header">
          <span class="card-number">#${coupon.id}</span>
          <span class="badge">Locked</span>
        </div>
        <div class="locked-label"><span class="locked-dot"></span> Locked</div>
      </article>
    `;
  }

  const actions = coupon.status === 'active'
    ? `
      <div class="card-actions">
        <button class="action-button redeem" type="button" data-action="redeem" data-id="${coupon.id}">Redeem</button>
        <button class="action-button skip" type="button" data-action="skip" data-id="${coupon.id}">Skip</button>
      </div>
    `
    : '';

  return `
    <article class="coupon-card ${stateClass}" data-id="${coupon.id}">
      <div class="card-header">
        <span class="card-number">#${coupon.id}</span>
        <span class="badge">${coupon.status === 'redeemed' ? 'Redeemed' : coupon.status === 'skipped' ? 'Skipped' : 'Active'}</span>
      </div>
      <h2 class="card-title">${title}</h2>
      <p class="card-description">${coupon.description || 'No description available.'}</p>
      ${actions}
    </article>
  `;
}

async function renderCoupons() {
  try {
    const coupons = await fetchCoupons();

    if (!coupons.length) {
      couponList.innerHTML = '<div class="empty-state">No coupons available yet. Load a demo list to get started.</div>';
      return;
    }

    couponList.innerHTML = coupons.map(renderCard).join('');

    couponList.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', async () => {
        const { action, id } = button.dataset;
        try {
          await actOnCoupon(id, action);
        } catch (error) {
          alert(error.message);
        }
      });
    });
  } catch (error) {
    couponList.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

clearAllButton.addEventListener('click', async () => {
  try {
    await clearAllCoupons();
  } catch (error) {
    alert(error.message);
  }
});

loadDemoButton.addEventListener('click', async () => {
  try {
    await loadDemoList();
  } catch (error) {
    alert(error.message);
  }
});

renderCoupons();
