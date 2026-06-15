import { NavLink, Outlet } from "react-router-dom";
import { Home, Scale, Server, BarChart3, LogOut } from "lucide-react";
import { useAuth } from "../auth";
import "../dashboard.css";

const NAV_ITEMS = [
  { to: "/home", label: "Home", Icon: Home },
  { to: "/load-balancer", label: "Load Balancer", Icon: Scale },
  { to: "/rpc-endpoints", label: "RPC Endpoints", Icon: Server },
  { to: "/analytics", label: "Analytics", Icon: BarChart3 },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className="sidebar-link">
              <Icon size={18} strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <span className="sidebar-email" title={user?.email}>{user?.email}</span>
            <button className="sidebar-logout" onClick={logout} aria-label="Log out">
              <LogOut size={16} strokeWidth={1.75} />
            </button>
          </div>
          <div className="sidebar-brand">
            <img src="/logo_kevred_pixel.svg" alt="kevred" className="sidebar-brand-mark" />
            <span>kevred</span>
          </div>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
