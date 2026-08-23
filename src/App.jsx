import { useState, useEffect, useRef } from 'react'
import './index.css'

import { AuthProvider, useAuth } from './AuthContext'
import { ToastProvider, useToast } from './components/Toast'
import { CelebrationProvider } from './components/Celebration'
import Login from './pages/Login'
import { getDashboard, getTasks, getNotifications, markNotificationRead } from './api'
import { getOrdersFromCache, invalidateOrdersCache, refreshOrdersInBackground, patchOrderInCache } from './store/ordersStore'

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
import Kudir from './pages/Kudir'
import ManagerDashboard from './pages/ManagerDashboard'
import ErrorBoundary from './components/ErrorBoundary'

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
  const { show, clearAll } = useToast()
  const role = user?.user?.role
  const isDirector = role === 'director' || role === 'admin'
  const isEgorDir = user?.username === 'egor_dir'
  const isManager = role === 'manager'
  // Managers get their own dashboard (my-dashboard), not the company-wide
  // one — director-only pages redirect here instead.
  const MANAGER_PAGES = ['my-dashboard', 'tasks', 'leads', 'order-detail', 'client-detail', 'carrier-detail']

  const [page, setPage] = useState(() => isManager ? 'my-dashboard' : 'dashboard')
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

  // MainApp remounts fresh on every login (AppContent swaps Login <-> MainApp
  // on user change) — but ToastProvider sits above AuthProvider and survives
  // that swap, so without this a previous account's notifications on the
  // same tab would still be sitting in the bell for whoever logs in next.
  useEffect(() => { clearAll() }, [])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      getOrdersFromCache().catch(() => []),
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

  // Navigation — the app has no router (page is plain state, the URL never
  // changes), so the browser's back/forward swipe gesture had nowhere to
  // go: with only one real history entry, swiping back just reloaded the
  // document instead of moving between in-app pages. Pushing a history
  // entry on every navigation gives that gesture somewhere to land.
  const pushNavState = (next) => window.history.pushState(next, '')

  const openOrder = id => {
    setSelectedOrderId(id); setPage('order-detail'); setSearch('')
    pushNavState({ page: 'order-detail', selectedOrderId: id, selectedClientId: null, selectedCarrierId: null })
  }
  const openClient = id => {
    setSelectedClientId(id); setPage('client-detail'); setSearch('')
    pushNavState({ page: 'client-detail', selectedOrderId: null, selectedClientId: id, selectedCarrierId: null })
  }
  const openCarrier = id => {
    setSelectedCarrierId(id); setPage('carrier-detail'); setSearch('')
    pushNavState({ page: 'carrier-detail', selectedOrderId: null, selectedClientId: null, selectedCarrierId: id })
  }

  const handleNav = key => {
    if (key === 'admin' && !isEgorDir) key = 'tasks'
    if (key === 'kudir' && !isDirector) key = 'tasks'
    if (isManager && !MANAGER_PAGES.includes(key)) key = 'my-dashboard'
    setPage(key)
    setSearch(loadPageSearch(key))
    // Keeps the previously-selected order/client/carrier id alive in the
    // pushed history entry (instead of nulling it) so a physical back/swipe
    // gesture lands the list scrolled back to the same row as the in-app
    // "Назад" button does, not just at the top.
    pushNavState({ page: key, selectedOrderId, selectedClientId, selectedCarrierId })
  }

  // Baseline history entry so the very first popstate (from the first
  // back-swipe) has state to restore instead of landing on `null`, then
  // listen for the browser's back/forward (incl. trackpad/edge swipe) and
  // replay it as an in-app navigation instead of a real page transition.
  useEffect(() => {
    window.history.replaceState({ page, selectedOrderId, selectedClientId, selectedCarrierId }, '')
    const onPopState = (e) => {
      if (!e.state) return
      setPage(e.state.page)
      setSelectedOrderId(e.state.selectedOrderId ?? null)
      setSelectedClientId(e.state.selectedClientId ?? null)
      setSelectedCarrierId(e.state.selectedCarrierId ?? null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (role !== 'director' && role !== 'admin') return
    const check = async () => {
      const r = await getNotifications().catch(() => null)
      const fresh = r?.notifications || []
      // Marked read on the backend right away (so they don't repeat next
      // poll or in another tab); the bell dropdown is what keeps them
      // visible locally until dismissed — same unified store as every
      // other show() call in the app now uses.
      fresh.forEach(n => {
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

  // One shared connection covers Dashboard + Orders. order_updated carries
  // the changed fields (patch) and is applied in place to the shared cache
  // and to allOrders — no network round-trip, so a busy team doesn't force
  // everyone else's list to reload on every edit. payment_marked touches
  // more (payment arrays, computed status, KUDiR) — still a full refetch.
  useRealtime((event) => {
    if (event.type === 'order_updated') {
      patchOrderInCache(event.order_id, event.patch)
      if (event.patch) {
        setAllOrders(prev => prev.map(o => (o.id === event.order_id ? { ...o, ...event.patch } : o)))
      }
    } else if (event.type === 'payment_marked') {
      // Refetches in place instead of nulling the cache + remounting the
      // list — a mounted Orders view keeps showing the current rows and
      // swaps to the updated ones once they land, rather than blocking on
      // a fresh fetch every time anyone (including you) marks a payment.
      refreshOrdersInBackground()
    }
  })

  // Subtle scroll parallax on the aurora orbs — offset via margin, not
  // transform, since transform is already driven by the floatA/floatB
  // CSS animations and a running animation's transform value always wins
  // over one set from JS, so the scroll effect would otherwise be invisible.
  const orbARef = useRef(null)
  const orbBRef = useRef(null)
  const handleScrollParallax = e => {
    const y = e.currentTarget.scrollTop
    if (orbARef.current) orbARef.current.style.marginTop = `${Math.min(y * 0.06, 40)}px`
    if (orbBRef.current) orbBRef.current.style.marginBottom = `${Math.min(y * 0.04, 30)}px`
  }

  return (
    <div className="app-root">
      <div className="aurora-bg">
        <div ref={orbARef} className="aurora-orb-a" />
        <div ref={orbBRef} className="aurora-orb-b" />
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
          <div className="scroll-area" key={page} onScroll={handleScrollParallax}>
            {page === 'dashboard' && <Dashboard onNav={handleNav} onOpenOrder={id => openOrder(id)} period={dashboardPeriod} onMonthsLoaded={setAvailableMonths} preloadedOrders={allOrders} />}
            {page === 'my-dashboard' && <ErrorBoundary><ManagerDashboard /></ErrorBoundary>}

            {page === 'orders' && (
              <Orders
                onOpenOrder={openOrder}
                onAddOrder={() => setShowOrderModal(true)}
                refreshKey={ordersKey}
                search={search}
                onClearSearch={() => handleSearchChange('')}
                scrollToOrderId={selectedOrderId}
              />
            )}
            {page === 'order-detail' && (
              <OrderDetail
                orderId={selectedOrderId}
                onBack={() => handleNav('orders')}
                onDelete={() => { invalidateOrdersCache(); setOrdersKey(k => k + 1) }}
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
            {page === 'admin' && isEgorDir && <Admin />}
            {page === 'kudir' && isDirector && <Kudir />}
          </div>
        </main>
      </div>

      <MobileNav page={page} onNav={handleNav} counts={counts} isManager={isManager} />

      {/* Modals */}
      {showOrderModal && (
        <CreateOrderModal
          onClose={() => { setShowOrderModal(false); setDuplicateData(null); setEditOrderData(null) }}
          onSuccess={() => { setShowOrderModal(false); setDuplicateData(null); setEditOrderData(null); invalidateOrdersCache(); setOrdersKey(k => k + 1) }}
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
