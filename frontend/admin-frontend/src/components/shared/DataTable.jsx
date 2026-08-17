import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Download } from 'lucide-react';

const PAGE_SIZE = 10;

export default function DataTable({
  title,
  columns,
  data = [],
  searchKeys = [],
  filters = [],
  onRowClick,
  actions,
  emptyMessage = 'No records found',
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterVals, setFilterVals] = useState({});

  // Filter data
  let filtered = data;
  if (search && searchKeys.length) {
    const q = search.toLowerCase();
    filtered = filtered.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
    );
  }
  Object.entries(filterVals).forEach(([key, val]) => {
    if (val) filtered = filtered.filter((row) => String(row[key]) === String(val));
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilter = (key, val) => {
    setFilterVals((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  };

  return (
    <div className="table-container">
      <div className="table-header">
        <h3>{title} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({filtered.length})</span></h3>
        <div className="table-actions">
          {/* Search */}
          {searchKeys.length > 0 && (
            <div className="search-input-wrap" style={{ maxWidth: 240 }}>
              <Search size={14} className="search-input-icon" />
              <input
                className="form-control"
                style={{ paddingLeft: 34, height: 36, fontSize: 12 }}
                placeholder="Search..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          )}
          {/* Dynamic filters */}
          {filters.map((f) => (
            <select
              key={f.key}
              className="form-control"
              style={{ maxWidth: 150, height: 36, fontSize: 12 }}
              value={filterVals[f.key] || ''}
              onChange={(e) => handleFilter(f.key, e.target.value)}
            >
              <option value="">{f.label}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ))}
          {actions}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={col.style}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  onClick={() => onRowClick?.(row)}
                  style={onRowClick ? { cursor: 'pointer' } : {}}
                >
                  {columns.map((col) => (
                    <td key={col.key} style={col.style}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="table-pagination">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="pagination-btns">
            <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  className={`pagination-btn${page === p ? ' active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}
            <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
