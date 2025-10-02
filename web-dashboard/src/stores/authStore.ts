import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  isAuthenticated: boolean
  user: any | null
  token: string | null
  login: (token: string, user: any) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      
      login: (token: string, user: any) => {
        set({ isAuthenticated: true, token, user })
      },
      
      logout: () => {
        set({ isAuthenticated: false, token: null, user: null })
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)
