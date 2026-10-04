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
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RotateCcw,
  Quote,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: RAGCitation[];
  isGrounded?: boolean;
  modelUsed?: string;
  isError?: boolean;
  errorDetails?: string;
}

const SUGGESTED_PROMPTS = [
  'What tasks did I mention recently?',
  'What ideas did I have for my project?',
  'What did I discuss about my upcoming plans?',
];

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
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);

  const formatSeconds = (secs?: number) => {
    if (!secs || secs <= 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleQuery = async (queryText: string) => {
    if (!queryText.trim() || thinking) return;

    const userText = queryText.trim();
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
      const isConnectionRefused =
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('11434');

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: isConnectionRefused
            ? "Local AI isn't running.\n\nStart the configured AI service and try again. For Ollama, run `ollama serve` or open the Ollama app in your background."
            : `Could not retrieve an answer: ${err.message || 'Unknown error'}.`,
          isError: true,
          errorDetails: err.message || 'No additional debug information',
          isGrounded: false,
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuery(input);
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          'Chat history reset. Ask me anything about your notes, tasks, or recorded commitments.',
      },
    ]);
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
        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-xs flex items-center gap-1 cursor-pointer"
            title="Reset Chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grounded RAG (No Hallucination)</span>
            <span className="sm:hidden">Grounded</span>
          </div>
        </div>
      </div>

      {/* Suggested Questions Pills (shown if few messages) */}
      {messages.length <= 2 && !thinking && (
        <div className="p-3.5 rounded-2xl glass-panel border border-white/5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Suggested questions:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleQuery(prompt)}
                className="text-xs px-3 py-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-zinc-300 hover:text-emerald-300 transition-all cursor-pointer text-left"
              >
                &ldquo;{prompt}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}

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
                  : msg.isError
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-white/10 text-emerald-400'
              }`}
            >
              {msg.role === 'user' ? (
                <User className="w-4 h-4" />
              ) : msg.isError ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            <div
              className={`p-4 sm:p-5 rounded-2xl text-sm leading-relaxed max-w-[85%] space-y-3 ${
                msg.role === 'user'
                  ? 'bg-emerald-500 text-black font-medium'
                  : msg.isError
                  ? 'bg-amber-950/20 border border-amber-500/20 text-zinc-200'
                  : 'glass-panel border border-white/5 text-zinc-200'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Error Details toggle */}
              {msg.isError && msg.errorDetails && (
                <details className="mt-2 text-xs text-zinc-400 border-t border-amber-500/20 pt-2">
                  <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300 select-none font-mono text-[11px]">
                    Technical details
                  </summary>
                  <pre className="mt-1.5 p-2 bg-black/40 rounded-lg text-[10px] text-zinc-400 font-mono overflow-x-auto whitespace-pre-wrap">
                    {msg.errorDetails}
                  </pre>
                </details>
              )}

              {/* Citations block for assistant messages */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                    Source Citations ({msg.citations.length}):
                  </span>
                  <div className="space-y-2">
                    {msg.citations.map((cite, cIdx) => {
                      const citeKey = `${msg.id}-${cIdx}`;
                      const isExpanded = expandedCitation === citeKey;

                      return (
                        <div
                          key={citeKey}
                          className="rounded-xl bg-black/40 border border-white/5 overflow-hidden transition-all text-xs"
                        >
                          <div className="flex items-center justify-between p-2.5">
                            <Link
                              href={`/notes/${cite.noteId}`}
                              className="flex items-center gap-2 text-zinc-200 hover:text-emerald-400 font-medium transition-colors"
                            >
                              <FileAudio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{cite.noteTitle}</span>
                              <ExternalLink className="w-3 h-3 text-zinc-500" />
                            </Link>

                            <div className="flex items-center gap-2">
                              {cite.startTime !== undefined && (
                                <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatSeconds(cite.startTime)}
                                </span>
                              )}
                              <button
                                onClick={() =>
                                  setExpandedCitation(isExpanded ? null : citeKey)
                                }
                                className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
                                title="Toggle Source Excerpt Preview"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Source Quote Preview */}
                          {isExpanded && cite.quote && (
                            <div className="px-3 pb-3 pt-1 border-t border-white/5 bg-white/[0.01] text-[11px] text-zinc-400">
                              <div className="flex items-start gap-1.5 italic text-zinc-300">
                                <Quote className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                <span>&ldquo;{cite.quote}&rdquo;</span>
                              </div>
                              <div className="mt-1 text-[10px] text-zinc-500 font-mono">
                                Relevance score: {(cite.score * 100).toFixed(1)}% match
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Model transparency footer */}
              {msg.modelUsed && !msg.isError && (
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
