// API utility functions to provide consistent URL handling across components

// Get the base API URL from environment variables or use a relative URL as fallback
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

// Helper function to get the full API URL for a given endpoint
export const getApiUrl = (endpoint) => {
  // Remove any leading slash from the endpoint to avoid double slashes
  const cleanEndpoint = endpoint.startsWith("/")
    ? endpoint.substring(1)
    : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
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

// Helper function to make authorized API requests with proper error handling
export const fetchWithAuth = async (endpoint, options = {}) => {
  try {
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

    // Make the request
    const response = await fetch(getApiUrl(endpoint), {
      ...options,
      headers,
      credentials: "include", // Include cookies in the request
    });

    // For non-OK responses, attempt to parse error message
    if (!response.ok) {
      const contentType = response.headers.get("content-type");

      // Check if response is JSON
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            errorData.message ||
            `Request failed with status ${response.status}`,
        );
      } else {
        // Handle non-JSON error responses
        const errorText = await response.text();
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
