import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, Users, FolderOpen, FileText, History, User, Building2, Globe } from 'lucide-react';

interface MemberResult { id: string; name: string; email: string; role: string; }
interface FolderResult { id: string; name: string; teamName: string | null; docCount: number; teamId: string | null; }
interface FileResult { id: string; name: string; uploadedBy: string; folderName: string | null; folderId: string | null; }
interface LogResult { id: string; action: string; documentName: string | null; userName: string; folderName: string; createdAt: string; }

interface SearchResults {
  members: MemberResult[];
  folders: FolderResult[];
  files: FileResult[];
  logs: LogResult[];
}

function getToken() { return localStorage.getItem('nexusiq_token'); }

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults(null);
      setSearched(false);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults(null); setSearched(false); return; }
    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch('/api/search/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ query: q.trim() }),
      });
      if (!res.ok) throw new Error('Search failed');
      setResults(await res.json());
    } catch { /* ignore */ }
    finally { setSearching(false); }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 200);
  };

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  if (!open) return null;

  const totalResults = results
    ? results.members.length + results.folders.length + results.files.length + results.logs.length
    : 0;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search members, folders, files, logs..."
            className="flex-1 outline-none text-sm"
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults(null); setSearched(false); inputRef.current?.focus(); }}
              className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {searching && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
            </div>
          )}

          {searched && !searching && totalResults === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No results found</div>
          )}

          {results && !searching && (
            <div className="divide-y divide-gray-50">
              {results.members.length > 0 && (
                <Section title="Members" icon={Users} count={results.members.length}>
                  {results.members.map((m) => (
                    <ResultRow key={m.id}
                      icon={<User className="w-4 h-4" />}
                      label={m.name}
                      sub={`${m.email} · ${m.role}`}
                    />
                  ))}
                </Section>
              )}

              {results.folders.length > 0 && (
                <Section title="Folders" icon={FolderOpen} count={results.folders.length}>
                  {results.folders.map((f) => (
                    <ResultRow key={f.id}
                      icon={f.teamId ? <Building2 className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                      label={f.name}
                      sub={`${f.docCount} docs${f.teamName ? ` · ${f.teamName}` : ' · Org'}`}
                      onClick={() => handleNavigate(`/folders/${f.id}`)}
                    />
                  ))}
                </Section>
              )}

              {results.files.length > 0 && (
                <Section title="Files" icon={FileText} count={results.files.length}>
                  {results.files.map((f) => (
                    <ResultRow key={f.id}
                      icon={<FileText className="w-4 h-4" />}
                      label={f.name}
                      sub={`by ${f.uploadedBy}${f.folderName ? ` in ${f.folderName}` : ''}`}
                      onClick={f.folderId ? () => handleNavigate(`/folders/${f.folderId}`) : undefined}
                    />
                  ))}
                </Section>
              )}

              {results.logs.length > 0 && (
                <Section title="Logs" icon={History} count={results.logs.length}>
                  {results.logs.map((l) => (
                    <ResultRow key={l.id}
                      icon={<div className={`w-2 h-2 rounded-full ${l.action === 'UPLOAD' ? 'bg-green-400' : 'bg-red-400'}`} />}
                      label={`${l.action} ${l.documentName || 'a file'}`}
                      sub={`by ${l.userName} in ${l.folderName}`}
                    />
                  ))}
                </Section>
              )}
            </div>
          )}

          {!searched && !searching && (
            <div className="text-center py-12 text-gray-400 text-sm">Type to search across your organization</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, count, children }: { title: string; icon: any; count: number; children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3">
      <div className="flex items-center gap-1.5 px-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-auto">{count}</span>
      </div>
      {children}
    </div>
  );
}

function ResultRow({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors">
      <div className="text-gray-400 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
        <p className="text-xs text-gray-500 truncate">{sub}</p>
      </div>
    </button>
  );
}
