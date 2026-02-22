import { useState } from "react";

interface CounterProps {
  label?: string;
  initial?: number;
  size: { w: number; h: number };
}

export default function Counter({ label = "Count", initial = 0, size }: CounterProps) {
  const [count, setCount] = useState(initial);

  return (
    <div
      style={{
        width: size.w,
        height: size.h,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "#e4e4e7",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: "bold" }}>{count}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => setCount((c) => c - 1)}
          style={{
            padding: "4px 12px",
            borderRadius: 4,
            border: "1px solid #52525b",
            background: "#27272a",
            color: "#e4e4e7",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          -
        </button>
        <button
          onClick={() => setCount((c) => c + 1)}
          style={{
            padding: "4px 12px",
            borderRadius: 4,
            border: "1px solid #52525b",
            background: "#27272a",
            color: "#e4e4e7",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
