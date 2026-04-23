import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { UploadCloud, File, FileText, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Resume() {
  const [resumes, setResumes] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchResumes();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    
    const formData = new FormData();
    formData.append('resume', file);

    setUploading(true);
    try {
      await api.post('/resumes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Resume uploaded and parsed successfully');
      setFile(null);
      fetchResumes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Resume Management</h1>

      <div className="bg-white p-6 rounded-xl border border-neutral-200">
        <h2 className="text-lg font-bold mb-4">Upload New Resume</h2>
        <form onSubmit={handleUpload} className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files[0])}
              className="block w-full text-sm text-neutral-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
          </div>
          <button
            type="submit"
            disabled={uploading || !file}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Processing...' : <><UploadCloud className="w-5 h-5" /> Upload</>}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <h2 className="text-lg font-bold">Parsed Resumes</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-neutral-500">Loading...</div>
        ) : resumes.length === 0 ? (
          <div className="p-6 text-center text-neutral-500">No resumes uploaded yet.</div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {resumes.map(resume => (
              <div key={resume._id} className="p-6 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <h3 className="font-bold text-neutral-900">{resume.title || 'Untitled Resume'}</h3>
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Parsed
                    </span>
                  </div>
                  <p className="text-sm text-neutral-500">
                    Uploaded on {new Date(resume.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {/* Expandable parsed data could go here */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}