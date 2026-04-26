import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  BrainCircuit, FileSearch, FileStack, FileText,
  Gauge, LoaderCircle, Sparkles, Target,
  TrendingUp, WandSparkles, CheckCircle2, ChevronRight, Copy
} from 'lucide-react';

import api from '../services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCompanyName(company) {
  if (!company) return 'Unknown Company';
  if (typeof company === 'string') return company;
  return company.name || company.website || 'Unknown Company';
}

function scoreStyles(score) {
  if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (score >= 60) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (score >= 40) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
}

function copyToClipboard(value, label) {
  navigator.clipboard.writeText(value);
  toast.success(`${label} copied to clipboard`, { icon: '📋' });
}

// ── Framer Motion Variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const expandVariants = {
  hidden: { opacity: 0, height: 0, marginTop: 0 },
  show: { opacity: 1, height: 'auto', marginTop: 24, transition: { duration: 0.3 } },
  exit: { opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.2 } }
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AIStudio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialJobIdFromQuery] = useState(() => searchParams.get('jobId') || '');
  const [initialApplicationIdFromQuery] = useState(() => searchParams.get('applicationId') || '');
  const [resumes, setResumes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState(initialJobIdFromQuery);
  const [applicationId, setApplicationId] = useState(initialApplicationIdFromQuery);
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeVariant, setResumeVariant] = useState('general');

  const [analysis, setAnalysis] = useState(null);
  const [optimizedResume, setOptimizedResume] = useState(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [skillGap, setSkillGap] = useState(null);

  const [runningAction, setRunningAction] = useState('');

  const applyJobSelection = (jobMatch) => {
    if (!jobMatch?.jobId) {
      setSelectedJobId('');
      setApplicationId('');
      return;
    }
    setSelectedJobId(jobMatch.jobId._id || '');
    setApplicationId(jobMatch._id || '');
    setJobTitle(jobMatch.jobId?.title || '');
    setCompanyName(getCompanyName(jobMatch.jobId?.company));
    setJobDescription(jobMatch.jobId?.description || '');
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [{ data: resumeData }, { data: jobData }] = await Promise.all([
          api.get('/resumes'),
          api.get('/jobs/recommendations'),
        ]);

        const safeResumes = Array.isArray(resumeData) ? resumeData : [];
        const safeJobs = Array.isArray(jobData) ? jobData.filter((item) => item?.jobId) : [];

        setResumes(safeResumes);
        setJobs(safeJobs);

        const initialResumeId = safeResumes[0]?._id || '';
        setSelectedResumeId((current) => current || initialResumeId);

        if (!initialJobIdFromQuery && safeJobs[0]?.jobId?._id) {
          applyJobSelection(safeJobs[0]);
        }
      } catch {
        toast.error('Failed to load AI studio data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [initialJobIdFromQuery]);

  const selectedResume = useMemo(() => resumes.find((r) => r._id === selectedResumeId) || null, [resumes, selectedResumeId]);
  const selectedApplication = useMemo(() => jobs.find((item) => item.jobId?._id === selectedJobId) || null, [jobs, selectedJobId]);

  useEffect(() => {
    const nextParams = {};
    if (selectedJobId) nextParams.jobId = selectedJobId;
    if (applicationId) nextParams.applicationId = applicationId;
    setSearchParams(nextParams, { replace: true });
  }, [selectedJobId, applicationId, setSearchParams]);

  const hasResume = Boolean(selectedResumeId);
  const hasJobContext = Boolean(selectedJobId || jobDescription.trim());

  const withAction = async (actionName, task) => {
    setRunningAction(actionName);
    try {
      await task();
    } catch (error) {
      toast.error(error.response?.data?.error || 'AI action failed');
    } finally {
      setRunningAction('');
    }
  };

  const handleAnalyzeJob = () => withAction('analysis', async () => {
    if (!hasResume || !hasJobContext) { toast.error('Choose a resume and job description first'); return; }
    const { data } = await api.post('/ai/job-analysis', {
      resumeId: selectedResumeId,
      jobId: selectedJobId || undefined,
      applicationId: applicationId || undefined,
      job_title: jobTitle,
      company_name: companyName,
      job_description: jobDescription,
    });
    setAnalysis(data);
    toast.success('Job analysis ready');
  });

  const handleOptimizeResume = () => withAction('optimize', async () => {
    if (!hasResume || !jobDescription.trim()) { toast.error('Add a job description before optimizing'); return; }
    const { data } = await api.post('/ai/optimize-resume', {
      resumeId: selectedResumeId,
      jobId: selectedJobId || undefined,
      job_description: jobDescription,
      target_variant: resumeVariant,
    });
    setOptimizedResume(data);
    toast.success('Resume optimized');
  });

  const handleGenerateCoverLetter = () => withAction('cover-letter', async () => {
    if (!hasResume || !jobDescription.trim()) { toast.error('Add a resume and job description first'); return; }
    const { data } = await api.post('/ai/cover-letter', {
      resumeId: selectedResumeId,
      jobId: selectedJobId || undefined,
      applicationId: applicationId || undefined,
      job_title: jobTitle,
      company_name: companyName,
      job_description: jobDescription,
    });
    setCoverLetter(data.cover_letter || '');
    toast.success('Cover letter generated');
  });

  const handleSkillGap = () => withAction('skill-gap', async () => {
    if (!hasResume) { toast.error('Select a resume first'); return; }
    const jobIds = jobs.map((item) => item.jobId?._id).filter(Boolean).slice(0, 12);
    const payload = jobIds.length
      ? { resumeId: selectedResumeId, jobIds }
      : { resumeId: selectedResumeId, job_descriptions: [jobDescription].filter(Boolean) };

    if (!payload.jobIds && !payload.job_descriptions.length) {
      toast.error('Need matched jobs or a pasted job description');
      return;
    }
    const { data } = await api.post('/skills/gap', payload);
    setSkillGap(data);
    toast.success('Skill gap map generated');
  });

  // ── Loading State ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col min-h-[60vh] items-center justify-center rounded-2xl bg-zinc-900/50 border border-zinc-800 text-zinc-400">
        <LoaderCircle className="h-8 w-8 animate-spin mb-4 text-indigo-500" />
        <p className="font-medium animate-pulse">Initializing AI Studio Environment...</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 max-w-7xl mx-auto">
      
      {/* ── Hero Banner ── */}
      <motion.section variants={itemVariants} className="relative overflow-hidden rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-2xl shadow-indigo-500/5">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative grid gap-8 px-8 py-10 md:px-12 md:py-12 lg:grid-cols-[1.5fr_1fr] items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-indigo-300">
              <BrainCircuit className="h-4 w-4" /> Operations Center
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl leading-tight">
              Turn raw data into a <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">precision payload.</span>
            </h1>
            <p className="max-w-xl text-zinc-400 text-sm md:text-base leading-relaxed">
              Analyze market fit, rewrite constraints for ATS algorithms, generate tailored communication, and map your technical deficiencies from a single terminal.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={handleAnalyzeJob}
                disabled={runningAction !== ''}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
              >
                {runningAction === 'analysis' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                Execute Match Analysis
              </button>
              <button
                onClick={handleSkillGap}
                disabled={runningAction !== ''}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 px-6 py-3 text-sm font-bold text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {runningAction === 'skill-gap' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                Run Global Skill Scan
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { label: 'Baseline Resumes', value: resumes.length, color: 'text-indigo-400' },
              { label: 'Active Targets', value: jobs.length, color: 'text-cyan-400' },
              { label: 'Execution Modules', value: '4 Modules', color: 'text-purple-400' },
            ].map((stat, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950/50 backdrop-blur-sm">
                <span className="text-sm font-semibold text-zinc-400">{stat.label}</span>
                <span className={`text-xl font-black ${stat.color}`}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── Configuration Board ── */}
      <motion.section variants={itemVariants} className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl bg-zinc-900/80 p-6 shadow-xl border border-zinc-800 flex flex-col">
          <div className="flex items-center gap-3 mb-6 border-b border-zinc-800 pb-4">
            <div className="rounded-lg bg-zinc-800 p-2.5 text-indigo-400 border border-zinc-700">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Target Configuration</h2>
              <p className="text-xs text-zinc-400 mt-1">Define the source material and target parameters.</p>
            </div>
          </div>

          <div className="space-y-5 flex-1">
            <div className="grid md:grid-cols-2 gap-5">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Source Profile (Resume)</span>
                <select
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 custom-scrollbar"
                >
                  {resumes.map((r) => <option key={r._id} value={r._id}>{r.title}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Database Shortcut</span>
                <select
                  value={selectedJobId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const nextApp = jobs.find((item) => item.jobId?._id === nextId);
                    if (nextApp) return applyJobSelection(nextApp);
                    setSelectedJobId(''); setApplicationId('');
                  }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 custom-scrollbar"
                >
                  <option value="">Manual Entry (No DB Link)</option>
                  {jobs.map((job) => (
                    <option key={job._id} value={job.jobId?._id || ''}>
                      {job.jobId?.title} @ {getCompanyName(job.jobId?.company)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Role Designation</span>
                <input
                  value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Target Entity</span>
                <input
                  value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Job Description (Raw Text)</span>
              <textarea
                value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}
                rows={8}
                placeholder="Paste the full JD constraints here to allow the AI to map keywords..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-sm text-zinc-300 leading-relaxed outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 custom-scrollbar resize-none"
              />
            </label>
          </div>
        </div>

        {/* ── Action Center & Quick Stats ── */}
        <div className="space-y-6 flex flex-col">
          <div className="rounded-2xl bg-zinc-900/80 p-6 shadow-xl border border-zinc-800">
            <h2 className="text-xl font-bold text-white mb-6">Execution Modules</h2>
            
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <button
                  onClick={handleAnalyzeJob} disabled={runningAction !== ''}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 p-4 text-sm font-bold text-indigo-400 transition hover:bg-indigo-500/20 disabled:opacity-50"
                >
                  {runningAction === 'analysis' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Gauge className="h-5 w-5" />}
                  Assess Fit
                </button>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleOptimizeResume} disabled={runningAction !== ''}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 p-4 text-sm font-bold text-cyan-400 transition hover:bg-cyan-500/20 disabled:opacity-50"
                >
                  {runningAction === 'optimize' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <WandSparkles className="h-5 w-5" />}
                  Optimize Resume
                </button>
                <select
                  value={resumeVariant} onChange={(e) => setResumeVariant(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-400 outline-none text-center"
                >
                  <option value="general">General Format</option>
                  <option value="startup">Startup Fit</option>
                  <option value="mnc">MNC Standard</option>
                  <option value="ml-focused">ML/AI Tailored</option>
                </select>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleGenerateCoverLetter} disabled={runningAction !== ''}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-xl bg-purple-500/10 border border-purple-500/30 p-4 text-sm font-bold text-purple-400 transition hover:bg-purple-500/20 disabled:opacity-50"
                >
                  {runningAction === 'cover-letter' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                  Draft Letter
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 flex-1">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 flex flex-col">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Active Profile
              </p>
              {selectedResume ? (
                <div>
                  <p className="text-sm font-bold text-zinc-200 truncate" title={selectedResume.title}>{selectedResume.title}</p>
                  <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                    Data nodes: {selectedResume.parsedData?.skills?.length || 0} skills, {selectedResume.parsedData?.experience?.length || 0} roles.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-600 mt-auto">Upload a resume to activate workflows.</p>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 flex flex-col">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 mb-3">
                <Target className="w-3 h-3 text-cyan-500" /> Job Context
              </p>
              {selectedApplication ? (
                <div>
                  <p className="text-sm font-bold text-zinc-200 truncate" title={selectedApplication.jobId?.title}>
                    {selectedApplication.jobId?.title}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                    System Match: {Math.round(selectedApplication.atsScore || 0)}%. <br/>Status: {selectedApplication.status}.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-600 mt-auto">Context loaded manually.</p>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Output Modules ── */}
      <AnimatePresence>
        {analysis && (
          <motion.section variants={expandVariants} initial="hidden" animate="show" exit="exit" className="rounded-2xl bg-zinc-900/80 p-6 shadow-xl border border-zinc-800 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Gauge className="w-5 h-5 text-indigo-400" /> Intelligence Report
              </h2>
              <div className={`px-3 py-1 rounded-md text-xs font-bold border ${scoreStyles(analysis.match_score)}`}>
                {analysis.match_score}% Viability
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-zinc-950 rounded-xl p-5 border border-zinc-800">
                  <p className="text-xs font-bold uppercase text-zinc-500 mb-2">System Verdict</p>
                  <p className="text-sm font-bold text-zinc-200">{analysis.recommendation}</p>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{analysis.explanation}</p>
                  <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Calculated Interview Probability</span>
                    <span className="text-xs font-bold text-indigo-400">{analysis.interview_probability}</span>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 rounded-xl border border-emerald-500/20 p-4">
                  <p className="text-xs font-bold text-emerald-400 mb-3">Validated Strengths</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(analysis.strengths || []).map(s => (
                      <span key={s} className="px-2 py-1 bg-emerald-500/10 text-emerald-300 text-[10px] font-semibold rounded border border-emerald-500/20">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-orange-500/5 rounded-xl border border-orange-500/20 p-4">
                  <p className="text-xs font-bold text-orange-400 mb-3">Identified Gaps</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(analysis.missing_skills || []).length ? analysis.missing_skills.map(s => (
                      <span key={s} className="px-2 py-1 bg-orange-500/10 text-orange-300 text-[10px] font-semibold rounded border border-orange-500/20">{s}</span>
                    )) : <span className="text-xs text-zinc-500">No critical gaps detected.</span>}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(optimizedResume || coverLetter) && (
          <motion.section variants={expandVariants} initial="hidden" animate="show" exit="exit" className="grid lg:grid-cols-2 gap-6">
            
            {optimizedResume && (
              <div className="rounded-2xl bg-zinc-900/80 p-6 shadow-xl border border-zinc-800 flex flex-col h-[500px]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <WandSparkles className="w-4 h-4 text-cyan-400" /> Compiled Draft
                  </h2>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold border ${scoreStyles(optimizedResume.ats_score)}`}>
                      ATS {optimizedResume.ats_score}%
                    </span>
                    <button onClick={() => copyToClipboard(optimizedResume.optimized_resume_text, 'Resume')} className="p-1.5 bg-zinc-800 text-zinc-400 rounded hover:text-white transition">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly value={optimizedResume.optimized_resume_text}
                  className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 font-mono leading-relaxed outline-none resize-none custom-scrollbar"
                />
              </div>
            )}

            {coverLetter && (
              <div className="rounded-2xl bg-zinc-900/80 p-6 shadow-xl border border-zinc-800 flex flex-col h-[500px]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" /> Generated Letter
                  </h2>
                  <button onClick={() => copyToClipboard(coverLetter, 'Cover Letter')} className="p-1.5 bg-zinc-800 text-zinc-400 rounded hover:text-white transition">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea
                  readOnly value={coverLetter}
                  className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300 leading-relaxed outline-none resize-none custom-scrollbar"
                />
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {skillGap && (
          <motion.section variants={expandVariants} initial="hidden" animate="show" exit="exit" className="rounded-2xl bg-zinc-900/80 p-6 shadow-xl border border-zinc-800">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-emerald-400" /> Global Architecture Gap
            </h2>
            <div className="grid lg:grid-cols-3 gap-6">
              
              <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
                <p className="text-[10px] font-bold uppercase text-zinc-500 mb-3">Critical Missing Nodes</p>
                <div className="flex flex-wrap gap-2">
                  {(skillGap.top_missing_skills || []).map((skill) => (
                    <span key={skill} className="px-2.5 py-1 bg-zinc-800 text-zinc-300 text-xs font-medium rounded border border-zinc-700">{skill}</span>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 mt-4 border-t border-zinc-800 pt-3">
                  Sample size: {skillGap.analyzed_jobs} market roles.
                </p>
              </div>

              <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
                <p className="text-[10px] font-bold uppercase text-zinc-500 mb-3 flex items-center gap-1.5"><FileStack className="w-3 h-3" /> Protocol Path (Courses)</p>
                <ul className="space-y-2 text-xs text-zinc-400">
                  {skillGap.course_recommendations.map((item, i) => (
                    <li key={i} className="flex items-start gap-2"><ChevronRight className="w-3 h-3 mt-0.5 text-emerald-500 flex-shrink-0"/> {item}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
                <p className="text-[10px] font-bold uppercase text-zinc-500 mb-3 flex items-center gap-1.5"><BrainCircuit className="w-3 h-3" /> Application Scenarios</p>
                <ul className="space-y-2 text-xs text-zinc-400">
                  {skillGap.project_ideas.map((item, i) => (
                    <li key={i} className="flex items-start gap-2"><ChevronRight className="w-3 h-3 mt-0.5 text-cyan-500 flex-shrink-0"/> {item}</li>
                  ))}
                </ul>
              </div>

            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Failsafe Warning ── */}
      {!hasResume && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-400 flex items-center justify-center gap-2">
          System requires a base schematic. <Link to="/resume" className="font-bold underline hover:text-amber-300">Upload a resume</Link> to initialize workflows.
        </motion.div>
      )}

    </motion.div>
  );
}