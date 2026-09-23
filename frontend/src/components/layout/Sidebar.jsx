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
    <nav className="sidebar" aria-label="Main navigation">
      {/* Brand */}
      <div style={{
        padding: '18px 16px 14px',
        borderBottom: '1px solid #1E293B',
      }}>
        <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#F1F5F9', letterSpacing: '0.03em' }}>
          NEERWATCH
        </div>
        <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: 2 }}>
          Water Observation Platform
        </div>
      </div>

      {/* Nav links */}
      <div style={{ flex: 1, padding: '8px 0' }}>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 16px',
              fontSize: '0.8125rem',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#38BDF8' : 'var(--nw-sidebar-text)',
              background: isActive ? 'rgba(56,189,248,0.08)' : 'transparent',
              textDecoration: 'none',
              borderLeft: isActive ? '2px solid #38BDF8' : '2px solid transparent',
              transition: 'background 0.1s, color 0.1s',
            })}
            onMouseEnter={e => {
              if (!e.currentTarget.style.background.includes('rgba')) {
                e.currentTarget.style.background = '#1E293B';
              }
            }}
            onMouseLeave={e => {
              if (!e.currentTarget.style.background.includes('rgba')) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <Icon size={15} />
            <span>{label}</span>
            {label === 'Sync Center' && pendingCount > 0 && (
              <span style={{
                marginLeft: 'auto',
                background: '#D97706',
                color: '#fff',
                borderRadius: 10,
                padding: '1px 7px',
                fontSize: '0.6875rem',
                fontWeight: 700,
              }}>
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #1E293B',
        fontSize: '0.6875rem',
        color: '#334155',
      }}>
        Ernakulam / Kochi · Demo
      </div>
    </nav>
  );
}
