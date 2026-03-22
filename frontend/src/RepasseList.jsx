import React, { useEffect, useMemo, useState } from 'react'
import {
  approvePaymentBatch,
  downloadFile,
  finalizeTransactionsBatch,
  getTransactions,
  rejectTransaction,
  removeTransactionFile,
  updateRepasse,
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

const canUploadNF = (tx) => ['LIBERADO', 'AGUARDANDO_NF', 'DIVERGENCIA'].includes(tx.status)

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

  const [extraComprovantesMap, setExtraComprovantesMap] = useState({})
  const [nfMap, setNfMap] = useState({})

  const [selectedMap, setSelectedMap] = useState({})
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [approveFiles, setApproveFiles] = useState([])
  const [processingBatch, setProcessingBatch] = useState(false)

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

  const openApproveModal = () => {
    if (selectedIds.length === 0) {
      alert('Selecione ao menos um repasse.')
      return
    }
    setApproveFiles([])
    setApproveModalOpen(true)
  }

  const submitBatchApprove = async () => {
    if (approveFiles.length === 0) {
      alert('Selecione ao menos um comprovante.')
      return
    }
    if (approveFiles.length > 5) {
      alert('Máximo de 5 comprovantes.')
      return
    }

    setProcessingBatch(true)
    try {
      const updatedRows = await approvePaymentBatch(selectedIds, approveFiles)
      setRows((prev) => {
        const map = new Map(updatedRows.map((item) => [item.id, item]))
        return prev.map((item) => map.get(item.id) || item)
      })
      setSelectedMap({})
      setApproveModalOpen(false)
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao aprovar pagamento.')
    } finally {
      setProcessingBatch(false)
    }
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

  const renderFileLinks = (tx, paths, fileType) => {
    if (tx.status === 'FINALIZADO') {
      if (isAdmin && tx.zip_contabilidade_url) {
        return (
          <button
            onClick={() => handleDownload(tx.zip_contabilidade_url)}
            className="text-xs px-2 py-1 rounded bg-blue-700 text-white hover:bg-blue-600"
          >
            Download ZIP
          </button>
        )
      }
      return <span className="text-xs text-gray-500">Disponível apenas via ZIP contábil</span>
    }

    if (!paths || paths.length === 0) {
      return <span className="text-xs text-gray-500">Sem arquivos</span>
    }

    return (
      <div className="flex flex-col gap-2">
        {paths.map((path, idx) => (
          <div key={`${path}-${idx}`} className="flex items-center gap-2">
            <button
              onClick={() => handleDownload(path)}
              className="text-xs px-2 py-1 rounded bg-blue-700 text-white hover:bg-blue-600"
            >
              Download {idx + 1}
            </button>
            {isAdmin && tx.status !== 'PAGO' && tx.status !== 'FINALIZADO' && (
              <button
                onClick={() => handleRemoveFile(tx, fileType, path)}
                className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Remover
              </button>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between gap-4">
        <h3 className="font-semibold text-gray-800">Histórico de Repasses</h3>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={openApproveModal}
              disabled={selectedIds.length === 0 || processingBatch}
              className="text-xs px-3 py-2 rounded bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-60"
            >
              Aprovar Pagamento
            </button>
            <button
              onClick={submitBatchFinalize}
              disabled={selectedIds.length === 0 || processingBatch}
              className="text-xs px-3 py-2 rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
            >
              Finalizar e Gerar ZIP
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-400">Carregando repasses...</div>
      ) : error ? (
        <div className="p-10 text-center text-red-500">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                {isAdmin && (
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={allChecked} onChange={toggleAllRows} />
                  </th>
                )}
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Parceiro</th>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Valor</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Comprovante</th>
                <th className="px-6 py-3">Nota Fiscal</th>
                <th className="px-6 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((tx) => {
                const compCount = tx.comprovantes?.length || 0
                const remainingComp = Math.max(0, 5 - compCount)
                const selectedComp = extraComprovantesMap[tx.id] || []
                const selectedNf = nfMap[tx.id] || []
                const highlight = isPartner && tx.status === 'DIVERGENCIA'

                return (
                  <tr key={tx.id} className={highlight ? 'bg-red-50' : ''}>
                    {isAdmin && (
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={!!selectedMap[tx.id]}
                          disabled={tx.status === 'FINALIZADO'}
                          onChange={() => toggleRow(tx.id)}
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">{formatDate(tx)}</td>
                    <td className="px-6 py-4">{tx.parceiro_nome || tx.parceiro_id}</td>
                    <td className="px-6 py-4">{tx.nome_cliente || '-'}</td>
                    <td className="px-6 py-4">{formatCurrency(tx.valor_liberado)}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{tx.status}</div>
                      {isPartner && tx.status === 'DIVERGENCIA' && (
                        <div className="text-xs text-red-700">NF recusada. Envie uma nova nota fiscal.</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {renderFileLinks(tx, tx.comprovantes, 'COMPROVANTE')}
                      {isAdmin && tx.status !== 'PAGO' && tx.status !== 'FINALIZADO' && remainingComp > 0 && (
                        <div className="mt-2 flex flex-col gap-2">
                          <input
                            type="file"
                            multiple
                            onChange={(e) => selectExtraComprovantes(tx.id, e, compCount)}
                            className="text-xs"
                          />
                          <button
                            onClick={() => uploadExtraComprovantes(tx)}
                            disabled={selectedComp.length === 0 || selectedComp.length > remainingComp}
                            className="text-xs px-2 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-70"
                          >
                            + Subir Comprovante
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {renderFileLinks(tx, tx.notas_fiscais, 'NF')}
                      {isPartner && canUploadNF(tx) && tx.status !== 'FINALIZADO' && (
                        <div className="mt-2 flex flex-col gap-2">
                          <input
                            type="file"
                            multiple
                            accept="application/pdf,.pdf"
                            onChange={(e) => selectNfFiles(tx.id, e)}
                            className="text-xs"
                          />
                          <button
                            onClick={() => submitNf(tx)}
                            disabled={selectedNf.length === 0 || selectedNf.length > 5}
                            className="text-xs px-2 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-70"
                          >
                            Substituir/Enviar NF
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isAdmin ? (
                        <div className="flex items-center justify-end gap-2">
                          {tx.status !== 'FINALIZADO' && (
                            <button
                              onClick={() => openEdit(tx)}
                              className="text-sm px-3 py-1 rounded bg-blue-700 text-white hover:bg-blue-600"
                            >
                              Editar
                            </button>
                          )}
                          {tx.status === 'AGUARDANDO_APROVACAO' && (
                            <button
                              onClick={() => handleReject(tx)}
                              className="text-sm px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                            >
                              Recusar
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="p-10 text-center text-gray-400">Nenhum repasse encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {approveModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-lg">
            <h4 className="text-lg font-semibold mb-4">Aprovar Pagamento</h4>
            <p className="text-sm text-gray-600 mb-3">
              Repasses selecionados: <strong>{selectedIds.length}</strong>
            </p>
            <input
              type="file"
              multiple
              onChange={(e) => setApproveFiles(Array.from(e.target.files || []))}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-2"
            />
            <p className="text-xs text-gray-500 mb-4">{approveFiles.length} arquivo(s) selecionado(s).</p>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setApproveModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitBatchApprove}
                disabled={processingBatch}
                className="px-4 py-2 bg-blue-700 text-white rounded disabled:opacity-70"
              >
                {processingBatch ? 'Processando...' : 'Confirmar Aprovação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && isAdmin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-xl">
            <h4 className="text-lg font-semibold mb-4">Editar Repasse #{editing.id}</h4>

            <label className="block text-sm text-gray-700 mb-1">Data</label>
            <input
              type="date"
              value={dataRef}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
            />

            <div className="grid grid-cols-3 gap-3 mb-4">
              <input type="number" value={ano} onChange={(e) => setAno(e.target.value)} className="border border-gray-300 rounded px-3 py-2" />
              <input type="number" value={mes} onChange={(e) => setMes(e.target.value)} className="border border-gray-300 rounded px-3 py-2" />
              <input type="number" value={dia} onChange={(e) => setDia(e.target.value)} className="border border-gray-300 rounded px-3 py-2" />
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
              type="number"
              step="0.01"
              value={valorLiberado}
              onChange={(e) => setValorLiberado(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
            />

            <div className="text-sm text-gray-600 mb-2">
              Comprovantes atuais: {existingCount}/5. Você pode adicionar mais {remainingSlots}.
            </div>
            <input
              type="file"
              multiple
              onChange={handleFilesChange}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-2"
            />
            <div className="text-xs text-gray-500 mb-5">{files.length} arquivo(s) selecionado(s).</div>

            <div className="flex items-center gap-2 justify-end">
              <button type="button" onClick={closeEdit} className="px-4 py-2 border border-gray-300 rounded">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || files.length > remainingSlots}
                className="px-4 py-2 bg-blue-700 text-white rounded disabled:opacity-70"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default RepasseList
