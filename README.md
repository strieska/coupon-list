# Coupon List App

This app supports multiple isolated coupon lists, each with a redeem-only share link and a separate private management link. Lists can run in either `sequential` or `open` mode.

## Run locally

### Node.js

```bash
npm install
npm start
```

Then browse to:

- http://localhost:3000/
- http://localhost:3000/new

### Docker

```bash
docker compose up --build
```

Then browse to http://localhost:3000/new to create a list.

## Main routes

- `/new` — create a new list
- `/l/:listId` — public redeem page
- `/l/:listId/manage?key=:secret` — creator management page

## Creation flow

Open `/new`, input one or more coupon items, choose a mode, and submit. The server returns:

- redeem link
- private management link
- QR code image for the redeem link

The title is shown on the public redeem page and can be changed later from the management page.

## API reference

### Create list

```http
POST /api/lists
Content-Type: application/json
```

Body example:

```json
{
  "mode": "sequential",
  "title": "Birthday treats",
  "expiresAt": "2027-01-20T18:00:00.000Z",
  "coupons": [
    { "title": "Free coffee", "description": "Complimentary coffee for one person." },
    { "title": "Movie night", "description": "Two tickets for a weekend screening." }
  ]
}
```

Response example:

```json
{
  "id": "b622d4d1-7f5a-456f-b846-fb22a26d1a3d",
  "redeemId": "b622d4d1-7f5a-456f-b846-fb22a26d1a3d",
  "mode": "sequential",
  "redeemLink": "http://localhost:3000/l/b622d4d1-7f5a-456f-b846-fb22a26d1a3d",
  "managementLink": "http://localhost:3000/l/b622d4d1-7f5a-456f-b846-fb22a26d1a3d/manage?key=abc123",
  "qrCode": "data:image/png;base64,...",
  "managementKey": "abc123"
}
```

### Fetch public list

```http
GET /api/lists/:listId
```

Returns the current list state for rendering the share page.

### Fetch list in management mode

```http
GET /api/lists/:listId/manage?key=:secret
```

Requires the management key.

### Edit/replace list

```http
PUT /api/lists/:listId?key=:secret
Content-Type: application/json
```

Body example:

```json
{
  "mode": "open",
  "title": "Weekend surprises",
  "expiresAt": null,
  "coupons": [
    { "title": "Free coffee", "description": "Complimentary coffee for one person." },
    { "title": "Dinner for two", "description": "A two-person dinner voucher." }
  ]
}
```

### Delete list

```http
DELETE /api/lists/:listId?key=:secret
```

### Redeem a coupon in a list

```http
POST /api/lists/:listId/coupons/:couponId/redeem
```

For `open` mode, any visible coupon can be redeemed independently.

For `sequential` mode, only the active coupon can be redeemed.

### Skip a coupon in a list

```http
POST /api/lists/:listId/coupons/:couponId/skip
```

Only valid in `sequential` mode and only for the active coupon.

## Example curl calls

Create a list:

```bash
curl -X POST http://localhost:3000/api/lists \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sequential",
    "coupons": [
      {"title":"Free coffee","description":"Complimentary coffee for one person."},
      {"title":"Movie night","description":"Two tickets for a weekend screening."}
    ]
  }'
```

Delete a list:

```bash
curl -X DELETE "http://localhost:3000/api/lists/<list-id>?key=<management-key>"
```

Replace the coupons in a list:

```bash
curl -X PUT "http://localhost:3000/api/lists/<list-id>?key=<management-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "open",
    "coupons": [
      {"title":"Free lunch","description":"A lunch gift voucher."},
      {"title":"Spa pass","description":"One weekday spa session."}
    ]
  }'
```

Fetch a public list:

```bash
curl http://localhost:3000/api/lists/<list-id>
```

## Notes

- The app stores all list data in `data/lists.json`.
- Management keys are kept separate from the redeem IDs; the redeem link cannot delete or edit the list.
- Rate limiting is intentionally basic and lightweight for local/self-hosted use.
