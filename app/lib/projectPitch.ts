/**
 * projectPitch — Player → Host/Higher-Rank project pitch flow.
 *
 * Any player from any app can initiate a project pitch. The pitch posts
 * upward through the PFLX Bridge to Mission Control's mc-panel-pitches
 * queue where an authorized reviewer can approve, reject, or counter.
 *
 * Reviewer authority tiers (from lowest to highest):
 *   - peer: same-rank cohort member with review permission
 *   - senior: higher-rank cohort member (e.g., Director)
 *   - host: full instructor authority
 *   - producer/manager: platform-level roles
 *
 * A pitch goes through these states:
 *   submitted → under_review → (approved | rejected | counter_offered)
 *   approved  → auto-promoted to Project in MC with pitcher as owner
 *   rejected  → X-Bot DMs pitcher with reviewer note
 *   counter_offered → pitcher can accept/decline the counter; if accepted
 *                     the counter terms replace the original then approve
 */

export type PitchState =
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "counter_offered";

export type ReviewerTier = "peer" | "senior" | "host" | "producer" | "manager";

export interface ProjectPitch {
  id: string;
  pitcherId: string;                    // user id of the player pitching
  pitcherName: string;
  title: string;
  problemStatement: string;
  proposedDeliverables: string[];
  requestedRewardXC: number;
  requestedBadges: string[];
  estimatedDays: number;
  teammates: string[];                  // invited collaborator user ids
  targetPathwayId?: string;             // optional Core Pathways node target
  attachments: { name: string; url: string }[];
  state: PitchState;
  reviewerId?: string;
  reviewerTier?: ReviewerTier;
  reviewerNote?: string;
  counterOffer?: {
    rewardXC?: number;
    deliverables?: string[];
    estimatedDays?: number;
    note?: string;
  };
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "pflx_project_pitches";

// ── Storage helpers ──
export function loadPitches(): ProjectPitch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProjectPitch[]) : [];
  } catch {
    return [];
  }
}

export function savePitches(pitches: ProjectPitch[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pitches));
  } catch {}
  // Broadcast to MC so mc-panel-pitches refreshes
  if (typeof window !== "undefined" && window.parent !== window) {
    try {
      window.parent.postMessage(
        JSON.stringify({ type: "pflx_pitches_updated", data: pitches }),
        "*"
      );
    } catch {}
  }
}

// ── Submit a new pitch (from any app) ──
export function submitPitch(
  partial: Omit<ProjectPitch, "id" | "state" | "createdAt" | "updatedAt">
): ProjectPitch {
  const now = new Date().toISOString();
  const pitch: ProjectPitch = {
    ...partial,
    id: `pitch-${Date.now()}`,
    state: "submitted",
    createdAt: now,
    updatedAt: now,
  };
  const all = loadPitches();
  all.unshift(pitch);
  savePitches(all);

  // Fire X-Bot briefing event
  if (typeof window !== "undefined" && window.parent !== window) {
    try {
      window.parent.postMessage(
        JSON.stringify({
          type: "pflx_xbot_event",
          kind: "project_pitch_submitted",
          playerId: partial.pitcherId,
          payload: { pitchId: pitch.id, title: pitch.title },
        }),
        "*"
      );
    } catch {}
  }

  return pitch;
}

// ── Reviewer actions ──
export function approvePitch(
  pitchId: string,
  reviewerId: string,
  reviewerTier: ReviewerTier,
  note?: string
): ProjectPitch | null {
  const all = loadPitches();
  const pitch = all.find((p) => p.id === pitchId);
  if (!pitch) return null;
  pitch.state = "approved";
  pitch.reviewerId = reviewerId;
  pitch.reviewerTier = reviewerTier;
  pitch.reviewerNote = note;
  pitch.updatedAt = new Date().toISOString();
  savePitches(all);

  // Auto-promote: tell MC to create a Project with this pitcher as owner
  if (typeof window !== "undefined" && window.parent !== window) {
    try {
      window.parent.postMessage(
        JSON.stringify({
          type: "pflx_pitch_promote_to_project",
          pitch,
        }),
        "*"
      );
    } catch {}
  }

  return pitch;
}

export function rejectPitch(
  pitchId: string,
  reviewerId: string,
  reviewerTier: ReviewerTier,
  note: string
): ProjectPitch | null {
  const all = loadPitches();
  const pitch = all.find((p) => p.id === pitchId);
  if (!pitch) return null;
  pitch.state = "rejected";
  pitch.reviewerId = reviewerId;
  pitch.reviewerTier = reviewerTier;
  pitch.reviewerNote = note;
  pitch.updatedAt = new Date().toISOString();
  savePitches(all);
  return pitch;
}

export function counterOfferPitch(
  pitchId: string,
  reviewerId: string,
  reviewerTier: ReviewerTier,
  counter: NonNullable<ProjectPitch["counterOffer"]>
): ProjectPitch | null {
  const all = loadPitches();
  const pitch = all.find((p) => p.id === pitchId);
  if (!pitch) return null;
  pitch.state = "counter_offered";
  pitch.reviewerId = reviewerId;
  pitch.reviewerTier = reviewerTier;
  pitch.counterOffer = counter;
  pitch.updatedAt = new Date().toISOString();
  savePitches(all);
  return pitch;
}

// ── Pitcher response to counter ──
export function acceptCounter(pitchId: string): ProjectPitch | null {
  const all = loadPitches();
  const pitch = all.find((p) => p.id === pitchId);
  if (!pitch || pitch.state !== "counter_offered" || !pitch.counterOffer) return null;
  if (pitch.counterOffer.rewardXC !== undefined) pitch.requestedRewardXC = pitch.counterOffer.rewardXC;
  if (pitch.counterOffer.deliverables) pitch.proposedDeliverables = pitch.counterOffer.deliverables;
  if (pitch.counterOffer.estimatedDays !== undefined) pitch.estimatedDays = pitch.counterOffer.estimatedDays;
  pitch.state = "approved";
  pitch.updatedAt = new Date().toISOString();
  savePitches(all);
  return pitch;
}
