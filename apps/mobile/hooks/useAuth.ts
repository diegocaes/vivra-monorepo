// Compatibility entrypoint: existing screens keep importing useAuth from the
// same path while all of them now consume the single root AuthProvider.
export { useAuth, type AuthContextValue } from '../contexts/AuthContext';
