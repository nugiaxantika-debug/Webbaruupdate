import express from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import path from "path";
import fs from "fs";
import { Server as SocketIOServer } from "socket.io";
import { WhatsAppBot } from "./src/services/whatsapp";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, setDoc, getDocs, getCountFromServer } from "firebase/firestore";
import admin from 'firebase-admin';

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const adminApp = initializeApp(firebaseConfig);
const adminDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Admin SDK using Environment Variables (Service Account)
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
  console.log("Firebase Admin SDK initialized successfully");
} else {
  console.warn("Firebase Admin SDK not initialized: Missing service account environment variables");
}

process.on('uncaughtException', (err) => {
  console.error("Uncaught Exception:", err);
});

process.on('unhandledRejection', (reason, p) => {
  console.error("Unhandled Rejection:", reason);
});

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: "*" },
  });
  const PORT = 3000;

  let publicUrl = "";

  app.use((req, res, next) => {
    if (!publicUrl && req.headers.host) {
      if (req.headers.host.includes("run.app") || req.headers.host.includes("aistudio")) {
         publicUrl = `https://${req.headers.host}`;
         console.log(`Discovered public URL for keep-alive: ${publicUrl}`);
      }
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

  

  const userBots = new Map<string, WhatsAppBot>();
  let activeBots: string[] = [];
  try {
    if (fs.existsSync("active_bots.json")) {
      activeBots = JSON.parse(fs.readFileSync("active_bots.json", "utf-8"));
    }
  } catch (e) {}

  for (const email of activeBots) {
    if (!userBots.has(email)) {
      const waBot = new WhatsAppBot(io, email);
      userBots.set(email, waBot);
      setTimeout(() => { waBot.start(); }, 1000); // 1s delay
    }
  }

  function getWaBot(req: express.Request): WhatsAppBot {
    let email = req.headers["x-user-email"] as string;
    if (!email) email = "default";
    if (!userBots.has(email)) {
      userBots.set(email, new WhatsAppBot(io, email));
      if (!activeBots.includes(email)) {
        activeBots.push(email);
        fs.writeFileSync("active_bots.json", JSON.stringify(activeBots));
        
      }
    }
    return userBots.get(email)!;
  }

  // API Routes
  // Auth endpoints
  app.post("/api/auth/register", async (req, res) => {
    const { email, password } = req.body;
    let users: any[] = [];
    try {
      if (fs.existsSync("auth.json")) {
        users = JSON.parse(fs.readFileSync("auth.json", "utf-8"));
      }
      const snapshot = await getDocs(collection(adminDb, "users"));
      users.push(...snapshot.docs.map(doc => doc.data()));
    } catch(e){}
    
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: "Email sudah terdaftar" });
    }
    
    const newUser = { email, password, name: "", photo: "", registeredAt: Date.now() };
    
    try {
        await setDoc(doc(adminDb, "users", email), newUser);
    } catch (e) {}

    // keep local array sync for existing logic
    let localUsers: any[] = [];
    if (fs.existsSync("auth.json")) {
      localUsers = JSON.parse(fs.readFileSync("auth.json", "utf-8"));
    }
    localUsers.push(newUser);
    fs.writeFileSync("auth.json", JSON.stringify(localUsers, null, 2));
    
    res.json({ success: true, email });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    let user = null;
    try {
       const userDoc = await getDoc(doc(adminDb, "users", email));
       if (userDoc.exists()) {
         user = userDoc.data();
       }
    } catch(e) {}

    if (!user) {
      let users: any[] = [];
      try {
        if (fs.existsSync("auth.json")) {
          users = JSON.parse(fs.readFileSync("auth.json", "utf-8"));
        }
      } catch(e){}
      user = users.find(u => u.email === email);
    }

    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Email atau password salah." });
    }
    res.json({ success: true, email });
  });

  app.get("/api/user/profile", async (req, res) => {
    const email = req.headers["x-user-email"] as string;
    if (!email) return res.status(401).json({ error: "Unauthorized" });

    let user = null;
    try {
       const userDoc = await getDoc(doc(adminDb, "users", email));
       if (userDoc.exists()) {
         user = userDoc.data();
       }
    } catch(e) {}

    if (!user) {
        let users: any[] = [];
        try {
          if (fs.existsSync("auth.json")) {
            users = JSON.parse(fs.readFileSync("auth.json", "utf-8"));
          }
        } catch(e){}
        user = users.find(u => u.email === email);
    }

    if (!user) return res.status(404).json({ error: "Not found" });

    // Cek kadaluarsa premium
    if (user.premiumStatus && user.premiumEnd) {
       if (new Date(user.premiumEnd).getTime() <= Date.now()) {
          user.premiumStatus = false;
          try {
             await setDoc(doc(adminDb, "users", email), { premiumStatus: false }, { merge: true });
          } catch(e) {}
          if (fs.existsSync("auth.json")) {
             let users = JSON.parse(fs.readFileSync("auth.json", "utf-8"));
             const idx = users.findIndex((u: any) => u.email === email);
             if (idx > -1) {
                users[idx].premiumStatus = false;
                fs.writeFileSync("auth.json", JSON.stringify(users, null, 2));
             }
          }
       }
    }

    res.json({ 
      name: user.name || "", 
      photo: user.photo || "", 
      registeredAt: user.registeredAt || Date.now(),
      premiumStatus: user.premiumStatus || false,
      premiumPlan: user.premiumPlan || "",
      premiumStart: user.premiumStart || "",
      premiumEnd: user.premiumEnd || ""
    });
  });

  app.post("/api/user/profile", async (req, res) => {
    const email = req.headers["x-user-email"] as string;
    if (!email) return res.status(401).json({ error: "Unauthorized" });

    const { name, photo } = req.body;
    
    try {
        await setDoc(doc(adminDb, "users", email), { name, photo }, { merge: true });
    } catch (e) {}

    // keep local sync
    let users: any[] = [];
    try {
      if (fs.existsSync("auth.json")) {
        users = JSON.parse(fs.readFileSync("auth.json", "utf-8"));
      }
    } catch(e){}

    const userIdx = users.findIndex(u => u.email === email);
    if (userIdx > -1) {
      if (name !== undefined) users[userIdx].name = name;
      if (photo !== undefined) users[userIdx].photo = photo;
      fs.writeFileSync("auth.json", JSON.stringify(users, null, 2));
    }
    
    res.json({ success: true });
  });

  app.get("/api/users/count", async (req, res) => {
    try {
       const snapshot = await getCountFromServer(collection(adminDb, "users"));
       res.json({ count: snapshot.data().count });
    } catch (e) {
       let users: any[] = [];
       try {
         if (fs.existsSync("auth.json")) {
           users = JSON.parse(fs.readFileSync("auth.json", "utf-8"));
         }
       } catch(e){}
       res.json({ count: users.length });
    }
  });

  app.get("/api/bots/active", (req, res) => {
    let bots: string[] = [];
    try {
      if (fs.existsSync("active_bots.json")) {
        bots = JSON.parse(fs.readFileSync("active_bots.json", "utf-8"));
      }
    } catch(e) {}
    
    const botsDetails = bots.map(email => {
      if (userBots.has(email)) {
         return { email, ...userBots.get(email)!.getStatus() };
      }
      return { email, status: "disconnected" };
    });
    
    res.json({ count: bots.length, bots: botsDetails });
  });


  app.get("/api/config", async (req, res) => {
    // Disable caching for configuration completely
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    let config = {};
    try {
      const docSnap = await getDoc(doc(adminDb, "settings", "web_config"));
      if (docSnap.exists()) {
        config = docSnap.data() || {};
      } else if (fs.existsSync("web_config.json")) {
        // Fallback to local if not initialized
        config = JSON.parse(fs.readFileSync("web_config.json", "utf-8"));
      }
    } catch(e) {
      console.error("Error reading config:", e);
      // Fallback to local if Firebase fails
      if (fs.existsSync("web_config.json")) {
        try {
          config = JSON.parse(fs.readFileSync("web_config.json", "utf-8"));
        } catch(err) {}
      }
    }
    res.json({ config });
  });

  app.post("/api/config", async (req, res) => {
    try {
      if (req.body.config) {
        await setDoc(doc(adminDb, "settings", "web_config"), req.body.config, { merge: true });
        // Also write to local just in case
        fs.writeFileSync("web_config.json", JSON.stringify(req.body.config, null, 2));
      }
      res.json({ success: true });
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/whatsapp/status", (req, res) => {
    res.json(getWaBot(req).getStatus());
  });

  app.post("/api/whatsapp/start", async (req, res) => {
    const { phoneNumber } = req.body;
    await getWaBot(req).start(phoneNumber);
    res.json({ success: true, message: "Start initiated" });
  });

  app.post("/api/whatsapp/stop", async (req, res) => {
    await getWaBot(req).stop();
    res.json({ success: true, message: "Stop initiated" });
  });

  app.post("/api/whatsapp/restart", async (req, res) => {
    await getWaBot(req).restart();
    res.json({ success: true, message: "Restart initiated" });
  });

  app.post("/api/whatsapp/delete-session", async (req, res) => {
    await getWaBot(req).deleteSession();
    res.json({ success: true, message: "Session deleted" });
  });

  app.post("/api/admin/delete-session", async (req, res) => {
    const { targetEmail } = req.body;
    let currentUser = req.headers["x-user-email"] as string;
    if (currentUser !== "nugiaxantika@gmail.com" && currentUser !== "jujqkqpenolimako@gmail.com") {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!targetEmail) return res.status(400).json({ error: "No target email provided" });
    
    if (userBots.has(targetEmail)) {
      await userBots.get(targetEmail)!.deleteSession();
    }
    res.json({ success: true, message: "Session deleted for " + targetEmail });
  });

  app.get("/api/whatsapp/groups", async (req, res) => {
    try {
      const groups = await getWaBot(req).getGroups();
      res.json({ success: true, groups });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Premium DANA Manual Payment
  app.post("/api/payment/dana/submit", async (req, res) => {
    try {
      const { name, email, phone, planName, planPrice, screenshot } = req.body;
      
      if (!name || !email || !phone || !screenshot) {
        return res.status(400).json({ error: "All fields and screenshot are required" });
      }

      // Simpan file bukti pembayaran pada folder terpisah
      let screenshotUrl = screenshot;
      if (screenshot.startsWith("data:image")) {
        const matches = screenshot.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
           const type = matches[1];
           const buffer = Buffer.from(matches[2], 'base64');
           const ext = type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1];
           const filename = `payment_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
           const uploadDir = path.join(process.cwd(), "public", "uploads");
           if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
           }
           fs.writeFileSync(path.join(uploadDir, filename), buffer);
           screenshotUrl = `/uploads/${filename}`;
        }
      }

      // Format: TRX-YYYYMMDD-XXXX
      const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
      const txId = `TRX-${dateStr}-${randomStr}`;

      const paymentData = {
        txId,
        name,
        email,
        phone,
        planName,
        planPrice,
        screenshot: screenshotUrl,
        status: "Menunggu Verifikasi",
        createdAt: new Date().toISOString()
      };

      // Save to Firestore
      await setDoc(doc(adminDb, "payments", txId), paymentData);

      res.json({ success: true, txId });
    } catch (err: any) {
      console.error("Payment submit error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Premium Payment Management (Admin)
  app.get("/api/admin/payments", async (req, res) => {
    let currentUser = req.headers["x-user-email"] as string;
    if (currentUser !== "nugiaxantika@gmail.com" && currentUser !== "jujqkqpenolimako@gmail.com") {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const snap = await getDocs(collection(adminDb, "payments"));
      const payments = snap.docs.map(d => d.data());
      payments.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json({ success: true, payments });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/payments/action", async (req, res) => {
    let currentUser = req.headers["x-user-email"] as string;
    if (currentUser !== "nugiaxantika@gmail.com" && currentUser !== "jujqkqpenolimako@gmail.com") {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const { txId, action, reason } = req.body;
      const paymentRef = doc(adminDb, "payments", txId);
      const snap = await getDoc(paymentRef);
      if (!snap.exists()) return res.status(404).json({ error: "Payment not found" });
      const paymentData = snap.data();
      
      const updateData: any = {
        status: action === "accept" ? "Diterima" : "Ditolak",
        verifiedAt: new Date().toISOString(),
        verifiedBy: currentUser
      };
      if (action === "reject" && reason) {
        updateData.rejectReason = reason;
      }
      
      await setDoc(paymentRef, updateData, { merge: true });

      if (action === "accept") {
         const userEmail = paymentData.email; // Assuming email field contains email
         const userRef = doc(adminDb, "users", userEmail);
         const userSnap = await getDoc(userRef);
         if (userSnap.exists()) {
             const now = new Date();
             const end = new Date(now);
             end.setDate(end.getDate() + 30); // Assume 30 days for VIP, or use webConfig
             await setDoc(userRef, {
                 premiumStatus: true,
                 premiumPlan: paymentData.planName,
                 premiumStart: now.toISOString(),
                 premiumEnd: end.toISOString()
             }, { merge: true });
         } else {
             // Fallback to local auth.json if not in Firestore
             if (fs.existsSync("auth.json")) {
                 let users = JSON.parse(fs.readFileSync("auth.json", "utf-8"));
                 const uIdx = users.findIndex((u: any) => u.email === userEmail);
                 if (uIdx !== -1) {
                     const now = new Date();
                     const end = new Date(now);
                     end.setDate(end.getDate() + 30);
                     users[uIdx].premiumStatus = true;
                     users[uIdx].premiumPlan = paymentData.planName;
                     users[uIdx].premiumStart = now.toISOString();
                     users[uIdx].premiumEnd = end.toISOString();
                     fs.writeFileSync("auth.json", JSON.stringify(users, null, 2));
                 }
             }
         }
      }

      res.json({ success: true, txId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  


  app.get("/api/user/payments", async (req, res) => {
    let currentUser = req.headers["x-user-email"] as string;
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
    try {
      // Find payments where email === currentUser
      const snap = await getDocs(collection(adminDb, "payments"));
      const payments = snap.docs.map(d => d.data()).filter(p => p.email === currentUser);
      payments.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json({ success: true, payments });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/whatsapp/mass-add-members", async (req, res) => {
    const { groupId, numbers } = req.body;
    if (!groupId || !numbers || !Array.isArray(numbers)) {
      return res.status(400).json({ error: "Invalid parameters. Require groupId and a numbers array." });
    }
    try {
      getWaBot(req).massAddGroupMembers(groupId, numbers).catch(err => console.error("Mass add background error:", err));
      res.json({ success: true, message: `Memulai proses mass add untuk ${numbers.length} anggota di background.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  io.on("connection", (socket) => {
    const userEmail = typeof socket.handshake.query.userEmail === "string" ? socket.handshake.query.userEmail : "default";
    socket.join(userEmail);
    console.log(`Client connected via WebSocket: ${userEmail}`);
    
    // Ensure bot exists for this user
    if (!userBots.has(userEmail)) {
      userBots.set(userEmail, new WhatsAppBot(io, userEmail));
      if (!activeBots.includes(userEmail)) {
        activeBots.push(userEmail);
        fs.writeFileSync("active_bots.json", JSON.stringify(activeBots));
        
      }
    }
    
    socket.emit("status", userBots.get(userEmail)!.getStatus());

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${userEmail}`);
    });
  });

  // Vite middleware for development or Serve Static files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
    
    app.get("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);

        let config: any = {};
        try {
          const docSnap = await getDoc(doc(adminDb, "settings", "web_config"));
          if (docSnap.exists()) {
            config = docSnap.data() || {};
          } else if (fs.existsSync("web_config.json")) {
            config = JSON.parse(fs.readFileSync("web_config.json", "utf-8"));
          }
        } catch(e) {}

        if (config.title) {
          const fullTitle = `${config.title}${config.highlight ? ' ' + config.highlight : ''}`;
          template = template.replace(/<title>.*?<\/title>/, `<title>${fullTitle}</title>`);
          
          let headInject = `<meta name="description" content="${config.heroDesc || fullTitle}">\n  <meta property="og:title" content="${fullTitle}">\n  <meta property="og:description" content="${config.heroDesc || fullTitle}">`;
          if (config.favicon) {
            headInject += `\n  <link rel="icon" href="${config.favicon}">`;
          }
          template = template.replace('</head>', `${headInject}\n  </head>`);
        }

        res.status(200).set({ 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", async (req, res) => {
      try {
        let template = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
        
        let config: any = {};
        try {
          const docSnap = await getDoc(doc(adminDb, "settings", "web_config"));
          if (docSnap.exists()) {
            config = docSnap.data() || {};
          } else if (fs.existsSync("web_config.json")) {
            config = JSON.parse(fs.readFileSync("web_config.json", "utf-8"));
          }
        } catch(e) {}

        if (config.title) {
          const fullTitle = `${config.title}${config.highlight ? ' ' + config.highlight : ''}`;
          template = template.replace(/<title>.*?<\/title>/i, `<title>${fullTitle}</title>`);
          
          let headInject = `<meta name="description" content="${config.heroDesc || fullTitle}">\n  <meta property="og:title" content="${fullTitle}">\n  <meta property="og:description" content="${config.heroDesc || fullTitle}">`;
          if (config.favicon) {
            headInject += `\n  <link rel="icon" href="${config.favicon}">`;
          }
          template = template.replace('</head>', `${headInject}\n  </head>`);
        }
        res.status(200).set({ 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }).send(template);
      } catch (e) {
        res.status(200).set({
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }).sendFile(path.join(distPath, "index.html"));
      }
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Attempt to prevent container from sleeping by self-pinging every 25 seconds
    // We ping the public URL so it routes through the external load balancer, keeping the instance active
    setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (publicUrl) {
           const publicController = new AbortController();
           const publicTimeoutId = setTimeout(() => publicController.abort(), 5000);
           await fetch(`${publicUrl}/api/health`, { signal: publicController.signal });
           clearTimeout(publicTimeoutId);
        }
      } catch (e) {
        // ignore timeout errors
      }
    }, 25000);
  });
}

startServer();
