'use client';

import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { 
  Play, 
  Loader2, 
  Trash2, 
  History as HistoryIcon, 
  Music, 
  FileVideo, 
  Link, 
  Download, 
  FileText, 
  FileDown,
  Film,
  ChevronDown,
  Sparkles,
  GraduationCap,
  Gamepad2,
  Mic,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FlowRadarChart } from '@/components/FlowRadarChart';
import { TimelineViewer } from '@/components/TimelineViewer';
import { AnalysisScoreCard } from '@/components/AnalysisScoreCard';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

type VideoGenre = 'Vlog' | 'Eğitim' | 'Oyun' | 'Podcast';

const GENRE_CONFIG: Record<VideoGenre, {
  label: string;
  icon: typeof Film;
  badge: string;
  description: string;
  placeholder: string;
  quickTips: string[];
}> = {
  'Vlog': {
    label: 'Vlog',
    icon: Film,
    badge: '🎥 VLOG',
    description: 'Dinamik B-roll, ani punch-in zoomlar, arkaplan müzik ducking ve jump cut ritmi',
    placeholder: 'Örn: B-roll geçişleri, vlog arkaplan müziği ducking, dinamik punch-in zoomlar ve renk uyumu...',
    quickTips: ['B-Roll Geçişleri', 'Jump Cut Sıklığı', 'Arkaplan Müzik Ducking', 'Punch-in Yakınlaşma']
  },
  'Eğitim': {
    label: 'Eğitim',
    icon: GraduationCap,
    badge: '🎓 EĞİTİM',
    description: 'Açıklayıcı sakin tempo, alt bantlar (lower thirds), infografik ve adım adımlı bölümler',
    placeholder: 'Örn: Bölüm başlıkları (lower thirds), infografik vurguları, anlaşılır konuşma hızı ve ekran geçişleri...',
    quickTips: ['Alt Yazı / Lower Third', 'İnfografik Vurguları', 'Adım Adım Bölümler', 'Açıklayıcı Sakin Tempo']
  },
  'Oyun': {
    label: 'Oyun',
    icon: Gamepad2,
    badge: '🎮 OYUN',
    description: 'Aksiyon odaklı jump cutlar, komik anlara meme SFX efektleri ve facecam yakınlaşmaları',
    placeholder: 'Örn: Komik anlara meme SFX sesleri, kilit zafer/yenilgi anlarında zoom, hızlı aksiyon montajı...',
    quickTips: ['Aksiyon Jump Cut', 'Meme & SFX Efektleri', 'Facecam Yakınlaşma', 'Kritik Zafer Anı']
  },
  'Podcast': {
    label: 'Podcast',
    icon: Mic,
    badge: '🎙️ PODCAST',
    description: 'Konuşmacı ses dengesi, gereksiz sessizlik (es) budama ve çarpıcı alıntı vurgu kartları',
    placeholder: 'Örn: Konuşmacı değişim dinamikleri, aradaki sessizlik/es temizliği, vurucu alıntılara vurgu...',
    quickTips: ['Sessizlik Budama', 'Konuşmacı Ayrımı', 'Çarpıcı Alıntı Kartı', 'Ses Seviye Dengeleme']
  }
};

type HistoryItem = {
  id: string;
  referenceUrl: string;
  myUrl: string;
  result: string;
  date: string;
  videoGenre?: VideoGenre;
};

const PROGRESS_STEPS = [
  "Veriler Çekiliyor...",
  "Referans Video Analiz Ediliyor...",
  "Kurgu Stilleri Karşılaştırılıyor...",
  "Müzik ve Efekt Önerileri Hazırlanıyor...",
  "Rapor Oluşturuluyor..."
];

export default function Home() {
  const [referenceUrl, setReferenceUrl] = useState('');
  const [myUrl, setMyUrl] = useState('');
  const [message, setMessage] = useState('');
  const [videoGenre, setVideoGenre] = useState<VideoGenre>('Vlog');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('editSenseHistory');
        if (stored) return JSON.parse(stored);
      } catch (e) {
        console.error("Geçmiş verileri okunamadı", e);
      }
    }
    return [];
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // New State variables for Local Video
  const [myVideoMode, setMyVideoMode] = useState<'url' | 'file'>('url');
  const [myFile, setMyFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAddQuickTip = (tip: string) => {
    setMessage((prev) => {
      const tag = `[${tip}]`;
      if (!prev.trim()) return tag + ' ';
      if (prev.includes(tag)) return prev;
      return `${prev.trim()} ${tag} `;
    });
  };

  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => Math.min(prev + 1, PROGRESS_STEPS.length - 1));
    }, 3500);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const saveToHistory = (res: string) => {
    const item: HistoryItem = {
      id: Date.now().toString(),
      referenceUrl,
      myUrl,
      result: res,
      date: new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }),
      videoGenre
    };
    const updated = [item, ...history];
    setHistory(updated);
    localStorage.setItem('editSenseHistory', JSON.stringify(updated));
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setReferenceUrl(item.referenceUrl);
    setMyUrl(item.myUrl);
    setResult(item.result);
    if (item.videoGenre) {
      setVideoGenre(item.videoGenre);
    }
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('editSenseHistory', JSON.stringify(updated));
  };

  const handleAnalyze = async () => {
    if (myVideoMode === 'url' && !myUrl) {
      setError('Lütfen senin videon için bir URL girin.');
      return;
    }
    if (myVideoMode === 'file' && !myFile) {
      setError('Lütfen analiz edilecek bir video dosyası seçin.');
      return;
    }

    if (myVideoMode === 'file' && myFile && myFile.size > 20 * 1024 * 1024) {
      setError('Video boyutu maximum 20MB olmalıdır. Daha büyük videolar için YouTube URL\'si kullanın.');
      return;
    }

    setError('');
    setCurrentStepIndex(0);
    setIsAnalyzing(true);
    setResult('');

    try {
      const genreInfo = GENRE_CONFIG[videoGenre];
      const prompt = `Sen "Profesyonel Kurgu Veri Asistanı"sın. Görevin, kullanıcının yüklediği ham videoları analiz etmek ve kurgu yazılımlarında (Premiere Pro, DaVinci, CapCut) kullanılmak üzere teknik veriler (Marker/İşaretçi ve Altyazı) üretmektir.

VİDEO KURGU TÜRÜ: ${videoGenre.toUpperCase()} (${genreInfo.description})
ÖNEMLİ KURAL: Bu video bir "${videoGenre}" kurgusudur. Sahne geçiş sıklığı (cut rate), görsel kanca (hook) yerleşimi, ses ve müzik dengesi, CSV kurgu markerları, SRT altyazı segmentasyonu ve stratejik edit notları doğrudan "${videoGenre}" türünün dinamiklerine, profesyonel montaj standartlarına ve hedef izleyici kitlesine özel olarak uyarlanmalıdır!

TEMEL GÖREVLERİN:
1. Ham Video Analizi: Aşağıda verilen 'Senin Videon' adlı ham videoyu analiz et. Sahneleri, ses tonlamalarını ve görsel boşlukları tespit et.
Senin Videon: ${myVideoMode === 'url' ? myUrl : 'Bu mesaja eklenen video dosyası.'}
Referans Video: ${referenceUrl || `Belirtilmedi (Profesyonel ${videoGenre} kurgu standartlarını ve viral dinamiklerini referans al)`}
Video Kurgu Türü: ${videoGenre}
${message ? `Kullanıcının Edit Notları ve Odak İstekleri: ${message}\n` : ''}
2. Akış Puanlaması (Flow Score): Referans video ile senin videon arasındaki kurgu temposunu ve dinamiğini 5 boyutta 100 üzerinden puanla (Sahne Geçiş Hızı, Görsel Uyaran Yoğunluğu, Ses-Görüntü Senkronu, Kanca Gücü, Ritim & Tempo).
3. Referans Uyumu: Eğer bir referans linki verilmişse, referansın kurgu hızını ve efekt yerleşimini ham videoya uyarla. YouTube videoları hakkında bilgi edinmek ve içeriğinden/transkriptinden faydalanmak için googleSearch aracını KULLANABİLİRSİN.
4. Marker Üretimi: Kurgucuya "buraya şunu yap" diyecek saniye bazlı teknik talimatlar oluştur (${videoGenre} kurgusu için uygun geçiş, punch-in zoom, ses efekti ve kesim noktalarını işaretle).
5. Altyazı Dönüştürme: Videodaki sesi metne dök ve zaman kodlarıyla eşleştir.
6. SEO ve Büyüme: Videonun içeriğine ve ${videoGenre} türüne uygun, platformlarda (Shorts/Reels/TikTok/YouTube) yüksek tıklanma oranı (CTR) getirecek başlık, açıklama metni ve hashtag önerileri üret.

ÇIKTI FORMATI (Aşağıdaki yapıyı kopyalayarak sun, CSV formatındaki kodu \`\`\`csv ile ve SRT formatındaki kodu \`\`\`srt ile sar):

### 📊 Akış Puanlaması (Özet Skorlar)
| Boyut | Referans | Senin Videon | Durum |
|---|---|---|---|
| Sahne Geçiş Hızı (Cut Rate) | 88/100 | 58/100 | 🟡 |
| Görsel Uyaran Yoğunluğu | 92/100 | 52/100 | 🔴 |
| Ses-Görüntü Senkronu | 95/100 | 72/100 | 🟡 |
| Kanca (Hook) Gücü | 85/100 | 62/100 | 🟡 |
| Ritim & Tempo (Pacing) | 90/100 | 60/100 | 🟡 |

### 📍 KURGU MARKERLARI (CSV Formatı)
\`\`\`csv
"Name","In","Description"
"Zoom In","00:00:02:15","Vurgulu kelimeye yaklaş"
"SFX Pop","00:00:05:00","Ekrana yazı geldiğinde ses ekle"
"Jump Cut","00:00:08:10","Buradaki boşluğu sil"
\`\`\`

### 💬 ALTYAZI DOSYASI (SRT Formatı)
\`\`\`srt
1
00:00:01,000 --> 00:00:03,000
[Konuşma metni buraya]
\`\`\`

### 💡 STRATEJİK EDİT NOTLARI (${videoGenre.toUpperCase()} FORMATINA ÖZEL)
- [${videoGenre} türüne özel montaj hilesi, geçiş, SFX veya pacing tavsiyesi...]

### 🚀 SEO ÖNERİLERİ
**🔥 Başlık Önerileri:**
1. [İlgi çekici viral başlık 1]
2. [Merak uyandıran başlık 2]
3. [Eğitici/Açıklayıcı başlık 3]

**📝 Açıklama (Description) Önerisi:**
[Video içeriğine ve ${videoGenre} türüne uygun, anahtar kelime (keyword) açısından zengin, kısa ve okunabilir bir video açıklama metni. Eylem çağrısı (Call to Action) ve ilgili anahtar kelimeleri kelime listesi halinde içermeli.]

**🏷️ Trend Hashtagler:**
[#hashtag1 #hashtag2 #hashtag3 ...]
`;

      let contents: any = prompt;
      if (myVideoMode === 'file' && myFile) {
        const base64Data = await fileToBase64(myFile);
        contents = [
          { inlineData: { data: base64Data, mimeType: myFile.type } },
          prompt
        ];
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: contents,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: 'Sen "Profesyonel Kurgu Veri Asistanı"sın. Cevaplarını her zaman Markdown olarak vermelisin.',
        }
      });

      if (response.text) {
        setResult(response.text);
        saveToHistory(response.text);
      } else {
        throw new Error("Boş yanıt alındı.");
      }
    } catch (err: unknown) {
      console.error(err);
      setError('Analiz sırasında bir hata oluştu. Girdiğiniz bağlantıların doğru olduğundan emin olun.');
    } finally {
      setIsAnalyzing(false);
      setCurrentStepIndex(0);
    }
  };

  const resetAnalysis = () => {
    setReferenceUrl('');
    setMyUrl('');
    setMessage('');
    setVideoGenre('Vlog');
    setError('');
    setResult('');
  };

  const handleDownload = (format: 'csv' | 'srt' | 'md') => {
    let content = '';
    let filename = '';
    let mimeType = '';

    if (format === 'md') {
      content = result;
      filename = 'kurgu_raporu.md';
      mimeType = 'text/markdown';
    } else {
      const regex = new RegExp(`\`\`\`${format}\\n([\\s\\S]*?)\`\`\``, 'i');
      const match = result.match(regex);
      if (match) {
        content = match[1].trim();
        filename = format === 'csv' ? 'markerlar.csv' : 'altyazi.srt';
        mimeType = format === 'csv' ? 'text/csv' : 'text/plain';
      } else {
        alert(`${format.toUpperCase()} formatında veri bulunamadı. Yapay zekanın yanıtında ${format.toUpperCase()} bloğu olduğundan emin olun.`);
        return;
      }
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0F0F11] text-[#E5E5E7] font-sans flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="h-16 border-b border-[#2C2C2E] flex items-center justify-between px-6 shrink-0 z-10 sticky top-0 bg-[#0F0F11]/90 backdrop-blur">
        <div className="font-[800] text-[20px] tracking-tight text-[#E5E5E7] flex items-center gap-2">
          Kurgu<span className="text-[#FF3B30]">Analizcisi</span>
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-[13px] text-[#8E8E93] hidden sm:block">Pro Plan</div>
          <button
            onClick={resetAnalysis}
            className="bg-[#FF3B30] text-white border-none px-4 py-2 rounded-md font-[600] text-[13px] hover:bg-red-600 transition-colors cursor-pointer"
          >
            Yeni Analiz 
          </button>
        </div>
      </header>

      {/* Main Grid Container */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 auto-rows-max gap-4 p-4 md:p-6 max-w-[1100px] w-full mx-auto pb-20">
        
        {/* Card: Reference Video */}
        <div className="md:col-span-6 bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-4 flex flex-col gap-4 overflow-hidden shadow-sm">
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#8E8E93] flex items-center gap-2">
            Referans Video
            <span className="bg-[#FF3B30]/10 text-[#FF3B30] px-1.5 py-0.5 rounded text-[10px] font-bold ml-auto">
              YOUTUBE SOURCE
            </span>
          </div>
          <div className="w-full aspect-video bg-black rounded-lg relative flex items-center justify-center border-none">
            <Play className="w-8 h-8 text-[#E5E5E7] opacity-50" fill="currentColor" />
            <div className="font-mono text-[11px] bg-black/80 px-1.5 py-0.5 rounded absolute bottom-2 right-2 tracking-wider">
              REF
            </div>
          </div>
          <input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            disabled={isAnalyzing}
            className="w-full px-3 py-2 bg-[#0F0F11] border border-[#2C2C2E] rounded-md focus:outline-none focus:border-[#FF3B30] transition-colors placeholder:text-[#8E8E93] text-[13px] text-[#E5E5E7] disabled:opacity-50"
          />
        </div>

        {/* Card: My Video */}
        <div className="md:col-span-6 bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-4 flex flex-col gap-4 overflow-hidden shadow-sm">
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#8E8E93] flex items-center justify-between">
            <div className="flex items-center gap-2">
              Senin Videon
              <span className="bg-[#FF3B30]/10 text-[#FF3B30] px-1.5 py-0.5 rounded text-[10px] font-bold">
                {myVideoMode === 'url' ? 'YOUTUBE SOURCE' : 'LOCAL FILE'}
              </span>
            </div>
            
            {/* Mode Switcher */}
            <div className="flex bg-[#0F0F11] border border-[#2C2C2E] rounded-md p-0.5">
               <button
                 onClick={() => setMyVideoMode('url')}
                 disabled={isAnalyzing}
                 className={`px-3 py-1 text-[11px] font-[600] rounded transition-colors flex items-center gap-1.5 ${myVideoMode === 'url' ? 'bg-[#2C2C2E] text-[#E5E5E7]' : 'text-[#8E8E93] hover:text-[#E5E5E7]'}`}
               >
                 <Link className="w-3 h-3" /> URL Gir
               </button>
               <button
                 onClick={() => setMyVideoMode('file')}
                 disabled={isAnalyzing}
                 className={`px-3 py-1 text-[11px] font-[600] rounded transition-colors flex items-center gap-1.5 ${myVideoMode === 'file' ? 'bg-[#2C2C2E] text-[#E5E5E7]' : 'text-[#8E8E93] hover:text-[#E5E5E7]'}`}
               >
                 <FileVideo className="w-3 h-3" /> Video Yükle
               </button>
            </div>
          </div>
          <div className="w-full aspect-video bg-black rounded-lg relative flex items-center justify-center border-none overflow-hidden">
            {myVideoMode === 'file' && myFile ? (
               <div className="flex flex-col items-center gap-2 w-full h-full justify-center bg-[#2C2C2E]/20 text-[#E5E5E7]">
                 <FileVideo className="w-8 h-8 text-[#FF3B30]" />
                 <span className="text-[12px] max-w-[80%] text-center truncate px-4">{myFile.name}</span>
                 <span className="text-[10px] text-[#8E8E93]">{(myFile.size / (1024 * 1024)).toFixed(2)} MB</span>
               </div>
            ) : (
               <Play className="w-8 h-8 text-[#E5E5E7] opacity-50" fill="currentColor" />
            )}
            <div className="font-mono text-[11px] bg-black/80 px-1.5 py-0.5 rounded absolute bottom-2 right-2 tracking-wider">
              YOU
            </div>
          </div>
          
          {myVideoMode === 'url' ? (
            <input
              type="url"
              placeholder="https://youtube.com/watch?v=..."
              value={myUrl}
              onChange={(e) => setMyUrl(e.target.value)}
              disabled={isAnalyzing}
              className="w-full px-3 py-2 bg-[#0F0F11] border border-[#2C2C2E] rounded-md focus:outline-none focus:border-[#FF3B30] transition-colors placeholder:text-[#8E8E93] text-[13px] text-[#E5E5E7] disabled:opacity-50"
            />
          ) : (
            <div className="relative w-full">
              <input
                type="file"
                accept="video/*"
                ref={fileInputRef}
                onChange={(e) => setMyFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnalyzing}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`w-full px-3 py-2 bg-[#0F0F11] border border-[#2C2C2E] border-dashed rounded-md transition-colors text-[13px] text-[#8E8E93] flex items-center justify-center gap-2 cursor-pointer hover:border-[#FF3B30] hover:text-[#E5E5E7] ${isAnalyzing ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
              >
                <FileVideo className="w-4 h-4" />
                {myFile ? 'Başka Bir Seç' : 'Yerel Cihazdan Seç (Max 20MB)'}
              </label>
            </div>
          )}
        </div>

        {/* Card: Notes Context with Video Genre Dropdown & Quick Tip Helpers */}
        <div className="md:col-span-8 bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-4 flex flex-col gap-3 shadow-sm">
          {/* Header with Title and Video Genre Dropdown Menu */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-[#2C2C2E]/60">
            <div className="text-[12px] uppercase tracking-[0.05em] text-[#8E8E93] flex items-center gap-2">
              <Film className="w-3.5 h-3.5 text-[#FF3B30]" />
              <span>Analiz Notları & Kurgu Türü</span>
            </div>

            {/* Dropdown Menu for Video Kurgu Türü */}
            <div className="flex items-center gap-2">
              <label htmlFor="video-genre-select" className="text-[11px] font-[500] text-[#8E8E93]">
                Video kurgu türü:
              </label>
              <div className="relative">
                <select
                  id="video-genre-select"
                  value={videoGenre}
                  onChange={(e) => setVideoGenre(e.target.value as VideoGenre)}
                  disabled={isAnalyzing}
                  className="bg-[#0F0F11] hover:bg-[#141416] text-[#E5E5E7] text-[12px] font-[600] border border-[#2C2C2E] hover:border-[#FF3B30]/60 rounded-md pl-2.5 pr-8 py-1.5 appearance-none focus:outline-none focus:border-[#FF3B30] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <option value="Vlog">🎥 Vlog</option>
                  <option value="Eğitim">🎓 Eğitim</option>
                  <option value="Oyun">🎮 Oyun</option>
                  <option value="Podcast">🎙️ Podcast</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#8E8E93] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Genre Focus Banner & Quick Insert Notes Helper */}
          <div className="bg-[#0F0F11]/60 border border-[#2C2C2E]/60 rounded-lg p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px] min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-[#FF3B30] shrink-0" />
                <span className="font-[600] text-[#E5E5E7] shrink-0">
                  {GENRE_CONFIG[videoGenre].label} Dinamiği:
                </span>
                <span className="text-[11px] text-[#8E8E93] truncate hidden sm:inline">
                  {GENRE_CONFIG[videoGenre].description}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-[#FF3B30]/15 text-[#FF3B30] px-2 py-0.5 rounded border border-[#FF3B30]/20 shrink-0">
                {GENRE_CONFIG[videoGenre].badge}
              </span>
            </div>

            {/* Quick-insert Chips to help user craft their edit notes */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#2C2C2E]/40">
              <span className="text-[10px] uppercase tracking-wider text-[#8E8E93] flex items-center gap-1 mr-1">
                <Plus className="w-3 h-3 text-[#FF3B30]" /> Hızlı Not Ekle:
              </span>
              {GENRE_CONFIG[videoGenre].quickTips.map((tip) => (
                <button
                  key={tip}
                  type="button"
                  onClick={() => handleAddQuickTip(tip)}
                  disabled={isAnalyzing}
                  className="px-2 py-0.5 rounded bg-[#1C1C1E] hover:bg-[#2C2C2E] text-[11px] text-[#8E8E93] hover:text-[#E5E5E7] border border-[#2C2C2E] hover:border-[#FF3B30]/40 transition-colors cursor-pointer disabled:opacity-50"
                  title={`Notlara "${tip}" ekle`}
                >
                  +{tip}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea for edit notes */}
          <textarea
            placeholder={GENRE_CONFIG[videoGenre].placeholder}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isAnalyzing}
            rows={4}
            className="w-full flex-1 px-3 py-2 bg-[#0F0F11] border border-[#2C2C2E] rounded-md focus:outline-none focus:border-[#FF3B30] transition-colors placeholder:text-[#8E8E93]/70 text-[13px] text-[#E5E5E7] resize-none disabled:opacity-50"
          />
        </div>

        {/* Card: Action */}
        <div className="md:col-span-4 bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm">
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#8E8E93] flex items-center gap-2">
            İşlem Durumu
          </div>

          <div className="flex-1 flex flex-col justify-center min-h-[60px]">
            {error && (
              <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] px-3 py-2 rounded-md text-[12px] leading-[1.4] flex items-start gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shrink-0 mt-1.5" />
                {error}
              </div>
            )}
            
            {/* Progress Display */}
            {isAnalyzing && (
              <div className="flex flex-col gap-2 w-full mt-2">
                <div className="text-[12px] font-[500] text-[#E5E5E7] animate-pulse">
                  {PROGRESS_STEPS[currentStepIndex]}
                </div>
                <div className="h-1.5 bg-[#2C2C2E] rounded-full overflow-hidden w-full">
                  <motion.div
                    className="h-full bg-[#FF3B30]"
                    initial={{ width: "0%" }}
                    animate={{ width: `${((currentStepIndex + 1) / PROGRESS_STEPS.length) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  />
                </div>
              </div>
            )}
            {!isAnalyzing && !error && (
              <div className="text-[13px] text-[#8E8E93] italic text-center">
                Analiz için hazır...
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full bg-[#FF3B30] hover:bg-red-600 disabled:bg-[#2C2C2E] disabled:text-[#8E8E93] text-white rounded-md py-[14px] font-[600] text-[13px] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-none"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analiz Ediliyor
              </>
            ) : (
              'Analizi Başlat'
            )}
          </button>
        </div>

        {/* Result & History Layout Row */}
        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          
          {/* History Sidebar/Section */}
          {history.length > 0 && (
            <div className={`${result && !isAnalyzing ? 'md:col-span-4' : 'md:col-span-12'} flex flex-col gap-4`}>
              <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-4 md:p-5 flex flex-col gap-3 shadow-sm h-full max-h-[600px] overflow-hidden">
                <div className="text-[12px] uppercase tracking-[0.05em] text-[#8E8E93] flex items-center gap-2 mb-2">
                  <HistoryIcon className="w-3.5 h-3.5" /> Geçmiş Analizler
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                  <AnimatePresence>
                    {history.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onClick={() => loadHistoryItem(item)}
                        className="bg-[#0F0F11] border border-[#2C2C2E] rounded-lg p-3 hover:border-[#FF3B30] transition-colors cursor-pointer group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[#8E8E93]">{item.date}</span>
                            {item.videoGenre && (
                              <span className="text-[9px] font-semibold bg-[#2C2C2E] text-[#E5E5E7] px-1.5 py-0.5 rounded">
                                {item.videoGenre}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => deleteHistoryItem(e, item.id)}
                            className="text-[#8E8E93] hover:text-[#FF3B30] opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-[11px] text-[#E5E5E7] truncate mb-1">
                          <span className="text-[#FF3B30] mr-1">R:</span>{item.referenceUrl}
                        </div>
                        <div className="text-[11px] text-[#8E8E93] truncate">
                          <span className="text-white mr-1">S:</span>{item.myUrl}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {/* Results Area */}
          <AnimatePresence>
            {result && !isAnalyzing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={`${history.length > 0 ? 'md:col-span-8' : 'md:col-span-12'} bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-5 md:p-6 shadow-sm overflow-hidden`}
              >
                <div className="text-[12px] uppercase tracking-[0.05em] text-[#8E8E93] mb-5 flex items-center justify-between">
                  AI Analiz & Öneriler
                  <span className="bg-[#30D158]/10 text-[#30D158] px-1.5 py-0.5 rounded text-[10px] font-bold">TAMAMLANDI</span>
                </div>

                {/* Radar Chart visualizing 'Akış Puanlaması' with Recharts */}
                <FlowRadarChart
                  markdown={result}
                  referenceName={referenceUrl ? 'Referans Video' : 'Kurgu Standardı'}
                  userName={myVideoMode === 'file' && myFile ? myFile.name : 'Senin Videon'}
                />

                {/* Social Media Shareable Analysis Score Card (Analiz Skor Kartı) */}
                <AnalysisScoreCard
                  markdown={result}
                  videoGenre={videoGenre}
                  videoTitle={myVideoMode === 'file' && myFile ? myFile.name : (myUrl || 'Senin Videon')}
                  referenceTitle={referenceUrl ? (referenceUrl.length > 30 ? referenceUrl.substring(0, 27) + '...' : referenceUrl) : 'Kurgu Standardı'}
                />

                {/* Horizontal Timeline Viewer visualizing CSV Markers */}
                <TimelineViewer
                  markdown={result}
                />

                <div className="flex flex-wrap gap-2 mb-6">
                  <button onClick={() => handleDownload('csv')} className="flex items-center gap-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#E5E5E7] px-3 py-1.5 rounded-md text-[12px] font-[600] transition-colors">
                    <Download className="w-3.5 h-3.5" /> CSV İndir
                  </button>
                  <button onClick={() => handleDownload('srt')} className="flex items-center gap-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#E5E5E7] px-3 py-1.5 rounded-md text-[12px] font-[600] transition-colors">
                    <Download className="w-3.5 h-3.5" /> SRT İndir
                  </button>
                  <button onClick={() => handleDownload('md')} className="flex items-center gap-2 bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/30 px-3 py-1.5 rounded-md text-[12px] font-[600] transition-colors ml-auto">
                    <FileDown className="w-3.5 h-3.5" /> Tüm Raporu İndir
                  </button>
                </div>

                {/* Custom Component Mapping for specific HTML class mimicking */}
                <div className="max-w-none pb-4">
                  <ReactMarkdown
                    components={{
                      h2: ({ node, ...props }) => (
                        <h2 className="text-[15px] font-[700] text-[#E5E5E7] mt-8 mb-4 border-l-2 border-[#FF3B30] pl-3 flex items-center gap-2" {...props} />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-[14px] font-[600] text-[#E5E5E7] mt-8 mb-4 border-l-2 border-[#FF3B30] pl-3 flex items-center gap-2" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="text-[13px] text-[#8E8E93] leading-[1.6] mb-4" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-none pl-0 space-y-2 mb-4" {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li className="text-[13px] text-[#E5E5E7] flex items-start gap-2 bg-[#0F0F11]/50 p-2 rounded-md border border-[#2C2C2E]/50">
                          <span className="text-[#FF3B30] leading-snug shrink-0">○</span>
                          <span className="mt-[1px] leading-[1.5] text-[#E5E5E7]">{props.children}</span>
                        </li>
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="list-decimal pl-5 space-y-2 text-[13px] text-[#8E8E93] mb-4" {...props} />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong className="text-[#E5E5E7] font-[600]" {...props} />
                      ),
                      hr: ({ node, ...props }) => (
                        <hr className="border-[#2C2C2E] my-6" {...props} />
                      ),
                      pre: ({ node, ...props }) => (
                        <div className="relative group mb-6">
                          <pre className="bg-[#0F0F11] border border-[#2C2C2E] p-4 rounded-lg overflow-x-auto text-[12px] font-mono text-[#E5E5E7] custom-scrollbar" {...props} />
                        </div>
                      ),
                      code: ({ node, className, ...props }: any) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="bg-[#0F0F11] border border-[#2C2C2E] px-1.5 py-0.5 rounded text-[12px] font-mono text-[#FF3B30]" {...props} />
                        ) : (
                          <code className="font-mono text-[12px]" {...props} />
                        );
                      },
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto mb-6">
                           <table className="w-full text-left text-[13px] border-collapse bg-[#0F0F11]/30 rounded-lg overflow-hidden border border-[#2C2C2E]" {...props} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => (
                        <thead className="bg-[#2C2C2E]/50 text-[#8E8E93]" {...props} />
                      ),
                      th: ({ node, ...props }) => (
                        <th className="px-4 py-3 border-b border-[#2C2C2E] font-[600]" {...props} />
                      ),
                      td: ({ node, ...props }) => (
                        <td className="px-4 py-3 border-b border-[#2C2C2E]/50 text-[#E5E5E7]" {...props} />
                      ),
                    }}
                  >
                    {result}
                  </ReactMarkdown>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2C2C2E;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3A3A3C;
        }
      `}} />
    </div>
  );
}
