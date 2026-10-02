'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shifts', {
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
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      end_date: {
        type: Sequelize.DATEONLY, // null = вахта идёт прямо сейчас
      },
      is_official: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      note: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex('shifts', ['driver_id', 'start_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('shifts');
  },
};
