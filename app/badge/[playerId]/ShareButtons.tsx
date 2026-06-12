"use client";
// LinkedIn share buttons for the public badge page.
// Phase 1+3 (zero-API): share-offsite deep link + Add-to-Profile
// certification deep link. No LinkedIn app or OAuth required.
import { useState } from "react";

interface Props {
  badgeName: string;
  orgName: string;
  pageUrl: string;      // absolute URL of this public badge page
  certId: string;
  issueYear?: number;
  issueMonth?: number;
}

export default function ShareButtons({ badgeName, orgName, pageUrl, certId, issueYear, issueMonth }: Props) {
  const [copied, setCopied] = useState(false);

  // Per-badge URL so the OG preview names this specific badge
  const badgeUrl = `${pageUrl}?b=${encodeURIComponent(badgeName)}`;

  const shareUrl =
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(badgeUrl)}`;

  const addToProfileUrl =
    `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME` +
    `&name=${encodeURIComponent(badgeName + " — PFLX Digital Badge")}` +
    `&organizationName=${encodeURIComponent(orgName)}` +
    (issueYear ? `&issueYear=${issueYear}` : "") +
    (issueMonth ? `&issueMonth=${issueMonth}` : "") +
    `&certUrl=${encodeURIComponent(badgeUrl)}` +
    `&certId=${encodeURIComponent(certId)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(badgeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  }

  const btn: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
    padding: "6px 12px", borderRadius: 8, cursor: "pointer",
    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5,
    border: "1px solid #0a66c255", background: "#0a66c21e", color: "#6cb2ff",
  };

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={btn}>
        in&nbsp;SHARE ON LINKEDIN
      </a>
      <a href={addToProfileUrl} target="_blank" rel="noopener noreferrer" style={btn}>
        in&nbsp;ADD TO PROFILE
      </a>
      <button
        onClick={copyLink}
        style={{ ...btn, border: "1px solid #2a3450", background: "#161e30", color: copied ? "#22c55e" : "#8a92b0" }}
      >
        {copied ? "✓ COPIED" : "⧉ COPY LINK"}
      </button>
    </div>
  );
}
