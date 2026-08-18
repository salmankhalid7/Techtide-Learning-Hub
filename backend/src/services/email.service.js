/**
 * @file email.service.js
 * @description Reusable transactional email service for the LearnX LMS.
 *
 * Wraps the nodemailer transporter (see config/mail/mail.config.js) with typed,
 * template-based senders for the transactional emails the platform needs:
 *
 *   - Email verification
 *   - Password reset
 *   - Welcome
 *   - Enrollment confirmation
 *   - Payment confirmation
 *   - Course completion
 *   - Quiz result
 *   - Task evaluation
 *   - Instructor notifications
 *
 * Every HTML template escapes user-supplied values to prevent injection, and
 * all sends are best-effort: a mail failure is logged and never crashes the
 * caller. Emails are only attempted when the mail transporter is configured.
 */

import transporter from "../config/mail/mail.config.js";
import { config } from "../config/index.js";
import logger from "../config/logger.js";

const APP_NAME = config.app?.name || "LearnX AI";
const FROM_EMAIL = config.mail?.from || "no-reply@learnxai.com";
const CLIENT_URL = (config.client?.url || "").replace(/\/$/, "");

/* ────────────────────────────────────────────────────────────────────── */
/*  Low-level sender                                                      */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Whether mail is configured well enough to attempt a send.
 * Nodemailer tolerates missing host in dev, but we treat absent host as
 * "not set up" and silently skip rather than throw.
 */
const isEmailEnabled = () => Boolean(config.mail?.host && config.mail?.user && config.mail?.pass);

/**
 * Send a templated email.
 *
 * @param {Object} params
 * @param {string} params.to       - recipient email.
 * @param {string} params.subject  - email subject line.
 * @param {string} params.title    - heading shown in the email body.
 * @param {string} params.preheader - short preview text (optional).
 * @param {string} params.bodyHtml - inner HTML of the email body.
 * @param {string} [params.buttonText] - optional CTA button label.
 * @param {string} [params.buttonUrl]  - optional CTA button href.
 * @returns {Promise<boolean>} true if sent, false if skipped/unconfigured.
 */
export const sendMail = async ({
    to,
    subject,
    title,
    preheader = "",
    bodyHtml,
    buttonText = "",
    buttonUrl = "",
}) => {
    if (!to) {
        logger.warn("Email not sent: no recipient.");
        return false;
    }
    if (!isEmailEnabled()) {
        logger.info(`Email skipped (mail not configured): ${subject} -> ${to}`);
        return false;
    }

    const html = _layout({ title, preheader, bodyHtml, buttonText, buttonUrl });

    try {
        await transporter.sendMail({
            from: `"${APP_NAME}" <${FROM_EMAIL}>`,
            to,
            subject,
            html,
        });
        logger.info(`Email sent: ${subject} -> ${to}`);
        return true;
    } catch (err) {
        logger.error(`Email send failed (${subject} -> ${to}): ${err.message}`);
        return false;
    }
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Typed transactional senders                                          */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Email verification link.
 * @param {Object} opts { to, fullName, token }
 */
export const sendEmailVerification = async ({ to, fullName, token }) => {
    const url = `${CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;
    return sendMail({
        to,
        subject: `Verify your email — ${APP_NAME}`,
        title: "Welcome to LearnX AI 🎓",
        preheader: "Please confirm your email address.",
        bodyHtml: `
            <p>Hi ${esc(fullName)},</p>
            <p>Thanks for signing up! Please confirm your email address to activate your account.</p>
        `,
        buttonText: "Verify Email",
        buttonUrl: url,
    });
};

/**
 * Password reset link.
 * @param {Object} opts { to, fullName, token }
 */
export const sendPasswordReset = async ({ to, fullName, token }) => {
    const url = `${CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;
    return sendMail({
        to,
        subject: `Reset your password — ${APP_NAME}`,
        title: "Reset Password",
        preheader: "You requested a password reset.",
        bodyHtml: `
            <p>Hi ${esc(fullName)},</p>
            <p>We received a request to reset your password. Click the button below to choose a new one. This link is valid for a limited time.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
        `,
        buttonText: "Reset Password",
        buttonUrl: url,
    });
};

/**
 * Welcome email after account verification.
 * @param {Object} opts { to, fullName }
 */
export const sendWelcome = async ({ to, fullName }) => {
    return sendMail({
        to,
        subject: `Welcome to ${APP_NAME} 🎉`,
        title: `Welcome, ${esc(fullName)}!`,
        preheader: "Your account is ready.",
        bodyHtml: `
            <p>Your email has been verified and your account is ready.</p>
            <p>Start exploring courses, track your progress, and reach your learning goals.</p>
        `,
        buttonText: "Browse Courses",
        buttonUrl: CLIENT_URL,
    });
};

/**
 * Enrollment confirmation.
 * @param {Object} opts { to, fullName, courseName, courseUrl }
 */
export const sendEnrollmentConfirmation = async ({ to, fullName, courseName, courseUrl = CLIENT_URL }) => {
    return sendMail({
        to,
        subject: `Enrolled: ${courseName} — ${APP_NAME}`,
        title: "You're enrolled ✅",
        preheader: `You are now enrolled in ${courseName}.`,
        bodyHtml: `
            <p>Hi ${esc(fullName)},</p>
            <p>You are now enrolled in <strong>${esc(courseName)}</strong>. Good luck and happy learning!</p>
        `,
        buttonText: "Go to Course",
        buttonUrl: courseUrl,
    });
};

/**
 * Payment confirmation / receipt.
 * @param {Object} opts { to, fullName, courseName, amount, currency }
 */
export const sendPaymentConfirmation = async ({ to, fullName, courseName, amount, currency }) => {
    return sendMail({
        to,
        subject: `Payment received — ${APP_NAME}`,
        title: "Payment Successful 💳",
        preheader: `Your payment of ${currency} ${amount} was received.`,
        bodyHtml: `
            <p>Hi ${esc(fullName)},</p>
            <p>Your payment for <strong>${esc(courseName)}</strong> was successful.</p>
            <p style="font-size:20px"><strong>${esc(currency)} ${_money(amount)}</strong></p>
            <p>A receipt has been recorded in your account.</p>
        `,
    });
};

/**
 * Course completion.
 * @param {Object} opts { to, fullName, courseName, percent }
 */
export const sendCourseCompletion = async ({ to, fullName, courseName, percent = 100 }) => {
    return sendMail({
        to,
        subject: `Course completed — ${courseName} 🎓`,
        title: "Congratulations! 🏆",
        preheader: `You completed ${courseName}.`,
        bodyHtml: `
            <p>Great job, ${esc(fullName)}!</p>
            <p>You completed <strong>${esc(courseName)}</strong> (${_money(percent)}%).</p>
            <p>Keep up the momentum and start your next course.</p>
        `,
        buttonText: "Browse More Courses",
        buttonUrl: CLIENT_URL,
    });
};

/**
 * Quiz result.
 * @param {Object} opts { to, fullName, quizName, percentage, passed }
 */
export const sendQuizResult = async ({ to, fullName, quizName, percentage, passed }) => {
    return sendMail({
        to,
        subject: `Quiz result: ${passed ? "Passed 🎉" : "Needs another try"} — ${APP_NAME}`,
        title: passed ? "Quiz Passed ✅" : "Quiz Result",
        preheader: `You scored ${percentage}% on ${quizName}.`,
        bodyHtml: `
            <p>Hi ${esc(fullName)},</p>
            <p>Your result for <strong>${esc(quizName)}</strong>: you scored <strong>${_money(percentage)}%</strong>.</p>
            ${passed ? "<p>Great work — keep it up!</p>" : "<p>Don't worry — review the material and try again.</p>"}
        `,
    });
};

/**
 * Task evaluation result.
 * @param {Object} opts { to, fullName, taskName, score, maxScore }
 */
export const sendTaskEvaluation = async ({ to, fullName, taskName, score, maxScore }) => {
    return sendMail({
        to,
        subject: `Task evaluated: ${taskName} — ${APP_NAME}`,
        title: "Your task was evaluated",
        preheader: `You scored ${score}/${maxScore} on ${taskName}.`,
        bodyHtml: `
            <p>Hi ${esc(fullName)},</p>
            <p>Your submission for <strong>${esc(taskName)}</strong> has been graded.</p>
            <p><strong>Score: ${_money(score)} / ${_money(maxScore)}</strong></p>
        `,
    });
};

/**
 * Instructor notification (generic — new sale, new student, review, etc.).
 * @param {Object} opts { to, fullName, subject, message, courseName }
 */
export const sendInstructorNotification = async ({ to, fullName, subject, message, courseName = "" }) => {
    return sendMail({
        to,
        subject: `${subject} — ${APP_NAME}`,
        title: "Instructor Update",
        preheader: subject,
        bodyHtml: `
            <p>Hi ${esc(fullName)},</p>
            <p>${message}</p>
            ${courseName ? `<p>Course: <strong>${esc(courseName)}</strong></p>` : ""}
        `,
    });
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Private helpers                                                       */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Escape user-supplied values before embedding in HTML (injection-safe).
 */
const esc = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const _money = (value) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : "0";
};

/**
 * Build the full HTML email body (shared layout + header/footer).
 */
const _layout = ({ title, preheader, bodyHtml, buttonText, buttonUrl }) => {
    const accent = "#4F46E5";
    const button = buttonText && buttonUrl
        ? `<a href="${_safeUrl(buttonUrl)}" target="_blank" style="display:inline-block;background:${accent};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">${esc(buttonText)}</a>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  ${preheader ? `<!-- ${esc(preheader)} -->` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px;"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:${accent};padding:20px 28px;color:#fff;">
        <h1 style="margin:0;font-size:20px;">${esc(APP_NAME)}</h1>
      </td></tr>
      <tr><td style="padding:28px;">
        <h2 style="margin:0 0 16px;color:#111827;">${esc(title)}</h2>
        <div style="color:#374151;line-height:1.6;">${bodyHtml || ""}</div>
        ${button ? `<div style="margin-top:24px;text-align:center;">${button}</div>` : ""}
      </td></tr>
      <tr><td style="padding:16px 28px;background:#f9fafb;color:#6b7280;font-size:12px;">
        &copy; ${new Date().getFullYear()} ${esc(APP_NAME)}. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
};

/**
 * Sanitize URLs for CTA buttons (only allow http/https/mailto).
 */
const _safeUrl = (url) => {
    const value = String(url || "").trim();
    if (/^(https?:\/\/|mailto:)/i.test(value)) return value;
    return "#";
};

export default {
    sendMail,
    isEmailEnabled,
    sendEmailVerification,
    sendPasswordReset,
    sendWelcome,
    sendEnrollmentConfirmation,
    sendPaymentConfirmation,
    sendCourseCompletion,
    sendQuizResult,
    sendTaskEvaluation,
    sendInstructorNotification,
};
