import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, BarChart3, Loader2, AlertCircle, MessageSquare } from 'lucide-react';

function getToken() { return localStorage.getItem('nexusiq_token'); }

interface FeedbackStats {
  up: number;
  down: number;
  total: number;
  recent: { query: string; feedback: string; createdAt: string }[];
}

export default function Feedback() {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/ask/feedback/stats', {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error('Failed to load');
        setStats(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load feedback stats');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /></div>;

  if (error) return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2"><AlertCircle className="w-5 h-5 shrink-0" /> {error}</div>
    </div>
  );

  const pct = stats && stats.total > 0 ? Math.round((stats.up / stats.total) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">AI Feedback</h1>
        <p className="text-gray-500 mt-1">Thumbs up/down on AI Q&A answers</p>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <ThumbsUp className="w-5 h-5 text-green-500" />
                <span className="text-xs text-gray-500 font-medium">Helpful</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.up}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <ThumbsDown className="w-5 h-5 text-red-500" />
                <span className="text-xs text-gray-500 font-medium">Not helpful</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.down}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                <span className="text-xs text-gray-500 font-medium">Satisfaction</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{pct}%</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Recent Feedback</h2>
            </div>
            {stats.recent.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No feedback yet. Ask questions in AI Q&A to collect feedback.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {stats.recent.map((r, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    {r.feedback === 'UP'
                      ? <ThumbsUp className="w-4 h-4 text-green-500 shrink-0" />
                      : <ThumbsDown className="w-4 h-4 text-red-500 shrink-0" />
                    }
                    <p className="text-sm text-gray-700 flex-1 truncate">{r.query}</p>
                    <span className="text-xs text-gray-400 shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
