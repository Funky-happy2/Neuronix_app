import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy, Users, Loader2, ArrowLeft, Zap, Swords, Shield,
  Crown, Timer, Star, Medal, Award, Target, TrendingUp, Flame, CheckCircle, XCircle
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useState, useEffect, useRef, useMemo } from "react";
import { DISTRICTS, DISTRICT_BATTLE_TYPES } from "@/lib/gameData";
import { useLocation } from "wouter";

const DISTRICT_QUESTIONS = [
  { question: "What is the centre of an atom called?", options: ["Electron cloud", "Shell", "Nucleus", "Orbital"], correctIndex: 2 },
  { question: "What does a seismograph measure?", options: ["Wind", "Temperature", "Earthquakes", "Rainfall"], correctIndex: 2 },
  { question: "What is the largest internal organ?", options: ["Heart", "Liver", "Stomach", "Lungs"], correctIndex: 1 },
  { question: "What colour does litmus paper turn in acid?", options: ["Blue", "Green", "Red", "Yellow"], correctIndex: 2 },
  { question: "What is the nearest star to Earth?", options: ["Polaris", "Sirius", "Alpha Centauri", "The Sun"], correctIndex: 3 },
  { question: "What connects bones to other bones?", options: ["Tendons", "Ligaments", "Muscles", "Cartilage"], correctIndex: 1 },
  { question: "What is the chemical symbol for sodium?", options: ["So", "Sd", "Na", "S"], correctIndex: 2 },
  { question: "What type of animal is a whale?", options: ["Fish", "Reptile", "Mammal", "Amphibian"], correctIndex: 2 },
  { question: "What device converts sound into electrical signals?", options: ["Speaker", "Microphone", "Amplifier", "Antenna"], correctIndex: 1 },
  { question: "What is the freezing point of water?", options: ["-10°C", "0°C", "10°C", "32°C"], correctIndex: 1 },
  { question: "How many legs does an arachnid have?", options: ["4", "6", "8", "10"], correctIndex: 2 },
  { question: "What is the outer layer of the Earth called?", options: ["Mantle", "Core", "Crust", "Magma"], correctIndex: 2 },
  { question: "What pigment makes leaves green?", options: ["Melanin", "Carotene", "Chlorophyll", "Haemoglobin"], correctIndex: 2 },
  { question: "What is the formula for calculating speed?", options: ["Force × Mass", "Distance ÷ Time", "Mass × Volume", "Energy ÷ Power"], correctIndex: 1 },
  { question: "Which planet spins on its side?", options: ["Neptune", "Venus", "Uranus", "Saturn"], correctIndex: 2 },
  { question: "What is the main component of natural gas?", options: ["Propane", "Ethane", "Methane", "Butane"], correctIndex: 2 },
  { question: "What structure in the ear helps with balance?", options: ["Eardrum", "Cochlea", "Semicircular canals", "Stapes"], correctIndex: 2 },
  { question: "What is lava called when it's still underground?", options: ["Basalt", "Magma", "Obsidian", "Granite"], correctIndex: 1 },
  { question: "What is the smallest particle of an element?", options: ["Molecule", "Atom", "Cell", "Electron"], correctIndex: 1 },
  { question: "Which sense is controlled by the olfactory nerve?", options: ["Sight", "Touch", "Smell", "Hearing"], correctIndex: 2 },
  { question: "What is the main function of the large intestine?", options: ["Digest protein", "Absorb water", "Produce bile", "Filter blood"], correctIndex: 1 },
  { question: "What state of matter is plasma?", options: ["Solid", "Liquid", "Gas", "Fourth state"], correctIndex: 3 },
  { question: "How long does Earth take to orbit the Sun?", options: ["24 hours", "30 days", "365.25 days", "28 days"], correctIndex: 2 },
  { question: "What is the chemical formula for carbon dioxide?", options: ["CO", "CO₂", "C₂O", "CH₄"], correctIndex: 1 },
  { question: "What animal has the largest brain?", options: ["Elephant", "Human", "Sperm whale", "Dolphin"], correctIndex: 2 },
  { question: "What type of mirror curves inward?", options: ["Convex", "Flat", "Concave", "Prism"], correctIndex: 2 },
  { question: "What is the process of rocks breaking down called?", options: ["Erosion", "Weathering", "Deposition", "Sedimentation"], correctIndex: 1 },
  { question: "How many valves does the human heart have?", options: ["2", "3", "4", "6"], correctIndex: 2 },
  { question: "What is the chemical symbol for potassium?", options: ["Po", "Pt", "P", "K"], correctIndex: 3 },
  { question: "What protects Earth from solar radiation?", options: ["Clouds", "Ozone layer", "Moon", "Ocean"], correctIndex: 1 },
  { question: "What is the longest bone in the body?", options: ["Humerus", "Tibia", "Femur", "Fibula"], correctIndex: 2 },
  { question: "What is the pH of pure water?", options: ["0", "5", "7", "14"], correctIndex: 2 },
  { question: "What organ produces insulin?", options: ["Liver", "Kidney", "Pancreas", "Stomach"], correctIndex: 2 },
  { question: "What causes the Northern Lights?", options: ["Moonlight", "Meteor showers", "Charged particles from Sun", "Volcanic gases"], correctIndex: 2 },
  { question: "What is a group of fish called?", options: ["Flock", "Pack", "School", "Herd"], correctIndex: 2 },
  { question: "What is the hardest substance in the human body?", options: ["Bone", "Tooth enamel", "Cartilage", "Nail"], correctIndex: 1 },
  { question: "What element do all organic molecules contain?", options: ["Oxygen", "Nitrogen", "Carbon", "Hydrogen"], correctIndex: 2 },
  { question: "What is the speed of sound in air approximately?", options: ["34 m/s", "343 m/s", "3,430 m/s", "34,300 m/s"], correctIndex: 1 },
  { question: "Which blood type is the universal donor?", options: ["A", "B", "AB", "O negative"], correctIndex: 3 },
  { question: "What planet has the strongest gravity?", options: ["Earth", "Mars", "Jupiter", "Saturn"], correctIndex: 2 },
  { question: "What gas do we breathe out most?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Water vapour"], correctIndex: 2 },
  { question: "What is the name of the supercontinent that existed 200 million years ago?", options: ["Gondwana", "Laurasia", "Pangaea", "Rodinia"], correctIndex: 2 },
  { question: "What part of the plant absorbs water from soil?", options: ["Stem", "Leaves", "Roots", "Flowers"], correctIndex: 2 },
  { question: "What is the unit of electrical current?", options: ["Volt", "Ohm", "Watt", "Ampere"], correctIndex: 3 },
  { question: "What mineral do bones need to stay strong?", options: ["Iron", "Zinc", "Calcium", "Sodium"], correctIndex: 2 },
];

const EVENT_ICONS: Record<string, any> = {
  "district-quiz-war": Swords,
  "district-speed-clash": Zap,
  "district-survival-siege": Shield,
  "district-champion-cup": Crown,
  "district-speed-king": Timer,
  "grand-district-showdown": Trophy,
};

function getDistrictInfo(id: string) {
  return DISTRICTS.find(d => d.id === id) || { name: id, emoji: "🏠", color: "from-gray-400 to-gray-500" };
}

type BattleTab = "vs" | "internal" | "grand";

export default function DistrictBattlesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<BattleTab>("vs");
  const [expandedBattle, setExpandedBattle] = useState<number | null>(null);
  const [playingBattle, setPlayingBattle] = useState<any | null>(null);

  const { data, isLoading } = useQuery<{ battles: any[]; userDistrict: string | null; month: string }>({
    queryKey: ["/api/district-battles"],
  });

  const submitMutation = useMutation({
    mutationFn: async ({ battleId, score }: { battleId: number; score: number }) => {
      const res = await apiRequest("POST", `/api/district-battles/${battleId}/submit`, { score });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Score Submitted!", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/district-battles"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading-district-battles">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const battles = data?.battles || [];
  const userDistrict = data?.userDistrict;

  const vsBattles = battles.filter(b => b.battleType === "vs");
  const internalBattles = battles.filter(b => b.battleType === "internal");
  const grandBattles = battles.filter(b => b.battleType === "grand");

  const myVsBattles = vsBattles.filter(b => b.district1 === userDistrict || b.district2 === userDistrict);
  const myInternalBattles = internalBattles.filter(b => b.district1 === userDistrict);

  const tabs: { key: BattleTab; label: string; icon: any; count: number }[] = [
    { key: "vs", label: "District vs District", icon: Swords, count: myVsBattles.length },
    { key: "internal", label: "Internal Battles", icon: Crown, count: myInternalBattles.length },
    { key: "grand", label: "Grand District", icon: Trophy, count: grandBattles.length },
  ];

  function handlePlayBattle(battle: any) {
    setPlayingBattle(battle);
  }

  function handleQuizFinish(score: number) {
    if (playingBattle) {
      submitMutation.mutate({ battleId: playingBattle.id, score });
      setPlayingBattle(null);
    }
  }

  if (playingBattle) {
    return (
      <DistrictQuiz
        battle={playingBattle}
        onFinish={handleQuizFinish}
        onBack={() => setPlayingBattle(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/grand-tournament")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Swords className="w-7 h-7 text-red-500" /> District Battles
          </h1>
          <p className="text-sm text-muted-foreground">
            {userDistrict ? `Your District: ${getDistrictInfo(userDistrict).emoji} ${getDistrictInfo(userDistrict).name}` : "Set your year level to join!"}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "outline"}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 whitespace-nowrap"
              data-testid={`button-tab-${tab.key}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <Badge variant="secondary" className="ml-1">{tab.count}</Badge>
            </Button>
          );
        })}
      </div>

      {activeTab === "vs" && (
        <VsDistrictSection
          battles={myVsBattles}
          allBattles={vsBattles}
          userDistrict={userDistrict}
          onPlay={handlePlayBattle}
          isPending={submitMutation.isPending}
          expandedBattle={expandedBattle}
          setExpandedBattle={setExpandedBattle}
        />
      )}
      {activeTab === "internal" && (
        <InternalSection
          battles={myInternalBattles}
          userDistrict={userDistrict}
          onPlay={handlePlayBattle}
          isPending={submitMutation.isPending}
          expandedBattle={expandedBattle}
          setExpandedBattle={setExpandedBattle}
        />
      )}
      {activeTab === "grand" && (
        <GrandDistrictSection
          battles={grandBattles}
          userDistrict={userDistrict}
          onPlay={handlePlayBattle}
          isPending={submitMutation.isPending}
        />
      )}
    </div>
  );
}

function VsDistrictSection({ battles, allBattles, userDistrict, onPlay, isPending, expandedBattle, setExpandedBattle }: any) {
  const eventGroups: Record<string, any[]> = {};
  for (const b of battles) {
    if (!eventGroups[b.eventId]) eventGroups[b.eventId] = [];
    eventGroups[b.eventId].push(b);
  }

  const allEvents = DISTRICT_BATTLE_TYPES.vsDistrict;

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold flex items-center justify-center gap-2">
          <Swords className="w-5 h-5 text-red-500" /> District vs District
        </h2>
        <p className="text-sm text-muted-foreground">Your district battles against rival districts! Combined scores decide the winner!</p>
      </div>

      {allEvents.map(evt => {
        const Icon = EVENT_ICONS[evt.id] || Swords;
        const evtBattles = eventGroups[evt.id] || [];

        return (
          <Card key={evt.id} className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold" data-testid={`text-vs-event-${evt.id}`}>{evt.name}</h3>
                <p className="text-xs text-muted-foreground">{evt.description}</p>
              </div>
            </div>

            <div className="space-y-3">
              {evtBattles.map((battle: any) => {
                const d1 = getDistrictInfo(battle.district1);
                const d2 = getDistrictInfo(battle.district2);
                const isExpanded = expandedBattle === battle.id;
                const participants = battle.participants || [];
                const hasPlayed = participants.some((p: any) => p.district === userDistrict);

                return (
                  <motion.div
                    key={battle.id}
                    className="border rounded-lg p-3 hover:border-primary/30 transition-colors"
                    data-testid={`card-vs-battle-${battle.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <div className={`px-2 py-1 rounded text-xs font-bold bg-gradient-to-r ${d1.color} text-white`}>
                          {d1.emoji} {d1.name}
                        </div>
                        <span className="text-lg font-bold text-muted-foreground">vs</span>
                        <div className={`px-2 py-1 rounded text-xs font-bold bg-gradient-to-r ${d2.color} text-white`}>
                          {d2.emoji} {d2.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-center">
                          <div className="text-lg font-bold" data-testid={`text-score-${battle.id}`}>
                            {battle.district1Score} - {battle.district2Score}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {battle.district1Players}v{battle.district2Players}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => onPlay(battle)}
                          disabled={isPending}
                          data-testid={`button-play-vs-${battle.id}`}
                        >
                          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flame className="w-3 h-3 mr-1" />}
                          {hasPlayed ? "Retry" : "Play"}
                        </Button>
                      </div>
                    </div>

                    {participants.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs"
                        onClick={() => setExpandedBattle(isExpanded ? null : battle.id)}
                        data-testid={`button-expand-${battle.id}`}
                      >
                        {isExpanded ? "Hide" : "Show"} Participants ({participants.length})
                      </Button>
                    )}

                    {isExpanded && (
                      <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                        {participants.sort((a: any, b: any) => b.score - a.score).map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/50">
                            <span className="flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${p.district === battle.district1 ? 'bg-blue-500' : 'bg-red-500'}`} />
                              {p.username}
                            </span>
                            <span className="font-mono font-bold">{p.score}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
              {evtBattles.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No battles available for your district in this event.</p>
              )}
            </div>
          </Card>
        );
      })}

      <Card className="p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" /> All District Matchups
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {allBattles.filter((b: any) => b.eventId === "district-quiz-war").map((b: any) => {
            const d1 = getDistrictInfo(b.district1);
            const d2 = getDistrictInfo(b.district2);
            const leading = b.district1Score > b.district2Score ? "d1" : b.district2Score > b.district1Score ? "d2" : "tie";
            return (
              <div key={b.id} className="flex items-center gap-2 text-xs border rounded p-2" data-testid={`card-matchup-${b.id}`}>
                <span className={leading === "d1" ? "font-bold" : ""}>{d1.emoji} {d1.name}</span>
                <span className="font-mono">{b.district1Score}-{b.district2Score}</span>
                <span className={leading === "d2" ? "font-bold" : ""}>{d2.emoji} {d2.name}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function InternalSection({ battles, userDistrict, onPlay, isPending, expandedBattle, setExpandedBattle }: any) {
  const allEvents = DISTRICT_BATTLE_TYPES.internal;

  if (!userDistrict) {
    return (
      <Card className="p-8 text-center">
        <Crown className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-bold text-lg">Set Your Year Level</h3>
        <p className="text-sm text-muted-foreground">Go to your profile and set a year level (3-8) to join district battles!</p>
      </Card>
    );
  }

  const distInfo = getDistrictInfo(userDistrict);

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold flex items-center justify-center gap-2">
          <Crown className="w-5 h-5 text-yellow-500" /> {distInfo.emoji} {distInfo.name} Internal Battles
        </h2>
        <p className="text-sm text-muted-foreground">Compete against others in your own district to become the champion!</p>
      </div>

      {allEvents.map(evt => {
        const Icon = EVENT_ICONS[evt.id] || Crown;
        const battle = battles.find((b: any) => b.eventId === evt.id);
        if (!battle) return null;

        const participants = (battle.participants || []).sort((a: any, b: any) => b.score - a.score);
        const topPlayers = (battle.topPlayers || []).slice(0, 10);
        const isExpanded = expandedBattle === battle.id;
        const hasPlayed = participants.some((p: any) => p.district === userDistrict);

        return (
          <Card key={evt.id} className="p-4" data-testid={`card-internal-${evt.id}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <h3 className="font-bold">{evt.name}</h3>
                  <p className="text-xs text-muted-foreground">{evt.description}</p>
                </div>
              </div>
              <Button
                onClick={() => onPlay(battle)}
                disabled={isPending}
                data-testid={`button-play-internal-${battle.id}`}
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4 mr-1" />}
                {hasPlayed ? "Retry" : "Play"}
              </Button>
            </div>

            <div className="flex items-center gap-4 text-sm mb-3">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span>{battle.district1Players} players</span>
              </div>
              <div className="flex items-center gap-1">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span>Total: {battle.district1Score}</span>
              </div>
            </div>

            {topPlayers.length > 0 && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs mb-2"
                  onClick={() => setExpandedBattle(isExpanded ? null : battle.id)}
                  data-testid={`button-expand-internal-${battle.id}`}
                >
                  {isExpanded ? "Hide" : "Show"} Leaderboard
                </Button>
                {isExpanded && (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {topPlayers.map((p: any, i: number) => {
                      const medals = ["🥇", "🥈", "🥉"];
                      return (
                        <div key={i} className={`flex items-center justify-between text-sm px-3 py-2 rounded ${i < 3 ? "bg-yellow-500/10" : "bg-muted/30"}`}>
                          <span className="flex items-center gap-2">
                            <span className="w-6 text-center font-bold">{i < 3 ? medals[i] : `#${i + 1}`}</span>
                            <span>{p.username}</span>
                          </span>
                          <span className="font-mono font-bold text-primary">{p.score}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function GrandDistrictSection({ battles, userDistrict, onPlay, isPending }: any) {
  const grandBattle = battles[0];
  if (!grandBattle) {
    return (
      <Card className="p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-bold text-lg">Grand District Tournament</h3>
        <p className="text-sm text-muted-foreground">Coming soon!</p>
      </Card>
    );
  }

  const topPlayers = (grandBattle.topPlayers || []) as any[];
  const byDistrict: Record<string, any[]> = {};
  for (const p of topPlayers) {
    if (!byDistrict[p.district]) byDistrict[p.district] = [];
    byDistrict[p.district].push(p);
  }

  const districtScores = DISTRICTS.map(d => {
    const players = byDistrict[d.id] || [];
    const totalScore = players.reduce((s: number, p: any) => s + p.score, 0);
    return { ...d, players, totalScore, playerCount: players.length };
  }).sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold flex items-center justify-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" /> Grand District Showdown
        </h2>
        <p className="text-sm text-muted-foreground">Top 5 players from each district battle for the ultimate crown!</p>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" /> Play & Submit Your Score
          </h3>
          <Button
            onClick={() => onPlay(grandBattle)}
            disabled={isPending || !userDistrict}
            data-testid="button-play-grand"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4 mr-1" />}
            Play Now
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Submit your best score. You must be in the top 5 of your district's internal battles to qualify!
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" /> District Rankings
        </h3>
        <div className="space-y-3">
          {districtScores.map((d, i) => {
            const medals = ["🥇", "🥈", "🥉"];
            return (
              <div key={d.id} className={`border rounded-lg p-3 ${i < 3 ? "border-yellow-500/30 bg-yellow-500/5" : ""}`} data-testid={`card-grand-district-${d.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{i < 3 ? medals[i] : `#${i + 1}`}</span>
                    <div className={`px-2 py-1 rounded text-xs font-bold bg-gradient-to-r ${d.color} text-white`}>
                      {d.emoji} {d.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{d.totalScore}</div>
                    <div className="text-[10px] text-muted-foreground">{d.playerCount}/5 players</div>
                  </div>
                </div>
                {d.players.length > 0 && (
                  <div className="grid grid-cols-5 gap-1 mt-2">
                    {d.players.map((p: any, j: number) => (
                      <div key={j} className="text-center text-[10px] bg-muted/40 rounded p-1">
                        <div className="font-bold truncate">{p.username}</div>
                        <div className="text-muted-foreground">{p.score}</div>
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 5 - d.players.length) }).map((_, j) => (
                      <div key={`empty-${j}`} className="text-center text-[10px] bg-muted/20 rounded p-1 border border-dashed border-muted-foreground/20">
                        <div className="text-muted-foreground">???</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {topPlayers.length > 0 && (
        <Card className="p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Medal className="w-5 h-5 text-yellow-500" /> Overall Top Players
          </h3>
          <div className="space-y-1">
            {topPlayers.slice(0, 15).map((p: any, i: number) => {
              const dInfo = getDistrictInfo(p.district);
              const medals = ["🥇", "🥈", "🥉"];
              return (
                <div key={i} className={`flex items-center justify-between text-sm px-3 py-2 rounded ${i < 3 ? "bg-yellow-500/10" : "bg-muted/30"}`} data-testid={`row-grand-player-${i}`}>
                  <span className="flex items-center gap-2">
                    <span className="w-6 text-center font-bold">{i < 3 ? medals[i] : `#${i + 1}`}</span>
                    <span>{p.username}</span>
                    <span className="text-[10px] text-muted-foreground">{dInfo.emoji}{dInfo.name}</span>
                  </span>
                  <span className="font-mono font-bold text-primary">{p.score}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function DistrictQuiz({ battle, onFinish, onBack }: { battle: any; onFinish: (score: number) => void; onBack: () => void }) {
  const questions = useMemo(() => {
    const shuffled = [...DISTRICT_QUESTIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 8);
  }, []);

  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [finished, setFinished] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef(Date.now());

  const shuffledOptions = useMemo(() => {
    const q = questions[currentQ];
    if (!q) return [];
    const indexed = q.options.map((opt, i) => ({ text: opt, originalIndex: i }));
    return indexed.sort(() => Math.random() - 0.5);
  }, [currentQ, questions]);

  useEffect(() => {
    if (finished) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setAnswered(-1);
          setTimeout(() => nextQuestion(), 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentQ, finished]);

  const nextQuestion = () => {
    setAnswered(null);
    if (currentQ + 1 >= questions.length) {
      setFinished(true);
      clearInterval(timerRef.current);
    } else {
      setCurrentQ(prev => prev + 1);
      setTimeLeft(15);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    if (answered !== null) return;
    const originalIndex = shuffledOptions[optionIndex].originalIndex;
    setAnswered(optionIndex);
    clearInterval(timerRef.current);
    const correct = originalIndex === questions[currentQ].correctIndex;
    if (correct) {
      const basePoints = 20;
      const comboBonus = combo * 5;
      const timeBonus = Math.floor(timeLeft * 2);
      setScore(prev => prev + basePoints + comboBonus + timeBonus);
      setCombo(prev => prev + 1);
      setCorrectCount(prev => prev + 1);
    } else {
      setCombo(0);
    }
    setTimeout(() => nextQuestion(), 1200);
  };

  useEffect(() => {
    if (finished) {
      onFinish(score);
    }
  }, [finished]);

  if (finished) {
    const totalTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
    return (
      <div className="max-w-md mx-auto p-4">
        <Card className="p-8 text-center space-y-4">
          <Swords className="w-16 h-16 mx-auto text-red-500" />
          <h2 className="text-2xl font-black" data-testid="text-quiz-complete">Battle Complete!</h2>
          <div className="text-3xl font-black text-primary" data-testid="text-final-score">{score} pts</div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>{correctCount}/{questions.length} correct in {totalTime}s</div>
          </div>
          <p className="text-xs text-muted-foreground">Submitting your score...</p>
        </Card>
      </div>
    );
  }

  const q = questions[currentQ];
  if (!q) return null;
  const timerPct = (timeLeft / 15) * 100;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-quit-quiz">
          <ArrowLeft className="w-4 h-4 mr-1" /> Quit
        </Button>
        <Badge variant="outline" className="font-bold" data-testid="text-question-progress">
          {currentQ + 1}/{questions.length}
        </Badge>
        <div className="text-right">
          <div className="text-lg font-black text-primary" data-testid="text-live-score">{score}</div>
          {combo > 1 && <div className="text-xs text-orange-500 font-bold">{combo}x combo!</div>}
        </div>
      </div>

      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ${timeLeft <= 5 ? "bg-red-500" : timeLeft <= 10 ? "bg-yellow-500" : "bg-green-500"}`}
          style={{ width: `${timerPct}%` }}
        />
      </div>
      <div className="text-center text-sm font-bold" data-testid="text-timer">
        {timeLeft}s
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-center mb-6" data-testid="text-question">
          {q.question}
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {shuffledOptions.map((opt, i) => {
            const isCorrect = opt.originalIndex === q.correctIndex;
            const isSelected = answered === i;
            const showResult = answered !== null;
            let btnClass = "w-full text-left p-4 rounded-lg border-2 font-medium transition-all ";
            if (showResult && isCorrect) {
              btnClass += "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
            } else if (showResult && isSelected && !isCorrect) {
              btnClass += "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
            } else if (!showResult) {
              btnClass += "border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer";
            } else {
              btnClass += "border-border opacity-50";
            }
            return (
              <button
                key={i}
                className={btnClass}
                onClick={() => handleAnswer(i)}
                disabled={answered !== null}
                data-testid={`button-option-${i}`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{opt.text}</span>
                  {showResult && isCorrect && <CheckCircle className="w-5 h-5 text-green-500 ml-auto shrink-0" />}
                  {showResult && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500 ml-auto shrink-0" />}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
