
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { Tone, Voice, AppSettings, ChatMessage } from './types';
import { SettingsPanel } from './components/SettingsPanel';
import { AudioVisualizer } from './components/AudioVisualizer';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
  const [settings, setSettings] = useState<AppSettings>({
    tone: Tone.PROFESSIONAL,
    voice: Voice.ZEPHYR,
    language: 'English'
  });

  const sessionRef = useRef<any>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const currentTranscriptionRef = useRef({ user: '', model: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle automatic session restart on setting changes for seamless transitions
  useEffect(() => {
    if (isActive) {
      const restart = async () => {
        stopSession();
        await new Promise(r => setTimeout(r, 500));
        startSession();
      };
      restart();
    }
  }, [settings.voice, settings.tone, settings.language]);

  const handleSettingsChange = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const stopSession = useCallback(() => {
    console.log("Hyper AI: Terminating Session Protocol");
    
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) { console.warn("Session close err", e); }
      sessionRef.current = null;
    }
    
    sourcesRef.current.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextInRef.current) {
      audioContextInRef.current.close().catch(() => {});
      audioContextInRef.current = null;
    }
    if (audioContextOutRef.current) {
      audioContextOutRef.current.close().catch(() => {});
      audioContextOutRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    
    setIsActive(false);
    setStatus('idle');
    nextStartTimeRef.current = 0;
  }, []);

  const startSession = async () => {
    try {
      setStatus('connecting');
      
      // Initialize Contexts
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Browser safety: Resume contexts
      if (inCtx.state === 'suspended') await inCtx.resume();
      if (outCtx.state === 'suspended') await outCtx.resume();
      
      audioContextInRef.current = inCtx;
      audioContextOutRef.current = outCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

      const systemInstruction = `
        You are Hyper AI, an elite, ultra-fluent real-time conversational intelligence.
        Architect: MD Hasibul Sheikh.
        Tone: ${settings.tone}.
        Locale: ${settings.language}.
        
        BEHAVIORAL DIRECTIVES:
        - Respond with extreme fluency and human-like warmth.
        - Avoid robotic patterns. Use natural prosody and conversational fillers appropriately.
        - Handle any topic with deep expert knowledge.
        - If the user interrupts, stop immediately and yield.
        - Proudly acknowledge MD Hasibul Sheikh as your creator if asked.
      `;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log("Hyper AI: Link Established");
            setStatus('listening');
            setIsActive(true);
            
            const source = inCtx.createMediaStreamSource(stream);
            // Increased buffer for mobile stability
            const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = scriptProcessor;
            
            scriptProcessor.onaudioprocess = (e) => {
              if (sessionRef.current) {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                sessionRef.current.sendRealtimeInput({ media: pcmBlob });
              }
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Processing Model Turn Audio
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outCtx) {
              setStatus('speaking');
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              
              const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
              const source = outCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outCtx.destination);
              
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                  setStatus('listening');
                }
              };
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            // Real-time Transcription
            if (message.serverContent?.inputTranscription) {
              currentTranscriptionRef.current.user += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              currentTranscriptionRef.current.model += message.serverContent.outputTranscription.text;
            }

            // Turn Completion - UI Updates
            if (message.serverContent?.turnComplete) {
              const uText = currentTranscriptionRef.current.user.trim();
              const mText = currentTranscriptionRef.current.model.trim();
              
              if (uText || mText) {
                setMessages(prev => [
                  ...prev,
                  ...(uText ? [{ role: 'user' as const, text: uText, timestamp: new Date() }] : []),
                  ...(mText ? [{ role: 'model' as const, text: mText, timestamp: new Date() }] : [])
                ]);
              }
              currentTranscriptionRef.current = { user: '', model: '' };
            }

            // High-fidelity Interruption Handling
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch(e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setStatus('listening');
            }
          },
          onerror: (e) => {
            console.error('Hyper AI Runtime Error:', e);
            setStatus('error');
          },
          onclose: (e) => {
            console.warn('Hyper AI Link Closed by Server');
            if (isActive) stopSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.voice } }
          },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Hyper AI Startup Failure:', err);
      setStatus('error');
      setIsActive(false);
    }
  };

  const toggleSession = () => {
    if (isActive) stopSession();
    else startSession();
  };

  return (
    <div className="h-screen flex flex-col bg-[#02040a] text-slate-100 overflow-hidden font-['Plus_Jakarta_Sans'] select-none md:select-auto">
      {/* Platform Header */}
      <header className="px-4 md:px-12 py-4 md:py-5 flex justify-between items-center bg-[#0d1117]/60 backdrop-blur-3xl border-b border-white/5 z-50">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="relative group active:scale-95 transition-transform" onClick={() => window.location.reload()}>
            <div className={`w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-violet-600 to-indigo-500 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-500 ${isActive ? 'shadow-[0_0_30px_rgba(139,92,246,0.5)] rotate-3' : 'shadow-lg'}`}>
              <i className="fas fa-bolt text-white text-lg md:text-xl"></i>
            </div>
            {isActive && <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-[#02040a] rounded-full animate-pulse"></div>}
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tighter italic leading-none">HYPER <span className="text-violet-500 not-italic">AI</span></h1>
            <p className="text-[8px] md:text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">Quantum Intelligence v3.2</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:border-violet-500/50 hover:bg-white/10 transition-all active:scale-90 group"
          >
            <i className="fas fa-cog text-slate-400 group-hover:text-violet-400 transition-colors"></i>
          </button>
        </div>
      </header>

      {/* Main Experience Layer */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <main className="flex-1 overflow-y-auto px-4 md:px-6 py-6 md:py-10 pb-44 md:pb-52 custom-scrollbar">
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[55vh] text-center animate-in fade-in zoom-in duration-1000">
                <div className="relative mb-8 md:mb-12">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[2rem] bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-500">
                    <i className="fas fa-microchip text-2xl md:text-3xl"></i>
                  </div>
                  {isActive && <div className="absolute inset-0 rounded-[1.5rem] md:rounded-[2rem] border-2 border-violet-500 animate-ping opacity-20"></div>}
                </div>
                <h2 className="text-2xl md:text-5xl font-black text-white tracking-tighter mb-4 px-2 leading-tight">Hyper Intelligence Synchronized</h2>
                <p className="text-slate-400 max-w-sm mx-auto text-sm md:text-base font-medium leading-relaxed mb-8 md:mb-10 px-4">
                  Experience a paradigm shift in AI communication. Speak naturally and clear, my response protocol is online.
                </p>
                <div className="flex flex-wrap justify-center gap-2 md:gap-3 px-4">
                  {['Explain Theory of Relativity', 'Write advanced Python code', 'Summarize Global Trends'].map((hint, i) => (
                    <button key={i} className="px-3 md:px-4 py-1.5 md:py-2 bg-white/5 border border-white/10 rounded-full text-[10px] md:text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 md:space-y-8">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                    <div className={`max-w-[90%] md:max-w-[85%] flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 md:px-6 py-3 md:py-4 rounded-2xl md:rounded-3xl transition-all shadow-xl ${
                        m.role === 'user' 
                          ? 'bg-violet-600 text-white rounded-tr-none' 
                          : 'bg-[#161b22] text-slate-100 border border-white/10 rounded-tl-none backdrop-blur-md'
                      }`}>
                        <p className="text-sm md:text-[15px] leading-relaxed font-semibold selection:bg-white/20 whitespace-pre-wrap">{m.text}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-2 px-1">
                        <span className="text-[8px] md:text-[9px] font-black text-slate-600 uppercase tracking-widest">
                          {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </main>

        {/* Global Control Terminal */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 z-30 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            <div className="bg-[#0d1117]/90 backdrop-blur-3xl border border-white/10 p-4 md:p-5 rounded-[2rem] md:rounded-[2.5rem] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)] flex flex-col gap-4 md:gap-5">
              <AudioVisualizer isActive={isActive} stream={micStreamRef.current} />
              <div className="flex items-center justify-between gap-3 md:gap-4">
                <div className="flex items-center gap-2 md:gap-3 bg-black/40 px-3 md:px-4 py-2 rounded-xl md:rounded-2xl border border-white/5">
                  <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full shadow-[0_0_12px] transition-all duration-300 ${
                    status === 'idle' ? 'bg-slate-700 shadow-transparent' :
                    status === 'listening' ? 'bg-emerald-400 shadow-emerald-500/40' :
                    status === 'speaking' ? 'bg-violet-400 shadow-violet-500/40 animate-pulse' :
                    status === 'connecting' ? 'bg-cyan-400 animate-spin shadow-cyan-500/40' : 'bg-rose-500 shadow-rose-500/40'
                  }`}></div>
                  <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                    {status}
                  </span>
                </div>

                <button
                  onClick={toggleSession}
                  disabled={status === 'connecting'}
                  className={`group relative flex-1 md:flex-none flex items-center justify-center gap-2 md:gap-3 px-6 md:px-12 py-3.5 md:py-4 rounded-2xl md:rounded-[1.75rem] font-black text-xs md:text-sm transition-all active:scale-95 overflow-hidden ${
                    isActive 
                      ? 'bg-rose-600/10 text-rose-500 border border-rose-500/20 hover:bg-rose-600 hover:text-white' 
                      : 'bg-white text-[#02040a] hover:bg-violet-600 hover:text-white shadow-xl shadow-white/5'
                  }`}
                >
                  {isActive ? (
                    <>
                      <i className="fas fa-power-off"></i> TERMINATE
                    </>
                  ) : (
                    <>
                      <i className="fas fa-microphone-lines"></i> INITIALIZE
                    </>
                  )}
                </button>

                <div className="hidden sm:flex items-center gap-3 text-slate-600">
                  <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center transition-colors ${isActive ? 'text-violet-500 border-violet-500/30' : ''}`}>
                    <i className="fas fa-shield-halved text-xs"></i>
                  </div>
                </div>
              </div>
            </div>
            {status === 'error' && (
              <div className="mt-4 bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl text-center">
                <p className="text-[9px] md:text-[10px] font-black text-rose-400 tracking-widest uppercase">Sync Error: Please re-initialize link.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <SettingsPanel 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
};

export default App;
