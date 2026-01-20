// Token validation utility
export const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Decode the payload (middle part)
    const payload = JSON.parse(atob(parts[1]));
    
    // Check expiration
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    }

    // If no expiration, token is valid
    return false;
  } catch (error) {
    console.error('Token validation error:', error);
    return true;
  }
};

export const validateSession = () => {
  const token = localStorage.getItem('token');
  return !isTokenExpired(token);
};