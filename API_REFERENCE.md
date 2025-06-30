# API Reference - Trip Transportation Workflow System

## Authentication

All API endpoints except `/api/register` and `/api/login` require authentication. Include session cookies with requests.

### Authentication Endpoints

#### POST /api/register
Create a new user account.

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)",
  "firstName": "string (required)",
  "lastName": "string (required)",
  "email": "string (required)",
  "department": "string (required)",
  "role": "Employee" | "Department Manager" | "Project Manager" | "Finance" | "Admin"
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john.doe",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "department": "Engineering",
    "role": "Employee"
  }'
```

**Response:**
```json
{
  "id": 1,
  "username": "john.doe",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@company.com",
  "department": "Engineering",
  "role": "Employee",
  "isActive": true
}
```

#### POST /api/login
Authenticate user and create session.

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "username": "john.doe",
    "password": "SecurePass123!"
  }'
```

**Response:** User object (same as register)

#### POST /api/logout
Terminate user session.

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/logout \
  -b cookies.txt
```

**Response:** 200 OK

#### GET /api/user
Get current authenticated user information.

**cURL Example:**
```bash
curl -X GET https://your-domain.com/api/user \
  -b cookies.txt
```

**Response:** User object or 401 if not authenticated

## Trip Requests

### GET /api/trip-requests
Get trip requests based on user role and permissions.

**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 10)
- `status`: string (optional filter)
- `department`: string (optional filter)
- `project`: number (optional filter)

**cURL Example:**
```bash
curl -X GET "https://your-domain.com/api/trip-requests?page=1&limit=10&status=Pending" \
  -b cookies.txt
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "purpose": "Site inspection",
      "tripType": "Ticket",
      "status": "Pending Department Approval",
      "fromSite": "Amman Office",
      "toSite": "Irbid Branch",
      "distance": 85.5,
      "cost": 42.75,
      "tripDate": "2025-06-10T09:00:00Z",
      "submittedBy": "John Doe",
      "department": "Engineering",
      "project": "Network Upgrade",
      "createdAt": "2025-06-06T10:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "totalPages": 1
}
```

### POST /api/trip-requests
Create a new trip request.

**Request Body:**
```json
{
  "purpose": "string (required, max 500 chars)",
  "tripType": "Ticket" | "Planned" | "Urgent",
  "fromSiteId": "number (required)",
  "toSiteId": "number (required)",
  "tripDate": "ISO date string (required)",
  "projectId": "number (optional, required for Planned trips)",
  "attachmentPath": "string (optional, required for Urgent trips)"
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/trip-requests \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "purpose": "Network equipment maintenance at Irbid branch",
    "tripType": "Ticket",
    "fromSiteId": 1,
    "toSiteId": 5,
    "tripDate": "2025-06-15T09:00:00Z"
  }'
```

**Response:** Created trip request object

### GET /api/trip-requests/:id
Get specific trip request details.

**cURL Example:**
```bash
curl -X GET https://your-domain.com/api/trip-requests/123 \
  -b cookies.txt
```

**Response:** Trip request object with approval history

### PATCH /api/trip-requests/:id/status
Update trip request status (approval/rejection).

**Request Body:**
```json
{
  "status": "Approved" | "Rejected",
  "reason": "string (required for rejection)",
  "cost": "number (optional, for cost updates)"
}
```

**cURL Example (Approval):**
```bash
curl -X PATCH https://your-domain.com/api/trip-requests/123/status \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status": "Approved",
    "cost": 45.50
  }'
```

**cURL Example (Rejection):**
```bash
curl -X PATCH https://your-domain.com/api/trip-requests/123/status \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status": "Rejected",
    "reason": "Insufficient budget allocation for this quarter"
  }'
```

**Response:** Updated trip request object

## Bulk Operations

### POST /api/trip-requests/bulk-approve
Approve multiple trip requests.

**Request Body:**
```json
{
  "requestIds": [1, 2, 3]
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/trip-requests/bulk-approve \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "requestIds": [45, 46, 47]
  }'
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "results": [
    {"id": 1, "status": "Approved"},
    {"id": 2, "status": "Pending Finance Approval"}
  ],
  "errors": [
    {"id": 3, "error": "Budget exceeded. Available: 100 JD, Required: 150 JD"}
  ],
  "budgetImpact": {
    "allocations": 250.50,
    "deallocations": 0
  }
}
```

### POST /api/trip-requests/bulk-reject
Reject multiple trip requests.

**Request Body:**
```json
{
  "requestIds": [1, 2, 3],
  "reason": "string (required)"
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/trip-requests/bulk-reject \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "requestIds": [48, 49, 50],
    "reason": "Budget constraints for Q2 require postponement"
  }'
```

**Response:** Same format as bulk approve

## Administrative Requests

### GET /api/admin-requests
Get administrative requests.

**Response:** Array of admin request objects

### POST /api/admin-requests
Create administrative request.

**Request Body:**
```json
{
  "requestType": "Budget Increase" | "Department Change" | "Project Extension",
  "description": "string (required)",
  "details": "object (varies by request type)"
}
```

### PATCH /api/admin-requests/:id/status
Update administrative request status.

**Request Body:**
```json
{
  "status": "Approved" | "Rejected",
  "reason": "string (optional)"
}
```

## Departments

### GET /api/departments
Get all departments.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Engineering",
    "monthlyBudget": 5000.00,
    "monthlyBudgetBonus": 1000.00,
    "currentSpending": 2500.00,
    "primaryManagerId": 5,
    "secondaryManagerId": 6,
    "tertiaryManagerId": null,
    "isActive": true
  }
]
```

### POST /api/departments
Create new department (Admin only).

**Request Body:**
```json
{
  "name": "string (required)",
  "monthlyBudget": "number (required)",
  "monthlyBudgetBonus": "number (default: 0)",
  "primaryManagerId": "number (required)",
  "secondaryManagerId": "number (optional)",
  "tertiaryManagerId": "number (optional)"
}
```

### PATCH /api/departments/:id/budget
Update department budget.

**Request Body:**
```json
{
  "amount": "number (required)"
}
```

## Projects

### GET /api/projects
Get projects based on user permissions.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Network Upgrade",
    "description": "Infrastructure improvement project",
    "budget": 10000.00,
    "currentSpending": 3500.00,
    "availableBudget": 6500.00,
    "startDate": "2025-01-01T00:00:00Z",
    "expiryDate": "2025-12-31T23:59:59Z",
    "department": "Engineering",
    "primaryManagerId": 7,
    "secondaryManagerId": null,
    "isActive": true
  }
]
```

### POST /api/projects
Create new project (Admin only).

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "budget": "number (required)",
  "startDate": "ISO date string (required)",
  "expiryDate": "ISO date string (required)",
  "department": "string (required)",
  "primaryManagerId": "number (required)",
  "secondaryManagerId": "number (optional)"
}
```

### PATCH /api/projects/:id/budget
Update project budget.

**Request Body:**
```json
{
  "amount": "number (required)"
}
```

## Sites

### GET /api/sites
Get all active sites.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Amman Office",
    "abbreviation": "AMN",
    "address": "Downtown Amman",
    "latitude": 31.9454,
    "longitude": 35.9284,
    "isActive": true
  }
]
```

### POST /api/sites
Create new site (Admin only).

**Request Body:**
```json
{
  "name": "string (required)",
  "abbreviation": "string (required, 3 chars)",
  "address": "string (required)",
  "latitude": "number (required)",
  "longitude": "number (required)"
}
```

### GET /api/distances/:fromSiteId/:toSiteId
Get distance between two sites.

**Response:**
```json
{
  "distance": 85.5,
  "duration": 75,
  "routeType": "fastest"
}
```

## Users

### GET /api/users
Get all users (Admin only).

**Response:** Array of user objects

### PATCH /api/users/:id/role
Update user role (Admin only).

**Request Body:**
```json
{
  "role": "Employee" | "Department Manager" | "Project Manager" | "Finance" | "Admin"
}
```

### PATCH /api/users/:id/status
Activate/deactivate user (Admin only).

**Request Body:**
```json
{
  "isActive": true | false
}
```

## System Configuration

### GET /api/system-settings
Get system configuration.

**Response:**
```json
[
  {
    "key": "maxKmForTertiaryApproval",
    "value": "[configurable]",
    "description": "Maximum km requiring tertiary manager approval"
  }
]
```

### PATCH /api/system-settings/:key
Update system setting (Admin only).

**Request Body:**
```json
{
  "value": "string (required)"
}
```

## KM Rates

### GET /api/km-rates
Get current kilometer rates.

**Response:**
```json
[
  {
    "id": 1,
    "rate": 0.50,
    "currency": "JD",
    "effectiveFrom": "2025-01-01T00:00:00Z",
    "isActive": true
  }
]
```

### POST /api/km-rates
Create new KM rate (Admin only).

**Request Body:**
```json
{
  "rate": "number (required)",
  "currency": "string (default: JD)",
  "effectiveFrom": "ISO date string (required)"
}
```

## Audit Logs

### GET /api/audit-logs
Get audit trail (Admin and Finance only).

**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 50)
- `userId`: number (optional filter)
- `action`: string (optional filter)
- `startDate`: ISO date string (optional)
- `endDate`: ISO date string (optional)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "userId": 5,
      "userName": "John Doe",
      "action": "Trip Request Approved",
      "resourceType": "TripRequest",
      "resourceId": 123,
      "details": "Approved ticket trip to Irbid",
      "timestamp": "2025-06-06T10:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "totalPages": 1
}
```

## Reports

### GET /api/reports/monthly
Get monthly spending report.

**Query Parameters:**
- `month`: number (1-12)
- `year`: number
- `department`: string (optional)

**Response:**
```json
{
  "month": 6,
  "year": 2025,
  "department": "Engineering",
  "totalTrips": 25,
  "totalSpending": 1250.75,
  "averageCost": 50.03,
  "budgetUtilization": 0.65
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": "Additional error details (optional)"
}
```

### Common Error Codes
- `AUTHENTICATION_REQUIRED`: 401 - User not authenticated
- `INSUFFICIENT_PERMISSIONS`: 403 - User lacks required permissions
- `RESOURCE_NOT_FOUND`: 404 - Requested resource doesn't exist
- `VALIDATION_ERROR`: 400 - Invalid request data
- `BUDGET_EXCEEDED`: 400 - Insufficient budget for operation
- `WORKFLOW_VIOLATION`: 400 - Invalid workflow state transition

## Rate Limiting

API requests are limited to prevent abuse:
- **General endpoints**: 100 requests per minute per user
- **Bulk operations**: 10 requests per minute per user
- **File uploads**: 5 requests per minute per user

Exceeded limits return 429 status with retry-after header.

## File Uploads

### POST /api/upload
Upload files for trip requests.

**Request:** Multipart form data with file field

**Response:**
```json
{
  "filename": "document_123.pdf",
  "path": "/uploads/2025/06/document_123.pdf",
  "size": 2048576
}
```

**Limits:**
- Maximum file size: 10MB
- Allowed types: PDF, JPG, PNG, DOC, DOCX
- Maximum 5 files per request

This API reference covers all available endpoints in the Trip Transportation Workflow System. Use proper authentication and follow the documented request/response formats for optimal integration.