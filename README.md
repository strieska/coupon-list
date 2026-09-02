# Coupon App

A simple single-user web app for tracking a sequential chain of redeemable coupons.

## Features

- Only one coupon is active at a time.
- Locked coupons stay hidden until they unlock.
- Active coupons can be redeemed or skipped.
- Redeemed and skipped coupons remain visible, but become inactive and grayed out.
- Local Docker setup for self-hosted use.

## Run locally

### Option 1: Plain Node.js

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser.

### Option 2: Docker Compose

```bash
docker compose up --build
```

Open http://localhost:3000 in your browser.

## API reference

### Fetch coupons

```http
GET /api/coupons
```

Returns the current coupon list in order. Each object looks like:

```json
[
  {
    "id": 1,
    "title": "Free coffee",
    "description": "A complimentary coffee for one person.",
    "status": "active"
  }
]
```

Valid statuses:

- `active`
- `locked`
- `redeemed`
- `skipped`

### Delete all coupons

```http
DELETE /api/coupons
```

Clears the entire list and resets the application state.

### Bulk add / replace coupons

```http
POST /api/coupons/bulk
Content-Type: application/json
```

Accepted payloads:

```json
[
  { "title": "Free coffee", "description": "A complimentary coffee for one person." },
  { "title": "Movie night", "description": "Two tickets for a weekend screening." }
]
```

Or:

```json
{
  "coupons": [
    { "title": "Free coffee", "description": "A complimentary coffee for one person." },
    { "title": "Movie night", "description": "Two tickets for a weekend screening." }
  ]
}
```

This replaces the current list, resets state, and makes the first coupon active.

### Redeem an active coupon

```http
POST /api/coupons/1/redeem
```

Marks the first coupon as redeemed and unlocks the next coupon in the chain.

### Skip an active coupon

```http
POST /api/coupons/1/skip
```

Marks the first coupon as skipped and unlocks the next coupon in the chain.

## Example curl calls

Delete all coupons:

```bash
curl -X DELETE http://localhost:3000/api/coupons
```

Bulk replace with a list:

```bash
curl -X POST http://localhost:3000/api/coupons/bulk \
  -H "Content-Type: application/json" \
  -d '[
    {"title":"Free coffee","description":"A complimentary coffee for one person."},
    {"title":"Dinner for two","description":"A free dinner voucher for two."}
  ]'
```

Fetch current list:

```bash
curl http://localhost:3000/api/coupons
```

Redeem the current active coupon:

```bash
curl -X POST http://localhost:3000/api/coupons/1/redeem
```

## Notes

- The app stores data in the local `data/coupons.json` file.
- For a single-user self-hosted deployment, this is enough for local use.
