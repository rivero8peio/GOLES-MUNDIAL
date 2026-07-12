import React, { useEffect, useState, useMemo } from 'react';
import Papa from 'papaparse';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, AlertCircle, FilterX, Play, Instagram, Linkedin } from 'lucide-react';

// URL for Goles
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1XiHU-Rk22Nib4biaaiKlo6RzV0guMKvnq4qVQVU02wA/gviz/tq?tqx=out:csv';

interface GoalData {
  [key: string]: string;
}

export default function App() {
  const [screen, setScreen] = useState<'home' | 'analysis'>('home');
  const [data, setData] = useState<GoalData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState<string>('TODOS');
  
  // Interactive cross-filtering state: { [columnName]: value }
  const [activeFilters, setActiveFilters] = useState<{ [key: string]: string }>({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(SHEET_URL);
      if (!response.ok) throw new Error('No se pudo conectar con la hoja de cálculo de Goles');
      const csv = await response.text();
      
      Papa.parse(csv, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setData(results.data as GoalData[]);
            setColumns(Object.keys(results.data[0] as GoalData));
          }
          setLoading(false);
        },
        error: (err: any) => {
          setError('Error al procesar los datos: ' + err.message);
          setLoading(false);
        }
      });
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Options for the filter (Column A: EQUIPO)
  const filterOptions = useMemo(() => {
    const options = new Set<string>();
    data.forEach(row => {
      const val = row['EQUIPO'];
      if (val) options.add(val);
    });
    return ['TODOS', ...Array.from(options).sort()];
  }, [data]);

  // Overall filtered data matching ALL active filters & global EQUIPO filter
  const overallFilteredData = useMemo(() => {
    let filtered = data;
    if (filterValue !== 'TODOS') {
      filtered = filtered.filter(row => row['EQUIPO'] === filterValue);
    }
    Object.entries(activeFilters).forEach(([key, val]) => {
      if (val) {
        filtered = filtered.filter(row => {
          const rowVal = String(row[key] || '').trim() || 'N/A';
          return rowVal === val;
        });
      }
    });
    return filtered;
  }, [data, filterValue, activeFilters]);

  // Team Color Mapping
  const teamColors: { [key: string]: string } = {
    'MEXIKO': '#15803D',      // Mexico Green
    'REP.CHECA': '#E11D48',    // Czech Republic Red/Crimson
    'KOREA': '#0F172A',        // South Korea Dark Slate / Navy
    'BOSNIA': '#1D4ED8',      // Bosnia Blue
    'CANADA': '#EF4444',      // Canada Red
    'USA': '#1E3A8A',          // USA Navy Blue
    'PARAGUAY': '#DC2626',     // Paraguay Red
    'SUIZA': '#EF4444',        // Switzerland Red
    'QATAR': '#881337',        // Qatar Maroon
    'ESPAÑA': '#EAB308',       // Spain Yellow
    'ARGENTINA': '#38BDF8',    // Argentina Sky Blue
    'BRASIL': '#22C55E',       // Brazil Green
    'FRANCIA': '#1E40AF',      // France Royal Blue
    'ALEMANIA': '#475569',     // Germany Slate Gray
    'N/A': '#94A3B8'
  };

  const getTeamColor = (team: string) => {
    if (team === 'TODOS') return '#E5C158'; // World Cup Gold
    const upper = team.trim().toUpperCase();
    if (teamColors[upper]) return teamColors[upper];
    
    // Deterministic color generation based on team name
    let hash = 0;
    for (let i = 0; i < upper.length; i++) {
      hash = upper.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    const s = 70 + (Math.abs(hash) % 20); // 70-90% saturation
    const l = 40 + (Math.abs(hash) % 15); // 40-55% lightness
    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  // Click handler for cross-filtering
  const handleBarClick = (columnName: string, value: string) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      if (next[columnName] === value) {
        delete next[columnName];
      } else {
        next[columnName] = value;
      }
      return next;
    });
  };

  // Remove a single active filter
  const handleRemoveFilter = (columnName: string) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      delete next[columnName];
      return next;
    });
  };

  // Aggregation function for charts
  const getChartData = (columnName: string) => {
    if (!data || data.length === 0) return [];
    
    // Filter data by EQUIPO and ALL activeFilters EXCEPT the current column
    let localFiltered = data;
    if (filterValue !== 'TODOS') {
      localFiltered = localFiltered.filter(row => row['EQUIPO'] === filterValue);
    }
    Object.entries(activeFilters).forEach(([key, val]) => {
      if (key !== columnName && val) {
        localFiltered = localFiltered.filter(row => {
          const rowVal = String(row[key] || '').trim() || 'N/A';
          return rowVal === val;
        });
      }
    });

    // Unique teams
    const teams = Array.from(new Set(data.map(r => String(r['EQUIPO'] || 'N/A')))).sort();

    const dataMap: { [key: string]: any } = {};

    localFiltered.forEach(row => {
      const val = String(row[columnName] || '').trim() || 'N/A';
      const team = String(row['EQUIPO'] || 'N/A');
      
      if (!dataMap[val]) {
        dataMap[val] = { name: val, total: 0 };
        teams.forEach((t: string) => {
          dataMap[val][t] = 0;
        });
      }
      
      dataMap[val][team] = (dataMap[val][team] || 0) + 1;
      dataMap[val].total += 1;
    });

    const entries = Object.values(dataMap).filter((entry: any) => entry.name !== 'N/A');

    // Sorting logic: low to high numbers, A-Z for text
    entries.sort((a: any, b: any) => {
      const isNumA = !isNaN(Number(a.name)) && a.name !== '';
      const isNumB = !isNaN(Number(b.name)) && b.name !== '';

      if (isNumA && isNumB) return Number(a.name) - Number(b.name);
      if (isNumA) return -1;
      if (isNumB) return 1;
      return String(a.name).localeCompare(String(b.name));
    });

    return entries;
  };

  // Rest of columns excluding EQUIPO and TEMPORADA
  const chartColumns = columns.filter(col => {
    const c = col.trim().toUpperCase();
    return c !== 'EQUIPO' && c !== 'TEMPORADA';
  });
  const allTeams = Array.from(new Set(data.map(r => String(r['EQUIPO'] || 'N/A')))).sort();
  const hasAnyActiveFilters = Object.keys(activeFilters).length > 0;

  // Render Golden Home Screen
  if (screen === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F5D061] via-[#E5C158] to-[#B08A1E] flex flex-col items-center justify-center p-6 text-slate-950 font-sans selection:bg-slate-950 selection:text-white">
        <div className="max-w-2xl w-full text-center flex flex-col items-center justify-center">
          {/* Logo Animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8 relative"
          >
            <div className="absolute inset-0 bg-white/10 blur-3xl rounded-full scale-110 -z-10" />
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/2026_FIFA_World_Cup_emblem.svg/1920px-2026_FIFA_World_Cup_emblem.svg.png" 
              alt="FIFA World Cup 2026" 
              className="h-48 md:h-64 w-auto object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.35)]"
              referrerPolicy="no-referrer"
            />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-black leading-none uppercase mb-8">
              ANÁLISIS GOLES <br />
              <span className="text-amber-950">MUNDIAL 2026</span>
            </h1>
          </motion.div>

          {/* Enter Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <button
              onClick={() => setScreen('analysis')}
              className="group relative inline-flex items-center gap-3 px-10 py-5 bg-slate-950 text-white rounded-full font-black text-xs md:text-sm tracking-widest uppercase hover:bg-black transition-all shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95"
            >
              <span>ENTRAR AL ANÁLISIS</span>
              <Play size={16} className="fill-current text-[#E5C158] group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>

          {/* Social Links Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="mt-6 flex flex-row justify-center gap-12 border-t border-black/10 pt-5 w-full max-w-sm"
          >
            {/* Instagram */}
            <div className="flex flex-col items-center">
              <div className="p-3 bg-black/5 rounded-full mb-1">
                <Instagram size={22} className="text-black" />
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-950 tracking-tight">@peiorivero</span>
            </div>

            {/* X (formerly Twitter) */}
            <div className="flex flex-col items-center">
              <div className="p-3 bg-black/5 rounded-full mb-1 flex items-center justify-center">
                <img
                  src="https://images.seeklogo.com/logo-png/49/2/twitter-x-logo-png_seeklogo-492397.png"
                  alt="X Logo"
                  className="w-[22px] h-[22px] object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-950 tracking-tight">@peio_rivero</span>
            </div>

            {/* LinkedIn */}
            <a 
              href="https://www.linkedin.com/in/peio-rivero-358177397"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center group cursor-pointer"
            >
              <div className="p-3 bg-black/5 group-hover:bg-black/15 group-hover:scale-105 rounded-full mb-1 transition-all">
                <Linkedin size={22} className="text-black group-hover:text-blue-900 transition-colors" />
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-950 tracking-tight group-hover:underline">LinkedIn</span>
            </a>
          </motion.div>
        </div>


      </div>
    );
  }

  // Render Loader
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 font-sans">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="mb-4"
        >
          <RefreshCw size={48} className="text-[#D4AF37]" />
        </motion.div>
        <p className="text-slate-400 font-bold font-mono text-xs uppercase tracking-widest animate-pulse">Sincronizando Mundial...</p>
      </div>
    );
  }

  // Render Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 text-center">
        <AlertCircle size={64} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-black tracking-tighter text-slate-100 mb-2 uppercase">Fallo de Comunicación</h2>
        <p className="text-slate-400 mb-6 max-w-md font-medium italic">{error}</p>
        <div className="flex gap-4">
          <button
            onClick={() => setScreen('home')}
            className="px-6 py-3 bg-slate-800 text-white rounded-sm font-black text-xs tracking-widest uppercase hover:bg-slate-700 transition-colors shadow-sm"
          >
            Volver a la Home
          </button>
          <button
            onClick={fetchData}
            className="px-8 py-3 bg-[#D4AF37] text-black rounded-sm font-black text-xs tracking-widest uppercase hover:bg-amber-500 transition-colors shadow-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col font-sans text-slate-100 selection:bg-[#D4AF37] selection:text-black">
      
      {/* Sticky Top Header & Filter Bar Container (Fixed Header Requirement) */}
      <div className="sticky top-0 z-50 w-full flex flex-col shadow-2xl">
        {/* Header Section */}
        <header className="bg-gradient-to-r from-[#C59B27] via-[#E5C158] to-[#A37B14] border-b border-amber-600/30 px-8 py-4">
          <div className="max-w-[1850px] mx-auto flex flex-col md:grid md:grid-cols-3 items-center gap-4">
            <div className="hidden md:flex justify-start items-center gap-3">
              <button 
                onClick={() => setScreen('home')}
                className="hover:scale-105 transition-transform"
                title="Volver al Inicio"
              >
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/2026_FIFA_World_Cup_emblem.svg/1920px-2026_FIFA_World_Cup_emblem.svg.png" 
                  alt="FIFA World Cup 2026" 
                  className="h-14 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </button>
              <div className="h-10 w-[1px] bg-amber-950/20 mr-1"></div>
              
              {/* Header Social Icons */}
              <div className="flex items-center gap-4 text-slate-950">
                {/* Instagram */}
                <div className="flex flex-col items-center gap-0.5" title="@peiorivero">
                  <Instagram size={18} className="stroke-[1.75]" />
                  <span className="text-[8px] font-mono font-bold tracking-tight">@peiorivero</span>
                </div>

                {/* X */}
                <div className="flex flex-col items-center gap-0.5" title="@peio_rivero">
                  <img
                    src="https://images.seeklogo.com/logo-png/49/2/twitter-x-logo-png_seeklogo-492397.png"
                    alt="X Logo"
                    className="w-[18px] h-[18px] object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-[8px] font-mono font-bold tracking-tight">@peio_rivero</span>
                </div>

                {/* LinkedIn */}
                <a 
                  href="https://www.linkedin.com/in/peio-rivero-358177397"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-0.5 hover:opacity-80 transition-all group"
                  title="LinkedIn"
                >
                  <Linkedin size={18} className="group-hover:text-blue-900 transition-colors stroke-[1.75]" />
                  <span className="text-[8px] font-mono font-bold tracking-tight group-hover:underline">LinkedIn</span>
                </a>
              </div>
            </div>
            
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-950 leading-none">
                GOLES <span className="text-amber-950">MUNDIAL 2026</span>
              </h1>
            </div>

            <div className="flex justify-end items-center gap-3">
              <button
                onClick={() => setScreen('home')}
                className="px-4 py-2 bg-slate-950/25 border border-slate-950/20 text-slate-950 text-[10px] font-black tracking-widest uppercase rounded-sm hover:bg-slate-950 hover:text-white transition-colors h-fit"
                title="Volver al Inicio"
              >
                VOLVER AL INICIO
              </button>
              <button
                onClick={() => {
                  fetchData();
                  setActiveFilters({});
                }}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-950 text-[#D4AF37] text-[10px] font-black tracking-widest uppercase rounded-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50 group h-fit"
              >
                <RefreshCw size={12} className={`${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                <span>ACTUALIZAR</span>
              </button>
            </div>
          </div>
        </header>

        {/* Controls Bar */}
        <nav className="bg-slate-900 px-8 py-3.5 border-b border-slate-800">
          <div className="max-w-[1850px] mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Filtros Activos & Estadísticas</span>
            </div>

            {/* Stats Summary */}
            <div className="text-xs font-mono font-bold text-slate-400 bg-slate-950 px-4 py-2 border border-slate-800 rounded">
              GOLES: <span className="text-[#D4AF37]">{overallFilteredData.length}</span> <span className="text-slate-600">/</span> {data.length}
            </div>
          </div>
        </nav>
      </div>

      {/* Active Cross-Filters Panel */}
      <AnimatePresence>
        {hasAnyActiveFilters && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-[1850px] w-full mx-auto px-4 md:px-8 pt-6"
          >
            <div className="bg-slate-900 border border-[#D4AF37]/20 rounded-lg p-4 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
                Filtros Interactivos Activos:
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(activeFilters).map(([col, val]) => (
                  <div 
                    key={col} 
                    className="flex items-center gap-2 bg-slate-950 text-slate-200 border border-slate-800 px-3 py-1.5 rounded text-xs font-mono font-bold"
                  >
                    <span className="text-[#D4AF37] uppercase text-[10px] tracking-wider">{col}:</span> 
                    <span className="text-white">{val}</span>
                    <button 
                      onClick={() => handleRemoveFilter(col)}
                      className="text-slate-400 hover:text-red-400 font-bold ml-1 transition-colors text-sm px-1"
                      title="Eliminar este filtro"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setActiveFilters({})}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 ml-auto transition-colors px-2 py-1 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded"
              >
                <FilterX size={12} />
                <span>Limpiar Todo</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 min-h-[600px]">
        <div className="max-w-[1850px] mx-auto flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Sidebar Left - Team Filter */}
          <div className="w-full lg:w-[280px] shrink-0 lg:sticky lg:top-[160px] lg:h-[calc(100vh-200px)] bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col">
            <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 pr-1 custom-gold-scrollbar">
              {filterOptions.map(opt => {
                const teamColor = getTeamColor(opt);
                const isActive = filterValue === opt;
                const isTodos = opt === 'TODOS';
                
                return (
                  <button
                    key={opt}
                    onClick={() => setFilterValue(opt)}
                    style={{
                      backgroundColor: isActive ? teamColor : '#ffffff',
                      color: isActive ? '#ffffff' : teamColor,
                      borderColor: teamColor,
                    }}
                    className={`relative px-2 py-3 text-[10px] font-black tracking-wider uppercase rounded overflow-hidden transition-all shadow-sm text-center flex flex-col items-center justify-center min-h-[44px] ${
                      isActive ? 'hover:opacity-90' : 'hover:bg-slate-50'
                    } border ${
                      isTodos ? 'col-span-2' : ''
                    } ${
                      isActive ? 'shadow-md scale-[1.03]' : ''
                    }`}
                  >
                    <span className="truncate max-w-full block" title={opt}>
                      {opt}
                    </span>
                    {!isActive && (
                      <div 
                        className="absolute bottom-0 left-0 w-full h-[3.5px]" 
                        style={{ backgroundColor: teamColor }} 
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Stats inside sidebar as extra helper */}
            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Goles filtrados:</span>
              <span className="text-[#D4AF37] font-bold">{overallFilteredData.length}</span>
            </div>
          </div>

          {/* Graphics Right */}
          <div className="flex-1 w-full lg:w-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
            >
              {chartColumns.map((col) => {
                const chartData = getChartData(col);
                const isColumnFiltered = !!activeFilters[col];
                
                return (
                  <div 
                    key={col}
                    className={`bg-white text-slate-900 p-5 border rounded-xl shadow-sm flex flex-col hover:border-[#D4AF37] transition-all group ${
                      isColumnFiltered ? 'border-[#D4AF37] shadow-lg ring-1 ring-[#D4AF37]/20 bg-amber-50/5' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[11px] font-black text-slate-800 flex items-center gap-2 italic uppercase tracking-wider">
                        <span className={`w-1.5 h-1.5 rounded-full transition-transform ${isColumnFiltered ? 'bg-[#D4AF37] scale-125' : 'bg-slate-400 group-hover:scale-125'}`}></span> 
                        {col}
                      </h3>
                      {isColumnFiltered && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] bg-amber-100 text-[#A37B14] px-2 py-0.5 rounded font-mono font-bold tracking-tight">
                            FILTRADO: {activeFilters[col]}
                          </span>
                          <button 
                            onClick={() => handleRemoveFilter(col)}
                            className="text-slate-400 hover:text-red-600 font-bold transition-colors text-xs"
                            title="Quitar filtro"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="h-[390px] w-full bg-slate-50/30 rounded overflow-hidden relative">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{ top: 20, right: 10, left: -25, bottom: 40 }}
                          >
                            <CartesianGrid strokeDasharray="0" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                            <XAxis 
                              dataKey="name" 
                              axisLine={{ stroke: '#E2E8F0' }}
                              tickLine={false}
                              tick={{ fontSize: 10, fill: '#64748B', fontWeight: 700, fontFamily: 'monospace' }}
                              angle={-45}
                              textAnchor="end"
                              interval={0}
                            />
                            <YAxis 
                              allowDecimals={false}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 700, fontFamily: 'monospace' }}
                            />
                            <Tooltip 
                              cursor={{ fill: '#F1F5F9' }}
                              contentStyle={{ 
                                borderRadius: '0', 
                                border: '1px solid #1E293B',
                                backgroundColor: '#1E293B',
                                color: '#fff',
                                boxShadow: 'none',
                                fontSize: '10px',
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                padding: '8px'
                              }}
                            />
                            {filterValue === 'TODOS' ? (
                              allTeams.map((team: string) => (
                                <Bar 
                                  key={team}
                                  dataKey={team}
                                  stackId="a"
                                  fill={getTeamColor(team)}
                                  minPointSize={0}
                                >
                                  {chartData.map((entry, index) => {
                                    const isFiltered = activeFilters[col] === entry.name;
                                    const hasFilter = !!activeFilters[col];
                                    return (
                                      <Cell 
                                        key={`cell-${index}`}
                                        opacity={hasFilter && !isFiltered ? 0.25 : 1}
                                        stroke={isFiltered ? '#000000' : 'none'}
                                        strokeWidth={isFiltered ? 2 : 0}
                                        cursor="pointer"
                                        onClick={() => handleBarClick(col, entry.name)}
                                      />
                                    );
                                  })}
                                </Bar>
                              ))
                            ) : (
                              <Bar 
                                dataKey="total"
                                fill={getTeamColor(filterValue)}
                                minPointSize={10}
                                label={{ position: 'top', fontSize: 10, fill: getTeamColor(filterValue), fontWeight: 'bold' }}
                              >
                                {chartData.map((entry, index) => {
                                  const isFiltered = activeFilters[col] === entry.name;
                                  const hasFilter = !!activeFilters[col];
                                  const fill = getTeamColor(filterValue);
                                  return (
                                    <Cell 
                                      key={`cell-${index}`}
                                      fill={fill}
                                      opacity={hasFilter && !isFiltered ? 0.25 : 1}
                                      stroke={isFiltered ? '#000000' : 'none'}
                                      strokeWidth={isFiltered ? 2.5 : 0}
                                      cursor="pointer"
                                      onClick={() => handleBarClick(col, entry.name)}
                                    />
                                  );
                                })}
                              </Bar>
                            )}
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded p-4">
                           <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest text-center">Sin datos para graficar</span>
                           <span className="text-[9px] text-slate-400 mt-1 text-center">Otros filtros redujeron estos registros a 0</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </motion.div>

          {overallFilteredData.length === 0 && (
            <div className="py-20 text-center bg-white text-slate-900 border border-slate-200 border-dashed rounded-lg mt-6">
              <p className="text-slate-400 font-black uppercase text-xs tracking-widest italic">Sin registros para esta categoría con los filtros actuales</p>
              <button
                onClick={() => {
                  setFilterValue('TODOS');
                  setActiveFilters({});
                }}
                className="mt-4 px-6 py-2 bg-[#D4AF37] text-black text-[10px] font-black tracking-widest uppercase rounded shadow hover:bg-amber-500 transition-all"
              >
                Limpiar Todos los Filtros
              </button>
            </div>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}
