import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sun, Moon, Volume2, VolumeX, LogOut, Sparkles, Rocket, Palette, Eye, EyeOff, Gem, Globe, BookOpen } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation, LANGUAGES, setLanguage } from "@/lib/i18n";

interface SettingsPageProps {
  isMuted: boolean;
  onToggleMute: () => void;
}

function useCosmeticToggle(key: string, defaultEnabled = true) {
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored !== null ? stored === "true" : defaultEnabled;
  });
  const toggle = (val: boolean) => {
    setEnabled(val);
    localStorage.setItem(key, String(val));
    window.dispatchEvent(new Event("cosmetic-settings-changed"));
  };
  return [enabled, toggle] as const;
}

export default function SettingsPage({ isMuted, onToggleMute }: SettingsPageProps) {
  const { logoutMutation } = useAuth();
  const { t, lang } = useTranslation();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });

  const [followersEnabled, setFollowersEnabled] = useCosmeticToggle("cosmetic-followers", true);
  const [decorationsEnabled, setDecorationsEnabled] = useCosmeticToggle("cosmetic-decorations", true);
  const [badgeStylesEnabled, setBadgeStylesEnabled] = useCosmeticToggle("cosmetic-badge-styles", true);
  const [themesEnabled, setThemesEnabled] = useCosmeticToggle("cosmetic-themes", true);
  const [gemUpgradesEnabled, setGemUpgradesEnabled] = useCosmeticToggle("cosmetic-gem-upgrades", true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const allEnabled = followersEnabled && decorationsEnabled && badgeStylesEnabled && themesEnabled && gemUpgradesEnabled;
  const toggleAll = () => {
    const newVal = !allEnabled;
    setFollowersEnabled(newVal);
    setDecorationsEnabled(newVal);
    setBadgeStylesEnabled(newVal);
    setThemesEnabled(newVal);
    setGemUpgradesEnabled(newVal);
  };

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">{t("settings.appearance")}</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span className="text-sm font-semibold">{darkMode ? t("settings.darkMode") : t("settings.lightMode")}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDarkMode(!darkMode)}
              data-testid="button-toggle-theme"
            >
              {darkMode ? t("settings.switchLight") : t("settings.switchDark")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">{t("settings.language")}</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold">{LANGUAGES.find(l => l.code === lang)?.name || "English"}</span>
            </div>
            <Select value={lang} onValueChange={(val) => setLanguage(val as any)} data-testid="select-language">
              <SelectTrigger className="w-[160px]" data-testid="select-language-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => (
                  <SelectItem key={l.code} value={l.code} data-testid={`select-language-${l.code}`}>
                    {l.flag} {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">{t("settings.sound")}</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="text-sm font-semibold">{isMuted ? t("settings.soundOff") : t("settings.soundOn")}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleMute}
              data-testid="button-toggle-sound"
            >
              {isMuted ? t("settings.unmute") : t("settings.mute")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">{t("settings.cosmetics")}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAll}
              className="text-xs gap-1.5 h-7"
              data-testid="button-toggle-all-cosmetics"
            >
              {allEnabled ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {allEnabled ? t("settings.disableAll") : t("settings.enableAll")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            {t("settings.cosmeticDesc")}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold">{t("settings.mouseFollowers")}</span>
            </div>
            <Switch
              checked={followersEnabled}
              onCheckedChange={setFollowersEnabled}
              data-testid="switch-toggle-followers"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-semibold">{t("settings.decorations")}</span>
            </div>
            <Switch
              checked={decorationsEnabled}
              onCheckedChange={setDecorationsEnabled}
              data-testid="switch-toggle-decorations"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-semibold">{t("settings.badgeStyles")}</span>
            </div>
            <Switch
              checked={badgeStylesEnabled}
              onCheckedChange={setBadgeStylesEnabled}
              data-testid="switch-toggle-badge-styles"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold">{t("settings.themes")}</span>
            </div>
            <Switch
              checked={themesEnabled}
              onCheckedChange={setThemesEnabled}
              data-testid="switch-toggle-themes"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gem className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold">{t("settings.gemUpgrades")}</span>
            </div>
            <Switch
              checked={gemUpgradesEnabled}
              onCheckedChange={setGemUpgradesEnabled}
              data-testid="switch-toggle-gem-upgrades"
            />
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            {t("settings.gemDesc")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">{t("settings.account")}</h2>
          <div className="flex items-center gap-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              className="gap-2"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" /> {t("settings.logout")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                localStorage.removeItem("tutorial-done");
                window.dispatchEvent(new Event("tutorial-reset"));
              }}
              className="gap-2"
              data-testid="button-replay-tutorial"
            >
              <BookOpen className="w-4 h-4" /> {t("settings.replayTutorial")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
