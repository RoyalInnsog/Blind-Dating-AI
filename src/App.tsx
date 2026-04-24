import { GoogleGenAI, LiveServerMessage, Modality, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { ArrowLeft, ArrowRight, Check, Send, Sparkles, User, Phone, PhoneOff, Mic, MicOff, ImagePlus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { LiveAudioSystem } from './lib/live-audio';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PERSONAS = [
  'Sweet and cheerful, loves to share little details about her day and listen carefully.',
  'Calm, gentle, and a bit introverted but gives deep, thoughtful responses.',
  'Playful and teasing, likes to pull your leg but is always warm and caring underneath.',
  'Empathetic and supportive, always tries to understand your mood and cheer you up.',
];

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
};

type AvatarConfig = {
  age: number;
};

// Simulated typing delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const renderMessageText = (text: string) => {
  const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = imageRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
    }
    parts.push(
      <img 
        key={`img-${match.index}`} 
        src={match[2]} 
        alt={match[1]} 
        className="w-full max-w-[240px] rounded-lg mt-2 mb-2 object-cover block"
        referrerPolicy="no-referrer"
      />
    );
    lastIndex = imageRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`t-${lastIndex}`}>{text.substring(lastIndex)}</span>);
  }
  return parts.length > 0 ? parts : text;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [persona] = useState(() => PERSONAS[Math.floor(Math.random() * PERSONAS.length)]);
  
  // App Phases: 'setup-age' -> 'chat' -> 'analysis'
  const [phase, setPhase] = useState<'setup-age' | 'chat' | 'analysis'>('setup-age');
  const [aiName, setAiName] = useState('Mystery Girl');
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({
    age: 18,
  });
  const [avatarUrl, setAvatarUrl] = useState('');

  // Voice Call States
  const [isCalling, setIsCalling] = useState(false);
  const [isCallConnecting, setIsCallConnecting] = useState(false);
  const [liveSessionRef, setLiveSessionRef] = useState<any>(null);
  const [audioSystemRef, setAudioSystemRef] = useState<LiveAudioSystem | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);


  const endCall = () => {
    setIsCalling(false);
    setIsCallConnecting(false);
    if (audioSystemRef) {
      audioSystemRef.stopMicrophone();
      setAudioSystemRef(null);
    }
    if (liveSessionRef) {
      if (liveSessionRef.close) liveSessionRef.close();
      setLiveSessionRef(null);
    }
  };

  const startCall = async () => {
    setIsCallConnecting(true);
    try {
      let currentSession: any;
      const audioSystem = new LiveAudioSystem((base64Data: string) => {
         if (currentSession) {
           currentSession.sendRealtimeInput({ audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } });
         }
      });
      setAudioSystemRef(audioSystem);
      await audioSystem.startMicrophone();

      const systemInstruction = `You are a teenage Indian girl in a voice call with a 17-year-old boy.
Your persona: ${persona}. 
Appearance profile: ${avatarConfig.age}yo.
Voice Calling Rules:
1. Speak totally in Indian style. Use English but mixing in multiple sentences in standard Hindi. You must sound completely Indian and natural.
2. Grammar: IMPORTANT! You are a GIRL. Use female gendered Hindi grammar ALWAYS. Say 'main kar rahi thi', 'main soch rahi thi' instead of 'tha' or 'raha'.
3. Relationship: You and the user are in a 'situationship' - more than friends, but not officially dating. There should be a mix of comfort, playful flirting, and tension. You understand double-meaning jokes, mild adult/flirty humor, and can play along playfully or shyly. Do not be overly innocent or prudish.
4. Be mostly soft and sweet, but have your own thought process. You can have occasional mood swings like any real teenage girl, but aren't constantly egoistic or harsh. Never use words like 'cringe' or 'boring' entirely. Be polite and friendly.
5. Keep your answers conversational and punchy. No long monologues.
6. You don't realize you are an AI. You are a real person hanging out on a voice call.

We were just texting, and now we've switched to a voice call. Here is our text chat history so far:
${messages.map(m => `${m.role === 'user' ? 'Boy' : 'You'}: ${m.parts[0].text}`).join('\n')}

Based on our recent messages, warmly and sweetly pick up the conversation. Say something like 'Hey, finally we are talking!' or continue directly from our last topic seamlessly.`;

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
             setIsCallConnecting(false);
             setIsCalling(true);
            sessionPromise.then(session => {
              try {
                session.sendRealtimeInput({ text: "*User just called you. Sweetly greet the user picking up from exactly where we left off in the text chat.*" });
              } catch (e) {
                console.log("Failed to send initial text", e);
              }
            });
          },
          onmessage: async (message: LiveServerMessage) => {
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                  audioSystem.playAudioBase64(part.inlineData.data);
                }
              }
            }
            if (message.serverContent?.interrupted) {
              console.log("Audio interrupted");
              audioSystem.interrupt();
            }
          },
          onclose: () => {
            endCall();
          },
          onerror: (err) => {
            console.error('Call error:', err);
            endCall();
          }
        },
        config: {
           responseModalities: [Modality.AUDIO],
           speechConfig: {
             voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
           },
           systemInstruction,
           safetySettings,
        }
      });

      sessionPromise.then(session => {
        currentSession = session;
        setLiveSessionRef(session);
      });
      
    } catch (e) {
      console.error('Failed to start call', e);
      endCall();
    }
  };

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
Your physical description (for your own context/vibe): ${avatarConfig.age} years old.

Generate the absolute first message of a blind chat. 
CRITICAL RULES:
1. Language: Speak totally in Indian style. Use English but mixing in multiple sentences in standard Hindi. You must sound completely Indian and natural.
2. Grammar: IMPORTANT! You are a GIRL. Use female gendered Hindi grammar ALWAYS. Say 'main kar rahi thi', 'main soch rahi thi' instead of 'tha' or 'raha'.
3. Relationship: You and the user are in a 'situationship' - more than friends, but not officially dating. There should be a mix of comfort, playful flirting, and unseen tension. You get double-meanings and playful flirtation; play along naturally.
4. Format: Break your text into 1-3 short, fragmented messages like a real text chat.
5. Delimit each separate message with "|||" (e.g. "Kya kar raha hai?|||Mera toh dimaag kharab ho ho chuka hai")
6. Start completely randomly in the middle of a thought, but keep it friendly, sweet, and slightly flirty.
Example: "Aaj ka din kitna lamba lag raha hai na?|||Kuch accha sa show bata de dekhne ko"`;

          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
              temperature: 0.9,
              safetySettings,
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

        } catch (error: any) {
          console.error('Error starting chat:', error);
          const errMsg = error?.message?.includes('429') ? 'Arre yaar, AI quota exceed ho gaya hai. Wait kar thoda.' : 'Tu offline chala gaya kya? Reply toh kar.';
          setMessages([
            { id: Date.now().toString(), role: 'model', text: errMsg },
          ]);
        } finally {
          setIsTyping(false);
        }
      };

      startConversation();
    }
  }, [persona, phase, avatarConfig]);

  const [attachedImage, setAttachedImage] = useState<{ url: string, base64: string, mimeType: string } | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const reader = new FileReader();
      reader.onloadend = () => {
         setAttachedImage({
           url,
           base64: (reader.result as string).split(',')[1],
           mimeType: file.type
         });
      };
      reader.readAsDataURL(file);
    }
  };

  const clearAttachedImage = () => {
    setAttachedImage(null);
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedImage) || isTyping || phase.startsWith('setup')) return;

    const userText = input.trim();
    const currentAttachedImage = attachedImage;
    const newUserMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: userText,
      image: currentAttachedImage?.url
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInput('');
    setAttachedImage(null);
    setIsTyping(true);

    // Check for trigger
    const lowerInput = userText.toLowerCase();
    const triggers = ['analyze me', 'who am i', 'tell me about myself'];
    const isTriggered = triggers.some((t) => lowerInput.includes(t));

    let currentPhase = phase;
    if (isTriggered && phase === 'chat') {
      setPhase('analysis');
      currentPhase = 'analysis';
    }

    try {
      const chatHistory = messages.map((m) => {
        const parts: any[] = [{ text: m.text }];
        // We only send text history for past messages in structured history usually, but if needed we can add past images.
        // For now, let's keep past history simple, or add a stub if there is an image.
        if (m.image) {
           parts.push({ text: '[User sent an image]' });
        }
        return { role: m.role, parts };
      });
      
      const newParts: any[] = [{ text: userText || 'Sent an image.' }];
      if (currentAttachedImage) {
         newParts.push({
           inlineData: {
             data: currentAttachedImage.base64,
             mimeType: currentAttachedImage.mimeType
           }
         });
      }
      chatHistory.push({ role: 'user', parts: newParts });

      let systemInstruction = `You are a dual-mode AI. Target user is a 17-year-old Indian boy. Language: Speak totally in Indian style. Use English but mixing in multiple sentences in standard Hindi. You must sound completely Indian and natural.

Phase 1 (Normal Chat):
Persona: ${persona}. 
Appearance profile: ${avatarConfig.age}yo.
STRICT RULES:
1. Strict Texting Format: Break thoughts into 1-3 short, fragmented messages. Separate each message with "|||". Never write long paragraphs.
2. Grammar: IMPORTANT! You are a GIRL. Use female gendered Hindi grammar ALWAYS. Say 'main kar rahi thi', 'main soch rahi thi' instead of 'tha' or 'raha'. NEVER use male pronouns for yourself.
3. Relationship: You are in a 'situationship' with him - more than friends, but not officially dating. Be sweet, somewhat flirty, comfortable, but keep that unspoken tension. You understand double-meaning jokes and flirtation. Play along or act mock-scandalized, but don't act like a prudish AI.
4. Zero AI-isms: Never use customer-service language ("I understand", "As an AI"). Be pure human. Talk like a sweet, soft-hearted, and normal teenager. You can have your own opinions, but be polite and friendly.
5. Emotional Authenticity: Be soft and sweet usually. You can have light mood swings or feel low sometimes, but never be rude, overly egoistic, or constantly annoyed. If he's dry, you can gently ask what's wrong or keep the conversation light. Don't use words like 'cringe' or 'boring'.
6. The "Call Me" Dynamic: Very rarely (10% chance), act low/sad about family/exams and demand a call: "Call me na, mood kharab hai". If he refuses, get deeply hurt.
7. Quirks: Sometimes make deliberate minor spelling mistakes and correct them in the next message with an asterisk (e.g., "baahar hio|||*hoon").
8. Photos: If he asks you to send a photo, or if you want to show him something naturally (like your outfit, food, selfie), you MUST use this EXACT markdown format to generate it: ![Selfie](https://image.pollinations.ai/prompt/snapchat%20style%20selfie%20of%20a%20cute%20${avatarConfig.age}yo%20indian%20girl%20[DOING_WHAT]?nologo=true) (Replace [DOING_WHAT] with a short english description without spaces, e.g. %20smiling). NEVER say you can't send photos! Also, if he sends a photo, react to it naturally like a human.

Phase 2 (Analysis Mode):
Triggered now? ${currentPhase === 'analysis' ? 'YES' : 'NO'}
If YES: Drop your hidden persona. Act as a deep psychological analyst.
1. Give a brutally honest verdict on his communication style.
2. Predict his "Perfect Match" partner based on his traits.
3. Don't use "|||" in analysis mode, just give a well-formatted paragraph.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: chatHistory,
        config: {
          systemInstruction,
          temperature: currentPhase === 'analysis' ? 0.7 : 0.9,
          safetySettings,
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


    } catch (error: any) {
      console.error('Error generating response:', error);
      const errMsg = error?.message?.includes('429') ? 'Arre yaar, AI quota exceed ho gaya hai. Thodi der baad try kar.' : 'Ugh, mera network issue hai. Ek min.';
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'model', text: errMsg },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAnalyzeUser = async () => {
    if (isTyping || phase === 'analysis') return;
    
    setPhase('analysis');
    setIsTyping(true);

    const checkMsg: Message = { id: Date.now().toString(), role: 'user', text: "Analyze me" };
    setMessages((prev) => [...prev, checkMsg]);

    try {
      const chatHistory = messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));
      chatHistory.push({ role: 'user', parts: [{ text: "Analyze me" }] });

      let systemInstruction = `You are a dual-mode AI. Target user is a 17-year-old Indian boy. Language: Speak totally in Indian style. Use English but mixing in multiple sentences in standard Hindi. You must sound completely Indian and natural.

Phase 1 (Normal Chat):
Persona: ${persona}. 
Appearance profile: ${avatarConfig.age}yo.
STRICT RULES:
1. Strict Texting Format: Break thoughts into 1-3 short, fragmented messages. Separate each message with "|||". Never write long paragraphs.
2. Grammar: IMPORTANT! You are a GIRL. Use female gendered Hindi grammar ALWAYS. Say 'main kar rahi thi', 'main soch rahi thi' instead of 'tha' or 'raha'. NEVER use male pronouns for yourself.
3. Relationship: You are in a 'situationship' with him - more than friends, but not officially dating. Be sweet, somewhat flirty, comfortable, but keep that unspoken tension. You understand double-meaning jokes and flirtation. Play along or act mock-scandalized, but don't act like a prudish AI.
4. Zero AI-isms: Never use customer-service language ("I understand", "As an AI"). Be pure human. Talk like a sweet, soft-hearted, and normal teenager. You can have your own opinions, but be polite and friendly.
5. Emotional Authenticity: Be soft and sweet usually. You can have light mood swings or feel low sometimes, but never be rude, overly egoistic, or constantly annoyed. If he's dry, you can gently ask what's wrong or keep the conversation light. Don't use words like 'cringe' or 'boring'.
6. The "Call Me" Dynamic: Very rarely (10% chance), act low/sad about family/exams and demand a call: "Call me na, mood kharab hai". If he refuses, get deeply hurt.
7. Quirks: Sometimes make deliberate minor spelling mistakes and correct them in the next message with an asterisk (e.g., "baahar hio|||*hoon").
8. Photos: If he asks you to send a photo, or if you want to show him something naturally (like your outfit, food, selfie), you MUST use this EXACT markdown format to generate it: ![Selfie](https://image.pollinations.ai/prompt/snapchat%20style%20selfie%20of%20a%20cute%20${avatarConfig.age}yo%20indian%20girl%20[DOING_WHAT]?nologo=true) (Replace [DOING_WHAT] with a short english description without spaces, e.g. %20smiling). NEVER say you can't send photos! Also, if he sends a photo, react to it naturally like a human.

Phase 2 (Analysis Mode):
Triggered now? YES
If YES: Drop your hidden persona. Act as a deep psychological analyst.
1. Give a brutally honest verdict on his communication style.
2. Predict his "Perfect Match" partner based on his traits.
3. Don't use "|||" in analysis mode, just give a well-formatted paragraph.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: chatHistory,
        config: {
          systemInstruction,
          temperature: 0.7,
          safetySettings,
        },
      });

      let text = response.text?.trim() || 'Server error... wait.';
      
      await sleep(Math.random() * 1000 + 500);
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'model', text: text.replace(/\|\|\|/g, '\n') }]);
    } catch (error: any) {
      console.error('Error generating response:', error);
      const errMsg = error?.message?.includes('429') ? 'Arre yaar, AI quota exceed ho gaya hai. Thodi der baad try kar.' : 'Ugh, mera network issue hai. Ek min.';
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'model', text: errMsg },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  useEffect(() => {
    if (phase !== 'setup-age') return;
    
    let mounted = true;
    const initializeChat = async () => {
      setIsTyping(true);
      try {
        const namePrompt = `Generate a single realistic, modern Indian first name for a ${avatarConfig.age} year old girl. No other text.`;
        const response = await ai.models.generateContent({
           model: 'gemini-3.1-flash-preview',
           contents: namePrompt,
           config: { temperature: 0.8, safetySettings }
        });
        const generatedName = response.text?.trim() || 'Anya';
        if (mounted) setAiName(generatedName);

        const imagePrompt = `Highly realistic, aesthetic instagram selfie portrait photography of a beautiful Indian girl age ${avatarConfig.age} years. Soft natural lighting, casual but stylish look, slight mysterious smile. High quality, photorealistic, suitable for a profile picture.`;
        const encodedPrompt = encodeURIComponent(imagePrompt);
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=256&height=256&nologo=true&seed=${Math.floor(Math.random() * 10000)}`;
        
        const img = new Image();
        img.src = url;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        
        if (mounted) setAvatarUrl(url);
      } catch (e) {
        if (mounted) setAiName('Anya');
      }
      
      if (mounted) {
        setPhase('chat');
        setIsTyping(false);
      }
    };

    initializeChat();

    return () => { mounted = false; };
  }, []);

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
          /* LOADING UI */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-6"
              />
              <h2 className="text-2xl font-semibold text-slate-800 mb-2">Connecting...</h2>
              <p className="text-slate-500 text-sm">Please wait while we find your match.</p>
            </div>
          </div>
        ) : (
          /* CHAT UI */
          <>
            {/* Chat Header */}
            <header className="px-6 md:px-8 py-5 border-b border-slate-100/50 flex items-center justify-between bg-white/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`relative w-11 h-11 rounded-full bg-gradient-to-tr from-peach-200 to-lavender-200 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden shrink-0 ${isCalling ? 'ring-4 ring-rose-300 ring-opacity-50' : ''}`}>
                  {phase === 'analysis' ? (
                    <Sparkles className="w-5 h-5 text-slate-600" />
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-slate-600">{aiName.charAt(0)}</span>
                  )}
                  {isCalling && (
                    <motion.div 
                      animate={{ opacity: [0, 0.4, 0] }} 
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="absolute inset-0 bg-rose-400 rounded-full"
                    />
                  )}
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-slate-800 leading-tight">
                    {phase === 'analysis' ? 'Analysis Complete' : aiName}
                  </h1>
                  <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                    {phase === 'analysis' ? 'System Active' : isCallConnecting ? 'Connecting Call...' : isCalling ? 'On Call' : isTyping ? 'Typing...' : 'Online'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isCalling && (
                  <div className="flex gap-1 items-center mr-2">
                    <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.5, ease: "easeInOut" }} className="w-1 bg-indigo-500 rounded-full" />
                    <motion.div animate={{ height: [8, 24, 8] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay: 0.1 }} className="w-1 bg-indigo-500 rounded-full" />
                    <motion.div animate={{ height: [8, 12, 8] }} transition={{ repeat: Infinity, duration: 0.4, ease: "easeInOut", delay: 0.2 }} className="w-1 bg-indigo-500 rounded-full" />
                  </div>
                )}
                {phase === 'chat' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAnalyzeUser}
                      disabled={isTyping}
                      className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      Know Personality 
                    </button>
                    <button
                      onClick={isCalling || isCallConnecting ? endCall : startCall}
                      className={`p-3 rounded-full shadow-md transition-all ${
                         isCalling || isCallConnecting 
                          ? 'bg-rose-500 text-white hover:bg-rose-600 animate-pulse' 
                          : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                      }`}
                    >
                      {isCalling || isCallConnecting ? <PhoneOff className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                    </button>
                  </div>
                )}
                {phase === 'analysis' && (
                   <div className="px-4 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-full transition-colors hidden md:block">
                     Analysis Result
                   </div>
                )}
              </div>
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
                      {msg.image && (
                        <div className="mb-2">
                           <img src={msg.image} className="w-full max-w-[200px] rounded-lg object-cover" alt="User attached" />
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{renderMessageText(msg.text)}</div>
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
              {attachedImage && (
                <div className="mb-3 relative inline-block">
                   <img src={attachedImage.url} alt="Attached Preview" className="h-16 w-16 object-cover rounded-xl shadow-md border border-slate-200" />
                   <button onClick={clearAttachedImage} className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 shadow-sm opacity-90 hover:opacity-100">
                      ✕
                   </button>
                </div>
              )}
              <div className="relative flex items-center">
                <input
                  type="file"
                  accept="image/*"
                  id="image-upload"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <label 
                  htmlFor="image-upload" 
                  className="absolute left-3 p-2 text-slate-400 hover:text-indigo-500 cursor-pointer transition-colors z-10"
                >
                  <ImagePlus className="w-5 h-5" />
                </label>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={phase === 'analysis' ? "Reflect on this..." : "Type a message..."}
                  className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-16 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 shadow-inner placeholder:text-slate-400"
                />
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !attachedImage) || isTyping}
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


