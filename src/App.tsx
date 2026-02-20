import { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Spin, message } from 'antd';
import {
  DashboardOutlined,
  InboxOutlined,
  ExportOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  UnorderedListOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import ErrorBoundary from './components/ErrorBoundary';
import { CompanyNameProvider, useCompanyName } from './contexts/CompanyNameContext';
import Dashboard from './pages/Dashboard';
import Inbound from './pages/Inbound';
import Outbound from './pages/Outbound';
import Inventory from './pages/Inventory';
import Claims from './pages/Claims';
import ClaimDetail from './pages/ClaimDetail';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

const { Header, Content } = Layout;

function AppLayoutInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { titleWithCompany } = useCompanyName();
  const [ready, setReady] = useState(false);
  const initedRef = useRef(false);

  useEffect(() => {
    // 防止重复初始化：如果已经初始化过，直接返回
    if (initedRef.current) return;
    
    // 设置初始化锁，防止重复调用
    initedRef.current = true;
    
    // 执行初始化流程
    window.electronAPI.db.init()
      .then(() => {
        return window.electronAPI.db.seed();
      })
      .then(() => {
        // 初始化成功，设置 ready 状态
        setReady(true);
      })
      .catch((e) => {
        // 初始化失败，也要设置 ready，避免页面一直 loading
        let errorMsg = e?.message || String(e);
        // 翻译常见网络错误
        if (errorMsg.includes('NetworkError') || errorMsg.includes('fetch')) {
          errorMsg = '网络连接失败，请检查后端服务是否正常运行';
        } else if (errorMsg.includes('Failed to fetch')) {
          errorMsg = '无法连接到服务器，请检查网络连接';
        }
        message.error('初始化失败: ' + errorMsg);
        setReady(true);
      });
  }, []);

  const nav = [
    { key: '/', icon: <DashboardOutlined />, label: '首页' },
    { key: '/inbound', icon: <InboxOutlined />, label: '入库' },
    { key: '/outbound', icon: <ExportOutlined />, label: '出库' },
    { key: '/inventory', icon: <DatabaseOutlined />, label: '库存' },
    { key: '/claims', icon: <FileTextOutlined />, label: '申报' },
    { key: '/reports', icon: <UnorderedListOutlined />, label: '报表' },
    { key: '/settings', icon: <SettingOutlined />, label: '设置' },
  ];

  const path = location.pathname === '/claim' ? '/claims' : location.pathname;

  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="初始化中..." />
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ color: '#fff', fontWeight: 600 }}>{titleWithCompany('仓库管理')}</div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[path]}
          items={nav}
          style={{ flex: 1, minWidth: 0 }}
          onClick={({ key }) => navigate(key)}
        />
      </Header>
      <Content style={{ padding: 24 }}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inbound" element={<Inbound />} />
            <Route path="/outbound" element={<Outbound />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/claims" element={<Claims />} />
            <Route path="/claim/:id" element={<ClaimDetail />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </Content>
    </Layout>
  );
}

function AppLayout() {
  return (
    <CompanyNameProvider>
      <AppLayoutInner />
    </CompanyNameProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
