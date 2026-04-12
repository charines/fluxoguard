import React, { useEffect, useMemo, useState, useRef } from 'react'
import CryptoJS from 'crypto-js'

const MAGIC_SECRET = import.meta.env.VITE_MAGIC_LINK_SECRET || 'fluxoguard_secure_key_2026'
import { Search, Calendar, Plus, X, UploadCloud, CheckCircle, CheckCircle2, AlertTriangle, Clock, AlertCircle, Lock, Image as ImageIcon, FileText, Download, Trash2, MoreHorizontal, Check, Bell, Mail, ChevronLeft, ChevronRight, ChevronDown, ExternalLink, ShieldCheck, Copy, Building2 } from 'lucide-react'
import {
  createRepasse,
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
import TransactionWizard from './TransactionWizard'

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

const formatItemDate = (value) => {
  if (!value) return '-'
  const parts = String(value).split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return value
}

const getPaymentMonthYearUpper = (tx) => {
  const months = [
    'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ]
  const monthIdx = Number(tx?.mes) - 1
  const year = tx?.ano
  if (monthIdx >= 0 && monthIdx < 12 && year) return `${months[monthIdx]}/${year}`
  return 'MES/ANO'
}

const canUploadNF = (tx) => ['LIBERADO', 'AGUARDANDO_NF', 'DIVERGENCIA', 'AGUARDANDO_APROVACAO'].includes(tx.status)
const sanitizeNfNumber = (value) => String(value || '').replace(/\D/g, '')
const isNfNumberValid = (value) => /^\d+$/.test(String(value || '').trim())

const RepasseList = ({ onStatsChange }) => {
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
  const [nfNumberMap, setNfNumberMap] = useState({})

  const [selectedMap, setSelectedMap] = useState({})
  const [processingBatch, setProcessingBatch] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(null) // tx.id or null
  const [notifyModal, setNotifyModal] = useState(null) // tx or null
  const [emailPreview, setEmailPreview] = useState(null) // { to, subject, body, magicLink } or null
  const STATUS_FILTER_OPTIONS = [
    { value: 'AGUARDANDO_NF', label: 'Aguardando NF', color: 'blue', icon: <Clock className="w-3.5 h-3.5" /> },
    { value: 'AGUARDANDO_APROVACAO', label: 'Aprovação', color: 'amber', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { value: 'PAGO', label: 'Pago', color: 'emerald', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { value: 'FINALIZADO', label: 'Finalizado', color: 'slate', icon: <Lock className="w-3.5 h-3.5" /> },
    { value: 'DIVERGENCIA', label: 'Divergência', color: 'red', icon: <AlertCircle className="w-4 h-4" /> },
  ]

  const [activeStatuses, setActiveStatuses] = useState(() => {
    const saved = localStorage.getItem('fluxoguard_active_statuses')
    try {
      return saved ? JSON.parse(saved) : STATUS_FILTER_OPTIONS.map(s => s.value)
    } catch {
      return STATUS_FILTER_OPTIONS.map(s => s.value)
    }
  })

  useEffect(() => {
    localStorage.setItem('fluxoguard_active_statuses', JSON.stringify(activeStatuses))
  }, [activeStatuses])

  const toggleStatusFilter = (status) => {
    setActiveStatuses(prev => {
      if (prev.includes(status)) {
        if (prev.length === 1) return prev
        return prev.filter(s => s !== status)
      }
      return [...prev, status]
    })
  }

  const itemsPerPage = 5
  const [currentPage, setCurrentPage] = useState(1)

  const stats = useMemo(() => {
    const s = { total: 0, aguardando: 0, aprovacao: 0, divergencia: 0, pago: 0, finalizado: 0 }
    rows.forEach(tx => {
      s.total += Number(tx.valor_liberado || 0)
      if (tx.status === 'AGUARDANDO_NF') s.aguardando++
      else if (tx.status === 'AGUARDANDO_APROVACAO' || tx.status === 'CONFERENCIA') s.aprovacao++
      else if (tx.status === 'DIVERGENCIA') s.divergencia++
      else if (tx.status === 'PAGO' || tx.status === 'LIBERADO') s.pago++
      else if (tx.status === 'FINALIZADO') s.finalizado++
    })
    return s
  }, [rows])

  useEffect(() => {
    if (onStatsChange) onStatsChange(stats)
  }, [stats, onStatsChange])

  const getTxItems = (tx) => {
    if (Array.isArray(tx?.items) && tx.items.length > 0) return tx.items
    return [{ nome_cliente: tx?.nome_cliente || '-', valor: Number(tx?.valor_liberado || 0), data_emissao: null }]
  }

  const getTxTotal = (tx) => {
    const totalFromItems = getTxItems(tx).reduce((acc, item) => acc + Number(item?.valor || 0), 0)
    if (totalFromItems > 0) return totalFromItems
    return Number(tx?.valor_liberado || 0)
  }

  const generateMailtoLink = (parceiroEmail, status, transacaoId, tx) => {
    const config = NOTIFY_CONFIG[status] || NOTIFY_CONFIG['DEFAULT']
    const partnerNameUpper = (tx?.parceiro_nome || 'DESTINATARIO').toUpperCase()
    const paymentMonthYear = getPaymentMonthYearUpper(tx)
    const subjectText = `FECHAMENTO | PAGAMENTO ${paymentMonthYear} | ${partnerNameUpper}`.toUpperCase()
    const subject = encodeURIComponent(subjectText)

    const dataStr = formatDate(tx);
    const totalValor = getTxTotal(tx)
    const valorStr = formatCurrency(totalValor);
    const txItems = getTxItems(tx)
    const itemsList = txItems
      .map((item, idx) => `- ${item?.nome_cliente || `Cliente ${idx + 1}`}: ${formatCurrency(item?.valor || 0)} | Emissão: ${formatItemDate(item?.data_emissao)}`)
      .join('\n')

    // MAGIC LINK LOGIC
    const payload = JSON.stringify({
      id: transacaoId,
      email: parceiroEmail,
      extExp: Date.now() + 24 * 60 * 60 * 1000 // 24h
    })
    // Encrypt the payload and encode once
    const encrypted = CryptoJS.AES.encrypt(payload, MAGIC_SECRET).toString()
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
    const magicLink = `${appUrl}/#/secure-share?token=${encodeURIComponent(encrypted)}`

    let bodyText = `${config.suggestion}\n\n`
    bodyText += `--- CLIENTES E VALORES ---\n`
    bodyText += `${itemsList}\n`
    bodyText += `Total: ${valorStr}\n\n`
    bodyText += `--- DETALHES DA TRANSAÇÃO ---\n`
    bodyText += `ID: #${transacaoId}\n`
    bodyText += `Data de Pagamento: ${dataStr}\n`
    bodyText += `Destinatário: ${tx.parceiro_nome || 'N/A'}\n`
    bodyText += `Status Atual: ${status}\n\n`
    bodyText += `Acesse os detalhes e envie os documentos por este link: ${magicLink}`

    return {
      to: parceiroEmail,
      subject: subjectText,
      body: bodyText,
      magicLink: magicLink,
      mailto: `mailto:${parceiroEmail}?subject=${subject}&body=${encodeURIComponent(bodyText)}`
    }
  }

  const NOTIFY_CONFIG = {
    'LIBERADO': {
      title: 'Enviar Lembrete de NF',
      icon: <Clock className="w-8 h-8 text-blue-500" />,
      subject: 'Solicitação de Nota Fiscal',
      suggestion: 'Olá, este é um lembrete para envio da Nota Fiscal referente à transação.',
      buttonText: 'Abrir E-mail do Lembrete',
      color: 'blue'
    },
    'AGUARDANDO_NF': {
      title: 'Enviar Lembrete de NF',
      icon: <Clock className="w-8 h-8 text-blue-500" />,
      subject: 'Solicitação de Nota Fiscal',
      suggestion: 'Olá, este é um lembrete para envio da Nota Fiscal referente à transação.',
      buttonText: 'Abrir E-mail do Lembrete',
      color: 'blue'
    },
    'AGUARDANDO_APROVACAO': {
      title: 'Notificar Análise Financeira',
      icon: <Clock className="w-8 h-8 text-amber-500" />,
      subject: 'Transação em Análise',
      suggestion: 'Olá, informamos que a transação está em análise. Em breve retornaremos com a próxima atualização.',
      buttonText: 'Enviar Aviso de Análise',
      color: 'amber'
    },
    'DIVERGENCIA': {
      title: 'Notificar Divergência',
      icon: <AlertCircle className="w-8 h-8 text-red-500" />,
      subject: 'Ajuste Necessário na Documentação',
      suggestion: 'Olá, identificamos divergência na documentação enviada. Por favor, revise e faça o reenvio.',
      buttonText: 'Avisar sobre Divergência',
      color: 'red'
    },
    'PAGO': {
      title: 'Enviar Recibo de Quitação',
      icon: <FileText className="w-8 h-8 text-purple-500" />,
      subject: 'Pagamento Confirmado',
      suggestion: 'Olá, informamos que o pagamento foi concluído. Seguem os dados para seu controle.',
      buttonText: 'Enviar Recibo Final',
      color: 'purple'
    },
    'FINALIZADO': {
      title: 'Repasse Finalizado',
      icon: <Lock className="w-8 h-8 text-slate-600" />,
      subject: 'Processo Finalizado',
      suggestion: 'Olá, informamos que o processo desta transação foi finalizado. Se precisar de alguma cópia, responda este e-mail.',
      buttonText: 'Avisar Finalização',
      color: 'slate'
    },
    'DEFAULT': {
      title: 'Notificar Destinatário',
      icon: <Bell className="w-8 h-8 text-slate-500" />,
      subject: 'Atualização de Transação',
      suggestion: 'Olá, gostaria de compartilhar uma atualização sobre a transação.',
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
    const valFloat = (Number(valString) / 100).toFixed(2)
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

  const StatusBadge = ({ status, minimal = false }) => {
    if (minimal) {
      switch (status) {
        case 'PAGO':
        case 'LIBERADO':
          return <span className="flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 uppercase tracking-tight"><CheckCircle2 className="w-3 h-3" /> Pago</span>
        case 'AGUARDANDO_NF':
          return <span className="flex items-center gap-1 text-[10px] font-black text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 uppercase tracking-tight"><FileText className="w-3 h-3" /> Aguardando NF</span>
        case 'AGUARDANDO_APROVACAO':
        case 'CONFERENCIA':
          return <span className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 uppercase tracking-tight"><AlertTriangle className="w-3 h-3" /> Aprovação</span>
        case 'DIVERGENCIA':
          return <span className="flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-50 px-2 py-1 rounded-lg border border-red-200 uppercase tracking-tight"><AlertCircle className="w-3 h-3" /> Divergência</span>
        case 'FINALIZADO':
          return <span className="flex items-center gap-1 text-[10px] font-black text-white bg-slate-900 px-2 py-1 rounded-lg uppercase tracking-tight shadow-sm"><Lock className="w-3 h-3" /> Finalizado</span>
        default:
          return <span className="flex items-center gap-1 text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 uppercase tracking-tight">{status}</span>
      }
    }
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
    const matchStatus = activeStatuses.includes(tx.status) ||
      (tx.status === 'LIBERADO' && activeStatuses.includes('PAGO')) ||
      (tx.status === 'CONFERENCIA' && activeStatuses.includes('AGUARDANDO_APROVACAO'))
    if (!matchStatus) return false

    const search = searchTerm.toLowerCase()
    const matchByMainClient = tx.nome_cliente?.toLowerCase().includes(search)
    const matchByPartner = tx.parceiro_nome?.toLowerCase().includes(search)
    const matchByItems = getTxItems(tx).some((item) => (item?.nome_cliente || '').toLowerCase().includes(search))
    const matchSearch = matchByMainClient || matchByPartner || matchByItems
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
    const notaNumero = (nfNumberMap[tx.id] || '').trim()
    if (filesToSend.length === 0) {
      alert('Selecione ao menos 1 arquivo de NF.')
      return
    }
    if (!notaNumero) {
      alert('Informe o número da nota fiscal.')
      return
    }
    if (!isNfNumberValid(notaNumero)) {
      alert('O número da nota fiscal deve conter apenas números.')
      return
    }
    if (filesToSend.length > 5) {
      alert('Máximo de 5 notas fiscais.')
      return
    }

    try {
      const updated = await uploadNotasFiscais(tx.id, filesToSend, notaNumero)
      setRows((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setNfMap((prev) => ({ ...prev, [tx.id]: [] }))
      setNfNumberMap((prev) => ({ ...prev, [tx.id]: '' }))
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
    const label = type === 'NF' ? 'NF' : 'COMP'
    const canClick = tx.status === 'FINALIZADO'
      ? (isAdmin && isComp && tx.zip_contabilidade_url)
      : (count > 0 || (isComp ? (isAdmin && tx.status !== 'FINALIZADO') : canUploadNF(tx)))

    return (
      <div
        className={`flex items-center justify-center gap-1.5 py-1 ${canClick ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''}`}
        onClick={() => canClick && openFileModal(tx, type)}
      >
        {tx.status === 'FINALIZADO' ? (
          isAdmin && isComp && tx.zip_contabilidade_url ? (
            <div className="flex items-center gap-1.5 text-blue-600 font-bold text-[10px] uppercase bg-blue-50 px-2 py-1 rounded-md border border-blue-200 whitespace-nowrap">
              <Download className="w-3.5 h-3.5 flex-shrink-0" /> ZIP
            </div>
          ) : (
            <span className="text-muted-foreground font-bold text-[10px]">—</span>
          )
        ) : count === 0 ? (
          canClick ? (
            <div className="flex items-center gap-1 text-slate-400 hover:text-primary transition-colors font-bold text-[10px] uppercase whitespace-nowrap">
              <UploadCloud className="w-4 h-4 flex-shrink-0" /> Enviar {label}
            </div>
          ) : (
            <span className="text-muted-foreground font-bold text-[10px]">—</span>
          )
        ) : (
          <div className={`flex items-center gap-1 font-bold text-[10px] uppercase whitespace-nowrap ${isComp ? 'text-emerald-600' : 'text-blue-600'}`}>
            <Download className="w-4 h-4 flex-shrink-0" />
            <span>BAIXAR {label} ({count})</span>
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
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-xl mt-6">
        <div className="p-6 border-b border-border bg-white space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 flex-shrink-0">
              <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Histórico de Repasses</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atividade Recente</p>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={submitBatchFinalize}
                  disabled={selectedIds.length === 0 || processingBatch}
                  className="h-9 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 disabled:opacity-50 transition-all font-black text-[10px] uppercase tracking-widest"
                >
                  Gerar ZIP
                </button>
                <button
                  onClick={() => setNewRepasseOpen(true)}
                  className="h-9 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Novo
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por parceiro ou cliente..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring h-9"
              />

              <div className="flex items-center gap-1.5 sm:border-l sm:border-slate-100 sm:pl-4">
                {STATUS_FILTER_OPTIONS.map(opt => {
                  const isActive = activeStatuses.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleStatusFilter(opt.value)}
                      title={opt.label}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm active:scale-95 ${isActive
                        ? opt.color === 'slate' ? 'bg-slate-900 border-slate-900 text-white' :
                          opt.color === 'blue' ? 'bg-blue-600 border-blue-600 text-white' :
                            opt.color === 'amber' ? 'bg-amber-500 border-amber-500 text-white' :
                              opt.color === 'emerald' ? 'bg-emerald-600 border-emerald-600 text-white' :
                                'bg-red-600 border-red-600 text-white'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}
                    >
                      {opt.icon}
                      <span className="hidden lg:inline">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-muted-foreground">Carregando repasses...</div>
        ) : error ? (
          <div className="p-10 text-center text-destructive">{error}</div>
        ) : (
          <>
            {/* Desktop View: Table (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto">
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
                    const highlight = isPartner && tx.status === 'DIVERGENCIA'
                    const txItems = getTxItems(tx)
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
                        <td className="px-6 py-4 whitespace-normal">
                          <div className="min-w-[260px] max-w-[380px] overflow-hidden rounded-xl border border-slate-200">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-3 py-2 text-left font-black uppercase tracking-wide text-slate-500">Cliente</th>
                                  <th className="px-3 py-2 text-left font-black uppercase tracking-wide text-slate-500">Emissão</th>
                                  <th className="px-3 py-2 text-right font-black uppercase tracking-wide text-slate-500">Valor</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {txItems.map((item, idx) => (
                                  <tr key={`${tx.id}-item-${idx}`}>
                                    <td className="px-3 py-2 text-slate-700">{item?.nome_cliente || '-'}</td>
                                    <td className="px-3 py-2 text-slate-600">{formatItemDate(item?.data_emissao)}</td>
                                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(item?.valor || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
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
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${tx.status === opt.value
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



            {/* Mobile Cards List (Full Width) */}
            <div className="md:hidden space-y-4 py-4 bg-transparent">
              {paginatedRows.map((tx) => {
                const txItems = getTxItems(tx)
                return (
                <div key={tx.id} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm space-y-4 relative overflow-hidden active:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <h5 className="font-black text-slate-800 text-[15px] leading-tight truncate">{txItems[0]?.nome_cliente || tx.nome_cliente || 'N/A'}</h5>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mt-1">
                        <span>{formatDate(tx)}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                        <span>Ref: #{tx.id}</span>
                      </div>
                      {isAdmin && (
                        <p className="text-[10px] font-black text-indigo-600 mt-1.5 flex items-center gap-1 uppercase">
                          <ShieldCheck className="w-3 h-3" /> {tx.parceiro_nome}
                        </p>
                      )}

                      {/* Dynamic File Links / ZIP */}
                      <div className="flex items-center gap-4 mt-2">
                        {tx.status === 'FINALIZADO' && tx.zip_contabilidade_url && isAdmin ? (
                          <FileCell tx={tx} type="COMPROVANTE" />
                        ) : (
                          <>
                            <FileCell tx={tx} type="NF" />
                            <div className="w-px h-2.5 bg-slate-100"></div>
                            <FileCell tx={tx} type="COMPROVANTE" />
                          </>
                        )}
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-[11px]">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-black uppercase tracking-wide text-slate-500">Cliente</th>
                              <th className="px-3 py-2 text-left font-black uppercase tracking-wide text-slate-500">Emissão</th>
                              <th className="px-3 py-2 text-right font-black uppercase tracking-wide text-slate-500">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {txItems.map((item, idx) => (
                              <tr key={`${tx.id}-mobile-item-${idx}`}>
                                <td className="px-3 py-2 text-slate-700">{item?.nome_cliente || '-'}</td>
                                <td className="px-3 py-2 text-slate-600">{formatItemDate(item?.data_emissao)}</td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(item?.valor || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-[15px] font-black text-slate-900 tracking-tighter">{formatCurrency(tx.valor_liberado)}</span>
                      <StatusBadge status={tx.status} minimal={true} />
                    </div>
                  </div>


                  {isAdmin && (
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
                      <div className="flex gap-2">
                        <button onClick={() => setNotifyModal(tx)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-600 active:bg-blue-100 transition-colors">
                          <Mail className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-tight">Notificar</span>
                        </button>
                        <input
                          type="checkbox"
                          checked={!!selectedMap[tx.id]}
                          disabled={tx.status === 'FINALIZADO'}
                          onChange={() => toggleRow(tx.id)}
                          className="rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 w-8 h-8 shadow-sm flex-shrink-0 cursor-pointer"
                        />
                      </div>
                      <button
                        onClick={() => setStatusMenuOpen(statusMenuOpen === tx.id ? null : tx.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md active:scale-95"
                      >
                        Alterar Status <ChevronDown className={`w-3.5 h-3.5 transition-transform ${statusMenuOpen === tx.id ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  )}

                  {/* Status Menu Overlay */}
                  {statusMenuOpen === tx.id && isAdmin && (
                    <div className="animate-in slide-in-from-top-2 duration-200 pt-2">
                      <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl grid grid-cols-1 divide-y divide-slate-800 border border-slate-800">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleChangeStatus(tx, opt.value)}
                            className={`w-full flex items-center justify-between px-5 py-3.5 text-xs font-bold transition-all ${tx.status === opt.value ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white active:bg-slate-800'
                              }`}
                          >
                            {opt.label}
                            {tx.status === opt.value && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )})}

              {filteredRows.length === 0 && (
                <div className="p-10 text-center text-slate-400 font-bold italic text-sm bg-white rounded-3xl border border-dashed border-slate-200">
                  Nenhum repasse encontrado.
                </div>
              )}
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
                        className={`min-w-[32px] h-8 rounded-md text-xs font-medium transition-colors ${currentPage === i + 1
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
        <TransactionWizard 
          onClose={() => setNewRepasseOpen(false)}
          onSuccess={(payload) => {
            loadRows();
            if (payload?.partnerName) {
              setSearchTerm(payload.partnerName);
              setCurrentPage(1);
            }
            setNewRepasseOpen(false);
          }}
        />
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
          : (canUploadNF(modalTx) && modalTx.status !== 'FINALIZADO')

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
              <div className="mb-5 rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">
                  Data de Pagamento: <span className="font-semibold text-foreground">{formatDate(modalTx)}</span>
                </p>
                <div className="text-xs text-muted-foreground">
                  <p className="mb-1">Datas de Emissão:</p>
                  {getTxItems(modalTx).map((item, idx) => (
                    <p key={`${modalTx.id}-nf-data-${idx}`}>
                      - {item?.nome_cliente || `Cliente ${idx + 1}`}: {formatItemDate(item?.data_emissao)}
                    </p>
                  ))}
                </div>
              </div>

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
                  {!isComp && (
                    <input
                      type="text"
                      value={nfNumberMap[modalTx.id] || ''}
                      onChange={(e) => setNfNumberMap((prev) => ({ ...prev, [modalTx.id]: sanitizeNfNumber(e.target.value) }))}
                      onKeyDown={(e) => {
                        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
                        if (allowed.includes(e.key) || (e.ctrlKey || e.metaKey)) return
                        if (!/^\d$/.test(e.key)) e.preventDefault()
                      }}
                      onPaste={(e) => {
                        e.preventDefault()
                        const pasted = e.clipboardData?.getData('text') || ''
                        setNfNumberMap((prev) => ({ ...prev, [modalTx.id]: sanitizeNfNumber(pasted) }))
                      }}
                      placeholder="Número da nota fiscal (obrigatório)"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  )}
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
                      : (
                        !nfMap[modalTx.id] ||
                        nfMap[modalTx.id]?.length === 0 ||
                        nfMap[modalTx.id]?.length > 5 ||
                        !(nfNumberMap[modalTx.id] || '').trim()
                      )
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
        const emailData = generateMailtoLink(notifyModal.parceiro_email || '', notifyModal.status, notifyModal.id, notifyModal)
        return (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 overflow-y-auto" onClick={() => setNotifyModal(null)}>
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 sm:p-8 relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
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
                        <p>Data de Pagamento: {formatDate(notifyModal)}</p>
                        <p>Destinatário: {notifyModal.parceiro_nome || 'N/A'}</p>
                        <p>Clientes e valores:</p>
                        <div className="pl-3 space-y-0.5">
                          {getTxItems(notifyModal).map((item, idx) => (
                            <p key={`${notifyModal.id}-preview-item-${idx}`}>
                              - {item?.nome_cliente || `Cliente ${idx + 1}`}: {formatCurrency(item?.valor || 0)} | Emissão: {formatItemDate(item?.data_emissao)}
                            </p>
                          ))}
                        </div>
                        <p>Total: {formatCurrency(getTxTotal(notifyModal))}</p>
                        <p>Status: {notifyModal.status}</p>
                      </div>
                    </div>
                  </div>

                  <a
                    href={emailData.mailto}
                    onClick={() => setNotifyModal(null)}
                    className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-white font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg ${config.color === 'emerald' ? 'bg-emerald-600 shadow-emerald-500/20' :
                      config.color === 'red' ? 'bg-red-600 shadow-red-500/20' :
                        config.color === 'blue' ? 'bg-primary shadow-primary/20' :
                          config.color === 'amber' ? 'bg-amber-600 shadow-amber-500/20' :
                            'bg-purple-600 shadow-purple-500/20'
                      }`}
                  >
                    <Mail className="w-5 h-5" /> {config.buttonText}
                  </a>

                  <a
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailData.to || '')}&su=${encodeURIComponent(emailData.subject || '')}&body=${encodeURIComponent(emailData.body || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-sm transition-all"
                  >
                    <Mail className="w-4 h-4" /> Abrir Lembrete no Gmail
                  </a>

                  <button
                    onClick={() => {
                      setEmailPreview(emailData);
                    }}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border bg-background text-foreground hover:bg-muted font-bold text-sm transition-all"
                  >
                    <Search className="w-4 h-4" /> Visualizar Detalhes Técnicos (Link)
                  </button>

                  <p className="mt-4 text-[10px] text-muted-foreground">
                    O link abrirá seu cliente de e-mail padrão.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Email Preview Modal (Technical) */}
      {emailPreview && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-[60] overflow-y-auto" onClick={() => setEmailPreview(null)}>
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl p-6 sm:p-8 relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <button type="button" onClick={() => setEmailPreview(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-emerald-500" />
                Detalhes Técnicos do E-mail
              </h3>

              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-muted/30 p-4 rounded-xl border border-border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Destinatário (To):</span>
                    <p className="text-sm font-mono text-foreground break-all">{emailPreview.to}</p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-xl border border-border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Assunto (Subject):</span>
                    <p className="text-sm font-mono text-foreground break-all">{emailPreview.subject}</p>
                  </div>
                </div>

                <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Magic Link Gerado (Clique para Copiar)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(emailPreview.magicLink);
                      alert("Link copiado para a área de transferência!");
                    }}
                    className="w-full text-left text-sm font-mono text-emerald-700 break-all bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all group flex items-start gap-3"
                  >
                    <Copy className="w-5 h-5 mt-0.5 text-emerald-600 shrink-0 opacity-50 group-hover:opacity-100" />
                    <span>{emailPreview.magicLink}</span>
                  </button>
                  <div className="flex gap-4 mt-3">
                    <a href={emailPreview.magicLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 underline underline-offset-4">
                      <ExternalLink className="w-3 h-3" /> Visualizar
                    </a>
                    <a
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailPreview.to || '')}&su=${encodeURIComponent(emailPreview.subject || '')}&body=${encodeURIComponent(emailPreview.body || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 underline underline-offset-4"
                    >
                      <Mail className="w-3 h-3" /> Abrir no Gmail
                    </a>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-xl border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Corpo do E-mail (Body Text):</span>
                  <div className="mt-2 text-sm font-mono text-foreground whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto bg-background/50 p-4 rounded-lg border border-border/50">
                    {emailPreview.body}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setEmailPreview(null)}
                  className="px-8 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all shadow-lg"
                >
                  FECHAR VISUALIZAÇÃO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
export default RepasseList
