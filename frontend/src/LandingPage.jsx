import React from 'react';
import { Shield, BarChart3, ChevronRight, CheckCircle2, PieChart, ArrowLeftRight, Download, Laptop, Smartphone, Rocket, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="dark-theme min-h-screen bg-background text-foreground font-inter overflow-x-hidden selection:bg-primary/30">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="relative">
              <Shield className="w-8 h-8 text-primary shrink-0 transition-transform group-hover:scale-110" />
              <BarChart3 className="w-4 h-4 text-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <span className="text-xl font-space font-bold tracking-tight">Fluxo<span className="text-primary">Guard</span></span>
          </div>

          <Link 
            to="/login" 
            className="flex items-center gap-2 px-6 py-2 rounded-full font-semibold text-sm border border-white/10 hover:bg-white/5 transition-colors"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Abstract background elements */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[400px] h-[400px] bg-secondary/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 text-center lg:text-left z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-xs font-semibold tracking-wider uppercase animate-bounce-slow">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
              </span>
              Plataforma Ativa & Segura
            </div>

            <h1 className="text-4xl md:text-6xl font-space font-extrabold leading-[1.1] tracking-tight">
              FluxoGuard: O Fim do <span className="text-primary italic">Caos Financeiro.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
              Organize contas e notas fiscais em um só lugar. Controle seu fluxo de caixa em tempo real e garanta a segurança fiscal da sua empresa. Sem planilhas bagunçadas.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 justify-center lg:justify-start">
              <Link 
                to="/login"
                className="group relative px-8 py-4 bg-primary text-white rounded-xl font-bold text-lg hover:shadow-[0_0_30px_rgba(255,107,0,0.4)] transition-all duration-300 transform hover:-translate-y-1 flex items-center gap-2"
              >
                ENTRAR NA FERRAMENTA
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <span className="text-xs text-muted-foreground font-medium italic">Acesso seguro e imediato • Controle total</span>
            </div>
          </div>

          <div className="relative z-10 animate-float">
            {/* Minimalist Dashboard Mockup */}
            <div className="relative mx-auto w-full max-w-[320px] lg:max-w-md aspect-[9/16] lg:aspect-auto">
              <div className="relative bg-[#0A0D16] rounded-[2.5rem] border-[8px] border-[#1A1F2E] overflow-hidden shadow-2xl shadow-black/50">
                {/* Header of Mockup */}
                <div className="bg-[#1A1F2E] px-6 py-8">
                  <div className="flex justify-between items-center mb-6">
                    <div className="p-2 bg-secondary/10 rounded-lg">
                      <Shield className="w-6 h-6 text-secondary" />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Saldo Atual</p>
                      <p className="text-2xl font-space font-bold">R$ 54.210,00</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background/50 p-3 rounded-xl border border-white/5">
                      <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Receitas</p>
                      <p className="text-sm font-bold text-secondary">+R$ 24.500</p>
                    </div>
                    <div className="bg-background/50 p-3 rounded-xl border border-white/5">
                      <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Despesas</p>
                      <p className="text-sm font-bold text-red-400">-R$ 12.300</p>
                    </div>
                  </div>
                </div>

                {/* List of Mockup */}
                <div className="p-6 space-y-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Transações Recentes</p>
                  {[
                    { label: 'Nota Fiscal - Cliente A', val: '+ R$ 12.000', type: 'receita', date: 'Hoje' },
                    { label: 'Pagamento AWS', val: '- R$ 1.200', type: 'despesa', date: 'Ontem' },
                    { label: 'NF de Serviço - Cliente B', val: '+ R$ 5.500', type: 'receita', date: '25 Mar' },
                    { label: 'Marketing Social', val: '- R$ 3.000', type: 'despesa', date: '24 Mar' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${item.type === 'receita' ? 'bg-secondary/10' : 'bg-red-400/10'}`}>
                          {item.type === 'receita' ? <Smartphone className="w-4 h-4 text-secondary" /> : <Laptop className="w-4 h-4 text-red-400" />}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold">{item.label}</p>
                          <p className="text-[9px] text-muted-foreground">{item.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-[11px] font-bold ${item.type === 'receita' ? 'text-secondary' : 'text-red-400'}`}>
                          {item.val}
                        </p>
                        <BarChart3 className="w-3 h-3 text-muted-foreground/30" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Floating "RLS Protect" Badge */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 glass px-4 py-2 rounded-lg border border-secondary/30 scale-110 shadow-2xl shadow-secondary/20">
                  <div className="flex items-center gap-2">
                    <div className="bg-secondary/20 p-1.5 rounded-md">
                      <Shield className="w-4 h-4 text-secondary" />
                    </div>
                    <div>
                      <p className="text-[8px] uppercase font-bold tracking-widest text-muted-foreground">RLS Ativo</p>
                      <p className="text-[10px] font-bold text-secondary">Dados Protegidos</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative side elements */}
              <div className="hidden lg:block absolute -right-12 top-1/4 glass p-4 rounded-2xl border border-white/10 animate-float delay-100">
                <PieChart className="w-10 h-10 text-primary" />
              </div>
              <div className="hidden lg:block absolute -left-12 bottom-1/4 glass p-4 rounded-2xl border border-white/10 animate-float delay-200">
                <Download className="w-10 h-10 text-secondary" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 px-6 bg-[#0E121E]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-red-400 text-sm font-bold uppercase tracking-[0.2em]">POR QUE FLUXOGUARD?</h2>
            <h3 className="text-3xl md:text-5xl font-space font-extrabold max-w-2xl mx-auto leading-tight">
              Tudo que você precisa. <span className="text-muted-foreground">Nada que não precisa.</span>
            </h3>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <CheckCircle2 className="w-8 h-8 text-secondary" />,
                title: "Segurança Total RLS",
                desc: "Seus documentos financeiros protegidos com criptografia e acesso controlado. Nenhum dado vaza."
              },
              {
                icon: <PieChart className="w-8 h-8 text-primary" />,
                title: "Visão Clara do Caixa",
                desc: "Gráficos intuitivos para entradas e saídas. Tome decisões inteligentes em tempo real."
              },
              {
                icon: <ArrowLeftRight className="w-8 h-8 text-secondary" />,
                title: "Integração Notas/Finanças",
                desc: "Acabe com a busca manual. Notas fiscais e comprovantes vinculados a cada transação."
              }
            ].map((benefit, i) => (
              <div key={i} className="group p-8 rounded-3xl bg-background border border-white/5 hover:border-primary/20 transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] transform hover:-translate-y-2">
                <div className="mb-6 p-4 rounded-2xl bg-muted/50 w-fit group-hover:scale-110 transition-transform">
                  {benefit.icon}
                </div>
                <h4 className="text-xl font-space font-bold mb-4">{benefit.title}</h4>
                <p className="text-muted-foreground leading-relaxed">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-6 border-y border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-12">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest text-center">
            Confiado por centenas de empresas que buscam organização
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale group hover:grayscale-0 transition-all">
            {['TechNova Corp', 'Global Logistics', 'InMade Studio', 'EcoSolutions', 'Delta Finance'].map((brand, i) => (
              <span key={i} className="text-2xl font-space font-bold tracking-tighter hover:text-white transition-colors">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA / Footer */}
      <footer className="relative py-24 px-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/20 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center space-y-10 relative z-10">
          <h2 className="text-4xl md:text-6xl font-space font-extrabold leading-tight">
            Pronto para simplificar <br className="hidden md:block" /><span className="text-secondary text-glow-secondary">sua gestão?</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            Acesse a ferramenta agora mesmo e descubra como o FluxoGuard pode transformar o controle financeiro da sua empresa.
          </p>

          <div className="flex flex-col items-center gap-6">
            <Link 
              to="/login"
              className="group w-full sm:w-auto px-10 py-5 bg-primary text-white rounded-2xl font-bold text-xl hover:shadow-[0_0_40px_rgba(255,107,0,0.5)] transition-all duration-300 transform hover:-translate-y-1 flex items-center justify-center gap-3"
            >
              <Rocket className="w-6 h-6" />
              ENTRAR NA FERRAMENTA
            </Link>
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-bold text-primary">Acesse o FluxoGuard agora</span>
              <span className="text-xs text-muted-foreground">Sistema de monitoramento em tempo real</span>
            </div>
          </div>

          <div className="pt-20 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Shield className="w-6 h-6 text-secondary shrink-0" />
                <BarChart3 className="w-3 h-3 text-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <span className="text-lg font-space font-bold tracking-tight">FluxoGuard</span>
            </div>
            
            <p className="text-xs text-muted-foreground">© 2026 FluxoGuard. Todos os direitos reservados.</p>
            
            <div className="flex items-center gap-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
              <Link to="/login" className="hover:text-primary">Login Cliente</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
