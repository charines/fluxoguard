import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerAdmin } from './api'

const readLoggedUser = () => {
  const storedUser = localStorage.getItem('fluxoguard_admin_user')
  if (!storedUser) return null
  try {
    return JSON.parse(storedUser)
  } catch {
    return null
  }
}

const AdminRegister = ({ scope = 'partners' }) => {
  const navigate = useNavigate()
  const loggedUser = readLoggedUser()

  const canManageUsers = loggedUser?.tipo === 'SUPERADMIN' || loggedUser?.tipo === 'ADMIN'

  const allowedTypes = useMemo(() => {
    if (loggedUser?.tipo === 'SUPERADMIN') {
      if (scope === 'admins') return ['ADMIN', 'SUPERADMIN']
      if (scope === 'partners') return ['PARCEIRO']
      return ['SUPERADMIN', 'ADMIN', 'PARCEIRO']
    }

    if (loggedUser?.tipo === 'ADMIN') {
      if (scope === 'admins') return ['ADMIN']
      return ['PARCEIRO', 'ADMIN']
    }

    return []
  }, [loggedUser, scope])

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [documento, setDocumento] = useState('')
  const [tipo, setTipo] = useState(allowedTypes[0] || 'PARCEIRO')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!canManageUsers) {
      alert('Apenas ADMIN/SUPERADMIN podem cadastrar usuários.')
      return
    }

    if (!nome.trim() || !email.trim() || !telefone.trim() || !documento.trim()) {
      alert('Preencha todos os campos.')
      return
    }

    if (!allowedTypes.includes(tipo)) {
      alert('Tipo de usuário inválido para seu perfil.')
      return
    }

    setLoading(true)
    try {
      await registerAdmin({
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        documento_cnpj_cpf: documento.trim(),
        tipo,
      })
      alert('Usuário cadastrado com sucesso!')
      setNome('')
      setEmail('')
      setTelefone('')
      setDocumento('')
      setTipo(allowedTypes[0] || 'PARCEIRO')
    } catch (error) {
      const message = error?.response?.data?.detail || 'Erro ao cadastrar usuário.'
      alert(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md">
        <h1 className="text-xl font-semibold mb-4 text-gray-900">Cadastro de Usuário</h1>
        {!canManageUsers && (
          <div className="text-sm text-red-600 mb-4">
            Perfil sem permissão. Apenas ADMIN/SUPERADMIN podem cadastrar usuários.
          </div>
        )}

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

        <label className="block text-sm text-gray-700 mb-1">Documento (CPF/CNPJ)</label>
        <input
          type="text"
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
        />

        <label className="block text-sm text-gray-700 mb-1">Tipo</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-5"
        >
          {allowedTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={loading || !canManageUsers}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-70"
        >
          {loading ? 'Cadastrando...' : 'Cadastrar'}
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
  )
}

export default AdminRegister
