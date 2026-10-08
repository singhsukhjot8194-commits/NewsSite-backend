const Stripe = require('stripe');
const mongoose = require('mongoose');
const Opportunity = require('../models/Opportunity');
const Registration = require('../models/Registration');

const getStripeClient = () => {
    if (!process.env.STRIPE_SECRET_KEY) {
        const error = new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to the backend environment.');
        error.statusCode = 503;
        throw error;
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const getFrontendUrl = () => (process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 5000}`)
    .replace(/\/+$/, '');

const markSessionPaid = async(session) => {
    const registrationId = session && session.metadata && session.metadata.registrationId;

    if (session.payment_status !== 'paid' || !mongoose.isValidObjectId(registrationId)) {
        return null;
    }

    const registration = await Registration.findOneAndUpdate({
        _id: registrationId,
        stripeCheckoutSessionId: session.id,
        paymentStatus: 'pending'
    }, {
        $set: {
            paymentStatus: 'paid',
            status: 'confirmed',
            amountPaid: (session.amount_total || 0) / 100
        }
    }, { new: true });

    if (registration) {
        await Opportunity.updateOne({ _id: registration.opportunity }, { $inc: { filledSeats: 1 } });
    }
    return registration;
};

const createCheckoutSession = async(req, res) => {
    let registration;
    try {
        const { name, email, phone, opportunityId } = req.body || {};
        if (
            typeof name !== 'string' || !name.trim() ||
            typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            typeof phone !== 'string' || !phone.trim() ||
            !mongoose.isValidObjectId(opportunityId)
        ) {
            return res.status(400).json({ message: 'Enter a valid name, email, phone number, and service.' });
        }

        const opportunity = await Opportunity.findById(opportunityId);
        if (!opportunity ||
            opportunity.isPublished === false ||
            !['published', 'upcoming', 'ongoing'].includes(opportunity.status)
        ) {
            return res.status(404).json({ message: 'This service is not available for registration.' });
        }
        const pricingType = opportunity.pricingType ||
            (opportunity.isFree ? 'free' : 'special');
        if (pricingType === 'free') {
            return res.status(400).json({ message: 'This service is free. Use the free registration form.' });
        }

        const amount = Math.round(Number(opportunity.fees) * 100);
        if (!Number.isSafeInteger(amount) ||
            amount < 50 ||
            amount > 99999999 ||
            Math.round(Number(opportunity.fees) * 100) / 100 !== Number(opportunity.fees)
        ) {
            return res.status(400).json({
                message: 'Set a valid USD price between 0.50 and 999,999.99 in the admin panel.'
            });
        }

        const stripe = getStripeClient();
        registration = await Registration.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            opportunity: opportunity._id,
            status: 'pending',
            paymentStatus: 'pending'
        });

        const frontendUrl = getFrontendUrl();
        const isSubscription = pricingType === 'subscription';

        const session = await stripe.checkout.sessions.create({
            mode: isSubscription ? 'subscription' : 'payment',
            customer_email: registration.email,
            line_items: [{
                price_data: {
                    currency: 'usd',
                    unit_amount: amount,
                    ...(isSubscription ?
                        { recurring: { interval: 'month', interval_count: 3 } } :
                        {}),
                    product_data: {
                        name: opportunity.title,
                        description: isSubscription ?
                            `${opportunity.type} subscription, billed every 3 months` :
                            `${opportunity.type} registration`
                    }
                },
                quantity: 1
            }],
            metadata: {
                registrationId: registration.id,
                opportunityId: opportunity.id,
                pricingType
            },
            success_url: `${frontendUrl}/payment-success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/opportunity-detail.html?slug=${encodeURIComponent(opportunity.id)}&payment=cancelled`
        });

        if (!session.url) {
            throw new Error('Stripe did not return a hosted checkout URL.');
        }
        registration.stripeCheckoutSessionId = session.id;
        await registration.save();
        return res.status(201).json({ url: session.url });
    } catch (error) {
        if (registration && !registration.stripeCheckoutSessionId) {
            await registration.deleteOne();
        }
        console.error('Unable to create Stripe Checkout session:', error);
        return res.status(error.statusCode || 500).json({
            message: error.statusCode ? error.message : 'Unable to start checkout. Please try again.'
        });
    }
};

const getCheckoutStatus = async(req, res) => {
    try {
        const registration = await Registration.findOne({
            stripeCheckoutSessionId: req.params.sessionId
        });
        if (!registration) return res.status(404).json({ message: 'Checkout session not found.' });

        if (registration.paymentStatus === 'pending') {
            const session = await getStripeClient().checkout.sessions.retrieve(req.params.sessionId);
            const sessionRegId = session && session.metadata && session.metadata.registrationId;

            if (sessionRegId !== registration.id) {
                return res.status(404).json({ message: 'Checkout session not found.' });
            }
            await markSessionPaid(session);
            const refreshedRegistration = await Registration.findById(registration.id);
            if (!refreshedRegistration) {
                return res.status(404).json({ message: 'Registration not found.' });
            }
            registration.paymentStatus = refreshedRegistration.paymentStatus;
        }

        return res.json({ paymentStatus: registration.paymentStatus });
    } catch (error) {
        console.error('Unable to verify Stripe Checkout session:', error);
        return res.status(error.statusCode || 500).json({
            message: error.statusCode ? error.message : 'Unable to verify payment status.'
        });
    }
};

const handleStripeWebhook = async(req, res) => {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(503).json({ message: 'Stripe keys and webhook signing secret must be configured.' });
    }

    let event;
    try {
        event = getStripeClient().webhooks.constructEvent(
            req.body,
            req.headers['stripe-signature'],
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        console.error('Stripe webhook signature verification failed:', error.message);
        return res.status(400).json({ message: 'Invalid Stripe webhook signature.' });
    }

    try {
        if (event.type === 'checkout.session.completed') {
            await markSessionPaid(event.data.object);
        } else if (event.type === 'checkout.session.expired') {
            await Registration.updateOne({
                stripeCheckoutSessionId: event.data.object.id,
                paymentStatus: 'pending'
            }, { $set: { paymentStatus: 'failed' } });
        }
        return res.json({ received: true });
    } catch (error) {
        console.error('Unable to process Stripe webhook event:', error);
        return res.status(500).json({ message: 'Unable to process Stripe webhook event.' });
    }
};

module.exports = { createCheckoutSession, getCheckoutStatus, handleStripeWebhook };