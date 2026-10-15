# Next.js Frontend Integration Guide

This guide provides clean, production-ready examples for integrating a Next.js (App Router or Pages Router) application with the Hackathon Team Randomizer Backend.

---

## 1. Environment Configuration in Next.js

In your Next.js project root (`.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

---

## 2. Universal API Client (`lib/apiClient.ts` / `.js`)

```javascript
// lib/apiClient.js
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export class ApiError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  // Retrieve token from localStorage, cookie, or session
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // If body is FormData (e.g. CSV upload), remove Content-Type so browser sets boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle file download (e.g. CSV export)
  if (response.headers.get('content-type')?.includes('text/csv')) {
    if (!response.ok) {
      throw new ApiError('Failed to download CSV', response.status);
    }
    const blob = await response.blob();
    return blob;
  }

  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new ApiError(
      payload.message || 'An unexpected error occurred',
      response.status,
      payload.errors || []
    );
  }

  return payload;
}
```

---

## 3. Authentication Integration

```javascript
// services/authService.js
import { apiFetch } from '@/lib/apiClient';

export async function loginAdmin(email, password) {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (res.data?.token) {
    localStorage.setItem('auth_token', res.data.token);
  }
  return res.data;
}

export async function getCurrentAdmin() {
  const res = await apiFetch('/auth/me');
  return res.data.admin;
}

export function logoutAdmin() {
  localStorage.removeItem('auth_token');
  window.location.href = '/login';
}
```

---

## 4. Team Generation Integration

### Generating and Previewing Teams
```javascript
// services/generationService.js
import { apiFetch } from '@/lib/apiClient';

/**
 * Preview generation before finalizing
 */
export async function previewGeneration({
  requestedTeamCount = null,
  balancedMentorDistribution = true,
  excludeAssignedStudents = false,
}) {
  const res = await apiFetch('/generations/preview', {
    method: 'POST',
    body: JSON.stringify({
      requestedTeamCount,
      balancedMentorDistribution,
      excludeAssignedStudents,
    }),
  });
  return res.data; // Contains proposed teams and leftovers
}

/**
 * Finalize and save team generation
 */
export async function createGeneration({
  generationName,
  requestedTeamCount = null,
  balancedMentorDistribution = true,
  teamNamePrefix = 'Team',
}) {
  const res = await apiFetch('/generations', {
    method: 'POST',
    body: JSON.stringify({
      generationName,
      requestedTeamCount,
      balancedMentorDistribution,
      teamNamePrefix,
    }),
  });
  return res.data;
}

/**
 * Download CSV export
 */
export async function downloadGenerationCsv(generationId, filename = 'hackathon_teams.csv') {
  const blob = await apiFetch(`/generations/${generationId}/export`);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
```

---

## 5. CSV Student Bulk Upload in Next.js

```jsx
// components/StudentCsvUploader.jsx
'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

export default function StudentCsvUploader({ onUploadComplete }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setReport(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiFetch('/students/bulk', {
        method: 'POST',
        body: formData,
      });

      setReport(response.data);
      if (onUploadComplete) onUploadComplete(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Bulk Import Students via CSV</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files[0])}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          type="submit"
          disabled={!file || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Importing...' : 'Upload & Validate'}
        </button>
      </form>

      {error && <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      {report && (
        <div className="mt-4 p-4 bg-gray-50 rounded border">
          <p className="font-medium text-green-700">
            Successfully imported: {report.successCount} of {report.totalProcessed} rows.
          </p>
          {report.failedCount > 0 && (
            <div className="mt-2 text-sm text-red-600">
              <p className="font-semibold">Errors encountered ({report.failedCount} rows):</p>
              <ul className="list-disc pl-5">
                {report.errors.map((err, idx) => (
                  <li key={idx}>
                    Row {err.row} (ID: {err.studentId}): {err.errors.join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 6. Live Dashboard Statistics Component

```jsx
// components/DashboardStats.jsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

export default function DashboardStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await apiFetch('/dashboard/stats');
        setStats(res.data);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) return <div>Loading live stats...</div>;
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <span className="text-sm text-blue-600 font-medium">Possible Teams</span>
        <p className="text-3xl font-bold text-blue-900">{stats.possibleTeams}</p>
        <span className="text-xs text-blue-500">1 SY + 2 FY ratio</span>
      </div>

      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <span className="text-sm text-green-600 font-medium">Active First-Years</span>
        <p className="text-3xl font-bold text-green-900">{stats.activeFirstYearStudents}</p>
      </div>

      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <span className="text-sm text-purple-600 font-medium">Active Second-Years</span>
        <p className="text-3xl font-bold text-purple-900">{stats.activeSecondYearStudents}</p>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <span className="text-sm text-amber-600 font-medium">Active Mentors</span>
        <p className="text-3xl font-bold text-amber-900">{stats.activeMentors}</p>
      </div>
    </div>
  );
}
```
