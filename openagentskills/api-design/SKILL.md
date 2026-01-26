---
name: api-design
description: Design and implement RESTful APIs with best practices for naming, versioning, error handling, and documentation. Use this skill when building backend services.
version: 1.0.0
license: MIT
compatibility: Any HTTP server framework
---

# API Design

Use this skill when designing or implementing RESTful APIs.

## Instructions

### URL Naming Conventions

1. Use nouns for resources: `/users`, `/orders`
2. Use plural form: `/users` not `/user`
3. Use kebab-case for multi-word: `/order-items`
4. Use path parameters for IDs: `/users/{id}`
5. Use query parameters for filtering: `/users?role=admin`

### HTTP Methods

| Method | Purpose | Idempotent |
|--------|---------|------------|
| GET | Retrieve resource(s) | Yes |
| POST | Create resource | No |
| PUT | Replace resource | Yes |
| PATCH | Partial update | Yes |
| DELETE | Remove resource | Yes |

### Response Formats

#### Success Response
```json
{
  "data": {
    "id": "123",
    "name": "John Doe"
  }
}
```

#### List Response
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": [
      {
        "field": "email",
        "message": "This field is required"
      }
    ]
  }
}
```

### Status Codes

| Code | Usage |
|------|-------|
| 200 | Success (GET, PUT, PATCH) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |
| 500 | Server Error |

### Versioning

Prefer URL versioning for clarity:
```
/api/v1/users
/api/v2/users
```

### Rate Limiting

Include headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Authentication

Use Bearer tokens:
```
Authorization: Bearer <token>
```
