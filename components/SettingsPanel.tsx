
import React from 'react';
import { Tone, Voice, AppSettings } from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (newSettings: Partial<AppSettings>) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  settings, 
  onSettingsChange, 
  isOpen, 
  onClose 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 animate-in fade-in duration-300">
      <div className="bg-[#0d1117] border border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="px-6 md:px-8 py-5 md:py-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div>
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-3">
              <i className="fas fa-sliders text-violet-500"></i> Hyper Core <span className="text-slate-500 font-normal">Sync</span>
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 transition-colors active:scale-90">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6 md:space-y-8">
          <section>
            <label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 block mb-3 md:mb-4">Personality Protocol</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(Tone).map((tone) => (
                <button
                  key={tone}
                  onClick={() => onSettingsChange({ tone })}
                  className={`py-2.5 md:py-3 px-3 rounded-xl text-xs md:text-sm font-bold transition-all border ${
                    settings.tone === tone 
                      ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/40' 
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 block mb-3">Vocal Synthesis</label>
              <div className="relative group">
                <select
                  value={settings.voice}
                  onChange={(e) => onSettingsChange({ voice: e.target.value as Voice })}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-violet-500 outline-none appearance-none cursor-pointer transition-all hover:bg-white/10"
                >
                  {Object.values(Voice).map((v) => (
                    <option key={v} value={v} className="bg-[#0d1117] text-white">{v} Engine</option>
                  ))}
                </select>
                <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none group-hover:text-violet-500 transition-colors"></i>
              </div>
            </div>
            <div>
              <label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 block mb-3">Language Delta</label>
              <div className="relative">
                <input
                  type="text"
                  value={settings.language}
                  onChange={(e) => onSettingsChange({ language: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-violet-500 outline-none transition-all hover:bg-white/10"
                  placeholder="Primary language..."
                />
              </div>
            </div>
          </section>

          {/* Dedicated Personal Developer Section */}
          <section className="pt-6 border-t border-white/5">
            <label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 block mb-4 text-center md:text-left">Project Governance</label>
            <div className="bg-gradient-to-br from-violet-600/5 to-indigo-500/5 border border-white/5 rounded-2xl p-4 md:p-5 flex items-center gap-4 group">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 p-[2px] shadow-lg group-hover:scale-105 transition-transform duration-500">
                <div className="w-full h-full rounded-2xl bg-[#0d1117] flex items-center justify-center">
                  <i className="fas fa-terminal text-violet-400"></i>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">Lead Developer</p>
                <p className="text-base md:text-lg font-black text-white tracking-tight">MD Hasibul Sheikh</p>
                <p className="text-[10px] text-violet-400 font-bold mt-1">Full-Stack Intelligence Architect</p>
              </div>
              <div className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">
                <i className="fas fa-award text-violet-500 text-xl"></i>
              </div>
            </div>
          </section>

          <div className="pt-2 flex items-center justify-center md:justify-end gap-3">
             <button 
              onClick={onClose}
              className="w-full md:w-auto px-8 md:px-12 py-3.5 md:py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl text-xs md:text-sm font-black transition-all shadow-xl shadow-violet-900/20 active:scale-95"
            >
              SAVE CONFIGURATION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
