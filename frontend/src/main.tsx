import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import './styles/global.css'
import MainLayout from './components/Layout/MainLayout'
import LoginPage from './pages/login/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import EquipmentList from './pages/equipment/EquipmentList'
import EquipmentDetail from './pages/equipment/EquipmentDetail'
import EquipmentForm from './pages/equipment/EquipmentForm'
import InspectionTaskCenter from './pages/inspection/InspectionTaskCenter'
import InspectionDetail from './pages/inspection/InspectionDetail'
import InspectionReview from './pages/inspection/InspectionReview'
import DefectOrderList from './pages/defect/DefectOrderList'
import DefectOrderDetail from './pages/defect/DefectOrderDetail'
import { useAuthStore } from './store/authStore'

dayjs.locale('zh-cn')

const theme = {
  token: {
    colorPrimary: '#1a7a3a',
    borderRadius: 6,
    colorBgContainer: '#ffffff',
  },
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  if (isLoggedIn) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="equipment" element={<EquipmentList />} />
            <Route path="equipment/new" element={<EquipmentForm />} />
            <Route path="equipment/:id" element={<EquipmentDetail />} />
            <Route path="equipment/:id/edit" element={<EquipmentForm />} />
            <Route path="inspection" element={<InspectionTaskCenter />} />
            <Route path="inspection/:id" element={<InspectionDetail />} />
            <Route path="inspection/:id/review" element={<InspectionReview />} />
            <Route path="defect" element={<DefectOrderList />} />
            <Route path="defect/:id" element={<DefectOrderDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  </StrictMode>
)
