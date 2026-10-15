# Hackathon Team Randomizer API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:5000/api/v1`  
**Authentication Scheme:** Bearer Token (`Authorization: Bearer <JWT>`) or HTTP-Only cookie `token`

---

## 1. Global Specifications

### Standard Success Response
Every successful API call returns HTTP 200/201 with this standardized payload:
```json
{
  "success": true,
  "message": "Teams generated and saved successfully",
  "data": {},
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### Standard Error Response
Every failed API call returns an appropriate HTTP 4xx/5xx code with this standardized payload:
```json
{
  "success": false,
  "message": "Insufficient first-year students",
  "errors": [
    {
      "field": "firstYearStudentIds",
      "message": "A team must have exactly 2 first-year students"
    }
  ]
}
```

---

## 2. Authentication Endpoints

### `POST /api/v1/auth/login`
Authenticates an administrator and returns a JWT token.
- **Access:** Public (Rate-limited: 30 attempts per 15 minutes)
- **Request Body:**
  ```json
  {
    "email": "admin@hackathon.edu",
    "password": "AdminSecurePassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Authentication successful",
    "data": {
      "token": "eyJhbGciOi...",
      "admin": {
        "_id": "67b0c9...",
        "name": "Super Admin",
        "email": "admin@hackathon.edu",
        "role": "SUPER_ADMIN",
        "createdAt": "2026-10-15T12:00:00.000Z"
      }
    }
  }
  ```

### `GET /api/v1/auth/me`
Retrieves the profile of the currently logged-in administrator.
- **Access:** Admin only
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** Current admin object.

### `POST /api/v1/auth/change-password`
Changes the current admin's password.
- **Access:** Admin only
- **Request Body:**
  ```json
  {
    "currentPassword": "AdminSecurePassword123!",
    "newPassword": "NewAdminSecurePassword123!"
  }
  ```
- **Response (200 OK):** `{ "success": true, "message": "Password updated successfully." }`

### `POST /api/v1/auth/logout`
Clears session cookie and invalidates client session.
- **Access:** Admin only
- **Response (200 OK):** `{ "success": true, "message": "Logged out successfully" }`

---

## 3. Student Management Endpoints

### `GET /api/v1/students`
Search, filter, and paginate student records.
- **Access:** Admin only
- **Query Parameters:**
  - `page` (integer, default: 1)
  - `limit` (integer, default: 20, max: 200)
  - `search` (string, searches `fullName`, `studentId`, `department`, `email`)
  - `academicYear` (`FIRST_YEAR` | `SECOND_YEAR`)
  - `status` (`ACTIVE` | `INACTIVE`)
  - `department` (string)
  - `sortBy` (field name, default: `createdAt`)
  - `sortOrder` (`asc` | `desc`, default: `desc`)

### `POST /api/v1/students`
Creates a single student record.
- **Access:** Admin only
- **Request Body:**
  ```json
  {
    "fullName": "Aryan Nair",
    "studentId": "FY-CS-101",
    "email": "aryan.nair@college.edu",
    "academicYear": "FIRST_YEAR",
    "department": "Computer Science",
    "skills": ["JavaScript", "HTML", "CSS"],
    "status": "ACTIVE"
  }
  ```

### `POST /api/v1/students/bulk`
Bulk import students with row-level validation. Supports either:
1. **Multipart Form File Upload:** Field `file` containing `.csv` file.
2. **JSON Array:**
   ```json
   {
     "students": [
       {
         "fullName": "Aryan Nair",
         "studentId": "FY-CS-101",
         "academicYear": "FIRST_YEAR",
         "department": "Computer Science"
       }
     ]
   }
   ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Bulk import completed: 15 imported successfully, 2 failed.",
    "data": {
      "totalProcessed": 17,
      "successCount": 15,
      "failedCount": 2,
      "errors": [
        {
          "row": 3,
          "studentId": "FY-CS-101",
          "errors": ["Student ID 'FY-CS-101' already exists in the database"]
        }
      ]
    }
  }
  ```

### `GET /api/v1/students/:id`
Retrieves a single student by MongoDB ID.

### `PATCH /api/v1/students/:id`
Partially updates a student record. Validates uniqueness if `studentId` or `email` are updated.

### `DELETE /api/v1/students/:id`
Safely deletes or deactivates a student:
- If referenced in any past team generation snapshot: automatically deactivates student (`status = INACTIVE`) to preserve historical integrity.
- If not referenced in any generation: permanently removes record.

---

## 4. Mentor Management Endpoints

### `GET /api/v1/mentors`
Retrieves paginated mentors with optional search and status filtering.

### `POST /api/v1/mentors`
Creates a new mentor.
- **Request Body:**
  ```json
  {
    "fullName": "Dr. Ramesh Kumar",
    "mentorId": "MTR-001",
    "email": "ramesh.kumar@college.edu",
    "expertise": ["Cloud Architecture", "AWS", "DevOps"],
    "status": "ACTIVE"
  }
  ```

### `POST /api/v1/mentors/bulk`
Bulk imports mentors from CSV file or JSON array with row-level validation.

### `GET /api/v1/mentors/:id`
Retrieves mentor details.

### `PATCH /api/v1/mentors/:id`
Updates mentor profile or expertise.

### `DELETE /api/v1/mentors/:id`
Safely deletes or marks mentor `INACTIVE` if referenced in historical generations.

---

## 5. Team Generation Endpoints

### `POST /api/v1/generations/preview`
Calculates a proposed team generation in memory without persisting anything to the database.
- **Request Body:**
  ```json
  {
    "requestedTeamCount": 7,
    "balancedMentorDistribution": true,
    "excludeAssignedStudents": false
  }
  ```
- **Response (200 OK):** Returns proposed teams, leftovers, and summary metrics.

### `POST /api/v1/generations`
Executes the team generation algorithm, creates historical snapshots of students and mentors, and saves the generation record.
- **Request Body:**
  ```json
  {
    "generationName": "Hackathon 2026 Finals",
    "requestedTeamCount": 7,
    "balancedMentorDistribution": true,
    "excludeAssignedStudents": false,
    "teamNamePrefix": "Team"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Teams generated and saved successfully",
    "data": {
      "generation": {
        "_id": "67b0c9...",
        "generationName": "Hackathon 2026 Finals",
        "teamCount": 7,
        "status": "CONFIRMED",
        "teams": [
          {
            "_id": "67b0c9...",
            "teamNumber": 1,
            "teamName": "Team 1",
            "secondYearStudent": {
              "studentRef": "67b0c8...",
              "fullName": "Aarav Sharma",
              "studentId": "SY-CS-001",
              "academicYear": "SECOND_YEAR",
              "department": "Computer Science"
            },
            "firstYearStudents": [
              {
                "studentRef": "67b0c8...",
                "fullName": "Aryan Nair",
                "studentId": "FY-CS-101",
                "academicYear": "FIRST_YEAR",
                "department": "Computer Science"
              },
              {
                "studentRef": "67b0c8...",
                "fullName": "Ishita Sen",
                "studentId": "FY-CS-102",
                "academicYear": "FIRST_YEAR",
                "department": "Computer Science"
              }
            ],
            "mentor": {
              "mentorRef": "67b0c8...",
              "fullName": "Dr. Ramesh Kumar",
              "mentorId": "MTR-001",
              "expertise": ["Cloud Architecture"]
            }
          }
        ],
        "leftovers": {
          "firstYears": [...],
          "secondYears": [...],
          "totalLeftovers": 2
        }
      },
      "summary": {
        "totalEligibleFirstYears": 15,
        "totalEligibleSecondYears": 8,
        "totalEligibleMentors": 4,
        "assignedFirstYearsCount": 14,
        "assignedSecondYearsCount": 7,
        "totalAssignedStudents": 21,
        "unassignedFirstYearsCount": 1,
        "unassignedSecondYearsCount": 1,
        "totalUnassignedStudents": 2
      }
    }
  }
  ```

### `GET /api/v1/generations`
Lists past generations with pagination.

### `GET /api/v1/generations/:id`
Retrieves full generation details with all team snapshots and leftovers.

### `PATCH /api/v1/generations/:id/teams/:teamId`
Allows administrator to manually adjust team members while enforcing:
1. Exact 1+2 composition (2 FIRST_YEAR students and 1 SECOND_YEAR student).
2. No duplicate students across the generation.
3. Assigned mentor must be active.
- **Request Body:**
  ```json
  {
    "firstYearStudentIds": ["67b0c8...fy1", "67b0c8...fy2"],
    "secondYearStudentId": "67b0c8...sy1",
    "mentorId": "67b0c8...mentor",
    "teamName": "Team Titan"
  }
  ```

### `POST /api/v1/generations/:id/regenerate`
Re-runs generation while preserving historical generations.
- **Constraint:** Requires `{ "confirm": true }`.
- Sets previous generation status to `ARCHIVED` and creates a new generation record.

### `GET /api/v1/generations/:id/export`
Exports the generation to a downloadable CSV file.
- **Response Headers:**
  - `Content-Type: text/csv`
  - `Content-Disposition: attachment; filename="<GenerationName>_export.csv"`
- Contains complete team assignments followed by unassigned leftovers.

---

## 6. Dashboard Statistics Endpoint

### `GET /api/v1/dashboard/stats`
Retrieves live statistics for the admin dashboard.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Dashboard statistics retrieved successfully",
    "data": {
      "activeFirstYearStudents": 15,
      "activeSecondYearStudents": 8,
      "totalActiveStudents": 23,
      "activeMentors": 4,
      "possibleTeams": 7,
      "savedGenerationsCount": 1,
      "currentlyAssignedStudents": 21,
      "currentlyUnassignedStudents": 2,
      "totalStudentsInDatabase": 23,
      "totalMentorsInDatabase": 4,
      "mostRecentGeneration": {
        "id": "67b0c9...",
        "generationName": "Hackathon 2026 Finals",
        "teamCount": 7,
        "status": "CONFIRMED",
        "createdAt": "2026-10-15T12:00:00.000Z",
        "generatedBy": {
          "id": "67b0c8...",
          "name": "Super Admin",
          "email": "admin@hackathon.edu"
        },
        "leftoversCount": 2
      }
    }
  }
  ```
