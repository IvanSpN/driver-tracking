import { Table, Column, Model, DataType, PrimaryKey, Default, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Driver } from './driver.model';

@Table({
  tableName: 'shifts',
  underscored: true,
  indexes: [{ fields: ['driver_id', 'start_date'] }],
})
export class Shift extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Driver)
  @AllowNull(false)
  @Column({ type: DataType.UUID, field: 'driver_id' })
  declare driverId: string;

  @BelongsTo(() => Driver, { onDelete: 'CASCADE' })
  declare driver: Driver;

  @AllowNull(false)
  @Column({ type: DataType.DATEONLY, field: 'start_date' })
  declare startDate: string;

  // null = вахта идёт прямо сейчас, конец не определён
  @Column({ type: DataType.DATEONLY, field: 'end_date' })
  declare endDate: string | null;

  // снапшот с водителя на момент создания вахты
  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN, field: 'is_official' })
  declare isOfficial: boolean;

  @Column(DataType.TEXT)
  declare note: string | null;
}
