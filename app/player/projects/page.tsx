"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import {
  User, mockUsers, mockProjects, mockJobs, mockTasks, mockProjectPitches,
  Project, Job, Task, ProjectPitch, getCurrentRank,
} from "../../lib/data";
import { saveJobs, saveProjects, saveTasks, saveProjectPitches } from "../../lib/store";
import { saveAndToast } from "../../lib/saveToast";
import { playClick, playSuccess, playError, playModalOpen, playModalClose } from "../../lib/sounds";

const CYAN = "#00d4ff";

const statusColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
  open:        { bg: "rgba(79,142,247,0.1)",  border: "rgba(79,142,247,0.3)",  text: "#4f8ef7",  label: "Open" },
  in_progress: { bg: "rgba(245,200,66,0.1)",  border: "rgba(245,200,66,0.3)",  text: "#f5c842",  label: "In Progress" },
  completed:   { bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)",   text: "#22c55e",  label: "Completed" },
  closed:      { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.12)", text: "rgba(255,255,255,0.4)", label: "Closed" },
  filled:      { bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)", text: "#a78bfa",  label: "Filled" },
  active:      { bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)",   text: "#22c55e",  label: "Active" },
  archived:    { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.12)", text: "rgba(255,255,255,0.4)", label: "Archived" },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusColors[status] || statusColors.open;
  return (
    <span style={{
      padding: "3px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 800,
      background: s.bg, border: `1px solid ${s.border}`, color: s.text, textTransform: "uppercase",
      letterSpacing: "0.5px",
    }}>{s.label}</span>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: "4px", background: color, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: "11px", fontWeight: 700, color, minWidth: "36px", textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

export default function ProducerProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pitches, setPitches] = useState<ProjectPitch[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [aiInsight, setAiInsight] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.role !== "player" && u.role !== "admin") { router.push("/"); return; }
    setUser(u);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    // Find projects where user is the creator (producer/PM)
    const myPitches = mockProjectPitches.filter(p => p.creatorId === user.id && p.generatedProjectId);
    setPitches(myPitches);
    const projectIds = myPitches.map(p => p.generatedProjectId!);
    const myProjects = mockProjects.filter(p => projectIds.includes(p.id) || p.createdBy === user.id);
    setProjects(myProjects);
    setJobs([...mockJobs]);
    setTasks([...mockTasks]);
  }, [user]);

  const getProjectJobs = useCallback((project: Project): Job[] => {
    return jobs.filter(j => project.jobIds.includes(j.id));
  }, [jobs]);

  const getProjectTasks = useCallback((project: Project): Task[] => {
    return tasks.filter(t => project.taskIds.includes(t.id));
  }, [tasks]);

  const getJobTasks = useCallback((job: Job): Task[] => {
    return tasks.filter(t => (job.transformedTaskIds || []).includes(t.id));
  }, [tasks]);

  const getPlayerName = (id: string) => {
    const p = mockUsers.find(u => u.id === id);
    return p ? (p.brandName || p.name) : "Unknown";
  };

  const getProjectProgress = (project: Project) => {
    const pJobs = getProjectJobs(project);
    if (pJobs.length === 0) return { completed: 0, total: 0, pct: 0 };
    const completed = pJobs.filter(j => j.status === "completed").length;
    return { completed, total: pJobs.length, pct: Math.round((completed / pJobs.length) * 100) };
  };

  const getPitchForProject = (projectId: string) => {
    return pitches.find(p => p.generatedProjectId === projectId);
  };

  // AI Project Insight
  const getAIInsight = async (project: Project) => {
    setAiLoading(true);
    setAiInsight("");
    try {
      const pJobs = getProjectJobs(project);
      const progress = getProjectProgress(project);
      const jobSummary = pJobs.map(j => ({
        title: j.title,
        status: j.status,
        hired: (j.hiredPlayers || []).length,
        applicants: j.applicants.length,
      }));
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `You are a project management AI assistant for a gamified education platform called PFLX. Analyze this project and give brief, actionable recommendations (3-4 bullet points max).

Project: "${project.title}"
Description: "${project.description}"
Overall Progress: ${progress.pct}% (${progress.completed}/${progress.total} jobs completed)
Jobs: ${JSON.stringify(jobSummary)}

Consider: staffing gaps, bottleneck risks, timeline concerns, and next steps. Be specific and concise.`,
          role: "host",
          context: { projectTitle: project.title },
        }),
      });
      const data = await res.json();
      setAiInsight(data.reply || "No insights available at this time.");
    } catch {
      setAiInsight("Could not generate AI insights right now. Try again later.");
    }
    setAiLoading(false);
  };

  if (!user) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
      <SideNav user={user} />

      <main style={{ flex: 1, padding: "32px", overflow: "auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 900, color: "#f0f0ff" }}>
            Project Management Monitor 🎬
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
            Track your pitched projects, manage team jobs, and monitor progress as Producer/PM.
          </p>
        </div>

        {projects.length === 0 ? (
          <div style={{
            padding: "60px", textAlign: "center", color: "rgba(255,255,255,0.3)",
            border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "16px",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
            <p style={{ fontSize: "15px", fontWeight: 600 }}>No projects yet</p>
            <p style={{ fontSize: "12px", marginTop: "6px" }}>Submit a project pitch to get started. Once approved, it will appear here.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {projects.map(project => {
              const progress = getProjectProgress(project);
              const pJobs = getProjectJobs(project);
              const pitch = getPitchForProject(project.id);
              const isExpanded = selectedProject?.id === project.id;

              return (
                <div key={project.id} style={{
                  background: "rgba(255,255,255,0.02)", border: `1px solid ${isExpanded ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: "16px", overflow: "hidden", transition: "border-color 0.2s ease",
                }}>
                  {/* Project header card */}
                  <div onClick={() => { playClick(); setSelectedProject(isExpanded ? null : project); }}
                    style={{ padding: "20px 24px", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#f0f0ff" }}>{project.title}</h3>
                          <StatusBadge status={project.status} />
                        </div>
                        <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.35)", maxWidth: "600px" }}>
                          {project.description.slice(0, 120)}{project.description.length > 120 ? "..." : ""}
                        </p>
                      </div>
                      {project.image && (
                        <img src={project.image} alt="" style={{
                          width: "80px", height: "45px", borderRadius: "8px", objectFit: "cover",
                          border: "1px solid rgba(255,255,255,0.08)", marginLeft: "16px",
                        }} />
                      )}
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginTop: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
                          PROJECT PROGRESS — {progress.completed}/{progress.total} jobs
                        </span>
                        {pitch && (
                          <span style={{ fontSize: "11px", color: "rgba(167,139,250,0.6)" }}>
                            💰 {(pitch.totalResidualEarned || 0).toLocaleString()} XC earned
                          </span>
                        )}
                      </div>
                      <ProgressBar value={progress.completed} max={progress.total} color={CYAN} />
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{
                      borderTop: "1px solid rgba(255,255,255,0.06)", padding: "20px 24px",
                      background: "rgba(0,0,0,0.15)",
                    }}>
                      {/* Stats row */}
                      <div style={{ display: "flex", gap: "24px", marginBottom: "20px", flexWrap: "wrap" }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "22px", fontWeight: 900, color: CYAN }}>{pJobs.length}</div>
                          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontWeight: 700 }}>Total Jobs</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "22px", fontWeight: 900, color: "#22c55e" }}>
                            {pJobs.filter(j => j.status === "completed").length}
                          </div>
                          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontWeight: 700 }}>Completed</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "22px", fontWeight: 900, color: "#f5c842" }}>
                            {pJobs.filter(j => j.status === "in_progress").length}
                          </div>
                          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontWeight: 700 }}>In Progress</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "22px", fontWeight: 900, color: "#4f8ef7" }}>
                            {pJobs.filter(j => j.status === "open").length}
                          </div>
                          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontWeight: 700 }}>Open</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "22px", fontWeight: 900, color: "#a78bfa" }}>
                            {pJobs.reduce((sum, j) => sum + (j.hiredPlayers || []).length, 0)}
                          </div>
                          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontWeight: 700 }}>Hired</div>
                        </div>
                        {pitch && (
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "22px", fontWeight: 900, color: "#f59e0b" }}>
                              {(pitch.completionCount || 0)}
                            </div>
                            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontWeight: 700 }}>Completions</div>
                          </div>
                        )}
                      </div>

                      {/* Job list */}
                      <div style={{ marginBottom: "16px" }}>
                        <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1px" }}>
                          Job Roles
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {pJobs.map(job => (
                            <div key={job.id} style={{
                              padding: "14px 18px", borderRadius: "12px",
                              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#f0f0ff" }}>{job.title}</span>
                                    <StatusBadge status={job.status} />
                                  </div>
                                  <p style={{ margin: "4px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                                    {job.description.slice(0, 100)}{job.description.length > 100 ? "..." : ""}
                                  </p>
                                </div>
                                <div style={{ textAlign: "right", minWidth: "80px" }}>
                                  <div style={{ fontSize: "14px", fontWeight: 800, color: CYAN }}>{job.xcReward} XC</div>
                                  <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>
                                    {(job.hiredPlayers || []).length}/{job.maxHires || job.slots} hired
                                  </div>
                                </div>
                              </div>

                              {/* Hired players */}
                              {(job.hiredPlayers || []).length > 0 && (
                                <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                  {(job.hiredPlayers || []).map(pid => (
                                    <span key={pid} style={{
                                      padding: "3px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 700,
                                      background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)",
                                      color: "#a78bfa",
                                    }}>
                                      {getPlayerName(pid)}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Applicants awaiting */}
                              {job.applicants.length > 0 && job.status === "open" && (
                                <div style={{ marginTop: "8px", fontSize: "11px", color: "rgba(245,200,66,0.7)" }}>
                                  📩 {job.applicants.length} applicant{job.applicants.length !== 1 ? "s" : ""} waiting for review
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Insights */}
                      <div style={{
                        padding: "16px 18px", borderRadius: "12px",
                        background: "linear-gradient(135deg, rgba(167,139,250,0.04), rgba(0,212,255,0.04))",
                        border: "1px solid rgba(167,139,250,0.12)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: aiInsight ? "12px" : "0" }}>
                          <span style={{ fontSize: "12px", fontWeight: 800, color: "rgba(167,139,250,0.7)", textTransform: "uppercase", letterSpacing: "1px" }}>
                            🤖 AI Project Advisor
                          </span>
                          <button onClick={() => getAIInsight(project)} disabled={aiLoading}
                            style={{
                              padding: "6px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: aiLoading ? "wait" : "pointer",
                              background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa",
                              opacity: aiLoading ? 0.5 : 1,
                            }}>
                            {aiLoading ? "Analyzing..." : "Get AI Insights"}
                          </button>
                        </div>
                        {aiInsight && (
                          <div style={{
                            fontSize: "12px", color: "rgba(255,255,255,0.6)", lineHeight: 1.7,
                            whiteSpace: "pre-wrap",
                          }}>
                            {aiInsight}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
