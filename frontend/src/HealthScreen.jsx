import React from 'react';
import { Shield, BarChart3, CloudOff, Loader2 } from 'lucide-react';

const HealthScreen = ({ status, onRetry }) => {
  const isLoading = status === 'loading';
  const isOffline = status === 'offline';

  return (
    <div className="dark-theme min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden text-center transition-all duration-700">
      {/* Background glow effects */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] blur-[120px] rounded-full pointer-events-none transition-colors duration-1000 ${isOffline ? 'bg-red-500/5' : 'bg-primary/10'}`} />

      <div className="glass p-12 rounded-3xl shadow-2xl w-full max-w-lg border border-white/5 relative z-10 backdrop-blur-2xl">
        <div className="flex justify-center mb-8">
          <div className="relative">
            {isLoading ? (
              <div className="relative">
                <Shield className="w-16 h-16 text-primary animate-pulse" />
                <BarChart3 className="w-8 h-8 text-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80" />
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping opacity-30" />
              </div>
            ) : (
              <CloudOff className="w-16 h-16 text-red-500" />
            )}
          </div>
        </div>

        {isLoading ? (
          <>
            <h1 className="text-3xl font-space font-extrabold text-white mb-4 tracking-tight drop-shadow-sm">
              Quase Lá! <span className="text-primary">Estamos Iniciando o Sistema.</span>
            </h1>
            <p className="text-slate-400 mb-10 leading-relaxed max-w-sm mx-auto">
              O sistema está iniciando. Isso pode levar até 60 segundos na primeira visita. Agradecemos a sua paciência!
            </p>

            <div className="space-y-6">
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-primary animate-progress-bar rounded-full shadow-[0_0_15px_rgba(255,107,0,0.5)]" />
              </div>
              <div className="flex items-center justify-center gap-3 text-sm font-medium text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Buscando conexão com o servidor...</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-space font-extrabold text-white mb-4 tracking-tight">
              Ops! <span className="text-red-500">Serviço Indisponível.</span>
            </h1>
            <p className="text-slate-400 mb-8 leading-relaxed max-w-sm mx-auto">
              Não conseguimos conectar ao servidor após algumas tentativas. Por favor, verifique sua conexão ou tente novamente mais tarde.
            </p>
            <button
              onClick={onRetry}
              className="bg-primary hover:bg-primary/80 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-[0_4px_15px_rgba(255,107,0,0.3)] active:scale-95"
            >
              Tentar Novamente
            </button>
          </>
        )}
      </div>

      <p className="absolute bottom-8 text-xs font-bold uppercase tracking-[0.2em] text-white/20 select-none">
        FluxoGuard • Segurança & Transparência
      </p>

      {/* Inlining animation for progress bar to avoid separate css complexities */}
      <style>{`
        @keyframes progress-horizontal {
          0% { width: 0%; opacity: 0; }
          20% { width: 20%; opacity: 1; }
          80% { width: 80%; opacity: 1; }
          100% { width: 100%; opacity: 0; }
        }
        .animate-progress-bar {
          animation: progress-horizontal 2.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default HealthScreen;
