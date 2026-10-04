import React, { useState, useEffect } from "react";
import { 
  Lock, 
  Unlock, 
  Globe, 
  Settings, 
  LogOut, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Save, 
  RefreshCw, 
  Check, 
  AlertTriangle, 
  ExternalLink,
  ShieldAlert,
  Sliders,
  ChevronRight,
  Info,
  Database,
  Terminal,
  Activity,
  UserCheck,
  Ban,
  Download,
  Video,
  Radio,
  Camera,
  Monitor,
  Copy,
  Cpu,
  Chrome,
  Phone,
  ShieldCheck,
  Trash2,
  UserX,
  UserPlus,
  User,
  Edit,
  Search,
  Crop,
  Scissors,
  Maximize2,
  Minimize2,
  Move,
  Square
} from "lucide-react";
import { doc, setDoc, onSnapshot, collection, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";
import { AppConfig, AuthMode, CropRect } from "./types";
import { AnimatePresence, motion } from "motion/react";

// State defaults
const DEFAULT_CONFIG: AppConfig = {
  iframeUrl: "https://wikipedia.org",
  adminUsername: "admin",
  adminPassword: "admin",
  playoutDelay: 1.5,
  tipsHtml: "<h3>Welcome to the Tips Portal!</h3>\n<p>Stay tuned for daily tips and text updates from the Administrator here.</p>",
  overlayEnabled: false,
  overlayText: "Screencast Live",
  overlayImageUrl: "",
  overlayPosition: "top-right",
  overlayOpacity: 80,
  overlayScale: 100
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, shouldThrow = true) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (shouldThrow) {
    throw new Error(JSON.stringify(errInfo));
  }
}

function getEmbeddableUrl(url: string | undefined): string {
  if (!url) return "";
  let cleanUrl = url.trim();

  // If the input is standard iframe embedding code, extract the source URL
  if (cleanUrl.toLowerCase().includes("<iframe")) {
    const srcMatch = cleanUrl.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      cleanUrl = srcMatch[1].trim();
    }
  }

  // Restore encoded HTML entities if any
  cleanUrl = cleanUrl.replace(/&amp;/g, "&");

  try {
    let absoluteUrl = cleanUrl;
    if (cleanUrl.startsWith("//")) {
      absoluteUrl = window.location.protocol + cleanUrl;
    } else if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      return cleanUrl;
    }

    const parsedUrl = new URL(absoluteUrl);

    // 1. YouTube conversions
    if (cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be")) {
      if (cleanUrl.includes("/embed/")) {
        return cleanUrl;
      }
      
      let videoId = "";
      if (cleanUrl.includes("youtu.be/")) {
        const parts = cleanUrl.split("youtu.be/");
        if (parts[1]) {
          videoId = parts[1].split(/[?#]/)[0];
        }
      } else if (cleanUrl.includes("v=")) {
        videoId = parsedUrl.searchParams.get("v") || "";
      } else if (cleanUrl.includes("/live/")) {
        const parts = cleanUrl.split("/live/");
        if (parts[1]) {
          videoId = parts[1].split(/[?#]/)[0];
        }
      } else if (cleanUrl.includes("/shorts/")) {
        const parts = cleanUrl.split("/shorts/");
        if (parts[1]) {
          videoId = parts[1].split(/[?#]/)[0];
        }
      }

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
      }
    }

    // 2. Twitch conversions & parent override
    if (cleanUrl.includes("twitch.tv")) {
      const parentHost = window.location.hostname;

      if (cleanUrl.includes("player.twitch.tv")) {
        parsedUrl.searchParams.set("parent", parentHost);
        if (!parsedUrl.searchParams.has("muted")) {
          parsedUrl.searchParams.set("muted", "true");
        }
        if (!parsedUrl.searchParams.has("autoplay")) {
          parsedUrl.searchParams.set("autoplay", "true");
        }
        return parsedUrl.toString();
      }
      
      const pathname = parsedUrl.pathname;
      const pathParts = pathname.split("/").filter(Boolean);
      
      if (pathParts.length > 0 && pathParts[0] !== "directory") {
        const channel = pathParts[0];
        return `https://player.twitch.tv/?channel=${channel}&parent=${parentHost}&muted=true&autoplay=true`;
      }
    }

    // 3. Kick conversions
    if (cleanUrl.includes("kick.com")) {
      if (cleanUrl.includes("player.kick.com")) {
        return cleanUrl;
      }
      const pathname = parsedUrl.pathname;
      const pathParts = pathname.split("/").filter(Boolean);
      if (pathParts.length > 0) {
        const channel = pathParts[0];
        return `https://player.kick.com/${channel}?muted=true&autoplay=true`;
      }
    }
  } catch (error) {
    console.warn("Error parsing/converting stream URL:", error);
  }

  return cleanUrl;
}

function isHtmlEmbed(val: string | undefined): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  return trimmed.startsWith("<") && trimmed.endsWith(">");
}

function processHtmlEmbed(html: string | undefined): string {
  if (!html) return "";
  let processed = html.trim();

  // If it's Twitch, replace the parent parameter dynamically to match current host
  if (processed.includes("twitch.tv")) {
    const parentHost = window.location.hostname;
    processed = processed.replace(/parent=[a-zA-Z0-9.-]+/gi, `parent=${parentHost}`);
  }

  // Make the iframe responsive by ensuring its CSS fills the container
  if (processed.toLowerCase().startsWith("<iframe")) {
    if (!processed.includes("style=")) {
      processed = processed.replace("<iframe", '<iframe style="width: 100%; height: 100%; border: none;"');
    }
    // Also strip fixed width/height so style takes over
    processed = processed.replace(/\bwidth=["'][^"']*["']/gi, 'width="100%"');
    processed = processed.replace(/\bheight=["'][^"']*["']/gi, 'height="100%"');
  }

  return processed;
}

interface SystemLog {
  id: string;
  time: string;
  type: "success" | "fail" | "info" | "system";
  message: string;
}

export default function App() {
  // Current app settings from db
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Authentication states
  const [authMode, setAuthMode] = useState<AuthMode>("none");
  const [enteredUsername, setEnteredUsername] = useState<string>("");
  const [enteredPassword, setEnteredPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Custom User Registration & Login states
  const [loginTab, setLoginTab] = useState<"login" | "register" | "admin">("login");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [currentUsername, setCurrentUsername] = useState<string | null>(() => localStorage.getItem("user_username") || localStorage.getItem("user_phone"));

  // Admin user management states
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUserPassword, setNewUserPassword] = useState("");
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUserNameInput, setNewUserNameInput] = useState<string>("");
  const [newUserPassInput, setNewUserPassInput] = useState<string>("");
  const [newUserAuthInput, setNewUserAuthInput] = useState<boolean>(true);
  const [newUserScreenShareInput, setNewUserScreenShareInput] = useState<boolean>(true);
  const [newUserTipsInput, setNewUserTipsInput] = useState<boolean>(true);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [addUserSuccess, setAddUserSuccess] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Admin escalation overlay states
  const [showAdminEscalate, setShowAdminEscalate] = useState<boolean>(false);
  const [escalatePassword, setEscalatePassword] = useState<boolean>(false);
  const [adminUsernameInput, setAdminUsernameInput] = useState<string>("");
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>("");
  const [escalateError, setEscalateError] = useState<string | null>(null);

  // Form edit states
  const [editUrl, setEditUrl] = useState<string>("");
  const [editTipsHtml, setEditTipsHtml] = useState<string>("");
  const [editAdminUsername, setEditAdminUsername] = useState<string>("");
  const [editAdminPassword, setEditAdminPassword] = useState<string>("");
  const [editOverlayEnabled, setEditOverlayEnabled] = useState<boolean>(false);
  const [editOverlayText, setEditOverlayText] = useState<string>("");
  const [editOverlayImageUrl, setEditOverlayImageUrl] = useState<string>("");
  const [editOverlayPosition, setEditOverlayPosition] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "floating-animate">("top-right");
  const [editOverlayOpacity, setEditOverlayOpacity] = useState<number>(80);
  const [editOverlayScale, setEditOverlayScale] = useState<number>(100);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");

  // Simulated live display interactive states
  const [aspectRatio, setAspectRatio] = useState<string>("full");
  const [sandboxMode, setSandboxMode] = useState<boolean>(true);
  const [reloadStrategy, setReloadStrategy] = useState<string>("auto");
  const [sessionsCount, setSessionsCount] = useState<number>(142);
  const [blockedIps, setBlockedIps] = useState<number>(8);

  // Live traffic logs Console state
  const [logs, setLogs] = useState<SystemLog[]>([
    { id: "1", time: "14:20:11", type: "success", message: "AUTH_SUCCESS - User #8129 connected" },
    { id: "2", time: "14:19:55", type: "success", message: "AUTH_SUCCESS - User #4410 connected" },
    { id: "3", time: "14:19:02", type: "fail", message: "AUTH_FAIL - Invalid Gate passcode block" },
    { id: "4", time: "14:18:41", type: "success", message: "AUTH_SUCCESS - User #2119 connected" },
    { id: "5", time: "14:17:30", type: "info", message: "SESSION_EXPIRED - User #0032 removed" },
    { id: "6", time: "14:15:22", type: "system", message: "SYS_SYNC - Cloud Firestore listener initialized" }
  ]);

  // Helper to append a log dynamically
  const addLog = (type: "success" | "fail" | "info" | "system", message: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const newLog: SystemLog = {
      id: Math.random().toString(),
      time: timeStr,
      type,
      message
    };
    setLogs(prev => [newLog, ...prev.slice(0, 15)]);
  };

  const [iframeKey, setIframeKey] = useState<number>(0);

  const forceReloadIframe = () => {
    setIframeKey(prev => prev + 1);
    addLog("info", "IFRAME_RELOAD - Forced a complete container iframe hard reload");
  };

  const downloadLogs = () => {
    try {
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `securegate-session-logs-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addLog("info", "LOGS_EXPORTED - Triggered static download of audit log reports");
    } catch (err) {
      console.error("Failed to export logs:", err);
    }
  };

  // WebRTC Stream states
  const [peerId] = useState(() => "viewer-" + Math.random().toString(36).substring(2, 7));
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [streamTitle, setStreamTitle] = useState<string>("Online");
  const [viewerRemoteStream, setViewerRemoteStream] = useState<MediaStream | null>(null);
  const [webrtcError, setWebrtcError] = useState<string | null>(null);
  const [playoutDelay, setPlayoutDelay] = useState<number>(1.5); // Buffer delay in seconds
  const [customDelayInput, setCustomDelayInput] = useState<string>("1.5");
  const [streamQualityProfile, setStreamQualityProfile] = useState<"smooth-720p" | "smooth-1080p" | "slides-1080p" | "unconstrained">("smooth-720p");
  const visitorPcRef = React.useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (visitorPcRef.current) {
      visitorPcRef.current.getReceivers().forEach((receiver) => {
        if ("playoutDelayHint" in receiver) {
          try {
            (receiver as any).playoutDelayHint = playoutDelay;
          } catch (err) {
            console.warn("Could not dynamically update playoutDelayHint:", err);
          }
        }
      });
      addLog("info", `BUFFER_ADJUST - Updated dynamic playout buffer to ${playoutDelay}s`);
    }
  }, [playoutDelay]);

  const handleUpdatePlayoutDelay = async (delay: number) => {
    if (!db) return;
    try {
      const configDocRef = doc(db, "configs", "main");
      await setDoc(configDocRef, {
        playoutDelay: delay
      }, { merge: true });
      addLog("success", `CONFIG_UPDATE - Admin updated real-time playout buffer to ${delay}s`);
    } catch (err) {
      console.error("Failed to write updated playoutDelay to database:", err);
      addLog("fail", "SYS_WRITE_ERR - Playout delay update failed in database rules");
    }
  };

  // Screen Share Crop States & Engine
  const [cropEnabled, setCropEnabled] = useState<boolean>(false);
  const [cropRect, setCropRect] = useState<CropRect>({ x: 10, y: 10, width: 80, height: 80 });
  const [showCropModal, setShowCropModal] = useState<boolean>(false);
  const [cropDragMode, setCropDragMode] = useState<string | null>(null);

  const rawStreamRef = React.useRef<MediaStream | null>(null);
  const rawVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = React.useRef<number | null>(null);
  const cropSettingsRef = React.useRef<{ enabled: boolean; rect: CropRect }>({
    enabled: false,
    rect: { x: 10, y: 10, width: 80, height: 80 }
  });
  const cropContainerRef = React.useRef<HTMLDivElement | null>(null);
  const cropDragStartRef = React.useRef<{
    startX: number;
    startY: number;
    startRect: CropRect;
    containerWidth: number;
    containerHeight: number;
  } | null>(null);

  // Synchronize mutable ref for zero-latency frame canvas rendering
  useEffect(() => {
    cropSettingsRef.current = {
      enabled: cropEnabled,
      rect: cropRect
    };
  }, [cropEnabled, cropRect]);

  // Pointer drag/resize handler for interactive visual crop box
  const handleCropPointerDown = (mode: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cropContainerRef.current) return;
    const rect = cropContainerRef.current.getBoundingClientRect();
    cropDragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...cropRect },
      containerWidth: rect.width,
      containerHeight: rect.height,
    };
    setCropDragMode(mode);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}
  };

  const handleCropPointerMove = (e: React.PointerEvent) => {
    if (!cropDragMode || !cropDragStartRef.current) return;
    e.preventDefault();
    const { startX, startY, startRect, containerWidth, containerHeight } = cropDragStartRef.current;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const dxPct = ((e.clientX - startX) / containerWidth) * 100;
    const dyPct = ((e.clientY - startY) / containerHeight) * 100;

    setCropRect(() => {
      let newX = startRect.x;
      let newY = startRect.y;
      let newW = startRect.width;
      let newH = startRect.height;

      if (cropDragMode === "move") {
        newX = Math.max(0, Math.min(100 - startRect.width, startRect.x + dxPct));
        newY = Math.max(0, Math.min(100 - startRect.height, startRect.y + dyPct));
      } else if (cropDragMode === "se") {
        newW = Math.max(10, Math.min(100 - startRect.x, startRect.width + dxPct));
        newH = Math.max(10, Math.min(100 - startRect.y, startRect.height + dyPct));
      } else if (cropDragMode === "sw") {
        const maxShift = startRect.x;
        const shiftX = Math.max(-maxShift, Math.min(startRect.width - 10, dxPct));
        newX = startRect.x + shiftX;
        newW = startRect.width - shiftX;
        newH = Math.max(10, Math.min(100 - startRect.y, startRect.height + dyPct));
      } else if (cropDragMode === "ne") {
        newW = Math.max(10, Math.min(100 - startRect.x, startRect.width + dxPct));
        const maxShift = startRect.y;
        const shiftY = Math.max(-maxShift, Math.min(startRect.height - 10, dyPct));
        newY = startRect.y + shiftY;
        newH = startRect.height - shiftY;
      } else if (cropDragMode === "nw") {
        const maxShiftX = startRect.x;
        const shiftX = Math.max(-maxShiftX, Math.min(startRect.width - 10, dxPct));
        newX = startRect.x + shiftX;
        newW = startRect.width - shiftX;
        const maxShiftY = startRect.y;
        const shiftY = Math.max(-maxShiftY, Math.min(startRect.height - 10, dyPct));
        newY = startRect.y + shiftY;
        newH = startRect.height - shiftY;
      } else if (cropDragMode === "n") {
        const maxShift = startRect.y;
        const shiftY = Math.max(-maxShift, Math.min(startRect.height - 10, dyPct));
        newY = startRect.y + shiftY;
        newH = startRect.height - shiftY;
      } else if (cropDragMode === "s") {
        newH = Math.max(10, Math.min(100 - startRect.y, startRect.height + dyPct));
      } else if (cropDragMode === "w") {
        const maxShift = startRect.x;
        const shiftX = Math.max(-maxShift, Math.min(startRect.width - 10, dxPct));
        newX = startRect.x + shiftX;
        newW = startRect.width - shiftX;
      } else if (cropDragMode === "e") {
        newW = Math.max(10, Math.min(100 - startRect.x, startRect.width + dxPct));
      }

      return {
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
        width: Math.round(newW * 10) / 10,
        height: Math.round(newH * 10) / 10,
      };
    });
  };

  const handleCropPointerUp = (e: React.PointerEvent) => {
    if (cropDragMode) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
      setCropDragMode(null);
      cropDragStartRef.current = null;
    }
  };

  const applyCropPreset = (type: "full" | "center80" | "center60" | "topHalf" | "bottomHalf" | "leftHalf" | "rightHalf") => {
    if (type === "full") {
      setCropEnabled(false);
      setCropRect({ x: 0, y: 0, width: 100, height: 100 });
      addLog("info", "CROP_PRESET - Reset screen share to Full Screen 100%");
    } else {
      setCropEnabled(true);
      if (type === "center80") {
        setCropRect({ x: 10, y: 10, width: 80, height: 80 });
        addLog("info", "CROP_PRESET - Applied Center Focus 80% region");
      } else if (type === "center60") {
        setCropRect({ x: 20, y: 20, width: 60, height: 60 });
        addLog("info", "CROP_PRESET - Applied Center Focus 60% region");
      } else if (type === "topHalf") {
        setCropRect({ x: 0, y: 0, width: 100, height: 50 });
        addLog("info", "CROP_PRESET - Applied Top Half 50% region");
      } else if (type === "bottomHalf") {
        setCropRect({ x: 0, y: 50, width: 100, height: 50 });
        addLog("info", "CROP_PRESET - Applied Bottom Half 50% region");
      } else if (type === "leftHalf") {
        setCropRect({ x: 0, y: 0, width: 50, height: 100 });
        addLog("info", "CROP_PRESET - Applied Left Half region");
      } else if (type === "rightHalf") {
        setCropRect({ x: 50, y: 0, width: 50, height: 100 });
        addLog("info", "CROP_PRESET - Applied Right Half region");
      }
    }
  };

  // Render floating overlay on top of screen share feeds
  const renderFloatingOverlay = () => {
    if (!config?.overlayEnabled) return null;

    const getPositionClass = (pos: string) => {
      switch (pos) {
        case "top-left": return "top-4 left-4";
        case "top-right": return "top-4 right-4";
        case "bottom-left": return "bottom-4 left-4";
        case "bottom-right": return "bottom-4 right-4";
        case "center": return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
        case "floating-animate": return "top-12 left-12";
        default: return "top-4 right-4";
      }
    };

    const isCenter = config.overlayPosition === "center";

    return (
      <motion.div
        className={`absolute pointer-events-none z-20 flex flex-col items-center gap-1 p-2 rounded bg-black/60 backdrop-blur-xs border border-white/10 ${getPositionClass(config.overlayPosition || "top-right")}`}
        style={{
          opacity: (config.overlayOpacity ?? 80) / 100,
          transform: isCenter ? "translate(-50%, -50%)" : undefined,
        }}
        animate={
          config.overlayPosition === "floating-animate"
            ? {
                x: [0, 180, 40, 220, 0],
                y: [0, 80, 140, -20, 0],
                rotate: [0, 6, -6, 6, 0],
              }
            : { y: [0, -6, 0] }
        }
        transition={{
          duration: config.overlayPosition === "floating-animate" ? 25 : 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {config.overlayImageUrl && (
          <img
            src={config.overlayImageUrl}
            alt="Overlay Icon"
            className="object-contain"
            referrerPolicy="no-referrer"
            style={{
              maxHeight: `${(config.overlayScale ?? 100) * 0.8}px`,
              maxWidth: `${(config.overlayScale ?? 100) * 1.2}px`,
            }}
          />
        )}
        {config.overlayText && (
          <span
            className="font-bold tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-center font-sans"
            style={{
              fontSize: `${Math.max(10, Math.floor((config.overlayScale ?? 100) * 0.15))}px`,
            }}
          >
            {config.overlayText}
          </span>
        )}
      </motion.div>
    );
  };

  // Live Visitor & Duration & Chat States
  const [sessionId] = useState(() => "session_" + Math.random().toString(36).substring(2, 10));
  const [visitorCount, setVisitorCount] = useState<number>(1);
  const [durationText, setDurationText] = useState<string>("00:00:00");
  const [adminActiveTab, setAdminActiveTab] = useState<"traffic" | "chat" | "users">("users");
  const [visitorActiveTab, setVisitorActiveTab] = useState<"stream" | "tips">("stream");

  const currentUserObj = registeredUsers.find(
    (u) => (u.username && u.username.toLowerCase() === currentUsername?.toLowerCase()) ||
           (u.phoneNumber && u.phoneNumber.toLowerCase() === currentUsername?.toLowerCase()) ||
           u.id.toLowerCase() === currentUsername?.toLowerCase()
  );
  const hasScreenShareAccess = currentUserObj ? (currentUserObj.screenShareAccess ?? false) : false;
  const hasTipsAccess = currentUserObj ? (currentUserObj.tipsAccess ?? false) : false;
  const [chatUsername, setChatUsername] = useState<string>(() => {
    const saved = localStorage.getItem("chat_username");
    if (saved) return saved;
    const usr = localStorage.getItem("user_username") || localStorage.getItem("user_phone");
    if (usr) {
      localStorage.setItem("chat_username", usr);
      return usr;
    }
    const gen = "Guest_" + Math.random().toString(36).substring(2, 6).toUpperCase();
    localStorage.setItem("chat_username", gen);
    return gen;
  });

  // Synchronize chatUsername with currentUsername when logged in
  useEffect(() => {
    if (currentUsername) {
      setChatUsername(currentUsername);
      localStorage.setItem("chat_username", currentUsername);
    }
  }, [currentUsername]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInputText, setChatInputText] = useState<string>("");
  const [confirmClearChat, setConfirmClearChat] = useState<boolean>(false);

  // Host Broadcaster engine (WebRTC over Firestore key exchange)
  const startBroadcast = async () => {
    try {
      setWebrtcError(null);
      
      // Determine screen capture options based on selected profile to limit jitter
      const displayMediaOptions: DisplayMediaStreamOptions = {
        audio: true
      };

      if (streamQualityProfile === "smooth-720p") {
        displayMediaOptions.video = {
          width: { max: 1280 },
          height: { max: 720 },
          frameRate: { max: 30 }
        };
      } else if (streamQualityProfile === "smooth-1080p") {
        displayMediaOptions.video = {
          width: { max: 1920 },
          height: { max: 1080 },
          frameRate: { max: 30 }
        };
      } else if (streamQualityProfile === "slides-1080p") {
        displayMediaOptions.video = {
          width: { max: 1920 },
          height: { max: 1080 },
          frameRate: { max: 15 }
        };
      } else {
        displayMediaOptions.video = true;
      }

      addLog("info", `STREAM_INIT - Requesting screen capture using profile: ${streamQualityProfile}`);
      const rawStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      rawStreamRef.current = rawStream;

      // Set up hidden player element for raw feed
      if (!rawVideoRef.current) {
        const vid = document.createElement("video");
        vid.muted = true;
        vid.playsInline = true;
        vid.autoplay = true;
        rawVideoRef.current = vid;
      }
      rawVideoRef.current.srcObject = rawStream;
      await rawVideoRef.current.play().catch(e => console.warn("Raw video autoplay:", e));

      // Set up canvas element for crop and frame extraction
      if (!canvasRef.current) {
        const cvs = document.createElement("canvas");
        canvasRef.current = cvs;
      }

      const canvas = canvasRef.current;
      const rawVideo = rawVideoRef.current;
      canvas.width = rawVideo.videoWidth || 1280;
      canvas.height = rawVideo.videoHeight || 720;

      // Real-time canvas render loop applying crop boundaries
      const renderCropFrame = () => {
        if (!rawVideoRef.current || !canvasRef.current) return;
        const vid = rawVideoRef.current;
        const cvs = canvasRef.current;
        const ctx = cvs.getContext("2d");

        if (ctx && vid.readyState >= 2) {
          const vW = vid.videoWidth || 1280;
          const vH = vid.videoHeight || 720;
          const { enabled, rect } = cropSettingsRef.current;

          if (enabled) {
            const normX = Math.max(0, Math.min(95, rect.x));
            const normY = Math.max(0, Math.min(95, rect.y));
            const normW = Math.max(5, Math.min(100 - normX, rect.width));
            const normH = Math.max(5, Math.min(100 - normY, rect.height));

            const sx = Math.floor((normX / 100) * vW);
            const sy = Math.floor((normY / 100) * vH);
            const sw = Math.max(1, Math.floor((normW / 100) * vW));
            const sh = Math.max(1, Math.floor((normH / 100) * vH));

            if (cvs.width !== sw || cvs.height !== sh) {
              cvs.width = sw;
              cvs.height = sh;
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(vid, sx, sy, sw, sh, 0, 0, sw, sh);
          } else {
            if (cvs.width !== vW || cvs.height !== vH) {
              cvs.width = vW;
              cvs.height = vH;
            }
            ctx.drawImage(vid, 0, 0, vW, vH, 0, 0, vW, vH);
          }
        }

        animationFrameIdRef.current = requestAnimationFrame(renderCropFrame);
      };

      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      animationFrameIdRef.current = requestAnimationFrame(renderCropFrame);

      // Create stream from canvas
      const targetFps = streamQualityProfile === "slides-1080p" ? 15 : 30;
      const canvasStream: MediaStream = (canvas as any).captureStream ? (canvas as any).captureStream(targetFps) : rawStream;

      // Transfer any audio tracks from original screen share (e.g. tab audio, system sound)
      rawStream.getAudioTracks().forEach((audioTrack) => {
        canvasStream.addTrack(audioTrack);
      });

      const broadcastStream = canvasStream;
      setLocalStream(broadcastStream);
      setIsBroadcasting(true);
      addLog("success", `STREAM_LIVE - Started Direct Chrome Screen Cast (${streamQualityProfile}${cropEnabled ? ", Cropped" : ""})`);

      // Mark configs/main as live
      const configDocRef = doc(db, "configs", "main");
      await setDoc(configDocRef, {
        ...config,
        isLive: true,
        liveStreamType: "webrtc",
        liveStreamTitle: streamTitle,
        streamStartedAt: Date.now()
      }, { merge: true });

      const peerConnectionMap: { [peerId: string]: RTCPeerConnection } = {};

      // Listen for peer connection requests
      const peersCollection = collection(db, "signaling_peers");
      const unsubPeers = onSnapshot(peersCollection, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const peerDocId = change.doc.id;
          const data = change.doc.data();

          if (change.type === "added" || change.type === "modified") {
            if (data.status === "connecting" && !peerConnectionMap[peerDocId]) {
              addLog("info", `PEER_REQ - WebRTC hand-shake initiation from guest #${peerDocId.slice(-4)}`);
              
              const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
              });
              peerConnectionMap[peerDocId] = pc;

              // Append local capture audio & video tracks with optimization parameters
              broadcastStream.getTracks().forEach((track) => {
                const sender = pc.addTrack(track, broadcastStream);
                
                if (track.kind === "video") {
                  try {
                    const params = sender.getParameters();
                    if (!params.encodings) {
                      params.encodings = [{}];
                    }
                    
                    // Set maximum bitrate bounds and degradation priority behavior to cushion jitter
                    if (streamQualityProfile === "smooth-720p") {
                      params.encodings[0].maxBitrate = 1500000; // 1.5 Mbps (Super fluid)
                      (sender as any).degradationPreference = "maintain-framerate";
                    } else if (streamQualityProfile === "smooth-1080p") {
                      params.encodings[0].maxBitrate = 2800000; // 2.8 Mbps (Standard HD)
                      (sender as any).degradationPreference = "maintain-framerate";
                    } else if (streamQualityProfile === "slides-1080p") {
                      params.encodings[0].maxBitrate = 1200000; // 1.2 Mbps (Lower framerate text-mode)
                      (sender as any).degradationPreference = "maintain-resolution";
                    }
                    
                    sender.setParameters(params).catch((err) => {
                      console.warn("Could not dynamically apply RTCRtpSender parameters:", err);
                    });
                  } catch (err) {
                    console.warn("RTP Sender parameters configuration is unsupported or failed:", err);
                  }
                }
              });

              // ICE trickle
              pc.onicecandidate = (event) => {
                if (event.candidate) {
                  setDoc(doc(db, "signaling_peers", peerDocId), {
                    hostCandidates: [...(data.hostCandidates || []), event.candidate.toJSON()]
                  }, { merge: true });
                }
              };

              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);

              await setDoc(doc(db, "signaling_peers", peerDocId), {
                offer: { type: offer.type, sdp: offer.sdp },
                status: "offered"
              }, { merge: true });

              // Listen for guest answer
              const unsubPeerDoc = onSnapshot(doc(db, "signaling_peers", peerDocId), async (docSnap) => {
                const peerData = docSnap.data();
                if (peerData?.answer && pc.signalingState !== "stable") {
                  await pc.setRemoteDescription(new RTCSessionDescription(peerData.answer));
                  addLog("success", `PEER_CONN - Secure gateway peer peer-to-peer established with #${peerDocId.slice(-4)}`);
                }
                if (peerData?.viewerCandidates && Array.isArray(peerData.viewerCandidates)) {
                  peerData.viewerCandidates.forEach(async (cand: any) => {
                    try {
                      await pc.addIceCandidate(new RTCIceCandidate(cand));
                    } catch (e) {
                      // ignore
                    }
                  });
                }
              }, (err) => {
                console.warn(`Gateway peer document snapshot error: ${err}`);
              });

              (window as any)._unsubs = [...((window as any)._unsubs || []), unsubPeerDoc];
            }
          } else if (change.type === "removed") {
            const pc = peerConnectionMap[peerDocId];
            if (pc) {
              pc.close();
              delete peerConnectionMap[peerDocId];
              addLog("info", `PEER_LEFT - Connection pipe dissolved for guest #${peerDocId.slice(-4)}`);
            }
          }
        }
      }, (err) => {
        console.warn(`Gateway peers collection snapshot error: ${err}`);
      });

      // Track stream end from browser button (e.g., screen share stop)
      if (rawStream.getVideoTracks()[0]) {
        rawStream.getVideoTracks()[0].onended = () => {
          stopBroadcast();
        };
      }

      (window as any)._unsubs = [...((window as any)._unsubs || []), unsubPeers];

    } catch (err: any) {
      console.error("WebRTC broadcast error:", err);
      setWebrtcError(err.message || "Permissions denied or hardware busy.");
      addLog("fail", `STREAM_ERR - Failed starting WebRTC broadcast: ${err.message || "Acess denied"}`);
    }
  };

  const stopBroadcast = async () => {
    try {
      setIsBroadcasting(false);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (rawStreamRef.current) {
        rawStreamRef.current.getTracks().forEach((track) => track.stop());
        rawStreamRef.current = null;
      }
      if (rawVideoRef.current) {
        rawVideoRef.current.srcObject = null;
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }

      // Mark live state as off
      const configDocRef = doc(db, "configs", "main");
      await setDoc(configDocRef, {
        ...config,
        isLive: false,
        streamStartedAt: null
      }, { merge: true });

      addLog("system", "STREAM_OFF - Dissolved current WebRTC broadcast and peer pipes");

      // Cleanup peers doc
      const peersSnap = await getDocs(collection(db, "signaling_peers"));
      peersSnap.forEach(async (docSnap) => {
        await deleteDoc(doc(db, "signaling_peers", docSnap.id));
      });

      if ((window as any)._unsubs) {
        (window as any)._unsubs.forEach((unsub: any) => {
          try { unsub(); } catch (e) {}
        });
        (window as any)._unsubs = [];
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Visitor peer subscription
  useEffect(() => {
    let activePC: RTCPeerConnection | null = null;
    let unsubPeerDoc: (() => void) | null = null;

    const shouldJoin = config?.isLive && config?.liveStreamType === "webrtc" && (
      (authMode === "visitor" && hasScreenShareAccess) || (authMode === "admin" && !isBroadcasting)
    );

    if (shouldJoin) {
      addLog("info", "WEBRTC_JOIN - Setting up peer hand-shake protocols");

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });
      activePC = pc;
      visitorPcRef.current = pc;

      const remoteStream = new MediaStream();
      pc.ontrack = (event) => {
        if (event.receiver && "playoutDelayHint" in event.receiver) {
          try {
            (event.receiver as any).playoutDelayHint = playoutDelay;
          } catch (e) {
            console.warn("Could not set playoutDelayHint ontrack:", e);
          }
        }
        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
          });
          setViewerRemoteStream(remoteStream);
        }
      };

      const peerRef = doc(db, "signaling_peers", peerId);
      setDoc(peerRef, {
        status: "connecting",
        viewerCandidates: [],
        hostCandidates: []
      }).then(() => {
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            setDoc(peerRef, {
              viewerCandidates: [...((pc as any)._candidates || []), event.candidate.toJSON()]
            }, { merge: true });
            (pc as any)._candidates = [...((pc as any)._candidates || []), event.candidate.toJSON()];
          }
        };

        unsubPeerDoc = onSnapshot(peerRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();

            if (data.offer && !pc.remoteDescription) {
              await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await setDoc(peerRef, {
                answer: { type: answer.type, sdp: answer.sdp },
                status: "answered"
              }, { merge: true });
            }

            if (data.hostCandidates && Array.isArray(data.hostCandidates)) {
              data.hostCandidates.forEach(async (cand: any) => {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {}
              });
            }
          }
        }, (err) => {
          console.warn("Viewer peerRef snapshot listener security limit or offline:", err);
        });
      });
    }

    return () => {
      visitorPcRef.current = null;
      if (activePC) {
        activePC.close();
      }
      if (unsubPeerDoc) {
        unsubPeerDoc();
      }
      const peerRef = doc(db, "signaling_peers", peerId);
      deleteDoc(peerRef).catch(() => {});
      setViewerRemoteStream(null);
    };
  }, [config?.isLive, config?.liveStreamType, peerId, authMode, isBroadcasting, hasScreenShareAccess, playoutDelay]);

  // Automatically switch tab based on page access permissions
  useEffect(() => {
    if (authMode === "visitor") {
      if (hasScreenShareAccess && !hasTipsAccess) {
        setVisitorActiveTab("stream");
      } else if (hasTipsAccess && !hasScreenShareAccess) {
        setVisitorActiveTab("tips");
      }
    }
  }, [hasScreenShareAccess, hasTipsAccess, authMode]);

  // 1. Write the visitor session presence to Firestore and clean up on exit
  useEffect(() => {
    if (authMode === "none") return;
    
    const sessionDocRef = doc(db, "active_visitors", sessionId);
    
    const writePresence = async () => {
      try {
        await setDoc(sessionDocRef, {
          id: sessionId,
          role: authMode,
          lastActive: Date.now()
        });
      } catch (e) {
        console.error("Presence write error", e);
      }
    };

    writePresence();

    const interval = setInterval(async () => {
      try {
        await setDoc(sessionDocRef, {
          id: sessionId,
          role: authMode,
          lastActive: Date.now()
        });

        // Run cleanup search for stale visitor records (older than 30s)
        try {
          const snap = await getDocs(collection(db, "active_visitors"));
          const staleTime = Date.now() - 30 * 1000;
          snap.forEach(async (d) => {
            const data = d.data();
            if (data.lastActive && data.lastActive < staleTime) {
              await deleteDoc(doc(db, "active_visitors", d.id));
            }
          });
        } catch (err) {
          // Ignore
        }
      } catch (e) {
        console.error("Heartbeat error", e);
      }
    }, 10000);

    const handleUnload = () => {
      deleteDoc(sessionDocRef).catch(() => {});
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      deleteDoc(sessionDocRef).catch(() => {});
    };
  }, [authMode, sessionId]);

  // 2. Count active visitors in real-time
  useEffect(() => {
    if (authMode === "none") return;

    const unsub = onSnapshot(collection(db, "active_visitors"), (snapshot) => {
      const now = Date.now();
      const active = snapshot.docs.filter(d => {
        const data = d.data();
        return data.lastActive && (now - data.lastActive < 30 * 1000);
      });
      setVisitorCount(Math.max(1, active.length));
    }, (error) => {
      console.warn("Active visitors snapshot listener subscription issue:", error);
    });

    return () => unsub();
  }, [authMode]);

  // 3. Track screencast session active duration
  useEffect(() => {
    if (!config?.isLive || !config?.streamStartedAt) {
      setDurationText("00:00:00");
      return;
    }

    const interval = setInterval(() => {
      const diffMs = Date.now() - (config.streamStartedAt || Date.now());
      const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      
      const pad = (n: number) => String(n).padStart(2, "0");
      setDurationText(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [config?.isLive, config?.streamStartedAt]);

  // 4. Subscribe to Real-time Chat Messages
  useEffect(() => {
    if (authMode === "none") return;

    const unsub = onSnapshot(collection(db, "chats"), (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        msgs.push({ id: d.id, ...data });
      });
      msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setChatMessages(msgs.slice(-100));
    }, (error) => {
      console.warn("Chats snapshot listener subscription issue:", error);
    });

    return () => unsub();
  }, [authMode]);

  // 4.5. Subscribe to Registered Users for Access Control & Authentication
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "registered_users"), (snapshot) => {
      const users: any[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        users.push({ id: d.id, ...data });
      });
      setRegisteredUsers(users);
    }, (error) => {
      console.warn("Registered users snapshot listener subscription issue:", error);
    });

    return () => unsub();
  }, []);

  // 5. Send Chat Message action handler
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;

    const userText = chatInputText.trim();
    setChatInputText("");

    try {
      const chatDocRef = doc(collection(db, "chats"));
      await setDoc(chatDocRef, {
        senderName: chatUsername || "Anonymous",
        text: userText,
        timestamp: Date.now(),
        role: authMode
      });
    } catch (err) {
      console.error("Error sending message to Firestore:", err);
    }
  };

  // Clear chat logs in Firestore
  const handleClearChat = async () => {
    if (!db) return;
    try {
      addLog("info", "CHAT_CLEAR - Bulk purging chat log from database");
      const snapshot = await getDocs(collection(db, "chats"));
      const deletePromises: Promise<void>[] = [];
      snapshot.forEach((d) => {
        deletePromises.push(deleteDoc(doc(db, "chats", d.id)));
      });
      await Promise.all(deletePromises);
      setConfirmClearChat(false);
      addLog("success", "CHAT_CLEAR - Admin has purged the full chat history");
    } catch (err) {
      console.error("Failed to delete chat documents:", err);
      addLog("fail", "CHAT_CLEAR_ERR - Firestore rules prevented complete purge");
    }
  };

  // Check login state on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem("auth_mode") as AuthMode;
    if (savedAuth === "visitor" || savedAuth === "admin") {
      setAuthMode(savedAuth);
    }
  }, []);

  // Set real stats updates periodically
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionsCount(prev => {
        const change = Math.floor(Math.random() * 5) - 2;
        const newVal = Math.max(100, Math.min(200, prev + change));
        if (change > 0 && Math.random() > 0.7) {
          addLog("success", `AUTH_SUCCESS - Live Guest Session #${Math.floor(Math.random() * 8999 + 1000)} connected`);
        }
        return newVal;
      });
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  // Sync config settings with Firestore
  useEffect(() => {
    const configDocRef = doc(db, "configs", "main");
    setLoading(true);

    const unsubscribe = onSnapshot(
      configDocRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as AppConfig;
          setConfig(data);
          setEditUrl(data.iframeUrl);
          setEditTipsHtml(data.tipsHtml || DEFAULT_CONFIG.tipsHtml || "");
          setEditAdminUsername(data.adminUsername || "admin");
          setEditAdminPassword(data.adminPassword || "admin");
          setEditOverlayEnabled(data.overlayEnabled ?? DEFAULT_CONFIG.overlayEnabled ?? false);
          setEditOverlayText(data.overlayText ?? DEFAULT_CONFIG.overlayText ?? "");
          setEditOverlayImageUrl(data.overlayImageUrl ?? DEFAULT_CONFIG.overlayImageUrl ?? "");
          setEditOverlayPosition(data.overlayPosition ?? DEFAULT_CONFIG.overlayPosition ?? "top-right");
          setEditOverlayOpacity(data.overlayOpacity ?? DEFAULT_CONFIG.overlayOpacity ?? 80);
          setEditOverlayScale(data.overlayScale ?? DEFAULT_CONFIG.overlayScale ?? 100);
          if (typeof data.playoutDelay === "number") {
            setPlayoutDelay(data.playoutDelay);
            setCustomDelayInput(String(data.playoutDelay));
          }
          setDbError(null);
          addLog("system", "CONFIG_PULL - Fresh frame settings loaded from Firebase");
        } else {
          try {
            await setDoc(configDocRef, DEFAULT_CONFIG);
            setConfig(DEFAULT_CONFIG);
            setEditUrl(DEFAULT_CONFIG.iframeUrl);
            setEditTipsHtml(DEFAULT_CONFIG.tipsHtml || "");
            setEditAdminUsername(DEFAULT_CONFIG.adminUsername!);
            setEditAdminPassword(DEFAULT_CONFIG.adminPassword!);
            setEditOverlayEnabled(DEFAULT_CONFIG.overlayEnabled || false);
            setEditOverlayText(DEFAULT_CONFIG.overlayText || "");
            setEditOverlayImageUrl(DEFAULT_CONFIG.overlayImageUrl || "");
            setEditOverlayPosition(DEFAULT_CONFIG.overlayPosition || "top-right");
            setEditOverlayOpacity(DEFAULT_CONFIG.overlayOpacity || 80);
            setEditOverlayScale(DEFAULT_CONFIG.overlayScale || 100);
            setDbError(null);
            addLog("system", "CONFIG_INIT - Instantiated default configuration file in Firestore");
          } catch (err: any) {
            console.error("Error creating default document in Firestore:", err);
            setDbError("Unable to initialize database settings. Verify your rules parameters.");
            handleFirestoreError(err, OperationType.WRITE, "configs/main");
          }
        }
        setLoading(false);
      },
      (error) => {
        console.error("Firestore listening error:", error);
        setDbError("Connecting to database failed. Make sure rules permit read/write access.");
        setLoading(false);
        handleFirestoreError(error, OperationType.GET, "configs/main", false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Handle Custom User login request
  const handleVisitorLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const username = loginUsername.trim();
    const password = loginPassword;

    if (!username || !password) {
      setLoginError("Please enter both username and password.");
      return;
    }

    // Find user matching username or phone number
    const user = registeredUsers.find(
      (u) => (u.username && u.username.toLowerCase() === username.toLowerCase()) ||
             (u.phoneNumber && u.phoneNumber.toLowerCase() === username.toLowerCase()) ||
             u.id.toLowerCase() === username.toLowerCase()
    );

    if (!user) {
      setLoginError("Invalid username or password.");
      addLog("fail", `AUTH_REJECT - Unregistered username '${username}' attempted sign-in`);
      return;
    }

    if (user.password !== password) {
      setLoginError("Invalid username or password.");
      addLog("fail", `AUTH_REJECT - Incorrect password for user '${username}'`);
      return;
    }

    if (!user.isAuthorized) {
      setLoginError("Access Pending: Your account is registered but pending authorization from the administrator.");
      addLog("fail", `AUTH_REJECT - Unauthorized user '${username}' blocked from entering`);
      return;
    }

    // Success!
    const effectiveUsername = user.username || user.phoneNumber || user.id;
    setAuthMode("visitor");
    setCurrentUsername(effectiveUsername);
    localStorage.setItem("auth_mode", "visitor");
    localStorage.setItem("user_username", effectiveUsername);
    localStorage.setItem("user_phone", effectiveUsername);
    setLoginUsername("");
    setLoginPassword("");
    setLoginError(null);
    addLog("success", `AUTH_GRNTD - User '${effectiveUsername}' logged in successfully`);
  };

  // Handle Custom User registration request
  const handleVisitorRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setRegSuccess(null);

    const username = regUsername.trim();
    const password = regPassword;
    const confirm = regConfirmPassword;

    if (!username || !password || !confirm) {
      setLoginError("All registration fields are required.");
      return;
    }

    if (username.length < 3) {
      setLoginError("Username must be at least 3 characters.");
      return;
    }

    if (password !== confirm) {
      setLoginError("Passwords do not match.");
      return;
    }

    if (password.length < 4) {
      setLoginError("Password must be at least 4 characters.");
      return;
    }

    // Check if username already registered
    const exists = registeredUsers.some(
      (u) => (u.username && u.username.toLowerCase() === username.toLowerCase()) ||
             (u.phoneNumber && u.phoneNumber.toLowerCase() === username.toLowerCase()) ||
             u.id.toLowerCase() === username.toLowerCase()
    );

    if (exists) {
      setLoginError("This username is already registered. Please choose another.");
      return;
    }

    try {
      const docId = username.replace(/[^a-zA-Z0-9_-]/g, "_");
      await setDoc(doc(db, "registered_users", docId), {
        username: username,
        phoneNumber: username,
        password: password,
        isAuthorized: false,
        screenShareAccess: false,
        tipsAccess: false,
        createdAt: Date.now()
      });

      setRegSuccess("Registration submitted successfully! Please ask the administrator to authorize your access.");
      addLog("info", `USER_REG - New user '${username}' registered (Pending authorization)`);
      setRegUsername("");
      setRegPassword("");
      setRegConfirmPassword("");
    } catch (err) {
      console.error("Error registering user:", err);
      setLoginError("Error registering account. Please try again.");
    }
  };

  // Handle Admin direct login from card
  const handleAdminLoginDirect = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!config) {
      setLoginError("Configuration is still loading...");
      return;
    }

    const trimmedUser = enteredUsername.trim();
    const trimmedPass = enteredPassword.trim();
    const targetUser = (config.adminUsername || "admin").trim();
    const targetPass = (config.adminPassword || "admin").trim();

    if (trimmedUser === targetUser && trimmedPass === targetPass) {
      setAuthMode("admin");
      localStorage.setItem("auth_mode", "admin");
      setEnteredUsername("");
      setEnteredPassword("");
      setLoginError(null);
      addLog("success", "AUTH_ELEVATED - Primary admin console unlocked via Gateway page");
    } else {
      setLoginError("Invalid admin username or password.");
      addLog("fail", "AUTH_REJECT - Bad admin credentials attempt intercepted");
    }
  };

  // Keep compatibility
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    handleVisitorLogin(e);
  };

  // Elevate from visitor space to admin space using absolute password popup
  const handleAdminEscalate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    const trimmedUser = adminUsernameInput.trim();
    const trimmedPass = adminPasswordInput.trim();
    const targetUser = (config.adminUsername || "admin").trim();
    const targetPass = (config.adminPassword || "admin").trim();

    if (trimmedUser === targetUser && trimmedPass === targetPass) {
      setAuthMode("admin");
      localStorage.setItem("auth_mode", "admin");
      setAdminUsernameInput("");
      setAdminPasswordInput("");
      setEscalateError(null);
      setShowAdminEscalate(false);
      addLog("success", "AUTH_ELEVATED - Admin privileges escalated successfully");
    } else {
      setEscalateError("Invalid Admin username or password.");
      addLog("fail", "AUTH_REJECT - Unsuccessful Admin privilege escalation request");
    }
  };

  // Commit updated configuration values to Cloud Firestore database
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !config) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await setDoc(doc(db, "configs", "main"), {
        iframeUrl: config.iframeUrl || DEFAULT_CONFIG.iframeUrl,
        tipsHtml: editTipsHtml,
        adminUsername: editAdminUsername.trim(),
        adminPassword: editAdminPassword.trim(),
        overlayEnabled: editOverlayEnabled,
        overlayText: editOverlayText,
        overlayImageUrl: editOverlayImageUrl,
        overlayPosition: editOverlayPosition,
        overlayOpacity: editOverlayOpacity,
        overlayScale: editOverlayScale
      }, { merge: true });

      setSaveSuccess(true);
      addLog("info", `CONFIG_DEPLOY - Portal settings and daily tips updated successfully`);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      addLog("fail", "SYS_WRITE_ERR - Save changes operation failed to authorize in database rules");
      alert("Failed to write to database. Confirm firestore.rules permission.");
      handleFirestoreError(err, OperationType.WRITE, "configs/main");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    addLog("info", `SESSION_TERM - Intentionally terminated active session [${authMode}]`);
    setAuthMode("none");
    localStorage.removeItem("auth_mode");
    localStorage.removeItem("user_username");
    localStorage.removeItem("user_phone");
    setCurrentUsername(null);
    setEnteredPassword("");
  };

  // Administrative functions for managing users
  const handleToggleAuthorizeUser = async (userId: string, currentStatus: boolean) => {
    try {
      await setDoc(doc(db, "registered_users", userId), {
        isAuthorized: !currentStatus
      }, { merge: true });
      addLog("info", `USER_AUTH - Toggled authorization status of user ${userId} to ${!currentStatus}`);
    } catch (err) {
      console.error("Error toggling user authorization:", err);
      alert("Failed to update authorization. Check Firestore write rules.");
    }
  };

  const handleToggleScreenShareAccess = async (userId: string, currentStatus: boolean) => {
    try {
      await setDoc(doc(db, "registered_users", userId), {
        screenShareAccess: !currentStatus
      }, { merge: true });
      addLog("info", `USER_PERM - Screen Share permission of user ${userId} set to ${!currentStatus}`);
    } catch (err) {
      console.error("Error toggling Screen Share access:", err);
      alert("Failed to update Screen Share access.");
    }
  };

  const handleToggleTipsAccess = async (userId: string, currentStatus: boolean) => {
    try {
      await setDoc(doc(db, "registered_users", userId), {
        tipsAccess: !currentStatus
      }, { merge: true });
      addLog("info", `USER_PERM - Tips page permission of user ${userId} set to ${!currentStatus}`);
    } catch (err) {
      console.error("Error toggling Tips access:", err);
      alert("Failed to update Tips access.");
    }
  };

  const handleChangeUserPassword = async (userId: string, newPassword: string) => {
    if (!newPassword.trim()) {
      alert("Please enter a valid password.");
      return;
    }
    try {
      await setDoc(doc(db, "registered_users", userId), {
        password: newPassword.trim()
      }, { merge: true });
      setEditingUserId(null);
      setNewUserPassword("");
      addLog("info", `USER_MOD - Administrator modified password for user ${userId}`);
    } catch (err) {
      console.error("Error updating user password:", err);
      alert("Failed to update password. Check Firestore write rules.");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user ${userId}?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, "registered_users", userId));
      addLog("info", `USER_DEL - Administrator permanently deleted user ${userId}`);
    } catch (err) {
      console.error("Error deleting user:", err);
      alert("Failed to delete user. Check Firestore write rules.");
    }
  };

  const handleAdminCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError(null);
    setAddUserSuccess(null);

    const username = newUserNameInput.trim();
    const password = newUserPassInput.trim();

    if (!username || !password) {
      setAddUserError("Username and password are required.");
      return;
    }

    if (username.length < 3) {
      setAddUserError("Username must be at least 3 characters.");
      return;
    }

    if (password.length < 3) {
      setAddUserError("Password must be at least 3 characters.");
      return;
    }

    const exists = registeredUsers.some(
      (u) => (u.username && u.username.toLowerCase() === username.toLowerCase()) ||
             (u.phoneNumber && u.phoneNumber.toLowerCase() === username.toLowerCase()) ||
             u.id.toLowerCase() === username.toLowerCase()
    );

    if (exists) {
      setAddUserError(`Username '${username}' already exists.`);
      return;
    }

    try {
      const docId = username.replace(/[^a-zA-Z0-9_-]/g, "_");
      await setDoc(doc(db, "registered_users", docId), {
        username: username,
        phoneNumber: username,
        password: password,
        isAuthorized: newUserAuthInput,
        screenShareAccess: newUserScreenShareInput,
        tipsAccess: newUserTipsInput,
        createdAt: Date.now()
      });

      setAddUserSuccess(`User account '${username}' created successfully.`);
      addLog("success", `USER_CREATE - Admin registered new user: ${username}`);
      setNewUserNameInput("");
      setNewUserPassInput("");
      setTimeout(() => {
        setAddUserSuccess(null);
        setShowAddUserModal(false);
      }, 1500);
    } catch (err) {
      console.error("Error creating user:", err);
      setAddUserError("Failed to save user in database. Check rules.");
    }
  };

  const handleCopyCredentials = (username: string, pass: string, userId: string) => {
    const text = `Username: ${username}\nPassword: ${pass}`;
    navigator.clipboard.writeText(text);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Loader UI (High Density Dark Styled)
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1115] flex flex-col items-center justify-center p-6 text-[#D1D5DB]">
        <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
          <div className="relative flex items-center justify-center">
            <div className="h-12 w-12 rounded-full border-4 border-[#30363D] border-t-blue-500 animate-spin"></div>
            <Lock className="absolute h-5 w-5 text-blue-500 animate-pulse" />
          </div>
          <p className="font-semibold text-white font-display text-lg tracking-wide animate-pulse">
            Booting Secure Gateway...
          </p>
          <p className="text-xs text-[#8B949E] font-mono">
            FETCHING REMOTE SETTINGS FROM CLOUD FIRESTORE...
          </p>
        </div>
      </div>
    );
  }

  // Database Connection Error View (High Density Dark Styled)
  if (dbError) {
    return (
      <div className="min-h-screen bg-[#0F1115] flex flex-col items-center justify-center p-6 text-[#D1D5DB]">
        <div className="bg-[#161B22] rounded-xl border border-rose-950 p-8 shadow-2xl max-w-md w-full text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-950/45 border border-rose-800/40 flex items-center justify-center mb-4">
            <ShieldAlert className="h-6 w-6 text-rose-500" />
          </div>
          <h2 className="text-lg font-bold font-display text-white mb-2">Firestore connection failed</h2>
          <p className="text-xs text-[#8B949E] font-mono leading-relaxed mb-6">
            {dbError}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded font-mono text-xs font-semibold tracking-wide transition shadow"
          >
            RE-ESTABLISH CONNECTION
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1115] font-sans relative overflow-hidden flex flex-col w-full text-[#D1D5DB]">
      
      {/* 1. Login Gate Screen */}
      {authMode === "none" && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 relative min-h-screen">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#30363D_1px,transparent_1px),linear-gradient(to_bottom,#30363D_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_60%,transparent_100%)] opacity-25 pointer-events-none"></div>
          
          <div className="z-10 w-full max-w-md">
            {/* High Density Brand Header */}
            <div className="text-center mb-6">
              <div className="inline-flex py-1 px-2.5 rounded bg-[#161B22] border border-[#30363D] text-[10px] font-mono font-medium text-blue-400 tracking-widest mb-3 uppercase">
                HR Portal v1.0
              </div>
              <h1 className="text-2xl font-bold font-display text-white tracking-tight">
                Authenticating Guest Portal
              </h1>
              <p className="text-[#8B949E] mt-1 text-xs">
                Provide either the authorized Visitor pattern or Admin credentials to continue.
              </p>
            </div>

            {/* Login Card styled with High Density (#161B22 background with border) */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="bg-[#1C2128] -mx-6 -mt-6 px-6 py-3 border-b border-[#30363D] mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-white tracking-wider flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-500" />
                  GATEWAY SECUR-AUTH
                </span>
                <span className="text-[10px] font-mono text-[#8B949E]">STATUS: STABLE</span>
              </div>

              {/* TAB SELECTOR */}
              <div className="flex border-b border-[#30363D] -mx-6 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab("login");
                    setLoginError(null);
                    setRegSuccess(null);
                  }}
                  className={`flex-1 py-2 text-center text-[11px] font-mono font-bold tracking-wider uppercase transition border-b-2 ${
                    loginTab === "login"
                      ? "border-blue-500 text-white bg-[#1C2128]/20"
                      : "border-transparent text-[#8B949E] hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab("register");
                    setLoginError(null);
                    setRegSuccess(null);
                  }}
                  className={`flex-1 py-2 text-center text-[11px] font-mono font-bold tracking-wider uppercase transition border-b-2 ${
                    loginTab === "register"
                      ? "border-blue-500 text-white bg-[#1C2128]/20"
                      : "border-transparent text-[#8B949E] hover:text-white"
                  }`}
                >
                  Register
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab("admin");
                    setLoginError(null);
                    setRegSuccess(null);
                  }}
                  className={`flex-1 py-2 text-center text-[11px] font-mono font-bold tracking-wider uppercase transition border-b-2 ${
                    loginTab === "admin"
                      ? "border-blue-500 text-white bg-[#1C2128]/20"
                      : "border-transparent text-[#8B949E] hover:text-white"
                  }`}
                >
                  Admin
                </button>
              </div>

              {loginTab === "login" && (
                <form onSubmit={handleVisitorLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B949E]">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={loginUsername}
                        onChange={(e) => {
                          setLoginUsername(e.target.value);
                          if (loginError) setLoginError(null);
                        }}
                        placeholder="Enter your username"
                        className="w-full pl-9 pr-3 py-2 bg-[#0D1117] border border-[#30363D] rounded focus:outline-none focus:border-blue-500 text-white font-mono text-xs transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B949E]">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value);
                          if (loginError) setLoginError(null);
                        }}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2 bg-[#0D1117] border border-[#30363D] rounded focus:outline-none focus:border-blue-500 text-white font-mono text-xs transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8B949E] hover:text-white focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {loginError && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start gap-2 p-3 rounded bg-rose-950/40 text-rose-300 border border-rose-900/30 text-[11px] font-mono leading-relaxed"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                      <span>{loginError}</span>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer shadow-md"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    <span>Sign In User</span>
                  </button>
                </form>
              )}

              {loginTab === "register" && (
                <form onSubmit={handleVisitorRegister} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
                      Choose Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B949E]">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => {
                          setRegUsername(e.target.value);
                          if (loginError) setLoginError(null);
                        }}
                        placeholder="Choose a username"
                        className="w-full pl-9 pr-3 py-2 bg-[#0D1117] border border-[#30363D] rounded focus:outline-none focus:border-blue-500 text-white font-mono text-xs transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
                      Choose Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B949E]">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => {
                          setRegPassword(e.target.value);
                          if (loginError) setLoginError(null);
                        }}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2 bg-[#0D1117] border border-[#30363D] rounded focus:outline-none focus:border-blue-500 text-white font-mono text-xs transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B949E]">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type="password"
                        value={regConfirmPassword}
                        onChange={(e) => {
                          setRegConfirmPassword(e.target.value);
                          if (loginError) setLoginError(null);
                        }}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2 bg-[#0D1117] border border-[#30363D] rounded focus:outline-none focus:border-blue-500 text-white font-mono text-xs transition-all"
                        required
                      />
                    </div>
                  </div>

                  {loginError && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start gap-2 p-3 rounded bg-rose-950/40 text-rose-300 border border-rose-900/30 text-[11px] font-mono leading-relaxed"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                      <span>{loginError}</span>
                    </motion.div>
                  )}

                  {regSuccess && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start gap-2 p-3 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-900/30 text-[11px] font-mono leading-relaxed"
                    >
                      <Check className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                      <span>{regSuccess}</span>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer shadow-md"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Create User Account</span>
                  </button>
                </form>
              )}

              {loginTab === "admin" && (
                <form onSubmit={handleAdminLoginDirect} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
                      Admin Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B949E]">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={enteredUsername}
                        onChange={(e) => {
                          setEnteredUsername(e.target.value);
                          if (loginError) setLoginError(null);
                        }}
                        placeholder="Admin username"
                        className="w-full pl-9 pr-4 py-2 bg-[#0D1117] border border-[#30363D] rounded focus:outline-none focus:border-blue-500 text-white font-mono text-xs transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
                      Admin Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B949E]">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={enteredPassword}
                        onChange={(e) => {
                          setEnteredPassword(e.target.value);
                          if (loginError) setLoginError(null);
                        }}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2 bg-[#0D1117] border border-[#30363D] rounded focus:outline-none focus:border-blue-500 text-white font-mono text-xs transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8B949E] hover:text-white focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {loginError && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start gap-2 p-3 rounded bg-rose-950/40 text-rose-300 border border-rose-900/30 text-[11px] font-mono leading-relaxed"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                      <span>{loginError}</span>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer shadow-md"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Unlock Admin Panel</span>
                  </button>
                </form>
              )}

              {/* Seamless Bottom Hints styled cleanly */}
              <div className="mt-6 pt-5 border-t border-[#30363D] flex items-center justify-between text-[11px] text-[#8B949E]">
                <span className="flex items-center gap-1 font-mono">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                  Production Node
                </span>
                <span className="text-[#30363D] font-mono">|</span>
                <button
                  type="button"
                  onClick={() => {
                    const user = prompt("Enter Admin Username:");
                    if (user) {
                      const pass = prompt("Enter Admin Password:");
                      if (pass && user.trim() === (config?.adminUsername || "admin").trim() && pass.trim() === (config?.adminPassword || "admin").trim()) {
                        setAuthMode("admin");
                        localStorage.setItem("auth_mode", "admin");
                        addLog("success", "AUTH_ELEVATED - Bypassed Gateway into Admin Portal with prompt key");
                      } else {
                        addLog("fail", "AUTH_REJECT - Quick admin prompt authenticate failed");
                        alert("Invalid credentials.");
                      }
                    }
                  }}
                  className="hover:text-blue-400 cursor-pointer font-mono font-medium tracking-wide transition-colors"
                >
                  ADMIN BYPASS
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* 2. Authenticated Frame Dashboard (Visitor and Admin views) */}
      {authMode !== "none" && (
        <div className="flex-1 flex flex-col relative w-full h-full min-h-screen">
          
          {/* Top Header Bar strictly configured as High Density design */}
          <header className="h-16 bg-[#161B22] border-b border-[#30363D] flex items-center justify-between px-4 sm:px-6 z-10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs uppercase">HR</div>
                <span className="font-bold tracking-tight text-white hidden sm:inline text-sm">HR Portal</span>
              </div>
              
              <div className="hidden md:flex items-center gap-4 text-xs">
                <div className="h-4 w-[1px] bg-[#30363D]"></div>
                <span className="text-[#8B949E]">Environment: <span className="text-emerald-500">Racing</span></span>
                <div className="h-4 w-[1px] bg-[#30363D]"></div>
                <span className="text-[#8B949E]">System: <span className="text-[#D1D5DB] font-mono">v1.0-stable</span></span>
                <div className="h-4 w-[1px] bg-[#30363D]"></div>
                <span className="text-[#8B949E]">Status: <span className="text-blue-400 font-mono">Active</span></span>
              </div>
            </div>

            {/* Configured Actions Area */}
            <div className="flex items-center gap-3">
              {authMode === "admin" && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="py-1 px-2.5 rounded bg-[#1C2128] border border-[#30363D] text-[10px] font-mono text-blue-400 uppercase font-semibold">
                      Admin Master
                    </span>
                  </div>
                  <div className="h-4 w-[1px] bg-[#30363D]"></div>
                </>
              )}

              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-rose-950/40 text-rose-400 border border-rose-900/40 hover:bg-rose-950 hover:text-rose-300 rounded text-xs font-mono transition flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Lock Gate</span>
              </button>
            </div>
          </header>

          {/* Configuration Workspace directly display inside the admin view */}
          {authMode === "admin" ? (
            <div className="flex-1 flex flex-col lg:flex-row bg-[#0F1115]">
              
              {/* LEFT Side: compact high-density settings panel */}
              <div className="w-full lg:w-96 bg-[#161B22] border-r border-[#30363D] flex flex-col justify-between overflow-y-auto">
                <div className="px-5 py-4 border-b border-[#30363D] bg-[#1C2128]/40 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Chrome className="h-4 w-4 text-blue-500 animate-pulse" />
                    <span>CHROME LIVE STUDIO</span>
                  </h3>
                  <span className="text-[9px] font-mono bg-blue-950/50 text-blue-300 border border-blue-900/50 px-2 py-0.5 rounded font-bold uppercase shrink-0">
                    Admin Board
                  </span>
                </div>

                <main className="p-5 space-y-6 flex-1">
                  
                  {/* Passcode Configuration Column */}
                  <div className="bg-[#1C2128] rounded-md border border-[#30363D] overflow-hidden">
                    <div className="bg-[#161B22] px-4 py-3 border-b border-[#30363D] flex items-center justify-between">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-display">
                        <KeyRound className="h-4 w-4 text-blue-500" />
                        Portal & Tips Config
                      </h3>
                      <span className="text-[9px] bg-[#21262d] text-[#8b949e] border border-[#30363D] font-mono px-2 py-0.5 rounded uppercase font-semibold">
                        Live Sync
                      </span>
                    </div>

                    <form onSubmit={handleSaveConfig} className="p-4 space-y-4">
                      {/* Tips Content Editor */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider flex justify-between">
                          <span>Tips (Text & HTML Content)</span>
                          <span className="text-emerald-500 text-[8px] animate-pulse">DAILY CONTENT</span>
                        </label>
                        <textarea
                          rows={6}
                          value={editTipsHtml}
                          onChange={(e) => setEditTipsHtml(e.target.value)}
                          placeholder="Enter your HTML and text tips here..."
                          className="w-full px-2.5 py-1.5 bg-[#0D1117] border border-[#30363D] rounded text-xs font-mono text-slate-300 outline-none focus:border-blue-500 transition-all resize-y"
                        />
                        <div className="text-[9px] text-[#8B949E] font-mono leading-tight bg-[#0D1117]/50 p-2 rounded border border-[#30363D]/30">
                          Accepts raw text & standard HTML (e.g. &lt;h3&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;ul&gt;).
                        </div>
                      </div>

                      {/* Admin Credentials */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
                            Admin Username
                          </label>
                          <input
                            type="text"
                            value={editAdminUsername}
                            onChange={(e) => setEditAdminUsername(e.target.value)}
                            placeholder="Admin username"
                            className="w-full px-2.5 py-1.5 bg-[#0D1117] border border-[#30363D] rounded text-xs font-mono text-slate-300 outline-none focus:border-blue-500 transition-all font-bold"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
                            Admin Password
                          </label>
                          <input
                            type="text"
                            value={editAdminPassword}
                            onChange={(e) => setEditAdminPassword(e.target.value)}
                            placeholder="Admin password"
                            className="w-full px-2.5 py-1.5 bg-[#0D1117] border border-[#30363D] rounded text-xs font-mono text-slate-300 outline-none focus:border-blue-500 transition-all font-bold"
                            required
                          />
                        </div>
                      </div>

                      {/* Floating text & image overlay */}
                      <div className="border-t border-[#30363D] pt-4 mt-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <span>Screen Share Overlay</span>
                          </label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editOverlayEnabled}
                              onChange={(e) => setEditOverlayEnabled(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-[#0D1117] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            <span className="ml-2 text-[10px] font-mono text-[#8B949E] uppercase font-semibold">
                              {editOverlayEnabled ? "ACTIVE" : "DISABLED"}
                            </span>
                          </label>
                        </div>

                        {editOverlayEnabled && (
                          <div className="space-y-3 pl-2 border-l border-[#30363D] mt-2">
                            {/* Overlay Text */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
                                Overlay Text
                              </label>
                              <input
                                type="text"
                                value={editOverlayText}
                                onChange={(e) => setEditOverlayText(e.target.value)}
                                placeholder="e.g. Screencast Live, Copyright 2026..."
                                className="w-full px-2.5 py-1.5 bg-[#0D1117] border border-[#30363D] rounded text-xs font-mono text-slate-300 outline-none focus:border-blue-500 transition-all"
                              />
                            </div>

                            {/* Overlay Image URL */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
                                Overlay Image URL
                              </label>
                              <input
                                type="text"
                                value={editOverlayImageUrl}
                                onChange={(e) => setEditOverlayImageUrl(e.target.value)}
                                placeholder="e.g. https://domain.com/logo.png"
                                className="w-full px-2.5 py-1.5 bg-[#0D1117] border border-[#30363D] rounded text-xs font-mono text-slate-300 outline-none focus:border-blue-500 transition-all"
                              />
                            </div>

                            {/* Overlay Position & Placement */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
                                Placement Position
                              </label>
                              <select
                                value={editOverlayPosition}
                                onChange={(e) => setEditOverlayPosition(e.target.value as any)}
                                className="w-full px-2.5 py-1.5 bg-[#0D1117] border border-[#30363D] rounded text-xs font-mono text-slate-300 outline-none focus:border-blue-500 transition-all text-white font-bold"
                              >
                                <option value="top-left">Top Left</option>
                                <option value="top-right">Top Right</option>
                                <option value="bottom-left">Bottom Left</option>
                                <option value="bottom-right">Bottom Right</option>
                                <option value="center">Center Center</option>
                                <option value="floating-animate">Continuous Float (Wander Effect)</option>
                              </select>
                            </div>

                            {/* Opacity and Scale Sliders */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider flex justify-between">
                                  <span>Opacity</span>
                                  <span>{editOverlayOpacity}%</span>
                                </label>
                                <input
                                  type="range"
                                  min="10"
                                  max="100"
                                  value={editOverlayOpacity}
                                  onChange={(e) => setEditOverlayOpacity(Number(e.target.value))}
                                  className="w-full accent-blue-500 h-1 bg-[#0D1117] rounded-lg appearance-none cursor-pointer"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider flex justify-between">
                                  <span>Scale Size</span>
                                  <span>{editOverlayScale}%</span>
                                </label>
                                <input
                                  type="range"
                                  min="50"
                                  max="200"
                                  value={editOverlayScale}
                                  onChange={(e) => setEditOverlayScale(Number(e.target.value))}
                                  className="w-full accent-blue-500 h-1 bg-[#0D1117] rounded-lg appearance-none cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Save Confirmation */}
                      <AnimatePresence>
                        {saveSuccess && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-2.5 bg-emerald-950/65 text-emerald-300 rounded border border-emerald-900/40 flex items-center gap-2 text-[11px] font-mono"
                          >
                            <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                            <span>Firestore configs synced.</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs uppercase tracking-wider rounded font-bold transition cursor-pointer disabled:opacity-40"
                      >
                        {isSaving ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        <span>{isSaving ? "Syncing..." : "DEPLOY CHANGES"}</span>
                      </button>
                    </form>
                  </div>

                  {/* Chrome Direct Screen Cast Console */}
                  <div className="bg-[#1C2128] rounded-md border border-[#30363D] overflow-hidden">
                    <div className="bg-[#161B22] px-4 py-3 border-b border-[#30363D] flex items-center justify-between">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Chrome className="h-4 w-4 text-blue-400" />
                        Direct Chrome Screen Share
                      </h3>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                        isBroadcasting ? "bg-rose-950 text-rose-300 animate-pulse" : "bg-neutral-800 text-neutral-400"
                      }`}>
                        {isBroadcasting ? "LIVE" : "STANDBY"}
                      </span>
                    </div>

                    <div className="p-4 space-y-4 font-mono">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
                          Cast Session Title
                        </label>
                        <input
                          type="text"
                          value={streamTitle}
                          onChange={(e) => setStreamTitle(e.target.value)}
                          placeholder="My Direct Chrome Screen Cast"
                          className="w-full px-3 py-1.5 bg-[#0D1117] border border-[#30363D] rounded text-xs text-white outline-none focus:border-blue-500 transition-all"
                          disabled={isBroadcasting}
                        />
                      </div>

                      {webrtcError && (
                        <div className="p-3 bg-rose-950/40 text-rose-300 border border-rose-900/40 rounded text-[11px] font-mono space-y-2">
                          <p className="font-bold">⚠️ Casting Security Limit Detected</p>
                          <p className="text-[10px] text-rose-200/80 leading-relaxed">
                            {webrtcError.includes("getDisplayMedia") || webrtcError.includes("disallowed by permissions policy") || webrtcError.includes("Permission") ? (
                              <span>
                                The browser iframe sandboxing environment disallows direct Screen Sharing ("getDisplayMedia") internally. 
                                <br /><br />
                                <b>Easy Solution:</b>
                                <br />
                                Click the <b>"Open in a new tab"</b> button on the top-right of your preview to run in standalone mode, which grants full browser casting permissions.
                              </span>
                            ) : (
                              <span>Error detail: {webrtcError}</span>
                            )}
                          </p>
                        </div>
                      )}

                      {/* Live Casting Quality Presets */}
                      <div className="bg-[#0D1117] border border-[#30363D] p-3 rounded-lg space-y-2.5">
                        <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider flex justify-between items-center">
                          <span>Live Broadcast Quality Profile</span>
                          <span className="text-xs text-blue-400 font-bold font-mono">
                            {streamQualityProfile === "smooth-720p" && "720p Smooth"}
                            {streamQualityProfile === "smooth-1080p" && "1080p Smooth"}
                            {streamQualityProfile === "slides-1080p" && "1080p Detail"}
                            {streamQualityProfile === "unconstrained" && "Raw Source"}
                          </span>
                        </label>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Select a broadcast profile optimized for stability. Heavy resolutions (like 4K/60fps) from high-res monitors cause screen-share jitter on visitor screens.
                        </p>
                        
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: "smooth-720p", label: "720p Smooth (30fps)", desc: "Lowest jitter, highly fluid" },
                            { id: "smooth-1080p", label: "1080p Balanced (30fps)", desc: "Default optimized layout" },
                            { id: "slides-1080p", label: "1080p Slides (15fps)", desc: "For static text, low band" },
                            { id: "unconstrained", label: "Raw Native Monitor", desc: "No limits (High CPU load)" }
                          ].map((profile) => (
                            <button
                              key={profile.id}
                              type="button"
                              disabled={isBroadcasting}
                              onClick={() => setStreamQualityProfile(profile.id as any)}
                              className={`p-2 rounded text-left border transition text-wrap leading-tight ${
                                isBroadcasting ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                              } ${
                                streamQualityProfile === profile.id
                                  ? "bg-blue-600/10 border-blue-500 text-blue-400 font-semibold"
                                  : "bg-[#161B22] border-[#30363D] text-[#8B949E] hover:border-slate-600 hover:text-white"
                              }`}
                            >
                              <div className="text-[10px] font-bold tracking-tight">{profile.label}</div>
                              <div className="text-[9px] text-slate-500 font-mono font-medium leading-none mt-0.5">{profile.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Live Screen Cropping & Area Focus Widget */}
                      <div className="bg-[#0D1117] border border-[#30363D] p-3 rounded-lg space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider flex items-center gap-1.5">
                            <Crop className="h-3.5 w-3.5 text-cyan-400" />
                            <span>Crop Screen Region</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                              cropEnabled ? "bg-cyan-950 text-cyan-300 border border-cyan-800/60" : "bg-[#161B22] text-[#8B949E]"
                            }`}>
                              {cropEnabled ? `${cropRect.width.toFixed(0)}% × ${cropRect.height.toFixed(0)}%` : "Full Screen"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCropEnabled(!cropEnabled);
                                addLog("info", `CROP_TOGGLE - Turned screen crop ${!cropEnabled ? "ON" : "OFF"}`);
                              }}
                              className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                cropEnabled ? "bg-cyan-500" : "bg-neutral-800"
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                  cropEnabled ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-500 leading-tight">
                          Show only what you want to share. Areas outside the crop box (taskbars, private tabs, notifications) will be hidden from viewers in real time.
                        </p>

                        {/* Interactive Visual Selector Button */}
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setShowCropModal(true)}
                            className="flex-1 py-1.5 px-2.5 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800/50 hover:border-cyan-500/80 text-cyan-300 hover:text-white rounded text-[10px] font-mono font-bold tracking-wider uppercase transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Crop className="h-3.5 w-3.5" />
                            <span>Visual Crop Region Selector</span>
                          </button>
                          {cropEnabled && (
                            <button
                              type="button"
                              onClick={() => applyCropPreset("full")}
                              className="px-2 py-1.5 bg-[#161B22] hover:bg-neutral-800 text-[#8B949E] hover:text-white border border-[#30363D] rounded text-[10px] font-mono font-bold tracking-wider uppercase transition cursor-pointer"
                              title="Reset to Full Screen"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        {/* Quick Crop Presets */}
                        <div className="space-y-1 pt-1 border-t border-[#30363D]/40">
                          <div className="text-[9px] text-[#8B949E] uppercase font-mono font-semibold flex justify-between">
                            <span>Quick Presets</span>
                            {cropEnabled && <span className="text-cyan-400">X:{cropRect.x.toFixed(0)}% Y:{cropRect.y.toFixed(0)}%</span>}
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {[
                              { id: "full", label: "Full 100%", type: "full" as const },
                              { id: "center80", label: "Center 80%", type: "center80" as const },
                              { id: "center60", label: "Center 60%", type: "center60" as const },
                              { id: "topHalf", label: "Top 50%", type: "topHalf" as const },
                              { id: "bottomHalf", label: "Bottom 50%", type: "bottomHalf" as const },
                              { id: "leftHalf", label: "Left 50%", type: "leftHalf" as const },
                              { id: "rightHalf", label: "Right 50%", type: "rightHalf" as const },
                            ].map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyCropPreset(preset.type)}
                                className={`py-1 px-1 rounded text-[9px] font-mono font-bold transition cursor-pointer text-center border truncate ${
                                  (!cropEnabled && preset.type === "full") ||
                                  (cropEnabled && preset.type === "center80" && cropRect.width === 80 && cropRect.height === 80)
                                    ? "bg-cyan-600 border-cyan-400 text-white shadow"
                                    : "bg-[#161B22] border-[#30363D] text-[#8B949E] hover:border-slate-500 hover:text-white"
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={isBroadcasting ? stopBroadcast : startBroadcast}
                        className={`w-full py-2.5 px-3 rounded text-xs font-bold tracking-wider uppercase transition flex items-center justify-center gap-2 cursor-pointer ${
                          isBroadcasting
                            ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                      >
                        <Radio className="h-4 w-4" />
                        <span>{isBroadcasting ? "STOP SCREEN CAST" : "START DIRECT SCREEN SHARE"}</span>
                      </button>

                      {/* Smooth Streaming Buffer Control Widget */}
                      <div className="pt-3 border-t border-[#30363D] space-y-3">
                        <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-wider flex justify-between items-center">
                          <span>Anti-Stutter Jitter Delay</span>
                          <span className="text-blue-400 font-bold bg-[#0D1117] px-2 py-0.5 rounded border border-[#30363D]">
                            Active: {playoutDelay}s
                          </span>
                        </label>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Configure the playout delay (in seconds) to buffer video and cushion network jitter on all visitor devices.
                        </p>
                        
                        {/* Quick Presets */}
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { label: "0.1s", val: 0.1 },
                            { label: "1.0s", val: 1.0 },
                            { label: "2.5s", val: 2.5 },
                            { label: "5.0s", val: 5.0 }
                          ].map((opt) => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => {
                                handleUpdatePlayoutDelay(opt.val);
                                setCustomDelayInput(String(opt.val));
                              }}
                              className={`py-1 rounded text-[10px] font-mono font-bold transition cursor-pointer text-center border ${
                                playoutDelay === opt.val
                                  ? "bg-blue-600 border-blue-500 text-white shadow"
                                  : "bg-[#0D1117] border-[#30363D] text-[#8B949E] hover:bg-[#161B22] hover:text-white"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Custom Dynamic Control */}
                        <div className="bg-[#0D1117] border border-[#30363D] p-2.5 rounded-md space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-[#8B949E] uppercase font-mono">Custom Value</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="30"
                                step="0.1"
                                value={customDelayInput}
                                onChange={(e) => setCustomDelayInput(e.target.value)}
                                className="w-16 bg-[#161B22] border border-[#30363D] rounded px-1.5 py-0.5 text-xs text-white font-mono text-center focus:outline-none focus:border-blue-500"
                              />
                              <span className="text-[10px] text-slate-500 font-mono">sec</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="15"
                              step="0.1"
                              value={isNaN(parseFloat(customDelayInput)) ? 0 : parseFloat(customDelayInput)}
                              onChange={(e) => setCustomDelayInput(e.target.value)}
                              className="flex-1 accent-blue-500 h-1 bg-[#161B22] rounded-lg cursor-pointer"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const parsed = parseFloat(customDelayInput);
                              if (!isNaN(parsed) && parsed >= 0) {
                                handleUpdatePlayoutDelay(Number(parsed.toFixed(1)));
                              }
                            }}
                            className="w-full py-1 px-2 bg-blue-600/20 hover:bg-blue-600/35 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500/50 rounded text-[10px] font-bold tracking-wider uppercase transition cursor-pointer"
                          >
                            Apply Custom Delay
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                </main>

                <div className="p-4 border-t border-[#30363D] bg-[#1C2128]/50 text-[11px] font-mono text-[#8B949E] space-y-1">
                  <div>Engine Mode: Cloud Authoritative</div>
                  <div className="flex items-center gap-1 text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Operational (DB connection live)
                  </div>
                </div>

              </div>

              {/* CENTER/RIGHT Side: Two Column layout. Top/Stats + traffic stream console, Side: Live iFrame Preview */}
              <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
                
                {/* Simulated Monitor Board */}
                <div className="w-full xl:w-96 border-b xl:border-b-0 xl:border-r border-[#30363D] p-5 flex flex-col gap-6 overflow-y-auto">
                  
                  {/* Interactive Info Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-lg flex flex-col justify-between">
                      <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-blue-400" />
                        Live Visitors
                      </span>
                      <div className="text-2xl font-mono text-emerald-400 mt-1.5 flex items-center gap-1.5 font-bold">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        {visitorCount}
                      </div>
                    </div>
                    <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-lg flex flex-col justify-between">
                      <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Activity className={`h-3 w-3 text-rose-400 ${(isBroadcasting && localStream) ? "animate-pulse" : ""}`} />
                        Duration
                      </span>
                      <div className="text-sm font-mono text-white mt-2 font-bold tracking-wider">
                        {(isBroadcasting && localStream) ? durationText : "OFFLINE"}
                      </div>
                    </div>
                    <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-lg flex flex-col justify-between">
                      <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Sliders className="h-3 w-3 text-blue-400" />
                        Total Sessions
                      </span>
                      <div className="text-xl font-mono text-[#D1D5DB] mt-1.5">{sessionsCount}</div>
                    </div>
                    <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-lg flex flex-col justify-between">
                      <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Ban className="h-3 w-3 text-rose-400" />
                        Access Denies
                      </span>
                      <div className="text-xl font-mono text-rose-400 mt-1.5">{blockedIps}</div>
                    </div>
                  </div>

                  {/* High Density Console Stream log & Live Chat tab controller */}
                  <div className="bg-[#161B22] border border-[#30363D] rounded-lg flex-1 flex flex-col min-h-[350px]">
                    <div className="bg-[#1C2128] border-b border-[#30363D] flex items-center justify-between text-xs font-mono">
                      <div className="flex border-r border-[#30363D]">
                        <button
                          type="button"
                          onClick={() => setAdminActiveTab("users")}
                          className={`px-3 py-2 text-[10px] font-bold tracking-wider uppercase border-r border-[#30363D] transition cursor-pointer ${
                            adminActiveTab === "users"
                              ? "bg-[#161B22] text-blue-400 font-bold"
                              : "text-[#8B949E] hover:text-white"
                          }`}
                        >
                          👤 Users ({registeredUsers.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminActiveTab("chat")}
                          className={`px-3 py-2 text-[10px] font-bold tracking-wider uppercase border-r border-[#30363D] transition cursor-pointer ${
                            adminActiveTab === "chat"
                              ? "bg-[#161B22] text-blue-400 font-bold"
                              : "text-[#8B949E] hover:text-white"
                          }`}
                        >
                          💬 Chat ({chatMessages.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminActiveTab("traffic")}
                          className={`px-3 py-2 text-[10px] font-bold tracking-wider uppercase border-r border-[#30363D] transition cursor-pointer ${
                            adminActiveTab === "traffic"
                              ? "bg-[#161B22] text-blue-400 font-bold"
                              : "text-[#8B949E] hover:text-white"
                          }`}
                        >
                          📟 Logs
                        </button>
                      </div>
                      
                      <div className="px-3 text-[#505c6d] text-[8px] font-mono font-bold tracking-widest uppercase">
                        Active Inflow
                      </div>
                    </div>

                    {adminActiveTab === "users" ? (
                      <div className="flex-1 flex flex-col justify-between">
                        {/* Admin Account & Quick Credentials Banner */}
                        <div className="px-3 pt-3 space-y-2">
                          <div className="bg-[#0D1117] border border-[#30363D] rounded-md p-2.5 flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-900/50 px-1.5 py-0.5 rounded font-bold uppercase">
                                Admin Account
                              </span>
                              <span className="text-[#8B949E]">User: <b className="text-white">{config?.adminUsername || "admin"}</b></span>
                              <span className="text-[#30363D]">|</span>
                              <span className="text-[#8B949E]">Pass: <b className="text-amber-300 font-mono">{config?.adminPassword || "admin"}</b></span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyCredentials(config?.adminUsername || "admin", config?.adminPassword || "admin", "admin-creds")}
                              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition"
                              title="Copy Admin Credentials"
                            >
                              {copiedId === "admin-creds" ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copy Admin</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Users Search Bar & Add User Button */}
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={userSearchQuery}
                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                placeholder="Search by username..."
                                className="w-full pl-3 pr-8 py-1.5 bg-[#0D1117] border border-[#30363D] rounded-md text-xs font-mono text-slate-300 outline-none focus:border-blue-500 placeholder-slate-500"
                              />
                              {userSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setUserSearchQuery("")}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-300 font-mono"
                                >
                                  CLEAR
                                </button>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddUserModal(!showAddUserModal);
                                setAddUserError(null);
                                setAddUserSuccess(null);
                              }}
                              className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                                showAddUserModal
                                  ? "bg-slate-700 text-white"
                                  : "bg-blue-600 hover:bg-blue-700 text-white"
                              }`}
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              <span>{showAddUserModal ? "Close" : "+ Add User"}</span>
                            </button>
                          </div>

                          {/* Inline Add User Form */}
                          <AnimatePresence>
                            {showAddUserModal && (
                              <motion.form
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                onSubmit={handleAdminCreateUser}
                                className="p-3 bg-[#1C2128] border border-blue-500/40 rounded-md space-y-2.5 font-mono text-xs overflow-hidden"
                              >
                                <div className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center justify-between">
                                  <span>Create New User Account</span>
                                  <span className="text-[9px] text-[#8B949E]">Firestore Auth</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-[#8B949E] uppercase font-bold">Username</label>
                                    <input
                                      type="text"
                                      value={newUserNameInput}
                                      onChange={(e) => setNewUserNameInput(e.target.value)}
                                      placeholder="Username"
                                      className="w-full px-2 py-1 bg-[#0D1117] border border-[#30363D] rounded text-white text-xs outline-none focus:border-blue-500"
                                      required
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-[#8B949E] uppercase font-bold">Password</label>
                                    <input
                                      type="text"
                                      value={newUserPassInput}
                                      onChange={(e) => setNewUserPassInput(e.target.value)}
                                      placeholder="Password"
                                      className="w-full px-2 py-1 bg-[#0D1117] border border-[#30363D] rounded text-white text-xs outline-none focus:border-blue-500"
                                      required
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-3 pt-1 text-[10px]">
                                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={newUserAuthInput}
                                      onChange={(e) => setNewUserAuthInput(e.target.checked)}
                                      className="rounded bg-[#0D1117] border-[#30363D]"
                                    />
                                    <span>Portal Access</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={newUserScreenShareInput}
                                      onChange={(e) => setNewUserScreenShareInput(e.target.checked)}
                                      className="rounded bg-[#0D1117] border-[#30363D]"
                                    />
                                    <span>Live Video Access</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={newUserTipsInput}
                                      onChange={(e) => setNewUserTipsInput(e.target.checked)}
                                      className="rounded bg-[#0D1117] border-[#30363D]"
                                    />
                                    <span>Tips Page Access</span>
                                  </label>
                                </div>

                                {addUserError && (
                                  <div className="text-[10px] text-rose-400 bg-rose-950/40 p-1.5 rounded border border-rose-900/30">
                                    {addUserError}
                                  </div>
                                )}
                                {addUserSuccess && (
                                  <div className="text-[10px] text-emerald-400 bg-emerald-950/40 p-1.5 rounded border border-emerald-900/30">
                                    {addUserSuccess}
                                  </div>
                                )}

                                <div className="flex justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setShowAddUserModal(false)}
                                    className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] uppercase font-bold cursor-pointer transition"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] uppercase font-bold cursor-pointer transition"
                                  >
                                    Save User
                                  </button>
                                </div>
                              </motion.form>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[280px] scrollbar-thin scrollbar-thumb-slate-800">
                          {registeredUsers.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-[#8B949E] text-center py-10 space-y-2">
                              <UserX className="h-8 w-8 text-slate-600 animate-pulse" />
                              <span className="text-[10px] font-mono">No registered users in directory. Click "+ Add User" to create one.</span>
                            </div>
                          ) : (
                            <div className="space-y-2 font-mono text-xs">
                              {registeredUsers
                                .filter((u) => {
                                  const q = userSearchQuery.trim().toLowerCase();
                                  if (!q) return true;
                                  const uname = (u.username || u.phoneNumber || u.id || "").toLowerCase();
                                  return uname.includes(q);
                                })
                                .map((user) => {
                                  const isEditing = editingUserId === user.id;
                                  const usernameDisplay = user.username || user.phoneNumber || user.id;
                                  const isPasswordRevealed = !!revealedPasswords[user.id];

                                  return (
                                    <div key={user.id} className="p-2.5 bg-[#1C2128] border border-[#30363D] rounded-md space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 font-bold text-white">
                                          <User className="h-3.5 w-3.5 text-blue-400" />
                                          <span>{usernameDisplay}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => handleCopyCredentials(usernameDisplay, user.password || "", user.id)}
                                            className="text-[9px] text-[#8B949E] hover:text-white flex items-center gap-1 transition"
                                            title="Copy Username and Password"
                                          >
                                            {copiedId === user.id ? (
                                              <>
                                                <Check className="h-3 w-3 text-emerald-400" />
                                                <span className="text-emerald-400">Copied</span>
                                              </>
                                            ) : (
                                              <>
                                                <Copy className="h-3 w-3" />
                                                <span>Copy</span>
                                              </>
                                            )}
                                          </button>
                                          <span className="text-[9px] text-slate-500">
                                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between text-[10px] text-[#8B949E]">
                                        <div className="flex items-center gap-1.5">
                                          <span>Password:</span>
                                          <span className="text-slate-200 font-bold bg-[#0D1117] px-2 py-0.5 rounded border border-[#30363D]/40 font-mono tracking-wider">
                                            {isPasswordRevealed ? user.password : "••••••••"}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setRevealedPasswords(prev => ({ ...prev, [user.id]: !prev[user.id] }))}
                                            className="text-slate-400 hover:text-white p-0.5"
                                            title={isPasswordRevealed ? "Hide Password" : "Show Password"}
                                          >
                                            {isPasswordRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                          </button>
                                        </div>
                                      </div>

                                      {/* Specific Page Access Permissions */}
                                      <div className="flex flex-wrap gap-1.5 pt-1.5 pb-1">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleAuthorizeUser(user.id, user.isAuthorized)}
                                          className={`px-2 py-1 rounded text-[9px] font-bold tracking-wide uppercase border transition cursor-pointer flex items-center gap-1 ${
                                            user.isAuthorized
                                              ? "bg-emerald-950/60 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/40"
                                              : "bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800"
                                          }`}
                                          title="Authorize master portal sign-in"
                                        >
                                          <div className={`h-1.5 w-1.5 rounded-full ${user.isAuthorized ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`}></div>
                                          <span>Portal Access</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleToggleScreenShareAccess(user.id, user.screenShareAccess ?? false)}
                                          className={`px-2 py-1 rounded text-[9px] font-bold tracking-wide uppercase border transition cursor-pointer flex items-center gap-1 ${
                                            (user.screenShareAccess ?? false)
                                              ? "bg-blue-950/60 text-blue-400 border-blue-900/50 hover:bg-blue-900/40"
                                              : "bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800"
                                          }`}
                                          title="Toggle permission to view live screen stream"
                                        >
                                          <div className={`h-1.5 w-1.5 rounded-full ${(user.screenShareAccess ?? false) ? "bg-blue-400 animate-pulse" : "bg-slate-500"}`}></div>
                                          <span>Live Video</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleToggleTipsAccess(user.id, user.tipsAccess ?? false)}
                                          className={`px-2 py-1 rounded text-[9px] font-bold tracking-wide uppercase border transition cursor-pointer flex items-center gap-1 ${
                                            (user.tipsAccess ?? false)
                                              ? "bg-purple-950/60 text-purple-400 border-purple-900/50 hover:bg-purple-900/40"
                                              : "bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800"
                                          }`}
                                          title="Toggle permission to view daily tips page"
                                        >
                                          <div className={`h-1.5 w-1.5 rounded-full ${(user.tipsAccess ?? false) ? "bg-purple-400 animate-pulse" : "bg-slate-500"}`}></div>
                                          <span>Tips page</span>
                                        </button>
                                      </div>

                                      {isEditing ? (
                                        <div className="pt-2 border-t border-[#30363D]/40 flex gap-1.5">
                                          <input
                                            type="text"
                                            value={newUserPassword}
                                            onChange={(e) => setNewUserPassword(e.target.value)}
                                            placeholder="New password"
                                            className="flex-1 px-2 py-1 bg-[#0D1117] border border-[#30363D] rounded text-[10px] text-white outline-none focus:border-blue-500 font-mono"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleChangeUserPassword(user.id, newUserPassword)}
                                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] rounded font-bold transition cursor-pointer"
                                          >
                                            Save
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingUserId(null);
                                              setNewUserPassword("");
                                            }}
                                            className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] rounded transition cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="pt-2 border-t border-[#30363D]/40 flex justify-end gap-2 text-[10px]">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingUserId(user.id);
                                              setNewUserPassword(user.password || "");
                                            }}
                                            className="text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                                          >
                                            <Edit className="h-3 w-3" />
                                            <span>Change Password</span>
                                          </button>
                                          <span className="text-[#30363D]">|</span>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="text-rose-400 hover:text-rose-300 flex items-center gap-0.5"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                            <span>Delete</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                        <div className="bg-[#1C2128] py-2 border-t border-[#30363D] text-center text-[10px] text-[#8B949E] font-mono uppercase tracking-widest">
                          User Directory & Credentials Manager
                        </div>
                      </div>
                    ) : adminActiveTab === "traffic" ? (
                      <div className="flex-1 flex flex-col justify-between">
                        <div className="flex-1 p-3 font-mono text-[11px] space-y-2 overflow-y-auto max-h-[280px] scrollbar-thin scrollbar-thumb-slate-800">
                          {logs.map((log) => (
                            <div key={log.id} className="text-[#8B949E] leading-relaxed break-all">
                              <span className="text-[#30363D] mr-1.5">[{log.time}]</span>
                              <span className={`font-semibold mr-1.5 ${
                                log.type === "success" ? "text-emerald-500" :
                                log.type === "fail" ? "text-rose-400" :
                                log.type === "info" ? "text-blue-400" :
                                "text-amber-500"
                              }`}>
                                {log.type.toUpperCase()}
                              </span>
                              <span>- {log.message}</span>
                            </div>
                          ))}
                        </div>
                        <button 
                          onClick={() => {
                            setLogs([{
                              id: Math.random().toString(),
                              time: new Date().toTimeString().split(' ')[0],
                              type: "system",
                              message: "LOGS_CLEARED - Console log cleared"
                            }]);
                          }}
                          className="bg-[#1C2128] py-2 border-t border-[#30363D] text-center text-[10px] text-[#8B949E] hover:text-white font-mono uppercase tracking-widest transition cursor-pointer"
                        >
                          Clear stream report
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-between">
                        {/* Messages panel */}
                        <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[240px] scrollbar-thin scrollbar-thumb-slate-800 font-mono text-xs">
                          {chatMessages.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-[#8B949E] text-center py-6 text-[10px]">
                              No messages in chat repository yet.
                            </div>
                          ) : (
                            chatMessages.map((msg) => (
                              <div key={msg.id} className="space-y-0.5 break-all leading-relaxed">
                                <div className="flex items-center justify-between">
                                  <span className={`font-semibold text-[10px] ${msg.role === "admin" ? "text-amber-400" : "text-blue-400"}`}>
                                    {msg.senderName}
                                    {msg.role === "admin" && (
                                      <span className="ml-1 text-[8px] bg-amber-950 text-amber-400 border border-amber-900/40 rounded px-1">ADMIN</span>
                                    )}
                                  </span>
                                  <span className="text-[8px] text-[#30363D]">
                                    {msg.timestamp ? new Date(msg.timestamp).toTimeString().split(' ')[0] : ''}
                                  </span>
                                </div>
                                <p className="text-slate-300 pl-1 border-l border-[#30363D] text-[11px]">{msg.text}</p>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Clear Chat Button */}
                        {chatMessages.length > 0 && (
                          <div className="bg-[#1C2128] border-t border-[#30363D] flex divide-x divide-[#30363D] font-mono text-[10px] shrink-0">
                            {confirmClearChat ? (
                              <>
                                <button
                                  type="button"
                                  onClick={handleClearChat}
                                  className="flex-1 py-2 text-rose-400 hover:text-rose-300 bg-rose-950/20 hover:bg-rose-950/35 text-center font-bold uppercase tracking-widest transition cursor-pointer flex items-center justify-center gap-1.5 animate-pulse"
                                >
                                  <Check className="h-3 w-3" />
                                  CONFIRM PURGE ALL CHATS
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmClearChat(false)}
                                  className="px-4 py-2 text-slate-400 hover:text-white bg-[#0D1117] text-center uppercase tracking-widest transition cursor-pointer font-bold"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmClearChat(true);
                                  // Auto reset after 5s
                                  setTimeout(() => setConfirmClearChat(false), 5000);
                                }}
                                className="flex-1 py-2 text-rose-500/80 hover:text-rose-400 hover:bg-[#161B22] text-center uppercase tracking-widest transition cursor-pointer flex items-center justify-center gap-1.5 font-bold"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Clear Chat History ({chatMessages.length})
                              </button>
                            )}
                          </div>
                        )}

                        {/* Send Admin Response Form */}
                        <form onSubmit={handleSendChatMessage} className="p-3 bg-[#0D1117] border-t border-[#30363D] flex gap-2">
                          <input
                            type="text"
                            value={chatInputText}
                            onChange={(e) => setChatInputText(e.target.value)}
                            placeholder="Admin reply..."
                            className="flex-1 px-2.5 py-1.5 bg-[#161B22] border border-[#30363D] rounded text-xs text-white outline-none focus:border-blue-500 font-mono"
                          />
                          <button
                            type="submit"
                            className="px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded cursor-pointer font-mono font-bold tracking-wider uppercase transition"
                          >
                            SEND
                          </button>
                        </form>
                      </div>
                    )}
                  </div>

                </div>

                {/* Rightmost Panel: Chrome Casting Transmission Monitor */}
                <div className="flex-1 flex flex-col bg-[#0F1115] relative">
                  
                  {/* Visualizer Frame Header info */}
                  <div className="bg-[#161B22] text-[#D1D5DB] p-3 px-4 text-xs font-mono flex items-center justify-between border-b border-[#30363D]">
                    <span className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                      Cast Transmission Monitor
                    </span>
                    <span className="text-[9px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">
                      Real-time Feed Preview
                    </span>
                  </div>

                  <div className="flex-1 bg-[#0F1115] p-4 flex items-center justify-center">
                    {isBroadcasting && localStream ? (
                      <div className="w-full h-full bg-[#161B22] border border-[#30363D] rounded overflow-hidden flex flex-col relative aspect-video shadow-2xl">
                        <div className="absolute top-4 left-4 bg-rose-600 text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded animate-pulse flex items-center gap-1.5 z-10 shadow-lg">
                          <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
                          <span>CHROME DIRECT CAST FEED LIVE</span>
                        </div>

                        {/* Top-Right Crop Quick Adjust Button */}
                        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                          <button
                            type="button"
                            onClick={() => setShowCropModal(true)}
                            className={`px-2.5 py-1 rounded font-mono text-[10px] font-bold uppercase transition flex items-center gap-1.5 shadow-lg cursor-pointer ${
                              cropEnabled
                                ? "bg-cyan-950/90 text-cyan-300 border border-cyan-500/80 hover:bg-cyan-900/90"
                                : "bg-black/70 text-slate-300 border border-white/20 hover:bg-black/90 hover:text-white"
                            }`}
                            title="Open Crop Region Selector"
                          >
                            <Crop className="h-3.5 w-3.5 text-cyan-400" />
                            <span>{cropEnabled ? `Crop: ${cropRect.width.toFixed(0)}% × ${cropRect.height.toFixed(0)}%` : "Crop: Off (Full)"}</span>
                          </button>
                        </div>

                        <video
                          className="w-full h-full object-contain bg-black"
                          autoPlay
                          playsInline
                          muted
                          ref={(el) => {
                            if (el && localStream && el.srcObject !== localStream) {
                              el.srcObject = localStream;
                            }
                          }}
                        />
                        {renderFloatingOverlay()}
                      </div>
                    ) : (
                      <div className="w-full max-w-lg bg-[#161B22] border border-[#30363D] rounded-lg p-6 space-y-6 text-center font-mono relative overflow-hidden shadow-xl">
                        <div className="absolute -right-16 -top-16 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                        
                        <div className="flex justify-center">
                          <div className="p-3.5 bg-[#1C2128] border border-[#30363D] text-[#8B949E] rounded-full relative">
                            <Radio className="h-6 w-6 text-blue-400 animate-pulse" />
                            <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-emerald-500 border-2 border-[#161B22] rounded-full animate-ping"></div>
                            <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-emerald-500 border-2 border-[#161B22] rounded-full"></div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-white uppercase tracking-widest">
                            Direct Cast Server Ready
                          </h4>
                          <p className="text-[10px] text-[#8B949E] leading-relaxed max-w-sm mx-auto">
                            The secure casting gateway is completely operational. Click the "START DIRECT SCREEN SHARE" button to share your screen in real time with visitors.
                          </p>
                        </div>

                        <div className="border border-[#30363D]/60 bg-[#0D1117] rounded p-3 text-left space-y-1.5 text-[10px] text-[#8B949E]">
                          <div className="flex justify-between border-b border-[#30363D]/40 pb-1">
                            <span>Cast Connection Type:</span>
                            <span className="text-white">Direct WebRTC Cast</span>
                          </div>
                          <div className="flex justify-between border-b border-[#30363D]/40 pb-1">
                            <span>Tunnel Mode:</span>
                            <span className="text-blue-400">Secure Direct Screen Cast</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Visitor Transmission Feed:</span>
                            <span className="text-emerald-400 font-bold">READY TO RECEIVE SCREENCAST</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Standard Guest / Visitor Mode Screen */
            (() => {
              const currentUserObj = registeredUsers.find(
                (u) => (u.username && u.username.toLowerCase() === currentUsername?.toLowerCase()) ||
                       (u.phoneNumber && u.phoneNumber.toLowerCase() === currentUsername?.toLowerCase()) ||
                       u.id.toLowerCase() === currentUsername?.toLowerCase()
              );
              const hasScreenShareAccess = currentUserObj ? (currentUserObj.screenShareAccess ?? false) : false;
              const hasTipsAccess = currentUserObj ? (currentUserObj.tipsAccess ?? false) : false;

              // If they have neither permission, show the pending lock screen
              if (!hasScreenShareAccess && !hasTipsAccess) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center bg-[#0F1115] text-center p-8 font-mono space-y-6">
                    <div className="p-4 bg-[#161B22] border border-[#30363D] text-amber-500 rounded-full relative">
                      <Lock className="h-8 w-8 text-amber-500 animate-pulse" />
                      <div className="absolute top-0 right-0 h-2.5 w-2.5 bg-amber-500 rounded-full animate-ping"></div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Access Rights Pending</h3>
                      <p className="text-xs text-[#8B949E] max-w-md leading-relaxed mx-auto">
                        Your account <b className="text-white">{currentUsername}</b> is successfully registered, but your access permissions have not been updated yet.
                      </p>
                    </div>
                    <div className="text-[10px] text-slate-500 bg-[#161B22] border border-[#30363D]/60 px-4 py-2.5 rounded max-w-sm leading-normal">
                      The administrator must assign <b>Screen Share Access</b> or <b>Tips Page Access</b> to your account in the admin panel before you can continue.
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="px-4 py-1.5 bg-rose-950/40 text-rose-400 border border-rose-900/40 hover:bg-rose-950 hover:text-rose-300 rounded text-xs font-mono transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Lock Gate & Exit</span>
                    </button>
                  </div>
                );
              }

              return (
                <div className="flex-1 flex flex-col bg-[#0F1115] overflow-hidden">
                  <div className="bg-[#161B22] border-b border-[#30363D] px-4 py-2.5 flex flex-wrap items-center justify-between text-xs font-mono gap-2">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="flex items-center gap-2 text-[#D1D5DB]">
                        <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${config?.isLive ? "bg-rose-500" : "bg-emerald-500"}`}></div>
                        <span>{config?.isLive ? "Active Live Stream Detected" : "Gateway Connection Secured"}</span>
                      </span>
                      
                      <span className="text-[#30363D] hidden sm:inline">|</span>
                      
                      <span className="flex items-center gap-1.5 text-blue-400">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Live Viewers: <b className="text-white font-mono">{visitorCount}</b></span>
                      </span>

                      {config?.isLive && viewerRemoteStream && (
                        <>
                          <span className="text-[#30363D] hidden sm:inline">|</span>
                          <span className="flex items-center gap-1.5 text-rose-400 animate-pulse">
                            <Activity className="h-3.5 w-3.5" />
                            <span>Screencast Duration: <b className="text-white font-mono">{durationText}</b></span>
                          </span>
                        </>
                      )}
                    </div>
                    
                    {/* Render Tab bar if they have BOTH page permissions */}
                    {hasScreenShareAccess && hasTipsAccess ? (
                      <div className="flex bg-[#0D1117] p-0.5 rounded border border-[#30363D]">
                        <button
                          type="button"
                          onClick={() => setVisitorActiveTab("stream")}
                          className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition flex items-center gap-1 ${
                            visitorActiveTab === "stream"
                              ? "bg-blue-600 text-white shadow"
                              : "text-[#8B949E] hover:text-white"
                          }`}
                        >
                          <Monitor className="h-3 w-3" />
                          <span>Live Video</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisitorActiveTab("tips")}
                          className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition flex items-center gap-1 ${
                            visitorActiveTab === "tips"
                              ? "bg-purple-600 text-white shadow"
                              : "text-[#8B949E] hover:text-white"
                          }`}
                        >
                          <Info className="h-3 w-3" />
                          <span>Tips</span>
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[10px] px-2 py-0.5 border rounded font-mono font-bold uppercase ${
                        config?.isLive ? "bg-rose-950/40 border-rose-900/50 text-rose-300" : "bg-blue-900/30 border-blue-900/50 text-blue-300"
                      }`}>
                        {hasScreenShareAccess ? "SCREENCAST STREAM ACTIVE" : "DAILY TIPS ACTIVE"}
                      </span>
                    )}
                  </div>

                  {/* Body Content */}
                  {visitorActiveTab === "tips" && hasTipsAccess ? (
                    <div className="flex-1 flex flex-col justify-start items-center p-4 lg:p-8 overflow-y-auto w-full font-sans bg-[#0D1117]">
                      <div className="w-full max-w-4xl space-y-6">
                        <div className="p-6 bg-[#161B22] border border-[#30363D] rounded-xl relative overflow-hidden shadow-xl">
                          <div className="absolute right-0 top-0 bg-purple-600/10 text-purple-400 font-mono text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-[#30363D] uppercase tracking-wider animate-pulse flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                            <span>Live Document</span>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-purple-950/40 rounded-lg border border-purple-900/30 text-purple-400">
                                <Info className="h-5 w-5" />
                              </div>
                              <div>
                                <h2 className="text-lg font-bold text-white tracking-tight uppercase">Daily Tips & Updates</h2>
                                <p className="text-[10px] text-slate-500 font-mono">AUTHORIZED VISITOR ACCESS ONLY</p>
                              </div>
                            </div>

                            <div className="h-[1px] bg-[#30363D]"></div>

                            {/* Daily Tips HTML Render Body */}
                            <div 
                              className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4 pt-2 font-sans select-text break-words text-left"
                              dangerouslySetInnerHTML={{ __html: config?.tipsHtml || "<h3>No tips uploaded today</h3><p>Please check back later for updates from the administrator.</p>" }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Render direct chrome screen share player & chat sidebar */
                    <div className="flex-1 flex flex-col lg:flex-row bg-[#0D1117] overflow-hidden">
                      {/* Main player box */}
                      <div className="flex-1 relative flex flex-col justify-center items-center p-4 overflow-y-auto">
                        {config?.isLive && config?.liveStreamType === "webrtc" ? (
                          <div className="w-full max-w-4xl aspect-video bg-black rounded-lg border border-[#30363D] overflow-hidden relative group flex items-center justify-center">
                            {viewerRemoteStream ? (
                              <video
                                className="w-full h-full object-contain bg-black"
                                autoPlay
                                playsInline
                                muted
                                controls
                                ref={(el) => {
                                  if (el) {
                                    if (viewerRemoteStream && el.srcObject !== viewerRemoteStream) {
                                      el.srcObject = viewerRemoteStream;
                                    }
                                    el.play().catch((err) => {
                                      console.warn("Autoplay programmatic start was prevented:", err);
                                    });
                                  }
                                }}
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center font-mono text-xs text-[#8B949E] space-y-3">
                                <div className="h-8 w-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                                <div className="uppercase tracking-wider text-rose-500 animate-pulse font-bold">
                                  Connecting to Authorized Direct Broadcast...
                                </div>
                                <div className="text-[10px] text-[#30363D]">
                                  Loading...
                                </div>
                              </div>
                            )}
                            
                            <div className="absolute top-4 left-4 bg-rose-600 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded animate-pulse flex items-center gap-1">
                              <Radio className="h-3 w-3" />
                              <span>LIVE: {config?.liveStreamTitle || "Online"}</span>
                            </div>
                            {renderFloatingOverlay()}
                          </div>
                        ) : (
                          <div className="w-full max-w-xl bg-[#161B22] border border-[#30363D] rounded-lg p-8 text-center font-mono space-y-6 shadow-2xl relative overflow-hidden my-auto mx-4">
                            <div className="absolute -left-16 -top-16 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl pointer-events-none"></div>
                            
                            <div className="flex justify-center flex-col items-center gap-2">
                              <div className="p-4 bg-[#1C2128] border border-[#30363D] text-[#8B949E] rounded-full relative">
                                <Radio className="h-7 w-7 text-rose-500 animate-pulse" />
                                <div className="absolute top-0 right-0 h-3 w-3 bg-rose-500 rounded-full animate-ping"></div>
                                <div className="absolute top-0 right-0 h-3 w-3 bg-rose-500 rounded-full"></div>
                              </div>
                              <span className="text-[10px] uppercase font-bold tracking-widest text-rose-400 mt-2">
                                HR LIVE CAST CHANNEL
                              </span>
                            </div>

                            <div className="space-y-2">
                              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                TEMPORARILY OFFLINE / STANDBY
                              </h3>
                              <p className="text-xs text-[#8B949E] leading-relaxed max-w-sm mx-auto">
                                This secure gateway is active. The direct screen share from Chrome has not started yet. Please standby for the incoming live screen representation.
                              </p>
                            </div>

                            <div className="border border-[#30363D]/60 bg-[#0D1117] rounded-md p-4 text-xs text-left space-y-1.5 text-[#8B949E]">
                              <div className="flex justify-between border-b border-[#30363D]/40 pb-1.5">
                                <span>Transmission Tunnel:</span>
                                <span className="text-white">hr-wdgw.onrender.com</span>
                              </div>
                              <div className="flex justify-between border-b border-[#30363D]/40 pb-1.5">
                                <span>Connection Status:</span>
                                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  SECURED & SPINNING
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Stream Access Mode:</span>
                                <span className="text-blue-400 font-bold">Online</span>
                              </div>
                            </div>

                            <div className="text-[10px] text-[#8B949E] pt-2 flex items-center justify-center gap-2">
                              <span className="inline-block h-1 w-1 bg-[#30363D] rounded-full"></span>
                              <span>Authentication Tier Verified</span>
                              <span className="inline-block h-1 w-1 bg-[#30363D] rounded-full"></span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Real-time chat side panel overlay */}
                      <div className="w-full lg:w-80 bg-[#161B22] border-t lg:border-t-0 lg:border-l border-[#30363D] flex flex-col justify-between h-[450px] lg:h-auto overflow-hidden">
                        <div className="bg-[#1C2128]/50 px-4 py-3 border-b border-[#30363D] flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-white flex items-center gap-2 uppercase tracking-wide">
                            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                            Viewer Live Chat
                          </span>
                          <span className="text-[9px] font-mono text-[#8B949E]">
                            {chatMessages.length} msgs
                          </span>
                        </div>

                        {/* Scrollable messages box */}
                        <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
                          {chatMessages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                              <span className="text-xs text-[#8B949E] font-mono leading-relaxed">
                                No messages yet.
                                <br />Be the first to say hi!
                              </span>
                            </div>
                          ) : (
                            chatMessages.map((msg) => (
                              <div key={msg.id} className="text-xs font-mono space-y-0.5 leading-relaxed break-all text-left">
                                <div className="flex items-center justify-between">
                                  <span className={`font-semibold text-[11px] ${msg.role === "admin" ? "text-amber-400" : "text-blue-400"}`}>
                                    {msg.senderName} 
                                    {msg.role === "admin" && (
                                      <span className="ml-1 text-[8px] bg-amber-950 text-amber-400 border border-amber-900/40 rounded px-1 py-0.5">ADMIN</span>
                                    )}
                                  </span>
                                  <span className="text-[8px] text-[#30363D]">
                                    {msg.timestamp ? new Date(msg.timestamp).toTimeString().split(' ')[0] : ''}
                                  </span>
                                </div>
                                <p className="text-slate-300 pl-1 border-l border-[#30363D] text-[11px]">{msg.text}</p>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Send chat block */}
                        <form onSubmit={handleSendChatMessage} className="p-4 bg-[#0D1117] border-t border-[#30363D] space-y-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-[#8B949E] uppercase font-bold tracking-wider shrink-0 font-mono">Username:</span>
                            <input
                              type="text"
                              value={chatUsername}
                              onChange={(e) => {
                                const val = e.target.value.slice(0, 15);
                                setChatUsername(val);
                                localStorage.setItem("chat_username", val);
                              }}
                              placeholder="Username"
                              className="bg-transparent border-0 border-b border-[#30363D] focus:border-blue-500 font-mono text-[10px] text-white outline-none px-1 w-24 shrink"
                            />
                          </div>
                          
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={chatInputText}
                              onChange={(e) => setChatInputText(e.target.value)}
                              placeholder="Type message..."
                              className="flex-1 px-2.5 py-1.5 bg-[#161B22] border border-[#30363D] rounded text-xs text-white outline-none focus:border-blue-500 font-mono"
                            />
                            <button
                              type="submit"
                              className="px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded cursor-pointer font-mono font-bold tracking-wider uppercase transition"
                            >
                              SEND
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          )}

        </div>
      )}

      {/* 3. Escalate Privilege Overlay Modal Popup */}
      <AnimatePresence>
        {showAdminEscalate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 shadow-2xl max-w-sm w-full relative"
            >
              <div className="flex items-center gap-2.5 mb-2.5 border-b border-[#30363D] pb-3 -mx-6 px-6 -mt-3">
                <Sliders className="h-4.5 w-4.5 text-blue-500" />
                <h3 className="text-sm font-bold font-display text-white uppercase tracking-wider">
                  Escalate Admin Session
                </h3>
              </div>
              <p className="text-xs text-[#8B949E] leading-relaxed mb-4">
                Please provide the primary systems Admin username and password to unlock live administrative widgets.
              </p>

              <form onSubmit={handleAdminEscalate} className="space-y-4">
                <div className="space-y-3">
                  {/* Admin Username Input */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B949E]">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={adminUsernameInput}
                      onChange={(e) => {
                        setAdminUsernameInput(e.target.value);
                        setEscalateError(null);
                      }}
                      placeholder="Admin username..."
                      className="w-full pl-9 pr-4 py-2 bg-[#0D1117] border border-[#30363D] rounded text-xs font-mono text-white outline-none focus:border-blue-500 tracking-wider"
                      required
                      autoFocus
                    />
                  </div>

                  {/* Admin Password Input */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B949E]">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <input
                      type={escalatePassword ? "text" : "password"}
                      value={adminPasswordInput}
                      onChange={(e) => {
                        setAdminPasswordInput(e.target.value);
                        setEscalateError(null);
                      }}
                      placeholder="Admin password..."
                      className="w-full pl-9 pr-10 py-2 bg-[#0D1117] border border-[#30363D] rounded text-xs font-mono text-white outline-none focus:border-blue-500 tracking-wider"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setEscalatePassword(!escalatePassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8B949E] hover:text-white transition"
                    >
                      {escalatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {escalateError && (
                  <div className="p-2.5 rounded bg-rose-950/60 text-rose-300 border border-rose-900/40 text-[11px] font-mono select-none">
                    {escalateError}
                  </div>
                )}

                <div className="flex gap-2.5 pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminEscalate(false);
                      setAdminUsernameInput("");
                      setAdminPasswordInput("");
                      setEscalateError(null);
                    }}
                    className="flex-1 py-2 px-3 border border-[#30363D] bg-[#0D1117] text-[#D1D5DB] font-mono text-[11px] rounded transition hover:bg-[#1C2128] cursor-pointer text-center"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-mono text-[11px] font-bold rounded transition cursor-pointer text-center"
                  >
                    ELEVATE ACC
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Visual Screen Share Crop Region Selector Modal */}
      <AnimatePresence>
        {showCropModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#161B22] border border-[#30363D] rounded-xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="bg-[#1C2128] px-5 py-3 border-b border-[#30363D] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-cyan-950/60 border border-cyan-800/60 rounded-md text-cyan-400">
                    <Crop className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                      Screen Share Crop & Privacy Region
                    </h3>
                    <p className="text-[10px] text-[#8B949E] font-mono">
                      Drag or resize the cyan box to show only what you choose. Outside area is hidden from viewers.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCropModal(false)}
                  className="p-1 text-[#8B949E] hover:text-white rounded hover:bg-[#30363D]/50 transition cursor-pointer text-xs font-mono"
                >
                  ✕ Close
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 font-mono text-xs">
                {/* Visual Draggable/Resizable Crop Canvas Container */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#8B949E] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Move className="h-3.5 w-3.5 text-cyan-400" />
                      Interactive Crop Selector (Drag box or handles to resize)
                    </span>
                    <span className="text-cyan-400 font-bold bg-[#0D1117] px-2 py-0.5 rounded border border-[#30363D]">
                      Active: {cropRect.width.toFixed(0)}% × {cropRect.height.toFixed(0)}% (X: {cropRect.x.toFixed(0)}%, Y: {cropRect.y.toFixed(0)}%)
                    </span>
                  </div>

                  {/* Interactive Crop Frame Area */}
                  <div
                    ref={cropContainerRef}
                    onPointerMove={handleCropPointerMove}
                    onPointerUp={handleCropPointerUp}
                    className="relative w-full aspect-video bg-[#0D1117] border-2 border-[#30363D] rounded-lg overflow-hidden select-none touch-none cursor-crosshair shadow-inner"
                  >
                    {/* Background Feed: Raw Screen capture if active, else simulated desktop template */}
                    {isBroadcasting && rawStreamRef.current ? (
                      <video
                        className="w-full h-full object-fill pointer-events-none"
                        autoPlay
                        playsInline
                        muted
                        ref={(el) => {
                          if (el && rawStreamRef.current && el.srcObject !== rawStreamRef.current) {
                            el.srcObject = rawStreamRef.current;
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col justify-between p-4 bg-[radial-gradient(#30363D_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-60">
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>[Sample Screen: 1920 × 1080 Full Display]</span>
                          <span>Broadcast not live yet (Pre-setting region)</span>
                        </div>
                        <div className="border border-slate-700/50 rounded-md p-6 bg-black/40 text-center max-w-sm mx-auto space-y-2">
                          <p className="text-white text-xs font-bold">Screen Share Preview Area</p>
                          <p className="text-[10px] text-slate-400">
                            When you start screen share, your live desktop will stream here in real-time.
                          </p>
                        </div>
                        <div className="text-[9px] text-slate-600 text-right">Taskbar & system clock area (Hidden if cropped)</div>
                      </div>
                    )}

                    {/* Shaded Masks (Dim areas outside the crop box) */}
                    {cropEnabled && (
                      <>
                        {/* Top mask */}
                        <div
                          className="absolute bg-black/75 backdrop-blur-[1px] pointer-events-none transition-all duration-75"
                          style={{ top: 0, left: 0, right: 0, height: `${cropRect.y}%` }}
                        />
                        {/* Bottom mask */}
                        <div
                          className="absolute bg-black/75 backdrop-blur-[1px] pointer-events-none transition-all duration-75"
                          style={{
                            top: `${cropRect.y + cropRect.height}%`,
                            left: 0,
                            right: 0,
                            bottom: 0,
                          }}
                        />
                        {/* Left mask */}
                        <div
                          className="absolute bg-black/75 backdrop-blur-[1px] pointer-events-none transition-all duration-75"
                          style={{
                            top: `${cropRect.y}%`,
                            left: 0,
                            width: `${cropRect.x}%`,
                            height: `${cropRect.height}%`,
                          }}
                        />
                        {/* Right mask */}
                        <div
                          className="absolute bg-black/75 backdrop-blur-[1px] pointer-events-none transition-all duration-75"
                          style={{
                            top: `${cropRect.y}%`,
                            left: `${cropRect.x + cropRect.width}%`,
                            right: 0,
                            height: `${cropRect.height}%`,
                          }}
                        />
                      </>
                    )}

                    {/* The Crop Box */}
                    <div
                      onPointerDown={(e) => handleCropPointerDown("move", e)}
                      style={{
                        left: `${cropRect.x}%`,
                        top: `${cropRect.y}%`,
                        width: `${cropRect.width}%`,
                        height: `${cropRect.height}%`,
                      }}
                      className={`absolute cursor-move transition-[box-shadow] duration-150 ${
                        cropEnabled
                          ? "border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5),inset_0_0_15px_rgba(34,211,238,0.15)]"
                          : "border-2 border-dashed border-slate-500/60"
                      }`}
                    >
                      {/* Center label badge */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-black/80 text-cyan-300 border border-cyan-500/40 rounded px-2 py-0.5 text-[9px] font-bold whitespace-nowrap flex items-center gap-1 shadow-md">
                        <Crop className="h-2.5 w-2.5" />
                        <span>
                          {cropEnabled ? `BROADCAST REGION: ${cropRect.width.toFixed(0)}% × ${cropRect.height.toFixed(0)}%` : "FULL SCREEN"}
                        </span>
                      </div>

                      {/* Rule of Thirds subtle grid inside crop box */}
                      <div className="absolute inset-0 pointer-events-none opacity-20">
                        <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                          <div className="border-r border-b border-cyan-300"></div>
                          <div className="border-r border-b border-cyan-300"></div>
                          <div className="border-b border-cyan-300"></div>
                          <div className="border-r border-b border-cyan-300"></div>
                          <div className="border-r border-b border-cyan-300"></div>
                          <div className="border-b border-cyan-300"></div>
                          <div className="border-r border-cyan-300"></div>
                          <div className="border-r border-cyan-300"></div>
                          <div></div>
                        </div>
                      </div>

                      {/* 4 Corner Resize Handles */}
                      <div
                        onPointerDown={(e) => handleCropPointerDown("nw", e)}
                        className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-cyan-400 border border-black rounded-xs cursor-nwse-resize hover:scale-125 transition-transform"
                        title="Resize Top-Left"
                      />
                      <div
                        onPointerDown={(e) => handleCropPointerDown("ne", e)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-cyan-400 border border-black rounded-xs cursor-nesw-resize hover:scale-125 transition-transform"
                        title="Resize Top-Right"
                      />
                      <div
                        onPointerDown={(e) => handleCropPointerDown("sw", e)}
                        className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-cyan-400 border border-black rounded-xs cursor-nesw-resize hover:scale-125 transition-transform"
                        title="Resize Bottom-Left"
                      />
                      <div
                        onPointerDown={(e) => handleCropPointerDown("se", e)}
                        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-cyan-400 border border-black rounded-xs cursor-nwse-resize hover:scale-125 transition-transform"
                        title="Resize Bottom-Right"
                      />

                      {/* 4 Edge Resize Handles */}
                      <div
                        onPointerDown={(e) => handleCropPointerDown("n", e)}
                        className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-cyan-400/80 rounded-xs cursor-ns-resize hover:bg-cyan-300"
                        title="Resize Top Edge"
                      />
                      <div
                        onPointerDown={(e) => handleCropPointerDown("s", e)}
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-cyan-400/80 rounded-xs cursor-ns-resize hover:bg-cyan-300"
                        title="Resize Bottom Edge"
                      />
                      <div
                        onPointerDown={(e) => handleCropPointerDown("w", e)}
                        className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-8 bg-cyan-400/80 rounded-xs cursor-ew-resize hover:bg-cyan-300"
                        title="Resize Left Edge"
                      />
                      <div
                        onPointerDown={(e) => handleCropPointerDown("e", e)}
                        className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-8 bg-cyan-400/80 rounded-xs cursor-ew-resize hover:bg-cyan-300"
                        title="Resize Right Edge"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Presets & Toggle Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0D1117] border border-[#30363D] p-3.5 rounded-lg">
                  {/* Enable Switch and Presets */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Crop className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Screen Share Cropping</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setCropEnabled(!cropEnabled);
                          addLog("info", `CROP_TOGGLE - Turned screen crop ${!cropEnabled ? "ON" : "OFF"}`);
                        }}
                        className={`px-3 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition cursor-pointer flex items-center gap-1.5 border ${
                          cropEnabled
                            ? "bg-cyan-600 border-cyan-500 text-white shadow"
                            : "bg-[#161B22] border-[#30363D] text-[#8B949E] hover:text-white"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${cropEnabled ? "bg-white animate-pulse" : "bg-slate-500"}`}></span>
                        <span>{cropEnabled ? "Crop ACTIVE" : "Crop DISABLED (Full)"}</span>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] text-[#8B949E] uppercase font-bold">1-Click Region Presets:</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: "full", label: "Full 100%", type: "full" as const },
                          { id: "center80", label: "Center 80%", type: "center80" as const },
                          { id: "center60", label: "Center 60%", type: "center60" as const },
                          { id: "topHalf", label: "Top 50%", type: "topHalf" as const },
                          { id: "bottomHalf", label: "Bottom 50%", type: "bottomHalf" as const },
                          { id: "leftHalf", label: "Left 50%", type: "leftHalf" as const },
                          { id: "rightHalf", label: "Right 50%", type: "rightHalf" as const },
                        ].map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyCropPreset(preset.type)}
                            className="py-1 px-1.5 bg-[#161B22] hover:bg-[#1C2128] border border-[#30363D] hover:border-cyan-500/50 text-[#8B949E] hover:text-white rounded text-[10px] font-mono transition text-center cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Manual Coordinate Sliders for fine-tuning */}
                  <div className="space-y-2 border-t md:border-t-0 md:border-l border-[#30363D] pt-3 md:pt-0 md:pl-4">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                      <Sliders className="h-3 w-3 text-cyan-400" />
                      <span>Coordinate Fine-Tuning</span>
                    </span>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {/* Horizontal Pos X */}
                      <div className="space-y-1 bg-[#161B22] p-2 rounded border border-[#30363D]">
                        <div className="flex justify-between text-[#8B949E]">
                          <span>X Offset</span>
                          <span className="text-white font-bold">{cropRect.x.toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={Math.max(0, 100 - cropRect.width)}
                          value={cropRect.x}
                          onChange={(e) => {
                            setCropEnabled(true);
                            setCropRect(prev => ({ ...prev, x: Number(e.target.value) }));
                          }}
                          className="w-full accent-cyan-400 h-1 bg-[#0D1117] rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Vertical Pos Y */}
                      <div className="space-y-1 bg-[#161B22] p-2 rounded border border-[#30363D]">
                        <div className="flex justify-between text-[#8B949E]">
                          <span>Y Offset</span>
                          <span className="text-white font-bold">{cropRect.y.toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={Math.max(0, 100 - cropRect.height)}
                          value={cropRect.y}
                          onChange={(e) => {
                            setCropEnabled(true);
                            setCropRect(prev => ({ ...prev, y: Number(e.target.value) }));
                          }}
                          className="w-full accent-cyan-400 h-1 bg-[#0D1117] rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Crop Width */}
                      <div className="space-y-1 bg-[#161B22] p-2 rounded border border-[#30363D]">
                        <div className="flex justify-between text-[#8B949E]">
                          <span>Width</span>
                          <span className="text-white font-bold">{cropRect.width.toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max={100 - cropRect.x}
                          value={cropRect.width}
                          onChange={(e) => {
                            setCropEnabled(true);
                            setCropRect(prev => ({ ...prev, width: Number(e.target.value) }));
                          }}
                          className="w-full accent-cyan-400 h-1 bg-[#0D1117] rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Crop Height */}
                      <div className="space-y-1 bg-[#161B22] p-2 rounded border border-[#30363D]">
                        <div className="flex justify-between text-[#8B949E]">
                          <span>Height</span>
                          <span className="text-white font-bold">{cropRect.height.toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max={100 - cropRect.y}
                          value={cropRect.height}
                          onChange={(e) => {
                            setCropEnabled(true);
                            setCropRect(prev => ({ ...prev, height: Number(e.target.value) }));
                          }}
                          className="w-full accent-cyan-400 h-1 bg-[#0D1117] rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-[#1C2128] px-5 py-3 border-t border-[#30363D] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => applyCropPreset("full")}
                  className="px-3 py-1.5 bg-[#0D1117] hover:bg-[#161B22] text-[#8B949E] hover:text-white border border-[#30363D] rounded text-xs font-mono font-bold uppercase transition cursor-pointer"
                >
                  Reset (Full Screen)
                </button>
                <button
                  type="button"
                  onClick={() => setShowCropModal(false)}
                  className="px-5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Done / Apply Crop</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


    </div>
  );
}
