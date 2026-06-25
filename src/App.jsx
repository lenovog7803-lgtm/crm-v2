import { useState, useEffect } from 'react'
import './index.css'

import { AuthProvider, useAuth } from './AuthContext'
import Login from './pages/Login'
import { getDashboard, getOrders, getTasks } from './api'

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
import Leads from './components/Leads'

import CreateOrderModal from './components/CreateOrderModal'
import CreateTaskModal from './components/CreateTaskModal'
import AddClientModal from './components/AddClientModal'
import AddCarrierModal from './components/AddCarrierModal'
import PaymentModal from './components/PaymentModal'

function MainApp() {
  const { signOut } = useAuth()

  const [page, setPage] = useState('dashboard')
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [selectedCarrierId, setSelectedCarrierId] = useState(null)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)

  // Modal visibility
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showCarrierModal, setShowCarrierModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentModalKind, setPaymentModalKind] = useState('income')

  const [search, setSearch] = useState('')
  const [overdueItems, setOverdueItems] = useState([])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      getOrders({ limit: 500 }).catch(() => []),
      getTasks().catch(() => []),
    ]).then(([orders, tasks]) => {
      const overdueOrders = (Array.isArray(orders) ? orders : [])
        .filter(o => o.unload_date && o.unload_date < today && o.status !== 'done' && o.status !== 'cancelled')
        .map(o => ({ type: 'order', id: o.id, label: `Заявка ${o.order_number || o.id}: ${o.route_from || ''} → ${o.route_to || ''}`, date: o.unload_date }))
      const overdueTasks = (Array.isArray(tasks) ? tasks : [])
        .filter(t => t.due_date && t.due_date < today && t.status !== 'done')
        .map(t => ({ type: 'task', id: t.id, label: t.title || t.description || 'Задача', date: t.due_date }))
      setOverdueItems([...overdueOrders, ...overdueTasks].sort((a, b) => a.date.localeCompare(b.date)))
    })
  }, [ordersKey, tasksKey])

  // Refresh triggers — increment to tell the component to re-fetch
  const [dashboardPeriod, setDashboardPeriod] = useState('month')
  const [availableMonths, setAvailableMonths] = useState([])

  const [ordersKey, setOrdersKey] = useState(0)
  const [tasksKey, setTasksKey] = useState(0)
  const [clientsKey, setClientsKey] = useState(0)
  const [carriersKey, setCarriersKey] = useState(0)
  const [financeKey, setFinanceKey] = useState(0)
  const [leadsKey, setLeadsKey] = useState(0)

  // Sidebar counts from dashboard
  const [counts, setCounts] = useState({ activeOrders: 0, pendingTasks: 0, clientsCount: 0, carriersCount: 0, newLeads: 0 })

  useEffect(() => {
    getDashboard('month').then(d => {
      setCounts({
        activeOrders: d.active_orders || 0,
        pendingTasks: 0,
        clientsCount: d.clients_count || 0,
        carriersCount: d.carriers_count || 0,
        newLeads: d.new_leads || 0,
      })
    }).catch(() => {})
  }, [ordersKey, clientsKey, carriersKey])

  // Navigation
  const openOrder = id => { setSelectedOrderId(id); setPage('order-detail'); setSearch('') }
  const openClient = id => { setSelectedClientId(id); setPage('client-detail'); setSearch('') }
  const openCarrier = id => { setSelectedCarrierId(id); setPage('carrier-detail'); setSearch('') }

  const handleNav = key => {
    setPage(key)
    setSearch('')
  }

  const openPaymentModal = kind => {
    setPaymentModalKind(kind)
    setShowPaymentModal(true)
  }

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
        />

        <main className="app-main">
          <Topbar page={page} onSignOut={signOut} period={dashboardPeriod} onPeriodChange={setDashboardPeriod} availableMonths={availableMonths} search={search} onSearchChange={setSearch} overdueItems={overdueItems} onOpenOrder={id => openOrder(id)} />
          <div className="scroll-area" key={page}>
            {page === 'dashboard' && <Dashboard onNav={handleNav} onOpenOrder={id => openOrder(id)} period={dashboardPeriod} onMonthsLoaded={setAvailableMonths} />}

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
                onBack={() => setPage('orders')}
                onDelete={() => { setOrdersKey(k => k + 1) }}
                onOpenClient={id => openClient(id)}
                onOpenCarrier={id => openCarrier(id)}
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
                onBack={() => setPage('clients')}
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
                onBack={() => setPage('carriers')}
                onDelete={() => { setCarriersKey(k => k + 1) }}
                onOpenOrder={id => openOrder(id)}
              />
            )}

            {page === 'leads' && <Leads refreshKey={leadsKey} search={search} />}
          </div>
        </main>
      </div>

      {/* Modals */}
      {showOrderModal && (
        <CreateOrderModal
          onClose={() => setShowOrderModal(false)}
          onSuccess={() => { setShowOrderModal(false); setOrdersKey(k => k + 1) }}
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
