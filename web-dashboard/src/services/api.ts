import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// API methods
export const authAPI = {
  login: (phone: string, password: string) =>
    api.post('/auth/login', { phone, password }),
  logout: () => api.post('/auth/logout'),
}

export const usersAPI = {
  getAll: (params?: any) => api.get('/users', { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
}

export const loansAPI = {
  getAll: (params?: any) => api.get('/loans', { params }),
  getById: (id: string) => api.get(`/loans/${id}`),
  approve: (id: string) => api.post(`/loans/${id}/approve`),
  reject: (id: string, reason: string) =>
    api.post(`/loans/${id}/reject`, { reason }),
}

export const paymentsAPI = {
  getAll: (params?: any) => api.get('/payments', { params }),
  getById: (id: string) => api.get(`/payments/${id}`),
  verify: (id: string) => api.post(`/payments/${id}/verify`),
}

export default api
