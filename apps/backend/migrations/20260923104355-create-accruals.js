'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('accruals', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      driver_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'drivers', key: 'id' },
        onDelete: 'CASCADE',
      },
      period: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      white_minor: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
      black_minor: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
      note: {
        type: Sequelize.TEXT,
      },
      created_by_id: {
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('accruals', ['driver_id', 'period'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('accruals');
  },
};
