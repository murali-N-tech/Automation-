import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  Briefcase, Zap, Globe, Clock, ChevronRight,
  CircleCheckBig, CircleX, FileText, Edit3, ExternalLink,
  RefreshCw, AlertTriangle, BrainCircuit,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCompanyName(company) {
  if (!company) return 'Unknown Company';
  if (typeof company === 'string') return company;
  if (typeof company === 'object') return company.name || company.website || 'Unknown Company';
  return 'Unknown Company';
}

function scoreColor(score) {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800';
  if (score >= 60) return 'bg-blue-100 text-blue-800';
  if (score >= 40) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

function statusColor(status) {
  switch (status) {
    case 'Ready to Apply': return 'bg-purple-100 text-purple-800 border border-purple-200';
    case 'Applied':        return 'bg-emerald-100 text-emerald-700';
    case 'Reviewing':      return 'bg-blue-100 text-blue-700';
    case 'Failed':         return 'bg-rose-100 text-rose-700';
    default:               return 'bg-neutral-100 text-neutral-600';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Jobs() {
  const [jobs,        setJobs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [syncing,     setSyncing]     = useState(false);
  const [matching,    setMatching]    = useState(false);
  const [hasResume,   setHasResume]   = useState(false);
  const [busyId,      setBusyId]      = useState(null);   // applicationId being acted on

  // Cover-letter state
  const [expandedId,  setExpandedId]  = useState(null);
  const [editingId,   setEditingId]   = useState(null);
  const [editText,    setEditText]    = useState('');
  const [savingLetter, setSavingLetter] = useState(false);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    try {
      const { data } = await api.get('/jobs/recommendations');
      setJobs(data);
    } catch {
      toast.error('Failed to load job recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    api.get('/resumes')
      .then(({ data }) => setHasResume(Array.isArray(data) && data.length > 0))
      .catch(() => setHasResume(false));
  }, [fetchJobs]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleSyncJobs = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/jobs/sync');
      toast.success(`Synced ${data.syncedCount ?? 0} new job(s)`);
      setJobs([]);
      setLoading(true);
      await fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Job sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleMatchJobs = async () => {
    setMatching(true);
    try {
      const { data } = await api.post('/jobs/match');
      toast.success(`AI matched ${data.newMatches?.length ?? 0} new job(s)`);
      setJobs([]);
      setLoading(true);
      await fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Job matching failed');
    } finally {
      setMatching(false);
    }
  };

  /**
   * ✅ FIX: proper automation flow
   * 1. Call /apply/start to mark the application as Reviewing and get context
   * 2. Open the job URL in a new tab
   * 3. Instruct user to click autofill in the extension
   */
  const handleApply = async (app) => {
    if (!app.jobId?.url) { toast.error('No job URL available'); return; }
    if (!hasResume)       { toast.error('Upload a resume first'); return; }

    setBusyId(app._id);
    try {
      // Mark the application as "Reviewing" and confirm the record exists
      await api.post('/apply/start', {
        applicationId: app._id,
        jobId:         app.jobId._id,
      });

      // Open the actual job posting
      window.open(app.jobId.url, '_blank', 'noopener,noreferrer');

      toast.success(
        `Job page opened! In the Chrome extension:\n1. Paste your token & App ID: ${app._id}\n2. Click Load → Autofill`,
        { duration: 8000, icon: '🧩' }
      );

      // Refresh to show "Reviewing" status
      await fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start application');
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (appId, outcome) => {
    setBusyId(appId);
    try {
      await api.post('/apply/complete', { applicationId: appId, outcome });
      toast.success(outcome === 'applied' ? '✅ Marked as Applied!' : 'Status updated');
      await fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveLetter = async (appId) => {
    setSavingLetter(true);
    try {
      await api.put(`/apply/${appId}/cover-letter`, { coverLetter: editText });
      toast.success('Cover letter saved!');
      setJobs(prev =>
        prev.map(j => j._id === appId ? { ...j, coverLetter: editText } : j)
      );
      setEditingId(null);
    } catch {
      toast.error('Failed to save cover letter');
    } finally {
      setSavingLetter(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Job Recommendations</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Scrape, score, and then move the best matches into deeper AI preparation.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/ai-studio"
            className="flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-800 shadow-sm transition hover:bg-cyan-100"
          >
            <BrainCircuit className="h-4 w-4" /> Open AI Studio
          </Link>
          <button
            onClick={handleSyncJobs}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-white text-neutral-700 border border-neutral-200 rounded-lg hover:bg-neutral-50 shadow-sm disabled:opacity-50 text-sm font-medium"
          >
            {syncing
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Syncing…</>
              : <><Globe className="w-4 h-4" /> Scrape Jobs</>
            }
          </button>
          <button
            onClick={handleMatchJobs}
            disabled={matching || !hasResume}
            title={!hasResume ? 'Upload a resume first' : ''}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50 text-sm font-medium"
          >
            {matching
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Matching…</>
              : <><Zap className="w-4 h-4" /> Run AI MatchMaker</>
            }
          </button>
        </div>
      </div>

      {/* Resume warning */}
      {!hasResume && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p>Upload and parse a resume first to unlock AI matching and apply actions.</p>
        </div>
      )}

      {/* Extension reminder */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-800 text-sm">
        <strong>How to apply:</strong> Click "Open + Autofill" → it opens the job page.
        Then open the <strong>Hire-Me AI Chrome extension</strong>, paste your <em>token</em> and the <em>Application ID</em> shown in the button, click <em>Load</em> then <em>Autofill</em>.
      </div>

      {/* Job Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full flex justify-center py-16 text-neutral-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : jobs.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-white rounded-xl border border-neutral-200 text-neutral-500">
            <Briefcase className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
            <p className="font-medium">No matched jobs yet.</p>
            <p className="text-sm mt-1">Click "Scrape Jobs" then "Run AI MatchMaker".</p>
          </div>
        ) : (
          jobs.map(app => {
            if (!app.jobId) return null;
            const busy = busyId === app._id;

            return (
              <div
                key={app._id}
                className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition flex flex-col gap-3"
              >
                {/* Title + Score */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-bold text-base text-neutral-900 leading-tight truncate">
                      {app.jobId.title}
                    </h2>
                    <p className="text-sm text-neutral-500 truncate">
                      {getCompanyName(app.jobId.company)}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${scoreColor(app.atsScore)}`}>
                    {Math.round(app.atsScore)}% Match
                  </span>
                </div>

                {/* Status + Link */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor(app.status)}`}>
                    {app.status}
                  </span>
                  {app.jobId.url && (
                    <a
                      href={app.jobId.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> View Posting
                    </a>
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    {app.jobId.location || 'Remote'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(app.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Missing keywords */}
                {app.missingKeywords?.length > 0 && (
                  <div className="text-xs bg-amber-50 border border-amber-100 rounded-lg p-2">
                    <span className="font-semibold text-amber-800">Missing: </span>
                    <span className="text-amber-700">
                      {app.missingKeywords.slice(0, 5).join(', ')}
                      {app.missingKeywords.length > 5 && ` +${app.missingKeywords.length - 5} more`}
                    </span>
                  </div>
                )}

                {/* Description preview */}
                <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                  {app.jobId.description || 'No description available.'}
                </p>

                {/* Cover Letter */}
                {app.coverLetter && (
                  <div className="border-t border-neutral-100 pt-3">
                    <button
                      onClick={() => {
                        if (expandedId === app._id) {
                          setExpandedId(null);
                          setEditingId(null);
                        } else {
                          setExpandedId(app._id);
                          setEditingId(null);
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {expandedId === app._id ? 'Hide Cover Letter' : '✨ View AI Cover Letter'}
                    </button>

                    {expandedId === app._id && (
                      <div className="mt-2">
                        {editingId === app._id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              rows={8}
                              className="w-full p-3 text-xs border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveLetter(app._id)}
                                disabled={savingLetter}
                                className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-md hover:bg-purple-700 disabled:opacity-50"
                              >
                                {savingLetter ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1.5 bg-neutral-100 text-neutral-700 text-xs rounded-md hover:bg-neutral-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative group">
                            <pre className="whitespace-pre-wrap text-xs text-neutral-700 bg-purple-50 border border-purple-100 rounded-lg p-3 max-h-48 overflow-y-auto font-sans">
                              {app.coverLetter}
                            </pre>
                            <button
                              onClick={() => { setEditingId(app._id); setEditText(app.coverLetter); }}
                              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-white text-purple-600 rounded shadow border border-purple-200 text-xs font-semibold opacity-0 group-hover:opacity-100 transition"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Primary CTA: Open + Autofill ── */}
                <Link
                  to={`/ai-studio?jobId=${app.jobId._id}&applicationId=${app._id}`}
                  className="flex items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
                >
                  <BrainCircuit className="h-4 w-4" />
                  Deep AI Analysis
                </Link>

                <button
                  onClick={() => handleApply(app)}
                  disabled={busy || !hasResume}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-900 text-white rounded-lg font-semibold text-sm hover:bg-neutral-700 disabled:opacity-50 transition mt-auto"
                >
                  {busy
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <><ChevronRight className="w-4 h-4" /> Open + Autofill</>
                  }
                </button>

                {/* Application ID hint for extension */}
                <p className="text-center text-xs text-neutral-400 -mt-1 select-all" title="Copy this into the Chrome extension">
                  App ID: <span className="font-mono">{app._id}</span>
                </p>

                {/* Secondary: Mark Applied / Failed */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleComplete(app._id, 'applied')}
                    disabled={busy || app.status === 'Applied'}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-medium disabled:opacity-40"
                  >
                    <CircleCheckBig className="w-3.5 h-3.5" /> Mark Applied
                  </button>
                  <button
                    onClick={() => handleComplete(app._id, 'failed')}
                    disabled={busy || app.status === 'Failed'}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-medium disabled:opacity-40"
                  >
                    <CircleX className="w-3.5 h-3.5" /> Mark Failed
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
