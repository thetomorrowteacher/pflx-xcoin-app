"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import {
  User, Task, Job, Checkpoint, Project,
  mockTasks, mockJobs, mockCheckpoints, mockUsers, mockProjects,
  COIN_CATEGORIES, RewardCoin, getMockCohorts,
  isHostUser,
} from "../../lib/data";
import { saveCheckpoints, saveTasks, saveJobs, saveProjects } from "../../lib/store";
import { saveAndToast } from "../../lib/saveToast";
import { playClick, playNav, playSuccess, playError, playDelete, playModalOpen, playModalClose } from "../../lib/sounds";
import { compressBannerImage } from "../../lib/imageUtils";

// ── Helpers ──────────────────────────────────────────────────────────────────

const cpDays = (cp: Checkpoint) => {
  const ms = new Date(cp.endDate).getTime() - new Date(cp.startDate).getTime();
  return Math.max(1, Math.round(ms / 86400000));
};

const statusColor = (s: string) => {
  if (s === "active")   return { bg: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.4)",  text: "#22c55e" };
  if (s === "upcoming") return { bg: "rgba(79,142,247,0.15)", border: "rgba(79,142,247,0.4)", text: "#4f8ef7" };
  return                        { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.15)", text: "rgba(255,255,255,0.4)" };
};

const pill = (label: string, c: { bg: string; border: string; text: string }) => ({
  display: "inline-flex" as const, alignItems: "center" as const,
  padding: "3px 12px", borderRadius: "20px",
  background: c.bg, border: `1px solid ${c.border}`, color: c.text,
  fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" as const,
});

// ── Modal overlay ─────────────────────────────────────────────────────────────
const ModalBG = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div onClick={onClose} style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
    zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
  }}>
    <div onClick={e => e.stopPropagation()} style={{
      background: "linear-gradient(135deg, #0c0c1e 0%, #0a0a16 100%)",
      border: "1px solid rgba(79,142,247,0.25)", borderRadius: "20px",
      maxWidth: "680px", width: "100%", maxHeight: "90vh", overflow: "auto",
      boxShadow: "0 0 60px rgba(79,142,247,0.15)",
    }}>
      {children}
    </div>
  </div>
);

// ── Field ─────────────────────────────────────────────────────────────────────
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</p>
    {children}
  </div>
);

const inputSx: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
  color: "white", fontSize: "14px", fontWeight: 500, outline: "none",
  boxSizing: "border-box",
};

// ─────────────────────────────────────────────────────────────────────────────

export default function TaskManagement() {
  const router = useRouter();
  const [user, setUser]           = useState<User | null>(null);
  const [tab, setTab]             = useState<"checkpoints" | "tasks" | "jobs" | "projects">("checkpoints");
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([...mockCheckpoints]);
  const [tasks, setTasks]         = useState<Task[]>([...mockTasks]);
  const [jobs, setJobs]           = useState<Job[]>([...mockJobs]);

  // Checkpoint modal
  const [cpModal, setCpModal]     = useState(false);
  const [editingCP, setEditingCP] = useState<Partial<Checkpoint> & { bannerImage?: string }>({});
  const [cpTaskIds, setCpTaskIds] = useState<string[]>([]);
  const bannerRef                 = useRef<HTMLInputElement>(null);

  // Task modal
  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task>>({});
  const [taskBadges, setTaskBadges] = useState<{ name: string; xc: number }[]>([]);
  const [taskLinks, setTaskLinks] = useState<string[]>([""]);
  const [badgeDropdownOpen, setBadgeDropdownOpen] = useState(false);
  const [badgeSearch, setBadgeSearch] = useState("");

  // Job modal
  const [jobModal, setJobModal]   = useState(false);
  const [editingJob, setEditingJob] = useState<Partial<Job>>({});

  // Project state
  const [projects, setProjects]   = useState<Project[]>([...mockProjects]);
  const [projectModal, setProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project>>({});
  const [projTaskIds, setProjTaskIds] = useState<string[]>([]);
  const [projJobIds, setProjJobIds] = useState<string[]>([]);

  // Checkpoint project selection
  const [cpProjectIds, setCpProjectIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (!isHostUser(u)) { router.push("/player/dashboard"); return; }
    setUser(u);
  }, [router]);

  if (!user) return null;

  // ── Checkpoint handlers ───────────────────────────────────────────────────

  const openNewCP = () => {
    playClick();
    setEditingCP({ status: "upcoming", startDate: "", endDate: "", assignTo: "all" });
    setCpTaskIds([]);
    setCpProjectIds([]);
    setCpModal(true);
  };

  const openEditCP = (cp: Checkpoint) => {
    playClick();
    setEditingCP({ ...cp });
    setCpTaskIds(tasks.filter(t => t.roundId === cp.id).map(t => t.id));
    setCpProjectIds((cp as any).projectIds ?? []);
    setCpModal(true);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressBannerImage(file);
    console.log(`[task-mgmt] Banner compressed: ${(compressed.length / 1024).toFixed(1)}KB`);
    setEditingCP(prev => ({ ...prev, bannerImage: compressed }));
  };

  const toggleCpTask = (taskId: string) => {
    setCpTaskIds(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
  };

  const handleSaveCP = () => {
    if (!editingCP.name?.trim()) { playError(); return; }

    const isNew = !editingCP.id;
    const cpId  = editingCP.id || `cp_${Date.now()}`;

    // Expand project tasks/jobs into the checkpoint task list
    const projectExpandedTaskIds = new Set<string>(cpTaskIds);
    cpProjectIds.forEach(projId => {
      const proj = mockProjects.find(p => p.id === projId);
      if (proj) {
        proj.taskIds.forEach(tid => projectExpandedTaskIds.add(tid));
        // Note: jobs are referenced separately; we only add tasks to roundId
      }
    });
    const finalTaskIds = Array.from(projectExpandedTaskIds);

    const saved: Checkpoint = {
      id: cpId,
      name: editingCP.name || "Untitled Checkpoint",
      description: editingCP.description || "",
      startDate: editingCP.startDate || "",
      endDate: editingCP.endDate || "",
      status: (editingCP.status as Checkpoint["status"]) || "upcoming",
      assignTo: editingCP.assignTo || "all",
      bannerImage: editingCP.bannerImage,
      projectIds: cpProjectIds,
    } as Checkpoint;

    if (isNew) {
      setCheckpoints(prev => [...prev, saved]);
      mockCheckpoints.push(saved);
    } else {
      setCheckpoints(prev => prev.map(c => c.id === cpId ? saved : c));
      const idx = mockCheckpoints.findIndex(c => c.id === cpId);
      if (idx >= 0) mockCheckpoints[idx] = saved;
    }

    // Sync task roundIds (including tasks expanded from selected projects)
    const updatedTasks = tasks.map(t => ({
      ...t,
      roundId: finalTaskIds.includes(t.id) ? cpId : (t.roundId === cpId ? undefined : t.roundId),
    }));
    setTasks(updatedTasks);
    updatedTasks.forEach((t, i) => { mockTasks[i] = t; });

    playSuccess();
    saveAndToast([saveCheckpoints, saveTasks], "Checkpoint saved to cloud ✓");
    setCpModal(false);
  };

  const handleDeleteCP = (cpId: string) => {
    playDelete();
    setCheckpoints(prev => prev.filter(c => c.id !== cpId));
    const idx = mockCheckpoints.findIndex(c => c.id === cpId);
    if (idx >= 0) mockCheckpoints.splice(idx, 1);
    setTasks(prev => prev.map(t => t.roundId === cpId ? { ...t, roundId: undefined } : t));
    saveAndToast([saveCheckpoints, saveTasks], "Checkpoint deleted — saved to cloud ✓");
  };

  // ── Task handlers ─────────────────────────────────────────────────────────

  const openNewTask = () => {
    playClick();
    setEditingTask({ xpValue: 100, cohort: "all" });
    setTaskBadges([]);
    setTaskLinks([""]);
    setBadgeSearch("");
    setBadgeDropdownOpen(false);
    setTaskModal(true);
  };

  const openEditTask = (task: Task) => {
    playClick();
    setEditingTask({ ...task });
    // Parse existing badges from coinType (legacy single) or rewardCoins (multi)
    if ((task as any).rewardBadges?.length) {
      setTaskBadges((task as any).rewardBadges);
    } else if (task.coinType) {
      const coin = allCoinsFlat.find(c => c.name === task.coinType);
      setTaskBadges([{ name: task.coinType, xc: coin?.xc || task.xpValue || 100 }]);
    } else {
      setTaskBadges([]);
    }
    // Parse links
    if ((task as any).links?.length) {
      setTaskLinks([...(task as any).links, ""]);
    } else if (task.link) {
      setTaskLinks([task.link, ""]);
    } else {
      setTaskLinks([""]);
    }
    setBadgeSearch("");
    setBadgeDropdownOpen(false);
    setTaskModal(true);
  };

  const handleSaveTask = () => {
    if (!editingTask.title?.trim()) { playError(); return; }
    const isNew = !editingTask.id;
    const cleanLinks = taskLinks.filter(l => l.trim());
    const totalXC = taskBadges.reduce((sum, b) => sum + b.xc, 0) || (editingTask.xpValue || 100);
    const saved: Task = {
      id: editingTask.id || `task_${Date.now()}`,
      title: editingTask.title || "",
      description: editingTask.description || "",
      coinType: taskBadges[0]?.name || "",  // backward compat: first badge
      xpValue: totalXC,
      rewardBadges: taskBadges,  // multi-badge array
      cohort: editingTask.cohort || "all",
      status: (editingTask.status as Task["status"]) || "active",
      roundId: editingTask.roundId,
      link: cleanLinks[0] || "",
      links: cleanLinks,
    } as Task;
    if (isNew) { setTasks(prev => [...prev, saved]); mockTasks.push(saved); }
    else {
      setTasks(prev => prev.map(t => t.id === saved.id ? saved : t));
      const idx = mockTasks.findIndex(t => t.id === saved.id);
      if (idx >= 0) mockTasks[idx] = saved;
    }
    playSuccess();
    saveAndToast([saveTasks], "Task saved to cloud ✓");
    setTaskModal(false);
  };

  // ── Job handlers ──────────────────────────────────────────────────────────

  const openNewJob = () => {
    playClick();
    setEditingJob({ coinType: "", xpValue: 500, cohort: "all" });
    setJobModal(true);
  };

  const handleSaveJob = () => {
    if (!editingJob.title?.trim()) { playError(); return; }
    const isNew = !editingJob.id;
    const saved: Job = {
      id: editingJob.id || `job_${Date.now()}`,
      title: editingJob.title || "",
      description: editingJob.description || "",
      coinType: editingJob.coinType || "",
      xpValue: editingJob.xpValue || 500,
      cohort: editingJob.cohort || "all",
      status: (editingJob.status as Job["status"]) || "open",
    } as Job;
    if (isNew) { setJobs(prev => [...prev, saved]); mockJobs.push(saved); }
    else {
      setJobs(prev => prev.map(j => j.id === saved.id ? saved : j));
      const idx = mockJobs.findIndex(j => j.id === saved.id);
      if (idx >= 0) mockJobs[idx] = saved;
    }
    playSuccess();
    saveAndToast([saveJobs], "Job saved to cloud ✓");
    setJobModal(false);
  };

  // ── Project handlers ──────────────────────────────────────────────────────

  const openNewProject = () => {
    playClick();
    setEditingProject({ status: "active", assignedTo: "all", xcRewardPool: 0 });
    setProjTaskIds([]);
    setProjJobIds([]);
    setProjectModal(true);
  };

  const openEditProject = (p: Project) => {
    playClick();
    setEditingProject({ ...p });
    setProjTaskIds([...p.taskIds]);
    setProjJobIds([...p.jobIds]);
    setProjectModal(true);
  };

  const handleSaveProject = () => {
    if (!editingProject.title?.trim()) { playError(); return; }
    const isNew = !editingProject.id;
    const saved: Project = {
      id: editingProject.id || `proj_${Date.now()}`,
      title: editingProject.title || "",
      description: editingProject.description || "",
      status: (editingProject.status as Project["status"]) || "active",
      taskIds: projTaskIds,
      jobIds: projJobIds,
      createdBy: user?.id || "admin-1",
      createdAt: editingProject.createdAt || new Date().toISOString().slice(0, 10),
      dueDate: editingProject.dueDate,
      assignedTo: editingProject.assignedTo || "all",
      xcRewardPool: editingProject.xcRewardPool || 0,
    };
    if (isNew) { setProjects(prev => [...prev, saved]); mockProjects.push(saved); }
    else {
      setProjects(prev => prev.map(p => p.id === saved.id ? saved : p));
      const idx = mockProjects.findIndex(p => p.id === saved.id);
      if (idx >= 0) mockProjects[idx] = saved;
    }
    playSuccess();
    saveAndToast([saveProjects], "Project saved to cloud ✓");
    setProjectModal(false);
  };

  const handleDeleteProject = (projId: string) => {
    playDelete();
    setProjects(prev => prev.filter(p => p.id !== projId));
    const idx = mockProjects.findIndex(p => p.id === projId);
    if (idx >= 0) mockProjects.splice(idx, 1);
    saveAndToast([saveProjects], "Project deleted — saved to cloud ✓");
  };

  const cohorts = getMockCohorts();
  const allCoins: RewardCoin[] = COIN_CATEGORIES.flatMap(c => c.coins);
  const allCoinsFlat = COIN_CATEGORIES.flatMap(cat => cat.coins.map(c => ({ ...c, category: cat.name })));

  // ── Shared styles ─────────────────────────────────────────────────────────

  const cardSx: React.CSSProperties = {
    background: "rgba(10,10,26,0.9)", border: "1px solid rgba(79,142,247,0.12)",
    borderRadius: "16px", overflow: "hidden",
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
  };

  const tabBtnSx = (active: boolean): React.CSSProperties => ({
    padding: "10px 24px", borderRadius: "10px", border: "none", cursor: "pointer",
    fontWeight: 700, fontSize: "13px", letterSpacing: "0.05em",
    background: active ? "rgba(79,142,247,0.2)" : "transparent",
    color: active ? "#4f8ef7" : "rgba(255,255,255,0.4)",
    borderBottom: active ? "2px solid #4f8ef7" : "2px solid transparent",
    transition: "all 0.2s",
  });

  const addBtnSx: React.CSSProperties = {
    padding: "10px 20px", background: "rgba(79,142,247,0.15)",
    border: "1px solid rgba(79,142,247,0.4)", borderRadius: "10px",
    color: "#4f8ef7", fontWeight: 700, fontSize: "13px", cursor: "pointer",
    display: "flex", alignItems: "center", gap: "6px",
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#06090d", fontFamily: "'Inter', sans-serif" }}>
      <SideNav user={user} />

      <main style={{ flex: 1, padding: "32px 40px", overflow: "auto", paddingBottom: "80px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em",
            background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))"
          }}>📋 TASK MANAGEMENT</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>[ CONFIGURE CHECKPOINTS, ASSIGN TASKS & MANAGE JOBS ]</p>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "28px",
          background: "rgba(255,255,255,0.03)", borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.06)", padding: "4px", width: "fit-content" }}>
          {(["checkpoints", "tasks", "jobs", "projects"] as const).map(t => (
            <button key={t} onClick={() => { playNav(); setTab(t); }} style={tabBtnSx(tab === t)}>
              {t === "checkpoints" ? "🏁 CHECKPOINTS" : t === "tasks" ? "✅ TASKS" : t === "jobs" ? "💼 JOBS" : "🗂 PROJECTS"}
            </button>
          ))}
        </div>

        {/* ══════════════════ CHECKPOINTS TAB ══════════════════ */}
        {tab === "checkpoints" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                {checkpoints.length} checkpoint{checkpoints.length !== 1 ? "s" : ""} configured
              </p>
              <button onClick={openNewCP} style={addBtnSx}>＋ New Checkpoint</button>
            </div>

            {checkpoints.length === 0 ? (
              <div style={{ ...cardSx, padding: "60px", textAlign: "center" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏁</div>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "16px", margin: 0 }}>No checkpoints yet. Create your first one.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
                {checkpoints.map(cp => {
                  const sc = statusColor(cp.status);
                  const assignedCount = tasks.filter(t => t.roundId === cp.id).length;
                  return (
                    <div key={cp.id} style={{ ...cardSx, cursor: "pointer" }} onClick={() => openEditCP(cp)}>
                      {/* Banner */}
                      {cp.bannerImage ? (
                        <div style={{ width: "100%", height: "140px", overflow: "hidden" }}>
                          <img src={cp.bannerImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ) : (
                        <div style={{ width: "100%", height: "80px", background: "linear-gradient(135deg, rgba(79,142,247,0.15), rgba(139,92,246,0.15))",
                          display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: "32px", opacity: 0.4 }}>🏁</span>
                        </div>
                      )}

                      <div style={{ padding: "20px" }}>
                        {/* Status + name row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                          <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#f0f0ff", flex: 1, paddingRight: "12px" }}>
                            {cp.name}
                          </h3>
                          <span style={pill(cp.status, sc)}>{cp.status}</span>
                        </div>

                        {cp.description && (
                          <p style={{ margin: "0 0 14px", fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                            {cp.description}
                          </p>
                        )}

                        {/* Meta chips */}
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "12px", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                          {cp.startDate && cp.endDate && (
                            <span style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "8px" }}>
                              📅 {new Date(cp.startDate).toLocaleDateString()} – {new Date(cp.endDate).toLocaleDateString()}
                            </span>
                          )}
                          {cp.startDate && cp.endDate && (
                            <span style={{ background: "rgba(79,142,247,0.1)", padding: "4px 10px", borderRadius: "8px", color: "#4f8ef7" }}>
                              ⏱ {cpDays(cp)} days
                            </span>
                          )}
                          <span style={{ background: "rgba(245,200,66,0.1)", padding: "4px 10px", borderRadius: "8px", color: "#f5c842" }}>
                            ✅ {assignedCount} task{assignedCount !== 1 ? "s" : ""}
                          </span>
                          {cp.assignTo && cp.assignTo !== "all" && (
                            <span style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "8px" }}>
                              👥 {cp.assignTo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ TASKS TAB ══════════════════ */}
        {tab === "tasks" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                {tasks.length} task{tasks.length !== 1 ? "s" : ""} defined
              </p>
              <button onClick={openNewTask} style={addBtnSx}>＋ New Task</button>
            </div>

            <div style={cardSx}>
              {tasks.length === 0 ? (
                <div style={{ padding: "60px", textAlign: "center" }}>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "16px", margin: 0 }}>No tasks yet.</p>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Task", "Badge Type", "XC Value", "Cohort", "Checkpoint", "Status", ""].map(h => (
                        <th key={h} style={{ padding: "14px 18px", textAlign: "left", fontSize: "11px",
                          fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(task => {
                      const cp = task.roundId ? checkpoints.find(c => c.id === task.roundId) : null;
                      const sc = statusColor(task.status === "active" ? "active" : task.status === "inactive" ? "inactive" : "upcoming");
                      return (
                        <tr key={task.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "14px 18px" }}>
                            <p style={{ margin: 0, fontWeight: 700, color: "white", fontSize: "14px" }}>{task.title}</p>
                            {task.description && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{task.description}</p>}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            {(task as any).rewardBadges?.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                {(task as any).rewardBadges.map((b: any, bi: number) => (
                                  <span key={bi} style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                                    background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.2)", color: "#4f8ef7" }}>
                                    {b.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{task.coinType || "—"}</span>
                            )}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <span style={{ color: "#f5c842", fontWeight: 800, fontSize: "14px" }}>{task.xpValue} XC</span>
                          </td>
                          <td style={{ padding: "14px 18px", fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>{task.cohort || "All"}</td>
                          <td style={{ padding: "14px 18px" }}>
                            {cp ? (
                              <span style={{ background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.25)",
                                padding: "3px 10px", borderRadius: "8px", fontSize: "12px", color: "#4f8ef7", fontWeight: 700 }}>
                                {cp.name}
                              </span>
                            ) : <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>Unassigned</span>}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <span style={pill(task.status, sc)}>{task.status}</span>
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <button onClick={() => openEditTask(task as Task)}
                              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "8px", color: "rgba(255,255,255,0.6)", padding: "6px 14px",
                                cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>Edit</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ JOBS TAB ══════════════════ */}
        {tab === "jobs" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                {jobs.length} job{jobs.length !== 1 ? "s" : ""} listed
              </p>
              <button onClick={openNewJob} style={addBtnSx}>＋ New Job</button>
            </div>

            {jobs.length === 0 ? (
              <div style={{ ...cardSx, padding: "60px", textAlign: "center" }}>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "16px", margin: 0 }}>No jobs yet.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                {jobs.map(job => {
                  const sc = statusColor(job.status === "open" ? "active" : "inactive");
                  return (
                    <div key={job.id} style={{ ...cardSx, padding: "22px", cursor: "pointer" }}
                      onClick={() => { playClick(); setEditingJob({ ...job }); setJobModal(true); }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#f0f0ff", flex: 1, paddingRight: "10px" }}>{job.title}</h3>
                        <span style={pill(job.status, sc)}>{job.status}</span>
                      </div>
                      {job.description && <p style={{ margin: "0 0 14px", fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{job.description}</p>}
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "12px", fontWeight: 700 }}>
                        <span style={{ background: "rgba(245,200,66,0.1)", padding: "4px 10px", borderRadius: "8px", color: "#f5c842" }}>
                          {job.xpValue} XC
                        </span>
                        {job.coinType && <span style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "8px", color: "rgba(255,255,255,0.5)" }}>{job.coinType}</span>}
                        <span style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "8px", color: "rgba(255,255,255,0.4)" }}>{job.cohort || "All"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ PROJECTS TAB ══════════════════ */}
        {tab === "projects" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                {projects.length} project{projects.length !== 1 ? "s" : ""} defined
              </p>
              <button onClick={openNewProject} style={addBtnSx}>＋ New Project</button>
            </div>

            {projects.length === 0 ? (
              <div style={{ ...cardSx, padding: "60px", textAlign: "center" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🗂</div>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "16px", margin: 0 }}>No projects yet. Create your first project.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
                {projects.map(proj => {
                  const sc = statusColor(proj.status === "active" ? "active" : proj.status === "archived" ? "archived" : "upcoming");
                  const inCPs = mockCheckpoints.filter(cp => ((cp as any).projectIds ?? []).includes(proj.id));
                  return (
                    <div key={proj.id} style={{ ...cardSx, padding: "22px", cursor: "pointer" }}
                      onClick={() => openEditProject(proj)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#f0f0ff", flex: 1 }}>
                          🗂 {proj.title}
                        </h3>
                        <span style={pill(proj.status, sc)}>{proj.status}</span>
                      </div>
                      {proj.description && (
                        <p style={{ margin: "0 0 14px", fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                          {proj.description}
                        </p>
                      )}
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "11px", fontWeight: 700, marginBottom: "12px" }}>
                        <span style={{ background: "rgba(79,142,247,0.1)", padding: "3px 10px", borderRadius: "8px", color: "#4f8ef7" }}>
                          ✅ {proj.taskIds.length} task{proj.taskIds.length !== 1 ? "s" : ""}
                        </span>
                        <span style={{ background: "rgba(167,139,250,0.1)", padding: "3px 10px", borderRadius: "8px", color: "#a78bfa" }}>
                          💼 {proj.jobIds.length} job{proj.jobIds.length !== 1 ? "s" : ""}
                        </span>
                        {proj.xcRewardPool ? (
                          <span style={{ background: "rgba(245,200,66,0.1)", padding: "3px 10px", borderRadius: "8px", color: "#f5c842" }}>
                            ⚡ {proj.xcRewardPool.toLocaleString()} XC pool
                          </span>
                        ) : null}
                        {proj.dueDate && (
                          <span style={{ background: "rgba(255,255,255,0.05)", padding: "3px 10px", borderRadius: "8px", color: "rgba(255,255,255,0.4)" }}>
                            📅 Due {proj.dueDate}
                          </span>
                        )}
                      </div>
                      {inCPs.length > 0 && (
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {inCPs.map(cp => (
                            <span key={cp.id} style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", color: "#22c55e", fontWeight: 700 }}>
                              📌 {cp.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ══════════════════ CHECKPOINT MODAL ══════════════════ */}
      {cpModal && (
        <ModalBG onClose={() => { playClick(); setCpModal(false); }}>
          <div style={{ padding: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: "#f0f0ff" }}>
                {editingCP.id ? "Edit Checkpoint" : "New Checkpoint"}
              </h2>
              {editingCP.id && (
                <button onClick={() => { handleDeleteCP(editingCP.id!); setCpModal(false); }}
                  style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "8px", color: "#ef4444", padding: "6px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                  🗑 Delete
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

              {/* Banner image */}
              <Field label="Banner Image">
                <input type="file" hidden accept="image/*" ref={bannerRef} onChange={handleBannerUpload} />
                {editingCP.bannerImage ? (
                  <div style={{ position: "relative" }}>
                    <img src={editingCP.bannerImage} alt="" style={{ width: "100%", height: "160px", objectFit: "cover", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)" }} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                      <button onClick={() => bannerRef.current?.click()}
                        style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px",
                          color: "white", padding: "8px 16px", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                        📷 Change
                      </button>
                      <button onClick={() => setEditingCP(prev => ({ ...prev, bannerImage: undefined }))}
                        style={{ background: "rgba(239,68,68,0.7)", border: "none", borderRadius: "8px",
                          color: "white", padding: "8px 16px", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                        ✕ Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => bannerRef.current?.click()}
                    style={{ width: "100%", height: "120px", background: "rgba(255,255,255,0.03)",
                      border: "2px dashed rgba(79,142,247,0.3)", borderRadius: "10px",
                      color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "14px", fontWeight: 600,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <span style={{ fontSize: "28px" }}>🖼</span>
                    Click to upload banner image
                  </button>
                )}
              </Field>

              {/* Name */}
              <Field label="Checkpoint Name *">
                <input value={editingCP.name || ""} onChange={e => setEditingCP(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Quarter 1 Sprint" style={inputSx} />
              </Field>

              {/* Description */}
              <Field label="Description">
                <textarea value={editingCP.description || ""} onChange={e => setEditingCP(p => ({ ...p, description: e.target.value }))}
                  placeholder="What does this checkpoint focus on?" rows={2}
                  style={{ ...inputSx, resize: "vertical" }} />
              </Field>

              {/* Dates + Duration */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                <Field label="Start Date">
                  <input type="date" value={editingCP.startDate || ""} onChange={e => setEditingCP(p => ({ ...p, startDate: e.target.value }))} style={inputSx} />
                </Field>
                <Field label="End Date">
                  <input type="date" value={editingCP.endDate || ""} onChange={e => setEditingCP(p => ({ ...p, endDate: e.target.value }))} style={inputSx} />
                </Field>
                <Field label="Duration">
                  <div style={{ ...inputSx, display: "flex", alignItems: "center", color: "#4f8ef7", fontWeight: 700 }}>
                    {editingCP.startDate && editingCP.endDate
                      ? `${cpDays(editingCP as Checkpoint)} days`
                      : <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>}
                  </div>
                </Field>
              </div>

              {/* Status + Assign */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <Field label="Status">
                  <select value={editingCP.status || "upcoming"} onChange={e => setEditingCP(p => ({ ...p, status: e.target.value as Checkpoint["status"] }))} style={{ ...inputSx, cursor: "pointer" }}>
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </Field>
                <Field label="Assign To">
                  <select value={editingCP.assignTo || "all"} onChange={e => setEditingCP(p => ({ ...p, assignTo: e.target.value }))} style={{ ...inputSx, cursor: "pointer" }}>
                    <option value="all">All Cohorts</option>
                    {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              {/* Project selection — auto-includes project tasks */}
              <Field label={`Include Projects (${cpProjectIds.length} selected — auto-adds their tasks)`}>
                <div style={{ maxHeight: "180px", overflowY: "auto", background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(167,139,250,0.15)", borderRadius: "10px", padding: "8px" }}>
                  {projects.length === 0 ? (
                    <p style={{ margin: "16px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>No projects yet. Create projects in the Projects tab first.</p>
                  ) : projects.map(proj => {
                    const checked = cpProjectIds.includes(proj.id);
                    return (
                      <label key={proj.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px",
                        borderRadius: "8px", cursor: "pointer", transition: "background 0.15s",
                        background: checked ? "rgba(167,139,250,0.1)" : "transparent" }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => setCpProjectIds(prev => prev.includes(proj.id) ? prev.filter(id => id !== proj.id) : [...prev, proj.id])}
                          style={{ width: "16px", height: "16px", accentColor: "#a78bfa", cursor: "pointer" }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: checked ? "#f0f0ff" : "rgba(255,255,255,0.7)" }}>
                            🗂 {proj.title}
                          </p>
                          <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                            {proj.taskIds.length} tasks · {proj.jobIds.length} jobs
                            {proj.xcRewardPool ? ` · ${proj.xcRewardPool.toLocaleString()} XC pool` : ""}
                          </p>
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: checked ? "#a78bfa" : "rgba(255,255,255,0.2)" }}>
                          {checked ? "✓" : "+"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </Field>

              {/* Resource Link */}
              <Field label="Resource Link">
                <input value={editingCP.link || ""} onChange={e => setEditingCP(p => ({ ...p, link: e.target.value }))}
                  placeholder="https://docs.google.com/... or any URL" style={inputSx} />
              </Field>

              {/* Task selection */}
              <Field label={`Assign Individual Tasks (${cpTaskIds.length} selected)`}>
                <div style={{ maxHeight: "220px", overflowY: "auto", background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "8px" }}>
                  {tasks.length === 0 ? (
                    <p style={{ margin: "16px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>No tasks defined yet. Create tasks in the Tasks tab first.</p>
                  ) : tasks.map(task => {
                    const checked = cpTaskIds.includes(task.id);
                    // Check if already included via a selected project
                    const includedViaProject = !checked && cpProjectIds.some(pId => {
                      const p = projects.find(p => p.id === pId);
                      return p?.taskIds.includes(task.id);
                    });
                    const otherCp = !checked && !includedViaProject && task.roundId && task.roundId !== editingCP.id
                      ? checkpoints.find(c => c.id === task.roundId)
                      : null;
                    return (
                      <label key={task.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px",
                        borderRadius: "8px", cursor: "pointer", transition: "background 0.15s",
                        background: checked ? "rgba(79,142,247,0.1)" : includedViaProject ? "rgba(167,139,250,0.07)" : "transparent" }}>
                        <input type="checkbox" checked={checked || includedViaProject} onChange={() => !includedViaProject && toggleCpTask(task.id)}
                          style={{ width: "16px", height: "16px", accentColor: includedViaProject ? "#a78bfa" : "#4f8ef7", cursor: includedViaProject ? "default" : "pointer" }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: (checked || includedViaProject) ? "#f0f0ff" : "rgba(255,255,255,0.7)" }}>
                            {task.title}
                          </p>
                          <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                            {(task as any).rewardBadges?.length > 0
                              ? (task as any).rewardBadges.map((b: any) => b.name).join(", ")
                              : task.coinType || "No badge"} · {task.xpValue} XC
                            {includedViaProject && <span style={{ color: "#a78bfa", marginLeft: "8px" }}>via project</span>}
                            {otherCp && <span style={{ color: "#f5c842", marginLeft: "8px" }}>⚠ in "{otherCp.name}"</span>}
                          </p>
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: checked ? "#4f8ef7" : includedViaProject ? "#a78bfa" : "rgba(255,255,255,0.2)" }}>
                          {(checked || includedViaProject) ? "✓" : "+"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </Field>

            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "28px" }}>
              <button onClick={() => { playClick(); setCpModal(false); }}
                style={{ padding: "11px 24px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "10px", color: "rgba(255,255,255,0.6)", fontWeight: 700, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSaveCP}
                style={{ padding: "11px 28px", background: "linear-gradient(135deg, #4f8ef7, #7c3aed)",
                  border: "none", borderRadius: "10px", color: "white", fontWeight: 800, cursor: "pointer",
                  boxShadow: "0 0 20px rgba(79,142,247,0.3)", fontSize: "14px" }}>
                {editingCP.id ? "Save Changes" : "Create Checkpoint"}
              </button>
            </div>
          </div>
        </ModalBG>
      )}

      {/* ══════════════════ TASK MODAL ══════════════════ */}
      {taskModal && (
        <ModalBG onClose={() => { playClick(); setTaskModal(false); }}>
          <div style={{ padding: "32px" }} onClick={() => setBadgeDropdownOpen(false)}>
            <h2 style={{ margin: "0 0 24px", fontSize: "20px", fontWeight: 900, color: "#f0f0ff" }}>
              {editingTask.id ? "Edit Task" : "New Task"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Field label="Task Title *">
                <input value={editingTask.title || ""} onChange={e => setEditingTask(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Complete a STEM project" style={inputSx} />
              </Field>
              <Field label="Description">
                <textarea value={editingTask.description || ""} onChange={e => setEditingTask(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe what the player must do…" rows={2} style={{ ...inputSx, resize: "vertical" }} />
              </Field>
              {/* Multi-badge selector */}
              <Field label={`Digital Badges (${taskBadges.length} selected · ${taskBadges.reduce((s, b) => s + b.xc, 0)} XC total)`}>
                {/* Selected badge chips */}
                {taskBadges.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                    {taskBadges.map((badge, i) => (
                      <span key={i} style={{
                        display: "inline-flex", alignItems: "center", gap: "6px",
                        padding: "5px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                        background: "rgba(79,142,247,0.12)", border: "1px solid rgba(79,142,247,0.3)", color: "#4f8ef7",
                      }}>
                        {badge.name} <span style={{ color: "#f5c842", fontFamily: "monospace" }}>{badge.xc} XC</span>
                        <span onClick={() => setTaskBadges(prev => prev.filter((_, j) => j !== i))}
                          style={{ cursor: "pointer", color: "rgba(255,255,255,0.4)", marginLeft: "2px", fontSize: "14px" }}>×</span>
                      </span>
                    ))}
                  </div>
                )}
                {/* Badge search + dropdown */}
                <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                  <input
                    value={badgeSearch}
                    onChange={e => { setBadgeSearch(e.target.value); setBadgeDropdownOpen(true); }}
                    onFocus={() => setBadgeDropdownOpen(true)}
                    placeholder="Search and add badges…"
                    style={inputSx}
                  />
                  {badgeDropdownOpen && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                      maxHeight: "220px", overflowY: "auto", marginTop: "4px",
                      background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    }}>
                      {COIN_CATEGORIES.map(cat => {
                        const filtered = cat.coins.filter(c =>
                          (!badgeSearch || c.name.toLowerCase().includes(badgeSearch.toLowerCase())) &&
                          !taskBadges.some(b => b.name === c.name)
                        );
                        if (filtered.length === 0) return null;
                        return (
                          <div key={cat.name}>
                            <div style={{ padding: "6px 12px", fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              {cat.name.toUpperCase()}
                            </div>
                            {filtered.map(coin => (
                              <div key={coin.name}
                                onClick={() => {
                                  setTaskBadges(prev => [...prev, { name: coin.name, xc: coin.xc }]);
                                  setBadgeSearch("");
                                }}
                                style={{
                                  padding: "8px 14px", cursor: "pointer", fontSize: "13px", fontWeight: 600,
                                  color: "rgba(255,255,255,0.7)", display: "flex", justifyContent: "space-between",
                                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(79,142,247,0.1)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              >
                                <span>{coin.name}</span>
                                <span style={{ color: "#f5c842", fontSize: "11px", fontFamily: "monospace" }}>{coin.xc} XC</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      {allCoinsFlat.filter(c => !badgeSearch || c.name.toLowerCase().includes(badgeSearch.toLowerCase())).filter(c => !taskBadges.some(b => b.name === c.name)).length === 0 && (
                        <div style={{ padding: "12px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>No badges found</div>
                      )}
                    </div>
                  )}
                </div>
              </Field>
              {/* Manual XC override if no badges selected */}
              {taskBadges.length === 0 && (
                <Field label="XC Value (manual)">
                  <input type="number" value={editingTask.xpValue || 100} onChange={e => setEditingTask(p => ({ ...p, xpValue: parseInt(e.target.value) || 0 }))}
                    min={0} style={inputSx} />
                </Field>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                <Field label="Cohort">
                  <select value={editingTask.cohort || "all"} onChange={e => setEditingTask(p => ({ ...p, cohort: e.target.value }))}
                    style={{ ...inputSx, cursor: "pointer" }}>
                    <option value="all">All</option>
                    {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={editingTask.status || "active"} onChange={e => setEditingTask(p => ({ ...p, status: e.target.value as Task["status"] }))}
                    style={{ ...inputSx, cursor: "pointer" }}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
                <Field label="Checkpoint">
                  <select value={editingTask.roundId || ""} onChange={e => setEditingTask(p => ({ ...p, roundId: e.target.value || undefined }))}
                    style={{ ...inputSx, cursor: "pointer" }}>
                    <option value="">Unassigned</option>
                    {checkpoints.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label={`Resource Links (${taskLinks.filter(l => l.trim()).length})`}>
                {taskLinks.map((link, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", marginBottom: i < taskLinks.length - 1 ? "6px" : 0 }}>
                    <input value={link}
                      onChange={e => {
                        const updated = [...taskLinks];
                        updated[i] = e.target.value;
                        // Auto-add new empty row when typing in the last one
                        if (i === taskLinks.length - 1 && e.target.value.trim()) updated.push("");
                        setTaskLinks(updated);
                      }}
                      placeholder="https://docs.google.com/... or any URL" style={{ ...inputSx, flex: 1 }} />
                    {taskLinks.length > 1 && i < taskLinks.length - 1 && (
                      <button onClick={() => setTaskLinks(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                          borderRadius: "8px", color: "#ef4444", padding: "0 10px", cursor: "pointer", fontSize: "14px", fontWeight: 700 }}>×</button>
                    )}
                  </div>
                ))}
              </Field>
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button onClick={() => { playClick(); setTaskModal(false); }}
                style={{ padding: "11px 24px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "10px", color: "rgba(255,255,255,0.6)", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSaveTask}
                style={{ padding: "11px 28px", background: "linear-gradient(135deg, #4f8ef7, #7c3aed)",
                  border: "none", borderRadius: "10px", color: "white", fontWeight: 800, cursor: "pointer",
                  boxShadow: "0 0 20px rgba(79,142,247,0.3)", fontSize: "14px" }}>
                {editingTask.id ? "Save Changes" : "Create Task"}
              </button>
            </div>
          </div>
        </ModalBG>
      )}

      {/* ══════════════════ PROJECT MODAL ══════════════════ */}
      {projectModal && (
        <ModalBG onClose={() => { playClick(); setProjectModal(false); }}>
          <div style={{ padding: "32px" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: "20px", fontWeight: 900, color: "#f0f0ff" }}>
              {editingProject.id ? "Edit Project" : "New Project"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Field label="Project Title *">
                <input value={editingProject.title || ""} onChange={e => setEditingProject(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Brand Identity Campaign" style={inputSx} />
              </Field>
              <Field label="Description">
                <textarea value={editingProject.description || ""} onChange={e => setEditingProject(p => ({ ...p, description: e.target.value }))}
                  placeholder="What does this project involve?" rows={2} style={{ ...inputSx, resize: "vertical" }} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                <Field label="Status">
                  <select value={editingProject.status || "active"} onChange={e => setEditingProject(p => ({ ...p, status: e.target.value as Project["status"] }))}
                    style={{ ...inputSx, cursor: "pointer" }}>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
                <Field label="Due Date">
                  <input type="date" value={editingProject.dueDate || ""} onChange={e => setEditingProject(p => ({ ...p, dueDate: e.target.value || undefined }))} style={inputSx} />
                </Field>
                <Field label="XC Reward Pool">
                  <input type="number" value={editingProject.xcRewardPool || 0} onChange={e => setEditingProject(p => ({ ...p, xcRewardPool: parseInt(e.target.value) || 0 }))}
                    min={0} style={inputSx} />
                </Field>
              </div>

              {/* Resource Link */}
              <Field label="Resource Link">
                <input value={editingProject.link || ""} onChange={e => setEditingProject(p => ({ ...p, link: e.target.value }))}
                  placeholder="https://docs.google.com/... or any URL" style={inputSx} />
              </Field>

              {/* Task selection */}
              <Field label={`Assign Tasks (${projTaskIds.length} selected)`}>
                <div style={{ maxHeight: "180px", overflowY: "auto", background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "8px" }}>
                  {tasks.length === 0 ? (
                    <p style={{ margin: "16px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>No tasks defined yet.</p>
                  ) : tasks.map(task => {
                    const checked = projTaskIds.includes(task.id);
                    return (
                      <label key={task.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px",
                        borderRadius: "8px", cursor: "pointer", background: checked ? "rgba(79,142,247,0.1)" : "transparent" }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => setProjTaskIds(prev => prev.includes(task.id) ? prev.filter(id => id !== task.id) : [...prev, task.id])}
                          style={{ width: "16px", height: "16px", accentColor: "#4f8ef7", cursor: "pointer" }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: checked ? "#f0f0ff" : "rgba(255,255,255,0.7)" }}>{task.title}</p>
                          <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{(task as any).rewardBadges?.length > 0 ? (task as any).rewardBadges.map((b: any) => b.name).join(", ") : task.coinType || "No badge"} · {task.xpValue} XC</p>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 800, color: checked ? "#4f8ef7" : "rgba(255,255,255,0.2)" }}>{checked ? "✓" : "+"}</span>
                      </label>
                    );
                  })}
                </div>
              </Field>

              {/* Job selection */}
              <Field label={`Assign Jobs (${projJobIds.length} selected)`}>
                <div style={{ maxHeight: "180px", overflowY: "auto", background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "8px" }}>
                  {jobs.length === 0 ? (
                    <p style={{ margin: "16px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>No jobs defined yet.</p>
                  ) : jobs.map(job => {
                    const checked = projJobIds.includes(job.id);
                    return (
                      <label key={job.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px",
                        borderRadius: "8px", cursor: "pointer", background: checked ? "rgba(167,139,250,0.1)" : "transparent" }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => setProjJobIds(prev => prev.includes(job.id) ? prev.filter(id => id !== job.id) : [...prev, job.id])}
                          style={{ width: "16px", height: "16px", accentColor: "#a78bfa", cursor: "pointer" }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: checked ? "#f0f0ff" : "rgba(255,255,255,0.7)" }}>{job.title}</p>
                          <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{job.coinType} · {job.xpValue} XC</p>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 800, color: checked ? "#a78bfa" : "rgba(255,255,255,0.2)" }}>{checked ? "✓" : "+"}</span>
                      </label>
                    );
                  })}
                </div>
              </Field>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", marginTop: "24px" }}>
              {editingProject.id && (
                <button onClick={() => { handleDeleteProject(editingProject.id!); setProjectModal(false); }}
                  style={{ padding: "11px 20px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "10px", color: "#ef4444", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
                  🗑 Delete
                </button>
              )}
              <div style={{ display: "flex", gap: "12px", marginLeft: "auto" }}>
                <button onClick={() => { playClick(); setProjectModal(false); }}
                  style={{ padding: "11px 24px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "10px", color: "rgba(255,255,255,0.6)", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSaveProject}
                  style={{ padding: "11px 28px", background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                    border: "none", borderRadius: "10px", color: "white", fontWeight: 800, cursor: "pointer",
                    boxShadow: "0 0 20px rgba(167,139,250,0.3)", fontSize: "14px" }}>
                  {editingProject.id ? "Save Changes" : "Create Project"}
                </button>
              </div>
            </div>
          </div>
        </ModalBG>
      )}

      {/* ══════════════════ JOB MODAL ══════════════════ */}
      {jobModal && (
        <ModalBG onClose={() => { playClick(); setJobModal(false); }}>
          <div style={{ padding: "32px" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: "20px", fontWeight: 900, color: "#f0f0ff" }}>
              {editingJob.id ? "Edit Job" : "New Job"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Field label="Job Title *">
                <input value={editingJob.title || ""} onChange={e => setEditingJob(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Team Captain" style={inputSx} />
              </Field>
              <Field label="Description">
                <textarea value={editingJob.description || ""} onChange={e => setEditingJob(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the role…" rows={2} style={{ ...inputSx, resize: "vertical" }} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <Field label="Badge / Coin Type">
                  <select value={editingJob.coinType || ""} onChange={e => setEditingJob(p => ({ ...p, coinType: e.target.value }))}
                    style={{ ...inputSx, cursor: "pointer" }}>
                    <option value="">— None —</option>
                    {allCoins.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="XC Value">
                  <input type="number" value={editingJob.xpValue || 500} onChange={e => setEditingJob(p => ({ ...p, xpValue: parseInt(e.target.value) || 0 }))}
                    min={0} style={inputSx} />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <Field label="Cohort">
                  <select value={editingJob.cohort || "all"} onChange={e => setEditingJob(p => ({ ...p, cohort: e.target.value }))}
                    style={{ ...inputSx, cursor: "pointer" }}>
                    <option value="all">All</option>
                    {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={editingJob.status || "open"} onChange={e => setEditingJob(p => ({ ...p, status: e.target.value as Job["status"] }))}
                    style={{ ...inputSx, cursor: "pointer" }}>
                    <option value="open">Open</option>
                    <option value="filled">Filled</option>
                    <option value="closed">Closed</option>
                  </select>
                </Field>
              </div>
              <Field label="Resource Link">
                <input value={editingJob.link || ""} onChange={e => setEditingJob(p => ({ ...p, link: e.target.value }))}
                  placeholder="https://docs.google.com/... or any URL" style={inputSx} />
              </Field>
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button onClick={() => { playClick(); setJobModal(false); }}
                style={{ padding: "11px 24px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "10px", color: "rgba(255,255,255,0.6)", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSaveJob}
                style={{ padding: "11px 28px", background: "linear-gradient(135deg, #4f8ef7, #7c3aed)",
                  border: "none", borderRadius: "10px", color: "white", fontWeight: 800, cursor: "pointer",
                  boxShadow: "0 0 20px rgba(79,142,247,0.3)", fontSize: "14px" }}>
                {editingJob.id ? "Save Changes" : "Create Job"}
              </button>
            </div>
          </div>
        </ModalBG>
      )}
    </div>
  );
}
