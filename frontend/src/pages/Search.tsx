import { useState, FormEvent } from 'react';
import { Search as SearchIcon, FileText, Loader2, AlertCircle, Hash } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SearchResult {
  chunk: { index: number; text: string; page: number | null };
  distance: number;
  documentId: string;
  documentName: string;
}

interface DocInfo {
  id: string;
  originalName: string;
}

function getToken() { return localStorage.getItem('nexusiq_token'); }

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [documents, setDocuments] = useState<DocInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setError('');
    setSearched(true);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ query: q, topK: 5 }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Search failed' })); throw new Error(err.error); }
      const data = await res.json();
      setResults(data.results || []);
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Search</h1>
        <p className="text-gray-500 mt-1">Search across all your documents</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are you looking for?"
            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="mb-6 bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {!searched && documents.length === 0 && (
        <div className="text-center py-16">
          <SearchIcon className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Search your knowledge base</h2>
          <p className="text-gray-500 text-sm">Enter a query above to find relevant content across your documents</p>
        </div>
      )}

      {searched && !searching && !error && results.length === 0 && (
        <div className="text-center py-16">
          <SearchIcon className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No results found</h2>
          <p className="text-gray-500 text-sm">Try a different query or upload more documents</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
            {documents.length > 0 && ` across ${documents.length} document${documents.length !== 1 ? 's' : ''}`}
          </p>
          {results.map((r, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{r.documentName}</span>
                    <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                      Score: {(1 - r.distance / 10).toFixed(2)}
                    </span>
                    {r.chunk.page != null && (
                      <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
                        <Hash className="w-2.5 h-2.5" /> p.{r.chunk.page}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{r.chunk.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
