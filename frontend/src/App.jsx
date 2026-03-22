import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createRepasse, getUsers, getUsersByType, login, updateUser, updateUserActive } from './api'
import { LayoutDashboard, LogIn, ShieldCheck, Users } from 'lucide-react'
import AdminRegister from './AdminRegister'
import RepasseList from './RepasseList'

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
    <div className="min-h-screen bg-gray-100 flex">
      <div className="w-64 bg-slate-900 text-white p-6 hidden md:block">
        <h2 className="text-xl font-bold mb-8 text-blue-400">FluxoGuard</h2>
        <nav className="space-y-4">
          <Link to="/admin/dashboard" className="flex items-center gap-3 hover:text-blue-300 transition-colors">
            <LayoutDashboard size={20} /> Dashboard
          </Link>
          {(user?.tipo === 'ADMIN' || user?.tipo === 'SUPERADMIN') && (
            <Link to="/admin/repasses/new" className="flex items-center gap-3 hover:text-blue-300 transition-colors">
              <Users size={20} /> Novo Repasse
            </Link>
          )}
          {(user?.tipo === 'ADMIN' || user?.tipo === 'SUPERADMIN') && (
            <Link to="/admin/repasses" className="flex items-center gap-3 hover:text-blue-300 transition-colors">
              <Users size={20} /> Histórico Repasses
            </Link>
          )}
          {user?.tipo === 'SUPERADMIN' && (
            <Link to="/admin/manage?scope=admins" className="flex items-center gap-3 hover:text-blue-300 transition-colors">
              <ShieldCheck size={20} /> Gerenciar Admins
            </Link>
          )}
          {(user?.tipo === 'ADMIN' || user?.tipo === 'SUPERADMIN') && (
            <Link to="/admin/manage?scope=partners" className="flex items-center gap-3 hover:text-blue-300 transition-colors">
              <Users size={20} /> Gerenciar Parceiros
            </Link>
          )}
          {user?.tipo === 'PARCEIRO' && (
            <Link to="/partner/transactions" className="flex items-center gap-3 hover:text-blue-300 transition-colors">
              <Users size={20} /> Meus Repasses
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-3 hover:text-blue-300 transition-colors pt-10 border-t border-slate-700"
          >
            <LogIn size={20} /> Logout
          </button>
        </nav>
      </div>

      <div className="flex-1">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
          <div className="text-sm text-gray-500">{user?.tipo || 'SEM PERFIL'}</div>
        </header>
        <main className="p-6">{children}</main>
      </div>
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-200 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Login FluxoGuard</h1>
        <p className="text-gray-500 mb-8">Email ou CNPJ + Código (123123)</p>

        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Email ou CNPJ"
          className="w-full p-3 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código (123123)"
          className="w-full p-3 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="block w-full bg-blue-600 text-white p-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-70"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

const AdminDashboard = () => {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

const NewRepassePage = () => {
  const navigate = useNavigate()
  const loggedUser = getLoggedUser()

  const [partners, setPartners] = useState([])
  const [userId, setUserId] = useState('')
  const [dataRef, setDataRef] = useState('')
  const [ano, setAno] = useState('')
  const [mes, setMes] = useState('')
  const [dia, setDia] = useState('')
  const [nomeCliente, setNomeCliente] = useState('')
  const [valorLiberado, setValorLiberado] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

    const loadPartners = async () => {
      try {
        const data = await getUsersByType('PARCEIRO')
        setPartners(data)
        if (data.length > 0) setUserId(String(data[0].id))
      } catch (err) {
        alert(err?.response?.data?.detail || 'Erro ao carregar parceiros.')
      } finally {
        setLoading(false)
      }
    }

    loadPartners()
  }, [navigate])

  const handleFileChange = (event) => {
    const selected = Array.from(event.target.files || [])
    if (selected.length > 5) {
      alert('Máximo de 5 comprovantes.')
      setFiles([])
      return
    }
    setFiles(selected)
  }

  const handleDateChange = (value) => {
    setDataRef(value)
    if (!value) {
      setAno('')
      setMes('')
      setDia('')
      return
    }
    if (value.includes('-')) {
      const [y, m, d] = value.split('-')
      setAno(y || '')
      setMes(m || '')
      setDia(d || '')
      return
    }
    if (value.includes('/')) {
      const [d, m, y] = value.split('/')
      setAno(y || '')
      setMes(m || '')
      setDia(d || '')
      return
    }
    setAno('')
    setMes('')
    setDia('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (files.length > 5) {
      alert('Máximo de 5 comprovantes.')
      return
    }
    if (!userId || !ano || !mes || !dia || !nomeCliente.trim() || !valorLiberado) {
      alert('Preencha todos os campos obrigatórios.')
      return
    }

    const formData = new FormData()
    formData.append('user_id', userId)
    formData.append('ano', ano)
    formData.append('mes', mes)
    formData.append('dia', dia)
    formData.append('nome_cliente', nomeCliente.trim())
    formData.append('valor_liberado', digitsToDecimalString(valorLiberado))
    files.forEach((file) => formData.append('comprovantes', file))

    setSaving(true)
    try {
      await createRepasse(formData)
      alert('Repasse criado com sucesso (status AGUARDANDO_NF).')
      navigate('/admin/dashboard')
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao criar repasse.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout title="Novo Repasse">
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6">Carregando parceiros...</div>
      ) : (
        <div className="flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Novo Repasse</h2>

            <label className="block text-sm text-gray-700 mb-1">Parceiro</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.nome} ({p.cnpj_cpf})</option>
              ))}
            </select>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="md:col-span-3">
                <label className="block text-sm text-gray-700 mb-1">Data do Repasse</label>
                <input
                  type="date"
                  value={dataRef}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Ano</label>
                <div className="w-full border border-gray-200 rounded px-3 py-2 bg-gray-50 text-gray-700">
                  {ano || '--'}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Mês</label>
                <div className="w-full border border-gray-200 rounded px-3 py-2 bg-gray-50 text-gray-700">
                  {mes || '--'}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Dia</label>
                <div className="w-full border border-gray-200 rounded px-3 py-2 bg-gray-50 text-gray-700">
                  {dia || '--'}
                </div>
              </div>
            </div>

            <label className="block text-sm text-gray-700 mb-1">Nome do Cliente</label>
            <input
              type="text"
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
            />

            <label className="block text-sm text-gray-700 mb-1">Valor Liberado</label>
            <input
              type="text"
              inputMode="numeric"
              value={formatCurrencyFromDigits(valorLiberado)}
              onChange={(e) => {
                const onlyDigits = e.target.value.replace(/\D/g, '')
                setValorLiberado(onlyDigits)
              }}
              placeholder="R$ 0,00"
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
            />

            <label className="block text-sm text-gray-700 mb-1">Comprovantes (até 5 arquivos)</label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-2"
            />
            <div className="text-xs text-gray-500 mb-5">{files.length} arquivo(s) selecionado(s).</div>

            <button
              type="submit"
              disabled={saving || files.length > 5}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-70"
            >
              {saving ? 'Salvando...' : 'Salvar Repasse'}
            </button>
          </form>
        </div>
      )}
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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UnifiedLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/manage" element={<ManageUsersPage />} />
        <Route path="/admin/repasses/new" element={<NewRepassePage />} />
        <Route path="/admin/repasses" element={<RepasseListPage />} />
        <Route path="/partner/transactions" element={<PartnerTransactionsPage />} />
        <Route path="/admin/edit/:userId" element={<EditUserPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
