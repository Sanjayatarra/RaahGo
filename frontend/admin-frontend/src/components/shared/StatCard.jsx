import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ label, value, change, changeLabel, icon: Icon, color, gradient }) {
  const isUp = change >= 0;

  const colors = {
    purple: { bg: 'rgba(108,99,255,0.15)', glow: '#6C63FF', border: 'rgba(108,99,255,0.3)' },
    teal:   { bg: 'rgba(78,205,196,0.15)', glow: '#4ECDC4', border: 'rgba(78,205,196,0.3)' },
    pink:   { bg: 'rgba(255,75,139,0.15)', glow: '#FF4B8B', border: 'rgba(255,75,139,0.3)' },
    orange: { bg: 'rgba(255,107,53,0.15)', glow: '#FF6B35', border: 'rgba(255,107,53,0.3)' },
    green:  { bg: 'rgba(107,203,119,0.15)', glow: '#6BCB77', border: 'rgba(107,203,119,0.3)' },
    yellow: { bg: 'rgba(255,217,61,0.15)', glow: '#FFD93D', border: 'rgba(255,217,61,0.3)' },
  };
  const c = colors[color] || colors.purple;

  return (
    <div className="stat-card" style={{ '--stat-color': c.glow }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '2px', background: `linear-gradient(90deg, ${c.glow}, transparent)`,
        borderRadius: '2px 2px 0 0'
      }} />
      <div className="stat-glow" style={{ background: c.glow }} />

      <div className="stat-card-header">
        <div>
          <div className="stat-card-label">{label}</div>
          <div className="stat-card-value">{value}</div>
        </div>
        {Icon && (
          <div className="stat-card-icon" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
            <Icon size={20} color={c.glow} />
          </div>
        )}
      </div>

      {change !== undefined && (
        <div className={`stat-card-change ${isUp ? 'up' : 'down'}`}>
          {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          <span>{Math.abs(change)}% {changeLabel || 'vs yesterday'}</span>
        </div>
      )}
    </div>
  );
}
