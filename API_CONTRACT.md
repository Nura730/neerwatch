# NEERWATCH — API Contract

## Overview

All endpoints are prefixed with `/api`. All responses use the standard envelope:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

No authentication is required in the prototype phase.

### id vs _id Convention

MongoDB documents carry an internal `_id` field. The public API **never exposes `_id`**. All API responses use a string field named `id` wherever a document identifier is needed (e.g., cluster `id`, alert `id`). The mapping from `_id` to `id` is performed by the backend before returning responses.

---

## Observation Object (Frontend Format)

When submitting observations, the frontend sends coordinates as `lat`/`lng`. The backend converts to GeoJSON internally.

```json
{
  "clientId": "client-generated-unique-id",
  "householdId": "HH-001",
  "testType": "TDS",
  "result": 320,
  "testedAt": "2024-03-15T09:30:00.000Z",
  "location": {
    "lat": 18.5204,
    "lng": 73.8567
  },
  "wardId": "ward-12"
}
```

`location` is optional. Omit it entirely (or pass `null`) when GPS is unavailable.

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientId` | string | Yes | Client-generated unique ID; used as idempotency key |
| `householdId` | string | Yes | Identifier of the sampled household |
| `testType` | string | Yes | One of: `"TDS"`, `"pH"`, `"turbidity"`, `"coliform"` |
| `result` | number | Yes | Numeric test result value |
| `testedAt` | string (ISO 8601) | Yes | Timestamp when the test was performed |
| `location.lat` | number | Conditional | Latitude; required if `location` is provided; range [-90, 90] |
| `location.lng` | number | Conditional | Longitude; required if `location` is provided; range [-180, 180] |
| `wardId` | string | Yes | Ward identifier |

### Coordinate Convention

The frontend always uses:
```json
{ "location": { "lat": 18.5204, "lng": 73.8567 } }
```

MongoDB stores GeoJSON:
```json
{ "location": { "type": "Point", "coordinates": [73.8567, 18.5204] } }
```

The backend performs this conversion. API responses return `lat`/`lng`, not raw GeoJSON arrays.

### Missing Location

Observations without `location` are accepted and stored. They appear in list and dashboard responses but are excluded from map and spatial cluster detection.

---

## Endpoints

---

### GET /api/dashboard

**Purpose:** Returns aggregated summary statistics for the dashboard overview.

**Request:** No parameters.

**Success Response — 200:**
```json
{
  "success": true,
  "data": {
    "totalTests": 1240,
    "positiveTests": 421,
    "activeClusters": 3,
    "pendingSync": 12,
    "missingLocations": 47
  }
}
```

| Field | Description |
|-------|-------------|
| `totalTests` | Total number of observations in the database |
| `positiveTests` | Number of observations with a positive (failing) result |
| `activeClusters` | Number of currently active clusters |
| `pendingSync` | Number of observations that have been received but not yet fully processed |
| `missingLocations` | Number of observations stored with `location: null` |

**Error Response — 500:**
```json
{
  "success": false,
  "message": "Failed to load dashboard data"
}
```

---

### POST /api/tests

**Purpose:** Create a single water-test observation.

**Request Body:** A single observation object (see Observation Object above).

**Success Response — 201:**
```json
{
  "success": true,
  "data": {
    "clientId": "abc-123",
    "householdId": "HH-001",
    "testType": "TDS",
    "result": 320,
    "testedAt": "2024-03-15T09:30:00.000Z",
    "location": { "lat": 18.5204, "lng": 73.8567 },
    "wardId": "ward-12",
    "createdAt": "2024-03-15T09:35:00.000Z"
  }
}
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 400 | Missing required fields, invalid `testType`, invalid `result`, invalid `testedAt`, invalid `location` values |
| 409 | `clientId` already exists (duplicate) |
| 500 | Unexpected server error |

```json
{
  "success": false,
  "message": "testType must be one of: TDS, pH, turbidity, coliform"
}
```

**Validation Rules:**
- `clientId`, `householdId`, `testType`, `result`, `testedAt`, `wardId` are required.
- `testType` must be one of `"TDS"`, `"pH"`, `"turbidity"`, `"coliform"`.
- `result` must be a finite number.
- `testedAt` must be a valid ISO 8601 date string.
- If `location` is provided, both `lat` and `lng` must be present, finite numbers within valid ranges.

---

### GET /api/tests

**Purpose:** Retrieve a paginated list of observations.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number, default `1` |
| `limit` | integer | No | Results per page, default `20`, max `100` |
| `wardId` | string | No | Filter by ward |
| `testType` | string | No | Filter by test type |
| `from` | string (ISO 8601) | No | Filter `testedAt` >= this date |
| `to` | string (ISO 8601) | No | Filter `testedAt` <= this date |

**Success Response — 200:**
```json
{
  "success": true,
  "data": {
    "observations": [
      {
        "clientId": "abc-123",
        "householdId": "HH-001",
        "testType": "TDS",
        "result": 320,
        "testedAt": "2024-03-15T09:30:00.000Z",
        "location": { "lat": 18.5204, "lng": 73.8567 },
        "wardId": "ward-12",
        "createdAt": "2024-03-15T09:35:00.000Z"
      }
    ],
    "total": 1240,
    "page": 1,
    "limit": 20
  }
}
```

**Error Response — 400:** Invalid query parameter values.

---

### GET /api/tests/map

**Purpose:** Retrieve observations that have a valid location, for map rendering.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wardId` | string | No | Filter by ward |
| `testType` | string | No | Filter by test type |
| `from` | string (ISO 8601) | No | Filter `testedAt` >= this date |
| `to` | string (ISO 8601) | No | Filter `testedAt` <= this date |

**Behaviour:** Only observations with a non-null `location` are returned. Observations without location are excluded.

**Success Response — 200:**
```json
{
  "success": true,
  "data": {
    "observations": [
      {
        "clientId": "abc-123",
        "householdId": "HH-001",
        "testType": "TDS",
        "result": 320,
        "testedAt": "2024-03-15T09:30:00.000Z",
        "location": { "lat": 18.5204, "lng": 73.8567 },
        "wardId": "ward-12"
      }
    ]
  }
}
```

**Error Response — 500:** Server error.

---

### POST /api/tests/sync

**Purpose:** Batch upload of offline-queued observations. Idempotent — safe to call multiple times with the same payload.

**Request Body:**
```json
{
  "observations": [
    {
      "clientId": "abc-123",
      "householdId": "HH-001",
      "testType": "TDS",
      "result": 320,
      "testedAt": "2024-03-15T09:30:00.000Z",
      "location": { "lat": 18.5204, "lng": 73.8567 },
      "wardId": "ward-12"
    }
  ]
}
```

**Idempotency:** If a `clientId` in the batch already exists in the database, that observation is counted as a duplicate and skipped. No error is raised and no duplicate document is created.

**Success Response — 200:**
```json
{
  "success": true,
  "data": {
    "processed": 5,
    "created": 3,
    "duplicates": 2,
    "failed": 0
  }
}
```

| Field | Description |
|-------|-------------|
| `processed` | Total observations in the batch |
| `created` | Successfully inserted new observations |
| `duplicates` | Skipped because `clientId` already existed |
| `failed` | Rejected due to validation or unexpected error |

**Partial Success:** Items that fail validation are counted in `failed` but do not block the rest of the batch. The overall response is `200` as long as the batch was processed.

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 400 | `observations` field missing or not an array |
| 500 | Unexpected server error |

---

### GET /api/clusters

**Purpose:** Retrieve detected spatial-temporal clusters.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `active` | boolean | No | If `true`, return only active (unresolved) clusters |
| `wardId` | string | No | Filter by ward |

**Success Response — 200:**
```json
{
  "success": true,
  "data": {
    "clusters": [
      {
        "id": "cluster-id-1",
        "testType": "TDS",
        "centroid": { "lat": 18.5204, "lng": 73.8567 },
        "radiusMetres": 500,
        "observationCount": 5,
        "failureRate": 0.8,
        "windowStart": "2024-03-08T00:00:00.000Z",
        "windowEnd": "2024-03-15T00:00:00.000Z",
        "wardId": "ward-12",
        "detectedAt": "2024-03-15T10:00:00.000Z",
        "active": true
      }
    ]
  }
}
```

**Note:** Cluster detection is rule-based (no ML). Parameters: 500 m radius, 7-day window, minimum 3 failing observations.

**Error Response — 500:** Server error.

---

### GET /api/alerts

**Purpose:** Retrieve alerts generated from detected clusters.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `active` | boolean | No | If `true`, return only unresolved alerts |
| `wardId` | string | No | Filter by ward |

**Success Response — 200:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert-id-1",
        "clusterId": "cluster-id-1",
        "severity": "high",
        "message": "High TDS cluster detected in ward-12",
        "wardId": "ward-12",
        "createdAt": "2024-03-15T10:00:00.000Z",
        "resolved": false
      }
    ]
  }
}
```

**Error Response — 500:** Server error.

---

### GET /api/rainfall

**Purpose:** Retrieve rainfall context readings for frontend overlay.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wardId` | string | No | Filter by ward |
| `from` | string (ISO 8601) | No | Filter `recordedAt` >= this date |
| `to` | string (ISO 8601) | No | Filter `recordedAt` <= this date |

**Success Response — 200:**
```json
{
  "success": true,
  "data": {
    "rainfall": [
      {
        "wardId": "ward-12",
        "rainfallMm": 12.5,
        "recordedAt": "2024-03-15T00:00:00.000Z"
      }
    ]
  }
}
```

**Note:** Rainfall data is synthetic in the prototype.

**Error Response — 500:** Server error.

---

### GET /api/wards

**Purpose:** Retrieve per-ward aggregated summary statistics.

**Request:** No parameters.

**Success Response — 200:**
```json
{
  "success": true,
  "data": {
    "wards": [
      {
        "wardId": "ward-12",
        "name": "Ward 12",
        "totalTests": 80,
        "passCount": 53,
        "failCount": 27,
        "failureRate": 0.34,
        "lastTestedAt": "2024-03-15T09:30:00.000Z"
      }
    ]
  }
}
```

**Error Response — 500:** Server error.

---

## Endpoint Summary

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/dashboard` | Dashboard summary statistics |
| POST | `/api/tests` | Create a single observation |
| GET | `/api/tests` | List observations (paginated, filterable) |
| GET | `/api/tests/map` | List observations with location (map view) |
| POST | `/api/tests/sync` | Batch sync offline observations (idempotent) |
| GET | `/api/clusters` | List detected clusters |
| GET | `/api/alerts` | List alerts |
| GET | `/api/rainfall` | Rainfall context readings |
| GET | `/api/wards` | Per-ward aggregated statistics |
