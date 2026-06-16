import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Radio, Tv, Eye, Send, ArrowLeft, Wifi, WifiOff, Gamepad2, Users, X, Dot,
  Mic, MicOff, MonitorUp, ShieldAlert, Zap, Gem, ShieldX
} from "lucide-react";
import { GAME_MODES } from "@/lib/gameData";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import GamePlayer from "@/components/GamePlayer";

interface StreamSummary {
  streamerId: number;
  streamerName: string;
  gameId: string;
  gameName: string;
  score: number;
  viewerCount: number;
  startedAt: number;
}

interface ChatMsg { from: string; fromId: number; text: string; ts: number; }

type Mode = "browse" | "watching" | "live";

// Public STUN server is enough for same-machine / LAN testing. For broadcasting
// across the open internet you'd also want a TURN server.
const ICE_CONFIG: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export default function StreamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = !!(user as any)?.isAdmin;
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<Mode>("browse");
  const [streams, setStreams] = useState<StreamSummary[]>([]);

  // watching
  const [watching, setWatching] = useState<StreamSummary | null>(null);
  const watchingIdRef = useRef<number | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // live
  const [liveGameId, setLiveGameId] = useState("gravity-dash");
  const [isLive, setIsLive] = useState(false);
  const liveStreamerIdRef = useRef<number | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const [liveGameKey, setLiveGameKey] = useState(0); // bump to restart game while staying live
  const [sessionGems, setSessionGems] = useState(0); // gems earned this stream
  const [hasBoosted, setHasBoosted] = useState(false);
  const [boostFlash, setBoostFlash] = useState<string | null>(null);

  // WebRTC
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcMapRef = useRef<Map<number, RTCPeerConnection>>(new Map()); // streamer → per-viewer
  const viewerPcRef = useRef<RTCPeerConnection | null>(null);          // viewer side
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteActive, setRemoteActive] = useState(false);

  const send = (obj: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(obj));
  };

  const closeStreamerPeers = () => {
    pcMapRef.current.forEach((pc) => pc.close());
    pcMapRef.current.clear();
  };

  const stopLocalMedia = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  };

  const connect = useCallback(() => {
    if (!user) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "join_lobby", userId: user.id, username: user.username }));
      ws.send(JSON.stringify({ type: "get_streams" }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "streams_list") {
        setStreams(msg.streams.filter((s: StreamSummary) => s.streamerId !== user.id));
      }
      if (msg.type === "stream_live") {
        liveStreamerIdRef.current = msg.streamerId;
        setIsLive(true);
      }
      if (msg.type === "stream_snapshot") {
        watchingIdRef.current = msg.streamerId;
        setWatching({
          streamerId: msg.streamerId, streamerName: msg.streamerName, gameId: msg.gameId,
          gameName: msg.gameName, score: msg.score, viewerCount: msg.viewerCount, startedAt: msg.startedAt,
        });
        setChat(msg.chat || []);
        setRemoteActive(false);
        setMode("watching");
      }
      if (msg.type === "stream_update") {
        setWatching(prev => prev && prev.streamerId === msg.streamerId
          ? { ...prev, score: msg.score, viewerCount: msg.viewerCount } : prev);
      }
      if (msg.type === "stream_chat") {
        const relevant = watchingIdRef.current === msg.streamerId || liveStreamerIdRef.current === msg.streamerId;
        if (relevant) setChat(prev => [...prev.slice(-80), { from: msg.from, fromId: msg.fromId, text: msg.text, ts: msg.ts }]);
      }

      if (msg.type === "stream_boosted") {
        const relevant = watchingIdRef.current === msg.streamerId || liveStreamerIdRef.current === msg.streamerId;
        if (relevant) {
          setBoostFlash(`⚡ ${msg.boosterName} boosted${liveStreamerIdRef.current === msg.streamerId ? ` (+${msg.gems} 💎)` : ""}!`);
          setTimeout(() => setBoostFlash(null), 2500);
          if (liveStreamerIdRef.current === msg.streamerId) {
            setSessionGems(g => g + (msg.gems || 0));
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
          }
        }
      }

      if (msg.type === "stream_reward") {
        if (msg.gems > 0) {
          toast({ title: "Streaming reward! 💎", description: `You earned ${msg.gems} Sparks for streaming ${msg.minutes} min!` });
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        }
        if (msg.endedByAdmin) {
          toast({ title: "Stream ended by an admin", description: "A moderator ended your stream.", variant: "destructive" });
        }
        liveStreamerIdRef.current = null;
        setIsLive(false);
        setMode("browse");
      }
      if (msg.type === "stream_ended") {
        if (watchingIdRef.current === msg.streamerId) {
          viewerPcRef.current?.close();
          viewerPcRef.current = null;
          watchingIdRef.current = null;
          setRemoteActive(false);
          setWatching(null);
          setMode("browse");
          setChat([]);
          send({ type: "get_streams" });
        }
      }

      // ─── WebRTC signaling ──────────────────────────────────────────
      // Streamer: a viewer connected — send them an offer with our tracks.
      if (msg.type === "viewer_ready" && typeof msg.viewerId === "number") {
        if (!localStreamRef.current) return;
        const pc = new RTCPeerConnection(ICE_CONFIG);
        localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
        pc.onicecandidate = (e) => { if (e.candidate) send({ type: "rtc_ice", to: msg.viewerId, candidate: e.candidate }); };
        pcMapRef.current.set(msg.viewerId, pc);
        (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send({ type: "rtc_offer", viewerId: msg.viewerId, sdp: offer });
        })().catch(() => {});
      }
      // Streamer: viewer answered.
      if (msg.type === "rtc_answer" && typeof msg.viewerId === "number") {
        pcMapRef.current.get(msg.viewerId)?.setRemoteDescription(msg.sdp).catch(() => {});
      }
      // Viewer: streamer sent an offer — answer it and show their media.
      if (msg.type === "rtc_offer" && typeof msg.streamerId === "number") {
        const pc = new RTCPeerConnection(ICE_CONFIG);
        pc.ontrack = (e) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
          setRemoteActive(true);
        };
        pc.onicecandidate = (e) => { if (e.candidate) send({ type: "rtc_ice", to: msg.streamerId, candidate: e.candidate }); };
        viewerPcRef.current = pc;
        (async () => {
          await pc.setRemoteDescription(msg.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ type: "rtc_answer", streamerId: msg.streamerId, sdp: answer });
        })().catch(() => {});
      }
      // ICE from the other side — route to whichever peer connection applies.
      if (msg.type === "rtc_ice" && typeof msg.from === "number" && msg.candidate) {
        const streamerPc = pcMapRef.current.get(msg.from);
        if (streamerPc) streamerPc.addIceCandidate(msg.candidate).catch(() => {});
        else viewerPcRef.current?.addIceCandidate(msg.candidate).catch(() => {});
      }
      // Streamer: a viewer left — tear down their peer connection.
      if (msg.type === "viewer_gone" && typeof msg.viewerId === "number") {
        pcMapRef.current.get(msg.viewerId)?.close();
        pcMapRef.current.delete(msg.viewerId);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (mountedRef.current) setTimeout(connect, 3000);
    };
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (liveStreamerIdRef.current) wsRef.current?.send(JSON.stringify({ type: "stop_stream" }));
      if (watchingIdRef.current) wsRef.current?.send(JSON.stringify({ type: "leave_stream", streamerId: watchingIdRef.current }));
      stopLocalMedia();
      closeStreamerPeers();
      viewerPcRef.current?.close();
      wsRef.current?.close();
    };
  }, [connect]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  // Attach the local screen-share preview once the live view is mounted.
  useEffect(() => {
    if (mode === "live" && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [mode, hasVideo]);

  const watchStream = (streamerId: number) => {
    setHasBoosted(false);
    send({ type: "watch_stream", streamerId });
  };

  const boostStreamer = () => {
    if (!watching || hasBoosted) return;
    setHasBoosted(true);
    send({ type: "stream_boost", streamerId: watching.streamerId });
  };

  const adminEndStream = (streamerId: number) => {
    send({ type: "admin_end_stream", streamerId });
  };

  const restartLiveGame = () => setLiveGameKey(k => k + 1);

  const stopWatching = () => {
    if (watchingIdRef.current) send({ type: "leave_stream", streamerId: watchingIdRef.current });
    viewerPcRef.current?.close();
    viewerPcRef.current = null;
    watchingIdRef.current = null;
    setRemoteActive(false);
    setWatching(null);
    setChat([]);
    setMode("browse");
    send({ type: "get_streams" });
  };

  const goLive = async () => {
    setGoingLive(true);
    let displayStream: MediaStream | null = null;
    let micStream: MediaStream | null = null;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch { /* screen share cancelled/denied */ }
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch { /* mic denied */ }
    setGoingLive(false);

    const tracks: MediaStreamTrack[] = [
      ...(displayStream ? displayStream.getVideoTracks() : []),
      ...(micStream ? micStream.getAudioTracks() : []),
    ];
    const combined = new MediaStream(tracks);
    localStreamRef.current = combined;
    setMicEnabled(!!micStream);
    setHasVideo(!!displayStream);
    setSessionGems(0);
    // If the streamer stops sharing, just drop the video — the stream keeps going.
    displayStream?.getVideoTracks().forEach((t) => { t.onended = () => setHasVideo(false); });

    const game = GAME_MODES.find(g => g.id === liveGameId);
    send({ type: "start_stream", gameId: liveGameId, gameName: game?.name || liveGameId });
    setChat([]);
    setLiveGameKey(k => k + 1);
    setMode("live");
  };

  const toggleMic = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    tracks.forEach((t) => { t.enabled = !t.enabled; });
    setMicEnabled(tracks.length > 0 ? tracks[0].enabled : false);
  };

  const endStream = () => {
    send({ type: "stop_stream" });
    stopLocalMedia();
    closeStreamerPeers();
    liveStreamerIdRef.current = null;
    setIsLive(false);
    setHasVideo(false);
    setMicEnabled(false);
    setMode("browse");
    setChat([]);
    send({ type: "get_streams" });
  };

  const sendChat = () => {
    const text = chatInput.trim();
    const sid = mode === "live" ? liveStreamerIdRef.current : watchingIdRef.current;
    if (!text || sid == null) return;
    send({ type: "stream_chat", streamerId: sid, text });
    setChatInput("");
  };

  const ChatPanel = (
    <Card className="p-3 border-border flex flex-col h-[420px]">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-purple-500" />
        <span className="font-bold text-sm">Live Chat</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {chat.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-8">No messages yet — say hi! 👋</p>
        ) : chat.map((m, i) => (
          <div key={i} className="text-sm break-words">
            <span className="font-bold text-purple-500">{m.from}: </span>
            <span>{m.text}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="flex gap-2 mt-2">
        <Input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
          placeholder="Be kind! 💜"
          maxLength={140}
          data-testid="input-stream-chat"
        />
        <Button size="icon" onClick={sendChat} data-testid="button-send-chat"><Send className="w-4 h-4" /></Button>
      </div>
    </Card>
  );

  // ─── Live (hosting) ──────────────────────────────────────────────────
  if (mode === "live") {
    const game = GAME_MODES.find(g => g.id === liveGameId);
    return (
      <div className="min-h-screen max-w-6xl mx-auto px-4 py-6">
        <Card className="p-3 mb-4 flex items-center justify-between gap-2 bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-red-500 text-white font-bold gap-1 animate-pulse"><Radio className="w-3 h-3" /> LIVE</Badge>
            <span className="font-bold text-sm">Streaming {game?.name}</span>
            {watching && <Badge variant="outline" className="gap-1 text-xs"><Eye className="w-3 h-3" /> {watching.viewerCount}</Badge>}
            <Badge variant={hasVideo ? "secondary" : "outline"} className="gap-1 text-xs"><MonitorUp className="w-3 h-3" /> {hasVideo ? "Screen on" : "No screen"}</Badge>
            <Badge variant="secondary" className="gap-1 text-xs"><Gem className="w-3 h-3 text-cyan-400" /> +{sessionGems} earned</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={micEnabled ? "default" : "outline"} onClick={toggleMic} className="gap-1" data-testid="button-toggle-mic">
              {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />} {micEnabled ? "Mic On" : "Mic Off"}
            </Button>
            <Button size="sm" variant="destructive" onClick={endStream} data-testid="button-end-stream">
              <X className="w-4 h-4 mr-1" /> End Stream
            </Button>
          </div>
        </Card>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Self-preview of exactly what viewers see */}
            <Card className="p-2 border-border bg-black/40">
              {hasVideo ? (
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full rounded-lg bg-black aspect-video" data-testid="video-local-preview" />
              ) : (
                <div className="w-full aspect-video rounded-lg bg-black/60 flex flex-col items-center justify-center text-center px-4">
                  <MonitorUp className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-white/70">You're not sharing your screen — viewers only see your score & chat.</p>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1 px-1">👀 This is your preview — viewers see this exact video + hear your mic.</p>
            </Card>

            {boostFlash && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="text-center font-black text-cyan-500 bg-cyan-500/10 rounded-lg py-2">
                {boostFlash}
              </motion.div>
            )}
            {game && (
              <GamePlayer
                key={liveGameKey}
                game={game}
                onBack={restartLiveGame}
                onComplete={() => restartLiveGame()}
                yearLevel={(user as any)?.yearLevel || 7}
                onScoreChange={(s) => send({ type: "stream_score", score: s })}
                autoLoop
                skipRewardSubmit
              />
            )}
          </div>
          <div>{ChatPanel}</div>
        </div>
      </div>
    );
  }

  // ─── Watching ────────────────────────────────────────────────────────
  if (mode === "watching" && watching) {
    return (
      <div className="min-h-screen max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={stopWatching} data-testid="button-stop-watching">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to streams
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={boostStreamer}
              disabled={hasBoosted}
              className="gap-1 font-bold bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-60"
              data-testid="button-boost"
            >
              <Zap className="w-4 h-4" /> {hasBoosted ? "Boosted!" : "Boost"} <Gem className="w-3 h-3" />
            </Button>
            {isAdmin && (
              <Button size="sm" variant="destructive" onClick={() => adminEndStream(watching.streamerId)} className="gap-1" data-testid="button-admin-end">
                <ShieldX className="w-4 h-4" /> End (Admin)
              </Button>
            )}
          </div>
        </div>
        {boostFlash && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-center font-black text-cyan-500 bg-cyan-500/10 rounded-lg py-2 mb-3">
            {boostFlash}
          </motion.div>
        )}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card className="p-2 border-border bg-black/60 relative overflow-hidden">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full rounded-lg bg-black aspect-video ${remoteActive ? "" : "hidden"}`}
                data-testid="video-remote"
              />
              {!remoteActive && (
                <div className="w-full aspect-video rounded-lg flex flex-col items-center justify-center text-center">
                  <Badge className="bg-red-500 text-white font-bold gap-1 mb-3 animate-pulse"><Radio className="w-3 h-3" /> LIVE</Badge>
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-2">
                    <span className="text-white font-black text-xl">{watching.streamerName.charAt(0).toUpperCase()}</span>
                  </div>
                  <p className="text-white/80 text-sm">Connecting to {watching.streamerName}'s stream…</p>
                  <p className="text-white/40 text-xs mt-1">(If they aren't sharing a screen, you'll just see the score below.)</p>
                </div>
              )}
              {/* score overlay */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <Badge className="bg-black/70 text-white font-bold gap-1"><Gamepad2 className="w-3 h-3" /> {watching.score} pts</Badge>
                <Badge className="bg-black/70 text-white font-bold gap-1"><Eye className="w-3 h-3" /> {watching.viewerCount}</Badge>
              </div>
            </Card>
            <div className="flex items-center gap-2 mt-2 px-1">
              <span className="font-black text-lg">{watching.streamerName}</span>
              <span className="text-sm text-muted-foreground">playing {watching.gameName}</span>
            </div>
          </div>
          <div>{ChatPanel}</div>
        </div>
      </div>
    );
  }

  // ─── Browse ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-3xl font-black flex items-center gap-3">
          <Tv className="w-8 h-8 text-purple-500" /> Live Streams
        </h1>
        <Badge variant={connected ? "default" : "destructive"} className="font-bold">
          {connected ? <><Wifi className="w-3 h-3 mr-1" /> Online</> : <><WifiOff className="w-3 h-3 mr-1" /> Offline</>}
        </Badge>
      </div>

      <Card className="p-5 mb-6 border-border bg-gradient-to-r from-red-500/5 to-orange-500/5">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Radio className="w-4 h-4 text-red-500" /> Go Live</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Stream your gameplay and talk to people watching! When you go live your browser will ask to
          <strong> share a screen/tab</strong> (pick the game) and use your <strong>microphone</strong>.
        </p>
        <div className="flex items-start gap-2 mb-4 text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-amber-700 dark:text-amber-300">
            Stay safe: anyone watching can see your screen and hear your voice. Never share personal info,
            and only show the game. Be kind in chat — admins can end any stream.
          </span>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={liveGameId}
            onChange={(e) => setLiveGameId(e.target.value)}
            className="bg-background border border-border rounded-md px-3 py-2 text-sm font-medium"
            data-testid="select-live-game"
          >
            {GAME_MODES.filter(g => !g.isSecret).map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <Button onClick={goLive} disabled={goingLive} className="font-bold gap-2 bg-red-500 hover:bg-red-600 text-white" data-testid="button-go-live">
            <Radio className="w-4 h-4" /> {goingLive ? "Starting…" : "Go Live"}
          </Button>
        </div>
      </Card>

      <h3 className="font-bold mb-3 flex items-center gap-2"><Eye className="w-4 h-4" /> Watch a Stream ({streams.length})</h3>
      {streams.length === 0 ? (
        <Card className="p-8 text-center border-border">
          <Tv className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold mb-1">Nobody's live right now</p>
          <p className="text-sm text-muted-foreground">Be the first — hit "Go Live" above!</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {streams.map(s => (
              <motion.div key={s.streamerId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card className="p-4 border-border hover:border-purple-500/40 transition-colors" data-testid={`card-stream-${s.streamerId}`}>
                  <div className="flex items-center justify-between mb-3">
                    <Badge className="bg-red-500 text-white font-bold gap-1 text-xs animate-pulse"><Dot className="w-3 h-3 -mx-1" /> LIVE</Badge>
                    <Badge variant="outline" className="gap-1 text-xs"><Eye className="w-3 h-3" /> {s.viewerCount}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <span className="text-white font-bold">{s.streamerName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{s.streamerName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Gamepad2 className="w-3 h-3" /> {s.gameName}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 font-bold gap-2" onClick={() => watchStream(s.streamerId)} data-testid={`button-watch-${s.streamerId}`}>
                      <Eye className="w-4 h-4" /> Watch
                    </Button>
                    {isAdmin && (
                      <Button variant="destructive" size="icon" onClick={() => adminEndStream(s.streamerId)} title="End stream (admin)" data-testid={`button-admin-end-${s.streamerId}`}>
                        <ShieldX className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
