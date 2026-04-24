import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Briefcase, Zap, Globe, Clock, ChevronRight, CircleCheckBig, CircleX } from 'lucide-react';
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
  }, []);

  const handleSyncJobs = async () => {
    setSyncing(true);
    try {
      await api.post('/jobs/sync');
      toast.success('Jobs synced successfully');
      setJobs([]); // Clear before fetch
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

  // UPDATED: Now receives and sends both applicationId and jobId
  const handleApply = async (applicationId, jobId) => {
    try {
      setActiveApplicationId(applicationId);
      const { data } = await api.post('/apply/start', { applicationId, jobId });
      toast.success(data.message || 'Application automation started');
      if (data.filledFields?.length) {
        toast.success(`Autofilled: ${data.filledFields.join(', ')}`);
      }
      if (data.warnings?.length) {
        toast(data.warnings[0], { icon: '⚠️' });
      }
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start apply automator');
    } finally {
      setActiveApplicationId(null);
    }
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

  const getStatusColor = (status) => {
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
            disabled={matching}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50"
          >
            <Zap className="w-4 h-4" /> {matching ? 'Matching...' : 'Run AI MatchMaker'}
          </button>
        </div>
      </div>

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
                {/* UPDATED: Changed job.matchScore to job.atsScore */}
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
                {job.jobId.description}
              </p>

              {/* UPDATED: Passing both job._id (application) and job.jobId._id (actual job) */}
              <button
                onClick={() => handleApply(job._id, job.jobId._id)}
                disabled={activeApplicationId === job._id}
                className="w-full flex items-center justify-center gap-2 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition disabled:opacity-50"
              >
                {activeApplicationId === job._id ? 'Starting...' : 'Start Semi-Auto Apply'} <ChevronRight className="w-4 h-4" />
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
