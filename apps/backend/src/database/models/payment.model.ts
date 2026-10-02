import { Table, Column, Model, DataType, PrimaryKey, Default, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Driver } from './driver.model';
import { User } from './user.model';

export enum PayChannel {
  WHITE = 'WHITE',
  BLACK = 'BLACK',
}

export enum PaymentType {
  ADVANCE = 'ADVANCE',
  SALARY = 'SALARY',
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK = 'BANK',
  CARD = 'CARD',
  OTHER = 'OTHER',
}

// Факт выплаты. Строк на месяц может быть сколько угодно (обычно минимум 2 — аванс и получка).
@Table({
  tableName: 'payments',
  underscored: true,
  indexes: [{ fields: ['driver_id', 'period'] }, { fields: ['paid_at'] }],
})
export class Payment extends Model {
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
  @Column(DataType.DATEONLY) // за какой месяц
  declare period: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(PayChannel)))
  declare channel: PayChannel;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(PaymentType)))
  declare type: PaymentType;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT, field: 'amount_minor' })
  declare amountMinor: string;

  @AllowNull(false)
  @Column({ type: DataType.DATEONLY, field: 'paid_at' }) // когда фактически отдали
  declare paidAt: string;

  @Default(PaymentMethod.CASH)
  @Column(DataType.ENUM(...Object.values(PaymentMethod)))
  declare method: PaymentMethod;

  @Column(DataType.TEXT)
  declare note: string | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, field: 'created_by_id' })
  declare createdById: string | null;

  @BelongsTo(() => User, { onDelete: 'SET NULL' })
  declare createdBy: User;
}
