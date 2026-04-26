import { Outlet, Link, useLocation } from "react-router-dom";
import { Briefcase, BrainCircuit, FileText, LayoutDashboard, LogOut } from "lucide-react";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Layout() {
  const { logout } = useContext(AuthContext);
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: "Resume", path: "/resume", icon: <FileText className="w-5 h-5" /> },
    { name: "Jobs", path: "/jobs", icon: <Briefcase className="w-5 h-5" /> },
    { name: "AI Studio", path: "/ai-studio", icon: <BrainCircuit className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.09),_transparent_26%),linear-gradient(180deg,_#f8fafc,_#eef2ff_48%,_#f8fafc)] flex">
      {/* Sidebar */}
      <aside className="hidden w-72 border-r border-slate-200/80 bg-white/85 backdrop-blur md:flex md:flex-col">
        <div className="border-b border-slate-200/80 p-6">
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-900">
            <Briefcase className="h-6 w-6 text-cyan-600" />
            AI Placement
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your command center for resumes, job matches, and AI application prep.
          </p>
        </div>
        <nav className="flex-1 space-y-2 p-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold transition-all ${
                location.pathname === item.path
                  ? "bg-slate-950 text-white shadow-lg shadow-slate-900/10"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.icon} {item.name}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200/80 p-4">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 font-semibold text-rose-600 transition-colors hover:bg-rose-50"
          >
            <LogOut className="w-5 h-5" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex h-screen flex-1 flex-col overflow-y-auto">
        <header className="flex h-16 items-center border-b border-slate-200 bg-white/80 px-6 backdrop-blur md:hidden">
          <h1 className="text-lg font-black tracking-tight text-slate-900">AI Placement</h1>
        </header>
        <div className="flex-1 p-5 md:p-8">
          <Outlet />
        </div>
        <nav className="sticky bottom-0 z-10 grid grid-cols-4 border-t border-slate-200 bg-white/95 p-2 backdrop-blur md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                location.pathname === item.path
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
