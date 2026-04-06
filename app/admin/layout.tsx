import AIAssistant from "../components/AIAssistant";
import RoleGuard from "../components/RoleGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RoleGuard />
      {children}
      <AIAssistant />
    </>
  );
}
