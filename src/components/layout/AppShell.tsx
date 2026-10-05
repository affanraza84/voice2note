'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Mic,
  Home,
  FileText,
  Search,
  MessageSquare,
  Settings,
  Menu,
  X,
  Sparkles,
  ShieldCheck,
  Database,
  Trash2,
} from 'lucide-react';
import { LocalAIStatusBadge } from './LocalAIStatusBadge';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDemoActive, setIsDemoActive] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const fetchDemoStatus = async () => {
    try {
      const res = await fetch('/api/demo');
      if (res.ok) {
        const data = await res.json();
        setIsDemoActive(data.isDemoActive);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchDemoStatus();
  }, []);

  const handleToggleDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isDemoActive ? 'clear' : 'load' }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsDemoActive(data.isDemoActive);
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to toggle demo data:', err);
    } finally {
      setDemoLoading(false);
    }
  };

  const navItems = [
    { label: 'Dashboard', href: '/', icon: Home },
    { label: 'Audio Studio', href: '/record', icon: Mic },
    { label: 'All Notes', href: '/notes', icon: FileText },
    { label: 'Search', href: '/search', icon: Search },
    { label: 'Ask My Notes', href: '/ask', icon: MessageSquare },
    { label: 'Privacy Center', href: '/privacy', icon: ShieldCheck },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[#090a0f] text-zinc-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-[#0f1118]/90 backdrop-blur-xl fixed inset-y-0 left-0 z-40">
        {/* Brand */}
        <div className="h-16 flex items-center px-6 border-b border-white/5 gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Mic className="w-4 h-4 text-black font-bold" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              Voice2Note
            </span>
            <span className="text-[10px] text-emerald-400 font-mono block -mt-0.5 tracking-wider uppercase">
              Local Intelligence
            </span>
          </div>
        </div>

        {/* Demo Mode Notice if Active */}
        {isDemoActive && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs text-indigo-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Database className="w-3.5 h-3.5" />
              Demo Data Active
            </span>
            <button
              onClick={handleToggleDemo}
              disabled={demoLoading}
              title="Clear Demo Notes"
              className="p-1 hover:text-white transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
                {item.href === '/record' && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Widget */}
        <div className="p-4 m-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Local-First Architecture</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Speech is decoded and normalized to 16kHz on-device. Executed locally with zero data loss.
          </p>
          <button
            onClick={handleToggleDemo}
            disabled={demoLoading}
            className="w-full py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-zinc-300 transition-all text-center block cursor-pointer"
          >
            {demoLoading ? 'Updating Demo Data...' : isDemoActive ? 'Clear Demo Notes' : 'Load Demo Notes (6)'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 border-b border-white/5 bg-[#0f1118]/60 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="md:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Mic className="w-3.5 h-3.5 text-black font-bold" />
              </div>
              <span className="font-bold text-sm">Voice2Note</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isDemoActive && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                <Database className="w-3 h-3" />
                Demo Mode
              </span>
            )}
            <LocalAIStatusBadge />
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-16 bg-[#090a0f]/95 z-50 p-4 border-t border-white/5 flex flex-col space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
