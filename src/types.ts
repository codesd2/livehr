export interface AppConfig {
  iframeUrl: string;
  visitorPassword?: string;
  adminUsername?: string;
  adminPassword?: string;
  isLive?: boolean;
  liveStreamType?: "iframe" | "webrtc";
  liveStreamTitle?: string;
  twitchChannel?: string;
  streamStartedAt?: number | null;
  tipsHtml?: string;
  playoutDelay?: number;
  overlayEnabled?: boolean;
  overlayText?: string;
  overlayImageUrl?: string;
  overlayPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "floating-animate";
  overlayOpacity?: number;
  overlayScale?: number;
}

export interface RegisteredUser {
  id: string;
  username: string;
  phoneNumber?: string;
  password: string;
  isAuthorized: boolean;
  screenShareAccess: boolean;
  tipsAccess: boolean;
  createdAt: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AuthMode = "none" | "visitor" | "admin";
