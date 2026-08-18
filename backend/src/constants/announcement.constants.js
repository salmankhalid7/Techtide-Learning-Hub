/**
 * @file announcement.constants.js
 * @description Constants for the LearnX course announcements module.
 */

/**
 * Announcement lifecycle status.
 *
 * - DRAFT     : instructor is still editing; not visible to students.
 * - PUBLISHED : visible to enrolled students in their announcement feed.
 */
const ANNOUNCEMENT_STATUS = Object.freeze({
    DRAFT: "DRAFT",
    PUBLISHED: "PUBLISHED",
});

export { ANNOUNCEMENT_STATUS };
