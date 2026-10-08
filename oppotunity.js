const opportunitySchema = new mongoose.Schema({
    title: String,
    slug: { type: String, unique: true },
    banner: String,
    shortDesc: String,
    fullDetails: String,
    type: { type: String, enum: ['workshop', 'webinar', 'internship', 'scholarship', 'event', 'job'] },
    date: Date,
    time: String,
    duration: String,
    mode: { type: String, enum: ['online', 'offline'] },
    location: String, // or meeting link
    eligibility: String,
    isFree: Boolean,
    fees: { type: Number, default: 0 },
    deadline: Date,
    totalSeats: Number,
    filledSeats: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    isFeatured: Boolean
}, { timestamps: true });
module.exports = mongoose.model('Opportunity', opportunitySchema);