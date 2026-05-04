import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, Sparkles, Cpu, Activity, Terminal, ShieldCheck, ChevronRight, Menu, X, Zap, Mic } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { sendMessageStream, generateVoice } from './services/geminiService';
import { AudioStreamer } from './lib/AudioStreamer';

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { id: 'diag', label: 'Diagnostics', icon: <Cpu size={16} />, prompt: 'Perform system diagnostics. Provide terminal commands to check CPU load and memory status.' },
  { id: 'intel', label: 'Real-Time Intel', icon: <Activity size={16} />, prompt: 'Accessing real-time intelligence. What are the current global tech headlines and market trends?' },
  { id: 'deploy', label: 'Logic Warp', icon: <Zap size={16} />, prompt: 'Execute Logic Warp. Help me optimize a complex distributed system architecture.' },
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: "Namaste, mera naam Nora hai. Aap sun rahe hain 3 lakh se bhi adhik logon ki pasandeeda aawaaz. N.O.R.A. V8.0 Advanced Neural protocols online hain, Sir. Batayiye aaj main aapka laptop kaise control karun? [CMD: WAKE]",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [thinkingStatus, setThinkingStatus] = useState('PROCESSING');
  const [thinkingLogs, setThinkingLogs] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeechMode, setIsSpeechMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  useEffect(() => {
    // Force TTS voices to load
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.getVoices();
    }

    // Initialize AudioStreamer
    audioStreamerRef.current = new AudioStreamer((base64) => {
      // This is for recording, we'll handle it if needed
      console.log("Audio data received from mic:", base64.length);
    });

    return () => {
      audioStreamerRef.current?.stop();
      audioStreamerRef.current?.stopPlayback();
    };
  }, []);

  useEffect(() => {
    // Initialize Web Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'hi-IN'; // Optimized for Hindi/Hinglish accents

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          handleSend(transcript);
        }
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleSpeechMode = () => {
    if (!isSpeechMode) {
      setIsSpeechMode(true);
      setVoiceEnabled(true);
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      setIsSpeechMode(false);
      if (recognitionRef.current) recognitionRef.current.stop();
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening && !isSpeaking) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Recognition start failed:", e);
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'model') {
      const timer = setTimeout(() => {
        speak(messages[0].content);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const speak = async (text: string) => {
    if (!voiceEnabled) return;

    // Stop browser synthesis if playing
    window.speechSynthesis.cancel();
    // Stop custom audio if playing
    audioStreamerRef.current?.stopPlayback();

    let cleanText = text.replace(/[*#`_~]/g, '').replace(/\[CMD: .+?\]/g, '');
    setIsSpeaking(true);

    try {
      // Try High-Quality Gemini TTS First
      const base64Audio = await generateVoice(cleanText);
      
      if (base64Audio && audioStreamerRef.current) {
        await audioStreamerRef.current.playPCM(base64Audio);
        // We need to estimate duration because playPCM doesn't have a callback in this simple impl
        // or we could add a delay. For now, we'll use a timeout based on words or just stay "speaking"
        const estimatedDuration = Math.max(2000, cleanText.split(' ').length * 400);
        setTimeout(() => {
          setIsSpeaking(false);
          if (isSpeechMode) setTimeout(startListening, 500);
        }, estimatedDuration);
        return;
      }
    } catch (e) {
      console.error("Gemini TTS high-quality failed, falling back to Web Speech:", e);
    }

    // Fallback to Web Speech API
    if (!window.speechSynthesis) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0; 
    
    const voices = window.speechSynthesis.getVoices();
    // Prioritize high-quality online Hindi voices, then fallback to localized voices
    const preferredVoice = 
      voices.find(v => v.name.includes('Microsoft Swara Online') || v.name.includes('Microsoft Neerja Online')) ||
      voices.find(v => v.name.includes('Google हिन्दी') || v.name.includes('Google Hindi')) ||
      voices.find(v => v.lang.startsWith('hi') && (v.name.includes('Online') || v.name.includes('Natural'))) ||
      voices.find(v => v.lang.startsWith('hi') && v.name.includes('Female')) ||
      voices.find(v => v.lang.startsWith('hi')) ||
      voices.find(v => v.name.includes('Google UK English Female') || v.name.includes('Female') || v.name.includes('Natural'));
      
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      utterance.lang = 'hi-IN'; // Force Hindi pronunciation pattern
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (isSpeechMode) setTimeout(startListening, 500);
    };
    utterance.onerror = () => setIsSpeaking(false);
    
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const addThinkingLog = (log: string) => {
    setThinkingLogs(prev => [...prev.slice(-3), log]);
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setThinkingTime(0);
    setThinkingLogs([]);
    
    // Set estimated time based on content
    const lowerText = text.toLowerCase();
    let est = 2.5; // Default for text
    let status = 'NEURAL_SCANNING';
    let initialLogs = ['Initializing bridge...', 'Scanning user intent...'];

    if (lowerText.includes('video')) {
      est = 18.4;
      status = 'VIDEO_SYNTHESIS_ACTIVE';
      initialLogs = ['Loading frame buffers...', 'Interpolating temporal vectors...', 'Encoding H.265 sequence...'];
    } else if (lowerText.includes('song') || lowerText.includes('music') || lowerText.includes('audio')) {
      est = 14.2;
      status = 'AUDIO_PRODUCING_CORE';
      initialLogs = ['Analyzing spectral density...', 'Generating wavetable harmonics...', 'Mastering audio path...'];
    } else if (lowerText.includes('image') || lowerText.includes('picture') || lowerText.includes('thumbnail') || lowerText.includes('art')) {
      est = 7.8;
      status = 'IMAGE_RENDER_PROTOCOL';
      initialLogs = ['Allocating VRAM...', 'Raycasting environment...', 'Post-processing filters...'];
    } else if (lowerText.includes('look at my screen') || lowerText.includes('read my screen') || lowerText.includes('analyze screen')) {
      est = 6.4;
      status = 'VISION_SCAN_ACTIVE';
      initialLogs = ['Capturing frame buffer...', 'Segmenting visual entities...', 'Neural OCR indexing...'];
    } else if (lowerText.includes('wikipedia') || lowerText.includes('search') || lowerText.includes('wiki')) {
      est = 4.8;
      status = 'KNOWLEDGE_FETCH_LINK';
      initialLogs = ['Querying global archives...', 'Indexing academic results...', 'Ranking relevant nodes...'];
    } else if (lowerText.includes('open') || lowerText.includes('close') || lowerText.includes('type') || lowerText.includes('system') || lowerText.includes('laptop')) {
      est = 3.2;
      status = 'OS_BRIDGE_LINK';
      initialLogs = ['Connecting to Python Bridge...', 'WaitMs: 120ms...', 'Simulating Input: WIN_KEY_SEARCH...'];
    } else if (lowerText.includes('who') || lowerText.includes('research') || lowerText.includes('reacher') || lowerText.includes('about') || lowerText.includes('physicist') || lowerText.includes('scientist')) {
      est = 5.5;
      status = 'KNOWLEDGE_RETRIEVAL';
      initialLogs = ['Accessing global archives...', 'Indexing verified sources...', 'Synthesizing factual data...'];
    }

    setEstimatedTime(est);
    setThinkingStatus(status);
    setThinkingLogs(initialLogs);

    // Cancel any current speech
    window.speechSynthesis.cancel();
    audioStreamerRef.current?.stopPlayback();

    // Start thinking timer
    const timerStart = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - timerStart) / 1000;
      setThinkingTime(elapsed);
      
      // Dynamic logging relative to estimate
      if (elapsed > est * 0.25 && elapsed < est * 0.25 + 0.1) addThinkingLog('Optimizing response path...');
      if (elapsed > est * 0.5 && elapsed < est * 0.5 + 0.1) addThinkingLog('Finalizing neural patterns...');
      if (elapsed > est * 0.75 && elapsed < est * 0.75 + 0.1) addThinkingLog('Encrypting output stream...');
    }, 100);

    try {
      let currentResponse = '';
      const chatHistory = messages.concat(userMsg).map(m => ({ 
        role: m.role, 
        content: m.content 
      }));

      setMessages(prev => [...prev, { role: 'model', content: '', timestamp: new Date() }]);

      await sendMessageStream(chatHistory, (chunk) => {
        currentResponse += chunk;
        
        let displayContent = currentResponse;
        try {
          // Attempt to extract the 'reply' part from the stream if it looks like JSON
          if (currentResponse.startsWith('{')) {
            const replyMatch = currentResponse.match(/"reply":\s*"((?:[^"\\]|\\.)*)"/);
            if (replyMatch && replyMatch[1]) {
              // Unescape JSON string
              displayContent = replyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            } else {
              displayContent = 'Processing response...';
            }
          }
        } catch (e) {
          // Fallback to raw if logic fails
        }

        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'model') {
            return [...prev.slice(0, -1), { ...last, content: displayContent }];
          }
          return prev;
        });
      });

      let finalReply = currentResponse;
      try {
        const parsed = JSON.parse(currentResponse);
        finalReply = parsed.reply;
        
        // Handle Actions
        if (parsed.action && parsed.action.command !== 'none') {
          const { command, target, text } = parsed.action;
          const cmdStr = `${command.toUpperCase()}${target ? ': ' + target : ''}${text ? ' [' + text + ']' : ''}`;
          setLastCommand(cmdStr);
          setTimeout(() => setLastCommand(null), 5000);
        }
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
      }

      // Final update with clean text
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'model') {
          return [...prev.slice(0, -1), { ...last, content: finalReply }];
        }
        return prev;
      });

      // Speak the completed message
      speak(finalReply);
    } catch (error) {
      console.error(error);
      const errorMsg = "Network disruption detected. Unable to establish connection to neural core.";
      setMessages(prev => [...prev.slice(0, -1), { role: 'model', content: errorMsg, timestamp: new Date() }]);
      speak(errorMsg);
    } finally {
      setIsTyping(false);
      clearInterval(interval);
    }
  };

  return (
    <div className="flex h-screen bg-[#020205] overflow-hidden text-cyber-text selection:bg-cyber-accent/20 italic-none relative">
      {/* Immersive Background Layers */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(0,242,255,0.08)_0%,transparent_40%),radial-gradient(circle_at_80%_80%,rgba(0,100,255,0.08)_0%,transparent_40%)] z-0" />
      <div className="grid-bg absolute inset-0 pointer-events-none opacity-20 shrink-0 z-0" />
      
      {/* Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden select-none">
        <h1 className="text-[12vw] font-black text-white/10 tracking-[0.25em] whitespace-nowrap blur-[0.5px]">
          SKM DEV
        </h1>
      </div>

      {/* Placeholder for Cinematic Background Image (Enable when generated) */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40 bg-cover bg-center mix-blend-screen z-0 filter contrast-125 brightness-75 scale-105"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=2072')`, opacity: 0.15 }}
      />

      <div className="scanline" />
      <div className="scanner" />
      <div className="vignette" />
      
      {/* Vision Scan Overlay Simulation */}
      <AnimatePresence>
        {thinkingStatus === 'VISION_SCAN_ACTIVE' && isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 pointer-events-none overflow-hidden"
          >
            <motion.div 
              animate={{ y: ['0%', '100%', '0%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="w-full h-[2px] bg-cyber-accent shadow-[0_0_20px_#00f2ff] opacity-70"
            />
            <div className="absolute inset-0 bg-[#00f2ff]/5 flex items-center justify-center">
              <div className="text-cyber-accent animate-pulse font-black text-[2vw] tracking-[1em] opacity-20">
                SEGMENTING_ACTIVE_WORKSPACE
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Sidebar - Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0a0f]/60 backdrop-blur-3xl border-r border-cyber-border transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-6 relative">
          {/* HUD Corner Accents */}
          <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-cyber-accent/30 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-cyber-accent/30 pointer-events-none" />

          <div className="flex items-center gap-3 mb-10">
            <div className="p-2 bg-cyber-accent rounded-sm text-black shadow-[0_0_15px_rgba(0,242,255,0.4)] cyber-border-angled">
              <Terminal size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-[0.3em] text-cyber-accent uppercase leading-none">N.O.R.A.</h1>
              <p className="text-[8px] font-mono text-cyber-accent/50 tracking-widest mt-1">ADVANCED_SYSTEM_V8.0</p>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden ml-auto p-2 hover:bg-cyber-border rounded-lg text-cyber-text-dim">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-8 no-scrollbar">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-cyber-text-dim mb-4 px-2 border-l border-cyber-accent/40">Core Protocols</p>
              <div className="space-y-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      handleSend(action.prompt);
                      setIsSidebarOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 text-sm text-cyber-text-dim hover:text-cyber-accent hover:bg-cyber-accent/10 rounded-lg transition-all group border border-transparent hover:border-cyber-accent/30 cyber-border-angled"
                  >
                    <span className="p-2 bg-cyber-bg border border-cyber-border rounded-sm group-hover:border-cyber-accent/60 transition-colors">
                      {action.icon}
                    </span>
                    <span className="font-bold tracking-wider uppercase text-[11px]">{action.label}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-cyber-accent" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-cyber-text-dim mb-4 px-2 border-l border-cyber-accent/40">System Status</p>
              <ul className="space-y-4 px-2">
                <li className="flex items-start gap-4">
                  <div className="mt-1.5 w-1.5 h-1.5 bg-cyber-accent animate-pulse shadow-[0_0_5px_#00f2ff]" />
                  <div>
                    <p className="text-[10px] text-cyber-text font-bold uppercase tracking-wider">Neural Engine</p>
                    <p className="text-[9px] text-cyber-text-dim font-mono mt-0.5">OMEGA_CORE_ACTIVE</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="mt-1.5 w-1.5 h-1.5 bg-cyber-accent pulse-slow shadow-[0_0_5px_#00f2ff]" />
                  <div>
                    <p className="text-[10px] text-cyber-text font-bold uppercase tracking-wider">Vision System</p>
                    <p className="text-[9px] text-cyber-text-dim font-mono mt-0.5">READY_TO_SCAN</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="mt-1.5 w-1.5 h-1.5 bg-cyber-accent" />
                  <div>
                    <p className="text-[10px] text-cyber-text font-bold uppercase tracking-wider">Creative Synthesis</p>
                    <p className="text-[9px] text-cyber-text-dim font-mono mt-0.5">MEDIA_GEN_PROTOCOL_ARMED</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="mt-1.5 w-1.5 h-1.5 bg-cyber-accent shadow-[0_0_8px_#00f2ff]" />
                  <div>
                    <p className="text-[10px] text-cyber-text font-bold uppercase tracking-wider">Neural Core V8</p>
                    <p className="text-[9px] text-cyber-text-dim font-mono mt-0.5">VISION_ACTIVE_SIM_ON</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="mt-1.5 w-1.5 h-1.5 bg-cyber-border" />
                  <div>
                    <p className="text-[10px] text-cyber-text font-bold uppercase tracking-wider">Workflow Sync</p>
                    <p className="text-[9px] text-cyber-text-dim font-mono mt-0.5">CREATOR_DEV_OPTIMIZED</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-cyber-accent/5 border border-cyber-accent/20 rounded-sm cyber-border-notched">
              <div className="flex items-center gap-2 mb-2">
                <Terminal size={14} className="text-cyber-accent" />
                <span className="text-[10px] font-black uppercase tracking-widest text-cyber-accent">Bridge Status</span>
              </div>
              <p className="text-[9px] text-cyber-text-dim font-mono leading-relaxed">
                Connect using <span className="text-cyber-accent">nora_py.exe</span>.
                AI will simulate Windows search inputs.
              </p>
              <div className="mt-2 p-1.5 bg-black/40 border border-cyber-border rounded-xs">
                <code className="text-[8px] text-cyber-accent font-mono block">pip install pyautogui</code>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-cyber-border">
            <div className="p-4 bg-cyber-bg/50 border border-cyber-border rounded-xl relative overflow-hidden group cyber-border-notched">
              <div className="absolute inset-0 bg-cyber-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={14} className="text-cyber-accent" />
                <p className="relative text-[10px] font-bold uppercase tracking-widest text-cyber-text">Sec_Layer_Delta</p>
              </div>
              <p className="relative text-[9px] text-cyber-text-dim mb-3 font-mono">Encryp: AES_256_BIT. SESS_ENCAP_ON.</p>
              <div className="h-0.5 w-full bg-cyber-border rounded-full overflow-hidden">
                <div className="h-full w-4/5 bg-cyber-accent shadow-[0_0_10px_#00f2ff]" />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-transparent z-10">
        <header className="flex items-center justify-between p-4 lg:p-6 bg-[#0a0a0f]/40 backdrop-blur-3xl border-b border-cyber-border sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 hover:bg-cyber-surface rounded-lg text-cyber-text">
              <Menu size={20} />
            </button>
            <div className="hidden lg:flex items-center gap-4 px-4 py-2 bg-cyber-surface/50 rounded-sm border border-cyber-border cyber-border-angled relative overflow-hidden">
              <div className="absolute left-0 top-0 w-1 h-full bg-cyber-accent shadow-[0_0_10px_#00f2ff]" />
              <div className="w-1.5 h-1.5 rounded-full bg-cyber-accent animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyber-accent">Neural_Core: Omega_Primary_01</span>
            </div>

            <button 
              onClick={toggleSpeechMode}
              className={`flex items-center gap-3 px-4 py-2 border transition-all cyber-border-angled relative overflow-hidden ${isSpeechMode ? 'border-cyber-accent bg-cyber-accent/20 text-cyber-accent shadow-[0_0_15px_rgba(0,242,255,0.2)]' : 'border-cyber-border bg-cyber-surface text-cyber-text-dim'}`}
            >
              <Zap size={14} className={isSpeechMode ? 'animate-bounce text-cyber-accent' : ''} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{isSpeechMode ? 'VOICE_ACTIVE' : 'VOICE_OFFLINE'}</span>
            </button>

            {!isSpeechMode && (
              <button 
                onClick={() => {
                  setVoiceEnabled(!voiceEnabled);
                  if (voiceEnabled) {
                    window.speechSynthesis.cancel();
                    setIsSpeaking(false);
                  }
                }}
                className={`flex items-center gap-3 px-4 py-2 border transition-all cyber-border-angled relative overflow-hidden ${voiceEnabled ? 'border-cyber-accent bg-cyber-accent/10 text-cyber-accent' : 'border-cyber-border bg-cyber-surface text-cyber-text-dim'}`}
              >
                {voiceEnabled && (
                  <div className="flex gap-[2px] items-center mr-2 h-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div 
                        key={i}
                        animate={isSpeaking ? { height: [4, 12, 4] } : { height: 4 }}
                        transition={isSpeaking ? { 
                          duration: 0.6, 
                          repeat: Infinity, 
                          delay: i * 0.1,
                          ease: "linear"
                        } : { duration: 0.2 }}
                        className={`w-[2px] rounded-full transition-colors ${isSpeaking ? 'bg-cyber-accent' : 'bg-cyber-accent/30'}`}
                      />
                    ))}
                  </div>
                )}
                <Activity size={14} className={isSpeaking ? 'animate-pulse text-cyber-accent' : 'text-cyber-text-dim'} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{voiceEnabled ? 'CHAT_BOT_ACTIVE' : 'CHAT_BOT_MUTED'}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-cyber-accent">Administrator</p>
              <p className="text-[9px] text-cyber-text-dim font-mono">AUTH: OMEGA_LEVEL</p>
            </div>
            <div className="w-10 h-10 rounded-sm bg-cyber-surface border border-cyber-accent/40 flex items-center justify-center text-xs font-bold text-cyber-accent shadow-[0_0_10px_rgba(0,242,255,0.1)] cyber-border-angled">
              ADM
            </div>
          </div>
        </header>

        {/* Command Indicator */}
        <AnimatePresence>
          {lastCommand && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-2 bg-cyber-accent text-black font-black uppercase tracking-[0.3em] text-[10px] shadow-[0_0_30px_rgba(0,242,255,0.5)] cyber-border-angled flex items-center gap-3"
            >
              <Zap size={14} className="animate-bounce" />
              EXECUTING: {lastCommand}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 lg:p-10 space-y-10 scroll-smooth relative"
        >
          <div className="max-w-4xl mx-auto w-full space-y-12 pb-10">
            <AnimatePresence initial={false}>
              {messages.map((message, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: message.role === 'user' ? 40 : -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className={`flex gap-4 lg:gap-8 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`flex-shrink-0 w-12 h-12 rounded-sm flex items-center justify-center border transition-all cyber-border-angled ${message.role === 'user' ? 'bg-cyber-accent border-cyber-accent text-black shadow-[0_0_25px_rgba(0,242,255,0.6)]' : 'bg-cyber-surface border-cyber-border text-cyber-accent shadow-[0_0_15px_rgba(0,242,255,0.2)]'}`}>
                    {message.role === 'user' ? <User size={24} /> : <Bot size={26} />}
                  </div>
                  <div className={`flex flex-col max-w-[85%] lg:max-w-[85%] ${message.role === 'user' ? 'items-end' : ''}`}>
                    <div className={`px-8 py-6 rounded-sm relative border transition-all duration-500 cyber-border-notched shadow-[0_0_40px_rgba(0,0,0,0.3)] backdrop-blur-md ${message.role === 'user' ? 'bg-cyber-accent/10 border-cyber-accent/30 text-white' : 'bg-cyber-surface/40 border-cyber-border/60 text-cyber-text'}`}>
                      {message.role === 'model' && (
                        <div className="absolute top-0 left-0 w-[2px] h-12 bg-cyber-accent shadow-[0_0_10px_#00f2ff] translate-y-4" />
                      )}
                      <div className={`markdown-body ${message.role === 'user' ? 'text-cyber-accent font-bold' : 'text-cyber-text'}`}>
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-[9px] uppercase font-black tracking-[0.2em] text-cyber-text-dim font-mono">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="w-10 h-[1px] bg-cyber-border" />
                      <span className="text-[9px] uppercase font-black tracking-[0.2em] text-cyber-accent/40 font-mono">
                        LOG_{message.role.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && messages[messages.length-1].content === '' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-4 lg:gap-8"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-sm bg-cyber-surface border border-cyber-accent/40 flex items-center justify-center cyber-border-angled animate-pulse shadow-[0_0_15px_rgba(0,242,255,0.2)]">
                  <Cpu size={24} className="text-cyber-accent" />
                </div>
                <div className="flex-1 max-w-xl">
                  <div className="bg-cyber-accent/5 border border-cyber-accent/20 px-6 py-4 rounded-sm cyber-border-notched relative overflow-hidden backdrop-blur-sm">
                    <div className="absolute top-0 left-0 h-full w-[2px] bg-cyber-accent" />
                    
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-cyber-accent animate-ping" />
                        <span className="text-[10px] font-black tracking-[0.2em] text-cyber-accent">{thinkingStatus}</span>
                      </div>
                      <span className="text-[10px] font-mono text-cyber-text-dim">EST: {estimatedTime}s</span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-cyber-text-dim italic">Omega_Neural_Processing...</span>
                        <span className="text-cyber-accent">{thinkingTime.toFixed(2)}s</span>
                      </div>
                      
                      <div className="h-1 w-full bg-cyber-border rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((thinkingTime / estimatedTime) * 100, 99)}%` }}
                          className="h-full bg-cyber-accent shadow-[0_0_10px_#00f2ff]"
                        />
                      </div>

                      <div className="flex gap-4 overflow-hidden opacity-30 select-none pointer-events-none">
                        {thinkingLogs.map((log, i) => (
                          <div key={i} className="text-[8px] font-mono text-cyber-accent whitespace-nowrap animate-pulse">
                            {log.toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 lg:p-10 shrink-0 bg-gradient-to-t from-[#020205] via-[#020205]/95 to-transparent relative z-20">
          <div className="max-w-4xl mx-auto w-full relative">
            <AnimatePresence mode="wait">
              {isSpeechMode ? (
                <motion.div
                  key="speech-control"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center gap-8 py-10"
                >
                  <div className="relative group cursor-pointer" onClick={startListening}>
                    {/* Arc Reactor Style Indicator */}
                    <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-500 ${isListening ? 'bg-cyber-accent/30 scale-150' : 'bg-cyber-accent/5 scale-100'}`} />
                    <div className={`w-32 h-32 rounded-full border-2 flex items-center justify-center relative z-10 transition-all duration-500 ${isListening ? 'border-cyber-accent shadow-[0_0_40px_rgba(0,242,255,0.6)] scale-110' : 'border-cyber-border'}`}>
                      {isListening ? (
                        <div className="flex gap-2">
                           {[1, 2, 3].map(i => (
                             <motion.div 
                               key={i}
                               animate={{ 
                                 scaleY: [1, 2, 1],
                                 opacity: [0.5, 1, 0.5]
                               }}
                               transition={{ 
                                 duration: 0.5, 
                                 repeat: Infinity, 
                                 delay: i * 0.1 
                               }}
                               className="w-1.5 h-8 bg-cyber-accent rounded-full"
                             />
                           ))}
                        </div>
                      ) : (
                        <div className={`text-cyber-accent transition-all duration-300 ${isSpeaking ? 'animate-pulse' : 'opacity-40 group-hover:opacity-100'}`}>
                          <Activity size={40} />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <p className={`text-[12px] font-black uppercase tracking-[0.4em] transition-colors ${isListening ? 'text-cyber-accent animate-pulse' : 'text-cyber-text-dim'}`}>
                      {isListening ? '>>> LISTENING_TO_SIR <<<' : isSpeaking ? '>>> NORA_VIRTUAL_SYNTHESIS <<<' : 'SYSTEMS_STANDBY_READY'}
                    </p>
                    <p className="text-[10px] text-cyber-text-dim font-mono tracking-widest opacity-50">
                      {isListening ? 'Voice Active' : 'Waiting for Chat Command'}
                    </p>
                  </div>

                  {!isListening && !isSpeaking && (
                    <button 
                      onClick={startListening}
                      className="px-8 py-3 bg-cyber-accent/10 border border-cyber-accent/40 text-cyber-accent text-[10px] font-black uppercase tracking-[0.3em] hover:bg-cyber-accent hover:text-black transition-all cyber-border-angled"
                    >
                      Initialize Voice Intake
                    </button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="text-control"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="relative flex items-end gap-3 bg-[#0a0a0f]/60 border border-cyber-border/40 p-2 shadow-[0_-20px_60px_rgba(0,0,0,0.6)] backdrop-blur-3xl focus-within:border-cyber-accent/50 transition-all cyber-border-angled"
                >
                  <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-cyber-accent/20 pointer-events-none" />
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="AWAITING DIRECTIVE..."
                    rows={1}
                    className="flex-1 max-h-48 min-h-[50px] py-4 px-8 bg-transparent outline-none resize-none text-[13px] placeholder:text-cyber-text-dim/40 text-cyber-text font-mono tracking-widest uppercase"
                    style={{ height: 'auto' }}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isTyping}
                    className={`w-14 h-14 transition-all flex items-center justify-center cyber-border-angled ${input.trim() && !isTyping ? 'bg-cyber-accent text-black hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(0,242,255,0.4)]' : 'bg-cyber-border text-cyber-text-dim'}`}
                  >
                    <Send size={24} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mt-6 flex justify-between items-center px-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyber-accent animate-pulse" />
                  <p className="text-[9px] text-cyber-accent font-black uppercase tracking-[0.3em]">
                    COMMS_ACTIVE
                  </p>
                </div>
                <div className="w-[1px] h-3 bg-cyber-border" />
                <p className="text-[9px] text-cyber-text-dim font-black uppercase tracking-[0.3em]">
                  BUFFER: STABLE
                </p>
              </div>
              <p className="text-[10px] text-cyber-text-dim font-black uppercase tracking-[0.3em] italic">
                A.I.S. TERMINAL_V_1.0.5
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
