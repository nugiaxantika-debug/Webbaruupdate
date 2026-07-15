import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import { Activity, Power, RefreshCw, Trash2, Smartphone, ShieldCheck, FileText, Users, Gamepad2, Settings, Clock, LogOut, MoreVertical, X, MessageCircle, Video, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

type BotStatus = "disconnected" | "connecting" | "connected";

interface StatusPayload {
  status: BotStatus;
  qr: string | null;
  uptime?: number | null;
}

interface LogEntry {
  time: string;
  message: string;
}

export default function Dashboard() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<BotStatus>("disconnected");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [massAddGroupId, setMassAddGroupId] = useState("");
  const [massAddNumbers, setMassAddNumbers] = useState("");
  const [groups, setGroups] = useState<{id: string, name: string}[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [uptime, setUptime] = useState<number | null>(null);
  const [disconnectNotice, setDisconnectNotice] = useState<string | null>(null);
  const navigate = useNavigate();

  const currentUserEmail = localStorage.getItem("mock_user_email");
  const isAdmin = currentUserEmail === "nugiaxantika@gmail.com" || currentUserEmail === "jujqkqpenolimako@gmail.com";

  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [totalBots, setTotalBots] = useState<number>(0);
  const [activeBotsInfo, setActiveBotsInfo] = useState<any[]>([]);
  const [adminDeleting, setAdminDeleting] = useState<string | null>(null);

  const fetchAdminData = () => {
    if (isAdmin) {
      const apiBaseURL = import.meta.env.VITE_APP_URL || window.location.origin;
      fetch(`${apiBaseURL}/api/users/count`)
        .then(res => res.json())
        .then(data => setTotalUsers(data.count || 0))
        .catch(err => console.error(err));
      
      fetch(`${apiBaseURL}/api/bots/active`)
        .then(res => res.json())
        .then(data => {
           setTotalBots(data.count || 0);
           setActiveBotsInfo(data.bots || []);
        })
        .catch(err => console.error(err));
        
      fetch(`${apiBaseURL}/api/admin/payments`, {
        headers: { "x-user-email": currentUserEmail || "default" }
      })
        .then(res => res.json())
        .then(data => {
           if (data.success && data.payments) {
               setPayments(data.payments);
           }
        })
        .catch(err => console.error(err));
    }
  };

  const [activeAdminTab, setActiveAdminTab] = useState<"dashboard" | "payments">("dashboard");
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    // Only run admin-related effects here if necessary, or just leave it empty.
  }, [isAdmin, currentUserEmail]);
  
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);

  const handlePaymentAction = async (txId: string, action: "accept" | "reject", reason?: string) => {
     try {
       const apiBaseURL = import.meta.env.VITE_APP_URL || window.location.origin;
       const res = await fetch(`${apiBaseURL}/api/admin/payments/action`, {
          method: "POST",
          headers: { 
             "Content-Type": "application/json",
             "x-user-email": currentUserEmail || "default"
          },
          body: JSON.stringify({ txId, action, reason })
       });
       if (res.ok) {
           fetchAdminData();
           setSelectedPayment(null);
       } else {
           alert("Gagal merubah status pembayaran");
       }
     } catch (err) {
       console.error(err);
     }
  };

  useEffect(() => {
    fetchAdminData();
  }, [isAdmin]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState({ 
    name: "", 
    photo: "", 
    registeredAt: 0,
    premiumStatus: false,
    premiumPlan: "",
    premiumStart: "",
    premiumEnd: ""
  });
  const [userPayments, setUserPayments] = useState<any[]>([]);

  useEffect(() => {
    if (currentUserEmail && !isAdmin) {
      const apiBaseURL = import.meta.env.VITE_APP_URL || window.location.origin;
      fetch(`${apiBaseURL}/api/user/payments`, {
        headers: { "x-user-email": currentUserEmail }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.payments) setUserPayments(data.payments);
      })
      .catch(console.error);
    }
  }, [currentUserEmail, isAdmin]);

  const [activeUserTab, setActiveUserTab] = useState<"dashboard" | "history">("dashboard");
  const [profileUpdateStatus, setProfileUpdateStatus] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (currentUserEmail) {
      const apiBaseURL = import.meta.env.VITE_APP_URL || window.location.origin;
      fetch(`${apiBaseURL}/api/user/profile`, {
        headers: { "x-user-email": currentUserEmail }
      })
      .then(res => res.json())
      .then(data => {
        if (!data.error) setUserProfile({ 
          name: data.name || "", 
          photo: data.photo || "", 
          registeredAt: data.registeredAt || 0,
          premiumStatus: data.premiumStatus || false,
          premiumPlan: data.premiumPlan || "",
          premiumStart: data.premiumStart || "",
          premiumEnd: data.premiumEnd || ""
        });
      })
      .catch(console.error);
    }
  }, [currentUserEmail]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const apiBaseURL = import.meta.env.VITE_APP_URL || window.location.origin;
      const res = await fetch(`${apiBaseURL}/api/user/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": currentUserEmail || "default" },
        body: JSON.stringify(userProfile)
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      setProfileUpdateStatus("Profil berhasil disimpan!");
      setIsProfileOpen(false);
      setTimeout(() => setProfileUpdateStatus(null), 3000);
    } catch (err) {
       console.error(err);
       setProfileUpdateStatus("Gagal menyimpan profil.");
       setTimeout(() => setProfileUpdateStatus(null), 3000);
    }
  };

  const handleProfilePicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUserProfile({ ...userProfile, photo: event.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const [webConfig, setWebConfig] = useState({
    title: "Jadibot Lasak",
    highlight: "Vip",
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
    registerTitle: "Buat Akun Baru",
    registerSubtitle: "Daftar untuk mengakses dasbor WabotPro",
    registerEmailParam: "Email",
    registerEmailPlaceholder: "nama@email.com",
    registerPasswordParam: "Password",
    registerPasswordPlaceholder: "••••••••",
    registerButtonText: "Daftar",
    registerLoginText: "Sudah punya akun? Masuk",
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

  useEffect(() => {
    const apiBaseURL = import.meta.env.VITE_APP_URL || window.location.origin;
    fetch(`${apiBaseURL}/api/config?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data.config && Object.keys(data.config).length > 0) {
          setWebConfig(prev => ({ ...prev, ...data.config }));
        }
      })
      .catch(console.error);
  }, []);

  const apiCall = async (endpoint: string, body?: any) => {
    try {
      const res = await fetch(`/api/whatsapp/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUserEmail || "default"
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await res.json();
    } catch (err) {
      console.error(`Error calling ${endpoint}:`, err);
    }
  };

  // Simulate auto-disconnect logic based on registeredAt
  useEffect(() => {
    if (!isAdmin && userProfile.registeredAt > 0) {
      const autoDisc = webConfig.plan1AutoDisconnect;
      const days = webConfig.plan1Days;
      
      if (autoDisc && days > 0) {
        const expiresAt = userProfile.registeredAt + (days * 24 * 60 * 60 * 1000);
        if (Date.now() > expiresAt) {
          setIsExpired(true);
          setDisconnectNotice(`Akses Dashboard Ditutup: Masa aktif paket Anda (${days} hari) telah habis. Silakan perpanjang.`);
          if (status === "connected" || status === "connecting") {
            apiCall("stop");
            setLogs(prev => [...prev, { time: new Date().toISOString(), message: `[Sistem] Koneksi dihentikan.`}]);
          }
        } else {
          setIsExpired(false);
          // if previously noticed, reset notice?
          // setDisconnectNotice(null);
        }
      } else {
        setIsExpired(false);
      }
    }
  }, [status, webConfig, userProfile.registeredAt, isAdmin]);

  useEffect(() => {
    if (status === "connected") {
      fetchGroups();
    }
  }, [status]);

  const fetchGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const apiBaseURL = import.meta.env.VITE_APP_URL || window.location.origin;
      const res = await fetch(`${apiBaseURL}/api/whatsapp/groups`, {
        headers: { "x-user-email": currentUserEmail || "default" }
      });
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups || []);
        if (data.groups && data.groups.length > 0 && !massAddGroupId) {
          setMassAddGroupId(data.groups[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch groups", e);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  useEffect(() => {
    let tickInterval = setInterval(() => {
      setUptime(prev => prev !== null ? prev + 1000 : null);
    }, 1000);
    return () => clearInterval(tickInterval);
  }, []);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const newSocket = io(socketUrl, { 
      path: "/socket.io",
      query: { userEmail: currentUserEmail || "default" }
    });

    newSocket.on("connect", () => {
      console.log("Connected to WebSocket Server");
    });

    newSocket.on("status", (data: StatusPayload) => {
      setStatus(data.status);
      setQrCode(data.qr);
      if (data.status === "connected") {
        setPairingCode(null);
      }
      setUptime(data.uptime ?? null);
    });

    newSocket.on("qr", (qr: string) => {
      setQrCode(qr);
      setPairingCode(null);
    });

    newSocket.on("pairing_code", (code: string) => {
      setPairingCode(code);
      setQrCode(null);
    });

    newSocket.on("log", (log: LogEntry) => {
      setLogs((prev) => [...prev, log].slice(-100)); // Keep last 100 logs
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleStart = () => {
    setLogs((prev) => [...prev, { time: new Date().toISOString(), message: "Initiating Start..." }]);
    apiCall("start", { phoneNumber: phoneNumber.replace(/\D/g, '') || undefined });
  };

  const handleStop = () => apiCall("stop");
  const handleRestart = () => apiCall("restart");
  const handleDeleteSession = () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      setTimeout(() => setIsConfirmingDelete(false), 5000);
      return;
    }
    setIsConfirmingDelete(false);
    apiCall("delete-session");
  };

  const handleAdminDeleteSession = async (targetEmail: string) => {
    if (!window.confirm(`Yakin ingin memutus sesi bot untuk ${targetEmail}?`)) return;
    setAdminDeleting(targetEmail);
    try {
      const apiBaseURL = import.meta.env.VITE_APP_URL || window.location.origin;
      const res = await fetch(`${apiBaseURL}/api/admin/delete-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUserEmail || "default"
        },
        body: JSON.stringify({ targetEmail })
      });
      if (res.ok) {
        setLogs(prev => [...prev, { time: new Date().toISOString(), message: `Admin deleted session for ${targetEmail}` }]);
        fetchAdminData();
      } else {
        alert("Gagal memutus sesi");
      }
    } catch (err) {
      console.error(err);
      alert("Error memutus sesi");
    } finally {
      setAdminDeleting(null);
    }
  };

  const handleMassAdd = () => {
    let gid = massAddGroupId.trim();
    if (gid.includes("chat.whatsapp.com/")) {
      alert("Note: Menambahkan anggota massal via link invite belum disupport langsung. Masukkan Group ID yang valid (berakhiran @g.us).");
      return;
    }
    const numbersList = massAddNumbers.split(/[\n,]+/).map(n => n.trim()).filter(n => n);
    if (!gid || numbersList.length === 0) return;
    
    setLogs((prev) => [...prev, { time: new Date().toISOString(), message: `Initiating mass add tags to ${gid}...` }]);
    apiCall("mass-add-members", { groupId: gid, numbers: numbersList }).then(res => {
       if (res?.error) {
           setLogs((prev) => [...prev, { time: new Date().toISOString(), message: `Error: ${res.error}` }]);
       } else {
           setLogs((prev) => [...prev, { time: new Date().toISOString(), message: `Success: ${res.message}` }]);
           setMassAddNumbers(""); 
       }
    });
  };

  const formatUptime = (ms: number | null) => {
    if (ms === null) return "0s";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    
    return parts.join(' ');
  };

  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleSaveSettings = async () => {
    try {
      setSaveStatus("Menyimpan...");
      const apiBaseURL = import.meta.env.VITE_APP_URL || window.location.origin;
      const res = await fetch(`${apiBaseURL}/api/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: webConfig })
      });
      if (!res.ok) {
        throw new Error('Gagal menyimpan pengaturan');
      }
      setIsSettingsOpen(false);
      setSaveStatus(null);
    } catch (err) {
      console.error(err);
      setSaveStatus("Gagal menyimpan. Coba lagi.");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setWebConfig(prev => ({ ...prev, [key]: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans p-4 md:p-8">
      {/* Settings Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" /> Edit Profil
              </h2>
              <button 
                onClick={() => setIsProfileOpen(false)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleProfileSave} className="p-6 space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  {userProfile.photo ? (
                    <img src={userProfile.photo} className="w-24 h-24 rounded-full object-cover border-4 border-neutral-800" alt="Profile" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-3xl border-4 border-neutral-800">
                      {(userProfile.name || currentUserEmail || "U")[0].toUpperCase()}
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-full cursor-pointer transition-colors shadow-lg">
                    <Smartphone className="w-4 h-4 hidden" /> {/* Hidden icon to trick Tailwind classes, we'll just use a generic upload style */}
                    <div className="text-xs font-bold leading-none">+</div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleProfilePicUpload} />
                  </label>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Nama Tampilan</label>
                <input 
                  type="text" 
                  value={userProfile.name}
                  onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Nama Anda"
                />
              </div>

              {profileUpdateStatus && (
                <div className={`p-3 rounded-lg text-sm text-center ${profileUpdateStatus.includes("Gagal") ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                  {profileUpdateStatus}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors"
                >
                  Simpan Profil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300 relative">
            <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900 rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" /> Detail Pembayaran
              </h2>
              <button 
                onClick={() => setSelectedPayment(null)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <p className="text-xs text-neutral-400">ID Transaksi</p>
                   <p className="text-sm font-mono text-white mt-1">{selectedPayment.txId}</p>
                 </div>
                 <div>
                   <p className="text-xs text-neutral-400">Status</p>
                   <p className="text-sm text-white mt-1">{selectedPayment.status}</p>
                 </div>
                 <div>
                   <p className="text-xs text-neutral-400">Email Akun</p>
                   <p className="text-sm text-white mt-1">{selectedPayment.email}</p>
                 </div>
                 <div>
                   <p className="text-xs text-neutral-400">No. WhatsApp</p>
                   <p className="text-sm text-white mt-1">{selectedPayment.phone}</p>
                 </div>
                 <div>
                   <p className="text-xs text-neutral-400">Paket</p>
                   <p className="text-sm text-white mt-1">{selectedPayment.planName} ({selectedPayment.planPrice})</p>
                 </div>
                 <div>
                   <p className="text-xs text-neutral-400">Tanggal Upload</p>
                   <p className="text-sm text-white mt-1">{new Date(selectedPayment.createdAt).toLocaleString()}</p>
                 </div>
              </div>

              <div>
                <p className="text-xs text-neutral-400 mb-2">Screenshot Bukti Pembayaran</p>
                <img src={selectedPayment.screenshot} alt="Screenshot" className="rounded-xl border border-neutral-800 w-full object-contain max-h-64 bg-black/50" />
              </div>

              {selectedPayment.status === "Menunggu Verifikasi" && (
                <div className="pt-4 border-t border-neutral-800 space-y-3">
                   <div className="flex gap-3">
                     <button 
                       onClick={() => handlePaymentAction(selectedPayment.txId, "accept")}
                       className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold py-2.5 rounded-xl transition-colors"
                     >
                       Terima (Approve)
                     </button>
                     <button 
                       onClick={() => {
                          const reason = prompt("Masukkan alasan penolakan:");
                          if (reason !== null) {
                             handlePaymentAction(selectedPayment.txId, "reject", reason);
                          }
                       }}
                       className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 rounded-xl transition-colors"
                     >
                       Tolak (Reject)
                     </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300 relative">
            <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900 rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" /> Pengaturan Website
              </h2>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
              {/* Maintenance Mode */}
              <div className="space-y-4 bg-rose-500/5 p-4 rounded-xl border border-rose-500/20">
                <div className="flex items-center justify-between border-b border-rose-500/20 pb-4 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider">Mode Maintenance</h3>
                    <p className="text-xs text-neutral-400 mt-1">Aktifkan untuk menampilkan halaman maintenance ke seluruh pengguna non-admin.</p>
                  </div>
                  <button
                    onClick={() => setWebConfig({...webConfig, maintenanceMode: !webConfig.maintenanceMode})}
                    className={`w-12 h-6 rounded-full transition-colors relative ${webConfig.maintenanceMode ? 'bg-rose-500' : 'bg-neutral-700'}`}
                  >
                    <span className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white transition-all ${webConfig.maintenanceMode ? 'left-[calc(100%-18px)]' : 'left-[2px]'}`}></span>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Pesan Maintenance</label>
                    <textarea
                      value={webConfig.maintenanceMessage || ""}
                      onChange={(e) => setWebConfig({...webConfig, maintenanceMessage: e.target.value})}
                      rows={3}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-rose-500 resize-none"
                      placeholder="Contoh: Sistem sedang dalam perbaikan..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">URL Gambar Kustom (Opsional)</label>
                    <input
                      type="text"
                      value={webConfig.maintenanceImage || ""}
                      onChange={(e) => setWebConfig({...webConfig, maintenanceImage: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-rose-500"
                      placeholder="https://example.com/image.png"
                    />
                    {webConfig.maintenanceImage && (
                      <div className="mt-2 border border-neutral-800 rounded-lg overflow-hidden max-w-[150px]">
                        <img src={webConfig.maintenanceImage} alt="Preview" className="w-full h-auto object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Media & Brand */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Identitas Brand</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Judul Dashboard</label>
                    <input 
                      type="text" 
                      value={webConfig.dashTitle}
                      onChange={(e) => setWebConfig({...webConfig, dashTitle: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 mb-2"
                      placeholder="WhatsApp Bot Dashboard"
                    />
                    <input 
                      type="text" 
                      value={webConfig.dashSubtitle}
                      onChange={(e) => setWebConfig({...webConfig, dashSubtitle: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                      placeholder="Deskripsi dashboard"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Judul Profil (Wabot)</label>
                    <input 
                      type="text" 
                      value={webConfig.title}
                      onChange={(e) => setWebConfig({...webConfig, title: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Highlight Profil (Pro)</label>
                    <input 
                      type="text" 
                      value={webConfig.highlight}
                      onChange={(e) => setWebConfig({...webConfig, highlight: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Upload Favicon (.ico/.png)</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, "favicon")}
                      className="w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-500/20 file:text-indigo-400 hover:file:bg-indigo-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Upload Logo (.png/.jpg)</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, "logo")}
                      className="w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500/30"
                    />
                  </div>
                </div>
              </div>

              {/* Beranda (Hero) */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Bagian Beranda (Hero)</h3>
                <div>
                  <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Judul Utama</label>
                  <input 
                    type="text" 
                    value={webConfig.heroTitle}
                    onChange={(e) => setWebConfig({...webConfig, heroTitle: e.target.value})}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Deskripsi Beranda</label>
                  <textarea 
                    rows={3}
                    value={webConfig.heroDesc}
                    onChange={(e) => setWebConfig({...webConfig, heroDesc: e.target.value})}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
                <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 p-4 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-white">Tampilkan Tombol Mulai Sekarang</p>
                    <p className="text-xs text-neutral-500">Tombol di halaman utama ("Mulai Sekarang")</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={webConfig.heroButtonVisible !== false}
                      onChange={(e) => setWebConfig({...webConfig, heroButtonVisible: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>

              {/* Latar Belakang */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Latar Belakang Website</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Gambar Latar (URL/Upload)</label>
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         value={webConfig.bgImage || ""}
                         onChange={(e) => setWebConfig({...webConfig, bgImage: e.target.value})}
                         className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                         placeholder="https://..."
                       />
                       <label className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded-xl cursor-pointer flex items-center justify-center transition-colors text-sm">
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  if (event.target?.result) {
                                    setWebConfig({...webConfig, bgImage: event.target.result as string});
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          Upload
                       </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Warna Tema Latar</label>
                    <div className="flex items-center gap-3">
                       <input 
                         type="color" 
                         value={webConfig.bgColor || "#ffffff"}
                         onChange={(e) => setWebConfig({...webConfig, bgColor: e.target.value})}
                         className="w-10 h-10 rounded cursor-pointer bg-neutral-950 border border-neutral-800"
                       />
                       <button 
                          onClick={() => setWebConfig({...webConfig, bgColor: ""})} 
                          className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                       >
                         Reset ke Default
                       </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pengaturan Iklan (Landing Page) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Pengaturan Iklan (Landing Page)</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <span className="text-xs text-neutral-400 mr-2">Aktifkan Iklan</span>
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={webConfig.adEnabled === true}
                      onChange={(e) => setWebConfig({...webConfig, adEnabled: e.target.checked})}
                    />
                    <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                {webConfig.adEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                       <label className="text-sm font-medium text-neutral-400 mb-1.5 block">File Iklan Gambar/Video (URL / Upload)</label>
                       <div className="flex gap-2">
                         <input 
                           type="text" 
                           value={webConfig.adMedia || ""}
                           onChange={(e) => setWebConfig({...webConfig, adMedia: e.target.value})}
                           className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                           placeholder="https://... atau upload file"
                         />
                         <label className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded-xl cursor-pointer flex items-center justify-center transition-colors text-sm whitespace-nowrap">
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*,video/*" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    if (event.target?.result) {
                                      setWebConfig({...webConfig, adMedia: event.target.result as string, adMediaType: file.type.startsWith('video/') ? 'video' : 'image'});
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            Upload
                         </label>
                       </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Tipe Media Iklan</label>
                      <select
                        value={webConfig.adMediaType || "image"}
                        onChange={(e) => setWebConfig({...webConfig, adMediaType: e.target.value})}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="image">Gambar</option>
                        <option value="video">Video</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Link Tujuan (Opsional)</label>
                      <input 
                        type="text" 
                        value={webConfig.adLink || ""}
                        onChange={(e) => setWebConfig({...webConfig, adLink: e.target.value})}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Durasi Muncul (Hari)</label>
                      <input 
                        type="number" 
                        min="0"
                        value={webConfig.adCooldownDays !== undefined ? webConfig.adCooldownDays : 1}
                        onChange={(e) => setWebConfig({...webConfig, adCooldownDays: parseFloat(e.target.value) || 0})}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                        placeholder="1"
                      />
                      <p className="text-xs text-neutral-500 mt-1">Isi 0 jika ingin selalu muncul. Jika 1, iklan tidak muncul selama 1 hari setelah ditutup.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Cara Penggunaan */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Cara Penggunaan</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <span className="text-xs text-neutral-400 mr-2">Tampilkan</span>
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={webConfig.howToUseVisible !== false}
                      onChange={(e) => setWebConfig({...webConfig, howToUseVisible: e.target.checked})}
                    />
                    <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-400 mb-1 block">Judul Section</label>
                    <input 
                      type="text" 
                      value={webConfig.howToUseTitle || ""}
                      onChange={(e) => setWebConfig({...webConfig, howToUseTitle: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                      placeholder="Cara Penggunaan"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-400 mb-1 block">Posisi Teks (Align)</label>
                    <select
                      value={webConfig.howToUseAlign || "center"}
                      onChange={(e) => setWebConfig({...webConfig, howToUseAlign: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="left">Kiri</option>
                      <option value="center">Tengah</option>
                      <option value="right">Kanan</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-400 mb-1 block">Langkah 1</label>
                    <input 
                      type="text" 
                      value={webConfig.howToUseStep1 || ""}
                      onChange={(e) => setWebConfig({...webConfig, howToUseStep1: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-400 mb-1 block">Langkah 2</label>
                    <input 
                      type="text" 
                      value={webConfig.howToUseStep2 || ""}
                      onChange={(e) => setWebConfig({...webConfig, howToUseStep2: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-400 mb-1 block">Langkah 3</label>
                    <input 
                      type="text" 
                      value={webConfig.howToUseStep3 || ""}
                      onChange={(e) => setWebConfig({...webConfig, howToUseStep3: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-400 mb-1 block">Langkah 4</label>
                    <input 
                      type="text" 
                      value={webConfig.howToUseStep4 || ""}
                      onChange={(e) => setWebConfig({...webConfig, howToUseStep4: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Fitur 1 */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Fitur 1</h3>
                <div>
                  <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Judul Fitur 1</label>
                  <input type="text" value={webConfig.feature1Title} onChange={(e) => setWebConfig({...webConfig, feature1Title: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Deskripsi Fitur 1</label>
                  <textarea rows={2} value={webConfig.feature1Desc} onChange={(e) => setWebConfig({...webConfig, feature1Desc: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none" />
                </div>
              </div>

              {/* Fitur 2 */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Fitur 2</h3>
                <div>
                  <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Judul Fitur 2</label>
                  <input type="text" value={webConfig.feature2Title} onChange={(e) => setWebConfig({...webConfig, feature2Title: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Deskripsi Fitur 2</label>
                  <textarea rows={2} value={webConfig.feature2Desc} onChange={(e) => setWebConfig({...webConfig, feature2Desc: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none" />
                </div>
              </div>

              {/* Fitur 3 */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Fitur 3</h3>
                <div>
                  <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Judul Fitur 3</label>
                  <input type="text" value={webConfig.feature3Title} onChange={(e) => setWebConfig({...webConfig, feature3Title: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Deskripsi Fitur 3</label>
                  <textarea rows={2} value={webConfig.feature3Desc} onChange={(e) => setWebConfig({...webConfig, feature3Desc: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none" />
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Bagian Harga & Paket</h3>
                <div>
                  <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Judul Bagian Harga</label>
                  <input type="text" value={webConfig.pricingTitle} onChange={(e) => setWebConfig({...webConfig, pricingTitle: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Deskripsi Harga</label>
                  <input type="text" value={webConfig.pricingDesc} onChange={(e) => setWebConfig({...webConfig, pricingDesc: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Paket 1 (Free)</label>
                    <input type="text" value={webConfig.plan1Name} onChange={(e) => setWebConfig({...webConfig, plan1Name: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 mb-2" placeholder="Nama Paket" />
                    <input type="text" value={webConfig.plan1Price} onChange={(e) => setWebConfig({...webConfig, plan1Price: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 mb-2" placeholder="Harga" />
                    <input type="text" value={webConfig.plan1Duration} onChange={(e) => setWebConfig({...webConfig, plan1Duration: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 mb-2" placeholder="Durasi/Keterangan" />
                    <textarea rows={3} value={webConfig.plan1Features} onChange={(e) => setWebConfig({...webConfig, plan1Features: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 mb-2 resize-none" placeholder="Fitur Poin per baris" />
                    <input type="text" value={webConfig.plan1ButtonText} onChange={(e) => setWebConfig({...webConfig, plan1ButtonText: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 mb-2" placeholder="Teks Tombol CTA" />
                    <div className="flex items-center gap-2 mb-2">
                       <input type="checkbox" checked={webConfig.plan1AutoDisconnect} onChange={(e) => setWebConfig({...webConfig, plan1AutoDisconnect: e.target.checked})} className="w-4 h-4 text-indigo-500 bg-neutral-950 border-neutral-800 focus:ring-indigo-500" />
                       <span className="text-sm text-neutral-400">Otomatis Disconnect Bot</span>
                    </div>
                    {webConfig.plan1AutoDisconnect && (
                       <input type="number" value={webConfig.plan1Days} onChange={(e) => setWebConfig({...webConfig, plan1Days: parseInt(e.target.value) || 0})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="Jumlah Hari Aktif" />
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Paket 2 (VIP)</label>
                    <input type="text" value={webConfig.plan2Name} onChange={(e) => setWebConfig({...webConfig, plan2Name: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 mb-2" placeholder="Nama Paket" />
                    <input type="text" value={webConfig.plan2Price} onChange={(e) => setWebConfig({...webConfig, plan2Price: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 mb-2" placeholder="Harga" />
                    <input type="text" value={webConfig.plan2Duration} onChange={(e) => setWebConfig({...webConfig, plan2Duration: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 mb-2" placeholder="Durasi/Keterangan" />
                    <textarea rows={3} value={webConfig.plan2Features} onChange={(e) => setWebConfig({...webConfig, plan2Features: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 mb-2 resize-none" placeholder="Fitur Poin per baris" />
                    <input type="text" value={webConfig.plan2ButtonText} onChange={(e) => setWebConfig({...webConfig, plan2ButtonText: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 mb-2" placeholder="Teks Tombol CTA" />
                    <div className="flex items-center gap-2 mb-2">
                       <input type="checkbox" checked={webConfig.plan2AutoDisconnect} onChange={(e) => setWebConfig({...webConfig, plan2AutoDisconnect: e.target.checked})} className="w-4 h-4 text-indigo-500 bg-neutral-950 border-neutral-800 focus:ring-indigo-500" />
                       <span className="text-sm text-neutral-400">Otomatis Disconnect Bot</span>
                    </div>
                    {webConfig.plan2AutoDisconnect && (
                       <input type="number" value={webConfig.plan2Days} onChange={(e) => setWebConfig({...webConfig, plan2Days: parseInt(e.target.value) || 0})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="Jumlah Hari Aktif" />
                    )}
                  </div>
                </div>
              </div>

              {/* Balon Obrolan (Floating Chat) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Balon Obrolan (Pojok Kanan Bawah)</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <span className="text-xs text-neutral-400 mr-2">Tampilkan</span>
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={webConfig.floatingChatEnabled === true}
                      onChange={(e) => setWebConfig({...webConfig, floatingChatEnabled: e.target.checked})}
                    />
                    <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                {webConfig.floatingChatEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                       <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Icon/Logo (URL atau Upload)</label>
                       <div className="flex gap-2">
                         <input 
                           type="text" 
                           value={webConfig.floatingChatIcon || ""}
                           onChange={(e) => setWebConfig({...webConfig, floatingChatIcon: e.target.value})}
                           className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                           placeholder="https://..."
                         />
                         <label className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded-xl cursor-pointer flex items-center justify-center transition-colors text-sm whitespace-nowrap">
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    if (event.target?.result) {
                                      setWebConfig({...webConfig, floatingChatIcon: event.target.result as string});
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            Upload
                         </label>
                       </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Teks Tombol Chat</label>
                      <input 
                        type="text" 
                        value={webConfig.floatingChatText || "Hubungi Kami"}
                        onChange={(e) => setWebConfig({...webConfig, floatingChatText: e.target.value})}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Lebar Kotak Chat (px) - Opsional</label>
                      <input 
                        type="number" 
                        value={webConfig.chatBoxWidth || 350}
                        onChange={(e) => setWebConfig({...webConfig, chatBoxWidth: parseInt(e.target.value) || 350})}
                        placeholder="350"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Tinggi Kotak Chat (px) - Opsional</label>
                      <input 
                        type="number" 
                        value={webConfig.chatBoxHeight || 450}
                        onChange={(e) => setWebConfig({...webConfig, chatBoxHeight: parseInt(e.target.value) || 450})}
                        placeholder="450"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                       <div className="flex justify-between items-center mb-1.5">
                         <label className="text-sm font-medium text-neutral-400 block">Tombol Quick Reply (Tanya Jawab Cepat)</label>
                         <button 
                           onClick={() => setWebConfig({...webConfig, chatbotQuickReplies: [...(webConfig.chatbotQuickReplies || []), { text: '', reply: '' }]})}
                           className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded hover:bg-indigo-500/30"
                         >
                           + Tambah
                         </button>
                       </div>
                       {(webConfig.chatbotQuickReplies || []).map((qr: any, idx: number) => (
                         <div key={idx} className="flex gap-2 mb-2">
                           <div className="flex-1 space-y-2">
                             <input 
                               type="text" 
                               value={qr.text}
                               onChange={(e) => {
                                 const newQRs = [...webConfig.chatbotQuickReplies];
                                 newQRs[idx].text = e.target.value;
                                 setWebConfig({...webConfig, chatbotQuickReplies: newQRs});
                               }}
                               placeholder="Teks Tombol (Misal: Harga?)"
                               className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
                             />
                             <textarea 
                               value={qr.reply}
                               onChange={(e) => {
                                 const newQRs = [...webConfig.chatbotQuickReplies];
                                 newQRs[idx].reply = e.target.value;
                                 setWebConfig({...webConfig, chatbotQuickReplies: newQRs});
                               }}
                               placeholder="Teks Balasan Otomatis"
                               rows={2}
                               className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none resize-none"
                             />
                           </div>
                           <button 
                             onClick={() => {
                               const newQRs = [...webConfig.chatbotQuickReplies];
                               newQRs.splice(idx, 1);
                               setWebConfig({...webConfig, chatbotQuickReplies: newQRs});
                             }}
                             className="bg-red-500/10 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-500/20 h-fit"
                           >
                             Hapus
                           </button>
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Teks Halaman Login/Register</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Judul Halaman (Login)</label>
                    <input type="text" value={webConfig.loginTitle} onChange={(e) => setWebConfig({...webConfig, loginTitle: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Sub Judul</label>
                    <input type="text" value={webConfig.loginSubtitle} onChange={(e) => setWebConfig({...webConfig, loginSubtitle: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Label Email</label>
                    <input type="text" value={webConfig.loginEmailParam} onChange={(e) => setWebConfig({...webConfig, loginEmailParam: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Placeholder Email</label>
                    <input type="text" value={webConfig.loginEmailPlaceholder} onChange={(e) => setWebConfig({...webConfig, loginEmailPlaceholder: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Label Password</label>
                    <input type="text" value={webConfig.loginPasswordParam} onChange={(e) => setWebConfig({...webConfig, loginPasswordParam: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Placeholder Password</label>
                    <input type="text" value={webConfig.loginPasswordPlaceholder} onChange={(e) => setWebConfig({...webConfig, loginPasswordPlaceholder: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Teks Tombol Masuk</label>
                    <input type="text" value={webConfig.loginButtonText} onChange={(e) => setWebConfig({...webConfig, loginButtonText: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Teks Switch Belum Punya Akun</label>
                    <input type="text" value={webConfig.loginRegisterText} onChange={(e) => setWebConfig({...webConfig, loginRegisterText: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div className="col-span-2 mt-2">
                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Halaman Register</h4>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Judul Halaman (Register)</label>
                    <input type="text" value={webConfig.registerTitle} onChange={(e) => setWebConfig({...webConfig, registerTitle: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Sub Judul (Register)</label>
                    <input type="text" value={webConfig.registerSubtitle} onChange={(e) => setWebConfig({...webConfig, registerSubtitle: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Label Email (Register)</label>
                    <input type="text" value={webConfig.registerEmailParam} onChange={(e) => setWebConfig({...webConfig, registerEmailParam: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Placeholder Email (Register)</label>
                    <input type="text" value={webConfig.registerEmailPlaceholder} onChange={(e) => setWebConfig({...webConfig, registerEmailPlaceholder: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Label Password (Register)</label>
                    <input type="text" value={webConfig.registerPasswordParam} onChange={(e) => setWebConfig({...webConfig, registerPasswordParam: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Placeholder Password (Register)</label>
                    <input type="text" value={webConfig.registerPasswordPlaceholder} onChange={(e) => setWebConfig({...webConfig, registerPasswordPlaceholder: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Teks Tombol Daftar</label>
                    <input type="text" value={webConfig.registerButtonText} onChange={(e) => setWebConfig({...webConfig, registerButtonText: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Teks Switch Sudah Punya Akun</label>
                    <input type="text" value={webConfig.registerLoginText} onChange={(e) => setWebConfig({...webConfig, registerLoginText: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Bagian Footer</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Email Kontak</label>
                    <input 
                      type="email" 
                      value={webConfig.contactEmail}
                      onChange={(e) => setWebConfig({...webConfig, contactEmail: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Nomor Support</label>
                    <input 
                      type="text" 
                      value={webConfig.contactPhone}
                      onChange={(e) => setWebConfig({...webConfig, contactPhone: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-400 mb-1.5 block">Deskripsi Footer</label>
                  <textarea rows={2} value={webConfig.footerDesc} onChange={(e) => setWebConfig({...webConfig, footerDesc: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none" />
                </div>
              </div>

            </div>
            
            <div className="p-6 border-t border-neutral-800 bg-neutral-900 rounded-b-2xl">
              {saveStatus && <p className="text-sm font-medium text-amber-400 mb-3 text-center">{saveStatus}</p>}
              <button 
                onClick={handleSaveSettings}
                disabled={saveStatus === "Menyimpan..."}
                className="w-full bg-indigo-500 disabled:opacity-50 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-colors"
                >
                Simpan Semua Pengaturan
              </button>
            </div>
          </div>
        </div>
      )}

      {pairingCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-indigo-500/30 rounded-2xl p-8 shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-300">
            <div className="text-center">
              <div className="bg-indigo-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Kode Tautan WhatsApp Anda</h2>
              <p className="text-sm text-neutral-400 mb-6">Masukkan kode ini di aplikasi WhatsApp Anda untuk menautkan perangkat.</p>
              
              <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-xl mb-6">
                <h3 className="text-4xl font-mono tracking-[0.2em] font-bold text-indigo-400 select-all cursor-text">{pairingCode}</h3>
              </div>
              
              <ol className="text-left text-sm text-neutral-400 space-y-3 mb-6 px-4">
                <li className="flex gap-2"><span className="text-indigo-400 font-bold">1.</span> Buka WhatsApp di HP Anda</li>
                <li className="flex gap-2"><span className="text-indigo-400 font-bold">2.</span> Ketuk ikon titik tiga (⋮) atau Pengaturan</li>
                <li className="flex gap-2"><span className="text-indigo-400 font-bold">3.</span> Pilih <b>Perangkat Tertaut</b></li>
                <li className="flex gap-2"><span className="text-indigo-400 font-bold">4.</span> Ketuk <b>Tautkan dengan nomor telepon saja</b> di bawah qr code</li>
                <li className="flex gap-2"><span className="text-indigo-400 font-bold">5.</span> Masukkan kode di atas</li>
              </ol>

              <button 
                onClick={() => setPairingCode(null)}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-3 rounded-xl transition-colors"
              >
                Tutup Peringatan
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto space-y-6">
        
        {disconnectNotice && (
          <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl flex items-center justify-between">
            <p className="text-rose-400 font-medium text-sm">{disconnectNotice}</p>
            <button onClick={() => setDisconnectNotice(null)} className="text-rose-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-xl">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <span className="bg-emerald-500/20 p-2 rounded-lg"><Smartphone className="w-8 h-8 text-emerald-400" /></span>
              {webConfig.dashTitle}
            </h1>
            <p className="text-neutral-400 mt-2">{webConfig.dashSubtitle}</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex gap-4 items-center relative">
            <div className="flex items-center gap-3 bg-neutral-950 px-4 py-2 rounded-full border border-neutral-800">
              <div className={`w-3 h-3 rounded-full animate-pulse ${status === 'connected' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-amber-500' : 'bg-rose-500'}`} />
              <span className="font-semibold text-sm uppercase tracking-wider">
                {status === 'connected' ? 'Aktif' : status === 'connecting' ? 'Menyambungkan' : 'Terputus'}
              </span>
            </div>
            <div className="relative z-50">
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 p-1.5 bg-neutral-950 border border-neutral-800 hover:bg-neutral-800 rounded-full transition-colors text-white"
              >
                {userProfile.photo ? (
                  <img src={userProfile.photo} className="w-8 h-8 rounded-full object-cover" alt="Profile" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                    {(userProfile.name || currentUserEmail || "U")[0].toUpperCase()}
                  </div>
                )}
                <MoreVertical className="w-5 h-5 text-neutral-400 mr-1" />
              </button>
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden py-2" style={{zIndex: 100}}>
                  <div className="px-4 py-2 border-b border-neutral-800 mb-2">
                    <p className="text-white text-sm font-semibold truncate">{userProfile.name || "Pengguna"}</p>
                    <p className="text-neutral-500 text-xs truncate">{currentUserEmail}</p>
                  </div>
                  <button 
                    onClick={() => { setIsProfileOpen(true); setShowDropdown(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors flex items-center gap-3"
                  >
                    <Users className="w-4 h-4" /> Edit Profile
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => { setIsSettingsOpen(true); setShowDropdown(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors flex items-center gap-3"
                    >
                      <Settings className="w-4 h-4" /> Edit Landing Page
                    </button>
                  )}
                  <button 
                    onClick={() => { localStorage.removeItem("mock_user_email"); navigate("/"); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-rose-400 hover:bg-neutral-800 transition-colors flex items-center gap-3"
                  >
                    <LogOut className="w-4 h-4" /> Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {!isAdmin && (
          <div className="flex border-b border-neutral-800 bg-neutral-900 rounded-t-2xl px-6">
            <button onClick={() => setActiveUserTab("dashboard")} className={`py-4 text-sm font-semibold transition-colors mr-6 ${activeUserTab === 'dashboard' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
              Bot Dashboard
            </button>
            <button onClick={() => setActiveUserTab("history")} className={`py-4 text-sm font-semibold transition-colors ${activeUserTab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
              Riwayat Pembayaran
            </button>
          </div>
        )}

        {activeUserTab === "history" ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
             <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
               <FileText className="w-5 h-5 text-indigo-400" /> Riwayat Pembayaran Premium
             </h2>
             <div className="overflow-x-auto border border-neutral-800 rounded-xl">
               <table className="w-full text-left text-sm whitespace-nowrap">
                 <thead className="bg-neutral-950/50 border-b border-neutral-800 text-neutral-400">
                   <tr>
                     <th className="px-4 py-3 font-medium">ID Transaksi</th>
                     <th className="px-4 py-3 font-medium">Paket</th>
                     <th className="px-4 py-3 font-medium">Tanggal</th>
                     <th className="px-4 py-3 font-medium">Status</th>
                     <th className="px-4 py-3 font-medium">Tanggal Verifikasi</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-neutral-800">
                   {userPayments.map((p, idx) => (
                     <tr key={idx} className="hover:bg-neutral-800/30">
                       <td className="px-4 py-3 font-mono text-xs text-neutral-300">{p.txId}</td>
                       <td className="px-4 py-3 text-white">{p.planName}</td>
                       <td className="px-4 py-3 text-neutral-400">{new Date(p.createdAt).toLocaleString()}</td>
                       <td className="px-4 py-3">
                         <span className={`px-2 py-1 rounded text-xs font-semibold ${
                           p.status === 'Diterima' ? 'bg-emerald-500/20 text-emerald-400' :
                           p.status === 'Ditolak' ? 'bg-rose-500/20 text-rose-400' :
                           'bg-yellow-500/20 text-yellow-400'
                         }`}>
                           {p.status}
                         </span>
                       </td>
                       <td className="px-4 py-3 text-neutral-400">{p.verifiedAt ? new Date(p.verifiedAt).toLocaleString() : '-'}</td>
                     </tr>
                   ))}
                   {userPayments.length === 0 && (
                     <tr>
                       <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Anda belum memiliki riwayat pembayaran.</td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Controls & Connection */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Connection Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" /> Status Koneksi
              </h2>
              
              <div className="flex flex-col md:flex-row gap-8 items-center bg-neutral-950/50 p-6 rounded-xl border border-neutral-800/50">
                {/* QR Section */}
                <div className="flex-shrink-0 flex flex-col items-center justify-center bg-white p-4 rounded-xl shadow-inner min-w-[200px] min-h-[200px]">
                  {status === "connected" ? (
                    <div className="text-emerald-600 flex flex-col items-center justify-center p-4">
                      <ShieldCheck className="w-16 h-16 mb-2" />
                      <span className="font-bold text-center">Terhubung Aman</span>
                      <span className="text-xs mt-2 font-semibold text-emerald-700 bg-emerald-100/50 px-2 py-1 rounded w-full flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" /> Uptime: {formatUptime(uptime)}
                      </span>
                      <span className="text-[10px] mt-1 text-emerald-600/70 whitespace-nowrap">Anti-ban Protection: Aktif</span>
                    </div>
                  ) : qrCode ? (
                    <div className="text-center">
                      <QRCodeSVG value={qrCode} size={200} />
                      <p className="text-xs text-neutral-500 mt-2 font-medium">Scan QR Code ini</p>
                    </div>
                  ) : status === "connecting" ? (
                    <div className="text-amber-500 flex flex-col items-center justify-center">
                      <RefreshCw className="w-12 h-12 mb-2 animate-spin" />
                      <span className="font-medium text-sm text-center">Memuat Kode...</span>
                    </div>
                  ) : (
                    <div className="text-neutral-500 flex flex-col items-center justify-center">
                      <Power className="w-12 h-12 mb-2 opacity-50" />
                      <span className="font-medium text-sm text-center">Bot Offline</span>
                    </div>
                  )}
                </div>

                {/* Pairing Code Section */}
                <div className="flex-grow space-y-4 w-full">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-400">Atau gunakan Nomor WhatsApp</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Contoh: 628123456789" 
                        className="flex-grow bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={status !== 'disconnected'}
                      />
                    </div>
                    <p className="text-xs text-neutral-500">Isi nomor dan klik Start untuk mendapatkan Pairing Code (menautkan dengan nomor saja).</p>
                  </div>

                  {/* Removed inline pairing code, moved to modal */}
                </div>
              </div>
            </div>

            {userProfile && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg flex justify-between items-center">
                <div>
                  <h3 className="text-white font-semibold">Status Akun</h3>
                  {userProfile.premiumStatus ? (
                    <p className="text-sm text-neutral-400 mt-1">
                      Paket Aktif: <span className="text-amber-400 font-bold">{userProfile.premiumPlan}</span>
                      <br/>Berakhir pada: {new Date(userProfile.premiumEnd).toLocaleDateString()}
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-400 mt-1">Anda menggunakan paket Standar (Gratis).</p>
                  )}
                </div>
              </div>
            )}

            {/* Actions Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg relative">
              {isExpired && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-900/80 backdrop-blur-sm rounded-2xl">
                  <div className="text-center p-4">
                     <ShieldCheck className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                     <p className="text-rose-400 font-bold">Akses Terkunci</p>
                     <p className="text-sm text-neutral-400 mt-1">Masa aktif paket Anda telah habis.</p>
                  </div>
                </div>
              )}
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-400" /> Kontrol Panel
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button 
                  onClick={handleStart}
                  disabled={status !== "disconnected"}
                  className="flex flex-col items-center justify-center p-4 bg-neutral-950 border border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <Power className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-sm">Start / On</span>
                </button>
                
                <button 
                  onClick={handleStop}
                  disabled={status === "disconnected"}
                  className="flex flex-col items-center justify-center p-4 bg-neutral-950 border border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/10 text-amber-400 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <Power className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-sm">Stop / Off</span>
                </button>

                <button 
                  onClick={handleRestart}
                  className="flex flex-col items-center justify-center p-4 bg-neutral-950 border border-sky-500/20 hover:border-sky-500/50 hover:bg-sky-500/10 text-sky-400 rounded-xl transition-all group"
                >
                  <RefreshCw className="w-6 h-6 mb-2 group-hover:rotate-180 transition-transform duration-500" />
                  <span className="font-medium text-sm">Restart Bot</span>
                </button>

                <button 
                  onClick={handleDeleteSession}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all group ${
                    isConfirmingDelete 
                      ? "bg-rose-500/20 border-rose-500 text-rose-400 border animate-pulse" 
                      : "bg-neutral-950 border border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-500/10 text-rose-400"
                  }`}
                >
                  <Trash2 className={`w-6 h-6 mb-2 transition-transform ${isConfirmingDelete ? "scale-110" : "group-hover:-translate-y-1"}`} />
                  <span className="font-medium text-sm text-center">{isConfirmingDelete ? "Klik Lagi (Yakin?)" : "Hapus Sesi"}</span>
                </button>
              </div>
            </div>

            {/* Mass Add Members */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg relative">
              {isExpired && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-900/80 backdrop-blur-sm rounded-2xl">
                  <div className="text-center p-4">
                     <ShieldCheck className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                     <p className="text-rose-400 font-bold">Akses Terkunci</p>
                  </div>
                </div>
              )}
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" /> Mass Add Anggota Grup
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-medium text-neutral-400">Pilih Grup (Diperlukan Bot didalam Grup)</label>
                    <button 
                      onClick={fetchGroups} 
                      disabled={isLoadingGroups} 
                      className="text-emerald-400 text-xs flex items-center gap-1 hover:text-emerald-300 transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingGroups ? "animate-spin" : ""}`} /> Refresh List
                    </button>
                  </div>
                  {groups.length > 0 ? (
                    <select 
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all appearance-none"
                      value={massAddGroupId}
                      onChange={(e) => setMassAddGroupId(e.target.value)}
                    >
                      {groups.map(group => (
                        <option key={group.id} value={group.id}>{group.name || group.id}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-neutral-500 text-sm">
                      {status === "connected" ? "Tidak ada grup ditemukan. Pastikan bot sudah dimasukkan ke grup." : "Bot belum terhubung."}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-400">Daftar Nomor Target (Pisahkan dengan koma atau baris baru)</label>
                  <textarea 
                    rows={4}
                    placeholder="Contoh: 628123456789, 628987654321..."
                    className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    value={massAddNumbers}
                    onChange={(e) => setMassAddNumbers(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleMassAdd}
                  disabled={status !== "connected" || !massAddGroupId || !massAddNumbers}
                  className="w-full py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-400 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  Eksekusi Mass Add
                </button>
              </div>
            </div>

            {/* Menu Preview */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-fuchsia-400" /> Fitur Menu Bot (Tes Fitur)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400 mt-1"><FileText className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.allmenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Kirim perintah ini untuk melihat semua menu yang tersedia.</p>
                  </div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400 mt-1"><Users className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.groupmenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Fitur admin grup seperti afk, infouser, tagadmin, infogrup, leaderboard, totalchat, menfess, confess, dll.</p>
                  </div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-purple-500/20 p-2 rounded-lg text-purple-400 mt-1"><Gamepad2 className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.gamemenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Menampilkan menu game seperti tebakmakanan, tebakjkt48, tebakgambar, dll.</p>
                  </div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-amber-500/20 p-2 rounded-lg text-amber-400 mt-1"><Settings className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.ownermenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Menu khusus: .addnamabot, .delnamabot, .antibot, .autoread, .savekontak, broadcast & manajemen.</p>
                  </div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400 mt-1"><MessageCircle className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.margamenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Cek pariban, tartulang, tarito, dan padan menurut adat batak.</p>
                  </div>
                </div>
                
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-green-500/20 p-2 rounded-lg text-green-400 mt-1"><Download className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.downloadmenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Download Tiktok, TiktokAudio, Youtube MP3/MP4, Capcut, FB, IG, Pinterest, dll.</p>
                  </div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-rose-500/20 p-2 rounded-lg text-rose-400 mt-1"><Video className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.videomenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Kumpulan video menarik seperti tiktokgirl, tiktokhot, dll.</p>
                  </div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-fuchsia-500/20 p-2 rounded-lg text-fuchsia-400 mt-1"><Gamepad2 className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.stickermenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Buat stiker, HD gambar, stiker teks brat & bratvid, smeme.</p>
                  </div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-pink-500/20 p-2 rounded-lg text-pink-400 mt-1"><Users className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.cecanmenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Kumpulan foto cecan: china, hijab, indonesia, japan, jeni, jiso, korea, malaysia, justinaxie, rose, thailand, vietnam.</p>
                  </div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-teal-500/20 p-2 rounded-lg text-teal-400 mt-1"><MessageCircle className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.islammenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Menu khusus Islam (Ayatkursi, tekssholat, hadits, jadwalsholat, kisahnabi, dll).</p>
                  </div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-sky-500/20 p-2 rounded-lg text-sky-400 mt-1"><MessageCircle className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.kristenmenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Menu khusus Kristen (Ayatalkitab, doaayat, kisahyesus, jadwalgereja, namakitab).</p>
                  </div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-pink-500/20 p-2 rounded-lg text-pink-400 mt-1"><MessageCircle className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.funmenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Aneka hiburan lucu (ceksifat, cekkenakalan, bego, rate, top, dll).</p>
                  </div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-purple-500/20 p-2 rounded-lg text-purple-400 mt-1"><MessageCircle className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.primbonmenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Ramalan dan primbon (pantun, ceksial, ramalannasib, zodiak, isidompet, profesiku, dll).</p>
                  </div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-orange-500/20 p-2 rounded-lg text-orange-400 mt-1"><MessageCircle className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.animemenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Aneka gambar anime (akira, asuna, eba, elaina, emilia, hinata, dll).</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Web Control */}
            {isAdmin && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-lg overflow-hidden">
                <div className="flex border-b border-neutral-800 bg-neutral-950/50">
                  <button onClick={() => setActiveAdminTab("dashboard")} className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeAdminTab === 'dashboard' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
                    Dashboard
                  </button>
                  <button onClick={() => setActiveAdminTab("payments")} className={`flex-1 flex justify-center items-center gap-2 py-4 text-sm font-semibold transition-colors ${activeAdminTab === 'payments' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
                    Premium Payments
                    {payments.filter(p => p.status === 'Menunggu Verifikasi').length > 0 && (
                      <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{payments.filter(p => p.status === 'Menunggu Verifikasi').length}</span>
                    )}
                  </button>
                </div>
                
                <div className="p-6">
                  {activeAdminTab === "dashboard" ? (
                    <>
                      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-indigo-400" /> Admin Control Web (Preview)
                      </h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-center gap-4">
                          <div className="bg-blue-500/20 p-3 rounded-xl text-blue-400"><Users className="w-6 h-6" /></div>
                          <div>
                            <h3 className="text-2xl font-bold text-white">{totalUsers}</h3>
                            <p className="text-xs text-neutral-400 mt-1">Total Pengguna Terdaftar</p>
                          </div>
                        </div>
                        <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-center gap-4">
                          <div className="bg-emerald-500/20 p-3 rounded-xl text-emerald-400"><Smartphone className="w-6 h-6" /></div>
                          <div>
                            <h3 className="text-2xl font-bold text-white">{totalBots}</h3>
                            <p className="text-xs text-neutral-400 mt-1">Nomor Aktif Terhubung</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-neutral-400">Manajemen Nomor Aktif</h3>
                          <button onClick={fetchAdminData} className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" /> Refresh
                          </button>
                        </div>
                        
                        {activeBotsInfo.length > 0 ? (
                          <div className="space-y-2">
                             {activeBotsInfo.map((bot, idx) => (
                                <div key={idx} className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                     <span className="relative flex h-3 w-3">
                                      {bot.status === "connected" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                                      <span className={`relative inline-flex rounded-full h-3 w-3 ${bot.status === "connected" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                                    </span>
                                    <div>
                                      <p className="text-sm font-medium text-white">{bot.email}</p>
                                      <p className="text-xs text-neutral-500 flex items-center gap-2">
                                        <span>{bot.status === "connected" ? "Aktif" : bot.status === "connecting" ? "Menghubungkan" : "Terputus"}</span>
                                        {bot.phoneNumber && <span className="px-1.5 py-0.5 bg-neutral-800 rounded font-mono text-[10px] text-white">+{bot.phoneNumber}</span>}
                                      </p>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleAdminDeleteSession(bot.email)}
                                    disabled={adminDeleting === bot.email}
                                    className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-lg transition-colors border border-rose-500/30 disabled:opacity-50"
                                  >
                                    {adminDeleting === bot.email ? "Memutus..." : "Putuskan Sesi"}
                                  </button>
                                </div>
                             ))}
                          </div>
                        ) : (
                          <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl text-center text-sm text-neutral-500">
                            Tidak ada nomor bot yang sedang terhubung di sistem.
                          </div>
                        )}
                      </div>
                    </>
                  ) : activeAdminTab === "payments" ? (
                    <div className="space-y-6">
                      <div className="flex flex-col md:flex-row gap-4 justify-between">
                         <div className="flex gap-2 w-full md:w-auto">
                            <input 
                               placeholder="Cari Username/WA..." 
                               value={paymentSearch} 
                               onChange={e => setPaymentSearch(e.target.value)} 
                               className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500 w-full md:w-64"
                            />
                            <select 
                               value={paymentFilter} 
                               onChange={e => setPaymentFilter(e.target.value)}
                               className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                            >
                               <option value="all">Semua Status</option>
                               <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                               <option value="Diterima">Diterima</option>
                               <option value="Ditolak">Ditolak</option>
                            </select>
                         </div>
                         <button onClick={fetchAdminData} className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1 bg-emerald-500/10 px-3 rounded-lg border border-emerald-500/20">
                            <RefreshCw className="w-4 h-4" /> Refresh
                         </button>
                      </div>

                      <div className="overflow-x-auto border border-neutral-800 rounded-xl">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-neutral-950/50 border-b border-neutral-800 text-neutral-400">
                            <tr>
                              <th className="px-4 py-3 font-medium">ID Transaksi</th>
                              <th className="px-4 py-3 font-medium">Email</th>
                              <th className="px-4 py-3 font-medium">No. WhatsApp</th>
                              <th className="px-4 py-3 font-medium">Paket</th>
                              <th className="px-4 py-3 font-medium">Tanggal</th>
                              <th className="px-4 py-3 font-medium">Status</th>
                              <th className="px-4 py-3 font-medium">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-800">
                            {payments.filter(p => 
                              (paymentFilter === "all" || p.status === paymentFilter) &&
                              ((p.email && p.email.toLowerCase().includes(paymentSearch.toLowerCase())) || p.phone.includes(paymentSearch))
                            ).map((p, idx) => (
                              <tr key={idx} className="hover:bg-neutral-800/30">
                                <td className="px-4 py-3 font-mono text-xs text-neutral-300">{p.txId}</td>
                                <td className="px-4 py-3 text-white">{p.email || p.username}</td>
                                <td className="px-4 py-3 text-neutral-300">{p.phone}</td>
                                <td className="px-4 py-3 text-amber-400">{p.planName}</td>
                                <td className="px-4 py-3 text-neutral-400">{new Date(p.createdAt).toLocaleString()}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    p.status === 'Diterima' ? 'bg-emerald-500/20 text-emerald-400' :
                                    p.status === 'Ditolak' ? 'bg-rose-500/20 text-rose-400' :
                                    'bg-yellow-500/20 text-yellow-400'
                                  }`}>
                                    {p.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                   <button 
                                     onClick={() => setSelectedPayment(p)}
                                     className="text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded border border-indigo-500/30"
                                   >
                                     Detail
                                   </button>
                                </td>
                              </tr>
                            ))}
                            {payments.length === 0 && (
                              <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">Tidak ada data pembayaran.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

          </div>

          {/* Terminal / Logs */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-lg flex flex-col h-[600px] lg:h-auto overflow-hidden">
            <div className="bg-neutral-950/80 border-b border-neutral-800 p-4 flex items-center justify-between z-10">
              <h2 className="text-sm font-semibold text-neutral-300 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                System Logs
              </h2>
            </div>
            <div className="flex-grow p-4 overflow-y-auto space-y-2 font-mono text-xs text-neutral-400 bg-neutral-950/50">
              {logs.length === 0 ? (
                <div className="text-neutral-600 italic">No logs yet...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="animate-in fade-in slide-in-from-bottom-1 border-b border-neutral-800/50 pb-2 last:border-0">
                    <span className="text-indigo-400/70 mr-2">[{new Date(log.time).toLocaleTimeString()}]</span>
                    <span className={log.message.includes('Error') || log.message.includes('Failed') ? 'text-rose-400' : log.message.includes('success') ? 'text-emerald-400' : 'text-neutral-300'}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>
        )}
      </div>
    </div>
  );
}
