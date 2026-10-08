const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
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
// Add this above your app.listen() line
app.get('/', (req, res) => {
    res.status(200).send('News Site API is running...');
});

app.use(cors());
app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
    handleStripeWebhook
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/admin", adminRoutes);
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

// Global error handler for JSON responses
app.use((err, req, res, next) => {
    console.error("Express Error:", err);
    res.status(err.status || 500).json({ 
        message: err.message || "Internal Server Error",
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
});

// Static frontend
app.use(express.static(path.join(__dirname, "../frontend")));
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const PORT = process.env.PORT || 5000;

mongoose
    .connect(process.env.MONGO_URI || "mongodb://localhost:27017/news-site")
    .then(() => {
        console.log("MongoDB connected");
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => console.log(err));