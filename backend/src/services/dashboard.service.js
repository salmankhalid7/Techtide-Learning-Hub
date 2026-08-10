/**
 * @file dashboard.service.js
 * @description Dashboard service facade.
 *
 * This module used to be a single ~1,960-line class mixing instructor and
 * admin dashboard queries along with dozens of shared aggregation helpers.
 * It is now a thin facade that extends the base service and mixes in small,
 * focused modules from the `services/dashboard/` folder:
 *
 *   - base service: static `PRIORITY_ORDER`
 *   - helpers: scope, summary, course-analytics, engagement
 *   - instructor: overview, analytics
 *   - admin: overview, health, action-center
 *
 * All methods land on the same instance, so every internal `this._method()`
 * call keeps resolving correctly, and the public API (`export default new
 * DashboardService()`) is unchanged for the controllers.
 */

import DashboardBaseService from "./dashboard/dashboard.base.service.js";
import scopeHelpers from "./dashboard/dashboard.scope.helper.js";
import summaryHelpers from "./dashboard/dashboard.summary.helper.js";
import courseAnalyticsHelpers from "./dashboard/dashboard.course-analytics.helper.js";
import engagementHelpers from "./dashboard/dashboard.engagement.helper.js";
import instructorOverview from "./dashboard/dashboard.instructor.overview.js";
import instructorAnalytics from "./dashboard/dashboard.instructor.analytics.js";
import adminOverview from "./dashboard/dashboard.admin.overview.js";
import adminHealth from "./dashboard/dashboard.admin.health.js";
import adminActionCenter from "./dashboard/dashboard.admin.action-center.js";

class DashboardService extends DashboardBaseService {
  /* No methods defined here — everything is mixed in below. */
}

// Attach every method group onto the prototype so the single facade instance
// exposes the full dashboard API (helpers + instructor + admin).
Object.assign(
  DashboardService.prototype,
  scopeHelpers,
  summaryHelpers,
  courseAnalyticsHelpers,
  engagementHelpers,
  instructorOverview,
  instructorAnalytics,
  adminOverview,
  adminHealth,
  adminActionCenter
);

export default new DashboardService();
