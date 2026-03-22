import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { getUsers } from './api'
import { LayoutDashboard, Users, Upload, LogIn } from 'lucide-react'

// Layout Wrapper
const DashboardLayout = ({ title, children }) => (
  <div className="min-h-screen bg-gray-100 flex">
    {/* Sidebar */}
    <div className="w-64 bg-slate-900 text-white p-6 hidden md:block">
      <h2 className="text-xl font-bold mb-8 text-blue-400">FluxoGuard</h2>
      <nav className="space-y-4">
        <Link to="/admin" className="flex items-center gap-3 hover:text-blue-300 transition-colors">
          <LayoutDashboard size={20} /> Dashboard
        </Link>
        <Link to="/parceiro" className="flex items-center gap-3 hover:text-blue-300 transition-colors">
          <Upload size={20} /> Upload NF
        </Link>
        <Link to="/" className="flex items-center gap-3 hover:text-blue-300 transition-colors pt-10 border-t border-slate-700">
          <LogIn size={20} /> Logout
        </Link>
      </nav>
    </div>

    {/* Main Content */}
    <div className="flex-1">
      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
        <div className="text-sm text-gray-500">v0.1-dev</div>
      </header>
      <main className="p-6">
        {children}
      </main>
    </div>
  </div>
)

const Login = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-200 text-center">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Acesso FluxoGuard</h1>
      <p className="text-gray-500 mb-8">Digite seu token de acesso recebido por e-mail.</p>
      <input 
        type="text" 
        placeholder="Seu Token" 
        className="w-full p-3 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <Link to="/admin" className="block w-full bg-blue-600 text-white p-3 rounded-lg font-medium hover:bg-blue-700 transition">
        Entrar no Sistema
      </Link>
    </div>
  </div>
)

const AdminDashboard = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getUsers()
      .then(data => {
        setUsers(data)
        setLoading(false)
      })
      .catch(err => {
        setError("Erro ao carregar dados do Backend. Verifique se o servidor está rodando.")
        setLoading(false)
      })
  }, [])

  return (
    <DashboardLayout title="Dashboard Administrativa">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-gray-500 text-sm font-medium">Parceiros Ativos</h3>
          <p className="text-3xl font-bold text-slate-900">{users.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-gray-500 text-sm font-medium">Liberações Pendentes</h3>
          <p className="text-3xl font-bold text-orange-500">--</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-gray-500 text-sm font-medium">Valor Total Ajustado</h3>
          <p className="text-3xl font-bold text-green-600">--</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Parceiros Cadastrados</h3>
          <button className="text-sm text-blue-600 font-medium hover:underline">+ Novo Parceiro</button>
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
                  <th className="px-6 py-3">CPF/CNPJ</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{user.nome}</td>
                    <td className="px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="px-6 py-4 text-gray-500">{user.cnpj_cpf}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.tipo === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user.tipo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-500 hover:text-blue-700 text-sm font-medium">Ver NF</button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-10 text-center text-gray-400">Nenhum parceiro encontrado no banco.</td>
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

const ParceiroUpload = () => (
  <DashboardLayout title="Upload de Nota Fiscal">
    <div className="bg-white p-10 rounded-xl shadow-lg border border-dashed border-gray-300 text-center max-w-2xl mx-auto mt-10">
      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <Upload className="text-blue-500" size={32} />
      </div>
      <h2 className="text-xl font-bold mb-4">Selecione seu arquivo PDF</h2>
      <p className="text-gray-500 mb-8 italic">Apenas arquivos de Nota Fiscal Eletrônica são aceitos.</p>
      <input type="file" className="hidden" id="fileInput" />
      <label htmlFor="fileInput" className="cursor-pointer bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition">
        Escolher Arquivo
      </label>
    </div>
  </DashboardLayout>
)

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/parceiro" element={<ParceiroUpload />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
