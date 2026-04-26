import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BrainCircuit,
  FileSearch,
  FileStack,
  FileText,
  Gauge,
  LoaderCircle,
  Sparkles,
  Target,
  TrendingUp,
  WandSparkles,
} from 'lucide-react';

import api from '../services/api';

function getCompanyName(company) {
  if (!company) return 'Unknown Company';
  if (typeof company === 'string') return company;
  return company.name || company.website || 'Unknown Company';
}

function scoreStyles(score) {
  if (score >= 80) return 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30';
  if (score >= 60) return 'bg-sky-500/15 text-sky-200 ring-sky-400/30';
  if (score >= 40) return 'bg-amber-500/15 text-amber-100 ring-amber-400/30';
  return 'bg-rose-500/15 text-rose-100 ring-rose-400/30';
}

function copyToClipboard(value, label) {
  navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
}

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

  const selectedResume = useMemo(
    () => resumes.find((resume) => resume._id === selectedResumeId) || null,
    [resumes, selectedResumeId]
  );

  const selectedApplication = useMemo(
    () => jobs.find((item) => item.jobId?._id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

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
    if (!hasResume || !hasJobContext) {
      toast.error('Choose a resume and job description first');
      return;
    }

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
    if (!hasResume || !jobDescription.trim()) {
      toast.error('Add a job description before optimizing');
      return;
    }

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
    if (!hasResume || !jobDescription.trim()) {
      toast.error('Add a resume and job description first');
      return;
    }

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
    if (!hasResume) {
      toast.error('Select a resume first');
      return;
    }

    const jobIds = jobs.map((item) => item.jobId?._id).filter(Boolean).slice(0, 12);
    const payload = jobIds.length
      ? { resumeId: selectedResumeId, jobIds }
      : { resumeId: selectedResumeId, job_descriptions: [jobDescription].filter(Boolean) };

    if (!payload.jobIds && !payload.job_descriptions.length) {
      toast.error('Need matched jobs or a pasted job description for skill gap analysis');
      return;
    }

    const { data } = await api.post('/skills/gap', payload);
    setSkillGap(data);
    toast.success('Skill gap map generated');
  });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-[2rem] bg-slate-950 text-slate-200 shadow-2xl shadow-slate-950/20">
        <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
        Loading AI Studio...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]">
        <div className="grid gap-8 px-6 py-8 md:px-10 md:py-10 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="relative">
            <div className="absolute -left-16 top-0 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="absolute bottom-0 right-8 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="relative space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                <BrainCircuit className="h-4 w-4" />
                AI Studio
              </div>
              <div className="max-w-2xl space-y-3">
                <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                  Turn every resume into a sharper application packet.
                </h1>
                <p className="max-w-xl text-sm leading-7 text-slate-300 md:text-base">
                  Analyze job fit, rewrite for ATS, generate tailored cover letters, and map your missing skills
                  from one workspace.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <button
                  onClick={handleAnalyzeJob}
                  disabled={runningAction !== ''}
                  className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {runningAction === 'analysis' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                  Run job analysis
                </button>
                <button
                  onClick={handleSkillGap}
                  disabled={runningAction !== ''}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {runningAction === 'skill-gap' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                  Find top skill gaps
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            {[
              {
                label: 'Resumes loaded',
                value: resumes.length,
                note: 'Use your best parsed profile as the source of truth.',
                accent: 'from-cyan-500/20 to-sky-500/10',
              },
              {
                label: 'Tracked matches',
                value: jobs.length,
                note: 'Jump from matched jobs into deep analysis instantly.',
                accent: 'from-fuchsia-500/20 to-purple-500/10',
              },
              {
                label: 'AI actions',
                value: '4',
                note: 'Analysis, optimization, cover letters, and skill mapping.',
                accent: 'from-emerald-500/20 to-teal-500/10',
              },
            ].map((card) => (
              <div
                key={card.label}
                className={`rounded-[1.5rem] border border-white/10 bg-gradient-to-br ${card.accent} p-5 backdrop-blur`}
              >
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{card.label}</p>
                <p className="mt-4 text-3xl font-black">{card.value}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{card.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900 p-3 text-cyan-300">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Analysis setup</h2>
              <p className="text-sm text-slate-500">Choose a resume, job target, and how you want the AI to tailor it.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Resume source</span>
              <select
                value={selectedResumeId}
                onChange={(event) => setSelectedResumeId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:bg-white"
              >
                {resumes.map((resume) => (
                  <option key={resume._id} value={resume._id}>
                    {resume.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Matched job shortcut</span>
              <select
                value={selectedJobId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  const nextApp = jobs.find((item) => item.jobId?._id === nextId);
                  if (nextApp) {
                    applyJobSelection(nextApp);
                    return;
                  }

                  setSelectedJobId('');
                  setApplicationId('');
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:bg-white"
              >
                <option value="">Custom job description only</option>
                {jobs.map((job) => (
                  <option key={job._id} value={job.jobId?._id || ''}>
                    {job.jobId?.title} - {getCompanyName(job.jobId?.company)}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Job title</span>
                <input
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder="Backend Engineer"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Company</span>
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Acme Inc."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:bg-white"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Resume variant target</span>
              <select
                value={resumeVariant}
                onChange={(event) => setResumeVariant(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:bg-white"
              >
                <option value="general">General</option>
                <option value="startup">Startup</option>
                <option value="mnc">MNC</option>
                <option value="ml-focused">ML-focused</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Job description</span>
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                rows={12}
                placeholder="Paste the job description here..."
                className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 outline-none transition focus:border-cyan-400 focus:bg-white"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <button
                onClick={handleAnalyzeJob}
                disabled={runningAction !== ''}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {runningAction === 'analysis' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
                Analyze fit
              </button>
              <button
                onClick={handleOptimizeResume}
                disabled={runningAction !== ''}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {runningAction === 'optimize' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                Optimize resume
              </button>
              <button
                onClick={handleGenerateCoverLetter}
                disabled={runningAction !== ''}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {runningAction === 'cover-letter' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate letter
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected resume</p>
                {selectedResume ? (
                  <>
                    <p className="mt-2 text-base font-bold text-slate-900">{selectedResume.title}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {selectedResume.parsedData?.skills?.length || 0} parsed skills,{' '}
                      {selectedResume.parsedData?.experience?.length || 0} experience entries,{' '}
                      {selectedResume.parsedData?.projects?.length || 0} projects.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Upload a resume to activate the AI workflows.</p>
                )}
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected job context</p>
                {selectedApplication ? (
                  <>
                    <p className="mt-2 text-base font-bold text-slate-900">{selectedApplication.jobId?.title}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Current ATS match: {Math.round(selectedApplication.atsScore || 0)}%. Status: {selectedApplication.status}.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Paste a custom description or pick one of your matched jobs.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                  <Gauge className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Match Intelligence</h2>
                  <p className="text-sm text-slate-500">A richer scorecard than the basic ATS percentage.</p>
                </div>
              </div>
              {analysis?.match_score !== undefined && (
                <div className={`rounded-full px-4 py-2 text-sm font-bold ring-1 ${scoreStyles(analysis.match_score)}`}>
                  {analysis.match_score}% match
                </div>
              )}
            </div>

            {analysis ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-[1.5rem] bg-slate-950 p-5 text-slate-100">
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Recommendation</p>
                  <p className="mt-3 text-lg font-bold">{analysis.recommendation}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{analysis.explanation}</p>
                  <p className="mt-4 text-sm font-semibold text-cyan-200">
                    Interview probability: {analysis.interview_probability}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-sm font-bold text-emerald-900">Strengths</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(analysis.strengths || []).map((skill) => (
                        <span key={skill} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-rose-100 bg-rose-50 p-4">
                    <p className="text-sm font-bold text-rose-900">Missing or weak areas</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(analysis.missing_skills || []).length ? (
                        analysis.missing_skills.map((skill) => (
                          <span key={skill} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-rose-700">No major missing skills detected.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                Run an analysis to see strengths, weaknesses, missing skills, and interview probability.
              </div>
            )}
          </div>

          <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-fuchsia-50 p-3 text-fuchsia-700">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Generated assets</h2>
                <p className="text-sm text-slate-500">Reusable outputs for faster applications.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-5">
              <div className="rounded-[1.5rem] border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">Optimized resume draft</p>
                  {optimizedResume?.optimized_resume_text && (
                    <button
                      onClick={() => copyToClipboard(optimizedResume.optimized_resume_text, 'Optimized resume')}
                      className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
                    >
                      Copy
                    </button>
                  )}
                </div>
                {optimizedResume ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${scoreStyles(optimizedResume.ats_score)}`}>
                        ATS {optimizedResume.ats_score}%
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        Variant: {optimizedResume.variant}
                      </span>
                    </div>
                    <textarea
                      readOnly
                      value={optimizedResume.optimized_resume_text}
                      rows={10}
                      className="w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 outline-none"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Generate an ATS-optimized version tailored to a startup, MNC, or ML role.</p>
                )}
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">Tailored cover letter</p>
                  {coverLetter && (
                    <button
                      onClick={() => copyToClipboard(coverLetter, 'Cover letter')}
                      className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
                    >
                      Copy
                    </button>
                  )}
                </div>
                {coverLetter ? (
                  <textarea
                    readOnly
                    value={coverLetter}
                    rows={10}
                    className="w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 outline-none"
                  />
                ) : (
                  <p className="text-sm text-slate-500">Generate a cover letter grounded in your actual resume and target role.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Skill gap radar</h2>
              <p className="text-sm text-slate-500">Use your matched jobs as a live market sample.</p>
            </div>
          </div>

          {skillGap ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
                <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Analyzed jobs</p>
                <p className="mt-2 text-3xl font-black">{skillGap.analyzed_jobs}</p>
                <p className="mt-2 text-sm text-slate-300">The skills below are showing up most often across your selected target set.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {(skillGap.top_missing_skills || []).map((skill) => (
                  <span key={skill} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Run a skill gap analysis to see what the market wants most from your profile.
            </div>
          )}
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <FileStack className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Learning and project plan</h2>
              <p className="text-sm text-slate-500">Turn missing skills into a concrete upskilling path.</p>
            </div>
          </div>

          {skillGap ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Course recommendations</p>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                  {skillGap.course_recommendations.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Project ideas</p>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                  {skillGap.project_ideas.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-sm leading-7 text-slate-500">
              The AI will translate your gaps into practical courses and portfolio projects once you run the market scan.
            </div>
          )}
        </div>
      </section>

      {!hasResume && (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          No parsed resume is available yet. <Link to="/resume" className="font-semibold underline">Upload a resume first</Link> to unlock the AI workflows.
        </div>
      )}
    </div>
  );
}
