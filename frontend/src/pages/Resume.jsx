import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import {
  UploadCloud, Trash2, Edit2, FileText, Cpu,
  BarChart3, Check, X, Clock, BrainCircuit, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Framer Motion Variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
};

export default function Resume() {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      const { data } = await api.get('/resumes');
      setResumes(data);
    } catch (err) {
      toast.error('Failed to load resumes');
    } finally {
      setLoading(false);
    }
  };

  // ================= UPLOAD =================
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file) => {
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF format is supported.');
      return;
    }

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('title', file.name);

    setUploading(true);
    const toastId = toast.loading('🤖 AI is extracting resume data...');

    try {
      await api.post('/resumes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Resume uploaded & parsed successfully!', { id: toastId });
      fetchResumes();
    } catch (err) {
      toast.error('Upload failed', { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  // ================= DELETE =================
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this resume profile? This cannot be undone.')) return;

    try {
      await api.delete(`/resumes/${id}`);
      toast.success('Resume deleted');
      setResumes(resumes.filter(r => r._id !== id));
    } catch {
      toast.error('Delete failed');
    }
  };

  // ================= EDIT =================
  const handleSaveEdit = async (id) => {
    if (!editTitle.trim()) return;
    try {
      await api.put(`/resumes/${id}`, { title: editTitle });

      toast.success('Title updated');
      setResumes(resumes.map(r =>
        r._id === id ? { ...r, title: editTitle } : r
      ));
      setEditingId(null);
    } catch {
      toast.error('Update failed');
    }
  };

  // ================= ATS SCORE =================
  const calculateBaseAtsScore = (parsedData) => {
    if (!parsedData) return 0;
    let score = 20;
    if (parsedData.skills?.length > 5) score += 30;
    if (parsedData.experience?.length > 0) score += 30;
    if (parsedData.education?.length > 0) score += 20;
    return score > 100 ? 100 : score;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto space-y-8">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Identity Management</h1>
          <p className="text-zinc-400 mt-2">
            Upload your resumes. Our AI neural network will extract, normalize, and score them for automation.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-300 px-4 py-2 rounded-full border border-indigo-500/20 text-sm font-medium">
          <BrainCircuit className="w-4 h-4" />
          {resumes.length} Active Profiles
        </div>
      </div>

      {/* DRAG & DROP UPLOAD ZONE */}
      <div 
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative overflow-hidden flex flex-col items-center justify-center w-full h-64 rounded-2xl border-2 border-dashed transition-all ${!uploading && 'cursor-pointer'} bg-zinc-900/50 ${
          dragActive 
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' 
            : 'border-zinc-700 hover:border-indigo-500/50 hover:bg-zinc-800/80'
        }`}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          className="hidden" 
          accept=".pdf"
          onChange={handleFileUpload}
          disabled={uploading}
        />
        
        {uploading ? (
          <div className="flex flex-col items-center text-indigo-400 z-10">
            <Cpu className="w-12 h-12 mb-4 animate-pulse" />
            <h3 className="text-xl font-bold text-white mb-2">Neural Parsing Active</h3>
            <p className="text-sm text-indigo-300/80">Extracting skills, experience, and formatting data...</p>
            {/* AI scanning line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-zinc-400 z-10 pointer-events-none">
            <div className={`w-16 h-16 mb-4 rounded-full bg-zinc-800 flex items-center justify-center border transition-colors ${dragActive ? 'border-indigo-500 text-indigo-400' : 'border-zinc-700 text-zinc-500'}`}>
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-zinc-200 mb-1">Initialize New Resume</h3>
            <p className="text-sm text-zinc-500 mb-4">Drag and drop your PDF here, or click to browse</p>
            <span className="text-xs font-semibold px-3 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              PDF strictly up to 5MB
            </span>
          </div>
        )}
      </div>

      {/* LIST SECTION */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-2">
          <FileText className="w-5 h-5 text-indigo-400" /> System Repository
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Cpu className="w-8 h-8 text-zinc-600 animate-spin" />
          </div>
        ) : resumes.length === 0 ? (
          <div className="p-12 text-center bg-zinc-900/30 border border-zinc-800 border-dashed rounded-xl flex flex-col items-center">
            <AlertCircle className="w-10 h-10 text-zinc-600 mb-3" />
            <h3 className="text-zinc-300 font-medium">Repository Empty</h3>
            <p className="text-zinc-500 text-sm mt-1">Upload a baseline resume above to begin automation.</p>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid gap-4">
            <AnimatePresence>
              {resumes.map(resume => {
                const score = calculateBaseAtsScore(resume.parsedData);
                const isEditing = editingId === resume._id;
                const isHighAts = score >= 70;

                return (
                  <motion.div 
                    variants={cardVariants}
                    key={resume._id} 
                    layout
                    className="flex flex-col md:flex-row items-center justify-between p-5 bg-zinc-900/80 border border-zinc-800 rounded-xl shadow-lg hover:border-zinc-700 transition gap-6 group relative overflow-hidden"
                  >
                    {/* Subtle Gradient background on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                    {/* INFO BLOCK */}
                    <div className="flex-1 w-full relative z-10">
                      <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-6 h-6 text-indigo-400" />
                        </div>

                        <div className="flex-1">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="bg-zinc-950 border border-indigo-500/50 text-white text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full max-w-xs"
                                placeholder="Resume Title..."
                              />
                              <button onClick={() => handleSaveEdit(resume._id)} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingId(null)} className="p-1.5 bg-rose-500/20 text-rose-400 rounded hover:bg-rose-500/30 transition">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <h3 className="font-bold text-lg text-zinc-100 truncate pr-4" title={resume.title}>
                              {resume.title}
                            </h3>
                          )}
                          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            Ingested on {new Date(resume.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* METRICS & ACTIONS */}
                    <div className="flex items-center gap-8 w-full md:w-auto relative z-10 justify-between md:justify-end">
                      
                      {/* Circular ATS Gauge */}
                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">ATS Score</p>
                          <p className={`text-sm font-bold ${isHighAts ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {isHighAts ? 'Optimized' : 'Needs Work'}
                          </p>
                        </div>
                        <div className="relative w-12 h-12 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-800" />
                            <circle 
                              cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" 
                              strokeDasharray="125.6" strokeDashoffset={125.6 - (125.6 * score) / 100}
                              className={`${isHighAts ? 'text-emerald-500' : 'text-amber-500'} transition-all duration-1000 ease-out`} 
                            />
                          </svg>
                          <span className="absolute text-xs font-bold text-white">{score}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingId(resume._id);
                            setEditTitle(resume.title);
                          }}
                          className="p-2 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg hover:text-white hover:border-zinc-500 transition-colors"
                          title="Rename File"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(resume._id)}
                          className="p-2 bg-zinc-800 text-rose-400 border border-zinc-700 rounded-lg hover:bg-rose-500/10 hover:border-rose-500/30 transition-colors"
                          title="Delete Resume"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Required style for scanning animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(256px); opacity: 0; }
        }
      `}} />
    </motion.div>
  );
}