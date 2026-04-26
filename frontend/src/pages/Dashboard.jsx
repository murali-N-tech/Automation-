import React, { useState, useEffect, useContext } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Star,
  BrainCircuit,
  Zap,
  Trophy,
  Clock
} from "lucide-react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { Link } from "react-router-dom";

function getCompanyDisplayName(company) {
  if (!company) return "Unknown Company";
  if (typeof company === "string") return company;
  if (typeof company === "object")
    return company.name || company.website || "Unknown Company";
  return "Unknown Company";
}

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
        const { data } = await api.get("/dashboard/stats");
        setStats(data);
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // 🔥 AI Insights (dynamic)
  const aiInsights = {
    readinessScore: stats.averageAtsScore || 75,
    strengths:
      stats.latestResume?.parsedData?.skills?.slice(0, 6) || [],
    missingSkills: ["Docker", "AWS ECS", "Kubernetes"],
    targetRole: "Full Stack Engineer",
    targetSalary: "15 LPA+"
  };

  // 🎬 Animations
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300 }
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-zinc-400">
        Loading your AI dashboard...
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-8 text-white"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* HEADER */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, {user?.name || "User"}
          </h1>
          <p className="text-zinc-400">
            AI-driven career intelligence dashboard
          </p>
        </div>

        <div className="flex items-center gap-2 bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-500/20 text-sm">
          <Zap className="w-4 h-4 text-indigo-400" />
          Target: {aiInsights.targetSalary}
        </div>
      </motion.div>

      {/* KPI CARDS */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          {
            label: "Applications",
            value: stats.activeApplications,
            icon: Zap
          },
          {
            label: "ATS Score",
            value: `${stats.averageAtsScore}%`,
            icon: Trophy
          },
          {
            label: "Interviews",
            value: stats.recentApplications?.length || 0,
            icon: Clock
          },
          {
            label: "AI Engine",
            value: "Active",
            icon: BrainCircuit
          }
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl flex justify-between"
            >
              <div>
                <p className="text-zinc-500 text-sm">
                  {item.label}
                </p>
                <p className="text-2xl font-bold mt-2">
                  {item.value}
                </p>
              </div>
              <Icon className="w-6 h-6 text-indigo-400" />
            </div>
          );
        })}
      </motion.div>

      {/* MAIN GRID */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* RESUME CARD */}
        <motion.div
          variants={itemVariants}
          className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl"
        >
          <h2 className="font-semibold flex gap-2 items-center mb-4">
            <FileText className="w-5 h-5 text-blue-400" />
            Latest Resume
          </h2>

          {stats.latestResume ? (
            <>
              <p className="font-medium">
                {stats.latestResume.title}
              </p>
              <p className="text-sm text-zinc-400 mt-1">
                {stats.latestResume.parsedData?.skills?.length || 0} skills detected
              </p>

              <Link
                to="/resume"
                className="text-indigo-400 text-sm mt-3 inline-block"
              >
                Manage Resume →
              </Link>
            </>
          ) : (
            <div>
              <p className="text-zinc-500 mb-3">
                No resume uploaded
              </p>
              <Link
                to="/resume"
                className="bg-indigo-600 px-4 py-2 rounded-lg text-sm hover:bg-indigo-500"
              >
                Upload Resume
              </Link>
            </div>
          )}
        </motion.div>

        {/* RECENT MATCHES */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 bg-zinc-900 border border-zinc-800 p-6 rounded-xl"
        >
          <h2 className="font-semibold flex gap-2 items-center mb-4">
            <Star className="w-5 h-5 text-yellow-400" />
            Recent Matches
          </h2>

          {stats.recentApplications?.length > 0 ? (
            <div className="space-y-3">
              {stats.recentApplications.map((app) => (
                <div
                  key={app._id}
                  className="flex justify-between border-b border-zinc-800 pb-3"
                >
                  <div>
                    <p className="font-medium">
                      {app.jobId?.title || "Unknown Job"}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {getCompanyDisplayName(app.jobId?.company)}
                    </p>
                  </div>

                  <span className="text-indigo-400 font-bold">
                    {app.atsScore}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500">
              No matches generated yet
            </p>
          )}
        </motion.div>
      </div>

      {/* AI INSIGHTS */}
      <motion.div
        variants={itemVariants}
        className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl"
      >
        <h2 className="flex items-center gap-2 font-semibold mb-4">
          <Trophy className="w-5 h-5 text-indigo-400" />
          AI Recommendations
        </h2>

        <p className="text-sm text-zinc-400 mb-4">
          Improve your chances for {aiInsights.targetRole}
        </p>

        <div className="space-y-3">
          {aiInsights.missingSkills.map((skill, i) => (
            <div
              key={i}
              className="bg-zinc-950 p-4 rounded-lg border border-zinc-800"
            >
              <p className="font-medium">Learn {skill}</p>
              <p className="text-xs text-zinc-400">
                High demand for {aiInsights.targetSalary}
              </p>

              <button className="text-indigo-400 text-xs mt-2 hover:text-indigo-300">
                Generate Learning Path →
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}