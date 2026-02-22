import type { TableElement as TableElementType, TableStyle } from "@/types/deck";
import { useTheme, resolveStyle } from "@/contexts/ThemeContext";

interface Props {
  element: TableElementType;
}

export function TableElementRenderer({ element }: Props) {
  const theme = useTheme();
  const style = resolveStyle<TableStyle>(theme.table, element.style);

  const fontSize = style.fontSize ?? 14;
  const color = style.color ?? "#e2e8f0";
  const headerBg = style.headerBackground ?? "#1e293b";
  const headerColor = style.headerColor ?? "#f8fafc";
  const borderColor = style.borderColor ?? "#334155";
  const striped = style.striped ?? false;
  const borderRadius = style.borderRadius ?? 8;

  return (
    <div
      style={{
        width: element.size.w,
        height: element.size.h,
        overflow: "auto",
        borderRadius,
        border: `1px solid ${borderColor}`,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize,
          color,
        }}
      >
        <thead>
          <tr>
            {element.columns.map((col, i) => (
              <th
                key={i}
                style={{
                  backgroundColor: headerBg,
                  color: headerColor,
                  padding: "6px 10px",
                  borderBottom: `1px solid ${borderColor}`,
                  textAlign: "left",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {element.rows.map((row, ri) => (
            <tr
              key={ri}
              style={{
                backgroundColor:
                  striped && ri % 2 === 1 ? `${headerBg}80` : "transparent",
              }}
            >
              {element.columns.map((_, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "5px 10px",
                    borderBottom: `1px solid ${borderColor}`,
                  }}
                >
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
