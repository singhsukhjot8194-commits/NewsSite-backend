# Stripe checkout setup

Service prices are managed per class, course, workshop, webinar, or event in **Admin Panel → Services & Pricing**. Choose **Free**, **Subscription (every 3 months)**, or **Special (one-time payment)**. Enter the USD amount for paid services; subscription prices are charged every three months. Use the row's **Publish/Unpublish** control to make a service visible in its matching public section; only published services are listed or available for checkout. Paid services must be USD 0.50–999,999.99, with no more than two decimal places.

## Configure test mode

1. Create or sign in to a Stripe account in a country where Stripe can onboard businesses. Check Stripe's current availability at <https://stripe.com/global>.
2. Copy `backend/.env.example` to `backend/.env` if you do not already have a local environment file. Keep `.env` private and never commit or share its keys.
3. In Stripe Dashboard, enable test mode and copy the test secret key (`sk_test_...`) to `STRIPE_SECRET_KEY`.
4. Set `FRONTEND_URL` to the origin serving the website (for local development, `http://localhost:5000`).
5. For local webhook testing, install the Stripe CLI and run:

   ```text
   stripe listen --forward-to localhost:5000/api/payments/webhook
   ```

   Copy the CLI's webhook signing secret (`whsec_...`) to `STRIPE_WEBHOOK_SECRET`, then restart the backend.
6. Restart the backend after changing `.env`.
7. Use `4242 4242 4242 4242` with any future expiry date and CVC to test a card payment.

## Publish and test a paid course

1. Open the Admin Panel and go to **Services & Pricing**.
2. Add a service, give it a title and description, and choose **Course** or **Class** as its type.
3. For recurring billing, choose **Subscription (every 3 months)** and enter the amount charged per three-month period. For a single charge, choose **Special (one-time payment)**.
4. Enable **Publish on the website** and save. The service appears in its public category with its price and billing interval.
5. Open the public service, choose **Subscribe** or **Pay & Register**, and complete the form. Stripe Checkout handles the card details; do not collect card numbers in the site's form.
6. In Stripe test mode, enter `4242 4242 4242 4242`, a future expiry date, and any CVC. Verify that Checkout returns to the site's payment status page and that the registration appears in **Admin Panel → Registrations**.
7. Confirm the local webhook listener is running and that `STRIPE_WEBHOOK_SECRET` contains the current `whsec_...` value printed by `stripe listen`. A successful checkout is confirmed by the webhook.

In production, configure a Stripe webhook endpoint at `https://your-domain/api/payments/webhook` for `checkout.session.completed` and `checkout.session.expired`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`, use the live secret key only after completing Stripe onboarding, and set `FRONTEND_URL` to the public website origin. Test the complete flow in test mode before switching to live keys.

Checkout creates registrations as pending. A registration and its seat count are confirmed only after Stripe reports the initial payment as successful. The backend verifies webhook signatures and reads the price from the saved service record; the browser cannot set or change the charge amount. Stripe bills active subscriptions every three months; this site currently confirms the initial checkout but does not display later renewal, cancellation, or failed-renewal status.
