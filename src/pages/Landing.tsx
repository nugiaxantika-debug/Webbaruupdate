import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, Smartphone, Zap, Shield, MessageCircle, ArrowRight, CheckCircle2, Mail, Phone } from "lucide-react";

export default function Landing() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const [webConfig, setWebConfig] = useState({
    title: "Jadibot Lasak",
    highlight: "vip",
    heroTitle: "Jadibot Lasakvip Tanpa Ribet",
    heroDesc: "Platform bot WhatsApp profesional. Kelola grup, buat stiker otomatis, mainkan mini games, hingga manfaatkan fitur AI langsung dari satu dashboard.",
    contactEmail: "nugiaxantika@gmail.com",
    contactPhone: "+6289692080379",
    favicon: "https://files.catbox.moe/k9fw2l.png",
    logo: "https://files.catbox.moe/k9fw2l.png",
    feature1Title: "Manajemen Grup",
    feature1Desc: "Atur pesan welcome, keluarkan anggota, anti-link, hingga anti-spam secara otomatis dan aman.",
    feature2Title: "Sticker Menu",
    feature2Desc: "Buat stiker, tingkatkan kualitas gambar (HD), buat stiker teks brat & bratvid, hingga smeme.",
    feature3Title: "Keamanan Ekstra",
    feature3Desc: "Proteksi nomor dari ban dengan delay otomatis, pairing code tanpa QR, dan privasi penuh.",
    pricingTitle: "Pilih Paket Sesuai Kebutuhan Anda",
    pricingDesc: "Mulai dari uji coba gratis hingga akses VIP tanpa batas.",
    plan1Name: "Pro Plan",
    plan1Price: "Gratis",
    plan1Duration: "Coba gratis selama 3 hari",
    plan1Features: "1 Nomor Bot WhatsApp\nUnintrusive Dashboard\nUnlimited Command\nSupport QR & Pairing Code",
    plan1ButtonText: "Mulai Uji Coba Gratis",
    plan1AutoDisconnect: true,
    plan1Days: 3,
    plan2Name: "Pro VIP",
    plan2Price: "Rp 50.000",
    plan2Duration: "Akses penuh bulanan",
    plan2Features: "Semua fitur Pro Plan\nServer Uptime 24/7 (Prioritas)\nAuto Delete Session\nAkses Fitur AI Lanjutan\nSupport Prioritas Khusus VIP",
    plan2ButtonText: "Berlangganan VIP",
    plan2AutoDisconnect: false,
    plan2Days: 30,
    dashTitle: "Jadibot LasakVip Dashboard",
    dashSubtitle: "Kelola bot WhatsApp Anda secara realtime, aman, dan 24 jam.",
    footerDesc: "Platform bot WhatsApp profesional. Layanan cepat, stabil, dan aman.",
    loginTitle: "Selamat Datang",
    loginSubtitle: "Masuk ke dasbor WabotPro Anda",
    loginEmailParam: "Email",
    loginEmailPlaceholder: "nama@email.com",
    loginPasswordParam: "Password",
    loginPasswordPlaceholder: "••••••••",
    loginButtonText: "Masuk",
    loginRegisterText: "Belum punya akun? Daftar",
    adEnabled: false,
    adMedia: "",
    adMediaType: "image",
    adLink: "",
    adCooldownDays: 1,
    floatingChatEnabled: false,
    floatingChatIcon: "",
    floatingChatText: "Chat",
    chatbotWelcomeMessage: "Halo! Ada yang bisa kami bantu? 👋",
    chatbotQuickReplies: []
  });

  const [showAd, setShowAd] = useState(false);
  const [adDismissed, setAdDismissed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'bot', content: string, isTemp?: boolean}[]>([]);
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentChannels, setPaymentChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"checkout" | "confirm">("checkout");
  const [checkoutData, setCheckoutData] = useState({
    name: "",
    email: "",
    phone: ""
  });
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const openPaymentModal = () => {
    setIsPaymentModalOpen(true);
    setCheckoutStep("checkout");
    setCheckoutData({ name: "", email: "", phone: "" });
    setScreenshotPreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/jpg", "image/webp"].includes(file.type)) {
      alert("Hanya format JPG, JPEG, PNG, dan WEBP yang diperbolehkan.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran file maksimal 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setScreenshotPreview(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutStep === "checkout") {
      window.open("https://link.dana.id/minta?full_url=https://qr.dana.id/v1/281012092026060434529470", "_blank");
      setCheckoutStep("confirm");
      return;
    }

    if (checkoutStep === "confirm") {
      if (!screenshotPreview) {
        alert("Silakan upload screenshot bukti pembayaran.");
        return;
      }
      setIsCheckingOut(true);
      const apiBaseURL = import.meta.env.VITE_APP_URL || window.location.origin;
      try {
        const res = await fetch(`${apiBaseURL}/api/payment/dana/submit`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
              name: checkoutData.name,
              email: checkoutData.email,
              phone: checkoutData.phone,
              planName: webConfig.plan2Name,
              planPrice: webConfig.plan2Price,
              screenshot: screenshotPreview,
           })
        });
        const data = await res.json();
        if (data.success) {
           alert("Terima kasih! Bukti pembayaran berhasil dikirim dan sedang menunggu verifikasi admin.");
           setIsPaymentModalOpen(false);
        } else {
           alert("Gagal mengirim pembayaran: " + (data.message || data.error || "Unknown Error"));
        }
      } catch (err) {
        alert("Terjadi kesalahan sistem saat mengirim form konfirmasi.");
      } finally {
        setIsCheckingOut(false);
      }
    }
  };

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const toggleChat = () => {
      if (!isChatOpen && chatMessages.length === 0) {
          setChatMessages([{ role: 'bot', content: webConfig.chatbotWelcomeMessage || "Halo! Ada yang bisa kami bantu? 👋" }]);
          setShowQuickReplies(true);
      }
      setIsChatOpen(!isChatOpen);
  };

  const handleQuickReply = (qr: any) => {
      setShowQuickReplies(false);
      const userMessage = qr.text;
      
      const updatedMessages = [...chatMessages, { role: 'user' as const, content: userMessage }];
      setChatMessages(updatedMessages);
      setIsChatTyping(true);

      setTimeout(() => {
          setChatMessages(prev => [...prev, { 
              role: 'bot', 
              content: qr.reply || "Maaf, balasan belum diatur." 
          }]);
          setIsChatTyping(false);
          setTimeout(() => {
              setShowQuickReplies(true);
          }, 1000);
      }, 1000);
  };

  useEffect(() => {
      if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
  }, [chatMessages, isChatOpen]);

  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  useEffect(() => {
    const apiBaseURL = import.meta.env.VITE_APP_URL || window.location.origin;
    fetch(`${apiBaseURL}/api/config?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data.config && Object.keys(data.config).length > 0) {
          setWebConfig(prev => ({ ...prev, ...data.config }));
          if (data.config.adEnabled && data.config.adMedia && !adDismissed) {
             const cooldownDays = data.config.adCooldownDays !== undefined ? parseFloat(data.config.adCooldownDays) : 1;
             
             let shouldShow = true;
             if (cooldownDays > 0) {
                 const lastDismissed = localStorage.getItem('ad_dismissed_at');
                 if (lastDismissed) {
                     const dismissedAt = new Date(parseInt(lastDismissed, 10)).getTime();
                     const now = new Date().getTime();
                     const daysPassed = (now - dismissedAt) / (1000 * 60 * 60 * 24);
                     if (daysPassed < cooldownDays) {
                         shouldShow = false;
                     }
                 }
             }
             
             if (shouldShow) {
                setShowAd(true);
             }
          }
        }
        setIsConfigLoaded(true);
      })
      .catch(() => setIsConfigLoaded(true));
  }, []);

  useEffect(() => {
    if (!isConfigLoaded) return;
    if (webConfig.favicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = webConfig.favicon;
    }
    document.title = `${webConfig.title}${webConfig.highlight ? ' ' + webConfig.highlight : ''}`;
  }, [webConfig, isConfigLoaded]);

  useEffect(() => {
    const userEmail = localStorage.getItem("mock_user_email");
    if (userEmail) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      const endpoint = isRegisterMode ? "/api/auth/register" : "/api/auth/login";
      const apiBaseURL = import.meta.env.VITE_APP_URL || window.location.origin;
      const res = await fetch(`${apiBaseURL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Terjadi kesalahan.");
        return;
      }
      localStorage.setItem("mock_user_email", email);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan koneksi.");
    }
  };

  return (
    <div className={`min-h-screen font-sans ${isDarkMode ? "dark" : ""}`}>
      <div 
        className={`min-h-screen text-neutral-800 dark:text-neutral-200 transition-colors bg-cover bg-center bg-fixed ${(!webConfig.bgColor && !webConfig.bgImage) ? "bg-neutral-50 dark:bg-neutral-950" : ""}`}
        style={{
          backgroundColor: webConfig.bgColor || undefined,
          backgroundImage: webConfig.bgImage ? `url(${webConfig.bgImage})` : undefined
        }}
      >
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-40 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md border-b border-black/5 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {webConfig.logo ? (
              <img src={webConfig.logo} alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
            ) : (
              <div className="bg-emerald-500/20 p-2 rounded-xl">
                <Smartphone className="w-6 h-6 text-emerald-400" />
              </div>
            )}
            <span className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">{webConfig.title}<span className="text-emerald-400">{webConfig.highlight}</span></span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl bg-neutral-200 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="hidden sm:block bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-5 py-2 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Masuk
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8">
          <Zap className="w-4 h-4" />
          <span>V2.0 Tersedia Sekarang</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold text-neutral-900 dark:text-white tracking-tight mb-8 leading-tight max-w-4xl mx-auto">
          {webConfig.heroTitle}
        </h1>
        <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 mb-12 max-w-2xl mx-auto leading-relaxed">
          {webConfig.heroDesc}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {webConfig.heroButtonVisible !== false && (
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-neutral-900 dark:text-white px-8 py-4 rounded-full font-bold text-lg transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              Mulai Sekarang <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-neutral-100/50 dark:bg-neutral-900/50 border-y border-black/5 dark:border-white/5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-neutral-900 dark:text-white mb-16">Fitur Unggulan</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 p-8 rounded-3xl hover:border-emerald-500/30 transition-colors">
              <div className="bg-blue-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                <MessageCircle className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">{webConfig.feature1Title}</h3>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">{webConfig.feature1Desc}</p>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 p-8 rounded-3xl hover:border-emerald-500/30 transition-colors">
              <div className="bg-fuchsia-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                <Zap className="w-7 h-7 text-fuchsia-400" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">{webConfig.feature2Title}</h3>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">{webConfig.feature2Desc}</p>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 p-8 rounded-3xl hover:border-emerald-500/30 transition-colors">
              <div className="bg-amber-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                <Shield className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">{webConfig.feature3Title}</h3>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">{webConfig.feature3Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Cara Penggunaan */}
      {webConfig.howToUseVisible !== false && (
        <section className="py-24 max-w-7xl mx-auto px-6">
          <h2 className={`text-3xl font-bold text-neutral-900 dark:text-white mb-16 text-${webConfig.howToUseAlign || 'center'}`}>{webConfig.howToUseTitle || "Cara Penggunaan"}</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className={`text-${webConfig.howToUseAlign || 'center'}`}>
                <div className={`w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-2xl font-bold mb-6 ${webConfig.howToUseAlign === 'left' ? 'mr-auto' : webConfig.howToUseAlign === 'right' ? 'ml-auto' : 'mx-auto'}`}>
                  {step}
                </div>
                <h3 className="font-bold text-neutral-900 dark:text-white mb-2">
                  {webConfig[`howToUseStep${step}` as keyof typeof webConfig] || `Langkah ${step}`}
                </h3>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pricing / CTA */}
      <section className="py-24 max-w-7xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6">{webConfig.pricingTitle}</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-12 max-w-xl mx-auto">{webConfig.pricingDesc}</p>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
          {/* Free Tier */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-8 rounded-3xl">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">{webConfig.plan1Name}</h3>
                <p className="text-neutral-600 dark:text-neutral-400 mt-1">{webConfig.plan1Duration}</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-emerald-400">{webConfig.plan1Price}</span>
              </div>
            </div>
            <ul className="space-y-4 mb-8">
              {(webConfig.plan1Features || "").split('\n').filter(Boolean).map(item => (
                <li key={item} className="flex items-center gap-3 text-neutral-700 dark:text-neutral-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="w-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white py-4 rounded-xl font-bold hover:bg-neutral-700 transition-colors"
            >
              {webConfig.plan1ButtonText}
            </button>
          </div>

          {/* VIP Tier */}
          <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-amber-500/30 p-8 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-amber-500 text-neutral-950 text-xs font-bold px-3 py-1 rounded-bl-lg">POPULER</div>
            <div className="flex justify-between items-end mb-8">
              <div>
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">{webConfig.plan2Name}</h3>
                <p className="text-neutral-600 dark:text-neutral-400 mt-1">{webConfig.plan2Duration}</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-amber-400">{webConfig.plan2Price}</span>
              </div>
            </div>
            <ul className="space-y-4 mb-8">
              {(webConfig.plan2Features || "").split('\n').filter(Boolean).map(item => (
                <li key={item} className="flex items-center gap-3 text-neutral-700 dark:text-neutral-300">
                  <CheckCircle2 className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <button 
              onClick={openPaymentModal}
              className="w-full text-center block bg-amber-500 text-neutral-950 py-4 rounded-xl font-bold hover:bg-amber-600 transition-colors"
            >
              {webConfig.plan2ButtonText}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-3">
              {webConfig.logo ? (
                <img src={webConfig.logo} alt="Logo" className="w-8 h-8 object-contain rounded-lg" />
              ) : (
                <div className="bg-emerald-500/20 p-2 rounded-xl">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                </div>
              )}
              <span className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">{webConfig.title}<span className="text-emerald-400">{webConfig.highlight}</span></span>
            </div>
            <p className="text-xs text-neutral-500 max-w-xs text-center md:text-left">{webConfig.footerDesc}</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-6 text-sm text-neutral-600 dark:text-neutral-400">
            <a href={`mailto:${webConfig.contactEmail}`} className="hover:text-neutral-900 dark:text-white transition-colors flex items-center gap-2">
              <Mail className="w-4 h-4" /> {webConfig.contactEmail}
            </a>
            <a href={`https://wa.me/${webConfig.contactPhone.replace(/\D/g, '')}`} className="hover:text-neutral-900 dark:text-white transition-colors flex items-center gap-2">
              <Phone className="w-4 h-4" /> {webConfig.contactPhone}
            </a>
          </div>
          <div className="text-sm text-neutral-500 text-center md:text-right flex flex-col">
            <span>&copy; {new Date().getFullYear()} {webConfig.title}{webConfig.highlight}.</span>
            <span>All rights reserved.</span>
          </div>
        </div>
      </footer>

      {/* Floating Chat Bubble */}
      {webConfig.floatingChatEnabled && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
          {/* Chat Window */}
          {isChatOpen && (
            <div 
              style={{
                width: webConfig.chatBoxWidth ? `${webConfig.chatBoxWidth}px` : '350px',
                height: webConfig.chatBoxHeight ? `${webConfig.chatBoxHeight}px` : '450px',
              }}
              className="max-w-[calc(100vw-3rem)] max-h-[calc(100vh-8rem)] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              {/* Header */}
              <div className="bg-emerald-500 p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {webConfig.floatingChatIcon ? (
                     <img src={webConfig.floatingChatIcon} alt="Chat Icon" className="w-8 h-8 rounded-full object-cover bg-white" />
                  ) : (
                     <MessageCircle className="w-6 h-6" />
                  )}
                  <h3 className="font-semibold">{webConfig.floatingChatText || "Chat AI"}</h3>
                </div>
                <button onClick={toggleChat} className="text-white hover:text-white/80 transition" aria-label="Close chat">
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>
              
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50 dark:bg-neutral-950">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-emerald-500 text-white rounded-br-sm' : 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-bl-sm shadow-sm'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isChatTyping && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-bl-sm shadow-sm flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce delay-100"></div>
                      <div className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce delay-200"></div>
                      <div className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce delay-300"></div>
                    </div>
                  </div>
                )}
                {showQuickReplies && webConfig.chatbotQuickReplies && webConfig.chatbotQuickReplies.length > 0 && !isChatTyping && (
                  <div className="flex flex-col items-start gap-2 pt-2">
                    {webConfig.chatbotQuickReplies.map((qr: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickReply(qr)}
                        className="text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-neutral-700 px-4 py-2 rounded-2xl rounded-bl-sm transition text-left shadow-sm w-fit max-w-[80%]"
                      >
                        {qr.text}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* Toggle Button */}
          {!isChatOpen && (
            <button
              onClick={toggleChat}
              className="flex items-center gap-3 bg-emerald-50 dark:bg-neutral-800 p-3 pr-4 rounded-full shadow-lg border border-emerald-100 dark:border-neutral-700 hover:scale-105 transition-transform duration-200 group pointer-events-auto"
            >
              {webConfig.floatingChatIcon ? (
                <img src={webConfig.floatingChatIcon} alt="Chat Icon" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white relative">
                  <span className="absolute flex h-full w-full">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
                  </span>
                  <MessageCircle className="w-5 h-5" />
                </div>
              )}
              {webConfig.floatingChatText && (
                <span className="text-sm font-semibold text-emerald-800 dark:text-neutral-200">
                  {webConfig.floatingChatText}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {/* Auth Modal */}
      {/* Ad Modal */}
      {showAd && webConfig.adMedia && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative max-w-2xl w-full bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <button 
              onClick={() => { 
                  setShowAd(false); 
                  setAdDismissed(true); 
                  localStorage.setItem('ad_dismissed_at', new Date().getTime().toString());
              }}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"
            >
              &times;
            </button>
            <a 
               href={webConfig.adLink || "#"} 
               target={webConfig.adLink ? "_blank" : "_self"} 
               rel="noreferrer"
               className={webConfig.adLink ? "cursor-pointer" : "cursor-default pointer-events-none"}
               onClick={(e) => {
                 if (!webConfig.adLink) e.preventDefault();
               }}
            >
              {webConfig.adMediaType === 'video' ? (
                <video src={webConfig.adMedia} autoPlay loop muted playsInline className="w-full max-h-[80vh] object-contain bg-black" />
              ) : (
                <img src={webConfig.adMedia} alt="Promo" className="w-full max-h-[80vh] object-contain bg-black" />
              )}
            </a>
          </div>
        </div>
      )}

      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-500/80 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 relative">
            <button 
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-900 dark:text-white"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2 text-center">
              {isRegisterMode ? webConfig.registerTitle || "Buat Akun Baru" : webConfig.loginTitle || "Selamat Datang"}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 text-center mb-8 text-sm">
              {isRegisterMode ? webConfig.registerSubtitle || "Daftar untuk mengakses dasbor WabotPro" : webConfig.loginSubtitle || "Masuk ke dasbor WabotPro Anda"}
            </p>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm mb-6 flex flex-col gap-2">
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">
                  {isRegisterMode ? webConfig.registerEmailParam || "Email" : webConfig.loginEmailParam || "Email"}
                </label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder={isRegisterMode ? webConfig.registerEmailPlaceholder || "nama@email.com" : webConfig.loginEmailPlaceholder || "nama@email.com"}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">
                  {isRegisterMode ? webConfig.registerPasswordParam || "Password" : webConfig.loginPasswordParam || "Password"}
                </label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder={isRegisterMode ? webConfig.registerPasswordPlaceholder || "••••••••" : webConfig.loginPasswordPlaceholder || "••••••••"}
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold py-3 rounded-xl transition-colors mt-2"
              >
                {isRegisterMode ? webConfig.registerButtonText || "Daftar" : webConfig.loginButtonText || "Masuk"}
              </button>
            </form>

            <div className="text-center mt-6">
              <button 
                type="button"
                onClick={() => setIsRegisterMode(!isRegisterMode)}
                className="text-sm text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
              >
                {isRegisterMode ? webConfig.registerLoginText || "Sudah punya akun? Masuk" : webConfig.loginRegisterText || "Belum punya akun? Daftar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-500/80 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsPaymentModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-900 dark:text-white pb-2"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
              Checkout - {webConfig.plan2Name}
            </h2>
            <div className="flex justify-between items-center mb-6">
               <span className="text-neutral-600 dark:text-neutral-400 font-medium">Total Pembayaran</span>
               <span className="text-xl font-bold text-amber-500">{webConfig.plan2Price}</span>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              {checkoutStep === "checkout" ? (
                <>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 whitespace-pre-wrap leading-relaxed">
                    Deskripsi Paket:<br/>
                    {webConfig.plan2Features}
                  </p>
                  <button 
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold py-4 rounded-xl transition-colors mt-6 flex justify-center items-center gap-2"
                  >
                    Bayar Sekarang
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">Nama Pengguna</label>
                    <input 
                      type="text" 
                      required
                      value={checkoutData.name}
                      onChange={e => setCheckoutData({...checkoutData, name: e.target.value})}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                      placeholder="Nama Lengkap Anda"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">Email Akun (Login)</label>
                       <input 
                         type="email" 
                         required
                         value={checkoutData.email}
                         onChange={e => setCheckoutData({...checkoutData, email: e.target.value})}
                         className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                         placeholder="emailanda@gmail.com"
                       />
                     </div>
                     <div>
                       <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">Nomor WhatsApp</label>
                       <input 
                         type="text" 
                         required
                         value={checkoutData.phone}
                         onChange={e => setCheckoutData({...checkoutData, phone: e.target.value})}
                         className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                         placeholder="081234567890"
                       />
                     </div>
                  </div>
                  
                  <div>
                     <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">Paket Premium (Otomatis)</label>
                     <input 
                       type="text" 
                       readOnly
                       value={webConfig.plan2Name}
                       className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
                     />
                  </div>

                  <div>
                     <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">Upload Screenshot Bukti Pembayaran</label>
                     <input 
                       type="file" 
                       accept="image/jpeg, image/png, image/jpg, image/webp"
                       required
                       onChange={handleFileChange}
                       className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-500 file:text-neutral-900 hover:file:bg-amber-600"
                     />
                     <p className="text-xs text-neutral-500 mt-2">Format: JPG, JPEG, PNG, WEBP. Maks 5MB.</p>
                     {screenshotPreview && (
                       <img src={screenshotPreview} alt="Preview" className="mt-4 rounded-xl border border-neutral-200 dark:border-neutral-800 max-h-40 object-contain mx-auto" />
                     )}
                  </div>

                  <button 
                    type="submit"
                    disabled={isCheckingOut}
                    className="w-full bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-600 text-neutral-950 font-bold py-4 rounded-xl transition-colors mt-6"
                  >
                    {isCheckingOut ? "Mengirim..." : "Kirim Konfirmasi Pembayaran"}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
