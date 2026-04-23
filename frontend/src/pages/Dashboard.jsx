import React, { useState, useEffect, useContext } from "react";
import { FileText, PlayCircle, Target, Star, BrainCircuit, Activity } from "lucide-react";
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    activeApplications: 0,
    scansToday: 0,
    averageAtsScore: 0,
    latestResume: null,
    recentApplications: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/dashboard/stats');
        setStats(data);
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-8">Loading your AI Placement Dashboard...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">
            Welcome back, {user?.name || 'User'}!
          </h1>
          <p className="text-neutral-500 mt-1">Let's find your next big opportunity.</p>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[ 
            { label: "Active Matches", value: stats.activeApplications, icon: PlayCircle, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Scans Today", value: stats.scansToday, icon: Target, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Average ATS", value: `${stats.averageAtsScore}%`, icon: BrainCircuit, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "AI Engine", value: "Active", icon: Activity, color: "text-amber-600", bg: "bg-amber-50" },
         ].map((stat, i) => (
          <div key={i} className="p-6 bg-white rounded-2xl border border-neutral-100 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
               <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Resume Module */}
        <div className="lg:col-span-1 border border-neutral-200 bg-white rounded-2xl p-6 shadow-sm">
           <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                 <FileText className="w-5 h-5 text-blue-500" /> My Latest Resume
              </h2>
           </div>

           {stats.latestResume ? (
             <div>
                <p className="font-medium text-neutral-800">{stats.latestResume.title}</p>
                <p className="text-sm text-neutral-500 mt-1 mb-4 flex gap-1 items-center">
                  Parsed successfully with {stats.latestResume.parsedData?.skills?.length || 0} skills.
                </p>
                <Link to="/resume" className="text-blue-600 text-sm font-medium hover:underline">
                  Manage Resumes &rarr;
                </Link>
             </div>
           ) : (
             <div className="text-center py-6 text-neutral-500">
                <p className="mb-4">No resume uploaded.</p>
                <Link to="/resume" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Upload Resume
                </Link>
             </div>
           )}
        </div>

        {/* Recent Matches Timeline */}
        <div className="lg:col-span-2 border border-neutral-200 bg-white rounded-2xl p-6 shadow-sm min-h-[300px]">
           <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                 <Star className="w-5 h-5 text-amber-500" /> Recent ATS Matches
              </h2>
           </div>
           
           {stats.recentApplications?.length > 0 ? (
             <div className="space-y-4">
               {stats.recentApplications.map(app => (
                 <div key={app._id} className="flex justify-between items-center border-b border-neutral-100 pb-4 last:border-0">
                    <div>
                      <p className="font-semibold text-neutral-900">{app.jobId?.title || 'Unknown Job'}</p>
                      <p className="text-sm text-neutral-500">{app.jobId?.company || 'Unknown Company'}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${app.atsScore >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {app.atsScore}% Match
                      </span>
                      <p className="text-xs text-neutral-400 mt-1">{new Date(app.createdAt).toLocaleDateString()}</p>
                    </div>
                 </div>
               ))}
               <Link to="/jobs" className="block text-center text-sm font-medium text-blue-600 mt-4 hover:underline">
                 View All Matches &rarr;
               </Link>
             </div>
           ) : (
             <div className="text-center py-10 text-neutral-500">
               <p>No recent AI matches generated yet.</p>
               <Link to="/jobs" className="inline-block mt-4 text-blue-600 hover:underline">Go scrape and match jobs &rarr;</Link>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}