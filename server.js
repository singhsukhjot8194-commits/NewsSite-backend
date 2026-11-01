const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
require("./utils/jwtSecret")();

const adminRoutes = require("./routes/adminRoutes");
const newsRoutes = require("./routes/newsRoutes");
const opportunityRoutes = require("./routes/opportunityRoutes");
const registrationRoutes = require("./routes/registrationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const { handleStripeWebhook } = require("./controllers/paymentController");

const app = express();

// Trust proxy (behind Render/NGINX)
app.set("trust proxy", 1);

// Stripe webhook (raw body, MUST be placed before express.json body parser)
app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
    handleStripeWebhook
);

// Security headers via helmet
app.use(helmet());
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            blockAllMixedContent: [],
            fontSrc: ["'self'", "https:", "data:"],
            frameAncestors: ["'self'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            objectSrc: ["'none'"],
            scriptSrc: [
                "'self'",
                "https://cdnjs.cloudflare.com",
                "https://kit.fontawesome.com",
                "'unsafe-inline'",
            ],
            scriptSrcAttr: ["'none'"],
            styleSrc: ["'self'", "https:", "'unsafe-inline'"],
            upgradeInsecureRequests: [],
        },
    })
);
app.use(helmet.referrerPolicy({ policy: "strict-origin-when-cross-origin" }));
app.use((req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
});

// CORS restricted to known origins
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5000,http://127.0.0.1:5500,https://theafricadiplomat.vercel.app")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
app.use(
    cors({
        origin: (origin, cb) => {
            if (!origin) return cb(null, true);
            if (allowedOrigins.includes(origin)) return cb(null, true);
            return cb(new Error("Not allowed by CORS"), false);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// Body parsing limits
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// NoSQL injection protection is handled at the controller layer via field whitelists
// and escapeRegExp for query building (Express 5 makes req.query read-only).

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

// Strict auth rate limiter (applied inside route files too)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts, please try again later." },
});

// Health
app.get("/", (req, res) => {
    res.status(200).send("News Site API is running...");
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/admin", authLimiter, adminRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/opportunities", opportunityRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payments", paymentRoutes);

// Admin panel
app.get(/^\/admin$/, (req, res) => res.redirect(308, "/admin/"));
app.use("/admin", express.static(path.join(__dirname, "../frontend/admin"), {
    index: "login.html"
}));

// Static frontend
app.use(express.static(path.join(__dirname, "../frontend"), { extensions: ["html"] }));
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Generic error handler (no internal leakage)
app.use((err, req, res, next) => {
    console.error("Express Error:", err.message);
    res.status(err.status || 500).json({
        message: err.status ? err.message : "Internal Server Error",
    });
});

const PORT = process.env.PORT || 5000;

mongoose
    .connect(process.env.MONGO_URI || "mongodb://localhost:27017/news-site")
    .then(() => {
        console.log("MongoDB connected");
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => console.log(err));
