'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts';
import { Activity, Zap, TrendingUp, Sparkles, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

export type FlowScoreItem = {
  metric: string;
  fullMetric: string;
  reference: number;
  user: number;
  status?: string;
};

interface FlowRadarChartProps {
  markdown: string;
  referenceName?: string;
  userName?: string;
}

export function parseFlowScores(markdown: string): FlowScoreItem[] {
  if (!markdown) return [];

  const items: FlowScoreItem[] = [];
  const lines = markdown.split('\n');
  let inFlowSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Check if we entered the Akış Puanlaması section
    if (
      line.toLowerCase().includes('akış puanlaması') ||
      line.toLowerCase().includes('akis puanlamasi') ||
      line.toLowerCase().includes('akış puanı')
    ) {
      inFlowSection = true;
      continue;
    }

    // If we reach the next header after finding items, break
    if (inFlowSection && items.length > 0 && (line.startsWith('###') || line.startsWith('## '))) {
      break;
    }

    // Process markdown table rows
    if (line.startsWith('|') && line.endsWith('|')) {
      const cols = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      // Skip header and divider lines
      if (
        cols.length >= 3 &&
        !cols[0].includes('---') &&
        !cols[0].toLowerCase().includes('boyut') &&
        !cols[0].toLowerCase().includes('metrik')
      ) {
        const fullMetric = cols[0].replace(/[#*`_]/g, '').trim();

        // Extract numbers from col[1] (Reference) and col[2] (User)
        const refDigits = cols[1].match(/\d+/);
        const userDigits = cols[2].match(/\d+/);

        if (refDigits && userDigits) {
          const refScore = Math.min(100, Math.max(0, parseInt(refDigits[0], 10)));
          const userScore = Math.min(100, Math.max(0, parseInt(userDigits[0], 10)));
          const status = cols[3]?.trim() || (userScore >= 75 ? '🟢' : userScore >= 50 ? '🟡' : '🔴');

          // Short label for Radar Chart Axis
          let shortMetric = fullMetric;
          const parenMatch = fullMetric.match(/\((.*?)\)/);
          if (parenMatch && fullMetric.length > 18) {
            shortMetric = parenMatch[1];
          } else if (fullMetric.length > 20) {
            shortMetric = fullMetric.slice(0, 18) + '...';
          }

          items.push({
            metric: shortMetric,
            fullMetric: fullMetric,
            reference: refScore,
            user: userScore,
            status,
          });
        }
      }
    }
  }

  // Fallback: If not found under specific header, search any table in the markdown
  if (items.length === 0) {
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        const cols = line
          .split('|')
          .map((c) => c.trim())
          .filter((c) => c.length > 0);

        if (
          cols.length >= 3 &&
          !cols[0].includes('---') &&
          !cols[0].toLowerCase().includes('boyut') &&
          !cols[0].toLowerCase().includes('name')
        ) {
          const refDigits = cols[1].match(/\d+/);
          const userDigits = cols[2].match(/\d+/);

          if (refDigits && userDigits) {
            const fullMetric = cols[0].replace(/[#*`_]/g, '').trim();
            const refScore = Math.min(100, Math.max(0, parseInt(refDigits[0], 10)));
            const userScore = Math.min(100, Math.max(0, parseInt(userDigits[0], 10)));
            const status = cols[3]?.trim() || (userScore >= 75 ? '🟢' : userScore >= 50 ? '🟡' : '🔴');

            let shortMetric = fullMetric;
            const parenMatch = fullMetric.match(/\((.*?)\)/);
            if (parenMatch && fullMetric.length > 18) {
              shortMetric = parenMatch[1];
            }

            items.push({
              metric: shortMetric,
              fullMetric,
              reference: refScore,
              user: userScore,
              status,
            });
          }
        }
      }
    }
  }

  return items;
}

export function FlowRadarChart({
  markdown,
  referenceName = 'Referans Video',
  userName = 'Senin Videon',
}: FlowRadarChartProps) {
  const data = useMemo(() => {
    const parsed = parseFlowScores(markdown);
    if (parsed.length >= 3) {
      return parsed;
    }
    // Default fallback if older analysis has no table
    return [
      { metric: 'Cut Rate', fullMetric: 'Sahne Geçiş Hızı (Cut Rate)', reference: 88, user: 62, status: '🟡' },
      { metric: 'Görsel Uyaran', fullMetric: 'Görsel Uyaran Yoğunluğu', reference: 90, user: 55, status: '🔴' },
      { metric: 'Ses Senkronu', fullMetric: 'Ses-Görüntü Senkronu', reference: 94, user: 74, status: '🟡' },
      { metric: 'Kanca Gücü', fullMetric: 'Kanca (Hook) Gücü', reference: 85, user: 65, status: '🟡' },
      { metric: 'Ritim & Tempo', fullMetric: 'Ritim & Pacing', reference: 92, user: 60, status: '🟡' },
    ];
  }, [markdown]);

  // Calculate overall average scores
  const stats = useMemo(() => {
    if (data.length === 0) return { avgUser: 0, avgRef: 0, diff: 0 };
    const totalUser = data.reduce((acc, curr) => acc + curr.user, 0);
    const totalRef = data.reduce((acc, curr) => acc + curr.reference, 0);
    const avgUser = Math.round(totalUser / data.length);
    const avgRef = Math.round(totalRef / data.length);
    const diff = avgUser - avgRef;
    return { avgUser, avgRef, diff };
  }, [data]);

  return (
    <div className="bg-[#151518] border border-[#2C2C2E] rounded-xl p-5 mb-6 shadow-lg">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-[#2C2C2E] gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#8E8E93] flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[#FF3B30]" />
            Akış Puanlaması (Radar Karşılaştırması)
          </div>
          <p className="text-[12px] text-[#8E8E93] mt-1">
            Videonuzun kurgu temposu ve dinamiklerinin referans videoya göre radar haritası
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[12px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#38BDF8] inline-block shadow-[0_0_8px_rgba(56,189,248,0.5)]"></span>
            <span className="text-[#E5E5E7] font-medium">{referenceName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FF3B30] inline-block shadow-[0_0_8px_rgba(255,59,48,0.5)]"></span>
            <span className="text-[#E5E5E7] font-medium">{userName}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Radar Chart + Score Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Recharts Radar Chart */}
        <div className="lg:col-span-7 h-[310px] w-full flex items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="75%" margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="#2C2C2E" strokeDasharray="3 3" />
              <PolarAngleAxis
                dataKey="metric"
                stroke="#8E8E93"
                tick={{ fill: '#D1D1D6', fontSize: 11, fontWeight: 500 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                stroke="#3A3A3C"
                tick={{ fill: '#71717A', fontSize: 9 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as FlowScoreItem;
                    const diff = item.user - item.reference;
                    return (
                      <div className="bg-[#1C1C1E] border border-[#2C2C2E] p-3 rounded-lg shadow-2xl text-xs space-y-1.5 min-w-[190px] z-50">
                        <div className="font-semibold text-[#E5E5E7] border-b border-[#2C2C2E] pb-1.5 flex items-center justify-between">
                          <span>{item.fullMetric}</span>
                          <span>{item.status}</span>
                        </div>
                        <div className="flex justify-between items-center text-[#38BDF8] pt-0.5">
                          <span>{referenceName}:</span>
                          <span className="font-mono font-bold">{item.reference}/100</span>
                        </div>
                        <div className="flex justify-between items-center text-[#FF3B30]">
                          <span>{userName}:</span>
                          <span className="font-mono font-bold">{item.user}/100</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-[#2C2C2E] text-[11px]">
                          <span className="text-[#8E8E93]">Fark (Geliştirme):</span>
                          <span className={`font-mono font-bold ${diff >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`}>
                            {diff > 0 ? `+${diff}` : diff} puan
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Reference Video Radar */}
              <Radar
                name={referenceName}
                dataKey="reference"
                stroke="#38BDF8"
                fill="#38BDF8"
                fillOpacity={0.2}
                strokeWidth={2}
                isAnimationActive={true}
              />
              {/* User's Video Radar */}
              <Radar
                name={userName}
                dataKey="user"
                stroke="#FF3B30"
                fill="#FF3B30"
                fillOpacity={0.4}
                strokeWidth={2.5}
                isAnimationActive={true}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Bento Summary Stats Column */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Average Edit Score Bento Card */}
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#8E8E93] block mb-1">
                Ortalama Akış Skoru
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[32px] font-black text-white font-mono leading-none">
                  {stats.avgUser}
                </span>
                <span className="text-[14px] text-[#8E8E93] font-mono">/100</span>
              </div>
              <p className="text-[11px] text-[#8E8E93] mt-1.5 flex items-center gap-1">
                {stats.diff < 0 ? (
                  <>
                    <TrendingUp className="w-3 h-3 text-[#FF9F0A]" />
                    Referansa göre <span className="text-[#FF9F0A] font-medium font-mono">%{Math.abs(stats.diff)}</span> geliştirilebilir.
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-[#30D158]" />
                    Referans standartlarında akış yakalandı!
                  </>
                )}
              </p>
            </div>

            <div className="text-right">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                  stats.avgUser >= 75
                    ? 'bg-[#30D158]/10 text-[#30D158] border border-[#30D158]/20'
                    : stats.avgUser >= 55
                    ? 'bg-[#FF9F0A]/10 text-[#FF9F0A] border border-[#FF9F0A]/20'
                    : 'bg-[#FF453A]/10 text-[#FF453A] border border-[#FF453A]/20'
                }`}
              >
                {stats.avgUser >= 75 ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> Yüksek Akış
                  </>
                ) : stats.avgUser >= 55 ? (
                  <>
                    <AlertTriangle className="w-3 h-3" /> Orta Tempo
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" /> Hızlandırılmalı
                  </>
                )}
              </span>
              <div className="mt-2 text-[11px] text-[#8E8E93]">
                Referans: <span className="font-mono text-[#38BDF8] font-semibold">{stats.avgRef}/100</span>
              </div>
            </div>
          </div>

          {/* Dimension Metric Bars */}
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-3.5 space-y-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] pb-1 border-b border-[#2C2C2E]/60 flex justify-between items-center">
              <span>Metrik Kırılımı</span>
              <span className="font-mono text-[10px] text-[#8E8E93]">Senin / Ref</span>
            </div>

            {data.map((item, idx) => {
              const gap = item.user - item.reference;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#E5E5E7] flex items-center gap-1.5 truncate max-w-[170px]">
                      <span>{item.status || '○'}</span>
                      <span className="truncate">{item.metric}</span>
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="text-[#FF3B30] font-semibold">{item.user}</span>
                      <span className="text-[#8E8E93]">/</span>
                      <span className="text-[#38BDF8] font-semibold">{item.reference}</span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-sans ${
                          gap >= 0 ? 'bg-[#30D158]/10 text-[#30D158]' : 'bg-[#FF453A]/10 text-[#FF453A]'
                        }`}
                      >
                        {gap > 0 ? `+${gap}` : gap}
                      </span>
                    </div>
                  </div>

                  {/* Dual Bar (User vs Ref) */}
                  <div className="h-1.5 w-full bg-[#0F0F11] rounded-full overflow-hidden flex relative">
                    {/* User bar */}
                    <div
                      className="h-full bg-[#FF3B30] rounded-full transition-all duration-500 z-10"
                      style={{ width: `${item.user}%` }}
                    />
                    {/* Reference target line / marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-[#38BDF8] z-20"
                      style={{ left: `${item.reference}%` }}
                      title={`Referans hedef: ${item.reference}%`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
