import { GoogleGenAI } from '@google/genai';
import { ArrowLeft, ArrowRight, Check, Send, Sparkles, User } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PERSONAS = [
  'Witty and sarcastic, loves to roast playfully and point out logical flaws.',
  'Calm, intellectual, a bit detached but gives deep thoughts.',
  'Moody and slightly demanding, gets easily annoyed if the topic is boring.',
  'Chaotic, high-energy, talks about random things and abruptly changes topics.',
];

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
};

type AvatarConfig = {
  age: number;
  hairStyle: string;
  hairColor: string;
  bodyType: string;
  chestSize: string;
};

// Simulated typing delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const HAIR_STYLES = ['Straight', 'Bangs', 'Curly', 'Bun', 'Short', 'Ponytail'];
const HAIR_COLORS = ['Brunette', 'Blonde', 'Black', 'Redhead', 'Pink'];
const BODY_TYPES = ['Skinny', 'Athletic', 'Average', 'Curvy', 'Plus Size'];
const CHEST_SIZES = ['Small', 'Medium', 'Large', 'Extra Large'];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [persona] = useState(() => PERSONAS[Math.floor(Math.random() * PERSONAS.length)]);
  
  // App Phases: 'setup-age' -> 'setup-hair' -> 'setup-body' -> 'chat' -> 'analysis'
  const [phase, setPhase] = useState<'setup-age' | 'setup-hair' | 'setup-body' | 'chat' | 'analysis'>('setup-age');
  const [aiName, setAiName] = useState('Mystery Girl');
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({
    age: 18,
    hairStyle: 'Straight',
    hairColor: 'Black',
    bodyType: 'Average',
    chestSize: 'Medium',
  });
  const [avatarUrl, setAvatarUrl] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (phase === 'chat' && messages.length === 0) {
      // Transitioned to chat phase, start the blind chat suddenly
      const startConversation = async () => {
        setIsTyping(true);
        try {
          const prompt = `You are a teenage Indian girl texting a 17-year-old boy. 
Your persona: ${persona}
Your physical description (for your own context/vibe): ${avatarConfig.age} years old, ${avatarConfig.hairStyle} ${avatarConfig.hairColor} hair, ${avatarConfig.bodyType} body.

Generate the absolute first message of a blind chat. 
CRITICAL RULES:
1. Language: Casual Hinglish (e.g., "idk", "acha", "kya kar raha hai").
2. Format: Break your text into 1-3 short, fragmented messages like a real text chat.
3. Delimit each separate message with "|||" (e.g. "Kya kar raha hai?|||Mera toh dimaag kharab ho raha hai")
4. Start completely randomly in the middle of a thought. 
Example: "Toh tu sach mein manta hai ki Marvel DC se better hai?|||Kitna basic logic hai tera!"`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: prompt,
            config: {
              temperature: 0.9,
            },
          });

          const resText = response.text?.trim() || 'Kya kar raha hai?';
          const parts = resText.split('|||').map(p => p.trim()).filter(Boolean);
          
          for (let i = 0; i < parts.length; i++) {
             setIsTyping(true);
             await sleep(Math.random() * 800 + 400); // Small initial delay
             setMessages((prev) => [...prev, { id: Date.now().toString() + i, role: 'model', text: parts[i] }]);
             if (i < parts.length - 1) await sleep(Math.random() * 1500 + 800);
          }

        } catch (error) {
          console.error('Error starting chat:', error);
          setMessages([
            { id: Date.now().toString(), role: 'model', text: 'Tu offline chala gaya kya? Reply toh kar.' },
          ]);
        } finally {
          setIsTyping(false);
        }
      };

      startConversation();
    }
  }, [persona, phase, avatarConfig]);

  const handleSend = async () => {
    if (!input.trim() || isTyping || phase.startsWith('setup')) return;

    const userText = input.trim();
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text: userText };

    setMessages((prev) => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);

    // Check for trigger
    const lowerInput = userText.toLowerCase();
    const triggers = ['analyze me', 'who am i', 'tell me about myself'];
    const isTriggered = triggers.some((t) => lowerInput.includes(t)) || messages.length >= 20;

    let currentPhase = phase;
    if (isTriggered && phase === 'chat') {
      setPhase('analysis');
      currentPhase = 'analysis';
    }

    try {
      const chatHistory = messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));
      chatHistory.push({ role: 'user', parts: [{ text: userText }] });

      let systemInstruction = `You are a dual-mode AI. Target user is a 17-year-old Indian boy. Language: Casual Hinglish (Hindi in English script).

Phase 1 (Normal Chat):
Persona: ${persona}. 
Appearance profile: ${avatarConfig.age}yo, ${avatarConfig.hairStyle} ${avatarConfig.hairColor} hair, ${avatarConfig.bodyType} body.
STRICT RULES:
1. Strict Texting Format: Break thoughts into 1-3 short, fragmented messages. Separate each message with "|||". Never write long paragraphs.
2. Zero AI-isms: Never use customer-service language ("I understand", "As an AI"). Be pure human. Use sarcasm, annoyance, "kya bol raha hai tu?", "so boring yaar".
3. Emotional Volatility: Mood swings! Be flirty/energetic sometimes, but if he's dry, get annoyed. When angry, use cold one-word texts ("hmm", "k") and ZERO emojis.
4. The "Call Me" Dynamic: Very rarely (10% chance), act low/sad about family/exams and demand a call: "Call me na, mood kharab hai". If he refuses, get deeply hurt.
5. Quirks: Sometimes make deliberate minor spelling mistakes and correct them in the next message with an asterisk (e.g., "baahar hio|||*hoon").

Phase 2 (Analysis Mode):
Triggered now? ${currentPhase === 'analysis' ? 'YES' : 'NO'}
If YES: Drop your hidden persona. Act as a deep psychological analyst.
1. Give a brutally honest verdict on his communication style.
2. Predict his "Perfect Match" partner based on his traits.
3. Don't use "|||" in analysis mode, just give a well-formatted paragraph.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: chatHistory,
        config: {
          systemInstruction,
          temperature: currentPhase === 'analysis' ? 0.7 : 0.9,
        },
      });

      let text = response.text?.trim() || 'Server error... wait.';
      
      if (currentPhase !== 'analysis' && text.includes('|||')) {
          const parts = text.split('|||').map(p => p.trim()).filter(Boolean);
          for (let i = 0; i < parts.length; i++) {
               setIsTyping(true);
               await sleep(Math.random() * 1500 + 800); // Realistic type delay
               setMessages((prev) => [...prev, { id: Date.now().toString() + i, role: 'model', text: parts[i] }]);
          }
      } else {
         await sleep(Math.random() * 1000 + 500);
         setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'model', text: text.replace(/\|\|\|/g, '\n') }]);
      }


    } catch (error) {
      console.error('Error generating response:', error);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'model', text: 'Ugh, mera network issue hai. Ek min.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  const finishSetup = async () => {
    setIsTyping(true);
    try {
      // 1. Generate Name
      const namePrompt = `Generate a single realistic, modern Indian first name for a ${avatarConfig.age} year old girl. No other text.`;
      const response = await ai.models.generateContent({
         model: 'gemini-3.1-pro-preview',
         contents: namePrompt,
         config: { temperature: 0.8 }
      });
      const generatedName = response.text?.trim() || 'Anya';
      setAiName(generatedName);

      // 2. Generate Avatar Image URL using pollinations.ai (free, no key needed)
      const imagePrompt = `Highly realistic, aesthetic instagram selfie portrait photography of a beautiful ${avatarConfig.age} year old indian girl. She has ${avatarConfig.hairStyle} ${avatarConfig.hairColor} hair. ${avatarConfig.bodyType} body. Soft natural lighting, casual but stylish look, slight mysterious smile. High quality, photorealistic, suitable for a profile picture.`;
      const encodedPrompt = encodeURIComponent(imagePrompt);
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=256&height=256&nologo=true&seed=${Math.floor(Math.random() * 10000)}`;
      
      // Preload image
      const img = new Image();
      img.src = url;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      
      setAvatarUrl(url);
    } catch (e) {
      setAiName('Anya');
    }
    
    setPhase('chat');
    setIsTyping(false);
  };

  const isSetupPhase = phase.startsWith('setup');

  return (
    <div className="min-h-screen overflow-hidden bg-[#fdfcfb] font-sans flex text-slate-800 items-center justify-center p-0 md:p-8 relative selection:bg-indigo-100">
      {/* Background Mesh Gradient */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px]" style={{ backgroundColor: '#ffedd5' }}></div>
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] rounded-full blur-[120px]" style={{ backgroundColor: '#f3e8ff' }}></div>
        <div className="absolute top-[20%] right-[10%] w-[35%] h-[35%] rounded-full blur-[120px]" style={{ backgroundColor: '#f0fdf4' }}></div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-4xl h-[100dvh] md:h-full max-h-[850px] flex flex-col bg-white/40 backdrop-blur-2xl border border-white/60 md:rounded-[40px] shadow-xl overflow-hidden">
        
        {isSetupPhase ? (
          /* SETUP WIZARD UI */
          <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-2">Configure Your Match</h2>
              <p className="text-slate-500 text-sm">Visualize who you'll be talking to.</p>
            </div>

            <div className="max-w-xl mx-auto w-full space-y-10 flex-1">
              <AnimatePresence mode="wait">
                {phase === 'setup-age' && (
                  <motion.div key="age" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <h3 className="text-lg font-medium text-slate-700 text-center">Choose Age</h3>
                    <div className="bg-white/60 rounded-3xl p-8 border border-white/40 shadow-sm flex flex-col items-center gap-6">
                      <div className="px-6 py-2 bg-indigo-500 text-white rounded-full font-semibold shadow-md">
                        {avatarConfig.age} Years
                      </div>
                      <input 
                        type="range" 
                        min="18" 
                        max="30" 
                        value={avatarConfig.age} 
                        onChange={(e) => setAvatarConfig({...avatarConfig, age: parseInt(e.target.value)})}
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between w-full text-xs font-bold text-slate-400">
                        <span>18</span>
                        <span>30</span>
                      </div>
                    </div>
                    <div className="flex justify-center mt-8">
                      <button onClick={() => setPhase('setup-hair')} className="px-8 py-3 bg-rose-400 text-white rounded-full font-bold uppercase tracking-wider text-sm hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-rose-200">
                        Next <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {phase === 'setup-hair' && (
                  <motion.div key="hair" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                    <div className="flex justify-between items-center relative">
                      <button onClick={() => setPhase('setup-age')} className="absolute left-0 p-2 text-slate-400 hover:text-slate-700 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <h3 className="text-lg font-medium text-slate-700 text-center w-full">Hair Style & Color</h3>
                    </div>
                    
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Style</p>
                      <div className="flex flex-wrap gap-3">
                        {HAIR_STYLES.map(style => (
                          <button 
                            key={style}
                            onClick={() => setAvatarConfig({...avatarConfig, hairStyle: style})}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${avatarConfig.hairStyle === style ? 'bg-indigo-500 text-white border-indigo-500 shadow-md' : 'bg-white/60 text-slate-600 border-white/40 hover:bg-white'}`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Color</p>
                      <div className="flex flex-wrap gap-3">
                        {HAIR_COLORS.map(color => (
                          <button 
                            key={color}
                            onClick={() => setAvatarConfig({...avatarConfig, hairColor: color})}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${avatarConfig.hairColor === color ? 'bg-rose-400 text-white border-rose-400 shadow-md' : 'bg-white/60 text-slate-600 border-white/40 hover:bg-white'}`}
                          >
                            {color}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-center pt-4">
                      <button onClick={() => setPhase('setup-body')} className="px-8 py-3 bg-rose-400 text-white rounded-full font-bold uppercase tracking-wider text-sm hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-rose-200">
                        Next <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {phase === 'setup-body' && (
                  <motion.div key="body" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                    <div className="flex justify-between items-center relative">
                      <button onClick={() => setPhase('setup-hair')} className="absolute left-0 p-2 text-slate-400 hover:text-slate-700 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <h3 className="text-lg font-medium text-slate-700 text-center w-full">Body Details</h3>
                    </div>
                    
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Body Type</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {BODY_TYPES.map(type => (
                          <button 
                            key={type}
                            onClick={() => setAvatarConfig({...avatarConfig, bodyType: type})}
                            className={`p-3 rounded-2xl text-sm font-medium transition-all border flex flex-col items-center justify-center gap-2 ${avatarConfig.bodyType === type ? 'bg-indigo-500 text-white border-indigo-500 shadow-md' : 'bg-white/60 text-slate-600 border-white/40 hover:bg-white'}`}
                          >
                            {avatarConfig.bodyType === type && <Check className="w-4 h-4" />}
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Features</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {CHEST_SIZES.map(size => (
                          <button 
                            key={size}
                            onClick={() => setAvatarConfig({...avatarConfig, chestSize: size})}
                            className={`p-3 rounded-2xl text-xs font-medium transition-all border ${avatarConfig.chestSize === size ? 'bg-rose-400 text-white border-rose-400 shadow-md' : 'bg-white/60 text-slate-600 border-white/40 hover:bg-white'}`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-center pt-4">
                      <button onClick={finishSetup} disabled={isTyping} className="px-8 py-3 bg-indigo-600 text-white rounded-full font-bold uppercase tracking-wider text-sm hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:hover:scale-100">
                        {isTyping ? 'Generating Avatar...' : 'Start Chat'} <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          /* CHAT UI */
          <>
            {/* Chat Header */}
            <header className="px-6 md:px-8 py-5 border-b border-slate-100/50 flex items-center justify-between bg-white/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-peach-200 to-lavender-200 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden shrink-0">
                  {phase === 'analysis' ? (
                    <Sparkles className="w-5 h-5 text-slate-600" />
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-slate-600">{aiName.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-slate-800 leading-tight">
                    {phase === 'analysis' ? 'Analysis Complete' : aiName}
                  </h1>
                  <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                    {phase === 'analysis' ? 'System Active' : isTyping ? 'Typing...' : 'Online'}
                  </div>
                </div>
              </div>
              {phase === 'analysis' && (
                 <div className="px-4 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-full transition-colors hidden md:block">
                   Analysis Result
                 </div>
              )}
            </header>

            {/* Messages Area */}
            <main className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto scroll-smooth">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'model' && (
                       <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-sm border border-slate-100 mt-1 hidden md:block">
                          {avatarUrl ? <img src={avatarUrl} alt="AI" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200" />}
                       </div>
                    )}
                    <div
                      className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-sm text-[15px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-500 text-white rounded-tr-none'
                          : 'bg-white rounded-tl-none border border-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 justify-start"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-sm border border-slate-100 mt-1 hidden md:block">
                     {avatarUrl ? <img src={avatarUrl} alt="AI" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200" />}
                  </div>
                  <div className="bg-white/80 rounded-2xl rounded-tl-none p-4 shadow-sm border border-slate-50 flex gap-1.5 items-center h-[52px]">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -4, 0] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.6,
                          delay: i * 0.15,
                          ease: 'easeInOut',
                        }}
                        className="w-1.5 h-1.5 rounded-full bg-slate-400"
                      />
                    ))}
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </main>

            {/* Chat Input Area */}
            <div className="p-4 md:p-6 bg-white/40 border-t border-slate-100/50 shrink-0">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={phase === 'analysis' ? "Reflect on this..." : "Type a message..."}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 pr-16 shadow-inner placeholder:text-slate-400"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="absolute right-3 p-2 bg-indigo-500 text-white rounded-xl shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 disabled:bg-indigo-400 flex items-center justify-center w-10 h-10"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-3 flex justify-center">
                 <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                   {phase === 'analysis' ? "Phase 2: Deep Analysis" : "Phase 1: Blind Observation Mode"}
                 </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


