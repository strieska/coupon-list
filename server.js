const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'lists.json');

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitMap = new Map();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, '[]', 'utf8');
  }
}

function readLists() {
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

function writeLists(lists) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(lists, null, 2), 'utf8');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) {
    return forwarded[0] || req.ip;
  }
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim() || req.ip;
  }
  return req.ip || 'unknown';
}

function enforceRateLimit(req, res, next) {
  const key = getClientIp(req);
  const now = Date.now();
  const bucket = rateLimitMap.get(key) || { windowStart: now, count: 0 };

  if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    bucket.windowStart = now;
    bucket.count = 0;
  }

  bucket.count += 1;
  rateLimitMap.set(key, bucket);

  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
  }

  return next();
}

function randomListId() {
  return crypto.randomUUID();
}

function randomManagementKey() {
  return crypto.randomBytes(24).toString('hex');
}

function cloneCoupon(coupon, index) {
  return {
    id: coupon.id || `coupon-${index + 1}`,
    title: String(coupon.title ?? '').trim(),
    description: String(coupon.description ?? '').trim(),
    status: coupon.status || 'available'
  };
}

function normalizeCoupons(rawCoupons, mode) {
  const input = Array.isArray(rawCoupons)
    ? rawCoupons
    : rawCoupons && Array.isArray(rawCoupons.coupons)
      ? rawCoupons.coupons
      : [];

  const cleanCoupons = input
    .map((entry, index) => {
      const title = String(entry?.title ?? '').trim();
      const description = String(entry?.description ?? '').trim();
      if (!title && !description) {
        return null;
      }

      return {
        id: `coupon-${index + 1}`,
        title,
        description,
        status: mode === 'sequential' ? (index === 0 ? 'active' : 'locked') : 'available'
      };
    })
    .filter(Boolean);

  return cleanCoupons;
}

function parseRawCoupons(input) {
  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      // fall through to line-based parsing
    }

    const lines = input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.map((line) => {
      const parts = line.split('|');
      if (parts.length >= 2) {
        return {
          title: parts[0].trim(),
          description: parts.slice(1).join('|').trim()
        };
      }
      return { title: line, description: '' };
    });
  }

  if (input && Array.isArray(input.coupons)) {
    return input.coupons;
  }

  return [];
}

function setSequentialState(list) {
  const coupons = list.coupons || [];
  for (const coupon of coupons) {
    if (coupon.status === 'active' || coupon.status === 'locked') {
      coupon.status = 'locked';
    }
  }

  const firstLocked = coupons.find((coupon) => coupon.status === 'locked');
  if (firstLocked) {
    firstLocked.status = 'active';
  }
}

function getPublicListPayload(list) {
  return {
    id: list.id,
    mode: list.mode,
    title: list.title || 'Coupon chain',
    createdAt: list.createdAt,
    coupons: (list.coupons || []).map((coupon) => ({
      id: coupon.id,
      title: coupon.title,
      description: coupon.description,
      status: coupon.status
    }))
  };
}

function findListById(listId) {
  return readLists().find((list) => list.id === listId || list.redeemId === listId);
}

function requireManagementAccess(req, res, next) {
  const listId = req.params.listId;
  const providedKey = String(req.query.key || req.headers['x-management-key'] || '');
  const lists = readLists();
  const list = lists.find((entry) => entry.id === listId);

  if (!list) {
    return res.status(404).json({ error: 'List not found.' });
  }

  if (providedKey !== list.managementKey) {
    return res.status(401).json({ error: 'Invalid management key.' });
  }

  req.list = list;
  return next();
}

function getBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : req.protocol;
  return `${protocol}://${req.get('host')}`;
}

async function createQRDataUrl(url) {
  return QRCode.toDataURL(url, { margin: 1, width: 170 });
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'coupon-list-app' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/new', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'create.html'));
});

app.get('/l/:listId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'list.html'));
});

app.get('/l/:listId/manage', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});

app.post('/api/lists', async (req, res) => {
  try {
    const rawBody = req.body || {};
    const rawCoupons = parseRawCoupons(rawBody.coupons ?? rawBody);
    const requestedMode = String(rawBody.mode || 'sequential').toLowerCase();
    const mode = requestedMode === 'open' ? 'open' : 'sequential';

    if (!Array.isArray(rawCoupons) || rawCoupons.length === 0) {
      return res.status(400).json({ error: 'Provide at least one coupon.' });
    }

    const coupons = normalizeCoupons(rawCoupons, mode);
    if (coupons.length === 0) {
      return res.status(400).json({ error: 'Provide valid coupon data.' });
    }

    const list = {
      id: randomListId(),
      redeemId: randomListId(),
      managementKey: randomManagementKey(),
      title: String(rawBody.title || 'Coupon chain').trim() || 'Coupon chain',
      mode,
      createdAt: new Date().toISOString(),
      coupons
    };

    const lists = readLists();
    lists.push(list);
    writeLists(lists);

    const baseUrl = getBaseUrl(req);
    const redeemLink = `${baseUrl}/l/${list.id}`;
    const managementLink = `${baseUrl}/l/${list.id}/manage?key=${list.managementKey}`;
    const qrCode = await createQRDataUrl(redeemLink);

    return res.status(201).json({
      id: list.id,
      redeemId: list.id,
      mode: list.mode,
      title: list.title,
      redeemLink,
      managementLink,
      qrCode,
      managementKey: list.managementKey
    });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to create list.' });
  }
});

app.get('/api/lists/:listId', enforceRateLimit, (req, res) => {
  const list = findListById(req.params.listId);
  if (!list) {
    return res.status(404).json({ error: 'List not found.' });
  }

  return res.json(getPublicListPayload(list));
});

app.get('/api/lists/:listId/manage', enforceRateLimit, requireManagementAccess, (req, res) => {
  return res.json(getPublicListPayload(req.list));
});

app.put('/api/lists/:listId', enforceRateLimit, requireManagementAccess, (req, res) => {
  const lists = readLists();
  const listIndex = lists.findIndex((entry) => entry.id === req.params.listId);
  if (listIndex === -1) {
    return res.status(404).json({ error: 'List not found.' });
  }

  const rawBody = req.body || {};
  const mode = String(rawBody.mode || lists[listIndex].mode || 'sequential').toLowerCase() === 'open' ? 'open' : 'sequential';
  const parsedCoupons = parseRawCoupons(rawBody.coupons ?? rawBody);
  if (!Array.isArray(parsedCoupons) || parsedCoupons.length === 0) {
    return res.status(400).json({ error: 'Provide at least one coupon.' });
  }

  lists[listIndex].mode = mode;
  lists[listIndex].title = String(rawBody.title || lists[listIndex].title || 'Coupon chain').trim() || 'Coupon chain';
  lists[listIndex].coupons = normalizeCoupons(parsedCoupons, mode);

  writeLists(lists);
  return res.json(getPublicListPayload(lists[listIndex]));
});

app.delete('/api/lists/:listId', enforceRateLimit, requireManagementAccess, (req, res) => {
  const lists = readLists().filter((entry) => entry.id !== req.params.listId);
  writeLists(lists);
  return res.json({ success: true });
});

app.post('/api/lists/:listId/coupons/:couponId/redeem', enforceRateLimit, (req, res) => {
  const list = findListById(req.params.listId);
  if (!list) {
    return res.status(404).json({ error: 'List not found.' });
  }

  const coupon = list.coupons.find((entry) => entry.id === req.params.couponId);
  if (!coupon) {
    return res.status(404).json({ error: 'Coupon not found.' });
  }

  if (list.mode === 'sequential') {
    if (coupon.status !== 'active') {
      return res.status(409).json({ error: 'Only the active coupon can be redeemed.' });
    }
    coupon.status = 'redeemed';
    const next = list.coupons.find((entry) => entry.status === 'locked');
    if (next) {
      next.status = 'active';
    }
    list.coupons.forEach((entry) => {
      if (entry.id !== coupon.id && entry.status === 'active' && entry.id !== next?.id) {
        entry.status = 'locked';
      }
    });
  } else {
    if (coupon.status === 'redeemed') {
      return res.status(409).json({ error: 'Coupon already redeemed.' });
    }
    coupon.status = 'redeemed';
  }

  const lists = readLists();
  const index = lists.findIndex((entry) => entry.id === list.id);
  if (index >= 0) {
    lists[index] = list;
    writeLists(lists);
  }

  return res.json(getPublicListPayload(list));
});

app.post('/api/lists/:listId/coupons/:couponId/skip', enforceRateLimit, (req, res) => {
  const list = findListById(req.params.listId);
  if (!list) {
    return res.status(404).json({ error: 'List not found.' });
  }

  if (list.mode !== 'sequential') {
    return res.status(400).json({ error: 'Skipping is only available in sequential mode.' });
  }

  const coupon = list.coupons.find((entry) => entry.id === req.params.couponId);
  if (!coupon) {
    return res.status(404).json({ error: 'Coupon not found.' });
  }

  if (coupon.status !== 'active') {
    return res.status(409).json({ error: 'Only the active coupon can be skipped.' });
  }

  coupon.status = 'skipped';
  list.coupons.forEach((entry) => {
    if (entry.status === 'active' && entry.id !== coupon.id) {
      entry.status = 'locked';
    }
  });

  const next = list.coupons.find((entry) => entry.status === 'locked');
  if (next) {
    next.status = 'active';
  }

  const lists = readLists();
  const index = lists.findIndex((entry) => entry.id === list.id);
  if (index >= 0) {
    lists[index] = list;
    writeLists(lists);
  }

  return res.json(getPublicListPayload(list));
});

app.get('*', (req, res) => {
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`Coupon list app listening on http://localhost:${PORT}`);
});
