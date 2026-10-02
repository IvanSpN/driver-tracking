'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
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
      channel: {
        type: Sequelize.ENUM('WHITE', 'BLACK'),
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM('ADVANCE', 'SALARY'),
        allowNull: false,
      },
      amount_minor: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      paid_at: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      method: {
        type: Sequelize.ENUM('CASH', 'BANK', 'CARD', 'OTHER'),
        allowNull: false,
        defaultValue: 'CASH',
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

    await queryInterface.addIndex('payments', ['driver_id', 'period']);
    await queryInterface.addIndex('payments', ['paid_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_channel";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_method";');
  },
};
