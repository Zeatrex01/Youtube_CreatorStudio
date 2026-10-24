'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Scissors,
  ZoomIn,
  Volume2,
  Type,
  Film,
  Sparkles,
  Clock,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Filter,
  Layers,
  Info,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type TimelineMarker = {
  id: string;
  name: string;
  timecode: string;
  seconds: number;
  description: string;
  category: 'cut' | 'zoom' | 'audio' | 'text' | 'broll' | 'other';
};

interface TimelineViewerProps {
  csvData?: string;
  markdown?: string;
}

/**
 * Parses timecodes such as:
 * - "00:00:02:15" (SMPTE HH:MM:SS:FF, assuming ~30fps)
 * - "00:00:05,000" or "00:00:05.000"
 * - "00:01:25"
 * - "01:25"
 * - "12.5"
 */
export function parseTimecodeToSeconds(tc: string): number {
  if (!tc) return 0;
  const clean = tc.trim().replace(/"/g, '');

  // Check if standard SMPTE with frames: HH:MM:SS:FF
  const parts = clean.split(':');
  if (parts.length === 4) {
    const hours = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    const frames = parseFloat(parts[3]) || 0;
    return hours * 3600 + mins * 60 + secs + frames / 30;
  }

  // Check HH:MM:SS or HH:MM:SS,mmm or HH:MM:SS.mmm
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secParts = parts[2].replace(',', '.');
    const secs = parseFloat(secParts) || 0;
    return hours * 3600 + mins * 60 + secs;
  }

  // Check MM:SS
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secParts = parts[1].replace(',', '.');
    const secs = parseFloat(secParts) || 0;
    return mins * 60 + secs;
  }

  // Raw number of seconds
  const rawSec = parseFloat(clean.replace(',', '.'));
  return isNaN(rawSec) ? 0 : rawSec;
}

/**
 * Formats seconds back to friendly MM:SS:ff or MM:SS
 */
export function formatSecondsToTimecode(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const frames = Math.floor((totalSeconds % 1) * 30);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

export function detectCategory(name: string, desc: string): TimelineMarker['category'] {
  const text = `${name} ${desc}`.toLowerCase();
  if (text.includes('cut') || text.includes('kesim') || text.includes('jump') || text.includes('sil') || text.includes('budama')) {
    return 'cut';
  }
  if (text.includes('zoom') || text.includes('yaklaş') || text.includes('punch') || text.includes('scale') || text.includes('kamera')) {
    return 'zoom';
  }
  if (text.includes('sfx') || text.includes('ses') || text.includes('pop') || text.includes('müzik') || text.includes('audio') || text.includes('whoosh')) {
    return 'audio';
  }
  if (text.includes('text') || text.includes('yazı') || text.includes('altyazı') || text.includes('lower third') || text.includes('başlık')) {
    return 'text';
  }
  if (text.includes('b-roll') || text.includes('broll') || text.includes('geçiş') || text.includes('sahne') || text.includes('overlay')) {
    return 'broll';
  }
  return 'other';
}

export function parseMarkersFromInput(csvString?: string, markdownString?: string): TimelineMarker[] {
  let source = csvString || '';

  // If raw markdown is passed, extract the ```csv block
  if (!source && markdownString) {
    const csvMatch = markdownString.match(/```csv\n([\s\S]*?)```/i);
    if (csvMatch) {
      source = csvMatch[1];
    }
  }

  if (!source.trim()) {
    // Provide sensible default markers if none generated yet
    return [
      {
        id: 'def-1',
        name: 'Görsel Kanca (Hook)',
        timecode: '00:00:01:10',
        seconds: 1.33,
        description: 'Videonun ilk 2 saniyesinde izleyiciyi tutacak hızlı hareket veya soru kartı',
        category: 'zoom',
      },
      {
        id: 'def-2',
        name: 'Zoom In (Punch-in)',
        timecode: '00:00:03:15',
        seconds: 3.5,
        description: 'Vurgulanan anahtar cümlede %115 ölçekle yüze yaklaş',
        category: 'zoom',
      },
      {
        id: 'def-3',
        name: 'SFX Pop + Lower Third',
        timecode: '00:00:06:00',
        seconds: 6.0,
        description: 'Ekrana konu başlığı gelirken hafif pop/whoosh efekti ekle',
        category: 'audio',
      },
      {
        id: 'def-4',
        name: 'Jump Cut (Boşluk Sil)',
        timecode: '00:00:09:20',
        seconds: 9.67,
        description: 'Konuşmacının nefes alma ve duraklama aralığını jiletle kes',
        category: 'cut',
      },
      {
        id: 'def-5',
        name: 'B-Roll Geçişi',
        timecode: '00:00:14:05',
        seconds: 14.17,
        description: 'Anlatılan ürün/ekran görüntüsünü tam ekran 3 saniye göster',
        category: 'broll',
      },
      {
        id: 'def-6',
        name: 'Vurgu Altyazı',
        timecode: '00:00:18:12',
        seconds: 18.4,
        description: 'Önemli istatistik veya anahtar kelimeyi animasyonlu sarı yazı ile bas',
        category: 'text',
      },
    ];
  }

  const lines = source.trim().split('\n');
  const markers: TimelineMarker[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Split CSV handling quoted strings
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let charIdx = 0; charIdx < rawLine.length; charIdx++) {
      const char = rawLine[charIdx];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());

    // Clean quotes
    const cleaned = cols.map((col) => col.replace(/^["']|["']$/g, '').trim());

    // Skip header row
    if (
      cleaned[0]?.toLowerCase().includes('name') ||
      cleaned[0]?.toLowerCase().includes('isim') ||
      cleaned[0]?.toLowerCase().includes('etiket') ||
      cleaned[1]?.toLowerCase().includes('in') ||
      cleaned[1]?.toLowerCase().includes('zaman')
    ) {
      continue;
    }

    if (cleaned.length >= 2) {
      const name = cleaned[0] || `Marker ${i + 1}`;
      const tc = cleaned[1] || '00:00:00';
      const desc = cleaned[2] || name;
      const seconds = parseTimecodeToSeconds(tc);
      const category = detectCategory(name, desc);

      markers.push({
        id: `marker-${i}-${seconds.toFixed(2)}`,
        name,
        timecode: tc,
        seconds,
        description: desc,
        category,
      });
    }
  }

  // Sort markers chronologically
  return markers.sort((a, b) => a.seconds - b.seconds);
}

const CATEGORY_STYLES: Record<
  TimelineMarker['category'],
  { label: string; icon: typeof Scissors; color: string; bg: string; border: string; glow: string }
> = {
  cut: {
    label: 'Kesim / Cut',
    icon: Scissors,
    color: 'text-[#FF9F0A]',
    bg: 'bg-[#FF9F0A]/15',
    border: 'border-[#FF9F0A]/50',
    glow: 'rgba(255, 159, 10, 0.4)',
  },
  zoom: {
    label: 'Zoom / Scale',
    icon: ZoomIn,
    color: 'text-[#FF3B30]',
    bg: 'bg-[#FF3B30]/15',
    border: 'border-[#FF3B30]/50',
    glow: 'rgba(255, 59, 48, 0.4)',
  },
  audio: {
    label: 'Ses & SFX',
    icon: Volume2,
    color: 'text-[#38BDF8]',
    bg: 'bg-[#38BDF8]/15',
    border: 'border-[#38BDF8]/50',
    glow: 'rgba(56, 189, 248, 0.4)',
  },
  text: {
    label: 'Yazı / Titre',
    icon: Type,
    color: 'text-[#BF5AF2]',
    bg: 'bg-[#BF5AF2]/15',
    border: 'border-[#BF5AF2]/50',
    glow: 'rgba(191, 90, 242, 0.4)',
  },
  broll: {
    label: 'B-Roll & Geçiş',
    icon: Film,
    color: 'text-[#30D158]',
    bg: 'bg-[#30D158]/15',
    border: 'border-[#30D158]/50',
    glow: 'rgba(48, 209, 88, 0.4)',
  },
  other: {
    label: 'Genel Efekt',
    icon: Sparkles,
    color: 'text-[#FFD60A]',
    bg: 'bg-[#FFD60A]/15',
    border: 'border-[#FFD60A]/50',
    glow: 'rgba(255, 214, 10, 0.4)',
  },
};

export function TimelineViewer({ csvData, markdown }: TimelineViewerProps) {
  const markers = useMemo(() => parseMarkersFromInput(csvData, markdown), [csvData, markdown]);

  const [userSelectedId, setUserSelectedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [copiedTimecode, setCopiedTimecode] = useState(false);
  const [userCurrentTime, setUserCurrentTime] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const timelineTrackRef = useRef<HTMLDivElement>(null);

  // Compute total duration (ceiling of max marker seconds + buffer)
  const totalDuration = useMemo(() => {
    if (markers.length === 0) return 60;
    const maxSec = Math.max(...markers.map((m) => m.seconds));
    // Round up nicely to next 10 or 15 second block with minimum 30s
    const rounded = Math.ceil((maxSec + 5) / 10) * 10;
    return Math.max(30, rounded);
  }, [markers]);

  // Selected marker object: user selected or first marker by default
  const activeMarker = useMemo(() => {
    if (userSelectedId) {
      const found = markers.find((m) => m.id === userSelectedId);
      if (found) return found;
    }
    return markers[0] || null;
  }, [markers, userSelectedId]);

  const selectedMarkerId = activeMarker ? activeMarker.id : null;
  const currentTime = userCurrentTime !== null ? userCurrentTime : (activeMarker ? activeMarker.seconds : 0);

  // Playback simulation timer
  useEffect(() => {
    let animFrame: number;
    let lastTimestamp: number | null = null;

    if (isPlaying) {
      const step = (timestamp: number) => {
        if (!lastTimestamp) lastTimestamp = timestamp;
        const delta = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;

        setUserCurrentTime((prev) => {
          const base = prev !== null ? prev : (activeMarker ? activeMarker.seconds : 0);
          const next = base + delta;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return next;
        });

        animFrame = requestAnimationFrame(step);
      };
      animFrame = requestAnimationFrame(step);
    }

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [isPlaying, totalDuration, activeMarker]);

  // Filtered markers
  const filteredMarkers = useMemo(() => {
    if (filterCategory === 'all') return markers;
    return markers.filter((m) => m.category === filterCategory);
  }, [markers, filterCategory]);

  // Scrubber click/drag handler
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineTrackRef.current) return;
    const rect = timelineTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSeconds = percent * totalDuration;
    setUserCurrentTime(targetSeconds);

    // Find closest marker within tolerance
    const closest = markers.reduce((prev, curr) => {
      return Math.abs(curr.seconds - targetSeconds) < Math.abs(prev.seconds - targetSeconds) ? curr : prev;
    }, markers[0]);

    if (closest && Math.abs(closest.seconds - targetSeconds) < totalDuration * 0.05) {
      setUserSelectedId(closest.id);
    }
  };

  const handleSelectMarker = (marker: TimelineMarker) => {
    setUserSelectedId(marker.id);
    setUserCurrentTime(marker.seconds);
  };

  const handlePrevMarker = () => {
    if (!activeMarker) return;
    const idx = markers.findIndex((m) => m.id === activeMarker.id);
    if (idx > 0) {
      handleSelectMarker(markers[idx - 1]);
    }
  };

  const handleNextMarker = () => {
    if (!activeMarker) return;
    const idx = markers.findIndex((m) => m.id === activeMarker.id);
    if (idx >= 0 && idx < markers.length - 1) {
      handleSelectMarker(markers[idx + 1]);
    }
  };

  const handleCopyTimecode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTimecode(true);
    setTimeout(() => setCopiedTimecode(false), 2000);
  };

  // Generate tick marks (e.g. 5-7 ticks along the timeline)
  const ticks = useMemo(() => {
    const count = 6;
    const step = totalDuration / count;
    return Array.from({ length: count + 1 }, (_, i) => {
      const sec = Math.min(totalDuration, i * step);
      return {
        seconds: sec,
        label: formatSecondsToTimecode(sec).slice(0, 5), // MM:SS
        percent: (sec / totalDuration) * 100,
      };
    });
  }, [totalDuration]);

  return (
    <div className="bg-[#151518] border border-[#2C2C2E] rounded-xl p-5 mb-6 shadow-lg overflow-hidden">
      {/* Top Header / Studio Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-[#2C2C2E] gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#8E8E93] flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-[#FF3B30]" />
            Kurgu Zaman Çizelgesi (Timeline Viewer)
          </div>
          <p className="text-[12px] text-[#8E8E93] mt-1">
            CSV markerlarını görsel NLE zaman çizgisi üzerinde inceleyin, filtreleyin ve tek tıkla kurgu noktasına odaklanın
          </p>
        </div>

        {/* Playhead Timecode & Simulation Player */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer ${
              isPlaying
                ? 'bg-[#FF3B30] text-white hover:bg-red-600'
                : 'bg-[#2C2C2E] text-[#E5E5E7] hover:bg-[#3A3A3C]'
            }`}
            title={isPlaying ? 'Durdur' : 'Timeline Oynat'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? 'Durdur' : 'Önizle'}</span>
          </button>

          <div className="flex items-center bg-[#0F0F11] border border-[#2C2C2E] rounded-md px-2.5 py-1 font-mono text-[13px] text-[#E5E5E7] tracking-wider">
            <Clock className="w-3.5 h-3.5 mr-1.5 text-[#FF3B30]" />
            <span className="font-bold">{formatSecondsToTimecode(currentTime)}</span>
            <span className="text-[#8E8E93] text-[11px] ml-1">/ {formatSecondsToTimecode(totalDuration)}</span>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 custom-scrollbar text-[11px]">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1 rounded-md font-medium transition-colors shrink-0 cursor-pointer ${
            filterCategory === 'all'
              ? 'bg-[#E5E5E7] text-[#0F0F11] font-bold shadow-sm'
              : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-[#E5E5E7] border border-[#2C2C2E]'
          }`}
        >
          Tümü ({markers.length})
        </button>
        {Object.entries(CATEGORY_STYLES).map(([key, style]) => {
          const count = markers.filter((m) => m.category === key).length;
          if (count === 0) return null;
          const Icon = style.icon;
          const isActive = filterCategory === key;
          return (
            <button
              key={key}
              onClick={() => setFilterCategory(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors shrink-0 cursor-pointer ${
                isActive
                  ? `${style.bg} ${style.color} border ${style.border} font-bold`
                  : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-[#E5E5E7] border border-[#2C2C2E]'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{style.label}</span>
              <span className="text-[10px] opacity-70 font-mono">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Timeline Canvas */}
      <div className="bg-[#0F0F11] border border-[#2C2C2E] rounded-xl p-4 md:p-5 relative select-none mb-5">
        {/* Ruler Bar / Time Ticks */}
        <div className="relative h-6 border-b border-[#2C2C2E] mb-6">
          {ticks.map((tick, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: `${tick.percent}%` }}
            >
              <span className="font-mono text-[9px] text-[#71717A] tracking-tighter">{tick.label}</span>
              <div className="w-[1px] h-2 bg-[#3A3A3C] mt-0.5" />
            </div>
          ))}
        </div>

        {/* Timeline Track Area */}
        <div
          ref={timelineTrackRef}
          onClick={handleTimelineClick}
          className="relative h-24 bg-[#141417] rounded-lg border border-[#262629] cursor-crosshair overflow-visible group"
        >
          {/* Subtle Grid Tracklines */}
          <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-20">
            <div className="border-b border-dashed border-[#8E8E93] w-full" />
            <div className="border-b border-dashed border-[#8E8E93] w-full" />
            <div className="border-b border-dashed border-[#8E8E93] w-full" />
          </div>

          {/* Scrubber Progress Fill */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-[#FF3B30]/5 pointer-events-none transition-all duration-75"
            style={{ width: `${Math.min(100, (currentTime / totalDuration) * 100)}%` }}
          />

          {/* Red Playhead Line */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-[#FF3B30] pointer-events-none z-30 transition-all duration-75 shadow-[0_0_10px_rgba(255,59,48,0.8)]"
            style={{ left: `${Math.min(100, (currentTime / totalDuration) * 100)}%` }}
          >
            {/* Playhead Arrow / Head */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-[#FF3B30]" />
          </div>

          {/* Event Chips / Marker Pins */}
          {filteredMarkers.map((marker, index) => {
            const percent = Math.min(98, Math.max(2, (marker.seconds / totalDuration) * 100));
            const isSelected = selectedMarkerId === marker.id;
            const style = CATEGORY_STYLES[marker.category];
            const Icon = style.icon;

            // Stagger vertically (2 lanes) to prevent horizontal collision
            const laneTop = (index % 2 === 0 ? 12 : 52);

            return (
              <div
                key={marker.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectMarker(marker);
                }}
                className={`absolute -translate-x-1/2 cursor-pointer z-20 group/chip transition-transform duration-150 ${
                  isSelected ? 'scale-105 z-40' : 'hover:scale-105 hover:z-30'
                }`}
                style={{
                  left: `${percent}%`,
                  top: `${laneTop}px`,
                }}
              >
                {/* Visual Marker Chip */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shadow-md backdrop-blur-md ${
                    isSelected
                      ? `${style.bg} ${style.color} border-2 ${style.border} ring-2 ring-[#FF3B30]/40 shadow-[0_0_12px_${style.glow}] font-bold`
                      : `bg-[#1C1C1E]/95 text-[#D1D1D6] border border-[#3A3A3C] hover:border-[#8E8E93]`
                  }`}
                >
                  <Icon className={`w-3 h-3 ${style.color} shrink-0`} />
                  <span className="truncate max-w-[90px] md:max-w-[120px] font-sans">{marker.name}</span>
                  <span className="font-mono text-[9px] text-[#8E8E93] bg-[#0F0F11]/60 px-1 py-0.5 rounded ml-0.5">
                    {marker.timecode.split(':').slice(-2).join(':')}
                  </span>
                </div>

                {/* Vertical Stem Dropdown to axis */}
                <div
                  className={`w-[1px] mx-auto transition-colors ${
                    isSelected ? 'bg-[#FF3B30] h-6' : 'bg-[#3A3A3C] group-hover/chip:bg-[#8E8E93] h-4'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Timeline Footer Controls */}
        <div className="flex items-center justify-between text-[11px] text-[#8E8E93] mt-3 pt-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#FF3B30] inline-block" /> Toplam Marker: <strong className="text-white font-mono">{markers.length}</strong>
            </span>
            <span className="hidden sm:inline-block">•</span>
            <span className="hidden sm:inline-block">Tıklayarak kurgu noktasına atlayın</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevMarker}
              disabled={!activeMarker || markers.indexOf(activeMarker) === 0}
              className="p-1.5 bg-[#1C1C1E] hover:bg-[#2C2C2E] disabled:opacity-30 disabled:pointer-events-none rounded text-[#E5E5E7] transition-colors cursor-pointer"
              title="Önceki Marker"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[10px] px-1 text-[#E5E5E7]">
              {activeMarker ? `${markers.indexOf(activeMarker) + 1} / ${markers.length}` : '0/0'}
            </span>
            <button
              onClick={handleNextMarker}
              disabled={!activeMarker || markers.indexOf(activeMarker) === markers.length - 1}
              className="p-1.5 bg-[#1C1C1E] hover:bg-[#2C2C2E] disabled:opacity-30 disabled:pointer-events-none rounded text-[#E5E5E7] transition-colors cursor-pointer"
              title="Sonraki Marker"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Selected Marker Detail Card */}
      {activeMarker && (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMarker.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3.5 flex-1 min-w-0">
              {/* Category Icon Badge */}
              <div
                className={`p-3 rounded-lg shrink-0 ${CATEGORY_STYLES[activeMarker.category].bg} ${CATEGORY_STYLES[activeMarker.category].border} border`}
              >
                {React.createElement(CATEGORY_STYLES[activeMarker.category].icon, {
                  className: `w-5 h-5 ${CATEGORY_STYLES[activeMarker.category].color}`,
                })}
              </div>

              {/* Marker Texts */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4 className="text-[14px] font-bold text-white tracking-tight truncate">
                    {activeMarker.name}
                  </h4>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${CATEGORY_STYLES[activeMarker.category].bg} ${CATEGORY_STYLES[activeMarker.category].color} ${CATEGORY_STYLES[activeMarker.category].border}`}
                  >
                    {CATEGORY_STYLES[activeMarker.category].label}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[#FF3B30] bg-[#FF3B30]/10 px-2 py-0.5 rounded border border-[#FF3B30]/20">
                    ⏱ {activeMarker.timecode}
                  </span>
                </div>

                <p className="text-[12px] text-[#A1A1AA] leading-relaxed">
                  {activeMarker.description}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                onClick={() => handleCopyTimecode(activeMarker.timecode)}
                className="flex items-center gap-1.5 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#E5E5E7] px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                title="Timecode Kopyala"
              >
                {copiedTimecode ? <Check className="w-3.5 h-3.5 text-[#30D158]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTimecode ? 'Kopyalandı!' : 'Zaman Kodunu Kopyala'}</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Marker List Grid (Compact NLE cue sheet) */}
      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-2 flex items-center justify-between">
          <span>Marker İndeksi & Kurgu Talimatları</span>
          <span className="font-mono text-[10px] text-[#8E8E93]">{filteredMarkers.length} kayıt listelendi</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
          {filteredMarkers.map((m) => {
            const isSelected = selectedMarkerId === m.id;
            const style = CATEGORY_STYLES[m.category];
            const Icon = style.icon;

            return (
              <div
                key={m.id}
                onClick={() => handleSelectMarker(m)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
                  isSelected
                    ? 'bg-[#1C1C1E] border-[#FF3B30] shadow-sm'
                    : 'bg-[#121214] border-[#242426] hover:border-[#3A3A3C]'
                }`}
              >
                <div className={`p-1.5 rounded ${style.bg} shrink-0 mt-0.5`}>
                  <Icon className={`w-3.5 h-3.5 ${style.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[12px] font-semibold text-white truncate">{m.name}</span>
                    <span className="text-[10px] font-mono text-[#FF3B30] shrink-0 font-bold">
                      {m.timecode}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8E8E93] line-clamp-1">
                    {m.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
