# API Examples

This document provides examples for using the Client-Flow API with API keys.

## Authentication

All API requests require a Bearer token in the Authorization header:

```bash
Authorization: Bearer sk_live_your_api_key_here
```

## Base URL

```
http://localhost:3001/api/external
```

---

## Available Resources

| Resource | Endpoint | Description |
|----------|----------|-------------|
| `clients` | `/clients` | Customer accounts |
| `jobs` | `/jobs` | Jobs/projects |
| `invoices` | `/invoices` | Invoices |
| `payments` | `/payments` | Payment records |
| `assets` | `/assets` | Fixed assets |
| `issues` | `/issues` | Issues/tickets |
| `vendors` | `/vendors` | Vendor/supplier records |
| `items` | `/items` | Inventory items |
| `expenses` | `/expenses` | Expense records |
| `timesheets` | `/timesheets` | Time entries |
| `bank-accounts` | `/bank-accounts` | Bank accounts |
| `bank-transactions` | `/bank-transactions` | Bank transactions |
| `profiles` | `/profiles` | User profiles |
| `locations` | `/locations` | Locations |
| `kb-articles` | `/kb-articles` | Knowledge base articles |

---

## Examples

### Create an API Key (via UI)

1. Navigate to `/api-keys` in the app
2. Click "Create API Key"
3. Enter a name, select scopes, and set expiration
4. Copy the key immediately - it won't be shown again

### List All Clients

```bash
curl -X GET "http://localhost:3001/api/external/clients" \
  -H "Authorization: Bearer sk_live_your_api_key_here"
```

**Response:**
```json
{
  "data": [
    {
      "id": "abc123",
      "name": "Acme Corp",
      "trading_name": "Acme",
      "email": "contact@acme.com",
      "is_active": 1
    }
  ]
}
```

### Get Single Client

```bash
curl -X GET "http://localhost:3001/api/external/clients/abc123" \
  -H "Authorization: Bearer sk_live_your_api_key_here"
```

### Create a New Client

```bash
curl -X POST "http://localhost:3001/api/external/clients" \
  -H "Authorization: Bearer sk_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Customer Inc",
    "contact_email": "hello@newcustomer.com",
    "payment_terms": 30,
    "is_active": 1
  }'
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "generated-uuid",
    "name": "New Customer Inc",
    "contact_email": "hello@newcustomer.com",
    "payment_terms": 30,
    "is_active": 1
  }
}
```

### Update a Client

```bash
curl -X PATCH "http://localhost:3001/api/external/clients/abc123" \
  -H "Authorization: Bearer sk_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "payment_terms": 14
  }'
```

### Delete a Client

```bash
curl -X DELETE "http://localhost:3001/api/external/clients/abc123" \
  -H "Authorization: Bearer sk_live_your_api_key_here"
```

**Response:** `204 No Content`

---

## Jobs

### List All Jobs

```bash
curl -X GET "http://localhost:3001/api/external/jobs" \
  -H "Authorization: Bearer sk_live_your_api_key_here"
```

### Create a Job

```bash
curl -X POST "http://localhost:3001/api/external/jobs" \
  -H "Authorization: Bearer sk_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Website Redesign",
    "client_id": "client-uuid-here",
    "status": "in_progress",
    "budget": 5000
  }'
```

---

## Invoices

### List All Invoices

```bash
curl -X GET "http://localhost:3001/api/external/invoices" \
  -H "Authorization: Bearer sk_live_your_api_key_here"
```

### Create an Invoice

```bash
curl -X POST "http://localhost:3001/api/external/invoices" \
  -H "Authorization: Bearer sk_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client-uuid-here",
    "invoice_number": "INV-001",
    "issue_date": "2026-01-25",
    "due_date": "2026-02-08",
    "subtotal": 1000,
    "tax": 100,
    "total": 1100,
    "status": "draft"
  }'
```

---

## Time Entries

### Log Time to a Job

```bash
curl -X POST "http://localhost:3001/api/external/timesheets" \
  -H "Authorization: Bearer sk_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "job-uuid-here",
    "user_id": "user-uuid-here",
    "date": "2026-01-25",
    "hours": 2.5,
    "description": "Development work",
    "is_billable": 1,
    "hourly_rate": 150
  }'
```

---

## Issues

### Create an Issue

```bash
curl -X POST "http://localhost:3001/api/external/issues" \
  -H "Authorization: Bearer sk_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bug: Login not working",
    "description": "Users cannot log in from mobile",
    "status": "open",
    "priority": "high"
  }'
```

### Update Issue Status

```bash
curl -X PATCH "http://localhost:3001/api/external/issues/issue-uuid" \
  -H "Authorization: Bearer sk_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved"
  }'
```

---

## Inventory Items

### List Inventory

```bash
curl -X GET "http://localhost:3001/api/external/items" \
  -H "Authorization: Bearer sk_live_your_api_key_here"
```

### Create Inventory Item

```bash
curl -X POST "http://localhost:3001/api/external/items" \
  -H "Authorization: Bearer sk_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Widget A",
    "sku": "WGT-001",
    "quantity": 100,
    "unit_cost": 5.50,
    "sale_price": 12.00
  }'
```

---

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Invalid or revoked API key"
}
```

### 403 Forbidden

```json
{
  "error": "API key does not have access to this resource"
}
```

Or if user lacks permissions:

```json
{
  "error": "Permission denied: no write access to this resource"
}
```

### 400 Bad Request

```json
{
  "error": "Invalid resource",
  "available_resources": ["clients", "jobs", "invoices", ...]
}
```

---

## API Key Scopes

When creating an API key, you can limit access to specific resources:

| Scope | Resources Accessible |
|-------|---------------------|
| `*` | All resources |
| `clients` | Clients only |
| `jobs` | Jobs and timesheets |
| `invoices` | Invoices only |
| `payments` | Payments only |
| `assets` | Assets only |
| `issues` | Issues only |
| `vendors` | Vendors only |
| `inventory` | Inventory items |
| `expenses` | Expenses only |
| `banking` | Bank accounts and transactions |

---

## Rate Limits

Currently, there are no rate limits enforced. For production use, consider implementing rate limiting at the reverse proxy level.

---

## Request Logging

All API requests are logged and can be viewed in the UI under API Keys > Request Logs. Logged information includes:

- Timestamp
- API key name (which key made the request)
- HTTP method
- Endpoint
- Status code
- Response time (ms)
- IP address
- Request body (for POST/PUT/PATCH)

### Viewing Logs per API Key

1. Navigate to **Settings > API Keys**
2. Click the **Activity icon** (chart icon) next to any API key
3. The view switches to the Request Logs tab filtered to that key's usage
4. Click **Show All** to see all API requests again

### Activity Log Integration

All create, update, and delete operations via the API are also recorded in the main Activity Log (`/activity-log`):
- **Source:** Shows "API" badge for API-originated changes vs "Browser" for UI changes
- **API Key:** Displays which API key made the change
- **Filter:** Use the Source dropdown to filter by Browser, API, or All Sources

---

## Integration Examples

### Python

```python
import requests

API_KEY = "sk_live_your_api_key_here"
BASE_URL = "http://localhost:3001/api/external"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# List clients
response = requests.get(f"{BASE_URL}/clients", headers=headers)
clients = response.json()["data"]

# Create a job
job_data = {
    "name": "New Project",
    "client_id": clients[0]["id"],
    "status": "pending"
}
response = requests.post(f"{BASE_URL}/jobs", headers=headers, json=job_data)
new_job = response.json()["data"]
```

### JavaScript/Node.js

```javascript
const API_KEY = 'sk_live_your_api_key_here';
const BASE_URL = 'http://localhost:3001/api/external';

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

// List clients
const response = await fetch(`${BASE_URL}/clients`, { headers });
const { data: clients } = await response.json();

// Create a job
const jobResponse = await fetch(`${BASE_URL}/jobs`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    name: 'New Project',
    client_id: clients[0].id,
    status: 'pending'
  })
});
const { data: newJob } = await jobResponse.json();
```

### cURL Script

```bash
#!/bin/bash
API_KEY="sk_live_your_api_key_here"
BASE_URL="http://localhost:3001/api/external"

# List all clients
curl -s "$BASE_URL/clients" \
  -H "Authorization: Bearer $API_KEY" | jq .

# Create a new client
curl -s -X POST "$BASE_URL/clients" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Client", "is_active": 1}' | jq .
```
