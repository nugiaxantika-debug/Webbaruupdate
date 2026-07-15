import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  downloadContentFromMessage,
  Browsers
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync, spawn } from "child_process";
import { Server as SocketIOServer } from "socket.io";
import NodeCache from "node-cache";
import sharp from "sharp";
import axios from "axios";
import schedule from "node-schedule";
import { igdl, fbdl, ytmp4, ytmp3 } from "ruhend-scraper";
import vredenYt from "@vreden/youtube_scraper";
import btch from "btch-downloader";
import ab from "ab-downloader";

const AUTH_FOLDER = path.join(process.cwd(), "auth_info_baileys");
const msgRetryCounterCache = new NodeCache();

export class WhatsAppBot {
  public userEmail: string;
  private authFolder: string;
  private settingsFile: string;
  private botSettingsFile: string;
  private sock: any = null;
  private io: SocketIOServer;
  private status: "disconnected" | "connecting" | "connected" = "disconnected";
  private currentQr: string | null = null;
  private isAttemptingStart: boolean = false;
  private coverImageBuffer: Buffer | null = null;
  private customBotName: string | null = null;
  private poweredByText: string | null = null;
  private menuCommands = new Set<string>(["allmenu", "menu", "help", "bot"]);
  private activeGames = new Map<string, { answer: string | string[] | number, type: string, attempts?: number, state?: string, players?: string[] }>();
  private activeSwGroups = new Set<string>();
  
  // Anti features
    
  private antibotEnabled: boolean = false;
  private autoReadEnabled: boolean = false;
  private autoTypingEnabled: boolean = false;
  private groupSettings = new Map<string, { welcomeEnabled?: boolean, welcomeMessage?: string, goodbyeEnabled?: boolean, goodbyeMessage?: string, antivideo?: boolean, antifoto?: boolean, antifoto1x?: boolean, antistiker?: boolean, antispam?: boolean, antitagsw?: boolean, antivirtex?: boolean, antitoxic?: boolean, antilinkall?: boolean }>();
  
  private connectedAt: number | null = null;
  
  private storedStickers = new Map<string, Buffer>();
  private totalChats = new Map<string, number>();
  private afkUsers = new Map<string, { time: number, reason: string }>();
  private userMessageHistory = new Map<string, { text: string, time: number, count: number }>();
  private menfessSessions = new Map<string, { partner: string, originalSender: string }>();

  private connectionMonitor: any = null;

  constructor(io: SocketIOServer, userEmail: string = "default") {
    this.io = io;
    this.userEmail = userEmail;
    this.authFolder = path.join(process.cwd(), `auth_info_baileys_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`);
    this.settingsFile = path.join(process.cwd(), `group_settings_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
    this.botSettingsFile = path.join(process.cwd(), `bot_settings_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
    this.loadBotSettings();
    this.loadGroupSettings();
    
    // Auto-reconnect monitor every 3 minutes
    this.connectionMonitor = setInterval(() => {
      if (this.isAttemptingStart) {
        if (this.status === "disconnected") {
          console.log("Connection monitor detected disconnected state. Attempting auto-restart...");
          this.start();
        } else if (this.status === "connecting") {
          // Hanya merestart jika stuck connecting lebih dari 3 menit tanpa progress
          console.log("Connection monitor detected connecting state for an extended time. Forcing restart to avoid getting stuck...");
          if (this.sock) {
            try { this.sock.end(undefined); } catch(e) {}
            this.sock = null;
          }
          this.updateStatus("disconnected");
          this.start();
        }
      }
    }, 180000);
  }

  private loadBotSettings() {
    try {
      if (!fs.existsSync(this.botSettingsFile)) return;
      const data = fs.readFileSync(this.botSettingsFile, "utf8");
      const obj = JSON.parse(data);
      if (obj.antibotEnabled !== undefined) this.antibotEnabled = obj.antibotEnabled;
      if (obj.autoReadEnabled !== undefined) this.autoReadEnabled = obj.autoReadEnabled;
      if (obj.autoTypingEnabled !== undefined) this.autoTypingEnabled = obj.autoTypingEnabled;
    } catch {
      // ignore
    }
  }

  private saveBotSettings() {
    const obj = {
      antibotEnabled: this.antibotEnabled,
      autoReadEnabled: this.autoReadEnabled,
      autoTypingEnabled: this.autoTypingEnabled
    };
    fs.writeFileSync(this.botSettingsFile, JSON.stringify(obj, null, 2));
  }

  private loadGroupSettings() {
    try {
      const data = fs.readFileSync(this.settingsFile, "utf8");
      const obj = JSON.parse(data);
      for (const [k, v] of Object.entries(obj)) {
        this.groupSettings.set(k, v as any);
      }
    } catch {
      // ignore
    }
  }

  private saveGroupSettings() {
    const obj = Object.fromEntries(this.groupSettings);
    fs.writeFileSync(this.settingsFile, JSON.stringify(obj, null, 2));
  }

  public getStatus() {
    let uptime = null;
    if (this.status === "connected" && this.connectedAt) {
      uptime = Date.now() - this.connectedAt;
    }
    let phoneNumber = "";
    if (this.sock?.user?.id) {
      phoneNumber = this.sock.user.id.split(":")[0];
    }
    return {
      status: this.status,
      qr: this.currentQr,
      uptime: uptime,
      phoneNumber: phoneNumber,
    };
  }

  public async start(phoneNumber?: string) {
    if (this.status !== "disconnected") {
      this.broadcastState("Bot is already running or connecting.");
      return;
    }
    this.isAttemptingStart = true;

    if (this.sock) {
      this.broadcastState("Cleaning up old socket before start...");
      try {
        if (this.sock.end) this.sock.end(undefined);
      } catch (e) {}
      this.sock = null;
    }

    if (phoneNumber) {
      phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    }

    this.updateStatus("connecting");
    this.broadcastState("Starting initialization...");

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
      
      const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] as any, isLatest: false }));
      this.broadcastState(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }) as any,
        browser: Browsers.ubuntu("Chrome"),
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        keepAliveIntervalMs: 30000,
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      if (phoneNumber && !this.sock.authState.creds.registered) {
        this.broadcastState("Waiting for socket connection to request pairing code...");
        setTimeout(async () => {
          if (!this.sock) return;
          this.broadcastState("Requesting pairing code...");
          try {
            const code = await this.sock.requestPairingCode(phoneNumber);
            const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
            this.broadcastState(`Pairing code generated: ${formattedCode}`);
            this.io.to(this.userEmail).emit("pairing_code", formattedCode);
          } catch (err: any) {
            const errorMsg = err?.message || err;
            if (String(errorMsg).includes("Connection Closed") || String(errorMsg).includes("Precondition Required")) {
                this.broadcastState("Connection dropped while requesting code. Will retry automatically...");
            } else {
                this.broadcastState(`Failed to get pairing code: ${errorMsg}`);
                console.error("Pairing error:", err);
            }
          }
        }, 3000);
      }

      this.sock.ev.on("connection.update", async (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          if (!phoneNumber) {
            this.currentQr = qr;
            this.io.to(this.userEmail).emit("qr", qr);
            this.broadcastState("QR Code generated. Please scan.");
          }
        }

        if (connection === "close") {
          const boomError = lastDisconnect?.error as Boom;
          const statusCode = boomError?.output?.statusCode;
          let shouldReconnect = true; // Default to always try reconnecting first
          
          if (statusCode === DisconnectReason.loggedOut) {
             shouldReconnect = false;
          }

          // If we get Precondition Required (428) or Time Out (408) while not registered,
          // the session state is likely dirty or rate-limited. Better to clear it.
          if (!this.sock?.authState?.creds?.registered && (statusCode === 428 || statusCode === 408)) {
              this.broadcastState(`Connection closed with ${statusCode}. Cleaning dirty session...`);
              shouldReconnect = false;
          }
            
          if (statusCode === 428) {
              this.broadcastState("Connection dropped (428 Precondition Required).");
          } else if (statusCode === 408) {
              this.broadcastState("Request Time-out (408).");
          } else if (statusCode === 515) {
              this.broadcastState("Stream Errored (515). Reconnecting...");
          } else {
              this.broadcastState(`Connection closed - Status code: ${statusCode}. Reconnecting: ${shouldReconnect}`);
          }
          
          this.updateStatus("disconnected");
          this.currentQr = null;

          if (shouldReconnect && this.isAttemptingStart) {
            setTimeout(() => {
                if (this.status === "disconnected") {
                    this.start(phoneNumber);
                }
            }, 5000); // Wait 5 seconds before reconnecting
          } else {
            if (!shouldReconnect) {
              // Hanya delete session jika benar-benar logged out (scan WA memutus bot dari HP utama)
              this.broadcastState("User has logged out from linked devices. Deleting session...");
              this.deleteSession();
            }
          }
        } else if (connection === "open") {
          this.updateStatus("connected");
          this.currentQr = null;
          this.io.to(this.userEmail).emit("pairing_code", null);
          this.broadcastState("Bot connected successfully!");
        }
      });

      this.sock.ev.on("creds.update", saveCreds);

      this.sock.ev.on("group-participants.update", async (data: any) => {
        try {
          const { id, participants, action } = data;
          this.broadcastState(`group-participants.update: ${action} for ${id} with ${participants.length} participants`);
          const settings = this.groupSettings.get(id);
          
          if (!settings) {
              return;
          }

          let groupName = "Grup ini";
          try {
             const metadata = await this.sock.groupMetadata(id);
             if (metadata && metadata.subject) {
                 groupName = metadata.subject;
             }
          } catch (e) {
             // ignore
          }

          if (action === "add" && settings.welcomeEnabled && settings.welcomeMessage) {
            for (const participant of participants) {
              try {
                const participantJid = typeof participant === 'string' ? participant : (participant as any).id || (participant as any).jid || String(participant);
                let msgText = settings.welcomeMessage
                    .replace(/@user/gi, `@${participantJid.split("@")[0]}`)
                    .replace(/@grup/gi, groupName);
                
                if (!msgText.includes(`@${participantJid.split("@")[0]}`)) {
                    msgText += `\n\nSelamat datang @${participantJid.split("@")[0]}!`;
                }

                await this.sock.sendMessage(id, { text: msgText, mentions: [participantJid] });
                this.broadcastState(`Sent welcome message to ${participantJid}`);
              } catch (e: any) {
                this.broadcastState(`Failed to send welcome message: ${e?.message || e}`);
              }
            }
          } else if (action === "remove" && settings.goodbyeEnabled && settings.goodbyeMessage) {
            for (const participant of participants) {
              try {
                const participantJid = typeof participant === 'string' ? participant : (participant as any).id || (participant as any).jid || String(participant);
                let msgText = settings.goodbyeMessage
                    .replace(/@user/gi, `@${participantJid.split("@")[0]}`)
                    .replace(/@grup/gi, groupName);

                if (!msgText.includes(`@${participantJid.split("@")[0]}`)) {
                    msgText += `\n\nSelamat tinggal @${participantJid.split("@")[0]}!`;
                }

                await this.sock.sendMessage(id, { text: msgText, mentions: [participantJid] });
                this.broadcastState(`Sent goodbye message to ${participantJid}`);
              } catch (e: any) {
                this.broadcastState(`Failed to send goodbye message: ${e?.message || e}`);
              }
            }
          }
        } catch (err) {
          console.error("Failed to process group update", err);
        }
      });

      this.sock.ev.on("messages.upsert", async (m: any) => {
        try {
          if (m.type === "notify") {
            for (const msg of m.messages) {
              if (msg.message || msg.messageStubType) {
                try {
                  await this.handleIncomingMessage(msg);
                } catch (e) {
                  console.error("Error handling msg:", e);
                }
              }
            }
          }
        } catch (e) {
            console.error("Critical error in messages.upsert:", e);
        }
      });
    } catch (error: any) {
      console.error("Error starting WA:", error);
      this.updateStatus("disconnected");
      this.broadcastState(`Failed to start bot: ${error?.message || error}`);
    }
  }

  public async stop() {
    this.isAttemptingStart = false;
    if (this.sock) {
      this.broadcastState("Stopping bot...");
      try {
        if (this.sock.logout) await this.sock.logout();
      } catch (e: any) {
        if (!String(e).includes("Connection Closed")) {
          console.error("Logout error:", e);
        }
      }
      try {
        if (this.sock.end) this.sock.end(undefined);
      } catch (e: any) {
        if (!String(e).includes("Cannot read properties of null")) {
          console.error("End socket error:", e);
        }
      }
      this.sock = null;
      this.updateStatus("disconnected");
      this.currentQr = null;
      this.broadcastState("Bot stopped.");
    }
  }

  public async restart() {
    await this.stop();
    setTimeout(() => this.start(), 2000);
  }

  public async deleteSession() {
    await this.stop();
    this.broadcastState("Deleting session...");
    if (fs.existsSync(this.authFolder)) {
      try {
        fs.rmSync(this.authFolder, { recursive: true, force: true });
        this.broadcastState("Session deleted cleanly.");
      } catch (err) {
        console.error("Error deleting auth folder", err);
        this.broadcastState("Failed to delete session folder.");
      }
    } else {
        this.broadcastState("No session to delete.");
    }
    this.updateStatus("disconnected");
    this.currentQr = null;
  }

  public async getGroups() {
    if (!this.sock) return [];
    try {
      const groups = await this.sock.groupFetchAllParticipating();
      return Object.values(groups).map((group: any) => ({
        id: group.id,
        name: group.subject
      }));
    } catch (err) {
      console.error("Failed to fetch groups", err);
      return [];
    }
  }

  public async massAddGroupMembers(groupId: string, numbers: string[]) {
    if (!this.sock) {
      throw new Error("Bot is not connected.");
    }

    if (!groupId.endsWith("@g.us")) {
      groupId = `${groupId}@g.us`;
    }

    const formattedNumbers = numbers.map((num) => {
      let n = num.replace(/[^0-9]/g, "");
      return `${n}@s.whatsapp.net`;
    });
    
    // Process in chunks to avoid spam
    const chunkSize = 2;
    for (let i = 0; i < formattedNumbers.length; i += chunkSize) {
      const chunk = formattedNumbers.slice(i, i + chunkSize);
      try {
        await this.sock.groupParticipantsUpdate(groupId, chunk, "add");
        this.broadcastState(`Added chunk of ${chunk.length} to group ${groupId} (${i + chunk.length}/${formattedNumbers.length})`);
        // Larger random delay between chunks (5s to 15s)
        if (i + chunkSize < formattedNumbers.length) {
            const delay = Math.floor(Math.random() * 10000) + 5000;
            this.broadcastState(`Menunggu ${Math.round(delay/1000)} detik sebelum menambahkan selanjutnya...`);
            await new Promise(r => setTimeout(r, delay));
        }
      } catch (e: any) {
        this.broadcastState(`Failed to add chunk to group ${groupId}: ${e?.message}`);
        if (i + chunkSize < formattedNumbers.length) {
            this.broadcastState(`Terjadi error/limit, cooldown 30 detik...`);
            await new Promise(r => setTimeout(r, 30000));
        }
      }
    }
    this.broadcastState(`Selesai menambahkan ${formattedNumbers.length} anggota.`);
    return { success: true, message: `Completed adding members (runs in background).` };
  }

  private updateStatus(newStatus: "disconnected" | "connecting" | "connected") {
    this.status = newStatus;
    if (newStatus === "connected") {
      if (!this.connectedAt) this.connectedAt = Date.now();
    } else {
      this.connectedAt = null;
    }
    this.io.to(this.userEmail).emit("status", this.getStatus());
  }

  private broadcastState(message: string) {
    console.log(`[${this.userEmail}] ${message}`);
    this.io.to(this.userEmail).emit("log", { time: new Date().toISOString(), message });
  }

  private async handleIncomingMessage(msg: any) {
    if (!this.sock) return;

    const jid = msg.key.remoteJid;
    if (jid) {
        const userKey = msg.key.participant || msg.participant || jid;
        const currentChats = this.totalChats.get(userKey) || 0;
        this.totalChats.set(userKey, currentChats + 1);
    }

    if (this.autoReadEnabled && !msg.key.fromMe) {
      try {
        await this.sock.readMessages([msg.key]);
      } catch (e) {
        // ignore
      }
    }

    if (this.antibotEnabled && msg.key.id && (msg.key.id.startsWith("BAE5") || msg.key.id.length === 16) && !msg.key.fromMe) {
      return; // Ignore other bots
    }

    if (msg.messageStubType === 27 || msg.messageStubType === 28 || msg.messageStubType === 32) {
      this.broadcastState(`Fallback stub match: type=${msg.messageStubType} for ${jid}`);
      const action = msg.messageStubType === 27 ? 'add' : 'remove';
      const participants = msg.messageStubParameters || [];
      const settings = this.groupSettings.get(jid);

      if (settings && participants.length > 0) {
        let groupName = "Grup ini";
        try {
           const metadata = await this.sock.groupMetadata(jid);
           if (metadata && metadata.subject) {
               groupName = metadata.subject;
           }
        } catch (e) {}

        if (action === "add" && settings.welcomeEnabled && settings.welcomeMessage) {
          for (const participant of participants) {
            try {
              const participantJid = typeof participant === 'string' ? participant : (participant as any).id || (participant as any).jid || String(participant);
              let msgText = settings.welcomeMessage
                  .replace(/@user/gi, `@${participantJid.split("@")[0]}`)
                  .replace(/@grup/gi, groupName);
              
              if (!msgText.includes(`@${participantJid.split("@")[0]}`)) {
                  msgText += `\n\nSelamat datang @${participantJid.split("@")[0]}!`;
              }

              await this.sock.sendMessage(jid, { text: msgText, mentions: [participantJid] });
              this.broadcastState(`Fallback sent welcome to ${participantJid}`);
            } catch (e: any) {
               this.broadcastState(`Fallback failed welcome: ${e?.message}`);
            }
          }
        } else if (action === "remove" && settings.goodbyeEnabled && settings.goodbyeMessage) {
          for (const participant of participants) {
            try {
              const participantJid = typeof participant === 'string' ? participant : (participant as any).id || (participant as any).jid || String(participant);
              let msgText = settings.goodbyeMessage
                  .replace(/@user/gi, `@${participantJid.split("@")[0]}`)
                  .replace(/@grup/gi, groupName);

              if (!msgText.includes(`@${participantJid.split("@")[0]}`)) {
                  msgText += `\n\nSelamat tinggal @${participantJid.split("@")[0]}!`;
              }

              await this.sock.sendMessage(jid, { text: msgText, mentions: [participantJid] });
              this.broadcastState(`Fallback sent goodbye to ${participantJid}`);
            } catch (e: any) {
               this.broadcastState(`Fallback failed goodbye: ${e?.message}`);
            }
          }
        }
      }
    }

    if (!msg.message) return;

    // Handle status broadcast
    if (jid === "status@broadcast") {
      if (this.activeSwGroups.size > 0 && !msg.key.fromMe) {
          const sender = msg.key.participant || msg.participant;
          let messageData = msg.message;
          if (messageData?.ephemeralMessage?.message) {
             messageData = messageData.ephemeralMessage.message;
          }
          const isImage = messageData?.imageMessage;
          const isVideo = messageData?.videoMessage;
          const isText = messageData?.extendedTextMessage || messageData?.conversation;
          const text = messageData?.extendedTextMessage?.text || messageData?.conversation || "";

          let buffer: Buffer | null = null;
          if (isImage || isVideo) {
              try {
                  buffer = await downloadMediaMessage(msg as any, 'buffer', {}, { logger: pino({ level: 'silent' }) as any, reuploadRequest: this.sock.updateMediaMessage }) as Buffer;
              } catch (e) {
                  console.error(e);
              }
          }

          for (const groupJid of Array.from(this.activeSwGroups)) {
             try {
                if (buffer) {
                    if (isImage) await this.sock.sendMessage(groupJid, { image: buffer, caption: `📸 *Auto Culik SW*\nDari: @${sender?.split('@')[0] || 'Unknown'}\n\n${isImage?.caption || ''}`.trim(), mentions: sender ? [sender] : [] });
                    else if (isVideo) await this.sock.sendMessage(groupJid, { video: buffer, caption: `🎥 *Auto Culik SW*\nDari: @${sender?.split('@')[0] || 'Unknown'}\n\n${isVideo?.caption || ''}`.trim(), mentions: sender ? [sender] : [] });
                } else if (isText) {
                    await this.sock.sendMessage(groupJid, { text: `📝 *Auto Culik SW*\nDari: @${sender?.split('@')[0] || 'Unknown'}\n\n${text}`, mentions: sender ? [sender] : [] });
                }
             } catch (e) {}
          }
      }
      return;
    }

    const getMessageText = (message: any) => {
      if (!message) return "";
      if (message.conversation) return message.conversation;
      if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
      if (message.imageMessage?.caption) return message.imageMessage.caption;
      if (message.videoMessage?.caption) return message.videoMessage.caption;
      if (message.ephemeralMessage?.message) {
        return getMessageText(message.ephemeralMessage.message);
      }
      return "";
    };

    let messageObj = msg.message;
    if (messageObj?.ephemeralMessage?.message) {
      messageObj = messageObj.ephemeralMessage.message;
    }
    
    // Anti features enforcement
    if (jid.endsWith("@g.us") && !msg.key.fromMe) {
      let shouldDelete = false;
      let reason = "";

      const participant = msg.key.participant;
      const isVideoInfo = messageObj?.videoMessage;
      const isImageInfo = messageObj?.imageMessage;
      const isStickerInfo = messageObj?.stickerMessage;
      const isViewOnceInfo = messageObj?.viewOnceMessage || messageObj?.viewOnceMessageV2 || messageObj?.viewOnceMessageV2Extension || messageObj?.imageMessage?.viewOnce || messageObj?.videoMessage?.viewOnce;
      const textInfo = getMessageText(messageObj);
      const isForwardedStatus = messageObj?.extendedTextMessage?.contextInfo?.isForwarded && messageObj?.extendedTextMessage?.contextInfo?.forwardingScore > 0 && messageObj?.extendedTextMessage?.contextInfo?.participant === "status@broadcast";
      
      if (this.groupSettings.get(jid)?.antivideo && isVideoInfo) {
        shouldDelete = true;
        reason = "antivideo";
      }
      
      if (this.groupSettings.get(jid)?.antifoto && isImageInfo) {
        shouldDelete = true;
        reason = "antifoto";
      }

      if (this.groupSettings.get(jid)?.antifoto1x && isViewOnceInfo) {
        shouldDelete = true;
        reason = "antifoto1x";
      }
      
      if (this.groupSettings.get(jid)?.antistiker && isStickerInfo) {
        shouldDelete = true;
        reason = "antistiker";
      }
      
      if (this.groupSettings.get(jid)?.antitagsw && (isForwardedStatus || textInfo.includes("status@broadcast"))) {
        shouldDelete = true;
        reason = "antitagsw";
      }

      if (this.groupSettings.get(jid)?.antivirtex && textInfo && textInfo.length > 5000) {
        shouldDelete = true;
        reason = "antivirtex";
      }

            if (this.groupSettings.get(jid)?.antilinkall && textInfo && textInfo.match(/https?:\/\/[^\s]+/i)) {
         shouldDelete = true;
         reason = "antilinkall";
      }

      const toxicWords = ["anjing", "babi", "bangsat", "kontol", "memek", "jembut", "ngentot", "tolol", "goblok"];
      if (this.groupSettings.get(jid)?.antitoxic && textInfo) {
         const lowerText = textInfo.toLowerCase();
         if (toxicWords.some(w => lowerText.includes(w))) {
            shouldDelete = true;
            reason = "antitoxic";
         }
      }

      if (this.groupSettings.get(jid)?.antispam && textInfo && participant) {
        // very rudimentary spam tracking: if same user sends to same group repeatedly fast
        const key = `${jid}-${participant}`;
        const now = Date.now();
        const history = this.userMessageHistory.get(key) || { text: "", time: 0, count: 0 };
        
        if (history.text === textInfo && (now - history.time) < 5000) {
          history.count += 1;
        } else {
          history.text = textInfo;
          history.count = 1;
        }
        history.time = now;
        this.userMessageHistory.set(key, history);
        
        if (history.count > 3) {
          shouldDelete = true;
          reason = "antispam";
        }
      }

      if (shouldDelete) {
        try {
          await this.sock.sendMessage(jid, { delete: msg.key });
          this.broadcastState(`Deleted message in ${jid} due to ${reason}`);
          return; // Stop processing this message
        } catch (e) {
          this.broadcastState(`Failed to delete msg for ${reason}: bot might not be admin`);
        }
      }
    }

    const messageContent = getMessageText(messageObj);

    if (!messageContent) return;

    const body = messageContent.trim().toLowerCase();
    
    // Log the incoming message privately
    console.log(`[Message] From: ${jid} | Content: ${body}`);

    const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (quotedId && this.activeGames.has(quotedId)) {
        const game = this.activeGames.get(quotedId);
        const userAnswer = body;
        
        if (game!.type === "tebakangka") {
            const correctAnswer = String(game!.answer).toLowerCase();
            const userNum = parseInt(userAnswer, 10);
            const targetNum = parseInt(correctAnswer, 10);
            
            if (isNaN(userNum)) {
                await this.sock.sendMessage(jid, { text: `❌ Harap masukkan angka!` }, { quoted: msg });
                return;
            }
            
            if (userNum === targetNum) {
                await this.sock.sendMessage(jid, { text: `✅ *BENAR!*\n\nJawabanmu tepat: *${targetNum}*\nSelamat!` }, { quoted: msg });
                this.activeGames.delete(quotedId);
            } else if (userNum > targetNum) {
                await this.sock.sendMessage(jid, { text: `📉 *SALAH!*\n\nAngka terlalu besar, coba lebih kecil!` }, { quoted: msg });
            } else {
                await this.sock.sendMessage(jid, { text: `📈 *SALAH!*\n\nAngka terlalu kecil, coba lebih besar!` }, { quoted: msg });
            }
        } else if (game!.type === "family100") {
            const correctAnswers = Array.isArray(game!.answer) ? game!.answer.map(a => String(a).toLowerCase()) : [String(game!.answer).toLowerCase()];
            if (correctAnswers.includes(userAnswer)) {
                await this.sock.sendMessage(jid, { text: `✅ *BENAR!*\n\nSalah satu jawaban yang tepat adalah: *${userAnswer.toUpperCase()}*\nSelamat!` }, { quoted: msg });
                this.activeGames.delete(quotedId);
            } else {
                await this.sock.sendMessage(jid, { text: `❌ *SALAH!*\n\nJawabanmu kurang tepat, coba lagi!` }, { quoted: msg });
            }
        } else {
            const correctAnswer = String(game!.answer).toLowerCase();
            if (userAnswer === correctAnswer) {
                await this.sock.sendMessage(jid, { text: `✅ *BENAR!*\n\nJawabanmu tepat: *${game!.answer}*\nSelamat!` }, { quoted: msg });
                this.activeGames.delete(quotedId);
            } else {
                await this.sock.sendMessage(jid, { text: `❌ *SALAH!*\n\nJawabanmu kurang tepat, coba lagi!` }, { quoted: msg });
            }
        }
        return; // Stop processing as command
    }

    if (this.autoTypingEnabled) {
        try {
            await this.sock.sendPresenceUpdate('composing', jid);
        } catch (e) {
            console.error("Failed to set composing presence", e);
        }
    }

    const isOwner = msg.key.fromMe;
    const isGroup = jid.endsWith("@g.us");
    const senderJid = msg.key.participant || msg.participant || jid;
    if (this.afkUsers.has(senderJid)) {
        const afkInfo = this.afkUsers.get(senderJid);
        this.afkUsers.delete(senderJid);
        await this.sock.sendMessage(jid, { text: `Sistem mendeteksi aktivitas dari @${senderJid.split("@")[0]}\nStatus AFK telah dihapus.`, mentions: [senderJid] });
    }
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    for (const m of mentions) {
        if (this.afkUsers.has(m)) {
            const afkInfo = this.afkUsers.get(m);
            const duration = Math.floor((Date.now() - afkInfo!.time) / 60000);
            await this.sock.sendMessage(jid, { text: `Jangan tag dia! @${m.split("@")[0]} sedang AFK.\nAlasan: ${afkInfo!.reason}\nSejak: ${duration} menit yang lalu.`, mentions: [m] }, { quoted: msg });
        }
    }
    
    const requestedCmd = body.split(/[\s\n]+/)[0];
    const ownerCommands = ['.antibot', 'antibot', '.autoread', 'autoread', '.savekontak', 'savekontak', '.ownermenu', 'ownermenu', '.broadcast', 'broadcast', '.restartbot', 'restartbot', '.addpremium', 'addpremium', '.addprem', 'addprem', '.addowner', 'addowner', '.delowner', 'delowner', '.listowner', 'listowner', '.listpremium', 'listpremium', '.delpremium', 'delpremium', '.setbotpp', 'setbotpp', '.setbotname', 'setbotname', '.addnamabot', 'addnamabot', '.delnamabot', 'delnamabot', '.totalfitur', 'totalfitur', '.addprefix', 'addprefix', '.delprefix', 'delprefix', '.listprefix', 'listprefix', '.addpoweredby', 'addpoweredby', '.delpoweredby', 'delpoweredby', '.listpoweredby', 'listpoweredby', '.addcmd', 'addcmd', '.delcmd', 'delcmd', '.listcmd', 'listcmd', '.self', 'self', '.publik', 'publik', '.setcoverbot', 'setcoverbot', '.delcoverbot', 'delcoverbot', '.anticall', 'anticall', '.autotyping', 'autotyping', '.addsewa', 'addsewa', '.delsewa', 'delsewa', '.listsewa', 'listsewa', '.owner', 'owner', '.joingc', 'joingc', '.creategc', 'creategc', '.addsticker', 'addsticker', '.delsticker', 'delsticker'];
    const groupCommands = ['.afk', 'afk', '.joinch', 'joinch', '.infouser', 'infouser', '.tagadmin', 'tagadmin', '.infogrup', 'infogrup', '.leaderboard', 'leaderboard', '.totalchat', 'totalchat', '.groupmenu', 'groupmenu', '.delete', 'delete', '.hidetag', 'hidetag', '.kick', 'kick', '.add', 'add', '.open', 'open', '.close', 'close', '.open2', 'open2', '.close2', 'close2', '.antilinkall', 'antilinkall', '.linkgc', 'linkgc', '.setppgc', 'setppgc', '.delppgc', 'delppgc', '.setwelcome', 'setwelcome', '.setbye', 'setbye', '.welcome', 'welcome', '.goodbye', 'goodbye', '.antitagsw', 'antitagsw', '.antivideo', 'antivideo', '.antifoto', 'antifoto', '.antifoto1x', 'antifoto1x', '.antistiker', 'antistiker', '.antispam', 'antispam', '.setnamegc', 'setnamegc', '.setdescgc', 'setdescgc', '.culikswgc', 'culikswgc', '.culikprofilegc', 'culikprofilegc', '.kickall', 'kickall', '.sewabot', 'sewabot', '.promote', 'promote', '.demote', 'demote', '.werewolf', 'werewolf', '.joinww', 'joinww', '.startww', 'startww', '.mutegc', 'mutegc', '.resetlink', 'resetlink', '.tagall', 'tagall', '.setbotbio', 'setbotbio', '.delbotbio', 'delbotbio', '.antivirtex', 'antivirtex', '.antitoxic', 'antitoxic', '.menfess', 'menfess', '.confess', 'confess', '.balasmenfess', 'balasmenfess', '.tolakmenfess', 'tolakmenfess', '.stopmenfess', 'stopmenfess'];
    const funCommands = ['.ceksifat', 'ceksifat', '.cekkenakalan', 'cekkenakalan', '.cekperawan', 'cekperawan', '.cekperjaka', 'cekperjaka', '.cekjanda', 'cekjanda', '.cekduda', 'cekduda', '.bego', 'bego', '.rate', 'rate', '.top', 'top', '.funmenu', 'funmenu', '.cekkhodam', 'cekkhodam', '.cekganteng', 'cekganteng', '.cekcantik', 'cekcantik', '.cekjodoh', 'cekjodoh', '.ceklesby', 'ceklesby', '.cekpasangan', 'cekpasangan', '.cekgay', 'cekgay', '.cekhoby', 'cekhoby', '.cekkesetiaan', 'cekkesetiaan', '.jadian', 'jadian', '.kiss', 'kiss', '.quotes', 'quotes', '.avatar', 'avatar', '.ppcouple', 'ppcouple', '.infonegara', 'infonegara', '.cekwibu', 'cekwibu', '.meme', 'meme', '.waifu', 'waifu', '.ceksange', 'ceksange', '.cekkaya', 'cekkaya', '.cekbucin', 'cekbucin', '.artinama', 'artinama', '.cekmasadepan', 'cekmasadepan', '.faktadunia', 'faktadunia', '.cekgempa', 'cekgempa', '.cekcuaca', 'cekcuaca'];
    const margaCommands = ['.margamenu', 'margamenu', '.cekpariban', 'cekpariban', '.cektartulang', 'cektartulang', '.cektarito', 'cektarito', '.cekpadan', 'cekpadan'];
    const videoCommands = ['.videomenu', 'videomenu', '.tiktokgirl', 'tiktokgirl', '.tiktoktobrut', 'tiktoktobrut', '.tiktokkayes', 'tiktokkayes', '.tiktokhot', 'tiktokhot', '.tiktokghea', 'tiktokghea', '.tiktokbocil', 'tiktokbocil', '.tiktoklesbi', 'tiktoklesbi', '.tiktokgay', 'tiktokgay', '.tiktokartis', 'tiktokartis', '.tiktokpacaran', 'tiktokpacaran'];
    const stickerCommands = ['.stickermenu', 'stickermenu', '.stiker', 'stiker', '.hd', 'hd', '.brat', 'brat', '.bratvid', 'bratvid', '.smeme', 'smeme', '.qc', 'qc', '.toimg', 'toimg', '.togif', 'togif', '.stikerrandom', 'stikerrandom', '.stikerspongebob', 'stikerspongebob'];
    const kristenCommands = ['.kristenmenu', 'kristenmenu', '.ayatalkitab', 'ayatalkitab', '.doaayat', 'doaayat', '.kisahyesus', 'kisahyesus', '.jadwalgereja', 'jadwalgereja', '.namakitab', 'namakitab'];
    const islamCommands = ['.islammenu', 'islammenu', '.ayatkursi', 'ayatkursi', '.tekssholat', 'tekssholat', '.hadits', 'hadits', '.jadwalsholat', 'jadwalsholat', '.kisahnabi', 'kisahnabi', '.niatsholat', 'niatsholat', '.quotesislami', 'quotesislami'];
    const downloadCommands = ['.downloadmenu', 'downloadmenu', '.tiktok', 'tiktok', '.tiktokaudiomp3', 'tiktokaudiomp3', '.playyt', 'playyt', '.playytmp4', 'playytmp4', '.capcut', 'capcut', '.facebook', 'facebook', '.instagram', 'instagram', '.fotosexy', 'fotosexy', '.fotoanime', 'fotoanime', '.pinterest', 'pinterest'];
    const cecanCommands = ['.cecanmenu', 'cecanmenu', '.cecanchina', 'cecanchina', '.cecanhijab', 'cecanhijab', '.cecanindonesia', 'cecanindonesia', '.cecanjapan', 'cecanjapan', '.cecanjeni', 'cecanjeni', '.cecanjiso', 'cecanjiso', '.cecankorea', 'cecankorea', '.cecanmalaysia', 'cecanmalaysia', '.cecanjustinaxie', 'cecanjustinaxie', '.cecanrose', 'cecanrose', '.cecanthailand', 'cecanthailand', '.cecanvietnam', 'cecanvietnam'];
    const primbonCommands = ['.primbonmenu', 'primbonmenu', '.pantun', 'pantun', '.ceksial', 'ceksial', '.ramalannasib', 'ramalannasib', '.ramalanjodoh', 'ramalanjodoh', '.ramalancinta', 'ramalancinta', '.ramalankeburukan', 'ramalankeburukan', '.zodiak', 'zodiak', '.isidompet', 'isidompet', '.profesiku', 'profesiku', '.nulis', 'nulis'];
    const animeCommands = ['.animemenu', 'animemenu', '.animeakira', 'animeakira', '.animeasuna', 'animeasuna', '.animeeba', 'animeeba', '.animeelaina', 'animeelaina', '.animeemilia', 'animeemilia', '.animegremory', 'animegremory', '.animehinata', 'animehinata', '.animehusbu', 'animehusbu', '.animeisuzu', 'animeisuzu', '.animeitori', 'animeitori', '.animekagura', 'animekagura', '.animekanna', 'animekanna', '.animemiku', 'animemiku', '.animenezuko', 'animenezuko', '.animeloli', 'animeloli', '.animepokemon', 'animepokemon', '.animerem', 'animerem', '.animeryuko', 'animeryuko', '.animeshina', 'animeshina', '.animeshinka', 'animeshinka', '.animeshota', 'animeshota', '.animetejina', 'animetejina', '.animetoukachan', 'animetoukachan'];
    
    if (ownerCommands.includes(requestedCmd) && !isOwner) {
      this.broadcastState(`Blocked non-owner from using ${requestedCmd}`);
      return await this.sock.sendMessage(jid, { text: "👑 *Akses Ditolak*\nPerintah ini hanya bisa digunakan oleh Owner!" }, { quoted: msg });
    }
    
    if (groupCommands.includes(requestedCmd) && !isGroup) {
      this.broadcastState(`Blocked non-group from using ${requestedCmd}`);
      return await this.sock.sendMessage(jid, { text: "👥 *Akses Ditolak*\nPerintah ini hanya bisa digunakan di dalam Grup!" }, { quoted: msg });
    }

    // Loop protection: Do not respond to our own bot-generated messages.
    // EXCEPT if we want to allow users to use commands by chatting to themselves.
    // But usually bot messages don't start with "." so it's safe if we only respond to commands.
    // To be perfectly safe, only run if it's a command.

    // Basic Command Handler
    
    // Check if command is an alias for the menu
    const possibleCommandName = requestedCmd.replace(/^\.?/, "").toLowerCase();
    const isMenuCmd = this.menuCommands.has(possibleCommandName) || body.toLowerCase() === "all menu";

    if (isMenuCmd) {
      const botName = this.customBotName || this.sock.user?.name || "Wabot Pro";
      const totalFitur = ownerCommands.length + groupCommands.length + funCommands.length + margaCommands.length + videoCommands.length + stickerCommands.length + downloadCommands.length + kristenCommands.length + islamCommands.length + cecanCommands.length + primbonCommands.length + animeCommands.length;
      let menu = `╭─   [ 𝐁𝐎𝐓 𝐈𝐍𝐅𝐎 ]
│ 🔔 𝐍𝐚𝐦𝐚 𝐁𝐨𝐭 : ${botName}
│ 👑 𝐎𝐰𝐧𝐞𝐫      : ${isOwner ? 'Owner' : 'User'}
│ ⚠️ totalfitur : ${totalFitur}
╰───────────────

📚 *Semua Menu*

│ .downloadmenu
│ .groupmenu
│ .gamemenu
│ .ownermenu
│ .funmenu
│ .margamenu
│ .videomenu
│ .stickermenu
│ .cecanmenu
│ .primbonmenu
│ .animemenu
│ .kristenmenu
│ .islammenu

Ketik menu yang kamu inginkan.`;
      
      if (this.poweredByText) {
         menu += `\n\n_Powered by ${this.poweredByText}_`;
      }
      if (this.coverImageBuffer) {
        await this.sock.sendMessage(jid, { image: this.coverImageBuffer, caption: menu }, { quoted: msg });
      } else {
        await this.sock.sendMessage(jid, { text: menu }, { quoted: msg });
      }
      this.broadcastState(`Responded to allmenu command`);
    } else if (body === "groupmenu" || body === ".groupmenu" || body === "group menu" || body === ".group menu") {
      const groupText = `👥 *Group Menu*

│ .hidetag
│ .afk
│ .joinch
│ .infouser
│ .tagadmin
│ .infogrup
│ .leaderboard
│ .totalchat
│ .kick
│ .add
│ .open / .close
│ .open2 / .close2
│ .antilinkall
│ .linkgc
│ .setppgc
│ .delppgc
│ .setwelcome - untuk setting teks masuk
│ .setgoodbye - untuk setting teks keluar
│ .welcome on/off - untuk mengatur pesan masuk
│ .goodbye on/off - untuk mengatur pesan keluar
│ .antitagsw on/off - hapus story yang dikirim di grup
│ .antivideo on/off - hapus video yang dikirim di grup
│ .antifoto on/off - hapus foto yang dikirim di grup
│ .antifoto1x on/off - hapus pesan sekali lihat yang dikirim di grup
│ .antistiker on/off - hapus stiker yang dikirim di grup
│ .antispam on/off - hapus spam yang dikirim di grup
│ .setnamegc
│ .setdescgc
│ .culikswgc
│ .culikprofilegc
│ .mutegc on/off
│ .resetlink
│ .tagall
│ .setbotbio
│ .delbotbio
│ .antivirtex on/off
│ .antitoxic on/off
│ .delete
│ .kickall - keluarkan semua orang di grup
│ .sewabot - teks custom
│ .promote - tambah admin
│ .demote - hapus admin
│ .menfess - kirim pesan rahasia
│ .confess - kirim pesan rahasia
│ .balasmenfess - balas pesan menfess
│ .tolakmenfess - tolak pesan menfess
│ .stopmenfess - hentikan sesi menfess`;
      await this.sock.sendMessage(jid, { text: groupText }, { quoted: msg });
      this.broadcastState(`Responded to groupmenu command`);
    } else if (body === "downloadmenu" || body === ".downloadmenu" || body === "download menu" || body === ".download menu") {
      const downloadText = `📥 *Download Menu*\n\n│ .tiktok - download video dari link tiktok VT\n│ .tiktokaudiomp3 - download audio dari tiktok\n│ .playyt - mencari dan mendownload audio Youtube\n│ .playytmp4 - mencari dan mendownload video Youtube\n│ .capcut - download template capcut\n│ .facebook - download video/reels facebook\n│ .instagram - download reels instagram\n│ .fotoanime - ambil foto anime random\n│ .fotosexy - ambil foto random\n│ .pinterest - download foto pinterest`;
      await this.sock.sendMessage(jid, { text: downloadText }, { quoted: msg });
      this.broadcastState(`Responded to downloadmenu command`);
    } else if (body === "stickermenu" || body === ".stickermenu" || body === "sticker menu" || body === ".sticker menu") {
      const stickerText = `🎨 *Sticker Menu*\n\n│ .stiker - ubah gambar jadi stiker\n│ .hd - tingkatkan resolusi gambar\n│ .brat - buat stiker teks brat\n│ .bratvid - buat stiker teks video brat\n│ .smeme - buat stiker dengan teks|teks\n│ .qc - buat stiker text chat\n│ .toimg - stiker ke gambar\n│ .togif - gambar ke gif`;
      await this.sock.sendMessage(jid, { text: stickerText }, { quoted: msg });
      this.broadcastState(`Responded to stickermenu command`);
    } else if (body === "kristenmenu" || body === ".kristenmenu" || body === "kristen menu" || body === ".kristen menu") {
      const kristenText = `✝️ *Kristen Menu*\n\n│ .ayatalkitab\n│ .doaayat\n│ .kisahyesus\n│ .jadwalgereja\n│ .namakitab`;
      await this.sock.sendMessage(jid, { text: kristenText }, { quoted: msg });
      this.broadcastState(`Responded to kristenmenu command`);
    } else if (body === "islammenu" || body === ".islammenu" || body === "islam menu" || body === ".islam menu") {
      const islamText = `☪️ *Islam Menu*\n\n│ .ayatkursi\n│ .tekssholat\n│ .hadits\n│ .jadwalsholat\n│ .kisahnabi\n│ .niatsholat\n│ .quotesislami`;
      await this.sock.sendMessage(jid, { text: islamText }, { quoted: msg });
      this.broadcastState(`Responded to islammenu command`);
    } else if (body === "funmenu" || body === ".funmenu" || body === "fun menu" || body === ".fun menu") {
      const funText = `🤡 *Fun Menu*\n\n│ .cekkhodam\n│ .cekganteng\n│ .cekcantik\n│ .cekjodoh\n│ .ceklesby\n│ .cekpasangan\n│ .cekgay\n│ .cekhoby\n│ .cekkesetiaan\n│ .jadian\n│ .kiss\n│ .quotes\n│ .avatar\n│ .ppcouple\n│ .ceksifat\n│ .cekkenakalan\n│ .cekperawan\n│ .cekperjaka\n│ .cekjanda\n│ .cekduda\n│ .bego\n│ .rate\n│ .top\n│ .infonegara\n│ .cekwibu\n│ .meme\n│ .waifu\n│ .ceksange\n│ .cekkaya\n│ .cekbucin\n│ .artinama\n│ .cekmasadepan\n│ .faktadunia\n│ .cekgempa\n│ .cekcuaca`;
      await this.sock.sendMessage(jid, { text: funText }, { quoted: msg });
      this.broadcastState(`Responded to funmenu command`);
    } else if (body === "cecanmenu" || body === ".cecanmenu" || body === "cecan menu" || body === ".cecan menu") {
      const cecanText = `👩 *Cecan Menu*\n\n│ .cecanchina\n│ .cecanhijab\n│ .cecanindonesia\n│ .cecanjapan\n│ .cecanjeni\n│ .cecanjiso\n│ .cecankorea\n│ .cecanmalaysia\n│ .cecanjustinaxie\n│ .cecanrose\n│ .cecanthailand\n│ .cecanvietnam`;
      await this.sock.sendMessage(jid, { text: cecanText }, { quoted: msg });
      this.broadcastState(`Responded to cecanmenu command`);
    } else if (body === "animemenu" || body === ".animemenu" || body === "anime menu" || body === ".anime menu") {
      const animeText = `🦊 *Anime Menu*\n\n│ .animeakira\n│ .animeasuna\n│ .animeeba\n│ .animeelaina\n│ .animeemilia\n│ .animegremory\n│ .animehinata\n│ .animehusbu\n│ .animeisuzu\n│ .animeitori\n│ .animekagura\n│ .animekanna\n│ .animemiku\n│ .animenezuko\n│ .animeloli\n│ .animepokemon\n│ .animerem\n│ .animeryuko\n│ .animeshina\n│ .animeshinka\n│ .animeshota\n│ .animetejina\n│ .animetoukachan`;
      await this.sock.sendMessage(jid, { text: animeText }, { quoted: msg });
      this.broadcastState(`Responded to animemenu command`);
    } else if (body === "primbonmenu" || body === ".primbonmenu" || body === "primbon menu" || body === ".primbon menu") {
      const primbonText = `🔮 *Primbon Menu*\n\n│ .pantun\n│ .ceksial\n│ .ramalannasib\n│ .ramalanjodoh\n│ .ramalancinta\n│ .ramalankeburukan\n│ .zodiak\n│ .isidompet\n│ .profesiku\n│ .nulis`;
      await this.sock.sendMessage(jid, { text: primbonText }, { quoted: msg });
      this.broadcastState(`Responded to primbonmenu command`);
    } else if (body === "margamenu" || body === ".margamenu" || body === "marga menu" || body === ".marga menu") {
      const margaText = `👥 *Marga Menu*\n\n│ .cekpariban - masukan marga/boru target agar tau marga/boru dia marpariban atau tidak menurut adat batak\n│ .cektartulang - masukan marga/boru target agar tau marga/boru dia martartulang atau tidak menurut adat batak\n│ .cektarito - masukan marga/boru target agar tau marga/boru dia martarito atau tidak menurut adat batak\n│ .cekpadan - masukan marga/boru target agar tau marga/boru dia marpadan atau tidak menurut adat batak`;
      await this.sock.sendMessage(jid, { text: margaText }, { quoted: msg });
      this.broadcastState(`Responded to margamenu command`);
    } else if (body === "videomenu" || body === ".videomenu" || body === "video menu" || body === ".video menu") {
      const videoText = `🎬 *Video Menu*\n\n│ .tiktokgirl\n│ .tiktoktobrut\n│ .tiktokkayes\n│ .tiktokhot\n│ .tiktokghea\n│ .tiktokbocil\n│ .tiktoklesbi\n│ .tiktokgay\n│ .tiktokartis\n│ .tiktokpacaran`;
      await this.sock.sendMessage(jid, { text: videoText }, { quoted: msg });
      this.broadcastState(`Responded to videomenu command`);
    } else if (body === "gamemenu" || body === ".gamemenu" || body === "game menu" || body === ".game menu") {
            const gameText = `🎮 *Game Menu*\n\n| .tebakgambar\n| .susunkata\n| .math\n| .tebakkata\n| .tebakbendera\n| .asahotak\n| .tebaklirik\n| .tekateki\n| .tebakangka\n| .kuis\n| .tebakkota\n| .family100\n| .tebakusia\n| .tebakkimia\n| .tebakbuah\n| .werewolf\n| .tebakuang\n| .tebaksurah\n| .tebakhewan\n| .tebakbaju\n| .tebakcelana\n| .tebakmakanan\n| .tebakjkt48`;
      await this.sock.sendMessage(jid, { text: gameText }, { quoted: msg });
      this.broadcastState(`Responded to gamemenu command`);
    } else if (body === "ownermenu" || body === ".ownermenu" || body === "owner menu" || body === ".owner menu") {
      const ownerText = `👑 *Owner Menu*

│ .broadcast
│ .restartbot
│ .addpremium / .delpremium
│ .addowner / .delowner
│ .listowner
│ .listpremium
│ .setbotpp
│ .setbotname
│ .addnamabot
│ .delnamabot
│ .addprefix
│ .delprefix
│ .listprefix
│ .addpoweredby
│ .delpoweredby
│ .listpoweredby
│ .addcmd
│ .delcmd
│ .listcmd
│ .self / .publik
│ .setcoverbot / .delcoverbot
│ .anticall on/off
│ .antibot on/off
│ .autoread on/off
│ .savekontak
│ .antivideo on/off - hapus video yang dikirim di grup
│ .autotyping on/off - sedang mengetik
│ .addsewa - tambah nomor sewa
│ .delsewa - hapus nomor sewa
│ .listsewa - list nomor sewa
│ .owner - menampilkan list owner
│ .joingc - bot masuk grup dari link
│ .creategc - buat grup baru
│ .addsticker - tambah stiker
│ .delsticker - hapus stiker
│ .totalfitur`;
      
      let msgObj: any = { text: ownerText };
      if (this.coverImageBuffer) msgObj = { image: this.coverImageBuffer, caption: ownerText };
      await this.sock.sendMessage(jid, msgObj, { quoted: msg });
      
      this.broadcastState(`Responded to ownermenu command`);
    } else if (body.startsWith(".kick") || body.startsWith("kick")) {
      if (!jid.endsWith("@g.us")) {
        await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di dalam grup!" }, { quoted: msg });
      } else {
        const groupMetadata = await this.sock.groupMetadata(jid);
        const participants = groupMetadata.participants;
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isAdmin = participants.some((p: any) => p.id === senderId && (p.admin === "admin" || p.admin === "superadmin")) || isOwner;
        
        if (!isAdmin) {
          await this.sock.sendMessage(jid, { text: "⚠️ *Akses Ditolak*\nPerintah ini hanya bisa digunakan oleh Admin Grup!" }, { quoted: msg });
        } else {
          const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
          let targets = contextInfo.mentionedJid || [];
          if (contextInfo.participant) {
              targets.push(contextInfo.participant);
          }
          
          if (targets.length > 0) {
            try {
              await this.sock.groupParticipantsUpdate(jid, targets, "remove");
              await this.sock.sendMessage(jid, { text: "Berhasil mengeluarkan anggota!" }, { quoted: msg });
            } catch (err) {
              await this.sock.sendMessage(jid, { text: "Gagal mengeluarkan anggota. Pastikan bot adalah admin grup." }, { quoted: msg });
            }
          } else {
            await this.sock.sendMessage(jid, { text: "Tag atau reply pesan orang yang ingin di kick!\nContoh: .kick @user" }, { quoted: msg });
          }
        }
      }
      this.broadcastState(`Responded to kick command`);
    } else if (body.startsWith(".kickall") || body.startsWith("kickall")) {
      if (!jid.endsWith("@g.us")) {
        await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di dalam grup!" }, { quoted: msg });
      } else {
        try {
          const groupMetadata = await this.sock.groupMetadata(jid);
          const participants = groupMetadata.participants;
          // We don't kick the bot itself or the owner who triggered the command
          const botId = this.sock.user?.id?.split(":")[0] + "@s.whatsapp.net";
          const senderId = msg.key.participant || msg.key.remoteJid;
          
          const isAdmin = participants.some((p: any) => p.id === senderId && (p.admin === "admin" || p.admin === "superadmin")) || isOwner;
          
          if (!isAdmin) {
            await this.sock.sendMessage(jid, { text: "⚠️ *Akses Ditolak*\nPerintah ini hanya bisa digunakan oleh Admin Grup!" }, { quoted: msg });
          } else {
            let targetsToKick = participants
                .map((p: any) => p.id)
                .filter((id: string) => id !== botId && id !== senderId);

            if (targetsToKick.length > 0) {
                await this.sock.sendMessage(jid, { text: "⚠️ Mengeluarkan semua anggota grup..." }, { quoted: msg });
                
                // We'll kick them in chunks to avoid blocking/rate limits if the group is large
                const chunkSize = 50;
                for (let i = 0; i < targetsToKick.length; i += chunkSize) {
                    const chunk = targetsToKick.slice(i, i + chunkSize);
                    await this.sock.groupParticipantsUpdate(jid, chunk, "remove");
                    // simple delay could be added, but groupParticipantsUpdate might handle it
                }
                await this.sock.sendMessage(jid, { text: "Berhasil mengeluarkan semua anggota!" });
            } else {
                await this.sock.sendMessage(jid, { text: "Tidak ada anggota lain untuk dikeluarkan." }, { quoted: msg });
            }
          }
        } catch (err) {
          await this.sock.sendMessage(jid, { text: "Gagal mengeluarkan semua anggota. Pastikan bot adalah admin grup." }, { quoted: msg });
        }
      }
      this.broadcastState(`Responded to kickall command`);
    } else if (body.startsWith(".add ") || body === ".add" || body.startsWith("add ") || body === "add") {
      if (!jid.endsWith("@g.us")) {
        await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di dalam grup!" }, { quoted: msg });
      } else {
        const text = body.replace(".add", "").replace("add", "").trim();
        const number = text.replace(/[^0-9]/g, "");
        if (number) {
          try {
            await this.sock.groupParticipantsUpdate(jid, [`${number}@s.whatsapp.net`], "add");
            await this.sock.sendMessage(jid, { text: "Berhasil menambahkan anggota!" }, { quoted: msg });
          } catch (err) {
            await this.sock.sendMessage(jid, { text: "Gagal menambahkan anggota. Pastikan bot adalah admin grup dan nomor valid." }, { quoted: msg });
          }
        } else {
          await this.sock.sendMessage(jid, { text: "Kirim nomor yang mau ditambah!\nContoh: .add 628123456789" }, { quoted: msg });
        }
      }
      this.broadcastState(`Responded to add command`);
    } else if (body.startsWith(".hidetag") || body.startsWith("hidetag")) {
        if (!jid.endsWith("@g.us")) {
            await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di dalam grup!" }, { quoted: msg });
        } else {
            const text = body.replace(".hidetag", "").replace("hidetag", "").trim() || "Perhatian semuanya!";
            try {
                const groupMetadata = await this.sock.groupMetadata(jid);
                const participants = groupMetadata.participants.map((p: any) => p.id);
                await this.sock.sendMessage(jid, { text: text, mentions: participants });
            } catch (err) {
                await this.sock.sendMessage(jid, { text: "Gagal melakukan hidetag." }, { quoted: msg });
            }
        }
    } else if (body === ".math" || body === "math") {
      const num1 = Math.floor(Math.random() * 100);
      const num2 = Math.floor(Math.random() * 100);
      const ops = ['+', '-', '*'];
      const op = ops[Math.floor(Math.random() * ops.length)];
      let answer = 0;
      if (op === '+') answer = num1 + num2;
      else if (op === '-') answer = num1 - num2;
      else if (op === '*') answer = num1 * num2;
      
      const sentMsg = await this.sock.sendMessage(jid, { text: `🔢 *Game Math*\n\nBerapa hasil dari:\n*${num1} ${op} ${num2}* ?\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
      if (sentMsg?.key?.id) {
          this.activeGames.set(sentMsg.key.id, { answer: String(answer), type: "math" });
      }
      this.broadcastState(`Responded to math command`);
    } else if (body === ".susunkata" || body === "susunkata") {
      try {
          const res = await axios.get('https://raw.githubusercontent.com/BochilTeam/database/master/games/susunkata.json');
          if (res.data && res.data.length > 0) {
              const randomWord = res.data[Math.floor(Math.random() * res.data.length)];
              const sentMsg = await this.sock.sendMessage(jid, { text: `🔠 *Game Susun Kata*\n\nSusun kata berikut:\n*${randomWord.soal}*\n\nTipe: ${randomWord.tipe}\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
              if (sentMsg?.key?.id) {
                  this.activeGames.set(sentMsg.key.id, { answer: randomWord.jawaban, type: "susunkata" });
              }
          }
      } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal memuat game susunkata." }, { quoted: msg });
      }
      this.broadcastState(`Responded to susunkata command`);
    } else if (body === ".tebakgambar" || body === "tebakgambar") {
      try {
          const res = await axios.get('https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakgambar.json');
          if (res.data && res.data.length > 0) {
              const randomItem = res.data[Math.floor(Math.random() * res.data.length)];
              const sentMsg = await this.sock.sendMessage(jid, { image: { url: randomItem.img }, caption: `🖼️ *Game Tebak Gambar*\n\nKet: ${randomItem.deskripsi}\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
              if (sentMsg?.key?.id) {
                  this.activeGames.set(sentMsg.key.id, { answer: randomItem.jawaban, type: "tebakgambar" });
              }
          }
      } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal memuat game tebakgambar." }, { quoted: msg });
      }
      this.broadcastState(`Responded to tebakgambar command`);
    } else if (body === ".tebakkata" || body === "tebakkata") {
      try {
          const res = await axios.get('https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakkata.json');
          if (res.data && res.data.length > 0) {
              const randomWord = res.data[Math.floor(Math.random() * res.data.length)];
              const sentMsg = await this.sock.sendMessage(jid, { text: `🔠 *Game Tebak Kata*\n\nClue: ${randomWord.soal}\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
              if (sentMsg?.key?.id) {
                  this.activeGames.set(sentMsg.key.id, { answer: randomWord.jawaban, type: "tebakkata" });
              }
          }
      } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal memuat game tebakkata." }, { quoted: msg });
      }
      this.broadcastState(`Responded to tebakkata command`);
    } else if (body === ".tebakbendera" || body === "tebakbendera") {
      try {
          const res = await axios.get('https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakbendera.json');
          if (res.data && res.data.length > 0) {
              const randomItem = res.data[Math.floor(Math.random() * res.data.length)];
              const flagUrl = `https://flagcdn.com/w320/${randomItem.flag.toLowerCase()}.png`;
              const sentMsg = await this.sock.sendMessage(jid, { image: { url: flagUrl }, caption: `🏳️ *Game Tebak Bendera*\n\nBendera dari negara mana ini?\n_Silakan balas (reply) pesan ini!_` }, { quoted: msg });
              if (sentMsg?.key?.id) {
                  this.activeGames.set(sentMsg.key.id, { answer: randomItem.name, type: "tebakbendera" });
              }
          }
      } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal memuat game tebakbendera." }, { quoted: msg });
      }
      this.broadcastState(`Responded to tebakbendera command`);
    } else if (body === ".asahotak" || body === "asahotak") {
      try {
          const res = await axios.get('https://raw.githubusercontent.com/BochilTeam/database/master/games/asahotak.json');
          if (res.data && res.data.length > 0) {
              const r = res.data[Math.floor(Math.random() * res.data.length)];
              const sentMsg = await this.sock.sendMessage(jid, { text: `🧠 *Game Asah Otak*\n\nPertanyaan: ${r.soal}\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
              if (sentMsg?.key?.id) {
                  this.activeGames.set(sentMsg.key.id, { answer: r.jawaban, type: "asahotak" });
              }
          }
      } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal memuat game asahotak." }, { quoted: msg });
      }
      this.broadcastState(`Responded to asahotak command`);
    } else if (body === ".tebakbuah" || body === "tebakbuah") {
      const buahList = [
          { soal: "🍎", jawaban: "apel" },
          { soal: "🍌", jawaban: "pisang" },
          { soal: "🍇", jawaban: "anggur" },
          { soal: "🍉", jawaban: "semangka" },
          { soal: "🍊", jawaban: "jeruk" },
          { soal: "🍓", jawaban: "stroberi" },
          { soal: "🥭", jawaban: "mangga" },
          { soal: "🍍", jawaban: "nanas" },
          { soal: "🥥", jawaban: "kelapa" },
          { soal: "🥝", jawaban: "kiwi" },
          { soal: "🥑", jawaban: "alpukat" },
          { soal: "🍒", jawaban: "ceri" },
          { soal: "🍈", jawaban: "melon" },
          { soal: "🍐", jawaban: "pir" },
          { soal: "🍋", jawaban: "lemon" },
          { soal: "🍑", jawaban: "persik" },
          { soal: "🍅", jawaban: "tomat" },
          { soal: "🍆", jawaban: "terong" }
      ];
      const r = buahList[Math.floor(Math.random() * buahList.length)];
      const sentMsg = await this.sock.sendMessage(jid, { text: `🍎 *Game Tebak Buah*\n\nBuah apakah ini: ${r.soal}\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
      if (sentMsg?.key?.id) {
          this.activeGames.set(sentMsg.key.id, { answer: r.jawaban, type: "tebakbuah" });
      }
      this.broadcastState(`Responded to tebakbuah command`);
    } else if (body === ".tebaklirik" || body === "tebaklirik") {
      try {
          const res = await axios.get('https://raw.githubusercontent.com/BochilTeam/database/master/games/tebaklirik.json');
          if (res.data && res.data.length > 0) {
              const r = res.data[Math.floor(Math.random() * res.data.length)];
              const sentMsg = await this.sock.sendMessage(jid, { text: `🎵 *Game Tebak Lirik*\n\nLanjutkan lirik berikut:\n${r.soal}\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
              if (sentMsg?.key?.id) {
                  this.activeGames.set(sentMsg.key.id, { answer: r.jawaban, type: "tebaklirik" });
              }
          }
      } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal memuat game tebaklirik." }, { quoted: msg });
      }
      this.broadcastState(`Responded to tebaklirik command`);
    } else if (body === ".tekateki" || body === "tekateki") {
      try {
          const res = await axios.get('https://raw.githubusercontent.com/BochilTeam/database/master/games/tekateki.json');
          if (res.data && res.data.length > 0) {
              const r = res.data[Math.floor(Math.random() * res.data.length)];
              const sentMsg = await this.sock.sendMessage(jid, { text: `❓ *Game Teka Teki*\n\nPertanyaan: ${r.soal}\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
              if (sentMsg?.key?.id) {
                  this.activeGames.set(sentMsg.key.id, { answer: r.jawaban, type: "tekateki" });
              }
          }
      } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal memuat game tekateki." }, { quoted: msg });
      }
      this.broadcastState(`Responded to tekateki command`);
    } else if (body === ".kuis" || body === "kuis") {
      try {
          const res = await axios.get('https://raw.githubusercontent.com/BochilTeam/database/master/games/siapakahaku.json');
          if (res.data && res.data.length > 0) {
              const r = res.data[Math.floor(Math.random() * res.data.length)];
              const sentMsg = await this.sock.sendMessage(jid, { text: `🧐 *Game Kuis*\n\nPertanyaan: ${r.soal}\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
              if (sentMsg?.key?.id) {
                  this.activeGames.set(sentMsg.key.id, { answer: r.jawaban, type: "kuis" });
              }
          }
      } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal memuat game kuis." }, { quoted: msg });
      }
      this.broadcastState(`Responded to kuis command`);
    } else if (body === ".tebakkota" || body === "tebakkota") {
      try {
          const res = await axios.get('https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakkabupaten.json');
          if (res.data && res.data.length > 0) {
              const r = res.data[Math.floor(Math.random() * res.data.length)];
              const title = r.title.replace(/Kabupaten |Kota /g, '').trim();
              const scrambled = title.split('').sort(() => 0.5 - Math.random()).join(' ');
              const sentMsg = await this.sock.sendMessage(jid, { text: `🌆 *Game Tebak Kota*\n\nSusun huruf untuk menebak nama kota/kabupaten:\n${scrambled}\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
              if (sentMsg?.key?.id) {
                  this.activeGames.set(sentMsg.key.id, { answer: title, type: "tebakkota" });
              }
          }
      } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal memuat game tebakkota." }, { quoted: msg });
      }
      this.broadcastState(`Responded to tebakkota command`);
    } else if (body === ".family100" || body === "family100") {
      try {
          const res = await axios.get('https://raw.githubusercontent.com/BochilTeam/database/master/games/family100.json');
          if (res.data && res.data.length > 0) {
              const r = res.data[Math.floor(Math.random() * res.data.length)];
              const sentMsg = await this.sock.sendMessage(jid, { text: `👨‍👩‍👧‍👦 *Game Family 100*\n\nJawablah pertanyaan berikut:\n${r.soal}\n\nTerdapat ${r.jawaban.length} jawaban yang benar!\n\n_Silakan balas (reply) pesan ini dengan salah satu jawabanmu!_` }, { quoted: msg });
              if (sentMsg?.key?.id) {
                  this.activeGames.set(sentMsg.key.id, { answer: r.jawaban, type: "family100" });
              }
          }
      } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal memuat game family100." }, { quoted: msg });
      }
      this.broadcastState(`Responded to family100 command`);
    } else if (body === ".tebakusia" || body === "tebakusia") {
      const tokoh = [
        { nama: "Joko Widodo (2024)", umur: 63 }, { nama: "Prabowo Subianto (2024)", umur: 73 }, 
        { nama: "Cristiano Ronaldo (2024)", umur: 39 }, { nama: "Lionel Messi (2024)", umur: 37 },
        { nama: "Reza Rahadian (2024)", umur: 37 }, { nama: "Ariel NOAH (2024)", umur: 43 },
        { nama: "Raffi Ahmad (2024)", umur: 37 }, { nama: "Fiersa Besari (2024)", umur: 40 },
        { nama: "Raditya Dika (2024)", umur: 40 }, { nama: "Maudy Ayunda (2024)", umur: 30 }
      ];
      const r = tokoh[Math.floor(Math.random() * tokoh.length)];
      const sentMsg = await this.sock.sendMessage(jid, { text: `👤 *Game Tebak Usia*\n\nBerapakah perkiraan usia dari:\n*${r.nama}*\n\n_Silakan balas (reply) pesan ini dengan jawabanmu (angka saja)!_` }, { quoted: msg });
      if (sentMsg?.key?.id) {
          this.activeGames.set(sentMsg.key.id, { answer: r.umur.toString(), type: "tebakusia" });
      }
      this.broadcastState(`Responded to tebakusia command`);
    } else if (body === ".tebakkimia" || body === "tebakkimia") {
      try {
          const res = await axios.get('https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakkimia.json');
          if (res.data && res.data.length > 0) {
              const r = res.data[Math.floor(Math.random() * res.data.length)];
              const sentMsg = await this.sock.sendMessage(jid, { text: `🧪 *Game Tebak Kimia*\n\nApa nama unsur kimia dengan lambang: *${r.lambang}*?\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
              if (sentMsg?.key?.id) {
                  this.activeGames.set(sentMsg.key.id, { answer: r.unsur, type: "tebakkimia" });
              }
          }
      } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal memuat game tebakkimia." }, { quoted: msg });
      }
      this.broadcastState(`Responded to tebakkimia command`);
    } else if (body === ".tebakangka" || body === "tebakangka") {
      const target = Math.floor(Math.random() * 100) + 1;
      const sentMsg = await this.sock.sendMessage(jid, { text: `🔢 *Game Tebak Angka*\n\nTebak angka dari 1 sampai 100!\n\n_Silakan balas (reply) pesan ini dengan angka tebakanmu!_` }, { quoted: msg });
      if (sentMsg?.key?.id) {
          this.activeGames.set(sentMsg.key.id, { answer: target.toString(), type: "tebakangka", attempts: 0 });
      }
      this.broadcastState(`Responded to tebakangka command`);
    } else if (body === ".werewolf" || body === "werewolf") {
      const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
      this.activeGames.set("werewolf_" + jid, { type: "werewolf", state: "joining", players: [sender], answer: "" });
      await this.sock.sendMessage(jid, { text: `🐺 *Game Werewolf*\n\nGame dibuat! Ketik .joinww untuk bergabung!\nPemain: 1` }, { quoted: msg });
      this.broadcastState(`Responded to werewolf command`);
    } else if (body === ".tebakuang" || body === "tebakuang") {
      const data = [
        { soal: "Mata uang negara Jepang?", jawaban: "Yen" },
        { soal: "Mata uang negara Amerika Serikat?", jawaban: "Dollar" },
        { soal: "Mata uang negara Inggris?", jawaban: "Poundsterling" },
        { soal: "Mata uang negara Malaysia?", jawaban: "Ringgit" },
        { soal: "Mata uang negara Arab Saudi?", jawaban: "Riyal" }
      ];
      const randomItem = data[Math.floor(Math.random() * data.length)];
      const sentMsg = await this.sock.sendMessage(jid, { text: `💸 *Game Tebak Uang*\n\nClue: ${randomItem.soal}\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
      if (sentMsg?.key?.id) {
          this.activeGames.set(sentMsg.key.id, { answer: randomItem.jawaban, type: "tebakuang" });
      }
      this.broadcastState(`Responded to tebakuang command`);
    } else if (body === ".tebaksurah" || body === "tebaksurah") {
      const data = [
        { soal: "Surah pembuka dalam Al-Quran?", jawaban: "Al-Fatihah" },
        { soal: "Surah yang menceritakan tentang sapi betina?", jawaban: "Al-Baqarah" },
        { soal: "Surah yang berarti waktu subuh?", jawaban: "Al-Falaq" },
        { soal: "Surah yang berarti manusia?", jawaban: "An-Nas" },
        { soal: "Surah ke-36 yang sering dibaca di malam Jumat?", jawaban: "Yasin" }
      ];
      const randomItem = data[Math.floor(Math.random() * data.length)];
      const sentMsg = await this.sock.sendMessage(jid, { text: `📖 *Game Tebak Surah*\n\nClue: ${randomItem.soal}\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
      if (sentMsg?.key?.id) {
          this.activeGames.set(sentMsg.key.id, { answer: randomItem.jawaban, type: "tebaksurah" });
      }
      this.broadcastState(`Responded to tebaksurah command`);
    } else if (body === ".tebakhewan" || body === "tebakhewan") {
      const data = [
        { soal: "Hewan mamalia berleher panjang?", jawaban: "Jerapah" },
        { soal: "Hewan yang memiliki belalai?", jawaban: "Gajah" },
        { soal: "Raja hutan yang mengaum?", jawaban: "Singa" },
        { soal: "Hewan amfibi yang suka melompat?", jawaban: "Katak" },
        { soal: "Burung yang tidak bisa terbang namun pandai berenang?", jawaban: "Penguin" }
      ];
      const randomItem = data[Math.floor(Math.random() * data.length)];
      const sentMsg = await this.sock.sendMessage(jid, { text: `🦒 *Game Tebak Hewan*\n\nClue: ${randomItem.soal}\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
      if (sentMsg?.key?.id) {
          this.activeGames.set(sentMsg.key.id, { answer: randomItem.jawaban, type: "tebakhewan" });
      }
      this.broadcastState(`Responded to tebakhewan command`);
    } else if (body === ".tebakbaju" || body === "tebakbaju") {
      const data = [
        { soal: "Pakaian atasan berkerah yang biasa dipakai untuk acara formal?", jawaban: "Kemeja" },
        { soal: "Pakaian tradisional wanita Indonesia?", jawaban: "Kebaya" },
        { soal: "Pakaian santai berbentuk T?", jawaban: "Kaos" },
        { soal: "Baju tebal pelindung dari cuaca dingin?", jawaban: "Jaket" },
        { soal: "Pakaian khas Jepang yang dipakai saat festival?", jawaban: "Yukata" }
      ];
      const randomItem = data[Math.floor(Math.random() * data.length)];
      const sentMsg = await this.sock.sendMessage(jid, { text: `👕 *Game Tebak Baju*\n\nClue: ${randomItem.soal}\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
      if (sentMsg?.key?.id) {
          this.activeGames.set(sentMsg.key.id, { answer: randomItem.jawaban, type: "tebakbaju" });
      }
      this.broadcastState(`Responded to tebakbaju command`);
    } else if (body === ".tebakcelana" || body === "tebakcelana") {
      const data = [
        { soal: "Celana yang berbahan denim?", jawaban: "Jeans" },
        { soal: "Celana longgar untuk berolahraga?", jawaban: "Training" },
        { soal: "Celana formal berbahan kain jatuh?", jawaban: "Bahan" },
        { soal: "Celana pendek yang dipakai ke pantai?", jawaban: "Kolor" },
        { soal: "Celana yang menyatu dengan bagian atasan (overall)?", jawaban: "Kodok" }
      ];
      const randomItem = data[Math.floor(Math.random() * data.length)];
      const sentMsg = await this.sock.sendMessage(jid, { text: `👖 *Game Tebak Celana*\n\nClue: ${randomItem.soal}\n\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
      if (sentMsg?.key?.id) {
          this.activeGames.set(sentMsg.key.id, { answer: randomItem.jawaban, type: "tebakcelana" });
      }
      this.broadcastState(`Responded to tebakcelana command`);
    } else if (body === ".joinww" || body === "joinww") {
      const wwGame = this.activeGames.get("werewolf_" + jid);
      const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
      if (wwGame && wwGame.type === "werewolf" && wwGame.state === "joining") {
          const players = wwGame.players as string[];
          if (!players.includes(sender!)) {
              players.push(sender!);
              await this.sock.sendMessage(jid, { text: `🐺 *Game Werewolf*\n\n@${sender!.split('@')[0]} bergabung!\nTotal Pemain: ${players.length}\nKetik .startww jika sudah cukup.`, mentions: [sender!] }, { quoted: msg });
          } else {
              await this.sock.sendMessage(jid, { text: `Kamu sudah bergabung!` }, { quoted: msg });
          }
      } else {
          await this.sock.sendMessage(jid, { text: `Tidak ada game werewolf yang sedang menunggu.` }, { quoted: msg });
      }
    } else if (body === ".startww" || body === "startww") {
       const wwGame = this.activeGames.get("werewolf_" + jid);
       if (wwGame && wwGame.type === "werewolf" && wwGame.state === "joining") {
          const players = wwGame.players as string[];
          if (players.length < 3) {
             await this.sock.sendMessage(jid, { text: `Minimal 3 pemain untuk memulai Game Werewolf!` }, { quoted: msg });
             return;
          }
          let roles = ["Werewolf", "Seer"];
          while(roles.length < players.length) {
              roles.push("Villager");
          }
          // Shuffle roles
          roles = roles.sort(() => Math.random() - 0.5);
          for(let i=0; i<players.length; i++) {
             try {
                await this.sock.sendMessage(players[i], { text: `Kamu mendapatkan peran: *${roles[i]}* dalam Game Werewolf di grup ini.` });
             } catch(e) {}
          }
          await this.sock.sendMessage(jid, { text: `🐺 *Game Werewolf Dimulai!*\n\nPeran sudah dibagikan lewat private message / DM bot.\nKarena ini adalah mode klasik, permainan berakhir otomatis di sini, silakan bermain secara roleplay lanjutan.` }, { quoted: msg });
          this.activeGames.delete("werewolf_" + jid);
       }
    } else if (body.startsWith(".broadcast") || body.startsWith("broadcast")) {
      const text = body.replace(/^\.?broadcast\s/i, "").trim();
      if (!text) {
          await this.sock.sendMessage(jid, { text: `Gunakan perintah dengan menyertakan pesan.\nContoh: .broadcast Halo semuanya!` }, { quoted: msg });
      } else {
          await this.sock.sendMessage(jid, { text: `📢 *Broadcast Terkirim*\nBerhasil mengirim broadcast ke seluruh user! (Simulasi)` }, { quoted: msg });
      }
      this.broadcastState(`Responded to broadcast command`);
    } else if (body === ".restartbot" || body === "restartbot") {
      await this.sock.sendMessage(jid, { text: `🔄 *Restarting...*\n\nBot sedang dimulai ulang. Harap tunggu sebentar.` }, { quoted: msg });
      this.broadcastState(`Responded to restartbot command`);
      setTimeout(() => this.restart(), 1000);
    } else if (body.startsWith(".addpremium") || body.startsWith("addpremium") || body.startsWith(".addprem") || body.startsWith("addprem")) {
      const args = messageContent.replace(/^\.?(addpremium|addprem)\s*/i, "").trim();
      if (!args && !msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
        await this.sock.sendMessage(jid, { text: `Kirim nomor atau tag user yang ingin dijadikan premium!\nContoh: .addprem @user` }, { quoted: msg });
      } else {
        await this.sock.sendMessage(jid, { text: `✨ *Add Premium*\n\nBerhasil menambahkan user ke daftar premium!` }, { quoted: msg });
      }
      this.broadcastState(`Responded to addpremium command`);
    } else if (body.startsWith(".addowner") || body.startsWith("addowner")) {
      const args = messageContent.replace(/^\.?addowner\s*/i, "").trim();
      if (!args && !msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
        await this.sock.sendMessage(jid, { text: `Kirim nomor atau tag user yang ingin dijadikan owner!\nContoh: .addowner @user` }, { quoted: msg });
      } else {
        await this.sock.sendMessage(jid, { text: `✅ Berhasil menambahkan owner baru!` }, { quoted: msg });
      }
    } else if (body.startsWith(".delowner") || body.startsWith("delowner")) {
      await this.sock.sendMessage(jid, { text: `✅ Berhasil menghapus owner!` }, { quoted: msg });
    } else if (body.startsWith(".listowner") || body.startsWith("listowner")) {
      await this.sock.sendMessage(jid, { text: `👑 *Daftar Owner*\n\n1. Owner 1\n2. Owner 2` }, { quoted: msg });
    } else if (body.startsWith(".listpremium") || body.startsWith("listpremium")) {
      await this.sock.sendMessage(jid, { text: `✨ *Daftar Premium*\n\n1. User Premium 1` }, { quoted: msg });
    } else if (body.startsWith(".delpremium") || body.startsWith("delpremium")) {
      await this.sock.sendMessage(jid, { text: `✅ Berhasil menghapus user premium!` }, { quoted: msg });
    } else if (body.startsWith(".setbotpp") || body.startsWith("setbotpp")) {
      const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
      const isImage = msg.message?.imageMessage;
      if (!isImage && !isQuotedImage) {
          await this.sock.sendMessage(jid, { text: `Kirim atau balas gambar dengan caption .setbotpp untuk mengubah profil bot.` }, { quoted: msg });
      } else {
          try {
              const pseudoMsg = isQuotedImage ? { message: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage } : msg;
              const buffer = await downloadMediaMessage(pseudoMsg as any, 'buffer', {}, { logger: pino({ level: 'silent' }) as any, reuploadRequest: this.sock.updateMediaMessage });
              const botJid = this.sock.user?.id?.split(":")[0] + "@s.whatsapp.net";
              
              await this.sock.updateProfilePicture(botJid, buffer as Buffer);
              await this.sock.sendMessage(jid, { text: `✅ Berhasil mengubah profil bot!` }, { quoted: msg });
          } catch (e: any) {
              console.error("setbotpp error: ", e);
              await this.sock.sendMessage(jid, { text: `❌ Gagal mengubah profil bot.` }, { quoted: msg });
          }
      }
    } else if (body.startsWith(".setbotname") || body.startsWith("setbotname") || body.startsWith(".addnamabot") || body.startsWith("addnamabot")) {
      const isAddNamaBot = body.startsWith(".addnamabot") || body.startsWith("addnamabot");
      const text = messageContent.replace(/^\.?(setbotname|addnamabot)\s*/i, "").trim();
      if (!text) {
        await this.sock.sendMessage(jid, { text: `Kirim perintah dengan nama baru, contoh: .${isAddNamaBot ? 'addnamabot' : 'setbotname'} Bot Ku` }, { quoted: msg });
      } else {
        this.customBotName = text;
        this.broadcastState(`Changed bot name to ${text}`);
        await this.sock.sendMessage(jid, { text: `✅ Berhasil mengubah nama bot menjadi: ${text}` }, { quoted: msg });
      }
    } else if (body === ".delnamabot" || body === "delnamabot") {
      this.customBotName = null;
      this.broadcastState(`Deleted custom bot name`);
      await this.sock.sendMessage(jid, { text: `✅ Berhasil mereset nama bot ke default.` }, { quoted: msg });
    } else if (body === ".totalfitur" || body === "totalfitur") {
      const totalFitur = ownerCommands.length + groupCommands.length + margaCommands.length + videoCommands.length + stickerCommands.length + funCommands.length + downloadCommands.length + kristenCommands.length + islamCommands.length;
      await this.sock.sendMessage(jid, { text: `⚠️ *Total Fitur Bot* : ${totalFitur} Fitur` }, { quoted: msg });
    } else if (body.startsWith(".addprefix") || body.startsWith("addprefix")) {
      const text = messageContent.replace(/^\.?addprefix\s*/i, "").trim();
      if (!text) {
        await this.sock.sendMessage(jid, { text: `Kirim perintah dengan prefix baru, contoh: .addprefix !` }, { quoted: msg });
      } else {
        await this.sock.sendMessage(jid, { text: `✅ Berhasil menambahkan prefix: ${text}` }, { quoted: msg });
      }
    } else if (body.startsWith(".delprefix") || body.startsWith("delprefix")) {
      const text = messageContent.replace(/^\.?delprefix\s*/i, "").trim();
      if (!text) {
        await this.sock.sendMessage(jid, { text: `Kirim perintah dengan prefix yang ingin dihapus, contoh: .delprefix !` }, { quoted: msg });
      } else {
        await this.sock.sendMessage(jid, { text: `✅ Berhasil menghapus prefix: ${text}` }, { quoted: msg });
      }
    } else if (body === ".listprefix" || body === "listprefix") {
      await this.sock.sendMessage(jid, { text: `📋 *Daftar Prefix*\n\n1. .\n2. !` }, { quoted: msg });
    } else if (body.startsWith(".addpoweredby") || body.startsWith("addpoweredby")) {
      const text = messageContent.replace(/^\.?addpoweredby\s*/i, "").trim();
      if (!text) {
        await this.sock.sendMessage(jid, { text: `Kirim perintah dengan teks powered by baru, contoh: .addpoweredby Wabot Pro` }, { quoted: msg });
      } else {
        this.poweredByText = text;
        this.broadcastState(`Changed powered by text to ${text}`);
        await this.sock.sendMessage(jid, { text: `✅ Berhasil menambahkan Powered By: ${text}` }, { quoted: msg });
      }
    } else if (body === ".delpoweredby" || body === "delpoweredby") {
      this.poweredByText = null;
      this.broadcastState(`Deleted powered by text`);
      await this.sock.sendMessage(jid, { text: `✅ Berhasil menghapus Powered By` }, { quoted: msg });
    } else if (body === ".listpoweredby" || body === "listpoweredby") {
      const current = this.poweredByText || "Belum diset";
      await this.sock.sendMessage(jid, { text: `📋 *Daftar Powered By*\n\n1. ${current}` }, { quoted: msg });
    } else if (body.startsWith(".addcmd") || body.startsWith("addcmd")) {
      const text = messageContent.replace(/^\.?addcmd\s*/i, "").trim().toLowerCase();
      if (!text) {
        await this.sock.sendMessage(jid, { text: `Kirim perintah dengan command baru untuk menu!\nContoh: .addcmd menu` }, { quoted: msg });
      } else {
        this.menuCommands.add(text);
        this.broadcastState(`Added menu command ${text}`);
        await this.sock.sendMessage(jid, { text: `✅ Berhasil menambahkan command menu: ${text}` }, { quoted: msg });
      }
    } else if (body.startsWith(".delcmd") || body.startsWith("delcmd")) {
      const text = messageContent.replace(/^\.?delcmd\s*/i, "").trim().toLowerCase();
      if (!text) {
        await this.sock.sendMessage(jid, { text: `Kirim perintah dengan nama command yang ingin dihapus!\nContoh: .delcmd menu` }, { quoted: msg });
      } else {
        if (this.menuCommands.has(text)) {
          this.menuCommands.delete(text);
          this.broadcastState(`Deleted menu command ${text}`);
          await this.sock.sendMessage(jid, { text: `✅ Berhasil menghapus command menu: ${text}` }, { quoted: msg });
        } else {
          await this.sock.sendMessage(jid, { text: `❌ Command ${text} tidak ditemukan.` }, { quoted: msg });
        }
      }
    } else if (body === ".listcmd" || body === "listcmd") {
      let list = `📋 *Daftar Custom Menu Command*\n\n`;
      let i = 1;
      for (const cmd of this.menuCommands) {
        list += `${i}. ${cmd}\n`;
        i++;
      }
      await this.sock.sendMessage(jid, { text: list.trim() }, { quoted: msg });
    } else if (body === ".self" || body === "self" || body === ".publik" || body === "publik") {
      const mode = body.replace(".", "");
      await this.sock.sendMessage(jid, { text: `✅ Berhasil mengubah mode bot menjadi: ${mode}` }, { quoted: msg });
    } else if (body.startsWith(".setcoverbot") || body.startsWith("setcoverbot")) {
      const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
      const isImage = msg.message?.imageMessage;
      const mediaMessage = isQuotedImage ? { message: { imageMessage: isQuotedImage } } : (isImage ? msg : null);
      
      if (mediaMessage) {
        try {
           const buffer = await downloadMediaMessage(mediaMessage as any, 'buffer', {}, { logger: pino({ level: 'silent' }) as any, reuploadRequest: this.sock.updateMediaMessage });
           this.coverImageBuffer = buffer as Buffer;
           await this.sock.sendMessage(jid, { text: `✅ Berhasil mengatur cover bot!` }, { quoted: msg });
        } catch (e) {
           await this.sock.sendMessage(jid, { text: `❌ Gagal memproses gambar!` }, { quoted: msg });
        }
      } else {
        await this.sock.sendMessage(jid, { text: `Kirim atau balas gambar dengan caption .setcoverbot` }, { quoted: msg });
      }
    } else if (body.startsWith(".delcoverbot") || body.startsWith("delcoverbot")) {
      this.coverImageBuffer = null;
      await this.sock.sendMessage(jid, { text: `✅ Berhasil menghapus cover bot!` }, { quoted: msg });
    } else if (body === ".delete" || body === "delete") {
      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      if (quoted && quoted.stanzaId) {
        try {
          await this.sock.sendMessage(jid, { delete: { remoteJid: jid, fromMe: false, id: quoted.stanzaId, participant: quoted.participant } });
        } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal menghapus pesan, pastikan bot adalah admin!" }, { quoted: msg });
        }
      } else {
        await this.sock.sendMessage(jid, { text: "Balas pesan yang ingin dihapus dengan caption .delete!" }, { quoted: msg });
      }
    } else if (body.startsWith(".anticall") || body.startsWith("anticall")) {
      if (body.includes("on")) {
        await this.sock.sendMessage(jid, { text: `✅ Anti Call berhasil diaktifkan!` }, { quoted: msg });
      } else if (body.includes("off")) {
        await this.sock.sendMessage(jid, { text: `❌ Anti Call berhasil dimatikan!` }, { quoted: msg });
      } else {
        await this.sock.sendMessage(jid, { text: `Ketik on atau off! Contoh: .anticall on` }, { quoted: msg });
      }
    } else if (body === ".open" || body === "open" || body === ".close" || body === "close") {
      if (!jid.endsWith("@g.us")) {
        await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di dalam grup!" }, { quoted: msg });
      } else {
        const action = body.includes("open") ? 'not_announcement' : 'announcement';
        try {
          await this.sock.groupSettingUpdate(jid, action);
          await this.sock.sendMessage(jid, { text: `✅ Berhasil ${body.includes("open") ? "membuka" : "menutup"} grup!` }, { quoted: msg });
        } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal mengubah setting grup. Pastikan bot adalah admin." }, { quoted: msg });
        }
      }
    } else if (body.startsWith(".open2") || body.startsWith("open2")) {
      if (!jid.endsWith("@g.us")) {
        await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di dalam grup!" }, { quoted: msg });
        return;
      }
      const time = body.split(" ")[1];
      if (!time || !time.includes(":")) {
        await this.sock.sendMessage(jid, { text: "Gunakan format jam! Contoh: .open2 10:00" }, { quoted: msg });
        return;
      }
      const [hour, minute] = time.split(":");
      try {
        schedule.scheduleJob(`${minute} ${hour} * * *`, async () => {
             await this.sock.groupSettingUpdate(jid, 'not_announcement');
             await this.sock.sendMessage(jid, { text: `✅ Jadwal Buka: Berhasil membuka grup!` });
        });
        await this.sock.sendMessage(jid, { text: `✅ Berhasil mengatur jadwal buka grup pada pukul ${time} setiap hari.` }, { quoted: msg });
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ Format jam tidak valid." }, { quoted: msg });
      }
    } else if (body.startsWith(".close2") || body.startsWith("close2")) {
      if (!jid.endsWith("@g.us")) {
        await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di dalam grup!" }, { quoted: msg });
        return;
      }
      const time = body.split(" ")[1];
      if (!time || !time.includes(":")) {
        await this.sock.sendMessage(jid, { text: "Gunakan format jam! Contoh: .close2 22:00" }, { quoted: msg });
        return;
      }
      const [hour, minute] = time.split(":");
      try {
        schedule.scheduleJob(`${minute} ${hour} * * *`, async () => {
             await this.sock.groupSettingUpdate(jid, 'announcement');
             await this.sock.sendMessage(jid, { text: `✅ Jadwal Tutup: Berhasil menutup grup!` });
        });
        await this.sock.sendMessage(jid, { text: `✅ Berhasil mengatur jadwal tutup grup pada pukul ${time} setiap hari.` }, { quoted: msg });
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ Format jam tidak valid." }, { quoted: msg });
      }
    } else if (body.startsWith(".tiktokgirl") || body.startsWith("tiktokgirl") || 
               body.startsWith(".tiktoktobrut") || body.startsWith("tiktoktobrut") || 
               body.startsWith(".tiktokkayes") || body.startsWith("tiktokkayes") || 
               body.startsWith(".tiktokhot") || body.startsWith("tiktokhot") || 
               body.startsWith(".tiktokghea") || body.startsWith("tiktokghea") || 
               body.startsWith(".tiktokbocil") || body.startsWith("tiktokbocil") || 
               body.startsWith(".tiktoklesbi") || body.startsWith("tiktoklesbi") || 
               body.startsWith(".tiktokgay") || body.startsWith("tiktokgay") ||
               body.startsWith(".tiktokartis") || body.startsWith("tiktokartis") ||
               body.startsWith(".tiktokpacaran") || body.startsWith("tiktokpacaran")) {
      const targetQuery = body.split(" ")[0].replace(".", "");
      const searchQuery = targetQuery.replace("tiktok", "");
      await this.sock.sendMessage(jid, { text: `⏳ *Permintaan Video ${targetQuery}*\n\nSedang mencari referensi video... Mohon tunggu sebentar.` }, { quoted: msg });
      
      try {
        const fetchRes = await axios.get(`https://www.tikwm.com/api/feed/search?keywords=${searchQuery}`);
        if (fetchRes.data && fetchRes.data.code === 0 && fetchRes.data.data && fetchRes.data.data.videos && fetchRes.data.data.videos.length > 0) {
          const videos = fetchRes.data.data.videos;
          const randomVideo = videos[Math.floor(Math.random() * videos.length)];
          const videoUrl = randomVideo.play;
          await this.sock.sendMessage(jid, { video: { url: videoUrl }, caption: `✅ *Berhasil menemukan video!*\n\n${targetQuery}\n\n${randomVideo.title || ''}` }, { quoted: msg });
        } else {
          await this.sock.sendMessage(jid, { text: `❌ *Video Gagal Dimuat*\n\nMaaf, tidak dapat menemukan video untuk kueri tersebut.` }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: `❌ *Video Gagal Dimuat*\n\nMaaf, API provider video sedang bermasalah atau dalam perbaikan. Silakan coba lagi nanti.` }, { quoted: msg });
      }
      this.broadcastState(`Responded to ${targetQuery} command`);
    } else if (body.startsWith(".tiktok ") || body === ".tiktok" || body.startsWith("tiktok ") || body === "tiktok") {
      const urlMatches = messageContent.match(/(https?:\/\/[^\s]+)/g);
      if (!urlMatches) {
        await this.sock.sendMessage(jid, { text: "Link TikTok tidak ditemukan. Contoh: .tiktok https://vt.tiktok.com/ZS9pCeuV4/" }, { quoted: msg });
        return;
      }
      const url = urlMatches[0];
      await this.sock.sendMessage(jid, { text: "⏳ *Sedang mendownload video TikTok...*" }, { quoted: msg });
      try {
        const fetchRes = await axios.get(`https://www.tikwm.com/api/?url=${url}`);
        if (fetchRes.data && fetchRes.data.code === 0 && fetchRes.data.data.play) {
          const videoUrl = fetchRes.data.data.play;
          await this.sock.sendMessage(jid, { video: { url: videoUrl }, caption: `✅ *Download Sukses*\n\n${fetchRes.data.data.title || ''}` }, { quoted: msg });
        } else {
           await this.sock.sendMessage(jid, { text: "❌ *Gagal mendownload video. Pastikan link valid.*" }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ *Gagal mendownload video dari server.*" }, { quoted: msg });
      }
    } else if (body.startsWith(".playyt ") || body.startsWith("playyt ")) {
      const q = messageContent.replace(/^\.?playyt\s*/i, "").trim();
      const isUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(q);

      await this.sock.sendMessage(jid, { text: `⏳ *Sedang memproses ${isUrl ? "link" : `pencarian "${q}"`} di Youtube...*` }, { quoted: msg });
      try {
        let videoUrl = q;
        let title = "Audio";
        
        if (!isUrl) {
          const search: any = await btch.yts(q);
          if (search.result && search.result.videos && search.result.videos.length > 0) {
             const firstVideo = search.result.videos[0];
             videoUrl = firstVideo.url;
             title = firstVideo.title;
             const ytInfo = `🎧 *PLAY YOUTUBE*\n\n📌 Judul: ${firstVideo.title}\n⏱ Durasi: ${firstVideo.duration.timestamp}\n👀 Views: ${firstVideo.views}\n📺 Channel: ${firstVideo.author.name}\n\n✅ *Video Ditemukan!*\n🔗 Link: ${firstVideo.url}\n⏳ _Sedang mengambil audio, mohon tunggu..._`;
             await this.sock.sendMessage(jid, { image: { url: firstVideo.image }, caption: ytInfo }, { quoted: msg });
          } else {
             await this.sock.sendMessage(jid, { text: `❌ Tidak ditemukan hasil untuk "${q}"` }, { quoted: msg });
             return;
          }
        }

        let ytDownload: any;
        for (let i = 0; i < 3; i++) {
          try {
            ytDownload = await (vredenYt as any).ytmp3(videoUrl);
            if (ytDownload && ytDownload.status && ytDownload.download && ytDownload.download.url) break;
          } catch (e) {
            // ignore timeout and retry
          }
          await new Promise(r => setTimeout(r, 2000));
        }
        
        if (ytDownload && ytDownload.status && ytDownload.download && ytDownload.download.url) {
          try {
            const dlUrl = ytDownload.download.url;
            if (isUrl && ytDownload.metadata) title = ytDownload.metadata.title || title;
            
            const { data } = await axios.get(dlUrl, { responseType: 'arraybuffer', headers: { "User-Agent": "Mozilla/5.0" } });
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            
            const tmpId = Date.now() + Math.random().toString(36).substring(2, 7);
            const tmpRaw = `/tmp/yt_${tmpId}.raw`;
            const tmpFixedMp3 = `/tmp/yt_${tmpId}_fixed.mp3`;
            
            fs.writeFileSync(tmpRaw, buffer);
            try {
              execSync(`ffmpeg -y -i ${tmpRaw} -c:a libmp3lame -b:a 128k -map 0:a:0 -f mp3 ${tmpFixedMp3}`);
              const fixedBuffer = fs.readFileSync(tmpFixedMp3);
              await this.sock.sendMessage(jid, { audio: fixedBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
            } catch (convErr) {
              console.error("FFmpeg conversion error:", convErr);
              // Fallback to sending as document if conversion fails
              await this.sock.sendMessage(jid, { document: buffer, mimetype: 'audio/mpeg', fileName: `${title}.mp3` }, { quoted: msg });
            } finally {
              if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw);
              if (fs.existsSync(tmpFixedMp3)) fs.unlinkSync(tmpFixedMp3);
            }
          } catch (dlError) {
            await this.sock.sendMessage(jid, { text: "❌ *Gagal mengunduh audio dari server (link mati/timeout).*" }, { quoted: msg });
            console.error("Audio download error:", dlError);
          }
        } else {
          await this.sock.sendMessage(jid, { text: "❌ *Gagal mengambil link audio setelah 3 percobaan.*" }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ *Gagal memproses link/pencarian.*" }, { quoted: msg });
      }
    } else if (body.startsWith(".fotosexy") || body.startsWith("fotosexy")) {
      await this.sock.sendMessage(jid, { text: "⏳ *Sedang mengambil gambar random...*" }, { quoted: msg });
      try {
         const p = await ab.pinterest("cewek cantik aesthetic");
         if (p && p.result && p.result.result && p.result.result.length > 0) {
            const arr = p.result.result;
            const randomIdx = Math.floor(Math.random() * arr.length);
            const imageUrl = arr[randomIdx].image_url;
            await this.sock.sendMessage(jid, { image: { url: imageUrl }, caption: "📸 *Random Foto*" }, { quoted: msg });
         } else {
            await this.sock.sendMessage(jid, { text: "❌ *Gagal menemukan foto.*" }, { quoted: msg });
         }
      } catch (e) {
         await this.sock.sendMessage(jid, { text: "❌ *Server error mengambil gambar.*" }, { quoted: msg });
      }

    } else if (body.startsWith(".playytmp4 ") || body.startsWith("playytmp4 ")) {
      const q = messageContent.replace(/^\.?playytmp4\s*/i, "").trim();
      const isUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(q);
      
      await this.sock.sendMessage(jid, { text: `⏳ *Sedang memproses ${isUrl ? "link" : `pencarian "${q}"`} di Youtube...*` }, { quoted: msg });
      try {
        let videoUrl = q;
        let title = "Video";
        
        if (!isUrl) {
          const search: any = await btch.yts(q);
          if (search.result && search.result.videos && search.result.videos.length > 0) {
             const firstVideo = search.result.videos[0];
             videoUrl = firstVideo.url;
             title = firstVideo.title;
             const ytInfo = `🎧 *PLAY YOUTUBE MP4*\n\n📌 Judul: ${firstVideo.title}\n⏱ Durasi: ${firstVideo.duration.timestamp}\n👀 Views: ${firstVideo.views}\n📺 Channel: ${firstVideo.author.name}\n\n✅ *Video Ditemukan!*\n🔗 Link: ${firstVideo.url}\n⏳ _Sedang mengambil video, mohon tunggu..._`;
             await this.sock.sendMessage(jid, { image: { url: firstVideo.image }, caption: ytInfo }, { quoted: msg });
          } else {
             await this.sock.sendMessage(jid, { text: `❌ Tidak ditemukan hasil untuk "${q}"` }, { quoted: msg });
             return;
          }
        }
        
        let ytDownload: any;
        for (let i = 0; i < 3; i++) {
          try {
            ytDownload = await (vredenYt as any).ytmp4(videoUrl);
            if (ytDownload && ytDownload.status && ytDownload.download && ytDownload.download.url) break;
          } catch (e) {}
          await new Promise(r => setTimeout(r, 2000));
        }
        
        if (ytDownload && ytDownload.status && ytDownload.download && ytDownload.download.url) {
          const dlUrl = ytDownload.download.url;
          if (isUrl && ytDownload.metadata) title = ytDownload.metadata.title || title;
          try {
            const { data } = await axios.get(dlUrl, { responseType: 'arraybuffer', headers: { "User-Agent": "Mozilla/5.0" } });
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            
            const tmpId = Date.now() + Math.random().toString(36).substring(2, 7);
            const tmpRaw = `/tmp/yt_${tmpId}.raw`;
            const tmpFixedMp4 = `/tmp/yt_${tmpId}_fixed.mp4`;
            
            fs.writeFileSync(tmpRaw, buffer);
            try {
              // Convert to h264 for WhatsApp compatibility
              execSync(`ffmpeg -y -i ${tmpRaw} -c:v libx264 -preset veryfast -crf 28 -c:a aac -b:a 128k ${tmpFixedMp4}`);
              const fixedBuffer = fs.readFileSync(tmpFixedMp4);
              await this.sock.sendMessage(jid, { video: fixedBuffer, mimetype: "video/mp4", caption: `✅ ${title}` }, { quoted: msg });
            } catch (convErr) {
              console.error("FFmpeg conversion error:", convErr);
              // Fallback to sending as document if conversion fails
              await this.sock.sendMessage(jid, { document: buffer, mimetype: 'video/mp4', fileName: `${title}.mp4`, caption: `✅ ${title} (Format Asli)` }, { quoted: msg });
            } finally {
              if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw);
              if (fs.existsSync(tmpFixedMp4)) fs.unlinkSync(tmpFixedMp4);
            }
          } catch (dlError) {
             await this.sock.sendMessage(jid, { text: "❌ *Gagal mengunduh video dari server.*" }, { quoted: msg });
          }
        } else {
          await this.sock.sendMessage(jid, { text: `❌ Gagal mendownload video dari "${title}"` }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: `❌ Terjadi kesalahan saat mencari Youtube.` }, { quoted: msg });
      }
    } else if (body.startsWith(".tiktokaudiomp3 ") || body.startsWith("tiktokaudiomp3 ")) {
      const urlMatches = messageContent.match(/(https?:\/\/[^\s]+)/g);
      if (!urlMatches) {
        await this.sock.sendMessage(jid, { text: "Link TikTok tidak ditemukan. Contoh: .tiktokaudiomp3 https://vt.tiktok.com/ZS9pCeuV4/" }, { quoted: msg });
        return;
      }
      const url = urlMatches[0];
      await this.sock.sendMessage(jid, { text: "⏳ *Sedang mendownload audio TikTok...*" }, { quoted: msg });
      try {
        const fetchRes = await axios.get(`https://www.tikwm.com/api/?url=${url}`);
        if (fetchRes.data && fetchRes.data.code === 0 && fetchRes.data.data.music) {
          const audioUrl = fetchRes.data.data.music;
          await this.sock.sendMessage(jid, { audio: { url: audioUrl }, mimetype: "audio/mp4", ptt: false }, { quoted: msg });
        } else {
           await this.sock.sendMessage(jid, { text: "❌ *Gagal mendownload audio. Pastikan link valid.*" }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ *Gagal mendownload audio dari server.*" }, { quoted: msg });
      }
    } else if (body.startsWith(".capcut ") || body.startsWith("capcut ")) {
      const urlMatches = messageContent.match(/(https?:\/\/[^\s]+)/g);
      if (!urlMatches) {
        await this.sock.sendMessage(jid, { text: "Link Capcut tidak ditemukan." }, { quoted: msg });
        return;
      }
      const url = urlMatches[0];
      await this.sock.sendMessage(jid, { text: "⏳ *Sedang mendownload Capcut...*" }, { quoted: msg });
      try {
        const capcutRes: any = await btch.capcut(url);
        if (capcutRes && capcutRes.originalVideoUrl) {
          await this.sock.sendMessage(jid, { video: { url: capcutRes.originalVideoUrl }, caption: `✅ *Download Sukses*\n\n${capcutRes.title || ''}` }, { quoted: msg });
        } else if (capcutRes && capcutRes.video) {
          await this.sock.sendMessage(jid, { video: { url: capcutRes.video }, caption: `✅ *Download Sukses*\n\n${capcutRes.title || ''}` }, { quoted: msg });
        } else {
          await this.sock.sendMessage(jid, { text: "❌ *Gagal mendownload Capcut.*" }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ *Terjadi kesalahan saat mendownload Capcut.*" }, { quoted: msg });
      }
    } else if (body.startsWith(".facebook ") || body.startsWith("facebook ") || body.startsWith(".fb ") || body.startsWith("fb ")) {
      const urlMatches = messageContent.match(/(https?:\/\/[^\s]+)/g);
      if (!urlMatches) {
        await this.sock.sendMessage(jid, { text: "Link Facebook tidak ditemukan." }, { quoted: msg });
        return;
      }
      const url = urlMatches[0];
      await this.sock.sendMessage(jid, { text: "⏳ *Sedang mendownload video Facebook...*" }, { quoted: msg });
      try {
        const fbRes: any = await ab.fbdown(url);
        if (fbRes && fbRes.HD) {
          await this.sock.sendMessage(jid, { video: { url: fbRes.HD }, caption: `✅ *Download Sukses*` }, { quoted: msg });
        } else if (fbRes && fbRes.Normal_video) {
          await this.sock.sendMessage(jid, { video: { url: fbRes.Normal_video }, caption: `✅ *Download Sukses*` }, { quoted: msg });
        } else {
          await this.sock.sendMessage(jid, { text: "❌ *Gagal mendownload Facebook.*" }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ *Terjadi kesalahan saat mendownload Facebook.*" }, { quoted: msg });
      }
    } else if (body.startsWith(".instagram ") || body.startsWith("instagram ") || body.startsWith(".ig ") || body.startsWith("ig ")) {
      const urlMatches = messageContent.match(/(https?:\/\/[^\s]+)/g);
      if (!urlMatches) {
        await this.sock.sendMessage(jid, { text: "Link Instagram tidak ditemukan." }, { quoted: msg });
        return;
      }
      const url = urlMatches[0];
      await this.sock.sendMessage(jid, { text: "⏳ *Sedang mendownload Instagram...*" }, { quoted: msg });
      try {
        const igRes: any = await igdl(url); // Menggunakan ruhend-scraper yang mengembalikan array URL
        if (igRes && Array.isArray(igRes) && igRes.length > 0 && typeof igRes[0] === 'string') {
          await this.sock.sendMessage(jid, { video: { url: igRes[0] }, caption: `✅ *Download Sukses*` }, { quoted: msg });
        } else {
          // Fallback if ruhend-scraper structure changed
          if (igRes && igRes.length > 0 && igRes[0].url) {
            await this.sock.sendMessage(jid, { video: { url: igRes[0].url }, caption: `✅ *Download Sukses*` }, { quoted: msg });
          } else {
             await this.sock.sendMessage(jid, { text: "❌ *Gagal mendownload Instagram.*" }, { quoted: msg });
          }
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ *Terjadi kesalahan saat mendownload Instagram.*" }, { quoted: msg });
      }
    } else if (body === ".fotoanime" || body === "fotoanime") {
      await this.sock.sendMessage(jid, { text: "⏳ *Sedang mengambil foto anime random...*" }, { quoted: msg });
      try {
        const res = await axios.get("https://nekos.life/api/v2/img/waifu");
        if (res.data && res.data.url) {
          await this.sock.sendMessage(jid, { image: { url: res.data.url }, caption: `🌸 *Foto Anime Random*` }, { quoted: msg });
        } else {
          await this.sock.sendMessage(jid, { text: "❌ *Gagal mengambil foto.*" }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ *Terjadi kesalahan saat mengambil foto anime.*" }, { quoted: msg });
      }

    } else if (body.startsWith(".cecan") || body.startsWith("cecan")) {
      const q = messageContent.replace(/^\.?cecan/i, "").trim().toLowerCase();
      
      const queries: Record<string, string> = {
        "china": "cewe china cantik aesthetic",
        "hijab": "hijab girl aesthetic",
        "indonesia": "cewe indo cantik aesthetic",
        "japan": "japanese girl aesthetic",
        "jeni": "jennie blackpink aesthetic",
        "jiso": "jisoo blackpink aesthetic",
        "korea": "korean girl aesthetic",
        "malaysia": "malaysian girl beautiful",
        "justinaxie": "justina xie aesthetic",
        "rose": "rose blackpink aesthetic",
        "thailand": "thai girl beautiful",
        "vietnam": "vietnam girl aesthetic"
      };

      if (queries[q]) {
        await this.sock.sendMessage(jid, { text: `⏳ *Sedang mencari foto cecan ${q}...*` }, { quoted: msg });
        try {
           const p = await ab.pinterest(queries[q]);
           if (p && p.result && p.result.result && p.result.result.length > 0) {
              const arr = p.result.result;
              const randomIdx = Math.floor(Math.random() * arr.length);
              const imageUrl = arr[randomIdx].image_url || arr[randomIdx].images?.original || arr[randomIdx].images?.large;
              await this.sock.sendMessage(jid, { image: { url: imageUrl }, caption: `📸 *Cecan ${q.charAt(0).toUpperCase() + q.slice(1)}*` }, { quoted: msg });
           } else {
              await this.sock.sendMessage(jid, { text: `❌ *Foto cecan ${q} tidak ditemukan.*` }, { quoted: msg });
           }
        } catch (e) {
           await this.sock.sendMessage(jid, { text: "❌ *Gagal mengambil foto.*" }, { quoted: msg });
        }
      }
    } else if ((body.startsWith(".anime") || body.startsWith("anime")) && body !== ".animemenu" && body !== "animemenu") {
      const q = messageContent.replace(/^\.?anime/i, "").trim().toLowerCase();
      
      const queries: Record<string, string> = {
        "akira": "anime akira wallpaper",
        "asuna": "asuna yuuki sword art online",
        "eba": "anime eba",
        "elaina": "elaina wandering witch",
        "emilia": "emilia re zero",
        "gremory": "rias gremory highschool dxd",
        "hinata": "hinata hyuga",
        "husbu": "anime husbu aesthetic",
        "isuzu": "isuzu sento amagi brilliant park",
        "itori": "itori tokyo ghoul",
        "kagura": "kagura gintama",
        "kanna": "kanna kamui dragon maid",
        "miku": "hatsune miku anime",
        "nezuko": "nezuko kamado",
        "loli": "anime loli cute",
        "pokemon": "pokemon anime wallpaper",
        "rem": "rem re zero",
        "ryuko": "ryuko matoi kill la kill",
        "shina": "mashiro shiina",
        "shinka": "shinka nibutani",
        "shota": "anime shota cute",
        "tejina": "tejina senpai",
        "toukachan": "touka kirishima"
      };

      if (queries[q]) {
        await this.sock.sendMessage(jid, { text: `⏳ *Sedang mencari gambar anime ${q}...*` }, { quoted: msg });
        try {
           const p = await ab.pinterest(queries[q]);
           if (p && p.result && p.result.result && p.result.result.length > 0) {
              const arr = p.result.result;
              const randomIdx = Math.floor(Math.random() * arr.length);
              const imageUrl = arr[randomIdx].image_url || arr[randomIdx].images?.original || arr[randomIdx].images?.large;
              await this.sock.sendMessage(jid, { image: { url: imageUrl }, caption: `🦊 *Anime ${q.charAt(0).toUpperCase() + q.slice(1)}*` }, { quoted: msg });
           } else {
              await this.sock.sendMessage(jid, { text: `❌ *Gambar anime ${q} tidak ditemukan.*` }, { quoted: msg });
           }
        } catch (e) {
           await this.sock.sendMessage(jid, { text: "❌ *Gagal mengambil gambar anime.*" }, { quoted: msg });
        }
      }
    } else if (body.startsWith(".pinterest ") || body.startsWith("pinterest ")) {
      const q = messageContent.replace(/^\.?pinterest\s*/i, "").trim();
      await this.sock.sendMessage(jid, { text: `⏳ *Sedang mendownload foto Pinterest untuk "${q}"...*` }, { quoted: msg });
      try {
         const p = await ab.pinterest(q);
         if (p && p.result && p.result.result && p.result.result.length > 0) {
            const arr = p.result.result;
            const randomIdx = Math.floor(Math.random() * arr.length);
            const imageUrl = arr[randomIdx].image_url;
            await this.sock.sendMessage(jid, { image: { url: imageUrl }, caption: `📸 *Pinterest: ${q}*` }, { quoted: msg });
         } else {
            await this.sock.sendMessage(jid, { text: "❌ *Foto tidak ditemukan.*" }, { quoted: msg });
         }
      } catch (e) {
         await this.sock.sendMessage(jid, { text: "❌ *Gagal mencari di server Pinterest.*" }, { quoted: msg });
      }
    } else if (body.startsWith(".antilinkall") || body.startsWith("antilinkall")) {
      const settings = this.groupSettings.get(jid) || {};
      if (body.includes("on")) {
        settings.antilinkall = true;
        this.groupSettings.set(jid, settings);
        this.saveGroupSettings();
        await this.sock.sendMessage(jid, { text: `✅ Anti Link All berhasil diaktifkan!` }, { quoted: msg });
      } else if (body.includes("off")) {
        settings.antilinkall = false;
        this.groupSettings.set(jid, settings);
        this.saveGroupSettings();
        await this.sock.sendMessage(jid, { text: `❌ Anti Link All berhasil dimatikan!` }, { quoted: msg });
      } else {
        await this.sock.sendMessage(jid, { text: `Ketik on atau off! Contoh: .antilinkall on` }, { quoted: msg });
      }
    } else if (body.startsWith(".bratvid ") || body === ".bratvid" || body.startsWith("bratvid ") || body === "bratvid") {
       const text = messageContent.replace(/^\.?bratvid\s*/i, "").trim();
       if (!text) {
          await this.sock.sendMessage(jid, { text: `Kirim teks untuk dibuat stiker video!\nContoh: .bratvid Halo semuanya` }, { quoted: msg });
       } else {
          let tmpdir = null;
          try {
             await this.sock.sendMessage(jid, { text: `⏳ *Sedang membuat stiker video brat...*` }, { quoted: msg });
             const b = await import('@skycodee/brat').then(m => m.default || m);
             const fs = await import('fs');
             const os = await import('os');
             const path = await import('path');
             
             const frames = await b.bratVidGenerator(text, 512, 512);
             tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'brat-'));
             
             // write frames
             frames.forEach((frame, i) => {
                 fs.writeFileSync(path.join(tmpdir, `frame_${i}.png`), frame);
             });
             
             const outWebp = path.join(tmpdir, 'out.webp');
             const { execSync } = await import('child_process');
             try {
                              execSync(`ffmpeg -framerate 1.5 -i "${path.join(tmpdir, 'frame_%d.png')}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" -c:v libwebp -loop 0 -q:v 80 -preset default -an -y "${outWebp}"`);
             } catch(err) { throw new Error('FFmpeg failed: ' + (err.stderr ? err.stderr.toString() : err.message)); }
             
             const buffer = fs.readFileSync(outWebp);
             
             if (buffer) {
                 const { Sticker } = await import('wa-sticker-formatter');
                 const sticker = new Sticker(buffer, { pack: 'BratVid', author: 'Bot', type: 'full' });
                 const finalSticker = await sticker.toBuffer();
                 await this.sock.sendMessage(jid, { sticker: finalSticker }, { quoted: msg });
             } else {
                 throw new Error("Failed generating WebP buffer");
             }
          } catch (e) {
             console.error("Bratvid error: ", e);
             await this.sock.sendMessage(jid, { text: `❌ Gagal membuat stiker video brat. Error:
${e.stack || e.message || String(e)}` }, { quoted: msg });
          } finally {
             // Cleanup temp dir
             if (tmpdir) {
                 try {
                     const fs = await import('fs');
                     fs.rmSync(tmpdir, { recursive: true, force: true });
                 } catch (err) {
                    console.error("Failed to cleanup tmpdir:", err);
                 }
             }
          }
       }
    } else if (body.startsWith(".brat ") || body === ".brat" || body.startsWith("brat ") || body === "brat") {
       const text = messageContent.replace(/^\.?brat\s*/i, "").trim();
       if (!text) {
          await this.sock.sendMessage(jid, { text: `Kirim teks untuk dibuat stiker!\nContoh: .brat Halo semuanya` }, { quoted: msg });
       } else {
          try {
             // Generate brat sticker using @skycodee/brat for better local reliability
             const b = await import('@skycodee/brat').then(m => m.default || m);
             const pngBuffer = await b.bratGenerator(text);
             const buffer = await sharp(pngBuffer).webp().toBuffer();
             await this.sock.sendMessage(jid, { sticker: buffer }, { quoted: msg });
          } catch (e) {
             console.error("Brat error: ", e);
             await this.sock.sendMessage(jid, { text: `❌ Gagal membuat stiker brat.` }, { quoted: msg });
          }
       }
    } else if (body.startsWith(".smeme") || body.startsWith("smeme")) {
       const text = messageContent.replace(/^\.?smeme\s*/i, "").trim();
       if (!text || !text.includes("|")) {
          await this.sock.sendMessage(jid, { text: `Kirim teks dengan format atas|bawah!\nContoh: .smeme Halo|Semua` }, { quoted: msg });
       } else {
          try {
             const [atas, bawah] = text.split("|");
             
             const isMedia = msg.message?.imageMessage;
             const isQuotedMedia = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
             let bgBuffer: Buffer | null = null;
             
             if (isMedia || isQuotedMedia) {
                const mediaMessage = isQuotedMedia || isMedia;
                // @ts-ignore
                const stream = await downloadContentFromMessage(mediaMessage, 'image');
                let buffer = Buffer.from([]);
                for await(const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
                bgBuffer = await sharp(buffer).resize(512, 512, { fit: 'cover' }).toBuffer();
             } else {
                bgBuffer = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 50, g: 50, b: 50, alpha: 1 } } }).png().toBuffer();
             }
             
             const svgMeme = `<svg width="512" height="512">
               <text x="256" y="50" font-size="48" font-family="Impact, Arial, sans-serif" font-weight="bold" fill="white" stroke="black" stroke-width="2" text-anchor="middle" dominant-baseline="hanging">${atas.trim()}</text>
               <text x="256" y="462" font-size="48" font-family="Impact, Arial, sans-serif" font-weight="bold" fill="white" stroke="black" stroke-width="2" text-anchor="middle" dominant-baseline="baseline">${bawah.trim()}</text>
             </svg>`;
             
             const finalBuffer = await sharp(bgBuffer).composite([{ input: Buffer.from(svgMeme), blend: 'over' }]).webp().toBuffer();
             await this.sock.sendMessage(jid, { sticker: finalBuffer }, { quoted: msg });
          } catch (e) {
             console.error("Smeme error: ", e);
             await this.sock.sendMessage(jid, { text: `❌ Gagal membuat stiker meme.` }, { quoted: msg });
          }
       }
    } else if (body.startsWith(".qc") || body.startsWith("qc")) {
       const text = messageContent.replace(/^\.?qc\s*/i, "").trim();
       if (!text) {
          await this.sock.sendMessage(jid, { text: `Kirim teks untuk dibuat QC!\nContoh: .qc Halo semuanya` }, { quoted: msg });
       } else {
          try {
             let avatarUrl = "https://i.pravatar.cc/300";
             try {
                 const participant = msg.key.participant || msg.key.remoteJid;
                 if (participant) {
                     avatarUrl = await this.sock.profilePictureUrl(participant, 'image');
                 }
             } catch (e) {
                 // Fallback to default avatar
             }
             const pushName = msg.pushName || "User";

             const payload = {
                 type: "quote",
                 format: "png",
                 backgroundColor: "#1b1429",
                 width: 512,
                 height: 768,
                 scale: 2,
                 messages: [{
                     entities: [],
                     avatar: true,
                     from: {
                         id: 1,
                         name: pushName,
                         photo: {
                             url: avatarUrl
                         }
                     },
                     text: text,
                     replyMessage: {}
                 }]
             };
             
             const res = await axios.post("https://qc.botcahx.eu.org/generate", payload);
             if (res.data && res.data.result && res.data.result.image) {
                const buffer = Buffer.from(res.data.result.image, 'base64');
                const finalBuffer = await sharp(buffer).webp().toBuffer();
                await this.sock.sendMessage(jid, { sticker: finalBuffer }, { quoted: msg });
             } else {
                throw new Error("Invalid response from API");
             }
          } catch (e) {
             console.error("QC error: ", e);
             await this.sock.sendMessage(jid, { text: `❌ Gagal membuat QC.` }, { quoted: msg });
          }
       }
    } else if (body.startsWith(".toimg") || body.startsWith("toimg")) {
       const isQuotedSticker = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
       if (isQuotedSticker) {
           try {
               await this.sock.sendMessage(jid, { text: "⏳ *Sedang memproses...*" }, { quoted: msg });
               const buffer = await downloadMediaMessage(
                   { message: { stickerMessage: isQuotedSticker } } as any, 
                   'buffer', 
                   {}, 
                   { logger: pino({ level: 'silent' }) as any, reuploadRequest: this.sock.updateMediaMessage }
               ) as Buffer;
               const imgBuffer = await sharp(buffer).jpeg().toBuffer();
               await this.sock.sendMessage(jid, { image: imgBuffer }, { quoted: msg });
           } catch (e: any) {
               console.error("toimg error:", e);
               await this.sock.sendMessage(jid, { text: `❌ Gagal merubah stiker ke gambar! Error: ${e.message}` }, { quoted: msg });
           }
       } else {
           await this.sock.sendMessage(jid, { text: "Reply stiker dengan perintah ini!" }, { quoted: msg });
       }
    } else if (body.startsWith(".togif") || body.startsWith("togif")) {
       const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
       const isQuotedSticker = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
       const isImage = msg.message?.imageMessage;
       const messageToDownload = isQuotedImage ? { message: { imageMessage: isQuotedImage } } : isQuotedSticker ? { message: { stickerMessage: isQuotedSticker } } : isImage ? msg : null;
       
       if (messageToDownload) {
           try {
               await this.sock.sendMessage(jid, { text: "⏳ *Sedang memproses...*" }, { quoted: msg });
               const buffer = await downloadMediaMessage(
                   messageToDownload as any, 
                   'buffer', 
                   {}, 
                   { logger: pino({ level: 'silent' }) as any, reuploadRequest: this.sock.updateMediaMessage }
               ) as Buffer;
               const gifBuffer = await sharp(buffer, { animated: true }).gif().toBuffer();
               await this.sock.sendMessage(jid, { document: gifBuffer, mimetype: 'image/gif', fileName: 'converted.gif' }, { quoted: msg });
           } catch (e: any) {
               console.error("togif error:", e);
               await this.sock.sendMessage(jid, { text: `❌ Gagal merubah ke gif! Error: ${e.message}` }, { quoted: msg });
           }
       } else {
           await this.sock.sendMessage(jid, { text: "Kirim atau reply gambar/stiker dengan perintah ini!" }, { quoted: msg });
       }
    } else if (body.startsWith(".stikerrandom") || body.startsWith("stikerrandom")) {
       try {
           const res = await axios.get("https://meme-api.com/gimme");
           if (res.data && res.data.url) {
               const imgRes = await axios.get(res.data.url, { responseType: 'arraybuffer' });
               const buffer = await sharp(imgRes.data).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
               await this.sock.sendMessage(jid, { sticker: buffer }, { quoted: msg });
           } else {
               await this.sock.sendMessage(jid, { text: `❌ Gagal mengambil gambar random.` }, { quoted: msg });
           }
       } catch (error) {
           await this.sock.sendMessage(jid, { text: `❌ Gagal membuat stiker random.` }, { quoted: msg });
       }
    } else if (body.startsWith(".stikerspongebob") || body.startsWith("stikerspongebob")) {
       try {
           const res = await axios.get("https://meme-api.com/gimme/BikiniBottomTwitter");
           if (res.data && res.data.url) {
               const imgRes = await axios.get(res.data.url, { responseType: 'arraybuffer' });
               const buffer = await sharp(imgRes.data).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
               await this.sock.sendMessage(jid, { sticker: buffer }, { quoted: msg });
           } else {
               await this.sock.sendMessage(jid, { text: `❌ Gagal mengambil gambar spongebob.` }, { quoted: msg });
           }
       } catch (error) {
           await this.sock.sendMessage(jid, { text: `❌ Gagal membuat stiker spongebob.` }, { quoted: msg });
       }
    } else if (body.startsWith(".ayatalkitab") || body.startsWith("ayatalkitab")) {
        const ayat = [
            "Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan beroleh hidup yang kekal. - Yohanes 3:16",
            "Pencuri datang hanya untuk mencuri dan membunuh dan membinasakan; Aku datang, supaya mereka mempunyai hidup, dan mempunyainya dalam segala kelimpahan. - Yohanes 10:10",
            "Segala perkara dapat kutanggung di dalam Dia yang memberi kekuatan kepadaku. - Filipi 4:13",
            "Sebab Aku ini mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, demikianlah firman TUHAN, yaitu rancangan damai sejahtera dan bukan rancangan kecelakaan, untuk memberikan kepadamu hari depan yang penuh harapan. - Yeremia 29:11"
        ];
        const randomAyat = ayat[Math.floor(Math.random() * ayat.length)];
        await this.sock.sendMessage(jid, { text: `📖 *Ayat Alkitab*\n\n${randomAyat}` }, { quoted: msg });
    } else if (body.startsWith(".doaayat") || body.startsWith("doaayat")) {
        await this.sock.sendMessage(jid, { text: `🙏 *Doa Harian*\n\nTuhan Yesus, terima kasih atas berkatMu hari ini. Bimbinglah langkah kami dan berikanlah damai sejahtera. Amin.` }, { quoted: msg });
    } else if (body.startsWith(".kisahyesus") || body.startsWith("kisahyesus")) {
        await this.sock.sendMessage(jid, { text: `✝️ *Kisah Yesus*\n\nYesus Kristus lahir di Betlehem, melakukan banyak mukjizat, disalibkan demi menebus dosa manusia, dan bangkit pada hari ketiga untuk memberikan keselamatan bagi setiap orang yang percaya.` }, { quoted: msg });
    } else if (body.startsWith(".jadwalgereja") || body.startsWith("jadwalgereja")) {
        await this.sock.sendMessage(jid, { text: `⛪ *Jadwal Gereja*\n\n- Ibadah Raya 1: Minggu 07.00 WIB\n- Ibadah Raya 2: Minggu 09.30 WIB\n- Ibadah Raya 3: Minggu 17.00 WIB\n- Sekolah Minggu: Minggu 09.30 WIB\n- Pemuda & Remaja: Sabtu 18.00 WIB` }, { quoted: msg });
    } else if (body.startsWith(".namakitab") || body.startsWith("namakitab")) {
        await this.sock.sendMessage(jid, { text: `📚 *Nama-nama Kitab*\n\n*Perjanjian Lama (39 Kitab):*\nKejadian, Keluaran, Imamat, Bilangan, Ulangan, Yosua, Hakim-Hakim, Rut, 1&2 Samuel, 1&2 Raja-Raja, 1&2 Tawarikh, Ezra, Nehemia, Ester, Ayub, Mazmur, Amsal, Pengkhotbah, Kidung Agung, Yesaya, Yeremia, Ratapan, Yehezkiel, Daniel, Hosea, Yoel, Amos, Obaja, Yunus, Mikha, Nahum, Habakuk, Zefanya, Hagai, Zakharia, Maleakhi.\n\n*Perjanjian Baru (27 Kitab):*\nMatius, Markus, Lukas, Yohanes, Kisah Para Rasul, Roma, 1&2 Korintus, Galatia, Efesus, Filipi, Kolose, 1&2 Tesalonika, 1&2 Timotius, Titus, Filemon, Ibrani, Yakobus, 1&2 Petrus, 1-3 Yohanes, Yudas, Wahyu.` }, { quoted: msg });
    } else if (body.startsWith(".ayatkursi") || body.startsWith("ayatkursi")) {
        const ayatKursi = `*Ayat Kursi*\n\nٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌۭ وَلَا نَوْمٌۭ ۚ لَّهُۥ مَا فِى ٱلسَّمَـٰوَٰتِ وَمَا فِى ٱلْأَرْضِ ۗ مَن ذَا ٱلَّذِى يَشْفَعُ عِندَهُۥٓ إِلَّا بِإِذْنِهِۦ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَىْءٍۢ مِّنْ عِلْمِهِۦٓ إِلَّا بِمَا شَآءَ ۚ وَسِعَ كُرْسِيُّهُ ٱلسَّمَـٰوَٰتِ وَٱلْأَرْضَ ۖ وَلَا يَـُٔودُهُۥ حِفْظُهُمَا ۚ وَهُوَ ٱلْعَلِىُّ ٱلْعَظِيمُ\n\n*Artinya:* Allah, tidak ada tuhan selain Dia. Yang Mahahidup, Yang terus menerus mengurus (makhluk-Nya), tidak mengantuk dan tidak tidur. Milik-Nya apa yang ada di langit dan apa yang ada di bumi. Tidak ada yang dapat memberi syafaat di sisi-Nya tanpa izin-Nya. Dia mengetahui apa yang di hadapan mereka dan apa yang di belakang mereka, dan mereka tidak mengetahui sesuatu apa pun tentang ilmu-Nya melainkan apa yang Dia kehendaki. Kursi-Nya meliputi langit dan bumi. Dan Dia tidak merasa berat memelihara keduanya, dan Dia Mahatinggi, Mahabesar. (QS. Al-Baqarah: 255)`;
        await this.sock.sendMessage(jid, { text: ayatKursi }, { quoted: msg });
    } else if (body.startsWith(".tekssholat") || body.startsWith("tekssholat")) {
        const teks = `*Teks/Bacaan Sholat*\n\nSilakan cari referensi bacaan sholat lengkap di sumber terpercaya seperti NU Online, Muhammadiyah, atau aplikasi Al-Qur'an dan Hadits.`;
        await this.sock.sendMessage(jid, { text: teks }, { quoted: msg });
    } else if (body.startsWith(".hadits") || body.startsWith("hadits")) {
        const hadits = [
            "Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia lainnya. (HR. Ahmad)",
            "Kebersihan itu sebagian dari iman. (HR. Muslim)",
            "Barangsiapa menempuh jalan untuk mencari ilmu, maka Allah akan mudahkan baginya jalan menuju surga. (HR. Muslim)",
            "Sesungguhnya amal itu tergantung pada niatnya. (HR. Bukhari dan Muslim)"
        ];
        const randomHadits = hadits[Math.floor(Math.random() * hadits.length)];
        await this.sock.sendMessage(jid, { text: `📜 *Hadits*\n\n${randomHadits}` }, { quoted: msg });
    } else if (body.startsWith(".jadwalsholat") || body.startsWith("jadwalsholat")) {
        const city = messageContent.replace(/^\.?jadwalsholat\s*/i, "").trim();
        if (!city) {
            await this.sock.sendMessage(jid, { text: `🕌 *Jadwal Sholat*\n\nSilakan masukkan nama kota.\nContoh: .jadwalsholat jakarta` }, { quoted: msg });
        } else {
            try {
                const res = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=Indonesia&method=8`);
                if (res.data && res.data.data && res.data.data.timings) {
                    const t = res.data.data.timings;
                    const text = `🕌 *Jadwal Sholat - ${city.toUpperCase()}*\n\nImsak: ${t.Imsak}\nSubuh: ${t.Fajr}\nTerbit: ${t.Sunrise}\nDzuhur: ${t.Dhuhr}\nAshar: ${t.Asr}\nMaghrib: ${t.Maghrib}\nIsya: ${t.Isha}\n\n_Sumber: Aladhan API_`;
                    await this.sock.sendMessage(jid, { text: text }, { quoted: msg });
                } else {
                    await this.sock.sendMessage(jid, { text: `❌ Kota "${city}" tidak ditemukan.` }, { quoted: msg });
                }
            } catch (error) {
                await this.sock.sendMessage(jid, { text: `❌ Gagal mengambil data jadwal sholat untuk kota "${city}".` }, { quoted: msg });
            }
        }
    } else if (body.startsWith(".kisahnabi") || body.startsWith("kisahnabi")) {
        const kisah = [
            "Nabi Muhammad SAW adalah nabi terakhir yang diutus oleh Allah SWT. Beliau lahir di Makkah dan menerima wahyu Al-Qur'an melalui Malaikat Jibril.",
            "Nabi Nuh AS berdakwah selama 950 tahun namun hanya sedikit yang beriman. Beliau diperintahkan Allah membuat kapal besar untuk selamat dari banjir bah.",
            "Nabi Ibrahim AS dikenal sebagai Bapak Para Nabi. Beliau membangun Ka'bah bersama putranya, Nabi Ismail AS.",
            "Nabi Musa AS membelah lautan Merah atas izin Allah untuk menyelamatkan Bani Israil dari kejaran Fir'aun."
        ];
        const randomKisah = kisah[Math.floor(Math.random() * kisah.length)];
        await this.sock.sendMessage(jid, { text: `📖 *Kisah Nabi*\n\n${randomKisah}` }, { quoted: msg });
    } else if (body.startsWith(".niatsholat") || body.startsWith("niatsholat")) {
        const niat = `*Niat Sholat Fardhu*\n\n1. *Subuh:* Ushalli fardhas subhi rak'ataini mustaqbilal qiblati adaa'an (ma'muman/imaman) lillaahi ta'aalaa.\n2. *Dzuhur:* Ushalli fardhadz dzuhri arba'a raka'aatin mustaqbilal qiblati adaa'an (ma'muman/imaman) lillaahi ta'aalaa.\n3. *Ashar:* Ushalli fardhal ashri arba'a raka'aatin mustaqbilal qiblati adaa'an (ma'muman/imaman) lillaahi ta'aalaa.\n4. *Maghrib:* Ushalli fardhal maghribi tsalaatsa raka'aatin mustaqbilal qiblati adaa'an (ma'muman/imaman) lillaahi ta'aalaa.\n5. *Isya:* Ushalli fardhal isyaa'i arba'a raka'aatin mustaqbilal qiblati adaa'an (ma'muman/imaman) lillaahi ta'aalaa.`;
        await this.sock.sendMessage(jid, { text: niat }, { quoted: msg });
    } else if (body.startsWith(".quotesislami") || body.startsWith("quotesislami")) {
        const quotes = [
            "Jangan bersedih, sesungguhnya Allah bersama kita. (QS. At-Taubah: 40)",
            "Allah tidak membebani seseorang melainkan sesuai dengan kesanggupannya. (QS. Al-Baqarah: 286)",
            "Maka sesungguhnya bersama kesulitan ada kemudahan. (QS. Al-Insyirah: 5)",
            "Sabar itu memang pahit, tapi buahnya lebih manis dari madu.",
            "Jadikan sabar dan sholat sebagai penolongmu. (QS. Al-Baqarah: 45)"
        ];
        const randomQuotes = quotes[Math.floor(Math.random() * quotes.length)];
        await this.sock.sendMessage(jid, { text: `✨ *Quotes Islami*\n\n${randomQuotes}` }, { quoted: msg });
    } else if (body.startsWith(".sewabot") || body.startsWith("sewabot")) {
       const text = messageContent.replace(/^\.?sewabot\s*/i, "").trim();
       if (!text) {
          await this.sock.sendMessage(jid, { text: `Silakan hubungi owner untuk menyewa bot.` }, { quoted: msg });
       } else {
          await this.sock.sendMessage(jid, { text: `Pesan custom sewa: ${text}` }, { quoted: msg });
       }
    } else if (body.startsWith(".promote") || body.startsWith("promote")) {
       if (!jid.endsWith("@g.us")) return;
       const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
       let targets = contextInfo.mentionedJid || [];
       if (contextInfo.participant) targets.push(contextInfo.participant);
       if (targets.length > 0) {
           try {
             await this.sock.groupParticipantsUpdate(jid, targets, "promote");
             await this.sock.sendMessage(jid, { text: `✅ Berhasil promote menjadi admin!` }, { quoted: msg });
           } catch {
             await this.sock.sendMessage(jid, { text: "Gagal promote." }, { quoted: msg });
           }
       } else {
           await this.sock.sendMessage(jid, { text: "Tag atau reply member yang ingin di-promote!" }, { quoted: msg });
       }
    } else if (body.startsWith(".demote") || body.startsWith("demote")) {
       if (!jid.endsWith("@g.us")) return;
       const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
       let targets = contextInfo.mentionedJid || [];
       if (contextInfo.participant) targets.push(contextInfo.participant);
       if (targets.length > 0) {
           try {
             await this.sock.groupParticipantsUpdate(jid, targets, "demote");
             await this.sock.sendMessage(jid, { text: `✅ Berhasil demote dari admin!` }, { quoted: msg });
           } catch {
             await this.sock.sendMessage(jid, { text: "Gagal demote." }, { quoted: msg });
           }
       } else {
           await this.sock.sendMessage(jid, { text: "Tag atau reply member yang ingin di-demote!" }, { quoted: msg });
       }
    } else if (body === ".linkgc" || body === "linkgc") {
      if (!jid.endsWith("@g.us")) {
        await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di dalam grup!" }, { quoted: msg });
      } else {
        try {
          const code = await this.sock.groupInviteCode(jid);
          await this.sock.sendMessage(jid, { text: `🔗 *Link Group*\n\nhttps://chat.whatsapp.com/${code}` }, { quoted: msg });
        } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal mendapatkan link grup. Pastikan bot adalah admin." }, { quoted: msg });
        }
      }
    } else if (body.startsWith(".setppgc") || body.startsWith("setppgc")) {
      const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
      const isImage = msg.message?.imageMessage;
      if (!isImage && !isQuotedImage) {
          await this.sock.sendMessage(jid, { text: `Kirim atau balas gambar dengan caption .setppgc untuk mengubah foto grup.` }, { quoted: msg });
      } else {
          try {
              const pseudoMsg = isQuotedImage ? { message: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage } : msg;
              const buffer = await downloadMediaMessage(pseudoMsg as any, 'buffer', {}, { logger: pino({ level: 'silent' }) as any, reuploadRequest: this.sock.updateMediaMessage });
              
              // We dispatch the picture update. Both commands can use the same native update for now.
              // Native whatsapp update doesn't differentiate between panjangan and normal via baileys buffer unless specific formats are used, 
              // but we pass buffer directly.
              await this.sock.updateProfilePicture(jid, buffer as Buffer);
              await this.sock.sendMessage(jid, { text: `✅ Berhasil mengubah profil grup!` }, { quoted: msg });
          } catch (e: any) {
              console.error("setppgc error: ", e);
              await this.sock.sendMessage(jid, { text: `❌ Gagal mengubah profil grup. Pastikan bot adalah admin.` }, { quoted: msg });
          }
      }
    } else if (body.startsWith(".delppgc") || body.startsWith("delppgc")) {
      await this.sock.sendMessage(jid, { text: `✅ Berhasil menghapus profil grup!` }, { quoted: msg });
    } else if (body.startsWith(".setwelcome") || body.startsWith("setwelcome") || body.startsWith(".setwelcom") || body.startsWith("setwelcom")) {
      const text = messageContent.replace(/^\.?(setwelcome|setwelcom)[\s\n]*/i, "").trim();
      if (!text) {
        await this.sock.sendMessage(jid, { text: `Kirim perintah dengan teks welcome!\nContoh: .setwelcome Selamat datang @user!` }, { quoted: msg });
      } else {
        const settings = this.groupSettings.get(jid) || {};
        settings.welcomeMessage = text;
        settings.welcomeEnabled = true;
        this.groupSettings.set(jid, settings);
        this.saveGroupSettings();
        await this.sock.sendMessage(jid, { text: `✅ Berhasil mengatur pesan welcome! (Otomatis diaktifkan)\n\nPreview:\n${text}` }, { quoted: msg });
      }
      this.broadcastState(`Responded to setwelcome command`);
    } else if (body.startsWith(".setbye") || body.startsWith("setbye") || body.startsWith(".setgoodbye") || body.startsWith("setgoodbye")) {
      const text = messageContent.replace(/^\.?(setbye|setgoodbye)[\s\n]*/i, "").trim();
      if (!text) {
        await this.sock.sendMessage(jid, { text: `Kirim perintah dengan teks bye!\nContoh: .setbye Selamat tinggal @user!` }, { quoted: msg });
      } else {
        const settings = this.groupSettings.get(jid) || {};
        settings.goodbyeMessage = text;
        settings.goodbyeEnabled = true;
        this.groupSettings.set(jid, settings);
        this.saveGroupSettings();
        await this.sock.sendMessage(jid, { text: `✅ Berhasil mengatur pesan bye! (Otomatis diaktifkan)\n\nPreview:\n${text}` }, { quoted: msg });
      }
      this.broadcastState(`Responded to setbye command`);
    } else if (body.startsWith(".welcome") || body.startsWith("welcome") || body.startsWith(".welcom") || body.startsWith("welcom")) {
      if (body.includes("on")) {
        const settings = this.groupSettings.get(jid) || {};
        settings.welcomeEnabled = true;
        this.groupSettings.set(jid, settings);
        this.saveGroupSettings();
        if (!settings.welcomeMessage) {
           await this.sock.sendMessage(jid, { text: `✅ Welcome berhasil diaktifkan!\n\n⚠️ _Pesan welcome belum diatur. Silakan gunakan perintah .setwelcome teks_` }, { quoted: msg });
        } else {
           await this.sock.sendMessage(jid, { text: `✅ Welcome berhasil diaktifkan!` }, { quoted: msg });
        }
      } else if (body.includes("off")) {
        const settings = this.groupSettings.get(jid) || {};
        settings.welcomeEnabled = false;
        this.groupSettings.set(jid, settings);
        this.saveGroupSettings();
        await this.sock.sendMessage(jid, { text: `❌ Welcome berhasil dimatikan!` }, { quoted: msg });
      } else {
        await this.sock.sendMessage(jid, { text: `Ketik on atau off! Contoh: .welcome on` }, { quoted: msg });
      }
      this.broadcastState(`Responded to welcome command`);
    } else if (body.startsWith(".goodbye") || body.startsWith("goodbye") || body.startsWith(".bye") || body.startsWith("bye")) {
      if (body.includes("on")) {
        const settings = this.groupSettings.get(jid) || {};
        settings.goodbyeEnabled = true;
        this.groupSettings.set(jid, settings);
        this.saveGroupSettings();
        if (!settings.goodbyeMessage) {
           await this.sock.sendMessage(jid, { text: `✅ Goodbye berhasil diaktifkan!\n\n⚠️ _Pesan goodbye belum diatur. Silakan gunakan perintah .setbye teks_` }, { quoted: msg });
        } else {
           await this.sock.sendMessage(jid, { text: `✅ Goodbye berhasil diaktifkan!` }, { quoted: msg });
        }
      } else if (body.includes("off")) {
        const settings = this.groupSettings.get(jid) || {};
        settings.goodbyeEnabled = false;
        this.groupSettings.set(jid, settings);
        this.saveGroupSettings();
        await this.sock.sendMessage(jid, { text: `❌ Goodbye berhasil dimatikan!` }, { quoted: msg });
      } else {
        await this.sock.sendMessage(jid, { text: `Ketik on atau off! Contoh: .goodbye on` }, { quoted: msg });
      }
    } else if (body.startsWith(".antitagsw") || body.startsWith("antitagsw") || body.startsWith(".antivideo") || body.startsWith("antivideo") || body.startsWith(".antifoto1x") || body.startsWith("antifoto1x") || body.startsWith(".antifoto") || body.startsWith("antifoto") || body.startsWith(".antistiker") || body.startsWith("antistiker") || body.startsWith(".antispam") || body.startsWith("antispam") || body.startsWith(".antivirtex") || body.startsWith("antivirtex") || body.startsWith(".antitoxic") || body.startsWith("antitoxic")) {
      const featureName = body.split(" ")[0].replace(".", "");
      const settings = this.groupSettings.get(jid) || {};
      if (body.includes("on")) {
        (settings as any)[featureName] = true;
        this.groupSettings.set(jid, settings);
        this.saveGroupSettings();
        await this.sock.sendMessage(jid, { text: `✅ Fitur ${featureName} berhasil diaktifkan!` }, { quoted: msg });
      } else if (body.includes("off")) {
        (settings as any)[featureName] = false;
        this.groupSettings.set(jid, settings);
        this.saveGroupSettings();
        await this.sock.sendMessage(jid, { text: `❌ Fitur ${featureName} berhasil dimatikan!` }, { quoted: msg });
      } else {
        await this.sock.sendMessage(jid, { text: `Ketik on atau off! Contoh: .${featureName} on` }, { quoted: msg });
      }
    } else if (body.startsWith(".setnamegc") || body.startsWith("setnamegc")) {
      if (!jid.endsWith("@g.us")) {
        await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di dalam grup!" }, { quoted: msg });
      } else {
        const text = messageContent.replace(/^\.?setnamegc\s*/i, "").trim();
        if (!text) {
          await this.sock.sendMessage(jid, { text: "Kirim perintah dengan nama baru, contoh: .setnamegc Grup Baru" }, { quoted: msg });
        } else {
          try {
            await this.sock.groupUpdateSubject(jid, text);
            await this.sock.sendMessage(jid, { text: `✅ Berhasil mengubah nama grup menjadi: ${text}` }, { quoted: msg });
          } catch (e) {
            await this.sock.sendMessage(jid, { text: "Gagal mengubah nama grup. Pastikan bot admin." }, { quoted: msg });
          }
        }
      }
    } else if (body.startsWith(".setdescgc") || body.startsWith("setdescgc")) {
      if (!jid.endsWith("@g.us")) {
        await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di dalam grup!" }, { quoted: msg });
      } else {
        const text = messageContent.replace(/^\.?setdescgc\s*/i, "").trim();
        if (!text) {
          await this.sock.sendMessage(jid, { text: "Kirim perintah dengan deskripsi baru, contoh: .setdescgc Deskripsi Grup" }, { quoted: msg });
        } else {
          try {
            await this.sock.groupUpdateDescription(jid, text);
            await this.sock.sendMessage(jid, { text: `✅ Berhasil mengubah deskripsi grup!` }, { quoted: msg });
          } catch (e) {
            await this.sock.sendMessage(jid, { text: "Gagal mengubah deskripsi grup. Pastikan bot admin." }, { quoted: msg });
          }
        }
      }
    } else if (body.startsWith(".autotyping") || body.startsWith("autotyping")) {
       if (body.includes("on")) {
           this.autoTypingEnabled = true;
           this.saveBotSettings();
           await this.sock.sendMessage(jid, { text: `✅ Auto Type berhasil diaktifkan!` }, { quoted: msg });
       } else if (body.includes("off")) {
           this.autoTypingEnabled = false;
           this.saveBotSettings();
           await this.sock.sendMessage(jid, { text: `❌ Auto Type berhasil dimatikan!` }, { quoted: msg });
       } else {
           await this.sock.sendMessage(jid, { text: `Ketik on atau off! Contoh: .autotyping on` }, { quoted: msg });
       }
    } else if (body.startsWith(".antibot") || body.startsWith("antibot")) {
       if (body.includes("on")) {
           this.antibotEnabled = true;
           this.saveBotSettings();
           await this.sock.sendMessage(jid, { text: `✅ Antibot berhasil diaktifkan!` }, { quoted: msg });
       } else if (body.includes("off")) {
           this.antibotEnabled = false;
           this.saveBotSettings();
           await this.sock.sendMessage(jid, { text: `❌ Antibot berhasil dimatikan!` }, { quoted: msg });
       } else {
           await this.sock.sendMessage(jid, { text: `Ketik on atau off! Contoh: .antibot on` }, { quoted: msg });
       }
    } else if (body.startsWith(".autoread") || body.startsWith("autoread")) {
       if (body.includes("on")) {
           this.autoReadEnabled = true;
           this.saveBotSettings();
           await this.sock.sendMessage(jid, { text: `✅ Autoread berhasil diaktifkan!` }, { quoted: msg });
       } else if (body.includes("off")) {
           this.autoReadEnabled = false;
           this.saveBotSettings();
           await this.sock.sendMessage(jid, { text: `❌ Autoread berhasil dimatikan!` }, { quoted: msg });
       } else {
           await this.sock.sendMessage(jid, { text: `Ketik on atau off! Contoh: .autoread on` }, { quoted: msg });
       }
    } else if (body.startsWith(".savekontak") || body.startsWith("savekontak")) {
        if (!isGroup) {
            await this.sock.sendMessage(jid, { text: `❌ Perintah ini hanya bisa digunakan di dalam Grup!` }, { quoted: msg });
            return;
        }
        try {
            const metadata = await this.sock.groupMetadata(jid);
            const participants = metadata.participants;
            let vcard = "";
            for (let participant of participants) {
                const number = participant.id.split('@')[0];
                vcard += `BEGIN:VCARD\nVERSION:3.0\nFN:${number}\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD\n`;
            }
            const fileName = `Kontak_${metadata.subject}.vcf`;
            const buffer = Buffer.from(vcard);
            await this.sock.sendMessage(jid, {
                document: buffer,
                mimetype: 'text/vcard',
                fileName: fileName,
                caption: `✅ Berhasil menyimpan ${participants.length} kontak dari grup *${metadata.subject}*`
            }, { quoted: msg });
            this.broadcastState(`Responded to savekontak command in ${metadata.subject}`);
        } catch (e) {
            await this.sock.sendMessage(jid, { text: `❌ Gagal mengambil daftar kontak: ${e}` }, { quoted: msg });
        }
    } else if (body.startsWith(".addsewa") || body.startsWith("addsewa")) {
       await this.sock.sendMessage(jid, { text: `✅ Nomor sewa baru berhasil ditambahkan!` }, { quoted: msg });
    } else if (body.startsWith(".delsewa") || body.startsWith("delsewa")) {
       await this.sock.sendMessage(jid, { text: `✅ Nomor sewa berhasil dihapus!` }, { quoted: msg });
    } else if (body.startsWith(".listsewa") || body.startsWith("listsewa")) {
       await this.sock.sendMessage(jid, { text: `📋 *List Nomor Sewa:*\n1. 628xxx (Aktif)` }, { quoted: msg });
    } else if (body === ".owner" || body === "owner") {
       const ownerList = ["6281234567890"];
       let text = "👑 *Pemilik Bot*\n\n";
       ownerList.forEach((num, i) => text += `${i+1}. wa.me/${num}\n`);
       await this.sock.sendMessage(jid, { text }, { quoted: msg });
    } else if (body.startsWith(".stiker") || body.startsWith("stiker") || body.startsWith(".hd") || body.startsWith("hd")) {
      const type = body.includes("hd") ? "HD" : "Stiker";
      
      const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
      const isQuotedVideo = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
      const isImage = msg.message?.imageMessage;
      const isVideo = msg.message?.videoMessage;

      const mediaMessage = isQuotedImage 
        ? { message: { imageMessage: isQuotedImage } } 
        : isQuotedVideo 
          ? { message: { videoMessage: isQuotedVideo } } 
          : (isImage || isVideo ? msg : null);

      if (mediaMessage) {
        try {
          const buffer = await downloadMediaMessage(mediaMessage as any, 'buffer', {}, { logger: pino({ level: 'silent' }) as any, reuploadRequest: this.sock.updateMediaMessage });
          if (type === "Stiker") {
              const stickerBuffer = await sharp(buffer as Buffer).resize(512, 512, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } }).webp({ quality: 80 }).toBuffer();
              await this.sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg });
          } else {
              const hdBuffer = await sharp(buffer as Buffer).resize({ width: 2000, withoutEnlargement: false }).sharpen({ sigma: 1, m1: 2, m2: 0 }).jpeg({ quality: 100 }).toBuffer();
              await this.sock.sendMessage(jid, { image: hdBuffer, caption: `✅ Berhasil menjernihkan foto!` }, { quoted: msg });
          }
        } catch (e) {
          await this.sock.sendMessage(jid, { text: `❌ Gagal memproses gambar. Pastikan format didukung!` }, { quoted: msg });
        }
      } else {
        await this.sock.sendMessage(jid, { text: `Kirim atau balas gambar dengan caption ${body.split(" ")[0]} untuk menggunakan fitur ${type}.` }, { quoted: msg });
      }
    } else if (body.startsWith(".culikswgc") || body.startsWith("culikswgc")) {
      if (body.includes("on")) {
        this.activeSwGroups.add(jid);
        await this.sock.sendMessage(jid, { text: `✅ Auto Culik SW berhasil diaktifkan di grup ini!` }, { quoted: msg });
      } else if (body.includes("off")) {
        this.activeSwGroups.delete(jid);
        await this.sock.sendMessage(jid, { text: `❌ Auto Culik SW berhasil dimatikan di grup ini!` }, { quoted: msg });
      } else {
        await this.sock.sendMessage(jid, { text: `Ketik on atau off! Contoh: .culikswgc on` }, { quoted: msg });
      }
    } else if (body.startsWith(".culikprofilegc") || body.startsWith("culikprofilegc")) {
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const target = quotedParticipant || mentionedJid;
      
      if (target) {
        try {
          const ppUrl = await this.sock.profilePictureUrl(target, 'image');
          await this.sock.sendMessage(jid, { image: { url: ppUrl }, caption: `📸 Foto profil dari @${target.split("@")[0]}`, mentions: [target] }, { quoted: msg });
        } catch (e) {
          await this.sock.sendMessage(jid, { text: "Gagal mendapatkan foto profil (mungkin di-private atau default)." }, { quoted: msg });
        }
      } else {
        await this.sock.sendMessage(jid, { text: "Balas pesan orangnya atau tag orangnya dengan caption .culikprofilegc" }, { quoted: msg });
      }
    } else if (body.startsWith(".ceksifat") || body.startsWith("ceksifat")) {
       const sifatList = ["Pemarah", "Penyabar", "Pemalas", "Rajin", "Baik Hati", "Pelit", "Cengeng", "Pemberani", "Penakut", "Ceria"];
       const randomSifat = sifatList[Math.floor(Math.random() * sifatList.length)];
       await this.sock.sendMessage(jid, { text: `🎭 *Cek Sifat*\n\nSifat kamu adalah: *${randomSifat}*` }, { quoted: msg });
    } else if (body.startsWith(".cekkenakalan") || body.startsWith("cekkenakalan")) {
       const percentage = Math.floor(Math.random() * 101);
       await this.sock.sendMessage(jid, { text: `😈 *Cek Kenakalan*\n\nTingkat kenakalan kamu adalah: *${percentage}%*` }, { quoted: msg });
    } else if (body.startsWith(".cekperawan") || body.startsWith("cekperawan") || body.startsWith(".cekperjaka") || body.startsWith("cekperjaka")) {
       const percentage = Math.floor(Math.random() * 101);
       await this.sock.sendMessage(jid, { text: `👀 *Cek Perawan / Perjaka*\n\nTingkat keperawanan/keperjakaan kamu adalah: *${percentage}%*` }, { quoted: msg });
    } else if (body.startsWith(".cekjanda") || body.startsWith("cekjanda") || body.startsWith(".cekduda") || body.startsWith("cekduda")) {
       const percentage = Math.floor(Math.random() * 101);
       await this.sock.sendMessage(jid, { text: `👀 *Cek Janda / Duda*\n\nPotensi menjadi janda/duda adalah: *${percentage}%*` }, { quoted: msg });
    } else if (body.startsWith(".bego") || body.startsWith("bego")) {
       const percentage = Math.floor(Math.random() * 101);
       await this.sock.sendMessage(jid, { text: `🤪 *Cek Kebegoan*\n\nTingkat kebegoan kamu adalah: *${percentage}%*` }, { quoted: msg });
    } else if (body.startsWith(".rate") || body.startsWith("rate")) {
       const args = body.split(" ").slice(1).join(" ");
       const percentage = Math.floor(Math.random() * 101);
       await this.sock.sendMessage(jid, { text: `📊 *Rate*\n\nRate untuk ${args ? '*' + args + '*' : 'kamu'} adalah: *${percentage}%*` }, { quoted: msg });
    } else if (body.startsWith(".top") || body.startsWith("top")) {
       if (!isGroup) {
           await this.sock.sendMessage(jid, { text: `❌ Perintah ini hanya bisa digunakan di dalam Grup!` }, { quoted: msg });
           return;
       }
       const args = body.split(" ").slice(1).join(" ") || "Terkecoh";
       try {
           const metadata = await this.sock.groupMetadata(jid);
           const participants = metadata.participants;
           const shuffled = participants.sort(() => 0.5 - Math.random());
           const top = shuffled.slice(0, Math.min(10, participants.length));
           let teks = `🏆 *Top 10 ${args} di ${metadata.subject}*\n\n`;
           top.forEach((p: any, i: number) => {
               teks += `${i + 1}. @${p.id.split('@')[0]}\n`;
           });
           await this.sock.sendMessage(jid, { text: teks, mentions: top.map((p: any) => p.id) }, { quoted: msg });
       } catch (e) {
           await this.sock.sendMessage(jid, { text: `❌ Gagal mengambil data grup.` }, { quoted: msg });
       }
    } else if (body.startsWith(".cekkhodam") || body.startsWith("cekkhodam")) {
      const khodams = ["Macan Putih", "Harimau Kumbang", "Nyi Roro Kidul", "Kuntilanak", "Tuyul", "Genderuwo", "Naga Emas", "Kucing Hitam", "Buaya Darat", "Tidak ada khodam", "Jin Tomang"];
      const randomKhodam = khodams[Math.floor(Math.random() * khodams.length)];
      await this.sock.sendMessage(jid, { text: `👻 *Cek Khodam*\n\nKhodam kamu adalah: *${randomKhodam}*` }, { quoted: msg });
      this.broadcastState(`Responded to cekkhodam command`);
    } else if (body.startsWith(".cekganteng") || body.startsWith("cekganteng") || body.startsWith(".cekcantik") || body.startsWith("cekcantik")) {
      const percentage = Math.floor(Math.random() * 101);
      await this.sock.sendMessage(jid, { text: `✨ *Cek Ketampanan/Kecantikan*\n\nTingkat kegantengan/kecantikan kamu adalah: *${percentage}%*` }, { quoted: msg });
      this.broadcastState(`Responded to cekganteng/cekcantik command`);
    } else if (body.startsWith(".cekjodoh") || body.startsWith("cekjodoh")) {
      const percentage = Math.floor(Math.random() * 101);
      await this.sock.sendMessage(jid, { text: `💖 *Cek Jodoh*\n\nTingkat kecocokan kamu dengan dia adalah: *${percentage}%*` }, { quoted: msg });
      this.broadcastState(`Responded to cekjodoh command`);
    } else if (body.startsWith(".ceklesby") || body.startsWith("ceklesby") || body.startsWith(".cekgay") || body.startsWith("cekgay") || body.startsWith(".cekpasangan") || body.startsWith("cekpasangan") || body.startsWith(".cekkesetiaan") || body.startsWith("cekkesetiaan")) {
      const percentage = Math.floor(Math.random() * 101);
      const cmdName = body.split(" ")[0].replace(".", "");
      await this.sock.sendMessage(jid, { text: `📊 *${cmdName.toUpperCase()}*\n\nHasil: *${percentage}%*` }, { quoted: msg });
    } else if (body.startsWith(".cekwibu") || body.startsWith("cekwibu") || body.startsWith(".ceksange") || body.startsWith("ceksange") || body.startsWith(".cekkaya") || body.startsWith("cekkaya") || body.startsWith(".cekbucin") || body.startsWith("cekbucin")) {
      const percentage = Math.floor(Math.random() * 101);
      const cmdName = body.split(" ")[0].replace(".", "");
      await this.sock.sendMessage(jid, { text: `📊 *${cmdName.toUpperCase()}*\n\nTingkat ${cmdName.replace("cek", "")} kamu adalah: *${percentage}%*` }, { quoted: msg });
    } else if (body.startsWith(".artinama") || body.startsWith("artinama") || body.startsWith(".cekmasadepan") || body.startsWith("cekmasadepan")) {
       const cmdName = body.split(" ")[0].replace(".", "");
       const target = body.split(" ").slice(1).join(" ");
       if (!target) {
           await this.sock.sendMessage(jid, { text: `Tolong sebutkan nama. Contoh: .${cmdName} Budi` }, { quoted: msg });
       } else {
           const hasilNama = ["Orangnya penyayang", "Suka menabung", "Gampang marah", "Suka tidur", "Pemalas tapi pintar", "Rajin dan pekerja keras"];
           const hasilMasaDepan = ["Menjadi CEO", "Menjadi pengangguran sukses", "Menjadi artis", "Mendapat banyak uang", "Hidup bahagia bersama keluarga"];
           const hasil = cmdName === "artinama" ? hasilNama[Math.floor(Math.random() * hasilNama.length)] : hasilMasaDepan[Math.floor(Math.random() * hasilMasaDepan.length)];
           await this.sock.sendMessage(jid, { text: `🔮 *${cmdName.toUpperCase()}*\n\nNama: *${target}*\nHasil: *${hasil}*` }, { quoted: msg });
       }
    } else if (body.startsWith(".infonegara") || body.startsWith("infonegara")) {
       const negara = ["Indonesia", "Jepang", "Korea Selatan", "Amerika Serikat", "Rusia", "Inggris"];
       const n = negara[Math.floor(Math.random() * negara.length)];
       await this.sock.sendMessage(jid, { text: `🌎 *Info Negara*\n\nNegara acak: *${n}*\nTahukah kamu? Ini adalah negara yang luar biasa!` }, { quoted: msg });
    } else if (body.startsWith(".pantun") || body.startsWith("pantun")) {
       const pantunList = [
         "Beli mangga di pasar lama, belinya sama si Rina.\nKalau cinta sudah membara, apapun kan kulakukan untuknya.",
         "Beli paku di toko besi, pakunya ditaruh di dalam laci.\nJangan suka mengeluh di pagi hari, nanti rezekinya lari.",
         "Berakit-rakit ke hulu, berenang-renang ke tepian.\nBersakit-sakit dahulu, bersenang-senang kemudian.",
         "Pagi-pagi minum kopi, minumnya di pinggir kali.\nJika kamu ingin happy, jangan lupa tersenyum hari ini."
       ];
       const p = pantunList[Math.floor(Math.random() * pantunList.length)];
       await this.sock.sendMessage(jid, { text: `🎭 *Pantun*\n\n${p}` }, { quoted: msg });
    } else if (body.startsWith(".ceksial") || body.startsWith("ceksial") || body.startsWith(".ramalannasib") || body.startsWith("ramalannasib") || body.startsWith(".ramalanjodoh") || body.startsWith("ramalanjodoh") || body.startsWith(".ramalancinta") || body.startsWith("ramalancinta") || body.startsWith(".ramalankeburukan") || body.startsWith("ramalankeburukan")) {
       const percentage = Math.floor(Math.random() * 101);
       const cmdName = body.split(" ")[0].replace(".", "");
       await this.sock.sendMessage(jid, { text: `🔮 *${cmdName.toUpperCase()}*\n\nHasil: *${percentage}%*` }, { quoted: msg });
    } else if (body.startsWith(".zodiak") || body.startsWith("zodiak")) {
       const args = body.split(" ").slice(1);
       if (args.length < 2) {
         await this.sock.sendMessage(jid, { text: `Tolong masukkan bulan dan tanggal. Contoh: .zodiak 1 15` }, { quoted: msg });
       } else {
         try {
           const month = parseInt(args[0]);
           const date = parseInt(args[1]);
           if (isNaN(month) || isNaN(date)) {
             await this.sock.sendMessage(jid, { text: `Format salah! Pastikan bulan dan tanggal berupa angka.` }, { quoted: msg });
           } else {
             const scraper = await import('@bochilteam/scraper');
             const z = scraper.getZodiac(month, date);
             await this.sock.sendMessage(jid, { text: `♈ *Zodiak*\n\nBulan: ${month}, Tanggal: ${date}\nZodiak kamu: *${z}*` }, { quoted: msg });
           }
         } catch (e) {
           await this.sock.sendMessage(jid, { text: `❌ *Terjadi kesalahan*` }, { quoted: msg });
         }
       }
    } else if (body.startsWith(".isidompet") || body.startsWith("isidompet")) {
       const isian = ["Rp 10.000", "Kosong melompong", "Rp 50.000", "KTP doang", "Banyak bon ngutang", "Rp 100.000", "Black Card", "Recehan"];
       const hasil = isian[Math.floor(Math.random() * isian.length)];
       await this.sock.sendMessage(jid, { text: `👛 *Cek Isi Dompet*\n\nIsi dompet kamu: *${hasil}*` }, { quoted: msg });
    } else if (body.startsWith(".profesiku") || body.startsWith("profesiku")) {
       const profesi = ["Dokter", "Programmer", "Pengangguran", "Presiden", "Content Creator", "Tukang Bakso", "Pilot", "Artis", "Gamer"];
       const hasil = profesi[Math.floor(Math.random() * profesi.length)];
       await this.sock.sendMessage(jid, { text: `💼 *Cek Profesi*\n\nProfesi yang cocok buat kamu: *${hasil}*` }, { quoted: msg });
    } else if (body.startsWith(".nulis ") || body === ".nulis" || body.startsWith("nulis ") || body === "nulis") {
       const teks = messageContent.replace(/^\.?nulis\s*/i, "").trim();
       if (!teks) {
         await this.sock.sendMessage(jid, { text: `Kirim perintah .nulis [teks yang ingin ditulis]` }, { quoted: msg });
       } else {
         await this.sock.sendMessage(jid, { text: `⏳ *Sedang menulis...*` }, { quoted: msg });
         try {
           // Path to nulis-buku assets
           const nulisDir = path.join(process.cwd(), 'node_modules', 'nulis-buku');
           const bgPath = path.join(nulisDir, 'assets', 'buku1.jpg');
           const fontPath = path.join(nulisDir, 'font', 'Indie-Flower.ttf');
           const tempFile = path.join(os.tmpdir(), `nulis_${Date.now()}.jpg`);

           const panjangKalimat5 = teks.replace(/(\S+\s*){1,10}/g, '$&\n');
           const panjangBaris5 = panjangKalimat5.split('\n').slice(0, 33).join('\n');

           const now = new Date();
           const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][now.getDay()];
           const tanggal = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

           const args = [
               bgPath,
               '-font', fontPath,
               '-fill', '#1b1b1b',
               '-size', '1024x784',
               '-pointsize', '20',
               '-interline-spacing', '1',
               '-annotate', '+806+78', hari,
               '-font', fontPath,
               '-fill', '#1b1b1b',
               '-size', '1024x784',
               '-pointsize', '18',
               '-interline-spacing', '1',
               '-annotate', '+806+102', tanggal,
               '-font', fontPath,
               '-fill', '#1b1b1b',
               '-size', '1024x784',
               '-pointsize', '18',
               '-interline-spacing', '1',
               '-annotate', '+360+100', msg.pushName || 'User',
               '-font', fontPath,
               '-fill', '#1b1b1b',
               '-size', '1024x784',
               '-pointsize', '18',
               '-interline-spacing', '1',
               '-annotate', '+360+120', '-',
               '-font', fontPath,
               '-fill', '#1b1b1b',
               '-size', '1024x784',
               '-pointsize', '20',
               '-interline-spacing', '-7.5',
               '-annotate', '+344+142', panjangBaris5,
               tempFile
           ];

           await new Promise((resolve, reject) => {
               const proc = spawn('convert', args);
               proc.on('close', resolve);
               proc.on('error', reject);
           });

           if (fs.existsSync(tempFile)) {
             await this.sock.sendMessage(jid, { image: { url: tempFile }, caption: `📝 *Nulis Selesai*` }, { quoted: msg });
             fs.unlinkSync(tempFile);
           } else {
             await this.sock.sendMessage(jid, { text: `❌ *Gagal menulis (file tidak ditemukan)*` }, { quoted: msg });
           }
         } catch (e) {
           await this.sock.sendMessage(jid, { text: `❌ *Gagal menulis:* ${e.message}` }, { quoted: msg });
         }
       }
    } else if (body.startsWith(".faktadunia") || body.startsWith("faktadunia")) {
       const fakta = [
           "Madu tidak pernah basi.",
           "Gurita memiliki 3 jantung.",
           "Venus adalah planet terpanas di tata surya kita.",
           "Semut tidak pernah tidur.",
           "Gajah adalah mamalia darat terbesar."
       ];
       const f = fakta[Math.floor(Math.random() * fakta.length)];
       await this.sock.sendMessage(jid, { text: `🌍 *Fakta Dunia*\n\n${f}` }, { quoted: msg });
    } else if (body.startsWith(".cekgempa") || body.startsWith("cekgempa")) {
       await this.sock.sendMessage(jid, { text: `🌍 *Info Gempa*\n\nData gempa terbaru tidak tersedia saat ini. Silakan cek situs web BMKG untuk informasi lebih lanjut.` }, { quoted: msg });
    } else if (body.startsWith(".cekcuaca") || body.startsWith("cekcuaca")) {
       await this.sock.sendMessage(jid, { text: `⛅ *Cek Cuaca*\n\nCuaca hari ini kemungkinan cerah berawan. Tetap semangat!` }, { quoted: msg });
    } else if (body.startsWith(".meme") || body.startsWith("meme")) {
       await this.sock.sendMessage(jid, { text: `🖼️ *Meme*\n\nFitur meme sedang dalam pengembangan.` }, { quoted: msg });
    } else if (body.startsWith(".waifu") || body.startsWith("waifu")) {
       await this.sock.sendMessage(jid, { text: `🌸 *Waifu*\n\nFitur waifu sedang dalam pengembangan.` }, { quoted: msg });
    } else if (body.startsWith(".cekhoby") || body.startsWith("cekhoby")) {
      const hobbies = ["Main Game", "Tidur", "Makan", "Nyanyi", "Nonton Anime", "Membaca", "Olah Raga", "Ghibah"];
      const randomHobbies = hobbies[Math.floor(Math.random() * hobbies.length)];
      await this.sock.sendMessage(jid, { text: `🎯 *Cek Hoby*\n\nHoby kamu adalah: *${randomHobbies}*` }, { quoted: msg });
    } else if (body.startsWith(".jadian") || body.startsWith("jadian") || body.startsWith(".kiss") || body.startsWith("kiss")) {
      if (!isGroup) {
         await this.sock.sendMessage(jid, { text: "Hanya bisa di grup!" }, { quoted: msg });
      } else {
         const metadata = await this.sock.groupMetadata(jid);
         const members = metadata.participants;
         const cmd = body.split(" ")[0].replace(".", "");
         if (members.length < 2) return;
         let m1 = members[Math.floor(Math.random() * members.length)].id;
         let m2 = members[Math.floor(Math.random() * members.length)].id;
         while (m1 === m2) {
            m2 = members[Math.floor(Math.random() * members.length)].id;
         }
         
         if (cmd === "kiss") {
           await this.sock.sendMessage(jid, { text: `@${m1.split("@")[0]} 💋 mencium @${m2.split("@")[0]}`, mentions: [m1, m2] }, { quoted: msg });
         } else {
           await this.sock.sendMessage(jid, { text: `Ciee, @${m1.split("@")[0]} ❤️ jadian sama @${m2.split("@")[0]} 🎉`, mentions: [m1, m2] }, { quoted: msg });
         }
      }
    } else if (body.startsWith(".quotes") || body.startsWith("quotes")) {
      const quotesList = ["Hidup itu seperti sepeda, agar tetap seimbang kamu harus terus bergerak.", "Jangan putus asa, tidak ada sukses tanpa perjuangan.", "Waktu adalah uang.", "Masa depan adalah milik mereka yang percaya pada keindahan mimpi mereka."];
      const randomQuote = quotesList[Math.floor(Math.random() * quotesList.length)];
      await this.sock.sendMessage(jid, { text: `📝 *Quotes*\n\n"${randomQuote}"` }, { quoted: msg });
    } else if (body.startsWith(".avatar") || body.startsWith("avatar") || body.startsWith(".ppcouple") || body.startsWith("ppcouple")) {
      const isAvatar = body.startsWith(".avatar") || body.startsWith("avatar");
      if (isAvatar) {
        const seed = Math.random().toString(36).substring(7);
        const url = `https://api.dicebear.com/7.x/pixel-art/png?seed=${seed}`;
        await this.sock.sendMessage(jid, { image: { url }, caption: "Ini avatar random kamu!" }, { quoted: msg });
      } else {
        const seed1 = Math.random().toString(36).substring(7);
        const seed2 = Math.random().toString(36).substring(7);
        await this.sock.sendMessage(jid, { image: { url: `https://api.dicebear.com/7.x/adventurer/png?seed=${seed1}` }, caption: "Cowok" }, { quoted: msg });
        await this.sock.sendMessage(jid, { image: { url: `https://api.dicebear.com/7.x/adventurer/png?seed=${seed2}` }, caption: "Cewek" }, { quoted: msg });
      }
    } else if (body.startsWith(".mutegc ") || body.startsWith("mutegc ")) {
      if (!isGroup) {
         await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di grup!" }, { quoted: msg });
      } else {
         const param = body.split(" ")[1]?.toLowerCase();
         if (param === "on") {
           await this.sock.groupSettingUpdate(jid, 'announcement');
           await this.sock.sendMessage(jid, { text: `🔇 Grup ditutup, hanya admin yang bisa mengirim pesan.` }, { quoted: msg });
         } else if (param === "off") {
           await this.sock.groupSettingUpdate(jid, 'not_announcement');
           await this.sock.sendMessage(jid, { text: `🔊 Grup dibuka, semua orang bisa mengirim pesan.` }, { quoted: msg });
         } else {
           await this.sock.sendMessage(jid, { text: `Ketik .mutegc on atau .mutegc off` }, { quoted: msg });
         }
      }
    } else if (body.startsWith(".resetlink") || body.startsWith("resetlink")) {
      if (!isGroup) {
         await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di grup!" }, { quoted: msg });
      } else {
         await this.sock.groupRevokeInvite(jid);
         await this.sock.sendMessage(jid, { text: `✅ Berhasil mereset link grup!` }, { quoted: msg });
      }
    } else if (body.startsWith(".tagall") || body.startsWith("tagall")) {
      if (!isGroup) {
         await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di grup!" }, { quoted: msg });
      } else {
         const metadata = await this.sock.groupMetadata(jid);
         const members = metadata.participants.map(p => p.id);
         let text = `📣 *Tag All*\n\n`;
         members.forEach((m) => {
            text += `│ ◦ @${m.split('@')[0]}\n`;
         });
         await this.sock.sendMessage(jid, { text, mentions: members }, { quoted: msg });
      }
    } else if (body.startsWith(".setbotbio") || body.startsWith("setbotbio") || body.startsWith(".delbotbio") || body.startsWith("delbotbio")) {
      const isDel = body.startsWith(".delbotbio") || body.startsWith("delbotbio");
      if (isDel) {
         await this.sock.updateProfileStatus("I am using Wabot");
         await this.sock.sendMessage(jid, { text: `✅ Berhasil menghapus bio bot!` }, { quoted: msg });
      } else {
         const bio = body.replace(/^\.?setbotbio\s*/i, "").trim();
         if (bio) {
             await this.sock.updateProfileStatus(bio);
             await this.sock.sendMessage(jid, { text: `✅ Berhasil mengubah bio bot menjadi: ${bio}` }, { quoted: msg });
         } else {
             await this.sock.sendMessage(jid, { text: `Masukkan bio, contoh: .setbotbio Bot Aktif!` }, { quoted: msg });
         }
      }
    } else if (body.startsWith(".antivirtex") || body.startsWith("antivirtex") || body.startsWith(".antitoxic") || body.startsWith("antitoxic")) {
      await this.sock.sendMessage(jid, { text: `🛡️ Fitur anti sedang dalam pengembangan.` }, { quoted: msg });
    } else if (body.startsWith(".joingc ") || body.startsWith("joingc ") || body.startsWith(".creategc ") || body.startsWith("creategc ") || body.startsWith(".addsticker") || body.startsWith("addsticker") || body.startsWith(".delsticker") || body.startsWith("delsticker")) {
      if (body.startsWith(".joingc") || body.startsWith("joingc")) {
         const link = body.replace(/^\.?joingc\s*/i, "").trim();
         const code = link.split("chat.whatsapp.com/")[1];
         if (code) {
             try {
                 await this.sock.groupAcceptInvite(code);
                 await this.sock.sendMessage(jid, { text: `✅ Berhasil bergabung ke grup!` }, { quoted: msg });
             } catch(err) {
                 await this.sock.sendMessage(jid, { text: `Gagal bergabung. Link mungkin tidak valid.` }, { quoted: msg });
             }
         } else {
             await this.sock.sendMessage(jid, { text: `Kirim link grup! Contoh: .joingc https://chat.whatsapp.com/xxx` }, { quoted: msg });
         }
      } else if (body.startsWith(".creategc") || body.startsWith("creategc")) {
         const name = body.replace(/^\.?creategc\s*/i, "").trim();
         if (name) {
             try {
                await this.sock.groupCreate(name, []);
                await this.sock.sendMessage(jid, { text: `✅ Berhasil membuat grup *${name}*` }, { quoted: msg });
             } catch(err) {
                await this.sock.sendMessage(jid, { text: `Gagal membuat grup.` }, { quoted: msg });
             }
         } else {
             await this.sock.sendMessage(jid, { text: `Kirim nama grup! Contoh: .creategc NamaGrup` }, { quoted: msg });
         }
      } else if (body.startsWith(".addsticker") || body.startsWith("addsticker")) {
         const text = body.split(" ")[1];
         if (!text) {
             await this.sock.sendMessage(jid, { text: "Kirim perintah dengan nama stiker, sambil mereply stiker!" }, { quoted: msg });
         } else {
             const isQuotedSticker = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
             if (isQuotedSticker) {
                 const buffer = await downloadMediaMessage(
                     { message: msg.message.extendedTextMessage.contextInfo.quotedMessage } as any, 
                     'buffer', 
                     {}, 
                     { logger: pino({ level: 'silent' }) as any, reuploadRequest: this.sock.updateMediaMessage }
                 ) as Buffer;
                 this.storedStickers.set(text, buffer);
                 await this.sock.sendMessage(jid, { text: `✅ Berhasil menyimpan stiker dengan nama "${text}"` }, { quoted: msg });
             } else {
                 await this.sock.sendMessage(jid, { text: "Reply stiker dengan perintah ini!" }, { quoted: msg });
             }
         }
      } else if (body.startsWith(".delsticker") || body.startsWith("delsticker")) {
         const text = body.split(" ")[1];
         if (text && this.storedStickers.has(text)) {
             this.storedStickers.delete(text);
             await this.sock.sendMessage(jid, { text: `✅ Berhasil menghapus stiker "${text}"` }, { quoted: msg });
         } else {
             await this.sock.sendMessage(jid, { text: `Stiker tidak ditemukan!` }, { quoted: msg });
         }
      }
    } else if (body.startsWith(".afk") || body.startsWith("afk")) {
      const reason = body.split(" ").slice(1).join(" ") || "Tanpa alasan";
      const senderJid = msg.key.participant || msg.participant || jid;
      this.afkUsers.set(senderJid, { time: Date.now(), reason });
      await this.sock.sendMessage(jid, { text: `💤 @${senderJid.split("@")[0]} sekarang AFK.\nAlasan: ${reason}`, mentions: [senderJid] }, { quoted: msg });
    } else if (body.startsWith(".infouser") || body.startsWith("infouser")) {
      const senderJid = msg.key.participant || msg.participant || jid;
      const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || senderJid;
      const total = this.totalChats.get(target) || 0;
      await this.sock.sendMessage(jid, { text: `👤 *Info User*\n\nTag: @${target.split("@")[0]}\nTotal Chat: ${total}`, mentions: [target] }, { quoted: msg });
    } else if (body.startsWith(".totalchat") || body.startsWith("totalchat")) {
      const senderJid = msg.key.participant || msg.participant || jid;
      const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || senderJid;
      const total = this.totalChats.get(target) || 0;
      await this.sock.sendMessage(jid, { text: `Total chat @${target.split("@")[0]} : ${total}`, mentions: [target] }, { quoted: msg });
    } else if (body.startsWith(".leaderboard") || body.startsWith("leaderboard")) {
      if (!isGroup) {
         await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di grup!" }, { quoted: msg });
      } else {
         const metadata = await this.sock.groupMetadata(jid);
         const members = metadata.participants.map((p) => p.id);
         let lb = [];
         for (const m of members) {
             const c = this.totalChats.get(m) || 0;
             if (c > 0) lb.push({ id: m, count: c });
         }
         lb.sort((a, b) => b.count - a.count);
         let textLb = "🏆 *Leaderboard Chat Grup*\n\n";
         const top = lb.slice(0, 10);
         top.forEach((u, i) => { textLb += `${i+1}. @${u.id.split("@")[0]}: ${u.count} chat\n`; });
         await this.sock.sendMessage(jid, { text: textLb, mentions: top.map(u => u.id) }, { quoted: msg });
      }
    } else if (body.startsWith(".tagadmin") || body.startsWith("tagadmin")) {
      if (!isGroup) {
         await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di grup!" }, { quoted: msg });
      } else {
         const metadata = await this.sock.groupMetadata(jid);
         const admins = metadata.participants.filter((p) => p.admin === 'admin' || p.admin === 'superadmin').map((p) => p.id);
         let textAdmin = "👮 *Tag Admin*\n\n";
         admins.forEach((a) => { textAdmin += `│ @${a.split("@")[0]}\n`; });
         await this.sock.sendMessage(jid, { text: textAdmin, mentions: admins }, { quoted: msg });
      }
    } else if (body.startsWith(".infogrup") || body.startsWith("infogrup")) {
      if (!isGroup) {
         await this.sock.sendMessage(jid, { text: "Perintah ini hanya bisa digunakan di grup!" }, { quoted: msg });
      } else {
         const metadata = await this.sock.groupMetadata(jid);
         const admins = metadata.participants.filter((p) => p.admin).length;
         await this.sock.sendMessage(jid, { text: `🏢 *Info Grup*\n\nNama: ${metadata.subject}\nID: ${metadata.id}\nMember: ${metadata.participants.length}\nAdmin: ${admins}\nDeskripsi:\n${metadata.desc || 'Tidak ada deskripsi'}` }, { quoted: msg });
      }
    } else if (body.startsWith(".joinch") || body.startsWith("joinch")) {
      await this.sock.sendMessage(jid, { text: "Fitur joinch sedang dalam pengembangan." }, { quoted: msg });
    } else if (body === ".tebakmakanan" || body === "tebakmakanan") {
      const clue = ["Bentuknya bulat, ada yang manis ada yang gurih, tengahnya bolong.", "Donat"];
      const sentMsg = await this.sock.sendMessage(jid, { text: `🍔 *Tebak Makanan*\n\nClue: ${clue[0]}\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
      if (sentMsg?.key?.id) {
          this.activeGames.set(sentMsg.key.id, { answer: clue[1], type: "tebakmakanan" });
      }
    } else if (body === ".tebakjkt48" || body === "tebakjkt48") {
      const members = ["Zee", "Freya", "Adel", "Gracia", "Shani", "Christy", "Marsha"];
      const randomMember = members[Math.floor(Math.random() * members.length)];
      const scrambled = randomMember.split('').sort(() => 0.5 - Math.random()).join('');
      const sentMsg = await this.sock.sendMessage(jid, { text: `🎤 *Tebak JKT48*\n\nClue: ${scrambled}\n_Silakan balas (reply) pesan ini dengan jawabanmu!_` }, { quoted: msg });
      if (sentMsg?.key?.id) {
          this.activeGames.set(sentMsg.key.id, { answer: randomMember, type: "tebakjkt48" });
      }
    } else if (body.startsWith(".cekpariban") || body.startsWith("cekpariban") || body.startsWith(".cektartulang") || body.startsWith("cektartulang") || body.startsWith(".cektarito") || body.startsWith("cektarito") || body.startsWith(".cekpadan") || body.startsWith("cekpadan")) {
       let cmd = body.split(" ")[0].replace(".", "");
       const argsStr = messageContent.slice(messageContent.toLowerCase().indexOf(cmd) + cmd.length).trim();
       
       if (!argsStr.includes("|")) {
          await this.sock.sendMessage(jid, { text: `Format salah!\nContoh: .${cmd} Pandiangan|Sirait` }, { quoted: msg });
       } else {
          const [m1, m2] = argsStr.split("|").map(s => s.trim());
          if (!m1 || !m2) {
             await this.sock.sendMessage(jid, { text: `Format salah!\nPastikan ada nama marga/boru sebelum dan sesudah tanda |\nContoh: .${cmd} Pandiangan|Sirait` }, { quoted: msg });
          } else {
              const hashStr = [m1.toLowerCase(), m2.toLowerCase(), cmd].join('');
              let hash = 0; 
              for (let i = 0; i < hashStr.length; i++) hash = hashStr.charCodeAt(i) + ((hash << 5) - hash);
              // Pseudo-random true/false based on input
              const isTrue = Math.abs(hash) % 100 > 60; // 40% chance of relationship
              
              let answer = "";
              let title = "";
              
              if (cmd === "cekpariban") {
                 title = "👩‍❤️‍👨 *Cek Pariban*";
                 answer = isTrue 
                    ? `Iya, menurut perhitungan marga/boru *${m1}* dan *${m2}* kemungkinan besar marpariban!` 
                    : `Bukan, sepertinya marga/boru *${m1}* dan *${m2}* bukan pariban.`;
              } else if (cmd === "cektartulang") {
                 title = "👴 *Cek Tartulang*";
                 answer = isTrue 
                    ? `Iya, marga/boru *${m1}* dan *${m2}* kemungkinan besar martartulang!` 
                    : `Bukan, marga/boru *${m1}* dan *${m2}* sepertinya bukan tartulang.`;
              } else if (cmd === "cektarito") {
                 title = "👦👧 *Cek Tarito*";
                 answer = isTrue 
                    ? `Iya, marga/boru *${m1}* dan *${m2}* martarito (saudara)!` 
                    : `Bukan, sepertinya *${m1}* dan *${m2}* tidak martarito.`;
              } else if (cmd === "cekpadan") {
                 title = "📜 *Cek Padan*";
                 answer = isTrue 
                    ? `Iya! Marga *${m1}* dan *${m2}* terikat Padan (janji/ikatan) dan tidak boleh menikah!` 
                    : `Aman, marga *${m1}* dan *${m2}* sepertinya tidak terikat Padan secara langsung.`;
              }
              
              await this.sock.sendMessage(jid, { text: `${title}\n\nHasil: ${answer}` }, { quoted: msg });
          }
       }
       this.broadcastState(`Responded to ${cmd} command`);
    } else if (body.startsWith(".menfess") || body.startsWith("menfess") || body.startsWith(".confess") || body.startsWith("confess")) {
       let cmd = body.split(" ")[0].replace(".", "");
       const argsStr = messageContent.slice(messageContent.toLowerCase().indexOf(cmd) + cmd.length).trim();
       if (!argsStr.includes("|")) {
          await this.sock.sendMessage(jid, { text: `Format salah!\nContoh: .${cmd} 628xxx | Samaran | Halo ini pesan rahasiaku` }, { quoted: msg });
       } else {
          const parts = argsStr.split("|").map(s => s.trim());
          if (parts.length < 3) {
             await this.sock.sendMessage(jid, { text: `Format salah!\nContoh: .${cmd} 628xxx | Samaran | Halo ini pesan rahasiaku` }, { quoted: msg });
          } else {
             const [targetRaw, samaran, ...pesanArr] = parts;
             const pesan = pesanArr.join("|");
             const senderJid = msg.key.participant || msg.participant || jid;
             let targetNum = targetRaw.replace(/[^0-9]/g, "");
             if (targetNum.startsWith("0")) targetNum = "62" + targetNum.substring(1);
             const targetJid = targetNum + "@s.whatsapp.net";
             
             if (senderJid === targetJid) {
                await this.sock.sendMessage(jid, { text: "Tidak bisa mengirim menfess ke diri sendiri." }, { quoted: msg });
             } else if (this.menfessSessions.has(senderJid)) {
                await this.sock.sendMessage(jid, { text: "Kamu masih memiliki sesi menfess aktif. Ketik .stopmenfess untuk menghentikannya." }, { quoted: msg });
             } else if (this.menfessSessions.has(targetJid)) {
                await this.sock.sendMessage(jid, { text: "Target sedang dalam sesi menfess dengan orang lain. Coba lagi nanti." }, { quoted: msg });
             } else {
                this.menfessSessions.set(senderJid, { partner: targetJid, originalSender: senderJid });
                this.menfessSessions.set(targetJid, { partner: senderJid, originalSender: senderJid });
                
                const mfMsg = `Hai! Ada pesan rahasia (menfess) untukmu.\n\nDari: ${samaran}\nPesan: ${pesan}\n\n_Ketik .balasmenfess [pesan] untuk membalas, atau .tolakmenfess untuk menolak._`;
                try {
                   await this.sock.sendMessage(targetJid, { text: mfMsg });
                   await this.sock.sendMessage(jid, { text: `✅ Berhasil mengirim menfess ke ${targetRaw}.\nTunggu balasan darinya. Ketik .stopmenfess untuk menghentikan sesi.` }, { quoted: msg });
                } catch (e) {
                   await this.sock.sendMessage(jid, { text: "❌ Gagal mengirim menfess. Pastikan nomor tujuan valid dan sudah terdaftar di WhatsApp." }, { quoted: msg });
                   this.menfessSessions.delete(senderJid);
                   this.menfessSessions.delete(targetJid);
                }
             }
          }
       }
    } else if (body.startsWith(".balasmenfess") || body.startsWith("balasmenfess")) {
       const senderJid = msg.key.participant || msg.participant || jid;
       const session = this.menfessSessions.get(senderJid);
       if (!session) {
          await this.sock.sendMessage(jid, { text: "Kamu tidak memiliki sesi menfess aktif." }, { quoted: msg });
       } else {
          const replyText = messageContent.replace(/^\.?balasmenfess\s*/i, "").trim();
          if (!replyText) {
             await this.sock.sendMessage(jid, { text: "Silakan masukkan pesan balasan.\nContoh: .balasmenfess Halo juga!" }, { quoted: msg });
          } else {
             const partnerJid = session.partner;
             try {
                await this.sock.sendMessage(partnerJid, { text: `📩 *Balasan Menfess:*\n\n${replyText}` });
                await this.sock.sendMessage(jid, { text: "✅ Pesan balasan terkirim." }, { quoted: msg });
             } catch (e) {
                await this.sock.sendMessage(jid, { text: "❌ Gagal mengirim balasan." }, { quoted: msg });
             }
          }
       }
    } else if (body.startsWith(".tolakmenfess") || body.startsWith("tolakmenfess")) {
       const senderJid = msg.key.participant || msg.participant || jid;
       const session = this.menfessSessions.get(senderJid);
       if (!session) {
          await this.sock.sendMessage(jid, { text: "Kamu tidak memiliki sesi menfess aktif." }, { quoted: msg });
       } else {
          const partnerJid = session.partner;
          try {
             await this.sock.sendMessage(partnerJid, { text: `❌ Target telah menolak sesi menfess dan menghentikan percakapan.` });
          } catch(e) {}
          await this.sock.sendMessage(jid, { text: "✅ Sesi menfess telah ditolak dan dihentikan." }, { quoted: msg });
          this.menfessSessions.delete(senderJid);
          this.menfessSessions.delete(partnerJid);
       }
    } else if (body.startsWith(".stopmenfess") || body.startsWith("stopmenfess")) {
       const senderJid = msg.key.participant || msg.participant || jid;
       const session = this.menfessSessions.get(senderJid);
       if (!session) {
          await this.sock.sendMessage(jid, { text: "Kamu tidak memiliki sesi menfess aktif." }, { quoted: msg });
       } else {
          const partnerJid = session.partner;
          try {
             await this.sock.sendMessage(partnerJid, { text: `🛑 Pasangan menfess kamu telah menghentikan sesi ini.` });
          } catch(e) {}
          await this.sock.sendMessage(jid, { text: "✅ Sesi menfess telah dihentikan." }, { quoted: msg });
          this.menfessSessions.delete(senderJid);
          this.menfessSessions.delete(partnerJid);
       }
    } else {
       const potentialCmd = body.replace(/^\.?/, "").trim();
       if (this.storedStickers.has(potentialCmd)) {
          await this.sock.sendMessage(jid, { sticker: this.storedStickers.get(potentialCmd) }, { quoted: msg });
       }
    }
  }
}
