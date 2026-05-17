import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import {
  GraduationCap, School, Users, Plus, LogIn, LogOut, Trophy,
  Zap, BookOpen, Lock, Star, Eye, EyeOff, UserX, Trash2, Settings
} from "lucide-react";

export default function ClassesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isTeacher = (user as any)?.isTeacher;
  const isAdmin = user?.isAdmin;
  const myClassId = (user as any)?.classId;
  const mySchoolId = (user as any)?.schoolId;

  const [showCreateClass, setShowCreateClass] = useState(false);
  const [className, setClassName] = useState("");
  const [classDesc, setClassDesc] = useState("");
  const [classPassword, setClassPassword] = useState("");
  const [showJoinClass, setShowJoinClass] = useState<number | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [viewClassId, setViewClassId] = useState<number | null>(null);
  const [viewScope, setViewScope] = useState<"overall" | "class">("overall");
  const [showTeacherManage, setShowTeacherManage] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);

  const { data: schools = [], isLoading: schoolsLoading } = useQuery<any[]>({
    queryKey: ["/api/schools"],
  });
  const { data: classes = [], isLoading: classesLoading } = useQuery<any[]>({
    queryKey: ["/api/classes"],
  });
  const { data: classDetail, refetch: refetchClassDetail } = useQuery<any>({
    queryKey: ["/api/classes", viewClassId],
    enabled: !!viewClassId,
  });
  const { data: myClassDetail, refetch: refetchMyClassDetail } = useQuery<any>({
    queryKey: ["/api/classes", myClassId, "manage"],
    queryFn: () => apiRequest("GET", `/api/classes/${myClassId}`).then(r => r.json()),
    enabled: !!myClassId && (isTeacher || isAdmin),
  });

  const mySchool = schools.find((s: any) => s.id === mySchoolId);
  const myClass = classes.find((c: any) => c.id === myClassId);
  const isMyClassTeacher = myClass?.teacherId === (user as any)?.id;

  const joinSchoolMutation = useMutation({
    mutationFn: async (schoolId: number) => (await apiRequest("POST", `/api/schools/${schoolId}/join`, {})).json(),
    onSuccess: (_, schoolId) => {
      const school = schools.find((s: any) => s.id === schoolId);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Joined app!", description: `You are now part of ${school?.name}.` });
    },
    onError: () => toast({ title: "Failed to join app", variant: "destructive" }),
  });

  const createClassMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/classes", data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setShowCreateClass(false); setClassName(""); setClassPassword(""); setClassDesc("");
      toast({ title: "District created!", description: "Share the password with your students." });
    },
    onError: (e: any) => toast({ title: "Failed to create district", description: e.message, variant: "destructive" }),
  });

  const joinClassMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) =>
      (await apiRequest("POST", `/api/classes/${id}/join`, { password })).json(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setShowJoinClass(null); setJoinPassword("");
      toast({ title: "Joined!", description: `Welcome to ${data.className}!` });
    },
    onError: () => toast({ title: "Wrong password", variant: "destructive" }),
  });

  const leaveClassMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/classes/${myClassId}/leave`, {})).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Left district", description: "You have left your district." });
    },
  });

  const kickStudentMutation = useMutation({
    mutationFn: async (userId: number) =>
      (await apiRequest("DELETE", `/api/classes/${myClassId}/members/${userId}`, {})).json(),
    onSuccess: () => {
      refetchMyClassDetail();
      toast({ title: "Student removed from district." });
    },
    onError: () => toast({ title: "Failed to remove student", variant: "destructive" }),
  });

  const banStudentMutation = useMutation({
    mutationFn: async (userId: number) =>
      (await apiRequest("POST", `/api/classes/${myClassId}/ban/${userId}`, {})).json(),
    onSuccess: () => {
      refetchMyClassDetail();
      toast({ title: "Student banned from district." });
    },
    onError: () => toast({ title: "Failed to ban student", variant: "destructive" }),
  });

  const unbanStudentMutation = useMutation({
    mutationFn: async (userId: number) =>
      (await apiRequest("POST", `/api/classes/${myClassId}/unban/${userId}`, {})).json(),
    onSuccess: () => {
      refetchMyClassDetail();
      toast({ title: "Student unbanned." });
    },
    onError: () => toast({ title: "Failed to unban student", variant: "destructive" }),
  });

  const deleteClassMutation = useMutation({
    mutationFn: async () => (await apiRequest("DELETE", `/api/classes/${myClassId}`, {})).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setShowTeacherManage(false);
      toast({ title: "District deleted." });
    },
    onError: () => toast({ title: "Failed to delete district", variant: "destructive" }),
  });

  const fetchPassword = async () => {
    try {
      const r = await apiRequest("GET", `/api/classes/${myClassId}/password`);
      const data = await r.json();
      setRevealedPassword(data.password);
    } catch {
      toast({ title: "Could not retrieve password", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Districts</h1>
            <p className="text-sm text-muted-foreground">
              {isTeacher ? "Manage your district and students" : "Join your district to compete with other students!"}
            </p>
          </div>
        </div>

        {/* Teacher: Join a School (if not in one) */}
        {isTeacher && !mySchoolId && (
          <Card className="p-5 border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-orange-500/5 mb-6">
            <h3 className="font-black mb-2 flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <School className="w-4 h-4" /> Join Your App First
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select the school app you belong to. Once joined, you can create districts for your students.
            </p>
            {schoolsLoading ? (
              <p className="text-sm text-muted-foreground">Loading apps...</p>
            ) : schools.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No school apps have been set up yet. Ask your administrator to create yours.</p>
            ) : (
              <div className="space-y-2">
                {schools.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                    <div className="flex items-center gap-2">
                      <School className="w-4 h-4 text-blue-400" />
                      <span className="font-bold text-sm">{s.name}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => joinSchoolMutation.mutate(s.id)}
                      disabled={joinSchoolMutation.isPending}
                      className="font-bold text-xs"
                      data-testid={`button-join-school-${s.id}`}
                    >
                      <LogIn className="w-3 h-3 mr-1" /> Join
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Teacher: Your School badge */}
        {isTeacher && mySchool && (
          <Card className="p-4 border-blue-500/30 bg-blue-500/5 mb-4 flex items-center gap-3">
            <School className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Your App</p>
              <p className="font-black">{mySchool.name}</p>
            </div>
            <Badge className="ml-auto text-xs bg-blue-600 font-bold">Active</Badge>
          </Card>
        )}

        {/* Teacher: Create Class button (only if in a school) */}
        {isTeacher && mySchoolId && (
          <div className="flex gap-3 mb-6">
            <Button
              onClick={() => setShowCreateClass(!showCreateClass)}
              className="gap-2 font-bold"
              data-testid="button-create-class"
            >
              <Plus className="w-4 h-4" /> New District
            </Button>
          </div>
        )}

        {/* Admin: Create School button */}
        {isAdmin && (
          <div className="flex gap-3 mb-6">
            <Button onClick={() => setShowCreateClass(!showCreateClass)} variant="outline" className="gap-2 font-bold hidden" />
          </div>
        )}

        {/* Create Class form */}
        {showCreateClass && isTeacher && mySchoolId && (
          <Card className="p-5 border-purple-500/30 mb-6">
            <h3 className="font-black mb-4 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-500" /> Create District
            </h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold mb-1 block">District Name</Label>
                <Input placeholder="e.g. Year 7 Science" value={className} onChange={e => setClassName(e.target.value)} data-testid="input-class-name" />
              </div>
              <div>
                <Label className="text-xs font-bold mb-1 block">District Password (students will use this)</Label>
                <Input placeholder="Password students will use..." value={classPassword} onChange={e => setClassPassword(e.target.value)} type="text" data-testid="input-class-password" />
              </div>
              <div>
                <Label className="text-xs font-bold mb-1 block">Description (optional)</Label>
                <Input placeholder="e.g. Monday afternoon class" value={classDesc} onChange={e => setClassDesc(e.target.value)} data-testid="input-class-desc" />
              </div>
              <div className="p-2 rounded-md bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
                <School className="w-3 h-3" /> This district will be linked to <strong>{mySchool?.name}</strong>
              </div>
              <Button
                onClick={() => createClassMutation.mutate({ name: className, password: classPassword, description: classDesc, schoolId: mySchoolId })}
                disabled={!className || !classPassword || createClassMutation.isPending}
                className="w-full font-bold"
                data-testid="button-submit-class"
              >
                Create District
              </Button>
            </div>
          </Card>
        )}

        {/* Current class banner */}
        {myClass && (
          <Card className="p-5 border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Your District</p>
                  <h2 className="text-xl font-black">{myClass.name}</h2>
                  {myClass.description && <p className="text-sm text-muted-foreground">{myClass.description}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">Teacher: {myClass.teacherName}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setViewClassId(myClassId); setViewScope("class"); }}
                  data-testid="button-view-class"
                >
                  <Users className="w-3 h-3 mr-1" /> District
                </Button>
                {isMyClassTeacher && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowTeacherManage(!showTeacherManage)}
                    data-testid="button-manage-class"
                    className="border-purple-500/50 text-purple-600 dark:text-purple-400"
                  >
                    <Settings className="w-3 h-3 mr-1" /> Manage
                  </Button>
                )}
                {!isMyClassTeacher && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => leaveClassMutation.mutate()}
                    disabled={leaveClassMutation.isPending}
                    data-testid="button-leave-class"
                  >
                    <LogOut className="w-3 h-3 mr-1" /> Leave District
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Teacher class management panel */}
        {showTeacherManage && isMyClassTeacher && myClassDetail && (
          <Card className="p-5 border-purple-500/30 bg-purple-500/5 mb-6">
            <h3 className="font-black mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-purple-500" /> Manage District: {myClassDetail.name}
            </h3>

            {/* Password reveal */}
            <div className="mb-4 p-3 rounded-lg border border-border bg-background">
              <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Join Password
              </p>
              {revealedPassword ? (
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono font-black bg-muted px-3 py-1.5 rounded">{revealedPassword}</code>
                  <Button size="sm" variant="ghost" onClick={() => setRevealedPassword(null)} className="h-7">
                    <EyeOff className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={fetchPassword} className="font-bold text-xs" data-testid="button-reveal-password">
                  <Eye className="w-3 h-3 mr-1" /> Show Password
                </Button>
              )}
            </div>

            {/* Member list with kick/ban */}
            <div className="mb-4">
              <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" /> District Students ({(myClassDetail.members?.filter((m: any) => m.id !== (user as any)?.id)).length || 0})
              </p>
              {myClassDetail.members?.filter((m: any) => m.id !== (user as any)?.id).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No students in this district yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {myClassDetail.members?.filter((m: any) => m.id !== (user as any)?.id).map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border" data-testid={`row-student-${m.id}`}>
                      <div>
                        <p className="font-bold text-sm">{m.username}</p>
                        <p className="text-xs text-muted-foreground">Level {m.level} · {m.xp?.toLocaleString()} XP</p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => kickStudentMutation.mutate(m.id)}
                          disabled={kickStudentMutation.isPending || banStudentMutation.isPending}
                          className="h-7 text-xs font-bold"
                          data-testid={`button-kick-${m.id}`}
                        >
                          <UserX className="w-3 h-3 mr-1" /> Remove
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => { if (confirm(`Ban ${m.username} from this district?`)) banStudentMutation.mutate(m.id); }}
                          disabled={banStudentMutation.isPending || kickStudentMutation.isPending}
                          className="h-7 text-xs font-bold"
                          data-testid={`button-ban-${m.id}`}
                        >
                          🚫 Ban
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Banned students */}
            {((myClassDetail as any).bannedMembers?.length > 0) && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                  🚫 Banned Students ({(myClassDetail as any).bannedMembers.length})
                </p>
                <div className="space-y-1.5">
                  {(myClassDetail as any).bannedMembers.map((b: { userId: number; username: string }) => (
                    <div key={b.userId} className="flex items-center justify-between p-2 rounded-lg bg-background border border-red-200 dark:border-red-800" data-testid={`row-banned-${b.userId}`}>
                      <p className="font-bold text-sm text-muted-foreground line-through">{b.username}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => unbanStudentMutation.mutate(b.userId)}
                        disabled={unbanStudentMutation.isPending}
                        className="h-7 text-xs font-bold border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                        data-testid={`button-unban-${b.userId}`}
                      >
                        ✅ Unban
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delete class */}
            <div className="pt-3 border-t border-border">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this district? All students will be removed.")) {
                    deleteClassMutation.mutate();
                  }
                }}
                disabled={deleteClassMutation.isPending}
                className="font-bold text-xs"
                data-testid="button-delete-class"
              >
                <Trash2 className="w-3 h-3 mr-1" /> Delete District
              </Button>
            </div>
          </Card>
        )}

        {/* Leaderboard panel */}
        {viewClassId && classDetail && (
          <Card className="p-5 border-border mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                {classDetail.name} - District Leaderboard
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setViewClassId(null)}>✕</Button>
            </div>
            {classDetail.members?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No members yet!</p>
            ) : (
              <div className="space-y-2">
                {classDetail.members
                  ?.sort((a: any, b: any) => b.xp - a.xp)
                  .map((m: any, idx: number) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-sm ${idx === 0 ? "bg-yellow-500 text-black" : idx === 1 ? "bg-gray-400 text-black" : idx === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"}`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{m.username}</p>
                        <p className="text-xs text-muted-foreground">Level {m.level}</p>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-bold text-yellow-600 dark:text-yellow-400">
                        <Zap className="w-3 h-3" /> {m.xp?.toLocaleString()} XP
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        )}

        {/* Scope tabs (students) */}
        {!isTeacher && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setViewScope("overall")}
              className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${viewScope === "overall" ? "bg-purple-500 border-purple-500 text-white" : "border-border text-muted-foreground"}`}
              data-testid="button-scope-overall"
            >
              🌍 Overall
            </button>
            {myClassId && (
              <button
                onClick={() => { setViewScope("class"); setViewClassId(myClassId); }}
                className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${viewScope === "class" ? "bg-blue-500 border-blue-500 text-white" : "border-border text-muted-foreground"}`}
                data-testid="button-scope-class"
              >
                🏫 My District
              </button>
            )}
          </div>
        )}

        {/* Schools & Classes listing */}
        <div className="mb-4">
          <h2 className="text-lg font-black mb-3 flex items-center gap-2">
            <School className="w-5 h-5 text-blue-500" /> Apps & Districts
          </h2>

          {schoolsLoading || classesLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : schools.length === 0 && classes.length === 0 ? (
            <Card className="p-8 text-center border-dashed border-border">
              <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-bold text-muted-foreground">No districts yet!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isTeacher ? "Join your school app first, then create your first district." : "Ask your teacher to create a district for you to join."}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {schools.map((school: any) => {
                const schoolClasses = classes.filter((c: any) => c.schoolId === school.id);
                return (
                  <div key={school.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <School className="w-4 h-4 text-blue-400" />
                      <h3 className="font-black text-sm text-blue-400 uppercase tracking-wide">{school.name}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-4">
                      {schoolClasses.map((cls: any) => (
                        <ClassCard
                          key={cls.id}
                          cls={cls}
                          myClassId={myClassId}
                          showJoinClass={showJoinClass}
                          setShowJoinClass={setShowJoinClass}
                          joinPassword={joinPassword}
                          setJoinPassword={setJoinPassword}
                          joinClassMutation={joinClassMutation}
                          setViewClassId={setViewClassId}
                          isTeacher={isTeacher}
                        />
                      ))}
                      {schoolClasses.length === 0 && <p className="text-xs text-muted-foreground ml-2">No districts in this app yet.</p>}
                    </div>
                  </div>
                );
              })}
              {classes.filter((c: any) => !c.schoolId).length > 0 && (
                <div>
                  {schools.length > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-gray-400" />
                      <h3 className="font-black text-sm text-gray-400 uppercase tracking-wide">Other Districts</h3>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {classes.filter((c: any) => !c.schoolId).map((cls: any) => (
                      <ClassCard
                        key={cls.id}
                        cls={cls}
                        myClassId={myClassId}
                        showJoinClass={showJoinClass}
                        setShowJoinClass={setShowJoinClass}
                        joinPassword={joinPassword}
                        setJoinPassword={setJoinPassword}
                        joinClassMutation={joinClassMutation}
                        setViewClassId={setViewClassId}
                        isTeacher={isTeacher}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ClassCard({ cls, myClassId, showJoinClass, setShowJoinClass, joinPassword, setJoinPassword, joinClassMutation, setViewClassId, isTeacher }: any) {
  const isMyClass = myClassId === cls.id;
  return (
    <Card className={`p-4 border-border ${isMyClass ? "border-blue-500/50 bg-blue-500/5" : ""}`} data-testid={`card-class-${cls.id}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-black">{cls.name}</h4>
          {cls.description && <p className="text-xs text-muted-foreground">{cls.description}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">Teacher: {cls.teacherName}</p>
        </div>
        {isMyClass && <Badge className="text-xs bg-blue-600 font-bold shrink-0">Joined</Badge>}
      </div>
      <div className="flex gap-2 mt-3">
        {isMyClass ? (
          <Button size="sm" variant="outline" className="flex-1 text-xs font-bold" onClick={() => setViewClassId(cls.id)} data-testid={`button-view-${cls.id}`}>
            <Users className="w-3 h-3 mr-1" /> Leaderboard
          </Button>
        ) : isTeacher ? (
          <p className="text-xs text-muted-foreground italic">This is another teacher's district.</p>
        ) : myClassId ? (
          <p className="text-xs text-muted-foreground">Leave your current district to join this one.</p>
        ) : (
          <Button size="sm" variant="outline" className="flex-1 text-xs font-bold" onClick={() => setShowJoinClass(showJoinClass === cls.id ? null : cls.id)} data-testid={`button-join-${cls.id}`}>
            <LogIn className="w-3 h-3 mr-1" /> Join
          </Button>
        )}
      </div>
      {showJoinClass === cls.id && !myClassId && (
        <div className="mt-3 flex gap-2">
          <Input
            type="text"
            placeholder="Enter district password..."
            value={joinPassword}
            onChange={e => setJoinPassword(e.target.value)}
            className="text-xs h-8"
            data-testid={`input-join-password-${cls.id}`}
          />
          <Button
            size="sm"
            onClick={() => joinClassMutation.mutate({ id: cls.id, password: joinPassword })}
            disabled={!joinPassword || joinClassMutation.isPending}
            className="h-8 font-bold text-xs"
            data-testid={`button-confirm-join-${cls.id}`}
          >
            <Lock className="w-3 h-3 mr-1" /> Join
          </Button>
        </div>
      )}
    </Card>
  );
}
