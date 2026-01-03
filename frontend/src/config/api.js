// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// API Endpoints
export const ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  ME: '/api/auth/me',
  
  // Jobs
  JOBS: '/api/jobs',
  JOB_BY_ID: (id) => `/api/jobs/${id}`,
  UPLOAD_SNIPPET: '/api/jobs/upload/snippet',
  UPLOAD_ZIP: '/api/jobs/upload/zip',
  UPLOAD_FOLDER: '/api/jobs/upload/folder',
  
  // Reports
  REPORT: (jobId) => `/api/reports/${jobId}`,
  DOWNLOAD_REPORT: (jobId) => `/api/reports/${jobId}/download`,
};

// Request helper
export const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(`${API_URL}${endpoint}`, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
     // Check for API credit exhaustion
      if (response.status === 429 || 
          error.message?.includes('quota') || 
          error.message?.includes('credit') ||
          error.message?.includes('rate limit')) {
        throw new Error('AI_CREDITS_EXHAUSTED');
      }
      
    
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
};

// Upload helper (for file uploads)
export const apiUpload = async (endpoint, formData) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
};