'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE accruals ADD CONSTRAINT accruals_period_month_start
        CHECK (period = date_trunc('month', period)::date);
      ALTER TABLE payments ADD CONSTRAINT payments_period_month_start
        CHECK (period = date_trunc('month', period)::date);

      ALTER TABLE accruals ADD CONSTRAINT accruals_amounts_non_negative
        CHECK (white_minor >= 0 AND black_minor >= 0);
      ALTER TABLE payments ADD CONSTRAINT payments_amount_positive
        CHECK (amount_minor > 0);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE accruals DROP CONSTRAINT accruals_period_month_start;
      ALTER TABLE payments DROP CONSTRAINT payments_period_month_start;
      ALTER TABLE accruals DROP CONSTRAINT accruals_amounts_non_negative;
      ALTER TABLE payments DROP CONSTRAINT payments_amount_positive;
    `);
  },
};
