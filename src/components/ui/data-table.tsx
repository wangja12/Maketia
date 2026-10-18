import type { ReactNode } from "react";

/** Plain table: first column is the label, the others are right-aligned figures. */
export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-raised">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>{head.map((h, i) => <th key={h} scope="col" className={`px-4 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className={`px-4 py-2 ${j > 0 ? "text-right tabular-nums" : ""}`}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
