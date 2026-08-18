/**
 * @file order.service.js
 * @description Order lifecycle for the LearnX marketplace.
 *
 * Handles checkout intent: validating a course is purchasable, computing the
 * price (with optional coupon discount), creating an Order, and wiring a
 * Payment preparation. Free courses skip payment and enroll directly.
 */

import mongoose from "mongoose";

import Course from "../models/course.model.js";
import Enrollment from "../models/enrollment.model.js";
import Order from "../models/order.model.js";
import Payment from "../models/payment.model.js";
import Coupon from "../models/coupon.model.js";
import Wallet from "../models/wallet.model.js";
import User from "../models/user.model.js";

import { ORDER_STATUS } from "../constants/order.constants.js";
import {
    PAYMENT_PROVIDERS,
    PAYMENT_STATUS,
    CURRENCIES,
    COMMISSION,
} from "../constants/payment.constants.js";
import {
    ENROLLMENT_STATUS,
    ENROLLMENT_TYPE,
} from "../constants/enrollment.constants.js";

import {
    NotFoundError,
    BadRequestError,
    ConflictError,
} from "../errors/index.js";
import logger from "../config/logger.js";
import { config } from "../config/index.js";
import { notifyUser } from "./notification.service.js";
import { NOTIFICATION_TYPES } from "../constants/notification.constants.js";
import emailService from "./email.service.js";

/**
 * Resolve a course's effective sale price and currency.
 *
 * @returns {{ unitPrice:number, currency:string }}
 */
const getCoursePrice = (course) => {
    const pricing = course.pricing || {};
    const price = Number(pricing.price || 0);
    const discountedPrice =
        pricing.discountedPrice != null && pricing.discountedPrice >= 0
            ? Number(pricing.discountedPrice)
            : null;
    const unitPrice = discountedPrice != null && discountedPrice < price
        ? discountedPrice
        : price;
    const currency = pricing.currency || CURRENCIES.USD;
    return { unitPrice, currency };
};

/**
 * Validate a coupon against a course and return the discount amount.
 *
 * @param {object} coupon - the Coupon document (or null).
 * @param {string} courseId - the course being purchased.
 * @param {number} subtotal - the pre-discount total.
 * @returns {{ coupon:object, code:string, discountType:string, discountValue:number, saved:number }}
 */
const applyCoupon = (coupon, courseId, subtotal) => {
    if (!coupon) {
        return { coupon: null, code: "", discountType: "", discountValue: 0, saved: 0 };
    }

    // Course-scoped coupons must include this course (empty = all courses).
    if (coupon.courses && coupon.courses.length > 0) {
        const scoped = coupon.courses.some(
            (c) => c.toString() === courseId.toString()
        );
        if (!scoped) {
            throw new BadRequestError("This coupon does not apply to this course.");
        }
    }

    let saved = 0;
    if (coupon.discountType === "percentage") {
        saved = (subtotal * coupon.discountValue) / 100;
    } else {
        // Fixed amount in the coupon's currency.
        saved = coupon.discountValue;
    }
    saved = Math.min(saved, subtotal); // never discount below zero.
    saved = Math.round(saved * 100) / 100;

    return {
        coupon: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        saved,
    };
};

/**
 * Prepare a checkout for one course.
 *
 * - Free course  -> creates and immediately completes a FREE enrollment.
 * - Paid course  -> creates an Order (PENDING_PAYMENT) and Payment (PENDING),
 *                   then returns the gateway checkout details.
 *
 * @param {object} params
 * @param {string} params.studentId
 * @param {string} params.courseId
 * @param {string} [params.provider]  - "stripe" | "jazzcash" | "easypaisa"
 * @param {string} [params.couponCode]
 * @param {string} [params.returnUrl]
 * @param {string} [params.cancelUrl]
 * @param {string} [params.idempotencyKey]
 * @returns {Promise<object>}
 */
export const createCheckout = async ({
    studentId,
    courseId,
    provider,
    couponCode = null,
    returnUrl,
    cancelUrl,
    idempotencyKey = null,
}) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const course = await Course.findById(courseId)
            .select("_id title slug instructor pricing status visibility")
            .session(session)
            .lean();

        if (!course) {
            throw new NotFoundError("Course not found");
        }
        if (String(course.status).toLowerCase() !== "published") {
            throw new BadRequestError("This course is not published.");
        }

        // Student cannot already be actively enrolled.
        const existing = await Enrollment.exists({
            student: studentId,
            course: courseId,
            status: ENROLLMENT_STATUS.ACTIVE,
        }).session(session);
        if (existing) {
            throw new ConflictError("You are already enrolled in this course.");
        }

        const { unitPrice, currency } = getCoursePrice(course);

        // ── FREE course: enroll directly, no payment. ─────────────
        if (unitPrice === 0) {
            const enrollment = await Enrollment.create(
                [
                    {
                        student: studentId,
                        course: courseId,
                        status: ENROLLMENT_STATUS.ACTIVE,
                        enrollmentType: ENROLLMENT_TYPE.FREE,
                        enrolledAt: new Date(),
                    },
                ],
                { session }
            );
            await session.commitTransaction();
            return {
                mode: "free",
                enrollment: enrollment[0],
                course: { _id: course._id, title: course.title },
            };
        }

        // ── PAID course: build the order + payment. ───────────────
        if (!provider) {
            throw new BadRequestError("A payment provider is required for a paid course.");
        }
        if (!Object.values(PAYMENT_PROVIDERS).includes(provider)) {
            throw new BadRequestError("Unsupported payment provider.");
        }

        // Resolve optional coupon (must be active + redeemable).
        let couponDoc = null;
        if (couponCode) {
            couponDoc = await _resolveRedeemableCoupon(couponCode, courseId, session);
        }

        const subtotal = unitPrice;
        const applied = applyCoupon(couponDoc, courseId, subtotal);
        const total = Math.max(0, Math.round((subtotal - applied.saved) * 100) / 100);

        const order = await Order.create(
            [
                {
                    student: studentId,
                    items: [
                        {
                            itemType: "course",
                            course: course._id,
                            courseTitle: course.title || "Course",
                            instructor: course.instructor,
                            unitPrice,
                            quantity: 1,
                        },
                    ],
                    money: { currency, subtotal, discount: applied.saved, total },
                    appliedCoupon: applied,
                    status: ORDER_STATUS.PENDING_PAYMENT,
                    events: [{ type: "created", note: "Checkout initiated" }],
                },
            ],
            { session }
        );

        // Increment coupon redemption count.
        if (couponDoc) {
            await Coupon.updateOne(
                { _id: couponDoc._id },
                { $inc: { redemptions: 1 } }
            ).session(session);
        }

        // Create the Payment record (idempotency: reuse an existing open one).
        const payment = await Payment.create(
            [
                {
                    order: order[0]._id,
                    student: studentId,
                    provider,
                    amount: total,
                    currency,
                    status: PAYMENT_STATUS.PENDING,
                    idempotencyKey: idempotencyKey || `order-${order[0]._id}`,
                },
            ],
            { session }
        );

        await Order.updateOne(
            { _id: order[0]._id },
            { $set: { payment: payment[0]._id } }
        ).session(session);

        await session.commitTransaction();

        return {
            mode: "paid",
            order: order[0],
            payment: payment[0],
            course: { _id: course._id, title: course.title },
            total,
            currency,
            discount: applied.saved,
        };
    } catch (error) {
        await session.abortTransaction();
        logger.error("Checkout failed", { courseId, studentId, error: error.message });
        throw error;
    } finally {
        await session.endSession();
    }
};

/**
 * Grant enrollment after a successful paid payment and credit the instructor.
 *
 * @param {object} opts
 * @param {string} opts.paymentId
 * @returns {Promise<object>} { enrollment }
 */
export const grantPaidEnrollment = async ({ paymentId }) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const payment = await Payment.findById(paymentId)
            .session(session)
            .populate("order");
        if (!payment) {
            throw new NotFoundError("Payment not found");
        }
        const order = payment.order;

        // Prevent double enrollment on repeated webhooks.
        const existing = await Enrollment.exists({
            student: payment.student,
            course: order.items[0].course,
            status: ENROLLMENT_STATUS.ACTIVE,
        }).session(session);
        if (existing) {
            // Already granted — idempotent success.
            await session.commitTransaction();
            return { enrollment: null, alreadyEnrolled: true };
        }

        const enrollment = await Enrollment.create(
            [
                {
                    student: payment.student,
                    course: order.items[0].course,
                    status: ENROLLMENT_STATUS.ACTIVE,
                    enrollmentType: ENROLLMENT_TYPE.PAID,
                    order: order._id,
                    payment: payment._id,
                    enrolledAt: new Date(),
                },
            ],
            { session }
        );

        await Order.updateOne(
            { _id: order._id },
            {
                $set: { enrollment: enrollment[0]._id, status: ORDER_STATUS.PAID },
                $push: { events: { type: "paid", note: "Payment succeeded" } },
            }
        ).session(session);

        // Mark the payment succeeded atomically with enrollment grant so a
        // refund can only target a truly succeeded payment.
        await Payment.updateOne(
            { _id: payment._id },
            {
                $set: {
                    status: PAYMENT_STATUS.SUCCEEDED,
                    paidAt: new Date(),
                },
            }
        ).session(session);

        // Credit the instructor's wallet (net of platform commission).
        await _creditInstructorEarnings({
            order,
            payment,
            session,
        });

        await session.commitTransaction();

        // ── Emit notifications (post-commit; never fires on rollback) ──
        const courseId = order.items[0].course;
        const courseTitle = order.items[0].courseTitle || "Course";
        const instructorId = order.items[0].instructor;

        // Student: order/payment completed -> enrolled.
        await notifyUser({
            recipient: payment.student,
            type: NOTIFICATION_TYPES.PAYMENT_COMPLETED,
            title: "Payment successful",
            body: `Your payment for "${courseTitle}" was successful. You are now enrolled.`,
            data: { course: courseId, order: order._id, payment: payment._id },
        });
        // Instructor: a student purchased their course.
        await notifyUser({
            recipient: instructorId,
            type: NOTIFICATION_TYPES.PAYMENT_COMPLETED,
            title: "New sale 🎉",
            body: `A student purchased your course "${courseTitle}".`,
            data: { course: courseId, payment: payment._id },
            actor: payment.student,
        });

        // ── Best-effort transactional emails (never break the sale) ──
        try {
            const [student, instructor] = await Promise.all([
                User.findById(payment.student).select("email fullName").lean(),
                User.findById(instructorId).select("email fullName").lean(),
            ]);
            const amount = payment.amount;
            const currency = payment.currency || "USD";
            if (student?.email) {
                await emailService.sendPaymentConfirmation({
                    to: student.email,
                    fullName: student.fullName || "there",
                    courseName: courseTitle,
                    amount,
                    currency,
                });
            }
            if (instructor?.email) {
                await emailService.sendInstructorNotification({
                    to: instructor.email,
                    fullName: instructor.fullName || "there",
                    subject: "New sale 🎉",
                    message: "A student purchased your course.",
                    courseName: courseTitle,
                });
            }
        } catch (e) {
            logger.warn("Payment emails skipped.", { error: e.message });
        }

        return { enrollment: enrollment[0], alreadyEnrolled: false };
    } catch (error) {
        await session.abortTransaction();
        logger.error("Grant paid enrollment failed", { paymentId, error: error.message });
        throw error;
    } finally {
        await session.endSession();
    }
};

/**
 * Credit the instructor's wallet after a paid sale.
 * Commission is withheld from the order total before crediting.
 */
const _creditInstructorEarnings = async ({ order, payment, session }) => {
    const item = order.items[0];
    if (!item) return;

    const commissionRate = (await _getCommissionRate()) / 100;
    const instructorShare = item.unitPrice * (1 - commissionRate);
    const net = Math.round(instructorShare * 100) / 100;

    let wallet = await Wallet.findOne({ instructor: item.instructor }).session(session);
    if (!wallet) {
        wallet = await Wallet.create(
            [
                {
                    instructor: item.instructor,
                    currency: order.money.currency,
                    balance: 0,
                },
            ],
            { session }
        );
        wallet = wallet[0];
    }

    const newBalance = Math.round((wallet.balance + net) * 100) / 100;
    await Wallet.updateOne(
        { _id: wallet._id },
        {
            $set: { balance: newBalance },
            $inc: {
                totalEarned: net,
            },
            $push: {
                transactions: {
                    type: "course_sale",
                    direction: "credit",
                    amount: net,
                    currency: wallet.currency,
                    balanceAfter: newBalance,
                    order: order._id,
                    payment: payment._id,
                    course: item.course,
                    description: `Course sale: ${item.courseTitle || ""} (${order._id})`,
                },
            },
        }
    ).session(session);

    await Course.updateOne(
        { _id: item.course },
        { $inc: { "statistics.totalSales": 1 } }
    ).session(session).catch(() => {});
};

let _cachedCommissionRate = null;
const _getCommissionRate = async () => {
    if (_cachedCommissionRate != null) return _cachedCommissionRate;
    // Commission is read from the payment config; keep in-memory cache.
    _cachedCommissionRate = Number(config.payment?.commissionRatePercent ?? COMMISSION.DEFAULT_RATE_PERCENT);
    return _cachedCommissionRate;
};

/**
 * Resolve and validate a coupon is redeemable (active, not expired, within
 * usage/per-user limits) for checkout. Returns the coupon or throws.
 */
const _resolveRedeemableCoupon = async (code, courseId, session) => {
    const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() })
        .session(session);
    if (!coupon) {
        throw new BadRequestError("Invalid coupon code.");
    }
    if (coupon.status === "disabled") {
        throw new BadRequestError("This coupon is not active.");
    }

    const now = new Date();
    if (coupon.expiresAt && coupon.expiresAt < now) {
        throw new BadRequestError("This coupon has expired.");
    }
    if (coupon.startsAt && coupon.startsAt > now) {
        throw new BadRequestError("This coupon is not yet active.");
    }

    if (coupon.usageScope === "single_use" && coupon.redemptions >= 1) {
        throw new BadRequestError("This coupon has already been used.");
    }
    if (coupon.maxUses > 0 && coupon.redemptions >= coupon.maxUses) {
        throw new BadRequestError("This coupon has reached its usage limit.");
    }

    return coupon;
};
