import PlayerAssistant from "../components/PlayerAssistant";

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PlayerAssistant />
    </>
  );
}
