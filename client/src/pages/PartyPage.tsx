import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, UserPlus, Crown, X, Wifi, WifiOff, Gamepad2, Play, ArrowLeft, UserMinus, Check, Loader2
} from "lucide-react";
import { GAME_MODES } from "@/lib/gameData";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import GamePlayer from "@/components/GamePlayer";

interface LobbyPlayer { id: number; username: string; status: string; }
interface Party { id: string; hostId: number; members: { id: number; username: string }[]; pendingInvites: number[]; }
type Difficulty = "easy" | "medium" | "hard";
interface TeamMatchInfo { roomId: string; gameId: string; difficulty: Difficulty; myTeam: number; teams: { name: string; players: { id: number; username: string; isBot: boolean }[] }[]; }
interface TeamResults { teams: { name: string; total: number; players: { id: number; username: string; score: number; isBot: boolean }[] }[]; winningTeam: number; }

export default function PartyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [party, setParty] = useState<Party | null>(null);
  const [invites, setInvites] = useState<{ partyId: string; from: string }[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("gravity-dash");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [teamMatch, setTeamMatch] = useState<TeamMatchInfo | null>(null);
  const [teamResults, setTeamResults] = useState<TeamResults | null>(null);
  const [playingGame, setPlayingGame] = useState<string | null>(null);

  const send = (obj: object) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(obj)); };

  const connect = useCallback(() => {
    if (!user) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "join_lobby", userId: user.id, username: user.username }));
      ws.send(JSON.stringify({ type: "get_party" }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "lobby_update") setPlayers(msg.players.filter((p: LobbyPlayer) => p.id !== user.id));
      if (msg.type === "party_update") setParty(msg.party);
      if (msg.type === "party_invite_received") {
        setInvites((prev) => prev.some((i) => i.partyId === msg.partyId) ? prev : [...prev, { partyId: msg.partyId, from: msg.from }]);
        toast({ title: "Party invite!", description: `${msg.from} invited you to their party.` });
      }
      if (msg.type === "party_disbanded") { setParty(null); toast({ title: "Party disbanded", description: msg.reason }); }
      if (msg.type === "party_kicked") { setParty(null); toast({ title: "Removed from party", description: "The host removed you.", variant: "destructive" }); }
      if (msg.type === "party_error") toast({ title: "Party", description: msg.message, variant: "destructive" });
      if (msg.type === "team_match_found") {
        setTeamMatch({ roomId: msg.roomId, gameId: msg.gameId, difficulty: msg.difficulty, myTeam: msg.myTeam, teams: msg.teams });
        setTeamResults(null);
        setPlayingGame(msg.gameId);
      }
      if (msg.type === "team_results") { setTeamResults({ teams: msg.teams, winningTeam: msg.winningTeam }); setPlayingGame(null); }
    };
    ws.onclose = () => { setConnected(false); if (mountedRef.current) setTimeout(connect, 3000); };
  }, [user, toast]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => { mountedRef.current = false; wsRef.current?.close(); };
  }, [connect]);

  const isHost = !!party && party.hostId === user?.id;

  const invitePlayer = (id: number) => send({ type: "party_invite", targetId: id });
  const acceptInvite = (partyId: string) => { send({ type: "party_accept", partyId }); setInvites((p) => p.filter((i) => i.partyId !== partyId)); };
  const declineInvite = (partyId: string) => { send({ type: "party_decline", partyId }); setInvites((p) => p.filter((i) => i.partyId !== partyId)); };
  const leaveParty = () => { send({ type: "party_leave" }); setParty(null); };
  const kick = (id: number) => send({ type: "party_kick", targetId: id });
  const playTogether = () => send({ type: "party_queue", gameId: selectedGameId, difficulty });
  const submitTeamScore = (score: number) => { if (teamMatch) send({ type: "team_game_score", roomId: teamMatch.roomId, score }); };
  const leaveMatch = () => { if (teamMatch) send({ type: "team_game_score", roomId: teamMatch.roomId, score: 0 }); setTeamMatch(null); setPlayingGame(null); };

  // ─── Results ─────────────────────────────────────────────────────────
  if (teamResults) {
    const myTeamIdx = teamMatch?.myTeam ?? 0;
    const won = teamResults.winningTeam === myTeamIdx;
    const draw = teamResults.winningTeam === -1;
    return (
      <div className="min-h-screen max-w-4xl mx-auto px-4 py-8 flex items-center justify-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className="p-8 max-w-lg mx-auto text-center border-border">
            <Users className={`w-16 h-16 mx-auto mb-4 ${won ? "text-yellow-500" : draw ? "text-orange-500" : "text-blue-500"}`} />
            <h2 className="text-2xl font-black mb-6">{won ? "Your Party Won! 🎉" : draw ? "It's a Tie!" : "Good Effort, Party!"}</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {teamResults.teams.map((t, i) => (
                <div key={i} className={`p-4 rounded-md ${i === myTeamIdx ? "bg-purple-500/10 border border-purple-500/30" : "bg-muted"}`}>
                  <p className="font-bold text-sm mb-1">{t.name}</p>
                  <p className="text-3xl font-black text-purple-500">{t.total}</p>
                  <div className="mt-2 space-y-0.5">
                    {t.players.map((p) => (
                      <p key={p.id} className="text-xs text-muted-foreground truncate">{p.username}{p.isBot ? " 🤖" : ""}: {p.score}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={() => { setTeamResults(null); setTeamMatch(null); }} className="font-bold gap-2"><ArrowLeft className="w-4 h-4" /> Back to Party</Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ─── Playing together ────────────────────────────────────────────────
  if (playingGame && teamMatch) {
    const game = GAME_MODES.find((g) => g.id === playingGame);
    if (game) {
      return (
        <div className="min-h-screen">
          <div className="max-w-4xl mx-auto px-4 py-2">
            <Card className="p-3 mb-4 flex items-center justify-between gap-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="font-bold text-sm">Party Match — play for your party!</span>
                <Badge variant="secondary" className="text-xs capitalize">{teamMatch.difficulty}</Badge>
              </div>
              <Button size="sm" variant="outline" onClick={leaveMatch}><X className="w-4 h-4" /></Button>
            </Card>
          </div>
          <GamePlayer game={game} onBack={leaveMatch} onComplete={(score) => submitTeamScore(score)} yearLevel={(user as any)?.yearLevel || 7} forcedDifficulty={teamMatch.difficulty} skipRewardSubmit />
        </div>
      );
    }
  }

  // ─── Party management ────────────────────────────────────────────────
  return (
    <div className="min-h-screen max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-3xl font-black flex items-center gap-3"><Users className="w-8 h-8 text-purple-500" /> Party</h1>
        <Badge variant={connected ? "default" : "destructive"} className="font-bold">
          {connected ? <><Wifi className="w-3 h-3 mr-1" /> Online</> : <><WifiOff className="w-3 h-3 mr-1" /> Offline</>}
        </Badge>
      </div>

      <AnimatePresence>
        {invites.map((inv) => (
          <motion.div key={inv.partyId} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="p-4 mb-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30 flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold flex items-center gap-2"><UserPlus className="w-4 h-4 text-purple-500" /> {inv.from} invited you to their party!</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => acceptInvite(inv.partyId)} className="font-bold gap-1"><Check className="w-3 h-3" /> Join</Button>
                <Button size="sm" variant="outline" onClick={() => declineInvite(inv.partyId)}>Decline</Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Current party */}
        <Card className="p-5 border-border">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Your Party</h3>
          {!party ? (
            <div className="text-center py-6">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">You're not in a party yet</p>
              <p className="text-sm text-muted-foreground mt-1">Invite an online player to start one! 🎉</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {party.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 p-2.5 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">{m.username[0].toUpperCase()}</div>
                      <span className="font-bold text-sm">{m.username}{m.id === user?.id ? " (You)" : ""}</span>
                      {m.id === party.hostId && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    {isHost && m.id !== user?.id && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 text-xs" onClick={() => kick(m.id)}><UserMinus className="w-3.5 h-3.5" /></Button>
                    )}
                  </div>
                ))}
                {party.pendingInvites.length > 0 && <p className="text-xs text-muted-foreground">{party.pendingInvites.length} invite(s) pending…</p>}
              </div>
              {isHost && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-bold text-muted-foreground">Play together:</p>
                  <select value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-medium" data-testid="select-party-game">
                    {GAME_MODES.filter((g) => !g.isSecret).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <div className="flex gap-1.5">
                    {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                      <Button key={d} size="sm" variant={difficulty === d ? "default" : "outline"} className="flex-1 font-bold capitalize text-xs" onClick={() => setDifficulty(d)}>{d}</Button>
                    ))}
                  </div>
                  <Button onClick={playTogether} className="w-full font-bold gap-2" data-testid="button-play-together"><Play className="w-4 h-4" /> Play Together</Button>
                </div>
              )}
              <Button variant="outline" onClick={leaveParty} className="w-full mt-3 font-bold gap-2 text-red-500 border-red-500/30" data-testid="button-leave-party"><X className="w-4 h-4" /> Leave Party</Button>
            </>
          )}
        </Card>

        {/* Invite online players */}
        <Card className="p-5 border-border">
          <h3 className="font-bold mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Invite Players ({players.length})</h3>
          {players.length === 0 ? (
            <div className="text-center py-6">
              <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No other players online</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {players.map((p) => {
                const inParty = party?.members.some((m) => m.id === p.id);
                const invited = party?.pendingInvites.includes(p.id);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-2.5 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">{p.username[0].toUpperCase()}</div>
                      <span className="font-bold text-sm">{p.username}</span>
                    </div>
                    <Button size="sm" variant="outline" className="font-bold gap-1 text-xs" disabled={!!inParty || !!invited || (!!party && !isHost)} onClick={() => invitePlayer(p.id)} data-testid={`button-invite-${p.id}`}>
                      <UserPlus className="w-3 h-3" /> {inParty ? "In party" : invited ? "Invited" : "Invite"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">Only the host can invite and start matches. Invite up to 3 friends (party of 4).</p>
        </Card>
      </div>
    </div>
  );
}
