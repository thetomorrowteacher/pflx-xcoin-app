import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { task, player, taskHistory } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // ── Heuristic fallback (always available, no API key needed) ──────────────
  function heuristicAnalysis() {
    const proof = task.submissionProof;
    let score = 0;
    const signals: string[] = [];
    const flags: string[] = [];

    // Proof presence
    if (proof?.linkUrl) {
      score += 30;
      signals.push("Submission link provided");
      // URL quality
      try {
        const url = new URL(proof.linkUrl);
        if (url.protocol === "https:") { score += 10; signals.push("Secure HTTPS link"); }
        const host = url.hostname.toLowerCase();
        if (host.includes("docs.google") || host.includes("drive.google")) { score += 15; signals.push("Google Docs/Drive submission"); }
        else if (host.includes("canva")) { score += 15; signals.push("Canva project link"); }
        else if (host.includes("youtube") || host.includes("youtu.be")) { score += 10; signals.push("Video submission"); }
        else if (host.includes("github")) { score += 15; signals.push("GitHub repository"); }
        else if (host.includes("canvas") || host.includes("schoology") || host.includes("classroom")) { score += 15; signals.push("LMS submission link"); }
        else { score += 5; signals.push("External link provided"); }
      } catch { flags.push("URL appears malformed"); score -= 10; }
    } else {
      flags.push("No submission link provided");
    }

    if (proof?.fileUrl) {
      score += 20;
      signals.push("File attachment included");
    }

    if (proof?.note && proof.note.length > 10) {
      score += 15;
      signals.push(`Student note: "${proof.note.slice(0, 60)}${proof.note.length > 60 ? "…" : ""}"`);
    } else if (!proof?.note) {
      flags.push("No explanatory note included");
    }

    // Deadline check
    if (task.submittedAt && task.dueDate) {
      const submitted = new Date(task.submittedAt);
      const due = new Date(task.dueDate);
      if (submitted <= due) { score += 15; signals.push("Submitted on time"); }
      else {
        const daysLate = Math.round((submitted.getTime() - due.getTime()) / 86400000);
        flags.push(`Submitted ${daysLate} day${daysLate > 1 ? "s" : ""} late`);
        score -= 10;
      }
    }

    // Player history
    if (taskHistory) {
      const approved = taskHistory.filter((t: { status: string }) => t.status === "approved").length;
      const rejected = taskHistory.filter((t: { status: string }) => t.status === "rejected").length;
      const total = approved + rejected;
      if (total > 0) {
        const rate = approved / total;
        if (rate >= 0.8) { score += 10; signals.push(`Strong track record (${approved}/${total} approved)`); }
        else if (rate < 0.5) { flags.push(`Low approval history (${approved}/${total})`); score -= 5; }
      }
    }

    score = Math.max(0, Math.min(100, score));
    const recommendation = score >= 70 ? "approve" : score >= 45 ? "review" : "reject";

    return {
      score,
      recommendation,
      signals,
      flags,
      summary: recommendation === "approve"
        ? `Strong submission with ${signals.length} positive indicator${signals.length !== 1 ? "s" : ""}. Likely meets requirements.`
        : recommendation === "review"
        ? `Submission has some indicators but needs manual review before approval.`
        : `Submission is missing key proof or has quality concerns. Consider requesting resubmission.`,
      source: "heuristic",
    };
  }

  // ── Claude AI analysis (requires ANTHROPIC_API_KEY in .env) ───────────────
  if (apiKey) {
    try {
      const prompt = `You are a classroom teacher's AI assistant reviewing a student task submission.

TASK: "${task.title}"
Description: "${task.description}"
Category: ${task.category}
Due Date: ${task.dueDate}
Submitted: ${task.submittedAt ?? "Unknown"}

STUDENT SUBMISSION:
- Link: ${task.submissionProof?.linkUrl ?? "None provided"}
- File: ${task.submissionProof?.fileUrl ?? "None provided"}
- Student Note: "${task.submissionProof?.note ?? "None"}"

STUDENT HISTORY: ${taskHistory?.filter((t: { status: string }) => t.status === "approved").length ?? 0} approved, ${taskHistory?.filter((t: { status: string }) => t.status === "rejected").length ?? 0} rejected out of ${taskHistory?.length ?? 0} past tasks.

Analyze this submission and respond with a JSON object in exactly this format:
{
  "score": <0-100 quality confidence score>,
  "recommendation": <"approve" | "review" | "reject">,
  "signals": [<list of positive indicators>],
  "flags": [<list of concerns>],
  "summary": "<1-2 sentence assessment>",
  "source": "claude"
}

Be concise and practical. Focus on whether there is credible evidence of completed work.`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text ?? "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json(parsed);
        }
      }
    } catch {
      // fall through to heuristic
    }
  }

  return NextResponse.json(heuristicAnalysis());
}
