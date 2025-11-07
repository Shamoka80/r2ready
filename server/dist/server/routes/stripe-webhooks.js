import { Router } from "express";
import { db } from "../db";
import { licenses, licenseEvents, assessments } from "../../shared/schema";
import { eq, and, ne } from "drizzle-orm";
const router = Router();
// Exported handler function for Stripe webhook events
// This is called from server/index.ts after signature verification
export async function handleStripeWebhook(event) {
    // Process the verified event based on its type
    switch (event.type) {
        case 'checkout.session.completed':
            // Handle successful checkout sessions
            const session = event.data.object;
            await handleCheckoutCompleted(session);
            break;
        case 'invoice.payment_failed':
            // Handle payment failures for subscriptions or other recurring charges
            const invoice = event.data.object;
            await handlePaymentFailed(invoice);
            break;
        case 'customer.subscription.deleted':
            // Handle deletion of customer subscriptions
            const subscription = event.data.object;
            await handleSubscriptionDeleted(subscription);
            break;
        default:
            // Log any event types that are not explicitly handled
            console.log(`Unhandled event type: ${event.type}`);
    }
}
// Handles the 'checkout.session.completed' event from Stripe.
// This function creates a new license record in the database based on session metadata.
async function handleCheckoutCompleted(session) {
    // Ensure session metadata exists, as it's crucial for creating the license.
    if (!session.metadata) {
        console.error('Missing metadata in checkout session');
        return;
    }
    // Extract relevant information from the session metadata.
    // These are expected to be set when the Stripe Checkout session is created.
    const { tenantId, userId, tier, facilityPacks, seatPacks, supportTier } = session.metadata;
    // Validate that essential metadata fields are present.
    if (!tenantId || !userId || !tier) {
        console.error('Incomplete metadata in checkout session: tenantId, userId, and tier are required.');
        return;
    }
    try {
        // Determine account type and plan details from metadata
        const accountType = session.metadata.accountType || 'business';
        const planName = session.metadata.planName || 'R2v3 Base License';
        const planId = session.metadata.planId || 'base_license';
        // Insert a new license record into the 'licenses' table.
        const [license] = await db.insert(licenses).values({
            tenantId,
            licenseType: 'base',
            planName,
            accountType,
            tier,
            planId,
            status: 'ACTIVE',
            purchasedBy: userId,
            stripeSessionId: session.id,
            stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.toString(),
            amountPaid: session.amount_total || 0,
            currency: 'USD',
            maxFacilities: parseInt(facilityPacks || '0'),
            maxSeats: parseInt(seatPacks || '0'),
            supportTier: supportTier || 'basic',
        }).returning();
        // Log a 'PURCHASED' event in the 'licenseEvents' table to track this transaction.
        await db.insert(licenseEvents).values({
            tenantId: license.tenantId,
            licenseId: license.id,
            eventType: 'PURCHASED',
            eventDescription: `License purchased via Stripe session ${session.id}`,
            eventData: {
                sessionId: session.id,
                amount: session.amount_total,
                customerEmail: session.customer_email
            },
            stripeSessionId: session.id,
            amount: session.amount_total || 0,
            currency: 'USD',
        });
        console.log(`License created successfully: ${license.id}`);
    }
    catch (error) {
        console.error('Error creating license from webhook:', error);
        // Re-throw the error to be caught by the main webhook handler for proper error response.
        throw error;
    }
}
// Handles the 'invoice.payment_failed' event from Stripe.
// This function updates the license status to 'PAST_DUE' when a payment fails.
async function handlePaymentFailed(invoice) {
    console.log(`Payment failed for invoice: ${invoice.id}`);
    // Get subscription and customer info
    const subscriptionId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;
    if (!subscriptionId) {
        console.error('No subscription ID in failed payment invoice');
        return;
    }
    try {
        // Find license by Stripe subscription ID
        const [license] = await db.select().from(licenses)
            .where(eq(licenses.stripeSubscriptionId, subscriptionId))
            .limit(1);
        if (!license) {
            console.error(`License not found for subscription: ${subscriptionId}`);
            return;
        }
        // Update license status to PAST_DUE
        await db.update(licenses)
            .set({
            status: 'PAST_DUE',
            updatedAt: new Date()
        })
            .where(eq(licenses.id, license.id));
        // Log license event
        await db.insert(licenseEvents).values({
            tenantId: license.tenantId,
            licenseId: license.id,
            eventType: 'PAYMENT_FAILED',
            eventDescription: `Payment failed for invoice ${invoice.id}`,
            eventData: {
                invoiceId: invoice.id,
                attemptCount: invoice.attempt_count,
                amountDue: invoice.amount_due
            },
            amount: invoice.amount_due || 0,
            currency: 'USD',
        });
        // TODO: Send payment retry notification email to license owner
        // await emailService.sendPaymentFailedEmail(license.tenantId, invoice);
        console.log(`License ${license.id} marked as PAST_DUE due to payment failure`);
    }
    catch (error) {
        console.error('Error handling payment failure:', error);
        throw error;
    }
}
// Handles the 'customer.subscription.deleted' event from Stripe.
// This function deactivates the license and archives associated assessments.
async function handleSubscriptionDeleted(subscription) {
    console.log(`Subscription deleted: ${subscription.id}`);
    try {
        // Find license by Stripe subscription ID
        const [license] = await db.select().from(licenses)
            .where(eq(licenses.stripeSubscriptionId, subscription.id))
            .limit(1);
        if (!license) {
            console.error(`License not found for subscription: ${subscription.id}`);
            return;
        }
        // Deactivate license
        await db.update(licenses)
            .set({
            status: 'CANCELLED',
            cancelledAt: new Date(),
            updatedAt: new Date()
        })
            .where(eq(licenses.id, license.id));
        // Archive associated assessments (set to read-only)
        await db.update(assessments)
            .set({
            status: 'ARCHIVED',
            updatedAt: new Date()
        })
            .where(and(eq(assessments.tenantId, license.tenantId), ne(assessments.status, 'ARCHIVED')));
        // Log license event
        await db.insert(licenseEvents).values({
            tenantId: license.tenantId,
            licenseId: license.id,
            eventType: 'CANCELLED',
            eventDescription: `Subscription ${subscription.id} cancelled`,
            eventData: {
                subscriptionId: subscription.id,
                cancelReason: subscription.cancellation_details?.reason || 'unknown',
                cancelledAt: subscription.canceled_at
            },
            currency: 'USD',
        });
        // TODO: Send cancellation confirmation email
        // await emailService.sendCancellationEmail(license.tenantId);
        console.log(`License ${license.id} cancelled and assessments archived`);
    }
    catch (error) {
        console.error('Error handling subscription deletion:', error);
        throw error;
    }
}
// Export the router for use in the Express application.
export default router;
