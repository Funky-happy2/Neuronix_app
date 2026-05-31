import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gamepad2, Rocket, Trophy, Sparkles, FlaskConical, Swords, LogIn, UserPlus, Coins, Gift, GraduationCap, Users } from "lucide-react";
import { motion } from "framer-motion";
import { GAME_MODES, BOSS_BATTLES, LAB_EXPERIMENTS } from "@/lib/gameData";
import HumanCheck from "@/components/HumanCheck";

const SESSION_KEY = "nx_verified";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const refCode = params.get("ref") || "";

  const { user, loginMutation, registerMutation } = useAuth();
  const [isLogin, setIsLogin] = useState(!refCode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const honeypotRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);

  if (user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypotRef.current?.value) return;
    if (isLogin && !sessionStorage.getItem(SESSION_KEY)) {
      setShowCaptcha(true);
      return;
    }
    fireAuth();
  };

  const fireAuth = () => {
    if (isLogin) {
      loginMutation.mutate({ username, password }, {
        onSuccess: () => { sessionStorage.setItem(SESSION_KEY, "1"); },
      });
    } else {
      registerMutation.mutate({ username, password, refCode: refCode || undefined, isTeacher } as any, {
        onSuccess: () => { sessionStorage.setItem(SESSION_KEY, "1"); },
      });
    }
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-4">
              <Gamepad2 className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-black">
              <span className="bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500 bg-clip-text text-transparent">
                Neuronix
              </span>
            </h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">
              {isLogin ? "Welcome back, scientist!" : "Create your scientist account!"}
            </p>
          </div>

          {refCode && !isLogin && (
            <div className="mb-4 flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2">
              <Gift className="w-4 h-4 text-purple-500 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-purple-600 dark:text-purple-400">Invite bonus active!</span>
                <span className="text-muted-foreground"> You and the person who invited you will both get </span>
                <span className="font-bold flex-inline items-center gap-0.5"><Coins className="w-3 h-3 inline text-yellow-500" /> 100 coins</span>
                <span className="text-muted-foreground"> when you sign up.</span>
              </div>
            </div>
          )}
          <Card className="p-6 border-border">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Honeypot — invisible to humans, bots fill it automatically */}
              <input ref={honeypotRef} type="text" name="website" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", opacity: 0 }} autoComplete="off" />
              <div className="space-y-2">
                <Label htmlFor="username" className="font-semibold">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={20}
                  data-testid="input-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="font-semibold">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={4}
                  data-testid="input-password"
                />
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label className="font-semibold">I am a...</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsTeacher(false)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-sm font-bold transition-all ${!isTeacher ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400" : "border-border bg-muted/30 text-muted-foreground"}`}
                      data-testid="button-role-student"
                    >
                      <Users className="w-5 h-5" />
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTeacher(true)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-sm font-bold transition-all ${isTeacher ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400" : "border-border bg-muted/30 text-muted-foreground"}`}
                      data-testid="button-role-teacher"
                    >
                      <GraduationCap className="w-5 h-5" />
                      Teacher
                    </button>
                  </div>
                  {isTeacher && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      As a teacher, you can create districts for your students to join. First, join your app on the Districts page!
                    </p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full gap-2 font-bold"
                disabled={isPending}
                data-testid="button-auth-submit"
              >
                {isPending ? (
                  "Loading..."
                ) : isLogin ? (
                  <><LogIn className="w-4 h-4" /> Log In</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Sign Up as {isTeacher ? "Teacher" : "Student"}</>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-sm font-semibold text-purple-500 hover:text-purple-600 dark:text-purple-400"
                onClick={() => setIsLogin(!isLogin)}
                data-testid="button-toggle-auth"
              >
                {isLogin ? "Don't have an account? Sign up!" : "Already have an account? Log in!"}
              </button>
            </div>
          </Card>
        </motion.div>
      </div>
      {showCaptcha && (
        <HumanCheck
          title="One Quick Check!"
          onPass={() => { setShowCaptcha(false); fireAuth(); }}
          onClose={() => setShowCaptcha(false)}
        />
      )}

      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-purple-600/20 via-blue-600/10 to-emerald-600/10 dark:from-purple-600/30 dark:via-blue-600/20 dark:to-emerald-600/10 px-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-md"
        >
          <h2 className="text-3xl font-black mb-6">
            Where Science Feels Like an Arcade Game!
          </h2>
          <div className="space-y-4">
            {[
              { icon: Rocket, text: `${GAME_MODES.length} game modes packed with real science`, color: "text-purple-500 dark:text-purple-400" },
              { icon: Swords, text: `Battle ${BOSS_BATTLES.length} unique science bosses`, color: "text-red-500 dark:text-red-400" },
              { icon: FlaskConical, text: `${LAB_EXPERIMENTS.length} interactive lab experiments`, color: "text-blue-500 dark:text-blue-400" },
              { icon: Trophy, text: "Earn badges, XP, and level up", color: "text-yellow-500 dark:text-yellow-400" },
              { icon: Sparkles, text: "Unlock secret modes and avatars", color: "text-emerald-500 dark:text-emerald-400" },
              { icon: GraduationCap, text: "Join districts and compete with other students!", color: "text-blue-500 dark:text-blue-400" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-background flex items-center justify-center border border-border flex-shrink-0">
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <p className="font-semibold text-sm">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <p className="text-sm font-bold text-muted-foreground mb-3">Featured Games</p>
            <div className="grid grid-cols-2 gap-2">
              {GAME_MODES.slice(0, 6).map(game => (
                <div key={game.id} className={`rounded-lg bg-gradient-to-br ${game.gradient} p-3 text-white`}>
                  <p className="font-black text-xs leading-tight">{game.name}</p>
                  <p className="text-white/70 text-[10px] mt-0.5 line-clamp-1">{game.description}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
