// ═══════════════════════════════════════════════════════════════════
// Core Pathways Catalog — single source of truth for pathway slug/label
// and the list of courses (nodes) inside each pathway.
// Mirrors the canonical pathway data in pflx-pathway-portal/pathway.html.
// Any app that needs pathway+course dropdowns should import from here.
// ═══════════════════════════════════════════════════════════════════

export type PathwaySlug =
  | "professional-entrepreneur"
  | "content-creator"
  | "digital-artist"
  | "3d-modeler"
  | "cs-ai-specialist"
  | "sound-designer"
  | "game-designer"
  | "industrial-designer"
  | string; // allow host-added custom slugs

export interface PathwayCourse {
  id: string;     // node id in pathway.html (e.g. "pe-branding")
  label: string;  // display title
  icon?: string;  // emoji or icon
}

export interface PathwayMeta {
  slug: PathwaySlug;
  label: string;
  icon: string;   // emoji for chips; full PNG path lives in the Portal
  accent: string; // hex accent colour
  courses: PathwayCourse[];
}

export const PATHWAY_CATALOG: PathwayMeta[] = [
  {
    slug: "professional-entrepreneur", label: "Professional Entrepreneur", icon: "📖", accent: "#00d4ff",
    courses: [
      { id: "pe-intro", label: "Intro to Entrepreneurship", icon: "🚀" },
      { id: "pe-branding", label: "Personal Branding", icon: "🏷️" },
      { id: "pe-pitch", label: "Perfect Pitch", icon: "🎯" },
      { id: "pe-team", label: "Team Building", icon: "👥" },
      { id: "pe-digital-citizen", label: "Digital Citizen & Age of Tech", icon: "🌐" },
      { id: "pe-video-ad", label: "Brand Video Ad Dev", icon: "🎬" },
      { id: "pe-exhibit", label: "Exhibit Design", icon: "🏛️" },
      { id: "pe-portfolio", label: "Portfolio Development", icon: "📁" },
      { id: "pe-second-brain", label: "Second Brain", icon: "🧠" },
      { id: "pe-signal-noise", label: "Signal to Noise Ratio", icon: "📡" },
    ],
  },
  {
    slug: "content-creator", label: "Content Creator", icon: "🎬", accent: "#ff6ec7",
    courses: [
      { id: "cc-intro", label: "Intro to Media Production", icon: "🎬" },
      { id: "cc-storyboard", label: "Storybuilding & Storyboarding", icon: "📝" },
      { id: "cc-screenwriting", label: "Screenwriting", icon: "✍️" },
      { id: "cc-media-capture", label: "Media Capture Techniques", icon: "📸" },
      { id: "cc-sound-design", label: "Sound Design", icon: "🎵" },
      { id: "cc-video-editing", label: "Video Editing", icon: "🎞️" },
      { id: "cc-project-pilot", label: "Project Pilot", icon: "🛫" },
    ],
  },
  {
    slug: "digital-artist", label: "Digital Artist", icon: "🎨", accent: "#c084fc",
    courses: [
      { id: "da-intro", label: "Graphic Design Concepts", icon: "🎨" },
      { id: "da-storyboard", label: "Storybuilding & Storyboarding", icon: "📝" },
      { id: "da-digitize", label: "Digitize Art", icon: "🖌️" },
      { id: "da-flipbook", label: "Flipbook Animation", icon: "📖" },
      { id: "da-vector", label: "Vector Graphics", icon: "✏️" },
      { id: "da-photo", label: "Photo Art", icon: "📷" },
      { id: "da-digital-anim", label: "Digital Animation", icon: "🎞️" },
      { id: "da-comic", label: "Comicbook Creator", icon: "💥" },
      { id: "da-infinity", label: "Infinity Art", icon: "♾️" },
      { id: "da-animated-adv", label: "Animated Adventure", icon: "🎬" },
    ],
  },
  {
    slug: "3d-modeler", label: "3D Modeler", icon: "🧊", accent: "#22d3ee",
    courses: [
      { id: "3d-intro", label: "Intro to 3D Modeling", icon: "🧊" },
      { id: "3d-mazes", label: "Amazing World of Mazes", icon: "🌀" },
      { id: "3d-earthship", label: "Earthship Colony", icon: "🌍" },
      { id: "3d-3dprint", label: "3D Printing", icon: "🖨️" },
      { id: "3d-character", label: "Character Creator", icon: "🧑‍🎤" },
      { id: "3d-asd-map", label: "ASD 3D Map", icon: "🗺️" },
      { id: "3d-expo", label: "Expo 4020 Dubai UAE", icon: "🏙️" },
      { id: "3d-home", label: "Home Designer", icon: "🏠" },
      { id: "3d-park", label: "Park of Tomorrow", icon: "🌳" },
    ],
  },
  {
    slug: "cs-ai-specialist", label: "CS / AI Specialist", icon: "🤖", accent: "#a78bfa",
    courses: [
      { id: "cs-intro", label: "Intro to CS/AI", icon: "🤖" },
      { id: "cs-prompt", label: "AI Prompt Engineering", icon: "💬" },
      { id: "cs-digital-citizen", label: "Digital Citizen & Age of Tech", icon: "🌐" },
      { id: "cs-codeorg", label: "Code.org Express", icon: "💻" },
      { id: "cs-karel", label: "Intro to Programming with Karel", icon: "🤖" },
      { id: "cs-webdev", label: "Web Dev", icon: "🌍" },
      { id: "cs-python", label: "Intro to Python with Tracy", icon: "🐍" },
      { id: "cs-coming-soon", label: "Coming Soon", icon: "🔮" },
    ],
  },
  {
    slug: "sound-designer", label: "Sound Designer", icon: "🎵", accent: "#f472b6",
    courses: [
      { id: "sd-intro", label: "Intro to Sound Design", icon: "🎧" },
      { id: "sd-music", label: "Music Production", icon: "🎹" },
      { id: "sd-songwriting", label: "Song Writing & Composition", icon: "🎼" },
      { id: "sd-cover", label: "Cover Song", icon: "🎤" },
      { id: "sd-fl-studio", label: "FL Studio", icon: "🎚️" },
      { id: "sd-challenge", label: "Sound Design Challenge", icon: "🏆" },
      { id: "sd-podcasting", label: "Podcasting", icon: "🎙️" },
    ],
  },
  {
    slug: "game-designer", label: "Game Designer", icon: "🎮", accent: "#34d399",
    courses: [
      { id: "gd-intro", label: "Intro to Game Design", icon: "🎮" },
      { id: "gd-gamedev", label: "Game Dev", icon: "⚙️" },
      { id: "gd-scratch", label: "Scratch", icon: "🐱" },
      { id: "gd-makecode", label: "MakeCode Arcade", icon: "👾" },
      { id: "gd-godot", label: "Godot", icon: "🤖" },
      { id: "gd-unity", label: "Unity", icon: "🎯" },
      { id: "gd-unreal", label: "Unreal Engine", icon: "🌟" },
      { id: "gd-gimkit", label: "Gimkit Creative", icon: "🎲" },
      { id: "gd-beta", label: "Beta Testers Network", icon: "🧪" },
      { id: "gd-project-bac", label: "Project BAC", icon: "🏗️" },
    ],
  },
  {
    slug: "industrial-designer", label: "Industrial Designer", icon: "🛠️", accent: "#fb923c",
    courses: [
      { id: "id-intro", label: "Intro to Industrial Design", icon: "🛠️" },
      { id: "id-sketching", label: "Product Sketching", icon: "✏️" },
      { id: "id-materials", label: "Materials & Manufacturing", icon: "🧱" },
      { id: "id-cad", label: "CAD Modeling", icon: "📐" },
      { id: "id-ergonomics", label: "Ergonomics & Human Factors", icon: "👤" },
      { id: "id-prototype", label: "Prototyping", icon: "🧰" },
      { id: "id-product", label: "Product Development", icon: "📦" },
      { id: "id-render", label: "Rendering & Presentation", icon: "🖼️" },
      { id: "id-showcase", label: "Portfolio Showcase", icon: "🏆" },
    ],
  },
];

// Helper lookups
export function getPathwayMeta(slug: string): PathwayMeta | undefined {
  return PATHWAY_CATALOG.find(p => p.slug === slug);
}
export function getPathwayCourses(slug: string): PathwayCourse[] {
  return getPathwayMeta(slug)?.courses || [];
}
export function findCourseByNodeId(nodeId: string): { pathway: PathwayMeta; course: PathwayCourse } | null {
  for (const p of PATHWAY_CATALOG) {
    const c = p.courses.find(c => c.id === nodeId);
    if (c) return { pathway: p, course: c };
  }
  return null;
}
