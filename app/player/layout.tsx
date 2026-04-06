import PlayerAssistant from "../components/PlayerAssistant";
import RoleGuard from "../components/RoleGuard";

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RoleGuard />
      {children}
      <PlayerAssistant />
    </>
  );
}
