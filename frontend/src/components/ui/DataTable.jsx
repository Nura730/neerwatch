import React from 'react';

/**
 * DataTable — hierarchical, responsive data table
 * 
 * @param {Array} columns - Array of { key, header, render(row), width }
 * @param {Array} data - Array of row objects
 * @param {Function} onRowClick - Optional row click handler
 * @param {React.ReactNode} emptyState - Component to render if data is empty
 */
export function DataTable({ columns, data, onRowClick, emptyState }) {
  if (!data || data.length === 0) {
    return emptyState || (
      <div className="state-container bg-nw-surface border border-nw-border rounded-md">
        <p>No records found.</p>
      </div>
    );
  }

  return (
    <div className="bg-nw-surface border border-nw-border rounded-md shadow-nw-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="nw-table w-full">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={col.key || i} style={{ width: col.width }} className="whitespace-nowrap">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr 
                key={row.id || row.clientId || i} 
                onClick={() => onRowClick && onRowClick(row)}
                className={onRowClick ? "cursor-pointer hover:bg-nw-surface-2 transition-colors" : ""}
              >
                {columns.map((col, j) => (
                  <td key={col.key || j} className="whitespace-nowrap">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
