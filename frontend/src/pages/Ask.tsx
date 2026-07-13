import { useState, FormEvent } from 'react';
import { MessageSquare, Loader2, AlertCircle, Sparkles, FileText, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Citation {
  documentId: string;
  documentName: string;
  folderId: string | null;
  text: string;
  score?: number;
}

function getToken() { return localStorage.getItem('nexusiq_token'); }

export default function AskPage() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState('');

  const handleAsk = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setAsking(true);
    setError('');
    setAnswer('');
    setCitations([]);
    setAsked(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Ask failed' })); throw new Error(err.error); }
      const data = await res.json();
      setAnswer(data.answer || '');
      setCitations(data.citations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get answer');
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">AI Q&A</h1>
        <p className="text-gray-500 mt-1">Ask questions about your documents and get AI-powered answers</p>
      </div>

      <form onSubmit={handleAsk} className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What would you like to know?"
            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={asking || !query.trim()}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
        >
          {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
          {asking ? 'Thinking...' : 'Ask'}
        </button>
      </form>

      {error && (
        <div className="mb-6 bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {!asked && (
        <div className="text-center py-16">
          <Sparkles className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Ask anything</h2>
          <p className="text-gray-500 text-sm">Get AI-generated answers based on your documents with source citations</p>
        </div>
      )}

      {asked && !asking && !error && !answer && (
        <div className="text-center py-16">
          <MessageSquare className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No answer found</h2>
          <p className="text-gray-500 text-sm">Try rephrasing your question or upload more relevant documents</p>
        </div>
      )}

      {asking && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Searching documents and generating answer...</span>
          </div>
        </div>
      )}

      {answer && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Answer</h2>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
              {answer}
            </div>
          </div>

          {citations.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Sources ({citations.length})
              </h3>
              <div className="space-y-2">
                {citations.map((c, i) => (
                  <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="mb-1.5">
                      <div className="flex items-center gap-2">
                        <Link to={c.folderId ? `/folders/${c.folderId}` : '#'} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {c.documentName}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        {c.score != null && (
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            c.score >= 80 ? 'bg-green-100 text-green-700' :
                            c.score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {c.score}%
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{c.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
