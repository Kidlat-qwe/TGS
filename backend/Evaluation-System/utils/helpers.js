// Extract username from email
export const extractUsername = (email) => {
  if (!email) return '';
  return email.split('@')[0].replace(/\./g, ' ');
};

// Parse filename to extract class code and other info
export const parseFileName = (filename) => {
  // Implement your filename parsing logic here
  // This is a placeholder implementation
  const parts = filename.split('_');
  return {
    classCode: parts.length > 1 ? parts[0] : 'Unknown',
    // Add other parsed properties as needed
  };
}; 