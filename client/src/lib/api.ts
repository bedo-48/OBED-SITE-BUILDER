import axios from 'axios'

// Base URL of the backend API. Falls back to the auth URL or localhost:3000.
export const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BETTER_AUTH_URL ||
    'http://localhost:3000'

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // send the better-auth session cookie
})

export default api
