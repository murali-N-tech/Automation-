const Application = require('../models/Application');
const Job = require('../models/Job');
const Resume = require('../models/Resume');

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const activeApplicationsCount = await Application.countDocuments({
      userId,
      status: { $in: ['Applied', 'Interviewing', 'Saved'] }
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const scansToday = await Application.countDocuments({
      userId,
      createdAt: { $gte: startOfToday }
    });

    const statsAgg = await Application.aggregate([
      // Must cast string to ObjectId if req.user.id is a string; assuming Mongoose handles it or we match exact
      { $match: { atsScore: { $exists: true, $ne: null } } },
      { $group: { _id: null, avgScore: { $avg: "$atsScore" } } }
    ]);
    const averageAtsScore = statsAgg.length > 0 ? Math.round(statsAgg[0].avgScore) : 0;

    // Fetch the latest resume to show on the dashboard
    const latestResume = await Resume.findOne({ userId }).sort({ createdAt: -1 });

    // Fetch recent applications for the activity feed
    const recentApplications = await Application.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('jobId', 'title company location');

    res.json({
      activeApplications: activeApplicationsCount,
      scansToday: scansToday,
      averageAtsScore: averageAtsScore,
      latestResume: latestResume || null,
      recentApplications: recentApplications
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};
