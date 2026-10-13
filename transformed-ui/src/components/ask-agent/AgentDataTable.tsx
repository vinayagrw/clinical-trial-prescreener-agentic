import React from "react";
import type { AgentTableData } from "../../types/extended";

interface AgentDataTableProps {
  data: AgentTableData;
}

export const AgentDataTable: React.FC<AgentDataTableProps> = ({ data }) => {
  return (
    <table className="agent-data-table">
      <thead>
        <tr>
          {data.headers.map((header, i) => (
            <th key={i}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, rowIdx) => (
          <tr key={rowIdx}>
            {row.map((cell, cellIdx) => (
              <td key={cellIdx}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
