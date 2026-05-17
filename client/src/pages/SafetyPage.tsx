import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Lock, Eye, MessageSquare,
  UserX, Database, CheckCircle, Settings, Users,
  ToggleLeft, ToggleRight, AlertTriangle, School
} from "lucide-react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useSafety, SAFETY_KEYS, SAFETY_LABELS, SAFETY_DEFAULTS, type SafetyKey } from "@/hooks/use-safety";
import { useToast } from "@/hooks/use-toast";

const safetyItems = [
  {
    icon: UserX,
    title: "No Personal Data",
    description: "We never ask for your name, email, address, or any personal information. Play freely without worrying about privacy!",
    color: "text-purple-500 dark:text-purple-400",
    bg: "bg-purple-500/10 dark:bg-purple-500/15",
  },
  {
    icon: MessageSquare,
    title: "Safe Group Chat Only",
    description: "Chat is limited to your own clan and team — small groups you've chosen to join. There is no direct messaging, no contact with strangers, and no public chat rooms.",
    color: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-500/10 dark:bg-blue-500/15",
  },
  {
    icon: Database,
    title: "Secure Data Storage",
    description: "All progress is stored securely. No information is sold or shared with third parties. Your data belongs to you!",
    color: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
  },
  {
    icon: Eye,
    title: "No External Links",
    description: "Neuronix never links to outside websites. Everything you need is right here in a fully contained environment.",
    color: "text-orange-500 dark:text-orange-400",
    bg: "bg-orange-500/10 dark:bg-orange-500/15",
  },
  {
    icon: ShieldCheck,
    title: "Age-Appropriate Content",
    description: "All content is designed and reviewed for ages 9–13. Science games, quizzes, and challenges — nothing harmful.",
    color: "text-rose-500 dark:text-rose-400",
    bg: "bg-rose-500/10 dark:bg-rose-500/15",
  },
  {
    icon: Lock,
    title: "No In-App Purchases",
    description: "Neuronix is completely free to play. There are no real-money purchases, loot boxes, or pay-to-win mechanics.",
    color: "text-cyan-500 dark:text-cyan-400",
    bg: "bg-cyan-500/10 dark:bg-cyan-500/15",
  },
  {
    icon: Settings,
    title: "Customisable Safety Controls",
    description: "Students, parents, and teachers can all customise which features are visible. Focus Mode hides all social features in one tap.",
    color: "text-violet-500 dark:text-violet-400",
    bg: "bg-violet-500/10 dark:bg-violet-500/15",
  },
  {
    icon: Users,
    title: "Teacher-Controlled Districts",
    description: "Teachers can lock safety settings for their whole district. Students cannot override a teacher-enforced restriction.",
    color: "text-teal-500 dark:text-teal-400",
    bg: "bg-teal-500/10 dark:bg-teal-500/15",
  },
];

export default function SafetyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { effective, isLocked, classSafe } = useSafety();
  const isTeacher = (user as any)?.isTeacher;
  const myClassId = (user as any)?.classId;
  const isMyClassTeacher = !!(user as any)?.isTeacher && myClassId;

  const [classTab, setClassTab] = useState<"class">("class");

  const updatePersonalSafety = useMutation({
    mutationFn: async (settings: Partial<Record<SafetyKey, boolean>>) =>
      (await apiRequest("PATCH", "/api/user/safety", settings)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Safety settings saved!" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const updateClassSafety = useMutation({
    mutationFn: async (payload: Partial<Record<SafetyKey, boolean>> & { locked?: string[] }) =>
      (await apiRequest("PATCH", `/api/classes/${myClassId}/safety`, payload)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "District safety updated!" });
    },
    onError: () => toast({ title: "Failed to update district safety", variant: "destructive" }),
  });

  const personalSettings = ((user as any)?.safetySettings || {}) as Partial<Record<SafetyKey, boolean>>;
  const classSettings = ((user as any)?.classSafetySettings || {}) as Partial<Record<SafetyKey, boolean>> & { locked?: string[] };
  const classLocked: string[] = classSettings.locked || [];

  const togglePersonal = (key: SafetyKey) => {
    if (isLocked(key)) return;
    const current = personalSettings[key] ?? SAFETY_DEFAULTS[key];
    updatePersonalSafety.mutate({ [key]: !current });
  };

  const toggleClass = (key: SafetyKey) => {
    const current = (classSettings[key] ?? SAFETY_DEFAULTS[key]) as boolean;
    updateClassSafety.mutate({ [key]: !current });
  };

  const toggleClassLock = (key: SafetyKey) => {
    const currentLocked = [...classLocked];
    const idx = currentLocked.indexOf(key);
    if (idx >= 0) currentLocked.splice(idx, 1);
    else currentLocked.push(key);
    updateClassSafety.mutate({ locked: currentLocked });
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 max-w-4xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

        {/* Hero */}
        <Card className="p-6 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-black">Built Safe for Kids</h1>
                <Badge className="bg-emerald-600 text-white text-xs">Verified Safe</Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Neuronix is built with kids' safety at its core. We follow strict guidelines to ensure every
                player has a safe, fun, and educational experience. No personal data is ever collected, and
                all content is carefully designed for young learners aged 9–13.
              </p>
            </div>
          </div>
        </Card>

        {/* Safety info cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          {safetyItems.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Card className="p-5 border-border h-full" data-testid={`card-safety-${i}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-md ${item.bg} flex items-center justify-center flex-shrink-0`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm mb-1 flex items-center gap-1.5">
                      {item.title}
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Personal safety controls */}
        {user && (
          <Card className="p-6 border-border mt-4">
            <h2 className="font-black text-lg flex items-center gap-2 mb-1">
              <Settings className="w-5 h-5 text-purple-500" /> My Safety Controls
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Turn features on or off for your own account.
              {classLocked.length > 0 && " Some settings are locked by your teacher."}
            </p>
            <div className="space-y-3">
              {SAFETY_KEYS.map(key => {
                const { label, description } = SAFETY_LABELS[key];
                const locked = isLocked(key);
                const on = effective[key];
                const personalOn = personalSettings[key] ?? SAFETY_DEFAULTS[key];
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-4 rounded-lg border ${locked ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-muted/20"}`}
                    data-testid={`safety-row-${key}`}
                  >
                    <div className="flex-1 pr-3">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm">{label}</p>
                        {locked && (
                          <Badge className="text-[9px] bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 px-1.5 py-0 font-bold">
                            <Lock className="w-2.5 h-2.5 mr-0.5" /> Teacher Set
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    </div>
                    <button
                      onClick={() => togglePersonal(key)}
                      disabled={locked || updatePersonalSafety.isPending}
                      className={`shrink-0 transition-opacity ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      data-testid={`toggle-personal-${key}`}
                      title={locked ? "Locked by your teacher" : on ? "Turn off" : "Turn on"}
                    >
                      {on ? (
                        <ToggleRight className="w-8 h-8 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Teacher class safety controls */}
        {isTeacher && myClassId && (
          <Card className="p-6 border-purple-500/30 bg-purple-500/5 mt-4">
            <h2 className="font-black text-lg flex items-center gap-2 mb-1">
              <School className="w-5 h-5 text-purple-500" /> District Safety Controls
            </h2>
            <p className="text-sm text-muted-foreground mb-2">
              Set safety rules for your entire district. Enable a toggle to enforce it for all students.
              Lock it to prevent students from changing it back.
            </p>
            <div className="flex items-center gap-2 mb-5 p-2.5 rounded-lg bg-background border border-border text-xs text-muted-foreground">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              Locked settings cannot be changed by students. Unlocked district settings are defaults students can still override.
            </div>
            <div className="space-y-3">
              {SAFETY_KEYS.map(key => {
                const { label, description } = SAFETY_LABELS[key];
                const classOn = (classSettings[key] ?? SAFETY_DEFAULTS[key]) as boolean;
                const locked = classLocked.includes(key);
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-4 rounded-lg border ${classOn ? "border-purple-500/30 bg-purple-500/5" : "border-border bg-muted/10"}`}
                    data-testid={`class-safety-row-${key}`}
                  >
                    <div className="flex-1 pr-3">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm">{label}</p>
                        {locked && (
                          <Badge className="text-[9px] bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 px-1.5 py-0 font-bold">
                            <Lock className="w-2.5 h-2.5 mr-0.5" /> Locked
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleClassLock(key)}
                        disabled={updateClassSafety.isPending}
                        className={`p-1.5 rounded-md border text-xs font-bold transition-colors ${locked ? "bg-orange-500/20 border-orange-500/30 text-orange-600 dark:text-orange-400" : "border-border text-muted-foreground hover:text-foreground"}`}
                        title={locked ? "Unlock (students can change)" : "Lock (students cannot change)"}
                        data-testid={`lock-class-${key}`}
                      >
                        <Lock className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => toggleClass(key)}
                        disabled={updateClassSafety.isPending}
                        className="cursor-pointer"
                        data-testid={`toggle-class-${key}`}
                      >
                        {classOn ? (
                          <ToggleRight className="w-8 h-8 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Footer note */}
        <Card className="p-6 border-border text-center">
          <h3 className="font-bold mb-2">Questions or Concerns?</h3>
          <p className="text-sm text-muted-foreground">
            If a parent or teacher has questions about our safety measures, all settings above can be adjusted
            at any time. Teacher-enforced district rules can only be changed by the teacher from this page.
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
