import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { sendChatMessage } from '../api/client';
import { Send, MessageCircle, Bot, User, Sparkles } from 'lucide-react';

/**
 * ChatBox — interactive location intelligence chat assistant for follow-up questions.
 */
export default function ChatBox({ cellId, conceptId, city, selectedCell, livePointData }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll on new messages or typing state
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMessage = { role: 'user', content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsTyping(true);

    // Build rich location context
    const activeData = livePointData || selectedCell;
    const context = {
      city,
      concept_id: conceptId,
      cell_id: cellId,
      label: activeData?.label || selectedCell?.label,
      suburb: activeData?.suburb,
      lat: activeData?.lat,
      lon: activeData?.lon,
      demand: activeData?.demand,
      supply: activeData?.supply,
      gap: activeData?.gap,
      landmarks: activeData?.landmarks || [],
      venues: (activeData?.venues || []).slice(0, 10),
      taste_tags: activeData?.taste_tags || [],
    };

    try {
      const history = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const data = await sendChatMessage(text, context, history);

      const botMessage = {
        role: 'assistant',
        content: data.response || data.reply || data.message || 'No response received.',
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.response?.data?.detail || err.message || 'Failed to get response'}.`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[340px]">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
        <span className="flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-indigo-600" />
          Location Intelligence Chat
        </span>
        <span className="text-[10px] text-indigo-600 lowercase bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-normal">
          Gemini AI
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2.5 mb-2.5 chat-scroll min-h-[120px] max-h-[220px] pr-1"
      >
        {messages.length === 0 && (
          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-2.5 leading-relaxed">
            <p className="font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Ask follow-up questions about this area:
            </p>
            <ul className="space-y-0.5 text-slate-500 list-disc list-inside">
              <li>&ldquo;What about opening a Chinese restaurant or bakery here?&rdquo;</li>
              <li>&ldquo;Who are the daily commuters and students in this corridor?&rdquo;</li>
              <li>&ldquo;What pricing strategy fits this neighborhood?&rdquo;</li>
            </ul>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="h-3 w-3 text-indigo-600" />
              </div>
            )}
            <div
              className={`rounded-lg px-3 py-2 text-xs leading-relaxed max-w-[88%] shadow-2xs ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-xs prose-slate max-w-none break-words">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="h-3 w-3 text-slate-500" />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Bot className="h-3 w-3 text-indigo-600" />
            </div>
            <div className="bg-slate-100 rounded-lg px-3 py-2 text-xs text-slate-500 flex items-center gap-1.5">
              <span>Analyzing location...</span>
              <span className="inline-flex gap-1">
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg bg-white px-2.5 py-1.5 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-300 transition-all">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up question..."
          disabled={isTyping}
          className="flex-1 text-xs text-slate-700 placeholder-slate-400 outline-none bg-transparent py-0.5"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="p-1.5 rounded-md bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
