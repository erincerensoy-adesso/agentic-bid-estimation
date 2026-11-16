"use client";

import { useState } from "react";
import type { RoleResult } from "@/lib/calc";
import { fmtGain, fmtPD } from "@/lib/format";

/** Grouped bars: baseline vs AI-adjusted PD per role. Colors are categorical slots 1 and 2 of the reference palette. */
export function ComparisonChart({ roles }: { roles: RoleResult[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; role: RoleResult; series: 0 | 1 } | null>(null);
  const W = 760;
  const H = 300;
  const m = { top: 16, right: 12, bottom: 44, left: 52 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const max = Math.max(1, ...roles.map((r) => r.baselinePD));
  const step = niceStep(max / 5);
  const top = Math.ceil(max / step) * step;
  const y = (v: number) => m.top + ih - (v / top) * ih;
  const band = iw / Math.max(1, roles.length);
  const barW = Math.min(36, (band - 20) / 2);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <div className="chart">
      <div className="legend" aria-hidden>
        <span><i className="swatch s1" /> Baseline PD</span>
        <span><i className="swatch s2" /> AI-adjusted PD</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Baseline against AI-adjusted person-days per role" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} className="gridline" />
            <text x={m.left - 8} y={y(t)} className="axis-label" textAnchor="end" dominantBaseline="middle">{t}</text>
          </g>
        ))}
        {roles.map((r, i) => {
          const cx = m.left + band * i + band / 2;
          const vals = [r.baselinePD, r.adjustedPD];
          return (
            <g key={r.role}>
              {vals.map((v, s) => {
                const x = s === 0 ? cx - barW - 1 : cx + 1; // 2px gap between the pair
                const h = Math.max(0, y(0) - y(v));
                return (
                  <g key={s}>
                    <path d={roundedTop(x, y(v), barW, h, 4)} className={`bar s${s + 1}`} />
                    {/* Hit target larger than the mark */}
                    <rect
                      x={x - 1}
                      y={m.top}
                      width={barW + 2}
                      height={ih}
                      fill="transparent"
                      onMouseEnter={() => setHover({ x: x + barW / 2, y: y(v), role: r, series: s as 0 | 1 })}
                    />
                  </g>
                );
              })}
              <text x={cx} y={H - m.bottom + 18} className="axis-label" textAnchor="middle">{r.role}</text>
              <text x={cx} y={H - m.bottom + 34} className="axis-sub" textAnchor="middle">{fmtGain(r.appliedGain)}</text>
            </g>
          );
        })}
        <line x1={m.left} x2={W - m.right} y1={y(0)} y2={y(0)} className="baseline" />
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }}>
          <strong>{hover.role.role}</strong>
          <div><i className="swatch s1" /> Baseline {fmtPD(hover.role.baselinePD)} PD</div>
          <div><i className="swatch s2" /> AI-adjusted {fmtPD(hover.role.adjustedPD)} PD</div>
          <div className="muted">Gain {fmtGain(hover.role.appliedGain)}</div>
        </div>
      )}
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
