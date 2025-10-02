import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from 'antd'
import DashboardLayout from './components/Layout/DashboardLayout'
import LoginPage from './pages/Auth/LoginPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import UsersPage from './pages/Users/UsersPage'
import LoansPage from './pages/Loans/LoansPage'
import PaymentsPage from './pages/Payments/PaymentsPage'
import { useAuthStore } from './stores/authStore'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/loans" element={<LoansPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </DashboardLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  )
}

export default App
