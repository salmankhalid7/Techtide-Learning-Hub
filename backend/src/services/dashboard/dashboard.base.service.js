/**
 * @file dashboard.base.service.js
 * @description Dashboard service base class.
 *
 * A deliberately slim base class. The shared private helpers now live in the
 * dedicated `dashboard.*.helper.js` files and are composed onto the facade
 * prototype by `dashboard.service.js`. This base class only carries the static
 * `PRIORITY_ORDER` used by the admin action center.
 */

class DashboardBaseService {
  /**
   * Priority ordering used to sort admin actions (highest first).
   */
  static get PRIORITY_ORDER() {
    return { HIGH: 1, MEDIUM: 2, LOW: 3 };
  }
}

export default DashboardBaseService;
