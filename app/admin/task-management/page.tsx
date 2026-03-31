"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import {
  User, Task, Job, JobMilestone, Checkpoint, Project,
  mockTasks, mockJobs, mockCheckpoints, mockUsers, mockProjects,
  COIN_CATEGORIES, RewardCoin, getMockCohorts,
  isHostUser,
  CohortGroup, mockCohortGroups,
  ProjectPitch, mockProjectPitches,
  PITCH_AUTO_JOBS, calculateNFTValue, calculateRarity,
} from "../../lib/data";
import { saveCheckpoints, saveTasks, saveJobs, saveProjects, saveCohortGroups, saveProjectPitches } from "../../lib/store";
import { saveAndToast } from "../../lib/saveToast";
import { playClick, playNav, playSuccess, playError, playDelete, playModalOpen, playModalClose } from "../../lib/sounds";
import { compressBannerImage } from "../../lib/imageUtils";

// ── Helpers ──────────────────────────────────────────────────────────────────

const cpDays = (cp: Checkpoint) => {
  const ms = new Date(cp.endDate).getTime() - new Date(cp.startDate).getTime();
  return Math.max(1, Math.round(ms / 86400000));
};

/* ── Total earnings helper ─────────────────────────────────────────── */
const calcBadgeXC = (badges?: { name: string; xc: number }[]) =>
  (badges || []).reduce((sum, b) => sum + (b.xc || 0), 0);

const fmtXC = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : n.toLocaleString();

/* Earnings pill component */
function EarningsPill({ label, xc, badges, color = "#f5c842" }: { label?: string; xc: number; badges: number; color?: string }) {
  if (xc === 0 && badges === 0) return null;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: "4px 12px", borderRadius: "8px",
      background: `${color}10`, border: `1px solid ${color}25`,
    }}>
      {label && <span style={{ fontSize: "10px", fontWeight: 700, color: `${color}80`, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>}
      <span style={{ fontSize: "13px", fontWeight: 800, color }}>
        {fmtXC(xc)} XC
      </span>
      {badges > 0 && (
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#4f8ef7" }}>
          ({badges} badge{badges !== 1 ? "s" : ""})
        </span>
      )}
    </div>
  );
}

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

// ── Multi-Cohort Selector ────────────────────────────────────────────────────
// Chip-style multi-select for cohorts + cohort groups.
// value: "all" | string[] (array of selected cohort names)
function MultiCohortSelector({
  value,
  onChange,
  cohorts,
  groups,
  label = "Assign To",
}: {
  value: "all" | string[] | undefined;
  onChange: (v: "all" | string[]) => void;
  cohorts: string[];
  groups: CohortGroup[];
  label?: string;
}) {
  const isAll = !value || value === "all";
  const selected: string[] = isAll ? [] : (value as string[]);

  const toggle = (cohort: string) => {
    if (isAll) {
      // Switching from "all" to specific: select just this one
      onChange([cohort]);
    } else {
      const next = selected.includes(cohort)
        ? selected.filter(c => c !== cohort)
        : [...selected, cohort];
      onChange(next.length === 0 ? "all" : next);
    }
  };

  const toggleGroup = (group: CohortGroup) => {
    if (isAll) {
      onChange([...group.cohorts]);
    } else {
      const allInGroup = group.cohorts.every(c => selected.includes(c));
      if (allInGroup) {
        // Remove all cohorts from this group
        const next = selected.filter(c => !group.cohorts.includes(c));
        onChange(next.length === 0 ? "all" : next);
      } else {
        // Add all cohorts from this group
        const next = [...new Set([...selected, ...group.cohorts])];
        onChange(next);
      }
    }
  };

  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</p>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
        {/* All button */}
        <button type="button" onClick={() => onChange("all")}
          style={{
            padding: "5px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
            cursor: "pointer", transition: "all 0.15s", border: "1px solid",
            background: isAll ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)",
            borderColor: isAll ? "rgba(0,212,255,0.5)" : "rgba(255,255,255,0.1)",
            color: isAll ? "#00d4ff" : "rgba(255,255,255,0.4)",
          }}>All Cohorts</button>
        {/* Divider */}
        {groups.length > 0 && <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />}
        {/* Groups */}
        {groups.map(g => {
          const allIn = !isAll && g.cohorts.every(c => selected.includes(c));
          const someIn = !isAll && g.cohorts.some(c => selected.includes(c));
          const gc = g.color || "#a78bfa";
          return (
            <button key={g.id} type="button" onClick={() => toggleGroup(g)}
              style={{
                padding: "5px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
                cursor: "pointer", transition: "all 0.15s", border: "1px solid",
                background: allIn ? `${gc}20` : someIn ? `${gc}10` : "rgba(255,255,255,0.04)",
                borderColor: allIn ? `${gc}60` : someIn ? `${gc}30` : "rgba(255,255,255,0.1)",
                color: allIn ? gc : someIn ? `${gc}aa` : "rgba(255,255,255,0.4)",
              }}>
              📁 {g.name}
              {someIn && !allIn && <span style={{ marginLeft: "4px", opacity: 0.6 }}>~</span>}
              {allIn && <span style={{ marginLeft: "4px" }}>✓</span>}
            </button>
          );
        })}
        {(groups.length > 0 && cohorts.length > 0) && <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />}
        {/* Individual cohorts */}
        {cohorts.map(c => {
          const on = !isAll && selected.includes(c);
          return (
            <button key={c} type="button" onClick={() => toggle(c)}
              style={{
                padding: "5px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
                cursor: "pointer", transition: "all 0.15s", border: "1px solid",
                background: on ? "rgba(79,142,247,0.15)" : "rgba(255,255,255,0.04)",
                borderColor: on ? "rgba(79,142,247,0.5)" : "rgba(255,255,255,0.1)",
                color: on ? "#4f8ef7" : "rgba(255,255,255,0.4)",
              }}>{c}{on && " ✓"}</button>
          );
        })}
      </div>
      {!isAll && selected.length > 0 && (
        <p style={{ margin: "4px 0 0", fontSize: "10px", color: "rgba(79,142,247,0.5)" }}>
          {selected.length} cohort{selected.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TaskManagement() {
  const router = useRouter();
  const [user, setUser]           = useState<User | null>(null);
  const [tab, setTab]             = useState<"checkpoints" | "tasks" | "jobs" | "projects" | "cohort-groups" | "pitches">("checkpoints");
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
  const [jobBadges, setJobBadges] = useState<{ name: string; xc: number }[]>([]);
  const [jobBadgeDropdown, setJobBadgeDropdown] = useState(false);
  const [jobBadgeSearch, setJobBadgeSearch] = useState("");

  // Project state
  const [projects, setProjects]   = useState<Project[]>([...mockProjects]);
  const [projectModal, setProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project>>({});
  const [projTaskIds, setProjTaskIds] = useState<string[]>([]);
  const [projJobIds, setProjJobIds] = useState<string[]>([]);
  const [projBadges, setProjBadges] = useState<{ name: string; xc: number }[]>([]);
  const [projBadgeDropdown, setProjBadgeDropdown] = useState(false);
  const [projBadgeSearch, setProjBadgeSearch] = useState("");

  // Checkpoint state
  const [cpBadges, setCpBadges] = useState<{ name: string; xc: number }[]>([]);
  const [cpBadgeDropdown, setCpBadgeDropdown] = useState(false);
  const [cpBadgeSearch, setCpBadgeSearch] = useState("");

  // Checkpoint project selection
  const [cpProjectIds, setCpProjectIds] = useState<string[]>([]);
  // Checkpoint job selection
  const [cpJobIds, setCpJobIds] = useState<string[]>([]);

  // Cohort group state
  const [cohortGroups, setCohortGroups] = useState<CohortGroup[]>([...mockCohortGroups]);
  const [editingGroup, setEditingGroup] = useState<Partial<CohortGroup> | null>(null);
  const [groupModal, setGroupModal] = useState(false);

  // Pitch review state
  const [allPitches, setAllPitches] = useState<ProjectPitch[]>([...mockProjectPitches]);
  const [reviewingPitch, setReviewingPitch] = useState<ProjectPitch | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [pitchReviewModal, setPitchReviewModal] = useState(false);

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
    setCpJobIds([]);
    setCpBadges([]);
    setCpBadgeSearch("");
    setCpBadgeDropdown(false);
    setCpModal(true);
  };

  const openEditCP = (cp: Checkpoint) => {
    playClick();
    setEditingCP({ ...cp });
    setCpTaskIds(tasks.filter(t => t.roundId === cp.id).map(t => t.id));
    setCpProjectIds((cp as any).projectIds ?? []);
    setCpJobIds((cp as any).jobIds ?? []);
    setCpBadges((cp as any).rewardBadges ?? []);
    setCpBadgeSearch("");
    setCpBadgeDropdown(false);
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

    // Expand project tasks/jobs into the checkpoint lists
    const projectExpandedTaskIds = new Set<string>(cpTaskIds);
    const projectExpandedJobIds = new Set<string>(cpJobIds);
    cpProjectIds.forEach(projId => {
      const proj = mockProjects.find(p => p.id === projId);
      if (proj) {
        proj.taskIds.forEach(tid => projectExpandedTaskIds.add(tid));
        proj.jobIds.forEach(jid => projectExpandedJobIds.add(jid));
      }
    });
    const finalTaskIds = Array.from(projectExpandedTaskIds);
    const finalJobIds = Array.from(projectExpandedJobIds);

    const saved: Checkpoint = {
      id: cpId,
      name: editingCP.name || "Untitled Checkpoint",
      description: editingCP.description || "",
      startDate: editingCP.startDate || "",
      endDate: editingCP.endDate || "",
      status: (editingCP.status as Checkpoint["status"]) || "upcoming",
      assignTo: (editingCP as any).assignTo || "all",
      assignedTo: (editingCP as any).assignTo || "all",
      bannerImage: editingCP.bannerImage,
      projectIds: cpProjectIds,
      jobIds: cpJobIds,
      rewardBadges: cpBadges,
    } as Checkpoint;

    if (isNew) {
      setCheckpoints(prev => [...prev, saved]);
      mockCheckpoints.push(saved);
    } else {
      setCheckpoints(prev => prev.map(c => c.id === cpId ? saved : c));
      const idx = mockCheckpoints.findIndex(c => c.id === cpId);
      if (idx >= 0) mockCheckpoints[idx] = saved;
    }

    // Sync task roundIds + requirement flags
    // Tasks IN a checkpoint = required; tasks REMOVED from checkpoint = available
    const updatedTasks = tasks.map(t => {
      const inCheckpoint = finalTaskIds.includes(t.id);
      const wasInCheckpoint = t.roundId === cpId;
      return {
        ...t,
        roundId: inCheckpoint ? cpId : (wasInCheckpoint ? undefined : t.roundId),
        requirement: inCheckpoint ? "required" as const : (wasInCheckpoint ? "available" as const : t.requirement),
      };
    });
    setTasks(updatedTasks);
    updatedTasks.forEach((t, i) => { mockTasks[i] = t; });

    // Sync job roundIds + requirement flags
    const updatedJobs = jobs.map(j => {
      const inCheckpoint = finalJobIds.includes(j.id);
      const wasInCheckpoint = (j as any).roundId === cpId;
      return {
        ...j,
        roundId: inCheckpoint ? cpId : (wasInCheckpoint ? undefined : (j as any).roundId),
        requirement: inCheckpoint ? "required" as const : (wasInCheckpoint ? "available" as const : (j as any).requirement),
      };
    });
    setJobs(updatedJobs);
    updatedJobs.forEach((j, i) => { mockJobs[i] = j; });

    playSuccess();
    saveAndToast([saveCheckpoints, saveTasks, saveJobs], "Checkpoint saved to cloud ✓");
    setCpModal(false);
  };

  const handleDeleteCP = (cpId: string) => {
    playDelete();
    setCheckpoints(prev => prev.filter(c => c.id !== cpId));
    const idx = mockCheckpoints.findIndex(c => c.id === cpId);
    if (idx >= 0) mockCheckpoints.splice(idx, 1);
    // Clear roundId on tasks and jobs that belonged to this checkpoint, set them as available
    setTasks(prev => prev.map(t => t.roundId === cpId ? { ...t, roundId: undefined, requirement: "available" as const } : t));
    setJobs(prev => prev.map(j => (j as any).roundId === cpId ? { ...j, roundId: undefined, requirement: "available" as const } : j));
    saveAndToast([saveCheckpoints, saveTasks, saveJobs], "Checkpoint deleted — saved to cloud ✓");
  };

  const toggleCpJob = (jobId: string) => {
    setCpJobIds(prev => prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]);
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
      assignedTo: editingTask.assignedTo || (editingTask.cohort && editingTask.cohort !== "all" ? [editingTask.cohort] : "all"),
      status: (editingTask.status as Task["status"]) || "active",
      roundId: editingTask.roundId,
      link: cleanLinks[0] || "",
      links: cleanLinks,
      completionMode: (editingTask as any).completionMode || "unlimited",
      fromJobId: (editingTask as any).fromJobId,
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
    setEditingJob({ coinType: "", xpValue: 500, cohort: "all", maxHires: 1, intervalType: "weekly" });
    setJobBadges([]);
    setJobBadgeSearch("");
    setJobBadgeDropdown(false);
    setJobModal(true);
  };

  const openEditJob = (job: Job) => {
    playClick();
    setEditingJob({ ...job });
    setJobBadges((job as any).rewardBadges ?? []);
    setJobBadgeSearch("");
    setJobBadgeDropdown(false);
    setJobModal(true);
  };

  // Hire a player for a job and transform into a task
  const hirePlayerForJob = (jobId: string, playerId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const hiredPlayers = [...(job.hiredPlayers || []), playerId];
    const isFull = hiredPlayers.length >= (job.maxHires || 1);

    // Create a task from this job for the hired player
    const newTaskId = `task_job_${jobId}_${playerId}_${Date.now()}`;
    const newTask: Task = {
      id: newTaskId,
      title: `[JOB] ${job.title}`,
      description: `Hired for job: ${job.description}`,
      coinType: job.coinType || "",
      xpValue: job.xpValue || 500,
      rewardBadges: (job as any).rewardBadges || [],
      cohort: "all",
      status: "open" as Task["status"],
      roundId: undefined,
      link: job.link,
      links: [],
      assignedTo: [playerId],
      completionMode: "one-time",
      fromJobId: jobId,
    } as Task;
    setTasks(prev => [...prev, newTask]);
    mockTasks.push(newTask);

    // Update the job
    const updatedJob = {
      ...job,
      hiredPlayers,
      filledSlots: hiredPlayers.length,
      status: isFull ? "filled" as Job["status"] : job.status,
      transformedTaskIds: [...(job.transformedTaskIds || []), newTaskId],
    };
    setJobs(prev => prev.map(j => j.id === jobId ? updatedJob : j));
    const idx = mockJobs.findIndex(j => j.id === jobId);
    if (idx >= 0) mockJobs[idx] = updatedJob;

    playSuccess();
    saveAndToast([saveJobs, saveTasks], `${mockUsers.find(u => u.id === playerId)?.brandName || "Player"} hired — task created ✓`);
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
      assignedTo: editingJob.assignedTo || (editingJob.cohort && editingJob.cohort !== "all" ? [editingJob.cohort] : "all"),
      status: (editingJob.status as Job["status"]) || "open",
      maxHires: editingJob.maxHires || 1,
      hiredPlayers: editingJob.hiredPlayers || [],
      timeline: editingJob.timeline,
      milestones: (editingJob.milestones || []).filter((m: any) => m.title.trim()),
      intervalType: editingJob.intervalType || "weekly",
      applicants: editingJob.applicants || [],
      approved: editingJob.approved || [],
      rewardBadges: jobBadges,
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
    setEditingProject({ status: "active", assignedTo: "all", xcRewardPool: 0, accessMode: "open", repeatable: false });
    setProjTaskIds([]);
    setProjJobIds([]);
    setProjBadges([]);
    setProjBadgeSearch("");
    setProjBadgeDropdown(false);
    setProjectModal(true);
  };

  const openEditProject = (p: Project) => {
    playClick();
    setEditingProject({ ...p });
    setProjTaskIds([...p.taskIds]);
    setProjJobIds([...p.jobIds]);
    setProjBadges((p as any).rewardBadges ?? []);
    setProjBadgeSearch("");
    setProjBadgeDropdown(false);
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
      rewardBadges: projBadges,
      accessMode: editingProject.accessMode || "open",
      closedPlayerIds: editingProject.closedPlayerIds || [],
      repeatable: editingProject.repeatable || false,
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

  // ── Duplicate handlers ──────────────────────────────────────────────────

  const duplicateCheckpoint = (cp: Checkpoint) => {
    playClick();
    const newId = `cp_${Date.now()}`;
    const dup: Checkpoint = { ...cp, id: newId, name: `${cp.name} (Copy)`, status: "upcoming" as const };
    setCheckpoints(prev => [...prev, dup]);
    mockCheckpoints.push(dup);
    // Duplicate task assignments too
    const cpTasksCopy = tasks.filter(t => t.roundId === cp.id);
    cpTasksCopy.forEach(t => {
      const newTaskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const dupTask: Task = { ...t, id: newTaskId, roundId: newId, status: "open" as Task["status"] };
      setTasks(prev => [...prev, dupTask]);
      mockTasks.push(dupTask);
    });
    playSuccess();
    saveAndToast([saveCheckpoints, saveTasks], "Checkpoint duplicated ✓");
  };

  const duplicateTask = (task: Task) => {
    playClick();
    const newId = `task_${Date.now()}`;
    const dup: Task = { ...task, id: newId, title: `${task.title} (Copy)`, status: "open" as Task["status"] };
    setTasks(prev => [...prev, dup]);
    mockTasks.push(dup);
    playSuccess();
    saveAndToast([saveTasks], "Task duplicated ✓");
  };

  const duplicateJob = (job: Job) => {
    playClick();
    const newId = `job_${Date.now()}`;
    const dup: Job = { ...job, id: newId, title: `${job.title} (Copy)`, status: "open" as Job["status"], applicants: [], approved: [], hiredPlayers: [], filledSlots: 0, transformedTaskIds: [] };
    setJobs(prev => [...prev, dup]);
    mockJobs.push(dup);
    playSuccess();
    saveAndToast([saveJobs], "Job duplicated ✓");
  };

  const duplicateProject = (proj: Project) => {
    playClick();
    const newId = `proj_${Date.now()}`;
    const dup: Project = { ...proj, id: newId, title: `${proj.title} (Copy)`, status: "active" as Project["status"] };
    setProjects(prev => [...prev, dup]);
    mockProjects.push(dup);
    playSuccess();
    saveAndToast([saveProjects], "Project duplicated ✓");
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
          {(["checkpoints", "tasks", "jobs", "projects", "pitches", "cohort-groups"] as const).map(t => (
            <button key={t} onClick={() => { playNav(); setTab(t); }} style={tabBtnSx(tab === t)}>
              {t === "checkpoints" ? "🏁 CHECKPOINTS" : t === "tasks" ? "✅ TASKS" : t === "jobs" ? "📋 JOB BOARD" : t === "projects" ? "🗂 PROJECTS" : t === "pitches" ? `💡 PITCHES${allPitches.filter(p => p.status === "submitted").length ? ` (${allPitches.filter(p => p.status === "submitted").length})` : ""}` : "👥 COHORT GROUPS"}
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
                  const cpTasks = tasks.filter(t => t.roundId === cp.id);
                  const assignedCount = cpTasks.length;
                  const cpBadgeXC = calcBadgeXC((cp as any).rewardBadges);
                  const cpTaskXC = cpTasks.reduce((sum, t) => sum + ((t as any).xpValue || 0), 0);
                  const cpTotalXC = cpBadgeXC + cpTaskXC;
                  const cpTotalBadges = ((cp as any).rewardBadges?.length || 0) + cpTasks.reduce((s, t) => s + ((t as any).rewardBadges?.length || 0), 0);
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
                          <EarningsPill label="Total" xc={cpTotalXC} badges={cpTotalBadges} />
                          {cp.assignTo && cp.assignTo !== "all" && (
                            <span style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "8px" }}>
                              👥 {cp.assignTo}
                            </span>
                          )}
                        </div>
                        {/* Duplicate button */}
                        <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                          <button onClick={(e) => { e.stopPropagation(); duplicateCheckpoint(cp); }}
                            style={{ padding: "5px 12px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)",
                              borderRadius: "8px", color: "#00d4ff", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                            📋 Duplicate
                          </button>
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
                      {["Task", "Badge Type", "XC Value", "Cohort", "Checkpoint", "Status", "Mode", "Type", ""].map(h => (
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
                            <span style={{ color: "#f5c842", fontWeight: 800, fontSize: "14px" }}>
                              {fmtXC((task.xpValue || 0) + calcBadgeXC((task as any).rewardBadges))} XC
                            </span>
                            {(task as any).rewardBadges?.length > 0 && (
                              <span style={{ display: "block", fontSize: "10px", color: "#4f8ef7", fontWeight: 600, marginTop: "2px" }}>
                                {(task as any).rewardBadges.length} badge{(task as any).rewardBadges.length !== 1 ? "s" : ""}
                              </span>
                            )}
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
                            {(task as any).fromJobId ? (
                              <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                                background: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.2)", color: "#f5c842" }}>
                                📌 Job
                              </span>
                            ) : (task as any).completionMode === "one-time" ? (
                              <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444" }}>
                                1x Only
                              </span>
                            ) : (
                              <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                                background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", color: "#22c55e" }}>
                                ♾ Open
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            {task.roundId ? (
                              <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                                background: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.2)", color: "#f5c842" }}>
                                📌 Required
                              </span>
                            ) : (
                              <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                                background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)", color: "#00d4ff" }}>
                                📂 Available
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button onClick={() => openEditTask(task as Task)}
                                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                                  borderRadius: "8px", color: "rgba(255,255,255,0.6)", padding: "6px 14px",
                                  cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>Edit</button>
                              <button onClick={() => duplicateTask(task as Task)}
                                style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)",
                                  borderRadius: "8px", color: "#00d4ff", padding: "6px 14px",
                                  cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>📋 Duplicate</button>
                            </div>
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

        {/* ══════════════════ JOB BOARD TAB ══════════════════ */}
        {tab === "jobs" && (
          <div>
            {/* Job Board Header */}
            <div style={{
              background: "linear-gradient(135deg, rgba(245,200,66,0.08), rgba(255,140,50,0.06))",
              border: "1px solid rgba(245,200,66,0.15)", borderRadius: "16px",
              padding: "24px 28px", marginBottom: "24px",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 900, color: "#f5c842",
                  display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "28px" }}>📋</span> JOB BOARD
                </h2>
                <p style={{ margin: 0, color: "rgba(245,200,66,0.6)", fontSize: "13px", letterSpacing: "0.05em" }}>
                  {jobs.filter(j => j.status === "open").length} open posting{jobs.filter(j => j.status === "open").length !== 1 ? "s" : ""} · {jobs.length} total
                </p>
              </div>
              <button onClick={openNewJob} style={{
                padding: "12px 24px", borderRadius: "12px", fontSize: "14px", fontWeight: 800,
                background: "linear-gradient(135deg, #f5c842, #ff8c32)",
                border: "none", color: "#0a0a0f", cursor: "pointer",
                boxShadow: "0 4px 16px rgba(245,200,66,0.3)",
                display: "flex", alignItems: "center", gap: "8px"
              }}>
                <span style={{ fontSize: "18px" }}>+</span> Post New Job
              </button>
            </div>

            {/* Status filter pills */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
              {["all", "open", "filled", "in_progress", "completed", "closed"].map(s => {
                const count = s === "all" ? jobs.length : jobs.filter(j => j.status === s).length;
                if (count === 0 && s !== "all") return null;
                return (
                  <span key={s} style={{
                    padding: "5px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                    background: s === "all" ? "rgba(245,200,66,0.1)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${s === "all" ? "rgba(245,200,66,0.2)" : "rgba(255,255,255,0.06)"}`,
                    color: s === "all" ? "#f5c842" : s === "open" ? "#22c55e" : s === "filled" ? "#4f8ef7" : s === "completed" ? "#a78bfa" : "rgba(255,255,255,0.4)",
                    cursor: "default"
                  }}>
                    {s === "all" ? "All" : s.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())} ({count})
                  </span>
                );
              })}
            </div>

            {jobs.length === 0 ? (
              <div style={{
                background: "rgba(245,200,66,0.03)", border: "2px dashed rgba(245,200,66,0.15)",
                borderRadius: "20px", padding: "60px", textAlign: "center"
              }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📋</div>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "16px", margin: "0 0 8px" }}>No job postings yet</p>
                <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px", margin: 0 }}>Post a job to the board and let players apply!</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {jobs.map(job => {
                  const isOpen = job.status === "open";
                  const isFilled = job.status === "filled" || job.status === "in_progress";
                  const isDone = job.status === "completed";
                  const isClosed = job.status === "closed";
                  const hired = job.hiredPlayers?.length || 0;
                  const max = job.maxHires || 1;
                  const applicantCount = job.applicants?.length || 0;
                  const borderColor = isOpen ? "rgba(34,197,94,0.2)" : isFilled ? "rgba(79,142,247,0.2)" : isDone ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.06)";
                  const accentColor = isOpen ? "#22c55e" : isFilled ? "#4f8ef7" : isDone ? "#a78bfa" : "rgba(255,255,255,0.3)";

                  return (
                    <div key={job.id} style={{
                      background: "rgba(22,22,31,0.95)", border: `1px solid ${borderColor}`,
                      borderRadius: "16px", overflow: "hidden", cursor: "pointer",
                      transition: "border-color 0.2s"
                    }} onClick={() => openEditJob(job)}>
                      {/* Left accent bar */}
                      <div style={{ display: "flex" }}>
                        <div style={{ width: "4px", background: accentColor, flexShrink: 0 }} />
                        <div style={{ flex: 1, padding: "22px 24px" }}>
                          {/* Top row: title + status */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
                                  color: accentColor }}>
                                  {isOpen ? "NOW HIRING" : isFilled ? "POSITIONS FILLED" : isDone ? "COMPLETED" : isClosed ? "CLOSED" : job.status.toUpperCase()}
                                </span>
                                {job.intervalType && (
                                  <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700,
                                    background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa" }}>
                                    {job.intervalType}
                                  </span>
                                )}
                              </div>
                              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#f0f0ff" }}>{job.title}</h3>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                              <span style={{ fontSize: "20px", fontWeight: 900, color: "#f5c842" }}>
                                {fmtXC((job.xpValue || 0) + calcBadgeXC((job as any).rewardBadges))} XC
                              </span>
                              {(job as any).rewardBadges?.length > 0 && (
                                <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#4f8ef7" }}>
                                    {(job as any).rewardBadges.length} badge{(job as any).rewardBadges.length !== 1 ? "s" : ""}
                                  </span>
                                  {(job as any).rewardBadges.slice(0, 3).map((b: any, i: number) => (
                                    <span key={i} style={{ padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700,
                                      background: "rgba(79,142,247,0.1)", color: "#4f8ef7" }}>{b.name}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Description */}
                          {job.description && (
                            <p style={{ margin: "0 0 14px", fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, maxWidth: "600px" }}>
                              {job.description}
                            </p>
                          )}

                          {/* Info row */}
                          <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
                            {/* Slots */}
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "14px" }}>👤</span>
                              <div>
                                <span style={{ fontSize: "13px", fontWeight: 700, color: hired >= max ? "#22c55e" : "#f0f0ff" }}>{hired}/{max}</span>
                                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginLeft: "4px" }}>hired</span>
                              </div>
                            </div>

                            {/* Applicants */}
                            {applicantCount > 0 && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "14px" }}>📩</span>
                                <span style={{ fontSize: "13px", fontWeight: 700, color: "#f5c842" }}>{applicantCount}</span>
                                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>applicant{applicantCount !== 1 ? "s" : ""}</span>
                              </div>
                            )}

                            {/* Cohort */}
                            <span style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                              {job.cohort || "All Cohorts"}
                            </span>

                            {/* Timeline */}
                            {job.timeline?.start && (
                              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                                {job.timeline.start} → {job.timeline.end || "Ongoing"}
                              </span>
                            )}

                            {/* Actions */}
                            <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                              <button onClick={(e) => { e.stopPropagation(); duplicateJob(job); }}
                                style={{ padding: "5px 12px", background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)",
                                  borderRadius: "8px", color: "#00d4ff", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                                📋 Duplicate
                              </button>
                            </div>
                          </div>

                          {/* Task completion progress bar (when job has transformed tasks) */}
                          {(job.transformedTaskIds?.length ?? 0) > 0 && (() => {
                            const total = job.transformedTaskIds!.length;
                            const completed = job.transformedTaskIds!.filter(tid => {
                              const t = tasks.find(tk => tk.id === tid);
                              return t && t.status === "approved";
                            }).length;
                            const pct = Math.round((completed / total) * 100);
                            return (
                              <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Task Completion</span>
                                  <span style={{ fontSize: "12px", color: pct === 100 ? "#22c55e" : "#a78bfa", fontWeight: 700 }}>
                                    {completed}/{total} tasks done ({pct}%)
                                  </span>
                                </div>
                                <div style={{ height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                  <div style={{
                                    width: `${pct}%`, height: "100%", borderRadius: "4px",
                                    background: pct === 100 ? "linear-gradient(90deg, #22c55e, #4ade80)" : "linear-gradient(90deg, #f5c842, #ff8c32)",
                                    transition: "width 0.5s"
                                  }} />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
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
                  const projTasks = tasks.filter(t => proj.taskIds.includes(t.id));
                  const projJobs = jobs.filter(j => proj.jobIds.includes(j.id));
                  const projBadgeXC = calcBadgeXC((proj as any).rewardBadges);
                  const projTaskXC = projTasks.reduce((s, t) => s + ((t as any).xpValue || 0), 0);
                  const projJobXC = projJobs.reduce((s, j) => s + (j.xpValue || 0), 0);
                  const projTotalXC = projBadgeXC + (proj.xcRewardPool || 0) + projTaskXC + projJobXC;
                  const projTotalBadges = ((proj as any).rewardBadges?.length || 0)
                    + projTasks.reduce((s, t) => s + ((t as any).rewardBadges?.length || 0), 0)
                    + projJobs.reduce((s, j) => s + ((j as any).rewardBadges?.length || 0), 0);
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
                        <EarningsPill label="Total" xc={projTotalXC} badges={projTotalBadges} />
                        {proj.dueDate && (
                          <span style={{ background: "rgba(255,255,255,0.05)", padding: "3px 10px", borderRadius: "8px", color: "rgba(255,255,255,0.4)" }}>
                            📅 Due {proj.dueDate}
                          </span>
                        )}
                      </div>
                      {inCPs.length > 0 && (
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                          {inCPs.map(cp => (
                            <span key={cp.id} style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", color: "#22c55e", fontWeight: 700 }}>
                              📌 {cp.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Duplicate button */}
                      <button onClick={(e) => { e.stopPropagation(); duplicateProject(proj); }}
                        style={{ padding: "5px 12px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)",
                          borderRadius: "8px", color: "#00d4ff", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                        📋 Duplicate
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {/* ══════════════════ PITCHES TAB ══════════════════ */}
        {tab === "pitches" && (() => {
          const PATHWAYS_MAP: Record<string, { label: string; icon: string }> = {
            "professional-entrepreneur": { label: "Professional Entrepreneur", icon: "📖" },
            "content-creator": { label: "Content Creator", icon: "🎬" },
            "digital-artist": { label: "Digital Artist", icon: "🎨" },
            "3d-modeler": { label: "3D Modeler", icon: "🧊" },
            "cs-ai-specialist": { label: "CS / AI Specialist", icon: "🤖" },
            "sound-designer": { label: "Sound Designer", icon: "🎵" },
            "game-designer": { label: "Game Designer", icon: "🎮" },
          };
          const pitchStatusColors: Record<string, { bg: string; border: string; text: string }> = {
            draft:        { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.15)", text: "rgba(255,255,255,0.5)" },
            submitted:    { bg: "rgba(79,142,247,0.12)",  border: "rgba(79,142,247,0.4)",   text: "#4f8ef7" },
            under_review: { bg: "rgba(245,200,66,0.1)",   border: "rgba(245,200,66,0.4)",   text: "#f5c842" },
            approved:     { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.4)",    text: "#22c55e" },
            rejected:     { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.4)",    text: "#ef4444" },
            live:         { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.4)",  text: "#a78bfa" },
          };
          const sorted = [...allPitches].sort((a, b) => {
            const order: Record<string, number> = { submitted: 0, under_review: 1, approved: 2, live: 3, rejected: 4, draft: 5 };
            return (order[a.status] ?? 9) - (order[b.status] ?? 9);
          });
          const submitted = allPitches.filter(p => p.status === "submitted").length;
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                  {allPitches.length} pitch{allPitches.length !== 1 ? "es" : ""}{submitted > 0 ? ` · ${submitted} awaiting review` : ""}
                </p>
              </div>
              {sorted.length === 0 ? (
                <div style={{ ...cardSx, padding: "60px", textAlign: "center" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>💡</div>
                  <h3 style={{ color: "#f0f0ff", margin: "0 0 8px" }}>No Pitches Yet</h3>
                  <p style={{ color: "rgba(255,255,255,0.35)", margin: 0, fontSize: "14px" }}>
                    When players submit project pitches, they will appear here for review.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {sorted.map(pitch => {
                    const pw = PATHWAYS_MAP[pitch.pathway];
                    const sc = pitchStatusColors[pitch.status] || pitchStatusColors.draft;
                    const creator = mockUsers.find(u => u.id === pitch.creatorId);
                    return (
                      <div key={pitch.id} style={{
                        ...cardSx, padding: "20px", borderColor: sc.border,
                        cursor: (pitch.status === "submitted" || pitch.status === "under_review") ? "pointer" : "default",
                      }} onClick={() => {
                        if (pitch.status === "submitted" || pitch.status === "under_review") {
                          playModalOpen();
                          setReviewingPitch(pitch);
                          setReviewNotes(pitch.reviewNotes || "");
                          setPitchReviewModal(true);
                        }
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                              <span style={{
                                padding: "3px 12px", borderRadius: "20px", fontSize: "10px", fontWeight: 700,
                                background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text,
                                textTransform: "uppercase", letterSpacing: "0.06em",
                              }}>{pitch.status.replace("_", " ")}</span>
                              {pw && <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>{pw.icon} {pw.label}</span>}
                              {creator && <span style={{ fontSize: "12px", color: "rgba(0,212,255,0.5)" }}>by {creator.brandName || creator.name}</span>}
                            </div>
                            <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 800, color: "#f0f0ff" }}>{pitch.title}</h3>
                            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                              {pitch.description.length > 150 ? pitch.description.slice(0, 150) + "..." : pitch.description}
                            </p>
                            <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
                              <span>🏅 {pitch.badgeName}</span>
                              <span>💎 {pitch.xcValue} XC</span>
                              <span>📊 {pitch.residualPercent}% residual</span>
                              {pitch.estimatedTime && <span>⏱ {pitch.estimatedTime}</span>}
                              {pitch.mediaLinks.length > 0 && <span>🔗 {pitch.mediaLinks.length} link{pitch.mediaLinks.length !== 1 ? "s" : ""}</span>}
                            </div>
                          </div>
                          {pitch.image && (
                            <img src={pitch.image} alt="" style={{ width: "72px", height: "72px", borderRadius: "12px", objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
                          )}
                        </div>
                        {pitch.status === "live" && (
                          <div style={{ marginTop: "10px", display: "flex", gap: "16px", fontSize: "12px" }}>
                            <span style={{ color: "#a78bfa", fontWeight: 700 }}>💰 {(pitch.totalResidualEarned || 0).toLocaleString()} XC paid out</span>
                            <span style={{ color: "rgba(255,255,255,0.35)" }}>{pitch.completionCount || 0} completions</span>
                          </div>
                        )}
                        {(pitch.status === "submitted" || pitch.status === "under_review") && (
                          <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                            <button onClick={(e) => { e.stopPropagation(); playModalOpen(); setReviewingPitch(pitch); setReviewNotes(""); setPitchReviewModal(true); }} style={{
                              padding: "6px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e",
                            }}>Review</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ══════════════════ COHORT GROUPS TAB ══════════════════ */}
        {tab === "cohort-groups" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                  {cohortGroups.length} group{cohortGroups.length !== 1 ? "s" : ""} · {cohorts.length} cohort{cohorts.length !== 1 ? "s" : ""} available
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>
                  Groups let you quickly assign content to pre-selected sets of cohorts. A cohort can belong to multiple groups.
                </p>
              </div>
              <button onClick={() => { playClick(); setEditingGroup({ name: "", cohorts: [], color: "#a78bfa" }); setGroupModal(true); }}
                style={addBtnSx}>＋ New Group</button>
            </div>

            {cohortGroups.length === 0 ? (
              <div style={{ ...cardSx, padding: "60px", textAlign: "center" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>👥</div>
                <h3 style={{ color: "#f0f0ff", margin: "0 0 8px" }}>No Cohort Groups Yet</h3>
                <p style={{ color: "rgba(255,255,255,0.35)", margin: 0, fontSize: "14px" }}>
                  Create groups to quickly assign checkpoints, tasks, and projects to multiple cohorts at once.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {cohortGroups.map(g => (
                  <div key={g.id} style={{
                    ...cardSx, padding: "20px", display: "flex", alignItems: "center", gap: "16px",
                    borderColor: `${g.color || "#a78bfa"}25`,
                  }}>
                    <div style={{
                      width: "48px", height: "48px", borderRadius: "12px",
                      background: `${g.color || "#a78bfa"}15`,
                      border: `2px solid ${g.color || "#a78bfa"}40`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "20px", fontWeight: 900, color: g.color || "#a78bfa",
                    }}>📁</div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 800, color: g.color || "#a78bfa" }}>{g.name}</h3>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {g.cohorts.map(c => (
                          <span key={c} style={{
                            padding: "2px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                            background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.25)", color: "#4f8ef7",
                          }}>{c}</span>
                        ))}
                        {g.cohorts.length === 0 && (
                          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>No cohorts assigned</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => { playClick(); setEditingGroup({ ...g }); setGroupModal(true); }}
                        style={{ padding: "6px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                          background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.25)", color: "#4f8ef7" }}>Edit</button>
                      <button onClick={() => {
                        if (!confirm(`Delete group "${g.name}"?`)) return;
                        playDelete();
                        const next = cohortGroups.filter(x => x.id !== g.id);
                        setCohortGroups(next);
                        mockCohortGroups.splice(0, mockCohortGroups.length, ...next);
                        saveAndToast([saveCohortGroups], "Group deleted ✓");
                      }} style={{ padding: "6px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ══════════════════ COHORT GROUP MODAL ══════════════════ */}
      {groupModal && editingGroup && (
        <ModalBG onClose={() => { playClick(); setGroupModal(false); }}>
          <div style={{ padding: "32px" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: "20px", fontWeight: 900, color: "#f0f0ff" }}>
              {editingGroup.id ? "Edit Cohort Group" : "New Cohort Group"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Field label="Group Name *">
                <input value={editingGroup.name || ""} onChange={e => setEditingGroup(p => p ? { ...p, name: e.target.value } : p)}
                  placeholder="e.g. Period 1 & 2" style={inputSx} />
              </Field>
              <Field label="Accent Color">
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {["#a78bfa", "#4f8ef7", "#00d4ff", "#22c55e", "#f5c842", "#ef4444", "#ec4899", "#f97316"].map(c => (
                    <button key={c} type="button" onClick={() => setEditingGroup(p => p ? { ...p, color: c } : p)}
                      style={{
                        width: "32px", height: "32px", borderRadius: "8px", cursor: "pointer",
                        background: c, border: editingGroup.color === c ? "3px solid white" : "2px solid transparent",
                        boxShadow: editingGroup.color === c ? `0 0 12px ${c}60` : "none",
                      }} />
                  ))}
                </div>
              </Field>
              <div>
                <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>Select Cohorts</p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {cohorts.map(c => {
                    const on = (editingGroup.cohorts || []).includes(c);
                    return (
                      <button key={c} type="button"
                        onClick={() => setEditingGroup(p => {
                          if (!p) return p;
                          const cur = p.cohorts || [];
                          return { ...p, cohorts: on ? cur.filter(x => x !== c) : [...cur, c] };
                        })}
                        style={{
                          padding: "8px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
                          cursor: "pointer", transition: "all 0.15s", border: "1px solid",
                          background: on ? `${editingGroup.color || "#a78bfa"}20` : "rgba(255,255,255,0.04)",
                          borderColor: on ? `${editingGroup.color || "#a78bfa"}60` : "rgba(255,255,255,0.1)",
                          color: on ? (editingGroup.color || "#a78bfa") : "rgba(255,255,255,0.4)",
                        }}>{c}{on && " ✓"}</button>
                    );
                  })}
                  {cohorts.length === 0 && (
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>No cohorts found — add players with cohort assignments first.</p>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button onClick={() => { playClick(); setGroupModal(false); }}
                style={{ padding: "11px 24px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "10px", color: "rgba(255,255,255,0.6)", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => {
                if (!editingGroup.name?.trim()) { playError(); return; }
                const isNew = !editingGroup.id;
                const saved: CohortGroup = {
                  id: editingGroup.id || `cg_${Date.now()}`,
                  name: editingGroup.name || "",
                  cohorts: editingGroup.cohorts || [],
                  color: editingGroup.color || "#a78bfa",
                };
                let next: CohortGroup[];
                if (isNew) {
                  next = [...cohortGroups, saved];
                } else {
                  next = cohortGroups.map(g => g.id === saved.id ? saved : g);
                }
                setCohortGroups(next);
                mockCohortGroups.splice(0, mockCohortGroups.length, ...next);
                playSuccess();
                saveAndToast([saveCohortGroups], "Cohort group saved ✓");
                setGroupModal(false);
              }} style={{ padding: "11px 28px", background: `linear-gradient(135deg, ${editingGroup.color || "#a78bfa"}, #7c3aed)`,
                  border: "none", borderRadius: "10px", color: "white", fontWeight: 800, cursor: "pointer",
                  boxShadow: `0 0 20px ${editingGroup.color || "#a78bfa"}40`, fontSize: "14px" }}>
                {editingGroup.id ? "Save Changes" : "Create Group"}
              </button>
            </div>
          </div>
        </ModalBG>
      )}

      {/* ══════════════════ PITCH REVIEW MODAL ══════════════════ */}
      {pitchReviewModal && reviewingPitch && (
        <ModalBG onClose={() => { playClick(); setPitchReviewModal(false); }}>
          <div style={{ padding: "32px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 900, color: "#f0f0ff" }}>
              Review Pitch 💡
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: "13px", color: "rgba(0,212,255,0.5)" }}>
              by {mockUsers.find(u => u.id === reviewingPitch.creatorId)?.brandName || mockUsers.find(u => u.id === reviewingPitch.creatorId)?.name || "Unknown"}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Pitch details (read-only) */}
              <div style={{ padding: "16px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 800, color: "#f0f0ff" }}>{reviewingPitch.title}</h3>
                <p style={{ margin: "0 0 12px", fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{reviewingPitch.description}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", fontSize: "12px" }}>
                  <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Pathway:</span> <span style={{ color: "#4f8ef7" }}>{reviewingPitch.pathway}</span></div>
                  <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Badge:</span> <span style={{ color: "#f5c842" }}>{reviewingPitch.badgeName}</span></div>
                  <div><span style={{ color: "rgba(255,255,255,0.3)" }}>XC Value:</span> <span style={{ color: "#22c55e" }}>{reviewingPitch.xcValue}</span></div>
                  <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Residual:</span> <span style={{ color: "#a78bfa" }}>{reviewingPitch.residualPercent}%</span></div>
                  <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Est. Time:</span> <span style={{ color: "rgba(255,255,255,0.6)" }}>{reviewingPitch.estimatedTime || "—"}</span></div>
                  <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Per completion:</span> <span style={{ color: "#a78bfa" }}>{Math.round(reviewingPitch.xcValue * reviewingPitch.residualPercent / 100)} XC</span></div>
                </div>
                {reviewingPitch.courseUrl && (
                  <p style={{ margin: "10px 0 0", fontSize: "12px" }}>
                    <span style={{ color: "rgba(255,255,255,0.3)" }}>Course URL: </span>
                    <a href={reviewingPitch.courseUrl} target="_blank" rel="noreferrer" style={{ color: "#4f8ef7" }}>{reviewingPitch.courseUrl}</a>
                  </p>
                )}
                {reviewingPitch.mediaLinks.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>Media Links:</span>
                    {reviewingPitch.mediaLinks.map((link, i) => (
                      <a key={i} href={link} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: "12px", color: "#4f8ef7", marginTop: "4px" }}>{link}</a>
                    ))}
                  </div>
                )}
                {reviewingPitch.image && (
                  <img src={reviewingPitch.image} alt="" style={{ marginTop: "12px", maxWidth: "200px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)" }} />
                )}
              </div>

              {/* Review notes */}
              <Field label="Review Notes / Feedback">
                <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                  placeholder="Add feedback for the player (required for rejection, optional for approval)..."
                  rows={3} style={{ ...inputSx, resize: "vertical" }} />
              </Field>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button onClick={() => { playClick(); setPitchReviewModal(false); }}
                style={{ padding: "11px 24px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "10px", color: "rgba(255,255,255,0.6)", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => {
                if (!reviewNotes.trim()) { playError(); return; }
                // Reject
                const updated: ProjectPitch = {
                  ...reviewingPitch,
                  status: "rejected",
                  reviewedAt: new Date().toISOString(),
                  reviewedBy: user?.id,
                  reviewNotes: reviewNotes.trim(),
                };
                const next = allPitches.map(p => p.id === updated.id ? updated : p);
                setAllPitches(next);
                const idx = mockProjectPitches.findIndex(p => p.id === updated.id);
                if (idx >= 0) mockProjectPitches[idx] = updated;
                playError();
                saveAndToast([saveProjectPitches], "Pitch rejected ✓");
                setPitchReviewModal(false);
              }} style={{ padding: "11px 22px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: "10px", color: "#ef4444", fontWeight: 700, cursor: "pointer" }}>Reject</button>
              <button onClick={() => {
                // Approve — generate a pathway node ID + auto-create Project + Jobs
                const slugPrefix = reviewingPitch.pathway.slice(0, 2);
                const nodeId = `${slugPrefix}-pitch-${Date.now()}`;
                const now = new Date().toISOString();
                const projectId = `proj-pitch-${Date.now()}`;

                // Auto-generate Jobs from pitch's selected Executive Badge roles (or fallback to defaults)
                const generatedJobIds: string[] = [];
                const jobSources = (reviewingPitch.selectedJobs && reviewingPitch.selectedJobs.length > 0)
                  ? reviewingPitch.selectedJobs.map(j => ({ role: j.badgeName, description: j.description, xc: j.xc }))
                  : PITCH_AUTO_JOBS.map(j => ({ role: j.role, description: j.description, xc: Math.round(reviewingPitch.xcValue * 0.15) }));
                jobSources.forEach((jt, i) => {
                  const jobId = `job-pitch-${Date.now()}-${i}`;
                  generatedJobIds.push(jobId);
                  const newJob: Job = {
                    id: jobId,
                    title: `${jt.role} — ${reviewingPitch.title}`,
                    description: jt.description,
                    rewardCoins: [],
                    xcReward: jt.xc,
                    slots: 1,
                    filledSlots: 0,
                    status: "open",
                    createdBy: reviewingPitch.creatorId,
                    createdAt: now,
                    applicants: [],
                    approved: [],
                    assignedTo: "all",
                    maxHires: 1,
                    rewardBadges: [{ name: jt.role, xc: jt.xc }],
                  };
                  mockJobs.push(newJob);
                });

                // Auto-generate Project
                const newProject: Project = {
                  id: projectId,
                  title: reviewingPitch.title,
                  description: reviewingPitch.description,
                  status: "active",
                  taskIds: [],
                  jobIds: generatedJobIds,
                  createdBy: reviewingPitch.creatorId,
                  createdAt: now,
                  assignedTo: "all",
                  xcRewardPool: reviewingPitch.xcValue,
                  image: reviewingPitch.coverArt || reviewingPitch.image,
                  link: reviewingPitch.courseUrl,
                };
                mockProjects.push(newProject);

                const updated: ProjectPitch = {
                  ...reviewingPitch,
                  status: "approved",
                  reviewedAt: now,
                  reviewedBy: user?.id,
                  reviewNotes: reviewNotes.trim() || "Approved!",
                  pathwayNodeId: nodeId,
                  generatedProjectId: projectId,
                  generatedJobIds: generatedJobIds,
                };
                const next = allPitches.map(p => p.id === updated.id ? updated : p);
                setAllPitches(next);
                const idx = mockProjectPitches.findIndex(p => p.id === updated.id);
                if (idx >= 0) mockProjectPitches[idx] = updated;
                playSuccess();
                saveAndToast([saveProjectPitches, saveProjects, saveJobs], "Pitch approved — Project + " + generatedJobIds.length + " Jobs created ✓");
                setPitchReviewModal(false);
              }} style={{ padding: "11px 28px", background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  border: "none", borderRadius: "10px", color: "white", fontWeight: 800, cursor: "pointer",
                  boxShadow: "0 0 20px rgba(34,197,94,0.3)", fontSize: "14px" }}>Approve & Publish</button>
            </div>
          </div>
        </ModalBG>
      )}

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

              {/* Status */}
              <Field label="Status">
                <select value={editingCP.status || "upcoming"} onChange={e => setEditingCP(p => ({ ...p, status: e.target.value as Checkpoint["status"] }))} style={{ ...inputSx, cursor: "pointer" }}>
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </Field>
              {/* Assign To — multi-cohort */}
              <MultiCohortSelector
                label="Assign To"
                value={(() => {
                  const v = (editingCP as any).assignTo ?? (editingCP as any).assignedTo;
                  if (!v || v === "all") return "all";
                  if (Array.isArray(v)) return v as string[];
                  return [v]; // legacy single-string → wrap in array
                })()}
                onChange={v => setEditingCP(p => ({ ...p, assignTo: v }))}
                cohorts={cohorts}
                groups={mockCohortGroups}
              />

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

              {/* Multi-badge selector for checkpoint */}
              <Field label={`Completion Badges (${cpBadges.length} · ${cpBadges.reduce((s, b) => s + b.xc, 0)} XC)`}>
                {cpBadges.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                    {cpBadges.map((badge, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, background: "rgba(79,142,247,0.12)", border: "1px solid rgba(79,142,247,0.3)", color: "#4f8ef7" }}>
                        {badge.name} <span style={{ color: "#f5c842", fontFamily: "monospace" }}>{badge.xc} XC</span>
                        <span onClick={() => setCpBadges(prev => prev.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: "rgba(255,255,255,0.4)", marginLeft: "2px", fontSize: "14px" }}>×</span>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                  <input value={cpBadgeSearch} onChange={e => { setCpBadgeSearch(e.target.value); setCpBadgeDropdown(true); }} onFocus={() => setCpBadgeDropdown(true)} placeholder="Search and add badges…" style={inputSx} />
                  {cpBadgeDropdown && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, maxHeight: "180px", overflowY: "auto", marginTop: "4px", background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                      {COIN_CATEGORIES.map(cat => {
                        const filtered = cat.coins.filter(c => (!cpBadgeSearch || c.name.toLowerCase().includes(cpBadgeSearch.toLowerCase())) && !cpBadges.some(b => b.name === c.name));
                        if (filtered.length === 0) return null;
                        return (<div key={cat.name}>
                          <div style={{ padding: "6px 12px", fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{cat.name.toUpperCase()}</div>
                          {filtered.map(coin => (<div key={coin.name} onClick={() => { setCpBadges(prev => [...prev, { name: coin.name, xc: coin.xc }]); setCpBadgeSearch(""); }} style={{ padding: "8px 14px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.7)", display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(79,142,247,0.1)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><span>{coin.name}</span><span style={{ color: "#f5c842", fontSize: "11px", fontFamily: "monospace" }}>{coin.xc} XC</span></div>))}
                        </div>);
                      })}
                    </div>
                  )}
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

              {/* Job selection */}
              <Field label={`Assign Jobs (${cpJobIds.length} selected)`}>
                <div style={{ maxHeight: "180px", overflowY: "auto", background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(245,200,66,0.15)", borderRadius: "10px", padding: "8px" }}>
                  {jobs.length === 0 ? (
                    <p style={{ margin: "16px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>No jobs yet. Create jobs in the Job Board tab first.</p>
                  ) : jobs.map(job => {
                    const checked = cpJobIds.includes(job.id);
                    const includedViaProject = !checked && cpProjectIds.some(pId => {
                      const p = projects.find(pr => pr.id === pId);
                      return p?.jobIds.includes(job.id);
                    });
                    const otherCp = !checked && !includedViaProject && (job as any).roundId && (job as any).roundId !== editingCP.id
                      ? checkpoints.find(c => c.id === (job as any).roundId)
                      : null;
                    return (
                      <label key={job.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px",
                        borderRadius: "8px", cursor: "pointer", transition: "background 0.15s",
                        background: checked ? "rgba(245,200,66,0.1)" : includedViaProject ? "rgba(167,139,250,0.07)" : "transparent" }}>
                        <input type="checkbox" checked={checked || includedViaProject} onChange={() => !includedViaProject && toggleCpJob(job.id)}
                          style={{ width: "16px", height: "16px", accentColor: includedViaProject ? "#a78bfa" : "#f5c842", cursor: includedViaProject ? "default" : "pointer" }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: (checked || includedViaProject) ? "#f0f0ff" : "rgba(255,255,255,0.7)" }}>
                            💼 {job.title}
                          </p>
                          <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                            {job.slots} slots · {(job as any).xpValue || job.xcReward} XC
                            {includedViaProject && <span style={{ color: "#a78bfa", marginLeft: "8px" }}>via project</span>}
                            {otherCp && <span style={{ color: "#f5c842", marginLeft: "8px" }}>⚠ in "{otherCp.name}"</span>}
                          </p>
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: checked ? "#f5c842" : includedViaProject ? "#a78bfa" : "rgba(255,255,255,0.2)" }}>
                          {(checked || includedViaProject) ? "✓" : "+"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </Field>

              {/* Requirement info */}
              <div style={{ background: "rgba(79,142,247,0.06)", border: "1px solid rgba(79,142,247,0.15)", borderRadius: "10px", padding: "12px 16px" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                  <span style={{ color: "#f5c842", fontWeight: 700 }}>📌 Required:</span> Tasks and jobs assigned to this checkpoint become <strong style={{ color: "#4f8ef7" }}>required</strong> for all assigned players.
                  <br /><span style={{ color: "#00d4ff", fontWeight: 700 }}>📂 Available:</span> Tasks and jobs assigned to a cohort but <em>not</em> in a checkpoint remain <strong style={{ color: "#00d4ff" }}>available</strong> (optional).
                </p>
              </div>

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
                <Field label="Completion">
                  <select value={(editingTask as any).completionMode || "unlimited"} onChange={e => setEditingTask(p => ({ ...p, completionMode: e.target.value }))}
                    style={{ ...inputSx, cursor: "pointer" }}>
                    <option value="unlimited">Unlimited (Repeatable)</option>
                    <option value="one-time">One-Time Only</option>
                  </select>
                </Field>
              </div>
              {/* Cohort — multi-select */}
              <MultiCohortSelector
                label="Assign To Cohorts"
                value={(() => {
                  const v = editingTask.assignedTo ?? editingTask.cohort;
                  if (!v || v === "all") return "all";
                  if (Array.isArray(v)) return v as string[];
                  return [v];
                })()}
                onChange={v => setEditingTask(p => ({ ...p, assignedTo: v, cohort: v === "all" ? "all" : (v as string[]).join(",") }))}
                cohorts={cohorts}
                groups={mockCohortGroups}
              />
              {/* From Job indicator */}
              {(editingTask as any).fromJobId && (
                <div style={{ padding: "8px 14px", borderRadius: "10px", background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.15)", fontSize: "12px", color: "#f5c842", fontWeight: 600 }}>
                  📌 This task was created from a Job Posting — assigned to hired player only
                </div>
              )}
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

              {/* Access Control */}
              <div style={{ padding: "16px", borderRadius: "12px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.15)" }}>
                <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 700, color: "#00d4ff", letterSpacing: "0.08em", textTransform: "uppercase" }}>🔒 ACCESS CONTROL</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                  <Field label="Access Mode">
                    <select value={editingProject.accessMode || "open"} onChange={e => setEditingProject(p => ({ ...p, accessMode: e.target.value as "open" | "closed" }))}
                      style={{ ...inputSx, cursor: "pointer" }}>
                      <option value="open">Open (anyone, anytime)</option>
                      <option value="closed">Closed (selected only)</option>
                    </select>
                  </Field>
                  <Field label="Cohort Visibility">
                    <div style={{ marginTop: "-8px" }}>
                      <MultiCohortSelector
                        label=""
                        value={editingProject.assignedTo || "all"}
                        onChange={v => setEditingProject(p => ({ ...p, assignedTo: v }))}
                        cohorts={cohorts}
                        groups={mockCohortGroups}
                      />
                    </div>
                  </Field>
                  <Field label="Repeatable?">
                    <select value={editingProject.repeatable ? "yes" : "no"} onChange={e => setEditingProject(p => ({ ...p, repeatable: e.target.value === "yes" }))}
                      style={{ ...inputSx, cursor: "pointer" }}>
                      <option value="no">No — one completion</option>
                      <option value="yes">Yes — unlimited</option>
                    </select>
                  </Field>
                </div>
                {editingProject.accessMode === "closed" && (
                  <div style={{ marginTop: "12px" }}>
                    <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "1px", textTransform: "uppercase" }}>Select Players (closed access)</p>
                    <div style={{ maxHeight: "140px", overflowY: "auto", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "6px" }}>
                      {mockUsers.filter(u => u.role === "player").map(p => {
                        const checked = (editingProject.closedPlayerIds || []).includes(p.id);
                        return (
                          <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", background: checked ? "rgba(0,212,255,0.08)" : "transparent" }}>
                            <input type="checkbox" checked={checked}
                              onChange={() => setEditingProject(prev => {
                                const ids = prev.closedPlayerIds || [];
                                return { ...prev, closedPlayerIds: checked ? ids.filter(id => id !== p.id) : [...ids, p.id] };
                              })}
                              style={{ width: "14px", height: "14px", accentColor: "#00d4ff", cursor: "pointer" }} />
                            <span style={{ fontSize: "12px", fontWeight: 700, color: checked ? "#f0f0ff" : "rgba(255,255,255,0.5)" }}>{p.brandName || p.name}</span>
                            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>{p.cohort}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Multi-badge selector for project */}
              <Field label={`Completion Badges (${projBadges.length} · ${projBadges.reduce((s, b) => s + b.xc, 0)} XC)`}>
                {projBadges.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                    {projBadges.map((badge, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa" }}>
                        {badge.name} <span style={{ color: "#f5c842", fontFamily: "monospace" }}>{badge.xc} XC</span>
                        <span onClick={() => setProjBadges(prev => prev.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: "rgba(255,255,255,0.4)", marginLeft: "2px", fontSize: "14px" }}>×</span>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                  <input value={projBadgeSearch} onChange={e => { setProjBadgeSearch(e.target.value); setProjBadgeDropdown(true); }} onFocus={() => setProjBadgeDropdown(true)} placeholder="Search and add badges…" style={inputSx} />
                  {projBadgeDropdown && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, maxHeight: "180px", overflowY: "auto", marginTop: "4px", background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                      {COIN_CATEGORIES.map(cat => {
                        const filtered = cat.coins.filter(c => (!projBadgeSearch || c.name.toLowerCase().includes(projBadgeSearch.toLowerCase())) && !projBadges.some(b => b.name === c.name));
                        if (filtered.length === 0) return null;
                        return (<div key={cat.name}>
                          <div style={{ padding: "6px 12px", fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{cat.name.toUpperCase()}</div>
                          {filtered.map(coin => (<div key={coin.name} onClick={() => { setProjBadges(prev => [...prev, { name: coin.name, xc: coin.xc }]); setProjBadgeSearch(""); }} style={{ padding: "8px 14px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.7)", display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.1)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><span>{coin.name}</span><span style={{ color: "#f5c842", fontSize: "11px", fontFamily: "monospace" }}>{coin.xc} XC</span></div>))}
                        </div>);
                      })}
                    </div>
                  )}
                </div>
              </Field>

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
              {/* Cohort — multi-select */}
              <MultiCohortSelector
                label="Assign To Cohorts"
                value={(() => {
                  const v = editingJob.assignedTo ?? editingJob.cohort;
                  if (!v || v === "all") return "all";
                  if (Array.isArray(v)) return v as string[];
                  return [v];
                })()}
                onChange={v => setEditingJob(p => ({ ...p, assignedTo: v, cohort: v === "all" ? "all" : (v as string[]).join(",") }))}
                cohorts={cohorts}
                groups={mockCohortGroups}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <Field label="Status">
                  <select value={editingJob.status || "open"} onChange={e => setEditingJob(p => ({ ...p, status: e.target.value as Job["status"] }))}
                    style={{ ...inputSx, cursor: "pointer" }}>
                    <option value="open">Open</option>
                    <option value="filled">Filled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="closed">Closed</option>
                  </select>
                </Field>
              </div>

              {/* Multi-badge selector for job */}
              <Field label={`Digital Badges (${jobBadges.length} · ${jobBadges.reduce((s, b) => s + b.xc, 0)} XC)`}>
                {jobBadges.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                    {jobBadges.map((badge, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, background: "rgba(79,142,247,0.12)", border: "1px solid rgba(79,142,247,0.3)", color: "#4f8ef7" }}>
                        {badge.name} <span style={{ color: "#f5c842", fontFamily: "monospace" }}>{badge.xc} XC</span>
                        <span onClick={() => setJobBadges(prev => prev.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: "rgba(255,255,255,0.4)", marginLeft: "2px", fontSize: "14px" }}>×</span>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                  <input value={jobBadgeSearch} onChange={e => { setJobBadgeSearch(e.target.value); setJobBadgeDropdown(true); }} onFocus={() => setJobBadgeDropdown(true)} placeholder="Search and add badges…" style={inputSx} />
                  {jobBadgeDropdown && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, maxHeight: "180px", overflowY: "auto", marginTop: "4px", background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                      {COIN_CATEGORIES.map(cat => {
                        const filtered = cat.coins.filter(c => (!jobBadgeSearch || c.name.toLowerCase().includes(jobBadgeSearch.toLowerCase())) && !jobBadges.some(b => b.name === c.name));
                        if (filtered.length === 0) return null;
                        return (<div key={cat.name}>
                          <div style={{ padding: "6px 12px", fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{cat.name.toUpperCase()}</div>
                          {filtered.map(coin => (<div key={coin.name} onClick={() => { setJobBadges(prev => [...prev, { name: coin.name, xc: coin.xc }]); setJobBadgeSearch(""); }} style={{ padding: "8px 14px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.7)", display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(79,142,247,0.1)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><span>{coin.name}</span><span style={{ color: "#f5c842", fontSize: "11px", fontFamily: "monospace" }}>{coin.xc} XC</span></div>))}
                        </div>);
                      })}
                    </div>
                  )}
                </div>
              </Field>

              {/* ── Hiring System ── */}
              <div style={{ padding: "16px", borderRadius: "12px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}>
                <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 700, color: "#22c55e", letterSpacing: "0.08em", textTransform: "uppercase" }}>👤 HIRING SETTINGS</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <Field label="Max Hires">
                    <input type="number" value={editingJob.maxHires ?? 1} onChange={e => setEditingJob(p => ({ ...p, maxHires: parseInt(e.target.value) || 1 }))}
                      min={1} style={inputSx} />
                  </Field>
                  <Field label="Task Interval">
                    <select value={editingJob.intervalType || "weekly"} onChange={e => setEditingJob(p => ({ ...p, intervalType: e.target.value as Job["intervalType"] }))}
                      style={{ ...inputSx, cursor: "pointer" }}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </Field>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "14px" }}>
                  <Field label="Timeline Start">
                    <input type="date" value={editingJob.timeline?.start || ""} onChange={e => setEditingJob(p => ({ ...p, timeline: { start: e.target.value, end: p.timeline?.end || "" } }))} style={inputSx} />
                  </Field>
                  <Field label="Timeline End">
                    <input type="date" value={editingJob.timeline?.end || ""} onChange={e => setEditingJob(p => ({ ...p, timeline: { start: p.timeline?.start || "", end: e.target.value } }))} style={inputSx} />
                  </Field>
                </div>
                {/* Hire players section */}
                <div style={{ marginTop: "14px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "1px", textTransform: "uppercase" }}>
                    Hired Players ({(editingJob.hiredPlayers || []).length}/{editingJob.maxHires || 1})
                  </p>
                  {(editingJob.hiredPlayers || []).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                      {(editingJob.hiredPlayers || []).map(pid => {
                        const p = mockUsers.find(u => u.id === pid);
                        return (
                          <span key={pid} style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e" }}>
                            {p?.brandName || p?.name || pid}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {/* Hire button — only if job saved and not full */}
                  {editingJob.id && (editingJob.hiredPlayers || []).length < (editingJob.maxHires || 1) && (
                    <div style={{ maxHeight: "120px", overflowY: "auto", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "4px" }}>
                      {mockUsers.filter(u => u.role === "player" && !(editingJob.hiredPlayers || []).includes(u.id)).map(p => (
                        <button key={p.id} onClick={() => { hirePlayerForJob(editingJob.id!, p.id); setEditingJob(prev => ({ ...prev, hiredPlayers: [...(prev.hiredPlayers || []), p.id] })); }}
                          style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", background: "transparent", border: "none", textAlign: "left", color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600 }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,197,94,0.1)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <span style={{ color: "#22c55e" }}>+</span> {p.brandName || p.name} <span style={{ marginLeft: "auto", fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>{p.cohort}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </div>

              {/* ── Milestones ── */}
              <div style={{ padding: "16px", borderRadius: "12px", background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)" }}>
                <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 700, color: "#a78bfa", letterSpacing: "0.08em", textTransform: "uppercase" }}>📌 MILESTONES</p>
                {(editingJob.milestones || []).map((ms: JobMilestone, i: number) => (
                  <div key={ms.id || i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 32px", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                    <input value={ms.title} onChange={e => {
                      const updated = [...(editingJob.milestones || [])];
                      updated[i] = { ...ms, title: e.target.value };
                      setEditingJob(p => ({ ...p, milestones: updated }));
                    }} placeholder="Milestone title" style={{ ...inputSx, fontSize: "12px", padding: "8px 10px" }} />
                    <input type="date" value={ms.dueDate} onChange={e => {
                      const updated = [...(editingJob.milestones || [])];
                      updated[i] = { ...ms, dueDate: e.target.value };
                      setEditingJob(p => ({ ...p, milestones: updated }));
                    }} style={{ ...inputSx, fontSize: "11px", padding: "8px 6px" }} />
                    <button onClick={() => {
                      const updated = (editingJob.milestones || []).filter((_: any, j: number) => j !== i);
                      setEditingJob(p => ({ ...p, milestones: updated }));
                    }} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: "6px", color: "#ef4444", cursor: "pointer", fontSize: "12px", padding: "6px" }}>×</button>
                  </div>
                ))}
                <button onClick={() => {
                  const ms: JobMilestone = { id: `ms_${Date.now()}`, title: "", dueDate: "", completed: false };
                  setEditingJob(p => ({ ...p, milestones: [...(p.milestones || []), ms] }));
                }} style={{ padding: "6px 14px", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)",
                  borderRadius: "8px", color: "#a78bfa", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                  + Add Milestone
                </button>
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
