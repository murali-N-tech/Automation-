import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Zap, Globe, Clock, ChevronRight,
  CircleCheckBig, CircleX, FileText, Edit3, ExternalLink,
  RefreshCw, AlertTriangle, BrainCircuit, MapPin, Search
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Helpers (Upgraded for Dark Mode) ──────────────────────────────────────────
function getCompanyName(company) {
  if (!company) return 'Unknown Company';
  if (typeof company === 'string') return company;
  if (typeof company === 'object') return company.name || company.website || 'Unknown Company';
  return 'Unknown Company';
}

function scoreColor(score) {
  if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  if (score >= 60) return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
  if (score >= 40) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
}

function statusColor(status) {
  switch (status) {
    case 'Ready to Apply': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    case 'Applied':        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'Reviewing':      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'Failed':         return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    default:               return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
  }
}

// ── Framer Motion Variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Jobs() {
  const [jobs,          setJobs]        = useState([]);
  const [loading,       setLoading]     = useState(true);
  const [syncing,       setSyncing]     = useState(false);
  const [matching,      setMatching]    = useState(false);
  const [hasResume,     setHasResume]   = useState(false);
  const [busyId,        setBusyId]      = useState(null); 

  // Cover-letter state
  const [expandedId,    setExpandedId]  = useState(null);
  const [editingId,     setEditingId]   = useState(null);
  const [editText,      setEditText]    = useState('');
  const [savingLetter,  setSavingLetter] = useState(false);

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

  const handleApply = async (app) => {
    if (!app.jobId?.url) { toast.error('No job URL available'); return; }
    if (!hasResume)       { toast.error('Upload a resume first'); return; }

    setBusyId(app._id);
    try {
      await api.post('/apply/start', {
        applicationId: app._id,
        jobId:         app.jobId._id,
      });

      window.open(app.jobId.url, '_blank', 'noopener,noreferrer');
      toast.success(
        `Job page opened! In the Chrome extension:\n1. Paste your token & App ID: ${app._id}\n2. Click Load → Autofill`,
        { duration: 8000, icon: '🧩' }
      );
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Job Recommendations</h1>
          <p className="mt-2 text-zinc-400">Scrape, score, and push top matches into the AI execution pipeline.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/ai-studio"
            className="flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-300 shadow-sm transition hover:bg-indigo-500/20 hover:border-indigo-500/50"
          >
            <BrainCircuit className="h-4 w-4" /> Open AI Studio
          </Link>
          <button
            onClick={handleSyncJobs}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-800 hover:text-white transition shadow-sm disabled:opacity-50 text-sm font-medium"
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
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition shadow-sm shadow-indigo-500/20 disabled:opacity-50 text-sm font-medium"
          >
            {matching
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Matching…</>
              : <><Zap className="w-4 h-4" /> Run AI MatchMaker</>
            }
          </button>
        </div>
      </div>

      {/* Warnings & Alerts */}
      <div className="space-y-3">
        {!hasResume && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200 text-sm">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-400" />
            <p>System Alert: Upload and parse a resume first to unlock AI matching and automation protocols.</p>
          </motion.div>
        )}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-blue-200 text-sm flex items-start gap-3">
          <Zap className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-400" />
          <p>
            <strong>Execution Protocol:</strong> Click "Open + Autofill" to initialize the job page. 
            Open the <strong>Hire-Me AI Chrome extension</strong>, paste your token & the Application ID, click Load → Autofill.
          </p>
        </div>
      </div>

      {/* Job Cards Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
      >
        {loading ? (
          // Professional Skeleton Loaders
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 animate-pulse flex flex-col gap-4">
              <div className="flex justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
                  <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
                </div>
                <div className="w-16 h-6 bg-zinc-800 rounded-lg ml-4"></div>
              </div>
              <div className="h-16 bg-zinc-800/50 rounded-lg w-full mt-2"></div>
              <div className="h-10 bg-zinc-800 rounded-lg w-full mt-auto"></div>
            </div>
          ))
        ) : jobs.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 bg-zinc-900/30 rounded-2xl border border-zinc-800/50 border-dashed text-zinc-500">
            <Search className="w-12 h-12 text-zinc-700 mb-4" />
            <p className="text-lg font-medium text-zinc-300">No active matches found</p>
            <p className="text-sm mt-1">Initiate "Scrape Jobs" and run the AI MatchMaker to populate this sector.</p>
          </div>
        ) : (
          jobs.map(app => {
            if (!app.jobId) return null;
            const busy = busyId === app._id;

            return (
              <motion.div
                variants={cardVariants}
                key={app._id}
                className="bg-zinc-900/80 p-6 rounded-xl border border-zinc-800 hover:border-zinc-700 shadow-xl shadow-black/20 transition-all flex flex-col gap-4 group relative overflow-hidden"
              >
                {/* Subtle gradient hover effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                {/* Title + Score */}
                <div className="flex items-start justify-between gap-3 relative z-10">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-lg text-zinc-100 leading-tight truncate" title={app.jobId.title}>
                      {app.jobId.title}
                    </h2>
                    <p className="text-sm text-zinc-400 truncate mt-1 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5" />
                      {getCompanyName(app.jobId.company)}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-md ${scoreColor(app.atsScore)}`}>
                    {Math.round(app.atsScore)}% Match
                  </span>
                </div>

                {/* Status + Link */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3 relative z-10">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor(app.status)}`}>
                    {app.status}
                  </span>
                  {app.jobId.url && (
                    <a
                      href={app.jobId.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View Source
                    </a>
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-zinc-500 relative z-10">
                  <span className="flex items-center gap-1.5 bg-zinc-800/50 px-2 py-1 rounded">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{app.jobId.location || 'Remote'}</span>
                  </span>
                  <span className="flex items-center gap-1.5 bg-zinc-800/50 px-2 py-1 rounded">
                    <Clock className="w-3 h-3" />
                    {new Date(app.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Missing keywords */}
                {app.missingKeywords?.length > 0 && (
                  <div className="text-xs bg-orange-500/10 border border-orange-500/20 rounded-lg p-2.5 relative z-10">
                    <span className="font-semibold text-orange-400">Skill Gap: </span>
                    <span className="text-orange-200/70">
                      {app.missingKeywords.slice(0, 5).join(', ')}
                      {app.missingKeywords.length > 5 && ` +${app.missingKeywords.length - 5} more`}
                    </span>
                  </div>
                )}

                {/* Cover Letter Section with AnimatePresence */}
                {app.coverLetter && (
                  <div className="relative z-10">
                    <button
                      onClick={() => {
                        setExpandedId(expandedId === app._id ? null : app._id);
                        setEditingId(null);
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      {expandedId === app._id ? 'Close AI Letter' : '✨ View AI Cover Letter'}
                    </button>

                    <AnimatePresence>
                      {expandedId === app._id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 overflow-hidden"
                        >
                          {editingId === app._id ? (
                            <div className="space-y-3">
                              <textarea
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                rows={8}
                                className="w-full p-3 text-xs bg-zinc-950 border border-indigo-500/30 rounded-lg text-zinc-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none custom-scrollbar"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveLetter(app._id)}
                                  disabled={savingLetter}
                                  className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-500 transition disabled:opacity-50"
                                >
                                  {savingLetter ? 'Saving…' : 'Save Changes'}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="px-4 py-1.5 bg-zinc-800 text-zinc-300 text-xs font-medium rounded-md hover:bg-zinc-700 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="relative group">
                              <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-lg p-3 max-h-48 overflow-y-auto font-sans custom-scrollbar">
                                {app.coverLetter}
                              </pre>
                              <button
                                onClick={() => { setEditingId(app._id); setEditText(app.coverLetter); }}
                                className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 hover:text-white shadow-lg border border-zinc-700 text-xs font-medium opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ── Actions ── */}
                <div className="mt-auto space-y-3 pt-3 border-t border-zinc-800/50 relative z-10">
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to={`/ai-studio?jobId=${app.jobId._id}&applicationId=${app._id}`}
                      className="flex items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 py-2 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500/20 hover:text-cyan-300"
                    >
                      <BrainCircuit className="h-3.5 w-3.5" />
                      Deep AI
                    </Link>

                    <button
                      onClick={() => handleApply(app)}
                      disabled={busy || !hasResume}
                      className="flex items-center justify-center gap-1.5 py-2 bg-zinc-100 text-zinc-900 rounded-lg font-bold text-xs hover:bg-white disabled:opacity-50 transition"
                    >
                      {busy
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <><ChevronRight className="w-4 h-4" /> Autofill</>
                      }
                    </button>
                  </div>

                  {/* ID Copy hint */}
                  <p className="text-center text-[10px] text-zinc-500 uppercase tracking-wider font-semibold select-all" title="Copy this into the Chrome extension">
                    System ID: <span className="font-mono text-zinc-400">{app._id}</span>
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleComplete(app._id, 'applied')}
                      disabled={busy || app.status === 'Applied'}
                      className="flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 text-[11px] font-medium disabled:opacity-30 transition-colors"
                    >
                      <CircleCheckBig className="w-3.5 h-3.5" /> Set Applied
                    </button>
                    <button
                      onClick={() => handleComplete(app._id, 'failed')}
                      disabled={busy || app.status === 'Failed'}
                      className="flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-[11px] font-medium disabled:opacity-30 transition-colors"
                    >
                      <CircleX className="w-3.5 h-3.5" /> Set Failed
                    </button>
                  </div>
                </div>

              </motion.div>
            );
          })
        )}
      </motion.div>
    </motion.div>
  );
}