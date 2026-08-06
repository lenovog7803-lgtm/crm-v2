import { useState, useEffect } from 'react'
import './index.css'

import { AuthProvider, useAuth } from './AuthContext'
import { ToastProvider, useToast } from './components/Toast'
import { CelebrationProvider } from './components/Celebration'
import Login from './pages/Login'
import { getDashboard, getOrders, getTasks, getNotifications, markNotificationRead } from './api'

import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Dashboard from './components/Dashboard'
import Orders from './components/Orders'
import OrderDetail from './components/OrderDetail'
import Finance from './components/Finance'
import Tasks from './components/Tasks'
import Clients from './components/Clients'
import ClientDetail from './components/ClientDetail'
import Carriers from './components/Carriers'
import CarrierDetail from './components/CarrierDetail'
import Leads from './pages/Leads'
import Trash from './components/Trash'
import Backups from './pages/Backups'
import Admin from './pages/Admin'

import CreateOrderModal from './components/CreateOrderModal'
import CreateTaskModal from './components/CreateTaskModal'
import AddClientModal from './components/AddClientModal'
import AddCarrierModal from './components/AddCarrierModal'
import PaymentModal from './components/PaymentModal'
import MobileNav from './components/MobileNav'
import CommandPalette from './components/CommandPalette'
import { useRealtime } from './hooks/useRealtime'

const SEARCH_STORAGE_KEYS = {
  orders: 'search_orders',
  clients: 'search_clients',
  carriers: 'search_carriers',
  leads: 'search_leads',
}

function loadPageSearch(page) {
  const key = SEARCH_STORAGE_KEYS[page]
  if (!key) return ''
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function savePageSearch(page, value) {
  const key = SEARCH_STORAGE_KEYS[page]
  if (!key) return
  try {
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
    }
  } catch {}
}

function MainApp() {
  const { signOut, user } = useAuth()
  const { show } = useToast()
  const role = user?.user?.role
  const isDirector = role === 'director' || role === 'admin'

  const [page, setPage] = useState('dashboard')
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [selectedCarrierId, setSelectedCarrierId] = useState(null)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)

  // Modal visibility
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [duplicateData, setDuplicateData] = useState(null)
  const [editOrderData, setEditOrderData] = useState(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showCarrierModal, setShowCarrierModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentModalKind, setPaymentModalKind] = useState('income')
  const [paletteOpen, setPaletteOpen] = useState(false)

  const [search, setSearch] = useState(() => loadPageSearch('dashboard'))
  const [overdueItems, setOverdueItems] = useState([])

  // Refresh triggers — increment to tell the component to re-fetch
  const [dashboardPeriod, setDashboardPeriod] = useState('month')
  const [availableMonths, setAvailableMonths] = useState([])

  const [ordersKey, setOrdersKey] = useState(0)
  const [tasksKey, setTasksKey] = useState(0)
  const [clientsKey, setClientsKey] = useState(0)
  const [carriersKey, setCarriersKey] = useState(0)
  const [financeKey, setFinanceKey] = useState(0)

  const [allOrders, setAllOrders] = useState([])
  const [counts, setCounts] = useState({ newOrders: 0, pendingTasks: 0, newLeads: 0 })

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      getOrders({ limit: 2000 }).catch(() => []),
      getTasks().catch(() => []),
    ]).then(([ordersRaw, tasks]) => {
      const orders = Array.isArray(ordersRaw) ? ordersRaw : (ordersRaw?.orders || [])
      setAllOrders(orders)

      const overdueOrders = orders
        .filter(o => o.unload_date && o.unload_date < today && o.status !== 'done' && o.status !== 'cancelled')
        .map(o => ({ type: 'order', id: o.id, label: `Заявка ${o.order_number || o.id}: ${o.route_from || ''} → ${o.route_to || ''}`, date: o.unload_date }))
      const overdueTasks = (Array.isArray(tasks) ? tasks : [])
        .filter(t => t.due_date && t.due_date < today && t.status !== 'done')
        .map(t => ({ type: 'task', id: t.id, label: t.title || t.description || 'Задача', date: t.due_date }))
      setOverdueItems([...overdueOrders, ...overdueTasks].sort((a, b) => a.date.localeCompare(b.date)))

      const newOrders = orders.filter(o => o.status === 'new').length
      const pendingTasks = (Array.isArray(tasks) ? tasks : []).filter(t => t.status === 'pending').length
      setCounts(c => ({ ...c, newOrders, pendingTasks }))
    })
    getDashboard('all').then(d => {
      setCounts(c => ({ ...c, newLeads: d.new_leads || 0 }))
    }).catch(() => {})
  }, [ordersKey, tasksKey])

  // Navigation
  const openOrder = id => { setSelectedOrderId(id); setPage('order-detail'); setSearch('') }
  const openClient = id => { setSelectedClientId(id); setPage('client-detail'); setSearch('') }
  const openCarrier = id => { setSelectedCarrierId(id); setPage('carrier-detail'); setSearch('') }

  const handleNav = key => {
    if (key === 'admin' && !isDirector) key = 'tasks'
    setPage(key)
    setSearch(loadPageSearch(key))
  }

  useEffect(() => {
    if (role !== 'director' && role !== 'admin') return
    const check = async () => {
      const r = await getNotifications().catch(() => null)
      ;(r?.notifications || []).forEach(n => {
        show(n.message, { type: 'info' })
        markNotificationRead(n.id).catch(() => {})
      })
    }
    check()
    const t = setInterval(check, 60000)
    return () => clearInterval(t)
  }, [role])

  const handleSearchChange = value => {
    setSearch(value)
    savePageSearch(page, value)
  }

  const openPaymentModal = kind => {
    setPaymentModalKind(kind)
    setShowPaymentModal(true)
  }

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // One shared connection covers Dashboard + Orders — both already refetch
  // off ordersKey, so a single bump here silently refreshes both instead of
  // opening a redundant WebSocket per page.
  useRealtime((event) => {
    if (event.type === 'order_updated' || event.type === 'payment_marked') {
      setOrdersKey(k => k + 1)
    }
  })

  return (
    <div className="app-root">
      <div className="aurora-bg">
        <div className="aurora-orb-a" />
        <div className="aurora-orb-b" />
      </div>

      <div className="app-frame">
        <Sidebar
          page={page}
          expanded={sidebarExpanded}
          onNav={handleNav}
          onToggle={() => setSidebarExpanded(e => !e)}
          counts={counts}
          onSignOut={signOut}
        />

        <main className="app-main">
          <Topbar page={page} onSignOut={signOut} period={dashboardPeriod} onPeriodChange={setDashboardPeriod} availableMonths={availableMonths} search={search} onSearchChange={handleSearchChange} overdueItems={overdueItems} onOpenOrder={id => openOrder(id)} onNav={handleNav} onOpenPalette={() => setPaletteOpen(true)} />
          <div className="scroll-area" key={page}>
            {page === 'dashboard' && <Dashboard onNav={handleNav} onOpenOrder={id => openOrder(id)} period={dashboardPeriod} onMonthsLoaded={setAvailableMonths} preloadedOrders={allOrders} />}

            {page === 'orders' && (
              <Orders
                onOpenOrder={openOrder}
                onAddOrder={() => setShowOrderModal(true)}
                refreshKey={ordersKey}
                search={search}
              />
            )}
            {page === 'order-detail' && (
              <OrderDetail
                orderId={selectedOrderId}
                onBack={() => handleNav('orders')}
                onDelete={() => { setOrdersKey(k => k + 1) }}
                onOpenClient={id => openClient(id)}
                onOpenCarrier={id => openCarrier(id)}
                onOpenOrder={id => openOrder(id)}
                onDuplicate={orderData => { setDuplicateData(orderData); setEditOrderData(null); setShowOrderModal(true) }}
                onEdit={orderData => { setEditOrderData(orderData); setDuplicateData(null); setShowOrderModal(true) }}
              />
            )}

            {page === 'finance' && (
              <Finance
                onAddPayment={openPaymentModal}
                refreshKey={financeKey}
              />
            )}

            {page === 'tasks' && (
              <Tasks
                onAdd={() => setShowTaskModal(true)}
                refreshKey={tasksKey}
                search={search}
              />
            )}

            {page === 'clients' && (
              <Clients
                onOpenClient={openClient}
                onAdd={() => setShowClientModal(true)}
                refreshKey={clientsKey}
                search={search}
              />
            )}
            {page === 'client-detail' && (
              <ClientDetail
                clientId={selectedClientId}
                onBack={() => handleNav('clients')}
                onDelete={() => { setClientsKey(k => k + 1) }}
                onOpenOrder={id => openOrder(id)}
              />
            )}

            {page === 'carriers' && (
              <Carriers
                onOpenCarrier={openCarrier}
                onAdd={() => setShowCarrierModal(true)}
                refreshKey={carriersKey}
                search={search}
              />
            )}
            {page === 'carrier-detail' && (
              <CarrierDetail
                carrierId={selectedCarrierId}
                onBack={() => handleNav('carriers')}
                onDelete={() => { setCarriersKey(k => k + 1) }}
                onOpenOrder={id => openOrder(id)}
              />
            )}

            {page === 'leads' && <Leads />}
            {page === 'trash' && <Trash />}
            {page === 'backups' && <Backups />}
            {page === 'admin' && isDirector && <Admin />}
          </div>
        </main>
      </div>

      <MobileNav page={page} onNav={handleNav} counts={counts} />

      {/* Modals */}
      {showOrderModal && (
        <CreateOrderModal
          onClose={() => { setShowOrderModal(false); setDuplicateData(null); setEditOrderData(null) }}
          onSuccess={() => { setShowOrderModal(false); setDuplicateData(null); setEditOrderData(null); setOrdersKey(k => k + 1) }}
          initialData={editOrderData || duplicateData}
          editOrderId={editOrderData?.id}
        />
      )}
      {showTaskModal && (
        <CreateTaskModal
          onClose={() => setShowTaskModal(false)}
          onSuccess={() => { setShowTaskModal(false); setTasksKey(k => k + 1) }}
        />
      )}
      {showClientModal && (
        <AddClientModal
          onClose={() => setShowClientModal(false)}
          onSuccess={() => { setShowClientModal(false); setClientsKey(k => k + 1) }}
        />
      )}
      {showCarrierModal && (
        <AddCarrierModal
          onClose={() => setShowCarrierModal(false)}
          onSuccess={() => { setShowCarrierModal(false); setCarriersKey(k => k + 1) }}
        />
      )}
      {showPaymentModal && (
        <PaymentModal
          defaultKind={paymentModalKind}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => { setShowPaymentModal(false); setFinanceKey(k => k + 1) }}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenOrder={id => openOrder(id)}
        onOpenClient={id => openClient(id)}
        onOpenCarrier={id => openCarrier(id)}
        onNav={handleNav}
      />
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EDEFF3' }}>
        <div style={{ fontSize: 14, color: '#A6AEB8' }}>Загрузка...</div>
      </div>
    )
  }
  if (!user) return <Login />
  return <MainApp />
}

export default function App() {
  return (
    <ToastProvider>
      <CelebrationProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </CelebrationProvider>
    </ToastProvider>
  )
}
