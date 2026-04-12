import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Mail, 
  Wallet,
  Calculator,
  ShieldCheck,
  X,
  CreditCard,
  Search
} from 'lucide-react';
import { getUsersByType, createRepasse } from './api';

const formatCurrency = (value) => {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const getTodayInputValue = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const MoneyInput = ({ value, onChange, label }) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value) {
      setDisplayValue(Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (!v) {
      onChange('');
      return;
    }
    const floatValue = Number(v) / 100;
    onChange(floatValue.toString());
  };

  return (
    <div className="w-full md:w-36 flex-shrink-0">
      <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">R$</span>
        <input 
          type="text"
          placeholder="0,00"
          value={displayValue}
          onChange={handleChange}
          className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono font-bold"
        />
      </div>
    </div>
  );
};

const TransactionWizard = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [partners, setPartners] = useState([]);
  
  // State
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayInputValue());
  const [items, setItems] = useState([{ id: Date.now(), nome_cliente: '', valor: '', data_emissao: '' }]);
  const [createdTxId, setCreatedTxId] = useState(null);

  useEffect(() => {
    getUsersByType('PARCEIRO').then(setPartners).catch(console.error);
  }, []);

  const totalRepasse = useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
  }, [items]);

  const filteredPartners = useMemo(() => {
    const search = partnerSearch.trim().toLowerCase();
    if (!search) return partners;
    return partners.filter((p) => {
      const nome = (p.nome || '').toLowerCase();
      const cnpj = (p.cnpj_cpf || '').toLowerCase();
      return nome.includes(search) || cnpj.includes(search);
    });
  }, [partners, partnerSearch]);

  const selectedPartner = useMemo(() => {
    return partners.find((p) => p.id === selectedPartnerId) || null;
  }, [partners, selectedPartnerId]);

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), nome_cliente: '', valor: '', data_emissao: '' }]);
  };

  const handleRemoveItem = (id) => {
    if (items.length === 1) return;
    setItems(items.filter(i => i.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleNextStep1 = () => {
    if (!selectedPartnerId) return alert('Selecione um parceiro.');
    setStep(2);
  };

  const handleNextStep2 = async () => {
    if (!paymentDate) {
      return alert('Informe a data de pagamento.');
    }
    if (items.some(i => !i.nome_cliente.trim() || !i.valor || Number(i.valor) <= 0 || !i.data_emissao)) {
      return alert('Preencha nome, valor e data de emissão de todos os clientes.');
    }
    
    setLoading(true);
    try {
      const [ano, mes, dia] = paymentDate.split('-');
      const formData = new FormData();
      formData.append('user_id', selectedPartnerId);
      formData.append('ano', Number(ano));
      formData.append('mes', Number(mes));
      formData.append('dia', Number(dia));
      formData.append('valor_liberado', totalRepasse.toFixed(2));
      formData.append('items_json', JSON.stringify(items.map(i => ({ nome_cliente: i.nome_cliente, valor: i.valor, data_emissao: i.data_emissao }))));
      
      const res = await createRepasse(formData);
      setCreatedTxId(res.id);
      setStep(3);
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao criar repasse.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseWizard = () => {
    if (step === 3 && createdTxId && onSuccess) {
      onSuccess({
        createdTxId,
        partnerId: selectedPartnerId,
        partnerName: selectedPartner?.nome || ''
      });
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl shadow-indigo-500/10 flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              {step === 1 && <Users className="w-6 h-6" />}
              {step === 2 && <Calculator className="w-6 h-6" />}
              {step === 3 && <Mail className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                {step === 1 && 'Selecionar Parceiro'}
                {step === 2 && 'Detalhes do Repasse'}
                {step === 3 && 'Enviar Notificação'}
              </h2>
              <div className="flex items-center gap-2">
                <div className={`h-1.5 w-8 rounded-full transition-all ${step >= 1 ? 'bg-indigo-600' : 'bg-slate-100'}`} />
                <div className={`h-1.5 w-8 rounded-full transition-all ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-100'}`} />
                <div className={`h-1.5 w-8 rounded-full transition-all ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-100'}`} />
              </div>
            </div>
          </div>
          <button onClick={handleCloseWizard} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 pt-4">
          
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <p className="text-slate-500 font-medium">Escolha o parceiro que receberá este repasse múltiplo.</p>

              <div className="hidden md:block space-y-4">
                <div className="relative">
                  <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por parceiro ou CNPJ..."
                    value={partnerSearch}
                    onChange={(e) => setPartnerSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200">
                  <div className="max-h-[340px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Nome</th>
                          <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">CNPJ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPartners.map((p) => (
                          <tr
                            key={p.id}
                            onClick={() => setSelectedPartnerId(p.id)}
                            className={`cursor-pointer border-t border-slate-100 transition-colors ${
                              selectedPartnerId === p.id ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-5 py-4 font-semibold text-slate-800">{p.nome || '-'}</td>
                            <td className="px-5 py-4 font-mono text-sm text-slate-600">{p.cnpj_cpf || '-'}</td>
                          </tr>
                        ))}
                        {filteredPartners.length === 0 && (
                          <tr className="border-t border-slate-100">
                            <td colSpan={2} className="px-5 py-10 text-center text-slate-500">
                              Nenhum parceiro encontrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:hidden">
                {partners.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPartnerId(p.id)}
                    className={`flex items-center justify-between p-5 rounded-3xl border-2 transition-all group ${
                      selectedPartnerId === p.id 
                        ? 'border-indigo-600 bg-indigo-50/30' 
                        : 'border-slate-100 hover:border-indigo-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        selectedPartnerId === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-slate-800">{p.nome}</div>
                        <div className="text-xs text-slate-500 uppercase font-black tracking-widest">{p.email}</div>
                      </div>
                    </div>
                    {selectedPartnerId === p.id && <CheckCircle2 className="w-6 h-6 text-indigo-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between">
                <p className="text-slate-500 font-medium tracking-tight">Adicione os clientes e valores incluídos neste repasse.</p>
                <button 
                  onClick={handleAddItem}
                  className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Cliente
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Data de Pagamento</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full md:w-56 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="flex flex-wrap md:flex-nowrap items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Nome do Cliente</label>
                      <input 
                        type="text"
                        placeholder="Ex: Maria Souza"
                        value={item.nome_cliente}
                        onChange={(e) => handleItemChange(item.id, 'nome_cliente', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <MoneyInput 
                      label="Valor"
                      value={item.valor}
                      onChange={(v) => handleItemChange(item.id, 'valor', v)}
                    />
                    <div className="w-full md:w-44 flex-shrink-0">
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Data de Emissão</label>
                      <input
                        type="date"
                        value={item.data_emissao || ''}
                        onChange={(e) => handleItemChange(item.id, 'data_emissao', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-1 mt-4 md:mt-0">
                      {(item.nome_cliente.trim() || item.valor || item.data_emissao) && (
                        <button
                          onClick={handleAddItem}
                          className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"
                          title="Adicionar cliente"
                          aria-label="Adicionar cliente"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                        title="Remover cliente"
                        aria-label="Remover cliente"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="p-6 bg-emerald-50 rounded-[28px] border border-emerald-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 animate-bounce">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-900">Repasse Criado com Sucesso!</h4>
                  <p className="text-sm text-emerald-700">Agora você pode notificar o parceiro sobre a solicitação da Nota Fiscal.</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-slate-100 bg-slate-50 flex items-center justify-between sticky bottom-0 z-10">
          <div>
            {step === 2 ? (
              <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-white px-4 py-2">
                <Wallet className="w-4 h-4 text-indigo-600" />
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Valor Total</span>
                <span className="text-lg font-black text-slate-900">{formatCurrency(totalRepasse)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-indigo-600/50">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">FluxoGuard Security</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
             {step < 3 && (
               <button 
                onClick={() => setStep(step - 1)}
                disabled={step === 1 || loading}
                className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:bg-slate-50 disabled:opacity-0 transition-all"
               >
                 <ChevronLeft className="w-6 h-6" />
               </button>
             )}
             
             {step < 3 ? (
               <button 
                onClick={step === 1 ? handleNextStep1 : handleNextStep2}
                disabled={loading}
                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-70"
               >
                 {loading ? 'Processando...' : (
                   <>
                     {step === 1 ? 'Seguinte' : 'Finalizar & Notificar'}
                     <ChevronRight className="w-5 h-5" />
                   </>
                 )}
               </button>
             ) : (
               <button 
                onClick={handleCloseWizard}
                className="bg-slate-900 text-white px-10 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-200"
               >
                 Fechar & Voltar à Lista
               </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionWizard;
