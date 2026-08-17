export default function PageHeader({ title, subtitle, breadcrumb, children }) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        {breadcrumb && (
          <div className="breadcrumb">
            {breadcrumb.map((b, i) => (
              <span key={i}>
                {i > 0 && <span style={{ margin: '0 4px', opacity: 0.4 }}>/</span>}
                <span style={i === breadcrumb.length - 1 ? { color: 'var(--text-secondary)' } : {}}>
                  {b}
                </span>
              </span>
            ))}
          </div>
        )}
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{children}</div>}
    </div>
  );
}
