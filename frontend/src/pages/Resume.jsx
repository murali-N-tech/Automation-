import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  UploadCloud,
  Trash2,
  Edit2,
  FileText,
  CheckCircle,
  BarChart3
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Resume() {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

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
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

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
    if (!window.confirm('Delete this resume?')) return;

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

    return score;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Resume Management</h1>
        <p className="text-neutral-500 mt-2">
          Upload your resume to let AI match you with jobs.
        </p>
      </div>

      {/* UPLOAD */}
      <div className="bg-white p-8 rounded-2xl border border-neutral-200 border-dashed text-center">
        <UploadCloud className="w-12 h-12 text-blue-500 mx-auto mb-4" />

        <h3 className="text-lg font-semibold text-neutral-800">
          Upload New Resume
        </h3>

        <p className="text-sm text-neutral-500 mb-6">
          PDF files up to 5MB supported
        </p>

        <label className={`cursor-pointer inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? 'Processing AI...' : 'Browse Files'}

          <input
            type="file"
            className="hidden"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {/* LIST */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-5 h-5" /> Your Resumes
        </h2>

        {loading ? (
          <p>Loading...</p>
        ) : resumes.length === 0 ? (
          <div className="p-6 text-center text-neutral-500 border rounded-xl">
            No resumes uploaded yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {resumes.map(resume => {
              const score = calculateBaseAtsScore(resume.parsedData);
              const isEditing = editingId === resume._id;

              return (
                <div key={resume._id} className="flex flex-col md:flex-row items-center justify-between p-5 border rounded-xl shadow-sm hover:shadow-md transition gap-4">

                  {/* INFO */}
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-7 h-7 text-blue-500" />

                      {isEditing ? (
                        <>
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="border px-2 py-1 rounded"
                          />
                          <button onClick={() => handleSaveEdit(resume._id)}>Save</button>
                        </>
                      ) : (
                        <h3 className="font-bold">{resume.title}</h3>
                      )}
                    </div>

                    <p className="text-xs text-neutral-500">
                      Added {new Date(resume.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* SCORE */}
                  <div className="flex items-center gap-3">
                    <BarChart3 className={score >= 70 ? 'text-green-500' : 'text-yellow-500'} />
                    <span className="font-bold">{score}/100</span>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex gap-2">
                    <button onClick={() => {
                      setEditingId(resume._id);
                      setEditTitle(resume.title);
                    }}>
                      <Edit2 />
                    </button>

                    <button onClick={() => handleDelete(resume._id)}>
                      <Trash2 />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}