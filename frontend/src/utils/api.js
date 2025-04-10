// API utility functions to provide consistent URL handling across components

// Get the base API URL from environment variables or use a relative URL as fallback
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

// Get the backend URL for direct fetches
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Flag to enable mock API when the backend is down
export const USE_MOCK_API = true; // Set to false to use the real backend API

// Mock API responses for offline development
const MOCK_RESPONSES = {
  'auth/login': {
    success: {
      token: 'mock-jwt-token-for-development-xyz.abc.123',
      user: {
        email: 'test@example.com',
        uid: 'mock-uid-123',
        role: 'user',
        accessType: 'unlimited',
        systemAccess: 'both',
      }
    },
    error: {
      status: 401,
      error: 'Invalid credentials',
      message: 'The email or password you entered is incorrect'
    }
  },
  'health': {
    success: {
      status: 'healthy',
      uptime: '3d 2h 45m',
      version: '1.0.0',
      mock: true
    }
  },
  'api/health': {
    success: {
      status: 'healthy',
      uptime: '3d 2h 45m',
      version: '1.0.0',
      mock: true
    }
  },
  'admin-contacts': {
    success: {
      id: 'mock-contact-123',
      status: 'received',
      message: 'Your message has been received and will be reviewed by an administrator.'
    },
    error: {
      status: 400,
      error: 'Invalid request',
      message: 'Please provide a valid email and message.'
    }
  }
};

// Helper function to get the full API URL for a given endpoint
export const getApiUrl = (endpoint) => {
  // Remove any leading slash from the endpoint to avoid double slashes
  const cleanEndpoint = endpoint.startsWith("/")
    ? endpoint.substring(1)
    : endpoint;
  
  // Log the constructed URL in development for debugging
  const url = `${API_BASE_URL}/${cleanEndpoint}`;
  if (import.meta.env.DEV) {
    console.log(`API URL constructed: ${url}`);
  }
  
  return url;
};

// Helper function specifically for Grading System API calls
export const getGradingApiUrl = (endpoint) => {
  // Remove any leading slash from the endpoint to avoid double slashes
  const cleanEndpoint = endpoint.startsWith("/")
    ? endpoint.substring(1)
    : endpoint;
  return `${API_BASE_URL}/grading/${cleanEndpoint}`;
};

// Helper function for the Evaluation System API calls
export const getEvaluationApiUrl = (endpoint) => {
  // Remove any leading slash from the endpoint to avoid double slashes
  const cleanEndpoint = endpoint.startsWith("/")
    ? endpoint.substring(1)
    : endpoint;
  return `${API_BASE_URL}/evaluation/${cleanEndpoint}`;
};

// Helper function to simulate API responses when backend is down
const getMockResponse = (endpoint, options = {}) => {
  console.log(`🔶 Using mock API response for: ${endpoint}`);
  
  // Extract the base endpoint without query parameters
  const baseEndpoint = endpoint.split('?')[0];
  
  // Check if we have a mock for this endpoint
  if (!MOCK_RESPONSES[baseEndpoint]) {
    console.warn(`No mock response defined for: ${baseEndpoint}`);
    return Promise.reject(new Error(`No mock response available for ${baseEndpoint}`));
  }
  
  // For login, check credentials
  if (baseEndpoint === 'auth/login' && options.method === 'POST') {
    try {
      const body = JSON.parse(options.body);
      if (body.email === 'test@example.com' && body.password === 'password123') {
        return Promise.resolve(MOCK_RESPONSES[baseEndpoint].success);
      } else {
        const error = MOCK_RESPONSES[baseEndpoint].error;
        return Promise.reject(new Error(error.message || 'Invalid credentials'));
      }
    } catch (e) {
      return Promise.reject(new Error('Invalid request body'));
    }
  }
  
  // For other endpoints, return success response
  return Promise.resolve(MOCK_RESPONSES[baseEndpoint].success);
};

// Helper function to make authorized API requests with proper error handling
export const fetchWithAuth = async (endpoint, options = {}) => {
  try {
    // If mock API is enabled, use mock responses
    if (USE_MOCK_API) {
      return await getMockResponse(endpoint, options);
    }
    
    const token = localStorage.getItem("token");

    // Set up default headers
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Add authorization header if token exists
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Log the request for debugging (in development only)
    if (import.meta.env.DEV) {
      console.log(`API Request: ${getApiUrl(endpoint)}`, { 
        method: options.method || 'GET',
        headers: headers 
      });
    }

    // Make the request
    const response = await fetch(getApiUrl(endpoint), {
      ...options,
      headers,
      credentials: "include", // Include cookies in the request
    });

    // Check if the response is empty
    const responseText = await response.text();
    
    // For successful responses with no content
    if (response.status === 204 || !responseText) {
      return null;
    }
    
    // Try to parse JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('Error parsing JSON response:', jsonError, 'Raw response:', responseText);
      
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
      }
      
      // Return the raw text if we can't parse JSON but the request was successful
      return { text: responseText };
    }

    // For non-OK responses with valid JSON
    if (!response.ok) {
      throw new Error(
        data.error ||
          data.message ||
          `Request failed with status ${response.status}`
      );
    }

    // Return the parsed JSON data
    return data;
  } catch (error) {
    // Log the error in development
    if (import.meta.env.DEV) {
      console.error('API Request failed:', error);
    }
    
    // Re-throw the error for the caller to handle
    throw error;
  }
};

// Helper function to make Grading System API requests
export const fetchGradingWithAuth = async (endpoint, options = {}) => {
  try {
    // Get the grading system token (might be different from the regular token)
    const token =
      localStorage.getItem("grading_token") || localStorage.getItem("token");

    // Set up default headers
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Add authorization header if token exists
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    console.log(
      `Making grading system request to: ${getGradingApiUrl(endpoint)}`,
    );

    // Make the request
    const response = await fetch(getGradingApiUrl(endpoint), {
      ...options,
      headers,
      credentials: "include", // Include cookies in the request
    });

    // For non-OK responses, attempt to parse error message
    if (!response.ok) {
      console.error(
        `Grading API Error (${response.status}): ${response.statusText}`,
      );

      const contentType = response.headers.get("content-type");

      // Check if response is JSON
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        console.error("Grading API Error details:", errorData);
        throw new Error(
          errorData.error ||
            errorData.message ||
            `Request failed with status ${response.status}`,
        );
      } else {
        // Handle non-JSON error responses
        const errorText = await response.text();
        console.error("Grading API Error text:", errorText);
        throw new Error(
          errorText || `Request failed with status ${response.status}`,
        );
      }
    }

    // For successful responses with no content
    if (response.status === 204) {
      return null;
    }

    // For other successful responses, parse JSON
    return await response.json();
  } catch (error) {
    console.error("Grading API request failed:", error);
    // Re-throw the error for the caller to handle
    throw error;
  }
};
