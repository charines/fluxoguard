import React, { useState, useEffect } from 'react';
import { registerUser, checkAvailability } from './api';
import { 
  User, 
  Briefcase, 
  ArrowRight, 
  CheckCircle, 
  Copy, 
  RefreshCw, 
  AlertCircle,
  Mail,
  FileText,
  Phone,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';

const RegistrationOnboarding = ({ initialType = null, currentUser = null }) => {
  const [step, setStep] = useState(initialType ? 2 : 1);
  const [userType, setUserType] = useState(initialType); // 'PARCEIRO', 'ADMIN' or 'SUPERADMIN'
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    documento: '',
    telefone: ''
  });

  useEffect(() => {
    if (initialType) {
      setUserType(initialType);
      setStep(2);
    }
  }, [initialType]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const steps = [
    { title: 'Seleção', icon: User },
    { title: 'Dados', icon: FileText },
    { title: 'Confirmação', icon: CheckCircle },
    { title: 'Sucesso', icon: CheckCircle }
  ];

  const handleNextStep = async () => {
    if (step === 2) {
      await handleTransitionStep2To3();
    } else if (step < 3) {
      setStep(current => current + 1);
    }
  };

  const handleTransitionStep2To3 = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const emailCheck = await checkAvailability({ email: formData.email });
      if (!emailCheck.available) {
        setError(emailCheck.reason);
        return;
      }
      
      if (userType === 'PARCEIRO') {
        const docCheck = await checkAvailability({ documento: formData.documento });
        if (!docCheck.available) {
          setError('Este CPF/CNPJ já está cadastrado em nossa base.');
          return;
        }
      }
      
      setStep(3);
    } catch (err) {
      setError('Não foi possível validar os dados agora. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) setStep(current => current - 1);
  };

  const handleTypeSelect = (type) => {
    setUserType(type);
    handleNextStep();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateStep2 = () => {
    if (!formData.nome || !formData.email) return false;
    if (userType === 'PARCEIRO' && !formData.documento) return false;
    return true;
  };

  const copyToClipboard = () => {
    if (!successData) return;
    const text = `FluxoGuard - Dados de Acesso\nLogin: ${successData.email}\nSenha: ${successData.password}`;
    navigator.clipboard.writeText(text);
    alert('Dados copiados para a área de transferência!');
  };

  const handleSubmit = async (currentRetry = 0) => {
    setIsLoading(true);
    setError(null);
    
    const payload = {
      nome: formData.nome,
      email: formData.email,
      tipo: userType,
      documento: userType === 'PARCEIRO' ? formData.documento : null,
      telefone: formData.telefone || null
    };

    try {
      const result = await registerUser(payload);
      setSuccessData(result);
      setStep(4);
    } catch (err) {
      console.error('Erro no cadastro:', err);
      
      // Validação de negócio (ex: E-mail em uso) - Não deve tentar novamente
      if (err.response && err.response.status === 400) {
        setError(err.response.data.detail || 'Este e-mail ou documento já está em uso no sistema.');
        setIsLoading(false);
        return;
      }

      if (currentRetry < 3) {
        setRetryCount(currentRetry + 1);
        setTimeout(() => handleSubmit(currentRetry + 1), 2000);
      } else {
        setError('Não foi possível finalizar o cadastro após 3 tentativas. Verifique sua conexão.');
        setIsLoading(false);
      }
    } finally {
      if (currentRetry === 3 || successData) {
        setIsLoading(false);
      }
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Seja bem-vindo ao FluxoGuard</h2>
        <p className="text-muted-foreground">Escolha o tipo de conta que deseja criar</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => handleTypeSelect('PARCEIRO')}
          className="flex flex-col items-center p-8 bg-card border-2 border-transparent hover:border-primary transition-all rounded-2xl group"
        >
          <div className="p-4 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors mb-4">
            <Briefcase className="w-8 h-8 text-primary" />
          </div>
          <span className="text-lg font-semibold">Parceiro</span>
          <p className="text-sm text-center text-muted-foreground mt-2">
            Para transportadores e prestadores de serviço
          </p>
        </button>
        <button
          onClick={() => handleTypeSelect('ADMIN')}
          className="flex flex-col items-center p-8 bg-card border-2 border-transparent hover:border-primary transition-all rounded-2xl group"
        >
          <div className="p-4 bg-secondary/10 rounded-full group-hover:bg-secondary/20 transition-colors mb-4">
            <User className="w-8 h-8 text-secondary" />
          </div>
          <span className="text-lg font-semibold">Administrador</span>
          <p className="text-sm text-center text-muted-foreground mt-2">
            Gestão, Administração e Financeiro
          </p>
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Informações da Conta</h2>
        <p className="text-muted-foreground">Preencha os dados necessários para o perfil de {userType === 'PARCEIRO' ? 'Parceiro' : 'Administrador'}</p>
      </div>
      
      <div className="space-y-4 max-w-md mx-auto">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <User className="w-4 h-4" /> Nome Completo *
          </label>
          <input
            type="text"
            name="nome"
            value={formData.nome}
            onChange={handleInputChange}
            className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 focus:ring-primary outline-none transition-all"
            placeholder="Ex: João Silva"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Mail className="w-4 h-4" /> E-mail *
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 focus:ring-primary outline-none transition-all"
            placeholder="joao@exemplo.com"
          />
        </div>

        {userType === 'PARCEIRO' && (
          <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
            <label className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" /> CPF ou CNPJ *
            </label>
            <input
              type="text"
              name="documento"
              value={formData.documento}
              onChange={handleInputChange}
              className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 focus:ring-primary outline-none transition-all"
              placeholder="000.000.000-00"
            />
          </div>
        )}

        {userType === 'PARCEIRO' && (
          <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
            <label className="text-sm font-medium flex items-center gap-2">
              <Phone className="w-4 h-4" /> Telefone (Opcional)
            </label>
            <input
              type="text"
              name="telefone"
              value={formData.telefone}
              onChange={handleInputChange}
              className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 focus:ring-primary outline-none transition-all"
              placeholder="(00) 00000-0000"
            />
          </div>
        )}

        {(userType === 'ADMIN' || userType === 'SUPERADMIN') && currentUser?.tipo === 'SUPERADMIN' && (
          <div className="pt-4 border-t border-border mt-4">
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-bold">Acesso Superadmin</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Permissões de gestão total</p>
                </div>
              </div>
              <button
                onClick={() => setUserType(userType === 'SUPERADMIN' ? 'ADMIN' : 'SUPERADMIN')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  userType === 'SUPERADMIN' ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    userType === 'SUPERADMIN' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {error && step === 2 && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-xl flex items-start gap-2 border border-destructive/20 text-xs max-w-md mx-auto mt-4 animate-in fade-in zoom-in-95">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className={`flex ${initialType ? 'justify-end' : 'justify-between'} items-center pt-8 max-w-md mx-auto`}>
        {!initialType && (
          <button
            onClick={handlePrevStep}
            disabled={isLoading}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        )}
        <button
          disabled={!validateStep2() || isLoading}
          onClick={handleNextStep}
          className="px-6 py-3 bg-primary text-white rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all font-semibold"
        >
          {isLoading ? (
            <>Validando...</>
          ) : (
            <>Próximo <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-8 animate-in fade-in scale-95 duration-500 max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Quase lá!</h2>
        <p className="text-muted-foreground">Confirme se as informações estão corretas antes de finalizar.</p>
      </div>

      <div className="bg-muted/50 border border-border rounded-2xl p-6 space-y-4">
        <div className="flex justify-between border-b border-border pb-2">
          <span className="text-muted-foreground">Tipo de Conta:</span>
          <span className="font-semibold">{userType === 'PARCEIRO' ? 'Parceiro' : (userType === 'SUPERADMIN' ? 'Superadmin' : 'Administrador')}</span>
        </div>
        <div className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-muted-foreground">Nome:</span>
          <span className="font-semibold">{formData.nome}</span>
        </div>
        <div className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-muted-foreground">E-mail:</span>
          <span className="font-semibold">{formData.email}</span>
        </div>
        {userType === 'PARCEIRO' && (
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-muted-foreground">Documento:</span>
            <span className="font-semibold">{formData.documento}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-start gap-3 border border-destructive/20">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">Ops! Algo deu errado.</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {isLoading && retryCount > 0 && (
        <div className="flex flex-col items-center gap-2 text-primary">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Tentativa {retryCount} de 3...</span>
        </div>
      )}

      <div className="flex justify-between items-center pt-4">
        <button
          onClick={handlePrevStep}
          disabled={isLoading}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
        >
          <ArrowLeft className="w-4 h-4" /> Revisar Dados
        </button>
        <button
          onClick={() => handleSubmit()}
          disabled={isLoading}
          className="px-8 py-4 bg-primary text-white rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" /> Finalizando...
            </>
          ) : (
            <>
              Finalizar Cadastro <CheckCircle className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-8 animate-in zoom-in-95 duration-700 max-w-md mx-auto text-center pb-8">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-primary" />
        </div>
      </div>
      
      <div>
        <h2 className="text-3xl font-bold mb-2">Cadastro Realizado!</h2>
        <p className="text-muted-foreground text-sm">
          O registro foi concluído com sucesso. Confira os dados abaixo.
        </p>
      </div>

      <div className="bg-gradient-to-br from-card to-muted border border-border rounded-2xl p-8 space-y-6 relative overflow-hidden text-left">
        <div className="space-y-4 relative z-10">
          <div className="grid grid-cols-2 gap-4 border-b border-border pb-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Resumo</label>
              <p className="text-xs font-semibold uppercase">{userType === 'PARCEIRO' ? 'Parceiro' : (userType === 'SUPERADMIN' ? 'Superadmin' : 'Administrador')}</p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Status</label>
              <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Ativo
              </p>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Identificador / E-mail</label>
            <p className="text-sm font-mono break-all font-semibold">{successData?.email}</p>
          </div>

          {successData?.documento && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Documento (CPF/CNPJ)</label>
              <p className="text-sm font-mono font-semibold">{successData?.documento}</p>
            </div>
          )}

          <div className="pt-4 border-t border-border mt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-muted-foreground uppercase">Mostrar dados de acesso?</span>
              <button
                onClick={() => setShowPassword(!showPassword)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  showPassword ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showPassword ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {showPassword ? (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-primary font-bold">Senha de Acesso</label>
                  <p className="text-2xl font-mono text-primary font-black tracking-tight">{successData?.password}</p>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="w-full py-2 bg-primary text-white rounded-lg flex items-center justify-center gap-2 transition-all text-xs font-bold hover:bg-primary/90"
                >
                  <Copy className="w-4 h-4" /> Copiar Dados
                </button>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-[10px] text-muted-foreground italic">
                  A senha não será exibida nem enviada para este {userType === 'PARCEIRO' ? 'parceiro' : 'administrador'}.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={() => window.location.reload()}
          className="text-primary hover:underline font-semibold text-sm"
        >
          Cadastrar outro {userType === 'PARCEIRO' ? 'parceiro' : 'administrador'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-fit bg-transparent flex flex-col items-center justify-center p-0">
      <div className="w-full max-w-4xl bg-card rounded-3xl overflow-hidden shadow-sm border border-border relative">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${(step / steps.length) * 100}%` }}
          />
        </div>

        {/* Steps Indicators */}
        <div className="px-8 pt-10 pb-6 flex justify-between bg-muted/30">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = step >= i + 1;
            const isCompleted = step > i + 1;
            
            return (
              <div key={i} className="flex flex-col items-center gap-2 relative z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                  isActive ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-muted text-muted-foreground'
                }`}>
                  {isCompleted ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs font-bold uppercase tracking-tight hidden md:block ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>

        <div className="p-8 md:p-12">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>
      </div>
      
      <p className="mt-8 text-sm text-muted-foreground">
        Proteção de dados garantida pelo protocolo <b>Job Atomic 2026</b>
      </p>
    </div>
  );
};

export default RegistrationOnboarding;
