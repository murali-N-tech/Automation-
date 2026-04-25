import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Briefcase, Zap, Globe, Clock, ChevronRight, CircleCheckBig, CircleX, FileText, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';

function getCompanyDisplayName(company) {
  if (!company) return 'Unknown Company';
  if (typeof company === 'string') return company;
  if (typeof company === 'object') return company.name || company.website || 'Unknown Company';
  return 'Unknown Company';
}

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [activeApplicationId, setActiveApplicationId] = useState(null);
  const [hasResume, setHasResume] = useState(false);
  
  // States for viewing and editing cover letters
  const [expandedLetterId, setExpandedLetterId] = useState(null);
  const [editingLetterId, setEditingLetterId] = useState(null);
  const [editedLetterText, setEditedLetterText] = useState("");
  const [savingLetter, setSavingLetter] = useState(false);

  const fetchJobs = async () => {
    try {
      const { data } = await api.get('/jobs/recommendations');
      setJobs(data);
    } catch (err) {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const checkResume = async () => {
      try {
        const { data } = await api.get('/resumes');
        setHasResume(Array.isArray(data) && data.length > 0);
      } catch {
        setHasResume(false);
      }
    };

    checkResume();
  }, []);

  const handleSyncJobs = async () => {
    setSyncing(true);
    try {
      await api.post('/jobs/sync');
      toast.success('Jobs synced successfully');
      setJobs([]); 
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Job sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleMatchJobs = async () => {
    setMatching(true);
    try {
      await api.post('/jobs/match');
      toast.success('AI Matching complete');
      setJobs([]);
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Job matching failed');
    } finally {
      setMatching(false);
    }
  };

  const handleApply = async (jobUrl) => {
    if (!jobUrl) {
      toast.error('Missing job URL');
      return;
    }

    window.open(jobUrl, '_blank', 'noopener,noreferrer');
    toast('Opened job page. Use the Chrome extension to autofill.', { icon: '🧩' });
  };

  const handleComplete = async (applicationId, outcome) => {
    try {
      setActiveApplicationId(applicationId);
      await api.post('/apply/complete', { applicationId, outcome });
      toast.success(outcome === 'applied' ? 'Marked as Applied' : 'Application status updated');
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update application status');
    } finally {
      setActiveApplicationId(null);
    }
  };

  // NEW: Save the edited cover letter to the database
  const handleSaveLetter = async (applicationId) => {
    setSavingLetter(true);
    try {
      await api.put(`/apply/${applicationId}/cover-letter`, { coverLetter: editedLetterText });
      toast.success('Cover letter updated successfully!');
      
      // Update local state without needing to refetch all jobs
      setJobs(jobs.map(job => 
        job._id === applicationId ? { ...job, coverLetter: editedLetterText } : job
      ));
      
      setEditingLetterId(null);
    } catch (err) {
      toast.error('Failed to save cover letter');
    } finally {
      setSavingLetter(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'Ready to Apply') return 'bg-purple-100 text-purple-800 border border-purple-200';
    if (status === 'Applied') return 'bg-emerald-100 text-emerald-700';
    if (status === 'Reviewing') return 'bg-blue-100 text-blue-700';
    if (status === 'Failed') return 'bg-rose-100 text-rose-700';
    return 'bg-neutral-100 text-neutral-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Job Recommendations</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncJobs}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-white text-neutral-700 border border-neutral-200 rounded-lg hover:bg-neutral-50 shadow-sm disabled:opacity-50"
          >
            <Globe className="w-4 h-4" /> {syncing ? 'Syncing...' : 'Scrape Jobs'}
          </button>
          <button
            onClick={handleMatchJobs}
            disabled={matching || !hasResume}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50"
          >
            <Zap className="w-4 h-4" /> {matching ? 'Matching...' : 'Run AI MatchMaker'}
          </button>
        </div>
      </div>

      {!hasResume && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
          Upload and parse a resume first to unlock AI matching and apply actions.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center p-12 text-neutral-500">Loading recommendations...</div>
        ) : jobs.length === 0 ? (
          <div className="col-span-full text-center p-12 bg-white rounded-xl border border-neutral-200 text-neutral-500">
            No matched jobs found. Click "Run AI MatchMaker" if you have scraped jobs and parsed a resume.
          </div>
        ) : (
          jobs.map(job => {
            if (!job.jobId) return null;

            return (
            <div key={job._id} className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-bold text-lg text-neutral-900 leading-tight">
                    {job.jobId.title}
                  </h2>
                  <p className="text-neutral-500">{getCompanyDisplayName(job.jobId.company)}</p>
                </div>
                <span className="flex items-center gap-1 font-bold text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                  {job.atsScore}% Match
                </span>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(job.status)}`}>
                  {job.status}
                </span>
                {job.jobId?.url && (
                  <a
                    href={job.jobId.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Open job page
                  </a>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-xs text-neutral-500 mb-6">
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {job.jobId.location}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Posted recently</span>
              </div>

              {!!job.missingKeywords?.length && (
                <div className="mb-4 text-xs">
                  <p className="text-neutral-700 font-medium mb-1">Missing Keywords</p>
                  <p className="text-amber-700">{job.missingKeywords.slice(0, 6).join(', ')}</p>
                </div>
              )}

              <p className="text-sm text-neutral-600 mb-6 line-clamp-3">
                {job.jobId.description || 'Description unavailable for this job listing.'}
              </p>

              {/* COVER LETTER VIEWER AND EDITOR */}
              {job.coverLetter && (
                <div className="mb-6">
                  <button
                    onClick={() => {
                      if (expandedLetterId === job._id) {
                        setExpandedLetterId(null);
                        setEditingLetterId(null);
                      } else {
                        setExpandedLetterId(job._id);
                      }
                    }}
                    className="flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-800 transition-colors mb-2"
                  >
                    <FileText className="w-4 h-4" />
                    {expandedLetterId === job._id ? 'Hide AI Cover Letter' : '✨ View AI Cover Letter'}
                  </button>

                  {expandedLetterId === job._id && (
                    <div className="mt-2">
                      {editingLetterId === job._id ? (
                        <div className="space-y-3">
                          <textarea
                            value={editedLetterText}
                            onChange={(e) => setEditedLetterText(e.target.value)}
                            className="w-full p-3 text-sm text-neutral-800 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none min-h-50"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveLetter(job._id)}
                              disabled={savingLetter}
                              className="px-4 py-2 bg-purple-600 text-white text-xs font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 transition"
                            >
                              {savingLetter ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button
                              onClick={() => setEditingLetterId(null)}
                              className="px-4 py-2 bg-neutral-100 text-neutral-700 text-xs font-medium rounded-md hover:bg-neutral-200 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg text-sm text-neutral-800 whitespace-pre-wrap relative group">
                          {job.coverLetter}
                          <button
                            onClick={() => {
                              setEditingLetterId(job._id);
                              setEditedLetterText(job.coverLetter);
                            }}
                            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1.5 bg-white text-purple-600 rounded-md shadow-sm border border-purple-200 opacity-0 group-hover:opacity-100 transition hover:bg-purple-50 text-xs font-bold"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => handleApply(job.jobId.url)}
                disabled={!hasResume}
                className="w-full flex items-center justify-center gap-2 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition disabled:opacity-50"
              >
                Open + Extension Apply <ChevronRight className="w-4 h-4" />
              </button>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleComplete(job._id, 'applied')}
                  disabled={activeApplicationId === job._id}
                  className="flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-sm disabled:opacity-50"
                >
                  <CircleCheckBig className="w-4 h-4" /> Mark Applied
                </button>
                <button
                  onClick={() => handleComplete(job._id, 'failed')}
                  disabled={activeApplicationId === job._id}
                  className="flex items-center justify-center gap-2 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-sm disabled:opacity-50"
                >
                  <CircleX className="w-4 h-4" /> Mark Failed
                </button>
              </div>
            </div>
          )})
        )}
      </div>
    </div>
  );
}