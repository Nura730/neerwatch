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
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/map',           icon: Map,             label: 'Map' },
  { to: '/observations',  icon: ClipboardList,   label: 'Observations' },
  { to: '/observations/new', icon: Plus,         label: 'New Observation' },
  { to: '/clusters',      icon: GitMerge,        label: 'Clusters' },
  { to: '/alerts',        icon: Bell,            label: 'Alerts' },
  { to: '/wards',         icon: Building2,       label: 'Wards' },
  { to: '/rainfall',      icon: CloudRain,       label: 'Rainfall' },
  { to: '/sync',          icon: RefreshCw,       label: 'Sync Center' },
];

export function Sidebar({ pendingCount }) {
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
      <div className="flex-1 py-4 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
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
            {label === 'Sync Center' && pendingCount > 0 && (
              <span className="ml-auto bg-[#D97706] text-white rounded-full px-2 py-0.5 text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-500">
        Ernakulam / Kochi · Demo
      </div>
    </nav>
  );
}
