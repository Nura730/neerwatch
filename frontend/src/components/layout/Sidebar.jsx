import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  ClipboardList,
  Plus,
  GitMerge,
  Bell,
  Building2,
  CloudRain,
  RefreshCw,
  Users
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { canCreateTest, canSyncTests, canManageUsers } from '../../auth/permissions.js';

const OBSERVATION_ITEMS = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/observations',  icon: ClipboardList,   label: 'Tests' },
  { to: '/map',           icon: Map,             label: 'Map' },
  { to: '/clusters',      icon: GitMerge,        label: 'Clusters' },
  { to: '/alerts',        icon: Bell,            label: 'Alerts' },
  { to: '/wards',         icon: Building2,       label: 'Wards' },
  { to: '/rainfall',      icon: CloudRain,       label: 'Rainfall' },
];

function NavItem({ to, icon: Icon, label, badge, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `
        flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors border-l-2
        ${isActive 
          ? 'border-[#38BDF8] text-[#38BDF8] bg-[#38BDF8]/10' 
          : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }
      `}
    >
      <Icon size={16} />
      <span>{label}</span>
      {badge}
    </NavLink>
  );
}

export function Sidebar({ pendingCount }) {
  const { user } = useAuth();
  const role = user ? user.role : null;
  const showOperations = role && (canCreateTest(role) || canSyncTests(role));
  const showAdmin = role && canManageUsers(role);

  return (
    <nav className="w-[240px] bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 text-slate-300" aria-label="Main navigation">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-slate-800">
        <div className="font-bold text-base text-slate-100 tracking-wider">
          NEERWATCH
        </div>
        <div className="text-xs text-slate-400 mt-1">
          Water Observation Platform
        </div>
      </div>

      {/* Nav links */}
      <div className="flex-1 py-4 overflow-y-auto space-y-6">
        <div>
          {OBSERVATION_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} end={item.to === '/'} />
          ))}
        </div>

        {showOperations && (
          <div>
            <h3 className="px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Operations
            </h3>
            {canCreateTest(role) && (
              <NavItem to="/observations/new" icon={Plus} label="Create Test" />
            )}
            {canSyncTests(role) && (
              <NavItem 
                to="/sync" 
                icon={RefreshCw} 
                label="Sync Center" 
                badge={pendingCount > 0 ? (
                  <span className="ml-auto bg-[#D97706] text-white rounded-full px-2 py-0.5 text-[10px] font-bold">
                    {pendingCount}
                  </span>
                ) : null}
              />
            )}
          </div>
        )}

        {showAdmin && (
          <div>
            <h3 className="px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Administration
            </h3>
            <NavItem to="/users" icon={Users} label="User Management" />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-500">
        Ernakulam / Kochi · Demo
      </div>
    </nav>
  );
}
