import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createRepasse, getUsers, getUsersByType, login, updateUser, updateUserActive } from './api'
import { LayoutDashboard, LogIn, ShieldCheck, Users, ChevronDown, Shield, BarChart3 } from 'lucide-react'
import AdminRegister from './AdminRegister'
import RepasseList from './RepasseList'
import LandingPage from './LandingPage'
import { ApiHealthProvider, useApiHealth } from './ApiHealthContext'
import HealthScreen from './HealthScreen'

const getLoggedUser = () => {
  const rawUser = localStorage.getItem('fluxoguard_admin_user')
  if (!rawUser) return null

  try {
    return JSON.parse(rawUser)
  } catch {
    return null
  }
}

const canToggleTarget = (loggedUser, targetUser) => {
  if (!loggedUser) return false
  if (loggedUser.tipo === 'SUPERADMIN') {
    return targetUser.tipo === 'ADMIN' || targetUser.tipo === 'PARCEIRO'
  }
  if (loggedUser.tipo === 'ADMIN') {
    return targetUser.tipo === 'PARCEIRO'
  }
  return false
}

const canEditTarget = (loggedUser, targetUser) => {
  if (!loggedUser) return false
  if (loggedUser.id === targetUser.id && (loggedUser.tipo === 'ADMIN' || loggedUser.tipo === 'SUPERADMIN')) {
    return true
  }
  if (loggedUser.tipo === 'SUPERADMIN') {
    return targetUser.tipo === 'ADMIN' || targetUser.tipo === 'PARCEIRO'
  }
  if (loggedUser.tipo === 'ADMIN') {
    return targetUser.tipo === 'PARCEIRO'
  }
  return false
}

const currencyInputFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const formatCurrencyFromDigits = (digits) => {
  if (!digits) return ''
  const value = Number(digits) / 100
  return currencyInputFormatter.format(value)
}

const digitsToDecimalString = (digits) => {
  if (!digits) return ''
  return (Number(digits) / 100).toFixed(2)
}

const DashboardLayout = ({ title, children }) => {
  const navigate = useNavigate()
  const user = getLoggedUser()

  const handleLogout = () => {
    localStorage.removeItem('fluxoguard_admin_token')
    localStorage.removeItem('fluxoguard_admin_user')
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="w-full max-w-[1800px] mx-auto flex h-16 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-primary">FluxoGuard</h2>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link to="/admin/dashboard" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Dashboard
            </Link>
            {(user?.tipo === 'ADMIN' || user?.tipo === 'SUPERADMIN') && (
              <Link to="/admin/repasses" className="transition-colors hover:text-foreground/80 text-foreground/60">
                Histórico
              </Link>
            )}
            {(user?.tipo === 'ADMIN' || user?.tipo === 'SUPERADMIN') && (
              <Link to="/admin/users" className="transition-colors hover:text-foreground/80 text-foreground/60">
                Usuários
              </Link>
            )}
            {user?.tipo === 'PARCEIRO' && (
              <Link to="/partner/transactions" className="transition-colors hover:text-foreground/80 text-foreground/60">
                Meus Repasses
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground hidden sm:block">
              {user?.nome || 'Usuário'} <span className="text-xs opacity-70">({user?.tipo || 'SEM PERFIL'})</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
            >
              <LogIn size={18} /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1800px] mx-auto py-8 px-4 md:px-8 flex-1">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        </div>
        {children}
      </main>
    </div>
  )
}

const UnifiedLogin = () => {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (event) => {
    event.preventDefault()

    if (!identifier.trim() || !code.trim()) {
      setError('Informe Email ou CNPJ e o código.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await login({
        identifier: identifier.trim(),
        code: code.trim(),
      })

      localStorage.setItem('fluxoguard_admin_token', data.access_token)
      localStorage.setItem('fluxoguard_admin_user', JSON.stringify(data.user))
      if (data.user.tipo === 'PARCEIRO') {
        navigate('/partner/transactions')
      } else {
        navigate('/admin/dashboard')
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Falha no login.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dark-theme min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
      
      <form onSubmit={handleLogin} className="glass p-10 rounded-2xl shadow-2xl w-full max-w-md border border-white/10 text-center relative z-10 backdrop-blur-xl">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Shield className="w-12 h-12 text-primary shrink-0" />
            <BarChart3 className="w-6 h-6 text-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>
        
        <h1 className="text-3xl font-space font-extrabold text-foreground mb-2 tracking-tight">Login FluxoGuard</h1>
        <p className="text-muted-foreground mb-8 text-sm">Organização financeira de ponta a ponta.</p>

        <div className="space-y-4 text-left">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Identificador</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="E-mail ou CNPJ"
              className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all placeholder:text-muted-foreground/30"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Código de Acesso</label>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123123"
              className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all placeholder:text-muted-foreground/30"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mt-4 mb-2">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-8 w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:shadow-[0_0_20px_rgba(255,107,0,0.3)] transition-all disabled:opacity-50 active:scale-95"
        >
          {loading ? 'Validando...' : 'ENTRAR NO SISTEMA'}
        </button>

        <p className="mt-8 text-xs text-muted-foreground">
          Precisa de ajuda? <a href="#" className="text-primary hover:underline">Falar com suporte</a>
        </p>
      </form>
    </div>
  )
}

const LoginWithHealthCheck = () => {
  const { status, retry } = useApiHealth()

  if (status === 'online') {
    return <UnifiedLogin />
  }

  return <HealthScreen status={status} onRetry={retry} />
}

const AdminDashboard = () => {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const loggedUser = getLoggedUser()

  const loadUsers = async () => {
    try {
      const data = await getUsers()
      setUsers(data)
    } catch (err) {
      console.error(err?.response?.data?.detail || 'Erro ao carregar usuários.')
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('fluxoguard_admin_token')
    if (!token || !loggedUser) {
      navigate('/')
      return
    }
    loadUsers()
  }, [navigate])

  return (
    <DashboardLayout title="Dashboard Administrativa">
      <div className="mb-6">
        <button
          onClick={() => setDashboardOpen(!dashboardOpen)}
          className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors w-full sm:w-auto"
        >
          <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
          Painel Administrativo
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${dashboardOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${dashboardOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-gray-500 text-sm font-medium">Usuários Totais</h3>
              <p className="text-3xl font-bold text-slate-900">{users.length}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-gray-500 text-sm font-medium">Perfil Atual</h3>
              <p className="text-2xl font-bold text-orange-500">{loggedUser?.tipo || '--'}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-gray-500 text-sm font-medium">Ações</h3>
              <div className="text-sm mt-2 space-y-2">
                {loggedUser?.tipo === 'SUPERADMIN' && (
                  <div>
                    <Link className="text-blue-700 hover:underline" to="/admin/manage?scope=admins">Gerenciar Admins</Link>
                  </div>
                )}
                {(loggedUser?.tipo === 'ADMIN' || loggedUser?.tipo === 'SUPERADMIN') && (
                  <div>
                    <Link className="text-blue-700 hover:underline" to="/admin/users">Usuários Cadastrados</Link>
                  </div>
                )}
                {(loggedUser?.tipo === 'ADMIN' || loggedUser?.tipo === 'SUPERADMIN') && (
                  <div>
                    <Link className="text-blue-700 hover:underline" to="/admin/manage?scope=partners">Gerenciar Parceiros</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <RepasseList />
    </DashboardLayout>
  )
}

const AdminUsersPage = () => {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loggedUser = getLoggedUser()

  const loadUsers = async () => {
    try {
      const data = await getUsers()
      setUsers(data)
      setError(null)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Erro ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('fluxoguard_admin_token')
    if (!token || !loggedUser) {
      navigate('/')
      return
    }
    if (!(loggedUser.tipo === 'ADMIN' || loggedUser.tipo === 'SUPERADMIN')) {
      navigate('/admin/dashboard')
      return
    }
    loadUsers()
  }, [navigate])

  const handleToggle = async (target) => {
    try {
      const updated = await updateUserActive(target.id, !target.is_active)
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao atualizar status do usuário.')
    }
  }

  const handleEdit = async (target) => {
    navigate(`/admin/edit/${target.id}`)
  }

  return (
    <DashboardLayout title="Usuários Cadastrados">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Usuários Cadastrados</h3>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400">Carregando usuários...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-500">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                  <th className="px-6 py-3">Nome</th>
                  <th className="px-6 py-3">E-mail</th>
                  <th className="px-6 py-3">Telefone</th>
                  <th className="px-6 py-3">CPF/CNPJ</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((item) => {
                  const canToggle = canToggleTarget(loggedUser, item)
                  const canEdit = canEditTarget(loggedUser, item)
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.nome}</td>
                      <td className="px-6 py-4 text-gray-600">{item.email}</td>
                      <td className="px-6 py-4 text-gray-500">{item.telefone || '-'}</td>
                      <td className="px-6 py-4 text-gray-500">{item.cnpj_cpf}</td>
                      <td className="px-6 py-4 text-gray-700 font-semibold">{item.tipo}</td>
                      <td className="px-6 py-4 text-gray-700">{item.is_active ? 'Ativo' : 'Inativo'}</td>
                      <td className="px-6 py-4 text-right">
                        {canEdit || canToggle ? (
                          <div className="flex items-center gap-2 justify-end">
                            {canEdit && (
                              <button
                                onClick={() => handleEdit(item)}
                                className="text-sm px-3 py-1 rounded bg-blue-700 text-white hover:bg-blue-600"
                              >
                                Editar
                              </button>
                            )}
                            {canToggle && (
                              <button
                                onClick={() => handleToggle(item)}
                                className="text-sm px-3 py-1 rounded bg-slate-800 text-white hover:bg-slate-700"
                              >
                                {item.is_active ? 'Inativar' : 'Ativar'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Sem permissão</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-10 text-center text-gray-400">
                      Nenhum usuário encontrado no banco.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}



const RepasseListPage = () => {
  const navigate = useNavigate()
  const loggedUser = getLoggedUser()

  useEffect(() => {
    const token = localStorage.getItem('fluxoguard_admin_token')
    if (!token || !loggedUser) {
      navigate('/')
      return
    }
    if (!(loggedUser.tipo === 'ADMIN' || loggedUser.tipo === 'SUPERADMIN')) {
      navigate('/admin/dashboard')
      return
    }
  }, [navigate])

  return (
    <DashboardLayout title="Histórico de Repasses">
      <RepasseList />
    </DashboardLayout>
  )
}

const PartnerTransactionsPage = () => {
  const navigate = useNavigate()
  const loggedUser = getLoggedUser()

  useEffect(() => {
    const token = localStorage.getItem('fluxoguard_admin_token')
    if (!token || !loggedUser) {
      navigate('/')
      return
    }
    if (loggedUser.tipo !== 'PARCEIRO') {
      navigate('/admin/dashboard')
      return
    }
  }, [navigate])

  return (
    <DashboardLayout title="Meus Repasses">
      <RepasseList />
    </DashboardLayout>
  )
}

const ManageUsersPage = () => {
  const navigate = useNavigate()
  const user = getLoggedUser()
  const [searchParams] = useSearchParams()
  const scope = searchParams.get('scope') || 'partners'

  useEffect(() => {
    const token = localStorage.getItem('fluxoguard_admin_token')
    if (!token || !user) {
      navigate('/')
      return
    }
  }, [navigate])

  return (
    <DashboardLayout title="Gestão de Usuários">
      <AdminRegister scope={scope} />
    </DashboardLayout>
  )
}

const EditUserPage = () => {
  const navigate = useNavigate()
  const { userId } = useParams()
  const loggedUser = getLoggedUser()

  const [targetUser, setTargetUser] = useState(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('fluxoguard_admin_token')
    if (!token || !loggedUser) {
      navigate('/')
      return
    }

    const loadTarget = async () => {
      try {
        const users = await getUsers()
        const found = users.find((u) => String(u.id) === String(userId))
        if (!found) {
          setError('Usuário não encontrado.')
          return
        }

        if (!canEditTarget(loggedUser, found)) {
          setError('Sem permissão para editar este usuário.')
          return
        }

        setTargetUser(found)
        setNome(found.nome || '')
        setEmail(found.email || '')
        setTelefone(found.telefone || '')
      } catch (err) {
        setError(err?.response?.data?.detail || 'Erro ao carregar usuário.')
      } finally {
        setLoading(false)
      }
    }

    loadTarget()
  }, [navigate, userId])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!targetUser) return

    if (!nome.trim() || !email.trim()) {
      alert('Nome e Email são obrigatórios.')
      return
    }

    setSaving(true)
    try {
      const updated = await updateUser(targetUser.id, {
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
      })

      if (loggedUser && loggedUser.id === updated.id) {
        localStorage.setItem('fluxoguard_admin_user', JSON.stringify({
          ...loggedUser,
          nome: updated.nome,
          email: updated.email,
          telefone: updated.telefone,
        }))
      }

      alert('Usuário atualizado com sucesso!')
      navigate('/admin/dashboard')
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao atualizar usuário.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout title="Editar Usuário">
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6">Carregando...</div>
      ) : error ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-red-600">{error}</div>
      ) : (
        <div className="flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Editar Usuário</h2>

            <label className="block text-sm text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
            />

            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
            />

            <label className="block text-sm text-gray-700 mb-1">Telefone</label>
            <input
              type="text"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
            />

            <div className="text-xs text-gray-500 mb-5">
              CPF/CNPJ e Tipo não podem ser alterados nesta tela.
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-70"
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin/dashboard')}
              className="w-full mt-3 border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-50"
            >
              Voltar ao Dashboard
            </button>
          </form>
        </div>
      )}
    </DashboardLayout>
  )
}

function App() {
  return (
    <ApiHealthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginWithHealthCheck />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/manage" element={<ManageUsersPage />} />
          <Route path="/admin/repasses" element={<RepasseListPage />} />
          <Route path="/partner/transactions" element={<PartnerTransactionsPage />} />
          <Route path="/admin/edit/:userId" element={<EditUserPage />} />
        </Routes>
      </BrowserRouter>
    </ApiHealthProvider>
  )
}

export default App
