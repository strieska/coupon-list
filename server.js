const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'coupons.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, '[]', 'utf8');
  }
}

function readCoupons() {
  ensureStore();
  const raw = fs.readFileSync(STORE_PATH, 'utf8');

  if (!raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeCoupons(coupons) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(coupons, null, 2), 'utf8');
}

function resolveActionState(coupons) {
  const activeCoupons = coupons.filter((coupon) => coupon.status === 'active');
  activeCoupons.forEach((coupon) => {
    coupon.status = 'locked';
  });

  const nextActive = coupons.find((coupon) => coupon.status === 'locked');
  if (nextActive) {
    nextActive.status = 'active';
  }
}

function normalizeCouponList(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry, index) => ({
      id: index + 1,
      title: String(entry.title ?? '').trim(),
      description: String(entry.description ?? '').trim(),
      status: index === 0 ? 'active' : 'locked'
    }))
    .filter((entry) => entry.title || entry.description);
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'coupon-app' });
});

app.get('/api/coupons', (req, res) => {
  const coupons = readCoupons();
  res.json(coupons);
});

app.delete('/api/coupons', (req, res) => {
  writeCoupons([]);
  res.json({ success: true, coupons: [] });
});

app.post('/api/coupons/bulk', (req, res) => {
  const rawBody = req.body;
  const input = Array.isArray(rawBody)
    ? rawBody
    : rawBody && Array.isArray(rawBody.coupons)
      ? rawBody.coupons
      : null;

  if (!input) {
    return res.status(400).json({
      error: 'Expected a JSON array of coupon objects or { "coupons": [...] }.'
    });
  }

  const coupons = normalizeCouponList(input);
  writeCoupons(coupons);

  return res.status(200).json(coupons);
});

app.post('/api/coupons/:id/:action', (req, res) => {
  const { id, action } = req.params;
  const normalizedAction = action.toLowerCase();

  if (!['redeem', 'skip'].includes(normalizedAction)) {
    return res.status(400).json({ error: 'Action must be redeem or skip.' });
  }

  const coupons = readCoupons();
  const coupon = coupons.find((entry) => Number(entry.id) === Number(id));

  if (!coupon) {
    return res.status(404).json({ error: 'Coupon not found.' });
  }

  if (coupon.status !== 'active') {
    return res.status(409).json({ error: 'Only the active coupon can be redeemed or skipped.' });
  }

  coupon.status = normalizedAction === 'redeem' ? 'redeemed' : 'skipped';
  resolveActionState(coupons);
  writeCoupons(coupons);

  return res.status(200).json(coupons);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Coupon app listening on http://localhost:${PORT}`);
});
