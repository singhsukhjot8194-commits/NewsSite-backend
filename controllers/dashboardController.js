const News = require('../models/News');
const Opportunity = require('../models/Opportunity');
const Registration = require('../models/Registration');

const getDashboardStats = async (req, res) => {
  try {
    const [
      totalNews,
      publishedNews,
      draftNews,
      totalOpportunities,
      upcomingOpportunities,
      totalEvents,
      totalRegistrations
    ] = await Promise.all([
      News.countDocuments(),
      News.countDocuments({ status: 'published' }),
      News.countDocuments({ status: 'draft' }),
      Opportunity.countDocuments(),
      Opportunity.countDocuments({ status: 'upcoming' }),
      Opportunity.countDocuments({ type: 'Event' }),
      Registration.countDocuments()
    ]);

    const recentNews = await News.find().sort({ createdAt: -1 }).limit(5);
    const recentRegistrations = await Registration.find().populate('opportunity', 'title').sort({ registeredAt: -1 }).limit(5);

    res.json({
      stats: {
        totalNews,
        publishedNews,
        draftNews,
        totalOpportunities,
        upcomingOpportunities,
        totalEvents,
        totalRegistrations
      },
      totalNews,
      publishedNews,
      draftNews,
      totalOpportunities,
      upcomingOpportunities,
      totalEvents,
      totalRegistrations,
      recentNews,
      recentRegistrations
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getDashboardStats };
