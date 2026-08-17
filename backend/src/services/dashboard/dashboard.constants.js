/**
 * @file dashboard.constants.js
 * @description Shared dashboard constants + model/status imports.
 *
 * Centralizes every dashboard constant and the model + status-constant imports
 * that the dashboard helper/method files reuse. Keeping them here avoids
 * duplicated import blocks across the split modules.
 */

import User from "../../models/user.model.js";
import Course from "../../models/course.model.js";
import Module from "../../models/module.model.js";
import Lesson from "../../models/lesson.model.js";
import Quiz, { QUIZ_STATUS } from "../../models/quiz.model.js";
import Question from "../../models/question.model.js";
import Enrollment from "../../models/enrollment.model.js";
import Progress from "../../models/progress.model.js";
import Attempt from "../../models/attempt.model.js";
import Order from "../../models/order.model.js";
import Payment from "../../models/payment.model.js";
import Wallet from "../../models/wallet.model.js";

import { COURSE_STATUS } from "../../constants/course.constants.js";
import { ENROLLMENT_STATUS } from "../../constants/enrollment.constants.js";
import { MODULE_STATUS } from "../../constants/module.constants.js";
import { LESSON_STATUS_ENUM } from "../../constants/lesson.constants.js";
import { ATTEMPT_STATUS } from "../../constants/attempt.constants.js";
import constants from "../../config/constants.js";

/* ---------------------------- Shared constants ---------------------------- */

/** Default pagination values. */
export const DEFAULT_PAGE = 1;
export const DEFAULT_RECENT_COURSES_LIMIT = 5;
export const DEFAULT_RECENT_ENROLLMENTS_LIMIT = 10;
export const DEFAULT_TOP_COURSES_LIMIT = 5;

/** How many of the most recent registrations to include in user analytics. */
export const RECENT_USERS_LIMIT = 10;

/** Default cap for analytics list helpers (popular, rated, recent, etc.). */
export const DEFAULT_ANALYTICS_LIMIT = 10;

/** How many of the most recent activities to include from each collection. */
export const RECENT_ACTIVITY_PER_SOURCE = 10;

/** Total number of activities returned by the recent-activity timeline. */
export const RECENT_ACTIVITY_TOTAL = 20;

/** Course fields projected for list-style dashboard responses. */
export const COURSE_LIST_PROJECTION =
  "title slug status thumbnail statistics.totalEnrollments statistics.averageRating createdAt";

/**
 * A structure aggregating the instructor's authored courses and their IDs.
 * @typedef {Object} InstructorScope
 * @property {import("mongoose").Types.ObjectId} instructorObjectId
 * @property {import("mongoose").Types.ObjectId[]} courseIds
 * @property {import("mongoose").Types.ObjectId[]} moduleIds
 */

/**
 * Re-exported models and status constants so other dashboard modules can
 * `import { User, Course, COURSE_STATUS, ... } from "./dashboard.constants.js"`.
 */
export {
  User,
  Course,
  Module,
  Lesson,
  Quiz,
  QUIZ_STATUS,
  Question,
  Enrollment,
  Progress,
  Attempt,
  Order,
  Payment,
  Wallet,
  COURSE_STATUS,
  ENROLLMENT_STATUS,
  MODULE_STATUS,
  LESSON_STATUS_ENUM,
  ATTEMPT_STATUS,
  constants,
};
