import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CryptoJS from 'crypto-js';
import { Shield, BarChart3, Download, ExternalLink, AlertCircle, Clock, CheckCircle, FileText, ImageIcon } from 'lucide-react';
import api, { API_BASE_URL, buildDownloadPath } from './api';
import { useApiHealth } from './ApiHealthContext';
import HealthScreen from './HealthScreen';

const MAGIC_SECRET = import.meta.env.VITE_MAGIC_LINK_SECRET || 'fluxoguard_default_dev_key_2026';

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (tx) => {
  if (!tx?.ano || !tx?.mes || !tx?.dia) return '-';
  return `${String(tx.dia).padStart(2, '0')}/${String(tx.mes).padStart(2, '0')}/${tx.ano}`;
};

const SecureShare = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { status, retry } = useApiHealth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const token = searchParams.get('token');

  const decryptToken = (t) => {
    try {
      const bytes = CryptoJS.AES.decrypt(t, MAGIC_SECRET);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) throw new Error('Invalid token');
      const payload = JSON.parse(decrypted);
      
      // Check expiration
      if (payload.extExp && Date.now() > payload.extExp) {
        throw new Error('Token expired');
      }
      
      return payload;
    } catch (err) {
      console.error('Decryption failed:', err);
      return null;
    }
  };

  const loadData = async () => {
    if (!token) {
      setError('Token de acesso ausente.');
      setLoading(false);
      return;
    }

    const payload = decryptToken(token);
    if (!payload || !payload.id) {
      setError('Link de acesso inválido ou expirado. Entre em contato com o administrador.');
      setLoading(false);
      return;
    }

    try {
      // Fetch from the share-specific endpoint
      const response = await api.get(`/api/shares/${payload.id}`, {
        headers: { 'X-Magic-Token': token }
      });
      setTransaction(response.data);
      
      // Auto-login logic: Store the user data/email as requested
      // The backend should return the user profile in the share response if possible
      // But if it doesn't, we can simulate or wait until the user clicks dashboard
      if (response.data.user_profile) {
        localStorage.setItem('fluxoguard_admin_user', JSON.stringify(response.data.user_profile));
        // Note: we don't have a full JWT for all ops yet, but we have enough for public view/context
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Não foi possível carregar os dados desta transação.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'online') {
      loadData();
    }
  }, [status, token]);

  if (status !== 'online') {
    return <HealthScreen status={status} onRetry={retry} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground font-medium">Validando seu acesso seguro...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-destructive/10 rounded-full mb-6">
          <AlertCircle className="w-12 h-12 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">Ops! Algo deu errado</h2>
        <p className="text-muted-foreground max-w-md mb-8">{error}</p>
        <button 
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl font-bold hover:bg-secondary/80 transition-all shadow-lg"
        >
          VOLTAR AO INÍCIO
        </button>
      </div>
    );
  }

  const handleGoToDashboard = () => {
    // If the partner was "shadow logged" let them go to their transactions
    navigate('/partner/transactions');
  };

  const handleDownload = async (path) => {
    const fullUrl = `${API_BASE_URL}${buildDownloadPath(path)}`;
    window.open(fullUrl, '_blank');
  };

  return (
    <div className="dark-theme min-h-screen bg-background relative overflow-hidden flex flex-col py-12 px-4 md:px-8">
      {/* Visual effects */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-xl mx-auto w-full relative z-10">
        {/* Header Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-4">
            <Shield className="w-14 h-14 text-primary shrink-0" />
            <BarChart3 className="w-7 h-7 text-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h1 className="text-3xl font-space font-extrabold text-white tracking-tight">FluxoGuard</h1>
          <p className="text-primary text-[10px] font-bold uppercase tracking-[0.2em]">Secure Access Point</p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 mb-6 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full w-fit mx-auto">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Acesso Autorizado</span>
        </div>

        {/* Main Card */}
        <div className="glass rounded-3xl border border-white/10 shadow-2xl overflow-hidden mb-8">
          <div className="bg-white/5 p-6 border-b border-white/5 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Transação</p>
              <h2 className="text-xl font-bold text-white">ID #{transaction?.id}</h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Status</p>
              <div className="px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase ring-1 ring-primary/40">
                {transaction?.status}
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Data do Repasse</p>
                <div className="flex items-center gap-2 text-white">
                  <Clock className="w-4 h-4 text-primary/60" />
                  <span className="font-medium text-lg">{formatDate(transaction)}</span>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Valor Liberado</p>
                <span className="text-2xl font-black text-primary">{formatCurrency(transaction?.valor_liberado)}</span>
              </div>

              <div className="col-span-2 pt-4 border-t border-white/5">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Parceiro Financeiro</p>
                <div className="flex items-center gap-2 text-white group">
                  <div className="p-2 bg-primary/10 rounded-lg ring-1 ring-primary/20">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold text-lg">{transaction?.parceiro_nome ||"-"}</span>
                </div>
              </div>

              <div className="col-span-2 pt-4 border-t border-white/5">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cliente / Origem</p>
                <p className="text-lg text-white/90">{transaction?.nome_cliente || "-"}</p>
              </div>

              {transaction?.descricao && (
                <div className="col-span-2 pt-4 border-t border-white/5">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Descrição</p>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">"{transaction.descricao}"</p>
                </div>
              )}
            </div>

            {/* Document Buttons */}
            <div className="pt-8 space-y-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center mb-1">Documentação Disponível</p>
              
              <div className="grid grid-cols-2 gap-4">
                {transaction?.notas_fiscais?.length > 0 && (
                  <button 
                    onClick={() => handleDownload(transaction.notas_fiscais[0])}
                    className="flex flex-col items-center gap-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl hover:bg-blue-500/20 transition-all group"
                  >
                    <FileText className="w-6 h-6 text-blue-500 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold text-blue-500 uppercase">Nota Fiscal</span>
                  </button>
                )}
                
                {transaction?.comprovantes?.length > 0 && (
                  <button 
                    onClick={() => handleDownload(transaction.comprovantes[0])}
                    className="flex flex-col items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl hover:bg-emerald-500/20 transition-all group"
                  >
                    <ImageIcon className="w-6 h-6 text-emerald-500 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold text-emerald-500 uppercase">Comprovante</span>
                  </button>
                )}

                {(!transaction?.notas_fiscais?.length && !transaction?.comprovantes?.length) && (
                  <div className="col-span-2 py-6 text-center text-muted-foreground text-sm border-2 border-dashed border-white/5 rounded-2xl">
                    Aguardando emissão de documentos.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-card/50 rounded-3xl border border-white/5 p-8 text-center backdrop-blur-sm shadow-xl">
          <h4 className="text-white font-bold mb-2">Quer acompanhar este e outros repasses com mais detalhes?</h4>
          <p className="text-muted-foreground text-sm mb-6">Acesse seu painel completo para gerenciar toda sua operação financeira.</p>
          
          <button 
            onClick={handleGoToDashboard}
            className="w-full py-4 bg-primary text-white rounded-2xl font-black text-lg hover:shadow-[0_0_30px_rgba(255,107,0,0.4)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            ACESSAR O SISTEMA
            <ExternalLink className="w-5 h-5" />
          </button>
        </div>

        <p className="text-center mt-8 text-muted-foreground text-[10px] font-medium tracking-widest uppercase opacity-50">
          Powered by FluxoGuard Encryption Engine
        </p>
      </div>
    </div>
  );
};

export default SecureShare;
