import React, { useEffect, useMemo, useState, useRef } from 'react'
import CryptoJS from 'crypto-js'

const MAGIC_SECRET = import.meta.env.VITE_MAGIC_LINK_SECRET || 'fluxoguard_secure_key_2026'
import { Search, Calendar, Plus, X, UploadCloud, CheckCircle, AlertTriangle, Clock, AlertCircle, Lock, Image as ImageIcon, FileText, Download, Trash2, MoreHorizontal, Check, Bell, Mail, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  changeTransactionStatus,
  downloadFile,
  finalizeTransactionsBatch,
  getTransactions,
  rejectTransaction,
  removeTransactionFile,
  updateRepasse,
  getUsersByType,
  uploadNotasFiscais,
} from './api'

const readLoggedUser = () => {
  const raw = localStorage.getItem('fluxoguard_admin_user')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const toDateInput = (tx) => {
  if (!tx?.ano || !tx?.mes || !tx?.dia) return ''
  return `${String(tx.ano).padStart(4, '0')}-${String(tx.mes).padStart(2, '0')}-${String(tx.dia).padStart(2, '0')}`
}

const formatDate = (tx) => {
  if (!tx?.ano || !tx?.mes || !tx?.dia) return '-'
  return `${String(tx.dia).padStart(2, '0')}/${String(tx.mes).padStart(2, '0')}/${tx.ano}`
}

const canUploadNF = (tx) => ['LIBERADO', 'AGUARDANDO_NF', 'DIVERGENCIA', 'AGUARDANDO_APROVACAO'].includes(tx.status)

const RepasseList = () => {
  const loggedUser = readLoggedUser()
  const isAdmin = loggedUser?.tipo === 'ADMIN' || loggedUser?.tipo === 'SUPERADMIN'
  const isPartner = loggedUser?.tipo === 'PARCEIRO'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editing, setEditing] = useState(null)
  const [dataRef, setDataRef] = useState('')
  const [ano, setAno] = useState('')
  const [mes, setMes] = useState('')
  const [dia, setDia] = useState('')
  const [nomeCliente, setNomeCliente] = useState('')
  const [valorLiberado, setValorLiberado] = useState('')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [newRepasseOpen, setNewRepasseOpen] = useState(false)
  const [partners, setPartners] = useState([])
  const [newRepasseData, setNewRepasseData] = useState({ userId: '', dateStr: '', nomeCliente: '', valorLiberado: '', files: [] })


  const [extraComprovantesMap, setExtraComprovantesMap] = useState({})
  const [nfMap, setNfMap] = useState({})

  const [selectedMap, setSelectedMap] = useState({})
  const [processingBatch, setProcessingBatch] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(null) // tx.id or null
  const [notifyModal, setNotifyModal] = useState(null) // tx or null
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  const generateMailtoLink = (parceiroEmail, status, transacaoId, tx) => {
    const config = NOTIFY_CONFIG[status] || NOTIFY_CONFIG['DEFAULT']
    const subject = encodeURIComponent(`[FluxoGuard] Atualização da Transação #${transacaoId}`)
    
    const dataStr = formatDate(tx);
    const valorStr = formatCurrency(tx.valor_liberado);
    
    // MAGIC LINK LOGIC
    const payload = JSON.stringify({
      id: transacaoId,
      email: parceiroEmail,
      extExp: Date.now() + 24 * 60 * 60 * 1000 // 24h
    })
    const encrypted = CryptoJS.AES.encrypt(payload, MAGIC_SECRET).toString()
    const magicLink = `https://fluxoguard-web.onrender.com/#/secure-share?token=${encodeURIComponent(encrypted)}`

    let bodyText = `${config.suggestion}\n\n`
    bodyText += `--- DETALHES DA TRANSAÇÃO ---\n`
    bodyText += `ID: #${transacaoId}\n`
    bodyText += `Data: ${dataStr}\n`
    bodyText += `Parceiro: ${tx.parceiro_nome || 'N/A'}\n`
    bodyText += `Cliente: ${tx.nome_cliente || 'N/A'}\n`
    bodyText += `Valor: ${valorStr}\n`
    bodyText += `Status Atual: ${status}\n\n`
    bodyText += `Acesse os detalhes e baixe os documentos com segurança aqui: ${magicLink}`

    const body = encodeURIComponent(bodyText)
    return `mailto:${parceiroEmail}?subject=${subject}&body=${body}`
  }

  const NOTIFY_CONFIG = {
    'LIBERADO': {
      title: 'Enviar Lembrete de NF',
      icon: <Clock className="w-8 h-8 text-blue-500" />,
      suggestion: 'Lembrete: Parceiro, não esqueça de subir a Nota Fiscal do repasse para prosseguirmos com o pagamento.',
      buttonText: 'Abrir E-mail de Lembrete',
      color: 'blue'
    },
    'AGUARDANDO_NF': {
      title: 'Enviar Lembrete de NF',
      icon: <Clock className="w-8 h-8 text-blue-500" />,
      suggestion: 'Lembrete: Parceiro, não esqueça de subir a Nota Fiscal do repasse para prosseguirmos com o pagamento.',
      buttonText: 'Abrir E-mail de Lembrete',
      color: 'blue'
    },
    'AGUARDANDO_APROVACAO': {
      title: 'Notificar Análise Financeira',
      icon: <Clock className="w-8 h-8 text-amber-500" />,
      suggestion: 'Informamos que seu repasse está sendo analisado pelo nosso time financeiro. Em breve você receberá novas atualizações sobre o pagamento.',
      buttonText: 'Enviar Aviso de Análise',
      color: 'amber'
    },
    'DIVERGENCIA': {
      title: 'Notificar Divergência',
      icon: <AlertCircle className="w-8 h-8 text-red-500" />,
      suggestion: 'Identificamos que os documentos enviados estão divergentes. O time financeiro está analisando a situação para garantir que tudo seja corrigido o quanto antes.',
      buttonText: 'Avisar sobre Divergência',
      color: 'red'
    },
    'PAGO': {
      title: 'Enviar Recibo de Quitação',
      icon: <FileText className="w-8 h-8 text-purple-500" />,
      suggestion: 'Informamos que o ciclo deste repasse foi concluído com sucesso. Segue o recibo de quitação para seus registros.',
      buttonText: 'Enviar Recibo Final',
      color: 'purple'
    },
    'FINALIZADO': {
      title: 'Repasse Finalizado',
      icon: <Lock className="w-8 h-8 text-slate-600" />,
      suggestion: 'Informamos que este repasse já foi finalizado no sistema. Devido ao encerramento do ciclo, os arquivos individuais não estão mais disponíveis para download. Caso necessite de alguma cópia, por favor, entre em contato com nosso time financeiro.',
      buttonText: 'Avisar Finalização',
      color: 'slate'
    },
    'DEFAULT': {
      title: 'Notificar Parceiro',
      icon: <Bell className="w-8 h-8 text-slate-500" />,
      suggestion: 'Olá parceiro, gostaria de falar sobre o repasse em questão.',
      buttonText: 'Enviar Mensagem',
      color: 'slate'
    }
  }

  const STATUS_OPTIONS = [
    { value: 'AGUARDANDO_NF', label: 'Aguardando NF' },
    { value: 'AGUARDANDO_APROVACAO', label: 'Aprovação' },
    { value: 'DIVERGENCIA', label: 'Divergência' },
    { value: 'PAGO', label: 'Pago' },
    { value: 'FINALIZADO', label: 'Finalizado' },
  ]

  const handleChangeStatus = async (tx, newStatus) => {
    if (tx.status === newStatus) {
      setStatusMenuOpen(null)
      return
    }
    try {
      const updated = await changeTransactionStatus(tx.id, newStatus)
      setRows((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao alterar status.')
    }
    setStatusMenuOpen(null)
  }

  const loadRows = async () => {
    try {
      const data = await getTransactions()
      setRows(data)
      setError(null)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Erro ao carregar repasses.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [])

  const selectedIds = useMemo(
    () => Object.entries(selectedMap).filter(([, checked]) => checked).map(([id]) => Number(id)),
    [selectedMap]
  )

  const editableRows = useMemo(() => rows.filter((tx) => tx.status !== 'FINALIZADO'), [rows])
  const allChecked = editableRows.length > 0 && editableRows.every((tx) => selectedMap[tx.id])

  const openEdit = (tx) => {
    setEditing(tx)
    setDataRef(toDateInput(tx))
    setAno(tx.ano || '')
    setMes(tx.mes || '')
    setDia(tx.dia || '')
    setNomeCliente(tx.nome_cliente || '')
    setValorLiberado(tx.valor_liberado ?? '')
    setFiles([])
  }

  const closeEdit = () => {
    setEditing(null)
    setFiles([])
  }

  const existingCount = useMemo(() => (editing?.comprovantes?.length || 0), [editing])
  const remainingSlots = useMemo(() => Math.max(0, 5 - existingCount), [existingCount])

  
  useEffect(() => {
    if (isAdmin) {
      getUsersByType('PARCEIRO').then(data => {
        setPartners(data)
        if (data.length > 0) setNewRepasseData(prev => ({ ...prev, userId: String(data[0].id) }))
      }).catch(console.error)
    }
  }, [isAdmin])

  const handleCreateRepasse = async (e) => {
    e.preventDefault()
    if (newRepasseData.files.length > 5) return alert('Máximo de 5 comprovantes.')
    let y = '', m = '', d = ''
    if (newRepasseData.dateStr) {
      const parts = newRepasseData.dateStr.split('-')
      y = parts[0]
      m = parts[1]
      d = parts[2]
    }
    if (!newRepasseData.userId || !y || !m || !d || !newRepasseData.nomeCliente || !newRepasseData.valorLiberado) {
      return alert('Preencha os campos obrigatórios.')
    }
    const formData = new FormData()
    formData.append('user_id', newRepasseData.userId)
    formData.append('ano', y)
    formData.append('mes', m)
    formData.append('dia', d)
    formData.append('nome_cliente', newRepasseData.nomeCliente)
    
    const valString = newRepasseData.valorLiberado.replace(/\D/g, '')
    const valFloat = (Number(valString)/100).toFixed(2)
    formData.append('valor_liberado', valFloat)
    
    newRepasseData.files.forEach(f => formData.append('comprovantes', f))
    
    setSaving(true)
    try {
      await createRepasse(formData)
      alert('Repasse criado com sucesso')
      setNewRepasseOpen(false)
      loadRows()
    } catch (e) {
      alert(e?.response?.data?.detail || 'Erro ao criar')
    } finally {
      setSaving(false)
    }
  }
  
  const StatusBadge = ({ status }) => {
    switch (status) {
      case 'AGUARDANDO_NF':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium tracking-wide bg-slate-100 text-slate-700 border border-slate-200"><Clock className="w-3.5 h-3.5" /> Aguardando NF</span>
      case 'AGUARDANDO_APROVACAO':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium tracking-wide bg-amber-50 text-amber-700 border border-amber-200"><AlertTriangle className="w-3.5 h-3.5" /> Aprovação</span>
      case 'PAGO':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle className="w-3.5 h-3.5" /> Pago</span>
      case 'DIVERGENCIA':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium tracking-wide bg-red-50 text-red-600 border border-red-200"><AlertCircle className="w-3.5 h-3.5" /> Divergência</span>
      case 'FINALIZADO':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium tracking-wide bg-slate-900 text-slate-50 border border-slate-900"><Lock className="w-3.5 h-3.5" /> Finalizado</span>
      case 'LIBERADO':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200"><CheckCircle className="w-3.5 h-3.5" /> Liberado</span>
      case 'CONFERENCIA':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium tracking-wide bg-blue-50 text-blue-700 border border-blue-200"><Clock className="w-3.5 h-3.5" /> Conferência</span>
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium tracking-wide bg-secondary text-secondary-foreground border border-border">{status}</span>
    }
  }
  
  const filteredRows = rows.filter(tx => {
    const matchSearch = tx.nome_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) || tx.parceiro_nome?.toLowerCase().includes(searchTerm.toLowerCase())
    if (searchTerm && !matchSearch) return false
    if (dateFilter) {
      const txDate = toDateInput(tx)
      if (txDate !== dateFilter) return false
    }
    return true
  })

  const handleDateChange = (value) => {
    setDataRef(value)
    if (!value) {
      setAno('')
      setMes('')
      setDia('')
      return
    }
    const [y, m, d] = value.split('-')
    setAno(y || '')
    setMes(m || '')
    setDia(d || '')
  }

  const handleFilesChange = (event) => {
    const selected = Array.from(event.target.files || [])
    if (selected.length > remainingSlots) {
      alert(`Você pode anexar no máximo ${remainingSlots} arquivo(s) neste repasse.`)
      setFiles([])
      return
    }
    setFiles(selected)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!editing) return
    if (!ano || !mes || !dia || !nomeCliente.trim() || !valorLiberado) {
      alert('Preencha data, cliente e valor.')
      return
    }
    if (files.length > remainingSlots) {
      alert(`Limite de comprovantes excedido. Restam ${remainingSlots}.`)
      return
    }

    const formData = new FormData()
    formData.append('ano', String(ano))
    formData.append('mes', String(mes))
    formData.append('dia', String(dia))
    formData.append('nome_cliente', nomeCliente.trim())
    formData.append('valor_liberado', String(valorLiberado))
    files.forEach((file) => formData.append('comprovantes', file))

    setSaving(true)
    try {
      const updated = await updateRepasse(editing.id, formData)
      setRows((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      closeEdit()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao atualizar repasse.')
    } finally {
      setSaving(false)
    }
  }

  const selectExtraComprovantes = (transactionId, event, currentCount) => {
    const selected = Array.from(event.target.files || [])
    const remaining = Math.max(0, 5 - currentCount)
    if (selected.length > remaining) {
      alert(`Você pode subir no máximo ${remaining} comprovante(s).`)
      setExtraComprovantesMap((prev) => ({ ...prev, [transactionId]: [] }))
      return
    }
    setExtraComprovantesMap((prev) => ({ ...prev, [transactionId]: selected }))
  }

  const uploadExtraComprovantes = async (tx) => {
    const selected = extraComprovantesMap[tx.id] || []
    const currentCount = tx.comprovantes?.length || 0
    const remaining = Math.max(0, 5 - currentCount)

    if (selected.length === 0) {
      alert('Selecione ao menos 1 comprovante.')
      return
    }
    if (selected.length > remaining) {
      alert(`Limite excedido. Restam ${remaining} comprovante(s).`)
      return
    }

    const formData = new FormData()
    selected.forEach((file) => formData.append('comprovantes', file))

    try {
      const updated = await updateRepasse(tx.id, formData)
      setRows((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setExtraComprovantesMap((prev) => ({ ...prev, [tx.id]: [] }))
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao enviar comprovantes.')
    }
  }

  const selectNfFiles = (transactionId, event) => {
    const selected = Array.from(event.target.files || [])
    if (selected.length > 5) {
      alert('Máximo de 5 notas fiscais.')
      setNfMap((prev) => ({ ...prev, [transactionId]: [] }))
      return
    }
    setNfMap((prev) => ({ ...prev, [transactionId]: selected }))
  }

  const submitNf = async (tx) => {
    const filesToSend = nfMap[tx.id] || []
    if (filesToSend.length === 0) {
      alert('Selecione ao menos 1 arquivo de NF.')
      return
    }
    if (filesToSend.length > 5) {
      alert('Máximo de 5 notas fiscais.')
      return
    }

    try {
      const updated = await uploadNotasFiscais(tx.id, filesToSend)
      setRows((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setNfMap((prev) => ({ ...prev, [tx.id]: [] }))
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao enviar notas fiscais.')
    }
  }

  const handleReject = async (tx) => {
    try {
      const updated = await rejectTransaction(tx.id)
      setRows((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao marcar divergência.')
    }
  }

  const handleDownload = async (path) => {
    try {
      const blob = await downloadFile(path)
      const url = window.URL.createObjectURL(blob)
      const fileName = String(path || 'arquivo').split('/').pop() || 'arquivo'
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao baixar arquivo.')
    }
  }

  const handleRemoveFile = async (tx, fileType, filePath) => {
    const confirmed = window.confirm('Deseja remover este arquivo?')
    if (!confirmed) return

    try {
      const updated = await removeTransactionFile(tx.id, fileType, filePath)
      setRows((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao remover arquivo.')
    }
  }

  const toggleRow = (id) => {
    setSelectedMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleAllRows = () => {
    const next = {}
    editableRows.forEach((tx) => {
      next[tx.id] = !allChecked
    })
    setSelectedMap(next)
  }


  const submitBatchFinalize = async () => {
    if (selectedIds.length === 0) {
      alert('Selecione ao menos um repasse.')
      return
    }

    const confirmed = window.confirm('Finalizar e gerar ZIP contábil para os repasses selecionados?')
    if (!confirmed) return

    setProcessingBatch(true)
    try {
      const updatedRows = await finalizeTransactionsBatch(selectedIds)
      setRows((prev) => {
        const map = new Map(updatedRows.map((item) => [item.id, item]))
        return prev.map((item) => map.get(item.id) || item)
      })
      setSelectedMap({})
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao finalizar repasses.')
    } finally {
      setProcessingBatch(false)
    }
  }


  const [fileModal, setFileModal] = useState(null) // { tx, type }

  const openFileModal = (tx, type) => setFileModal({ tx, type })
  const closeFileModal = () => setFileModal(null)

  const FileCell = ({ tx, type }) => {
    const isComp = type === 'COMPROVANTE'
    const cellFiles = isComp ? tx.comprovantes : tx.notas_fiscais
    const count = cellFiles?.length || 0
    const canClick = tx.status === 'FINALIZADO'
      ? (isAdmin && isComp && tx.zip_contabilidade_url)
      : (count > 0 || (isComp ? (isAdmin && tx.status !== 'FINALIZADO') : (isPartner && canUploadNF(tx))))

    return (
      <div
        className={`flex justify-center py-2 ${canClick ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''}`}
        onClick={() => canClick && openFileModal(tx, type)}
      >
        {tx.status === 'FINALIZADO' ? (
          isAdmin && isComp && tx.zip_contabilidade_url ? (
            <div className="flex items-center gap-1.5 text-blue-600 font-medium text-xs bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
              <Download className="w-3.5 h-3.5" /> ZIP
            </div>
          ) : (
            <span className="text-muted-foreground font-medium">—</span>
          )
        ) : count === 0 ? (
          canClick ? (
            <div className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <UploadCloud className="w-4 h-4" />
              <span className="text-xs font-medium">Enviar</span>
            </div>
          ) : (
            <span className="text-muted-foreground font-medium">—</span>
          )
        ) : (
          <div className={`flex items-center gap-1.5 font-medium ${isComp ? 'text-emerald-600' : 'text-blue-600'}`}>
            {isComp ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            <span className="text-sm">{count}</span>
          </div>
        )}
      </div>
    )
  }

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredRows.slice(start, start + itemsPerPage)
  }, [filteredRows, currentPage])

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage)

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  const renderEmptyRows = () => {
    const emptyCount = itemsPerPage - paginatedRows.length
    if (emptyCount <= 0) return null
    return Array.from({ length: emptyCount }).map((_, i) => (
      <tr key={`empty-${i}`} className="h-[73px] border-b border-border/50 opacity-0">
        <td colSpan={isAdmin ? 9 : 6}>&nbsp;</td>
      </tr>
    ))
  }

  return (
    <div className="space-y-6 animate-accordion-down w-full max-w-[100vw]">
      {isAdmin && (
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-card p-4 rounded-lg border border-border mt-4">
          <div className="flex items-center gap-4 flex-1 w-full">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input 
                type="text" 
                placeholder="Buscar por parceiro ou cliente..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="relative">
              <input 
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <button 
            onClick={() => setNewRepasseOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Novo Repasse
          </button>
        </div>
      )}

      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        {isAdmin && (
          <div className="p-4 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-4">
            <h3 className="font-semibold text-foreground">Histórico de Repasses</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={submitBatchFinalize}
                disabled={selectedIds.length === 0 || processingBatch}
                className="text-xs px-3 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border disabled:opacity-50 transition-colors"
              >
                Finalizar e Gerar ZIP
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-muted-foreground">Carregando repasses...</div>
        ) : error ? (
          <div className="p-10 text-center text-destructive">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                  {isAdmin && (
                    <th className="px-4 py-3 w-10 text-center">
                      <input type="checkbox" checked={allChecked || false} onChange={toggleAllRows} className="rounded border-input text-primary focus:ring-primary" />
                    </th>
                  )}
                  <th className="px-6 py-3">Data</th>
                  {isAdmin && <th className="px-6 py-3">Parceiro</th>}
                  <th className="px-6 py-3">Cliente</th>
                  <th className="px-6 py-3">Valor</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Nota Fiscal</th>
                  <th className="px-6 py-3">Comprovante</th>
                  {isAdmin && <th className="px-6 py-3 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-foreground">
                {paginatedRows.map((tx) => {
                  const compCount = tx.comprovantes?.length || 0
                  const remainingComp = Math.max(0, 5 - compCount)
                  const selectedComp = extraComprovantesMap[tx.id] || []
                  const selectedNf = nfMap[tx.id] || []
                  const highlight = isPartner && tx.status === 'DIVERGENCIA'

                  return (
                    <tr key={tx.id} className={`transition-colors hover:bg-muted/30 ${highlight ? 'bg-destructive/5' : ''}`}>
                      {isAdmin && (
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={!!selectedMap[tx.id]}
                            disabled={tx.status === 'FINALIZADO'}
                            onChange={() => toggleRow(tx.id)}
                            className="rounded border-input text-primary focus:ring-primary"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4">{formatDate(tx)}</td>
                      {isAdmin && <td className="px-6 py-4 font-medium">{tx.parceiro_nome || tx.parceiro_id}</td>}
                      <td className="px-6 py-4">{tx.nome_cliente || '-'}</td>
                      <td className="px-6 py-4 font-medium">{formatCurrency(tx.valor_liberado)}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={tx.status} />
                          {isPartner && tx.status === 'DIVERGENCIA' && (
                            <span className="text-[10px] text-destructive max-w-[120px] whitespace-normal">NF recusada. Envie nova nota.</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle text-center">
                        <FileCell tx={tx} type="NF" />
                      </td>
                      <td className="px-6 py-4 align-middle text-center">
                        <FileCell tx={tx} type="COMPROVANTE" />
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-center">
                          <div className="relative inline-block">
                            <button
                              onClick={() => setNotifyModal(tx)}
                              className="p-1.5 rounded-md hover:bg-primary/10 transition-colors text-muted-foreground hover:text-primary"
                              title="Notificar Parceiro"
                            >
                              <Mail className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setStatusMenuOpen(statusMenuOpen === tx.id ? null : tx.id)}
                              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal className="w-5 h-5" />
                            </button>
                            {statusMenuOpen === tx.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setStatusMenuOpen(null)} />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                                  {STATUS_OPTIONS.map((opt) => (
                                    <button
                                      key={opt.value}
                                      onClick={() => handleChangeStatus(tx, opt.value)}
                                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                                        tx.status === opt.value
                                          ? 'bg-primary/10 text-primary font-semibold'
                                          : 'text-foreground hover:bg-muted'
                                      }`}
                                    >
                                      {tx.status === opt.value ? (
                                        <Check className="w-4 h-4 text-primary" />
                                      ) : (
                                        <span className="w-4" />
                                      )}
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {renderEmptyRows()}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 6} className="h-[365px] text-center text-muted-foreground align-middle">Nenhum repasse encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredRows.length > 0 && (
            <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between bg-muted/5">
              <p className="text-xs text-muted-foreground">
                Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredRows.length)}</span> de <span className="font-medium">{filteredRows.length}</span> registros
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-1.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1 overflow-x-auto max-w-[150px] sm:max-w-none no-scrollbar">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`min-w-[32px] h-8 rounded-md text-xs font-medium transition-colors ${
                        currentPage === i + 1 
                        ? 'bg-primary text-white shadow-sm' 
                        : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-1.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {newRepasseOpen && isAdmin && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form onSubmit={handleCreateRepasse} className="bg-card w-full max-w-lg rounded-xl border border-border shadow-lg p-6 relative">
            <button type="button" onClick={() => setNewRepasseOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-foreground mb-6">Novo Repasse</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Parceiro</label>
                <select
                  value={newRepasseData.userId}
                  onChange={e => setNewRepasseData({...newRepasseData, userId: e.target.value})}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione...</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.cnpj_cpf})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Data do Repasse</label>
                <input
                  type="date"
                  value={newRepasseData.dateStr}
                  onChange={e => setNewRepasseData({...newRepasseData, dateStr: e.target.value})}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {newRepasseData.dateStr && (
                  <p className="mt-1.5 text-xs font-medium text-accent-foreground">Período Selecionado: {newRepasseData.dateStr.split('-').reverse().join('/')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nome do Cliente</label>
                <input
                  type="text"
                  value={newRepasseData.nomeCliente}
                  onChange={e => setNewRepasseData({...newRepasseData, nomeCliente: e.target.value})}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Ex: João da Silva"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Valor Liberado</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newRepasseData.valorLiberado ? (Number(newRepasseData.valorLiberado.replace(/\D/g, ''))/100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}
                  onChange={e => setNewRepasseData({...newRepasseData, valorLiberado: e.target.value})}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="R$ 0,00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Comprovantes (até 5)</label>
                <input
                  type="file"
                  multiple
                  onChange={e => setNewRepasseData({...newRepasseData, files: Array.from(e.target.files || [])})}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-muted file:text-foreground hover:file:bg-muted/80 transition-colors"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setNewRepasseOpen(false)}
                className="px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Repasse'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal Additions */}
      {editing && isAdmin && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form onSubmit={handleSave} className="bg-card rounded-xl border border-border shadow-lg p-6 w-full max-w-xl relative">
            <button type="button" onClick={closeEdit} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <h4 className="text-xl font-bold text-foreground mb-6">Editar Repasse #{editing.id}</h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Data</label>
                <input
                  type="date"
                  value={dataRef}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nome do Cliente</label>
                <input
                  type="text"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Valor Liberado</label>
                <input
                  type="number"
                  step="0.01"
                  value={valorLiberado}
                  onChange={(e) => setValorLiberado(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Comprovantes Extra (Max 5 total)</label>
                <div className="text-xs text-muted-foreground mb-2">Comprovantes atuais: {existingCount}/5. Permite mais {remainingSlots}.</div>
                <input
                  type="file"
                  multiple
                  onChange={handleFilesChange}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-muted file:text-foreground hover:file:bg-muted/80 transition-colors"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={closeEdit} className="px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors font-medium text-sm">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || files.length > remainingSlots}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}


      {/* File Modal */}
      {fileModal && (() => {
        const modalTx = rows.find(r => r.id === fileModal.tx.id) || fileModal.tx
        const isComp = fileModal.type === 'COMPROVANTE'
        const modalFiles = isComp ? modalTx.comprovantes : modalTx.notas_fiscais
        const modalCount = modalFiles?.length || 0
        const modalRemaining = Math.max(0, 5 - modalCount)
        const canUploadModal = isComp
          ? (isAdmin && modalTx.status !== 'FINALIZADO' && modalRemaining > 0)
          : (isPartner && canUploadNF(modalTx) && modalTx.status !== 'FINALIZADO')

        return (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={closeFileModal}>
            <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-lg p-6 relative" onClick={e => e.stopPropagation()}>
              <button type="button" onClick={closeFileModal} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                {isComp ? <ImageIcon className="w-5 h-5 text-emerald-600" /> : <FileText className="w-5 h-5 text-blue-600" />}
                {isComp ? 'Comprovantes' : 'Notas Fiscais'}
              </h2>
              <p className="text-xs text-muted-foreground mb-5">
                Repasse #{modalTx.id} — {modalTx.nome_cliente || 'Sem cliente'}
              </p>

              {/* Upload Section */}
              {canUploadModal && (
                <div className="mb-5 p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <UploadCloud className="w-4 h-4" />
                    Upload {isComp ? 'Comprovante' : 'Nota Fiscal'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {modalCount}/5 enviado(s) — Pode enviar mais {modalRemaining}
                  </p>
                  <input
                    type="file"
                    multiple
                    accept={isComp ? undefined : "application/pdf,.pdf"}
                    onChange={(e) => isComp ? selectExtraComprovantes(modalTx.id, e, modalCount) : selectNfFiles(modalTx.id, e)}
                    className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 bg-background border border-input rounded-md p-2 transition-colors"
                  />
                  <button
                    onClick={async () => {
                      if (isComp) await uploadExtraComprovantes(modalTx)
                      else await submitNf(modalTx)
                    }}
                    disabled={isComp
                      ? (!extraComprovantesMap[modalTx.id] || extraComprovantesMap[modalTx.id]?.length === 0 || extraComprovantesMap[modalTx.id]?.length > modalRemaining)
                      : (!nfMap[modalTx.id] || nfMap[modalTx.id]?.length === 0 || nfMap[modalTx.id]?.length > 5)
                    }
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    <UploadCloud className="w-4 h-4" /> Enviar
                  </button>
                </div>
              )}

              {/* Files List */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground mb-2">Arquivos</p>
                {modalTx.status === 'FINALIZADO' ? (
                  isAdmin && modalTx.zip_contabilidade_url ? (
                    isComp ? (
                      <button
                        onClick={() => handleDownload(modalTx.zip_contabilidade_url)}
                        className="w-full flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
                      >
                        <Download className="w-4 h-4" /> Download ZIP Contábil
                      </button>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center italic py-3">Disponível no ZIP (Coluna Comprovante)</p>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground text-center italic py-3">Não disponível</p>
                  )
                ) : modalCount > 0 ? (
                  <div className="divide-y divide-border/50 border border-border rounded-lg overflow-hidden">
                    {modalFiles.map((path, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                        <button
                          onClick={() => handleDownload(path)}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <Download className="w-4 h-4" />
                          {isComp ? 'Comprovante' : 'Nota Fiscal'} {idx + 1}
                        </button>
                        {isAdmin && modalTx.status !== 'FINALIZADO' && (
                          <button
                            onClick={() => handleRemoveFile(modalTx, fileModal.type, path)}
                            className="text-red-500 hover:text-red-600 p-1.5 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center italic py-3">Nenhum arquivo enviado</p>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={closeFileModal}
                  className="px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors font-medium text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Notify Modal */}
      {notifyModal && (() => {
        const config = NOTIFY_CONFIG[notifyModal.status] || NOTIFY_CONFIG['DEFAULT']
        return (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setNotifyModal(null)}>
            <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-lg p-8 relative overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Decoration */}
              <div className={`absolute -top-12 -right-12 w-32 h-32 bg-${config.color}-500/10 rounded-full blur-3xl`} />
              
              <button type="button" onClick={() => setNotifyModal(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className={`mb-6 p-4 rounded-2xl bg-${config.color}-500/10 border border-${config.color}-500/20`}>
                  {config.icon}
                </div>
                
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {config.title}
                </h3>
                
                <p className="text-xs font-medium text-muted-foreground mb-6 uppercase tracking-widest">
                  Transação #{notifyModal.id}
                </p>

                <div className="w-full bg-muted/30 rounded-xl p-5 border border-border text-left mb-8">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block">Prévia da Mensagem:</span>
                  <div className="text-sm text-foreground leading-relaxed italic whitespace-pre-wrap">
                    <p className="mb-4 font-semibold">"{config.suggestion}"</p>
                    <div className="text-[11px] text-muted-foreground space-y-1 pt-3 border-t border-border/50">
                      <p>--- DETALHES ---</p>
                      <p>ID: #{notifyModal.id}</p>
                      <p>Data: {formatDate(notifyModal)}</p>
                      <p>Parceiro: {notifyModal.parceiro_nome || 'N/A'}</p>
                      <p>Cliente: {notifyModal.nome_cliente || 'N/A'}</p>
                      <p>Valor: {formatCurrency(notifyModal.valor_liberado)}</p>
                      <p>Status: {notifyModal.status}</p>
                    </div>
                  </div>
                </div>

                <a
                  href={generateMailtoLink(notifyModal.parceiro_email || '', notifyModal.status, notifyModal.id, notifyModal)}
                  onClick={() => setNotifyModal(null)}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-white font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg ${
                    config.color === 'emerald' ? 'bg-emerald-600 shadow-emerald-500/20' : 
                    config.color === 'red' ? 'bg-red-600 shadow-red-500/20' : 
                    config.color === 'blue' ? 'bg-primary shadow-primary/20' : 
                    config.color === 'amber' ? 'bg-amber-600 shadow-amber-500/20' : 
                    'bg-purple-600 shadow-purple-500/20'
                  }`}
                >
                  <Mail className="w-5 h-5" /> {config.buttonText}
                </a>
                
                <p className="mt-4 text-[10px] text-muted-foreground">
                  O link abrirá seu cliente de e-mail padrão.
                </p>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
export default RepasseList
