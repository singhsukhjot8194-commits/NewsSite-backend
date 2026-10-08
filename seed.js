const mongoose = require('mongoose');
require('dotenv').config();

const Admin = require('./models/Admin');
const News = require('./models/News');
const Opportunity = require('./models/Opportunity');
const slugify = require('./utils/slugify');

const seedNews = async () => {
  const newsArticles = [
    {
      title: 'Global Tech Summit 2026 Highlights Innovations',
      category: 'Technology',
      content: '<p>The Global Tech Summit brought together industry leaders to showcase groundbreaking AI and blockchain technologies. Over 500 startups participated...</p>',
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1000',
      tags: ['Tech', 'AI', 'Innovation'],
      isBreaking: true,
      isFeatured: true,
      status: 'published',
      views: 1240,
    },
    {
      title: 'New Climate Policy Aims to Reduce Emissions by 40%',
      category: 'Environment',
      content: '<p>In a historic move, the international coalition announced a sweeping new policy targeted at reducing carbon emissions globally by the end of the decade.</p>',
      image: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&q=80&w=1000',
      tags: ['Environment', 'Policy', 'Climate'],
      isBreaking: false,
      isFeatured: true,
      status: 'published',
      views: 856,
    },
    {
      title: 'Stock Markets Reach All-Time Highs Amid Tech Boom',
      category: 'Finance',
      content: '<p>Major indices surged to record levels today as tech giants released their quarterly earnings reports, smashing expectations across the board.</p>',
      image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1000',
      tags: ['Finance', 'Stocks', 'Economy'],
      isBreaking: false,
      isFeatured: false,
      status: 'published',
      views: 2030,
    },
  ];

  return Promise.all(
    newsArticles.map((article) => {
      const item = { ...article, slug: slugify(article.title) };
      return News.create(item);
    })
  );
};

const seedOpportunities = async () => {
  const opportunities = [
    {
      title: 'Advanced Web Development Bootcamp',
      shortDesc: 'Master full-stack development with modern frameworks like React and Node.js.',
      fullDetails: 'This 12-week bootcamp covers everything from HTML/CSS to advanced backend architecture. Students will build 5 production-ready projects.',
      type: 'Class',
      date: new Date('2026-11-01'),
      time: '10:00 AM - 02:00 PM',
      duration: '12 Weeks',
      mode: 'Hybrid',
      location: 'Tech Hub Center, San Francisco & Online',
      eligibility: 'Basic programming knowledge required.',
      isFree: false,
      fees: 499,
      deadline: new Date('2026-10-25'),
      totalSeats: 50,
      filledSeats: 12,
      status: 'published',
      isFeatured: true,
      banner: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=1000',
    },
    {
      title: 'Global Youth Leadership Summit 2026',
      shortDesc: 'A fully-funded summit for young leaders worldwide to discuss global challenges.',
      fullDetails: 'Join 200 selected youth leaders for a fully-funded week in Geneva. Network with diplomats, participate in policy workshops, and pitch your social initiatives.',
      type: 'Opportunity',
      date: new Date('2027-01-15'),
      mode: 'Offline',
      location: 'Geneva, Switzerland',
      eligibility: 'Youth aged 18-25 with a track record of community service.',
      isFree: true,
      fees: 0,
      deadline: new Date('2026-11-30'),
      totalSeats: 200,
      filledSeats: 85,
      status: 'published',
      isFeatured: true,
      banner: 'https://images.unsplash.com/photo-1542621323-22165f14e4b5?auto=format&fit=crop&q=80&w=1000',
    },
    {
      title: 'AI Product Management Workshop',
      shortDesc: 'Learn how to manage and ship AI-powered products effectively.',
      fullDetails: 'A 2-day intensive workshop for product managers looking to transition into AI. Learn about model evaluation, data pipelines, and AI product lifecycles.',
      type: 'Class',
      date: new Date('2026-10-20'),
      time: '09:00 AM - 05:00 PM',
      duration: '2 Days',
      mode: 'Online',
      eligibility: 'Open to everyone. PM experience recommended.',
      isFree: true,
      fees: 0,
      deadline: new Date('2026-10-18'),
      totalSeats: 500,
      filledSeats: 412,
      status: 'published',
      isFeatured: false,
      banner: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&q=80&w=1000',
    },
    {
      title: 'Support Our Journalism',
      shortDesc: 'Make a one-time donation to support independent journalism in Africa.',
      fullDetails: 'Your contribution helps us keep our reporting independent and accessible to everyone.',
      type: 'Donation',
      mode: 'Online',
      pricingType: 'special',
      isFree: false,
      fees: 10,
      status: 'published',
      isPublished: true,
      isFeatured: false
    },
    {
      title: 'The African Diplomat Subscription',
      shortDesc: 'Subscribe to get exclusive reports and support our work.',
      fullDetails: 'Get access to premium newsletters, exclusive podcast episodes, and early access to events.',
      type: 'Subscription',
      mode: 'Online',
      pricingType: 'subscription',
      isFree: false,
      fees: 25,
      status: 'published',
      isPublished: true,
      isFeatured: false
    }
  ];

  return Promise.all(
    opportunities.map((opportunity) => {
      const item = { ...opportunity, slug: slugify(opportunity.title) };
      return Opportunity.create(item);
    })
  );
};

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/news-site');

    await Admin.deleteMany({});
    await News.deleteMany({});
    await Opportunity.deleteMany({});

    await Admin.create({
      email: 'admin@example.com',
      password: 'password123',
    });

    await seedNews();
    await seedOpportunities();

    console.log('Admin seeded: admin@example.com / password123');
    console.log('Sample News seeded!');
    console.log('Sample Opportunities seeded!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedDatabase();