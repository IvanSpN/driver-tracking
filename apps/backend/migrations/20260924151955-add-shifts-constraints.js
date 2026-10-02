'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS btree_gist;

      ALTER TABLE shifts ADD CONSTRAINT shifts_dates_order
        CHECK (end_date IS NULL OR end_date >= start_date);

      CREATE UNIQUE INDEX shifts_one_open_per_driver
        ON shifts (driver_id) WHERE end_date IS NULL;

      ALTER TABLE shifts ADD CONSTRAINT shifts_no_overlap
        EXCLUDE USING gist (
          driver_id WITH =,
          daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]') WITH &&
        );
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE shifts DROP CONSTRAINT shifts_no_overlap;
      DROP INDEX shifts_one_open_per_driver;
      ALTER TABLE shifts DROP CONSTRAINT shifts_dates_order;
    `);
  },
};
