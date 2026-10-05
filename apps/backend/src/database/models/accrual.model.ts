import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Driver } from './driver.model';
import { User } from './user.model';

// Начисление за месяц: ровно одна строка на (водитель, месяц).
@Table({
  tableName: 'accruals',
  underscored: true,
  indexes: [{ unique: true, fields: ['driver_id', 'period'] }],
})
export class Accrual extends Model {
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
  @Column(DataType.DATEONLY) // всегда 1-е число месяца
  declare period: string;

  @Default(0)
  @Column({ type: DataType.BIGINT, field: 'white_minor' })
  declare whiteMinor: string;

  @Default(0)
  @Column({ type: DataType.BIGINT, field: 'black_minor' })
  declare blackMinor: string;

  @Column(DataType.TEXT)
  declare note: string | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, field: 'created_by_id' })
  declare createdById: string | null;

  @BelongsTo(() => User, { onDelete: 'SET NULL' })
  declare createdBy: User;
}
