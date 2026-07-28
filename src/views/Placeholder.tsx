import React from 'react';
import { Hammer } from 'lucide-react';

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">{title}</h1>
        <p className="text-slate-400 mt-1">Manage {title.toLowerCase()} settings and configurations.</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center shadow-xl">
        <Hammer className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white">No active {title.toLowerCase()} configurations</h3>
        <p className="text-slate-400 mt-2">There are no {title.toLowerCase()} configurations active at the moment. Add configurations to see them here.</p>
      </div>
    </div>
  );
}
