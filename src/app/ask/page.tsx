'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RAGCitation } from '@/types';
import {
  MessageSquare,
  Send,
  Bot,
  User,
  ShieldCheck,
  Loader2,
  FileAudio,
  ExternalLink,
  Clock,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: RAGCitation[];
  isGrounded?: boolean;
  modelUsed?: string;
}

export default function AskMyNotesPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your Voice2Note Knowledge Assistant. Ask me anything about your recorded voice notes, commitments, ideas, or meeting decisions. I will only answer using verified excerpts from your notes and will provide source citations.',
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const formatSeconds = (secs?: number) => {
    if (!secs || secs <= 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || thinking) return;

    const userText = input.trim();
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setThinking(true);

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to query notes');
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        citations: data.citations || [],
        isGrounded: data.isGrounded,
        modelUsed: data.modelUsed,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Error querying your notes: ${err.message || 'Unknown error'}. Please ensure local Ollama is running.`,
          isGrounded: false,
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-8rem)] flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            Ask My Notes
          </h1>
          <p className="text-xs text-zinc-400">
            Conversational RAG assistant strictly grounded in your voice notes.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Grounded RAG (No Hallucination)</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                msg.role === 'user'
                  ? 'bg-emerald-500 text-black font-semibold'
                  : 'bg-white/10 text-emerald-400'
              }`}
            >
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`p-4 sm:p-5 rounded-2xl text-sm leading-relaxed max-w-[85%] space-y-3 ${
                msg.role === 'user'
                  ? 'bg-emerald-500 text-black font-medium'
                  : 'glass-panel border border-white/5 text-zinc-200'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Citations block for assistant messages */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                    Source Citations:
                  </span>
                  <div className="space-y-1.5">
                    {msg.citations.map((cite) => (
                      <Link
                        key={cite.noteId}
                        href={`/notes/${cite.noteId}`}
                        className="flex items-center justify-between p-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/5 text-xs group transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <FileAudio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="font-medium text-zinc-200 group-hover:text-emerald-400 transition-colors">
                            {cite.noteTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                          {cite.startTime !== undefined && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {formatSeconds(cite.startTime)}
                            </span>
                          )}
                          <ExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-white" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Model transparency footer */}
              {msg.modelUsed && (
                <div className="text-[10px] text-zinc-500 font-mono pt-1">
                  Synthesized locally with {msg.modelUsed}
                </div>
              )}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 text-emerald-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 rounded-2xl glass-panel text-xs text-zinc-400 flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              <span>Retrieving relevant notes & synthesizing answer with local Llama 3.2...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about what you've said or planned..."
          className="w-full pl-4 pr-12 py-3.5 rounded-2xl glass-panel border border-white/10 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 shadow-xl"
        />
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-30 transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
