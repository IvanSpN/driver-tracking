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
import { User } from './user.model';

@Table({
  tableName: 'drivers',
  underscored: true,
  paranoid: true,
  indexes: [
    { fields: ['last_name', 'first_name'] },
    { fields: ['deleted_at'] },
  ],
})
export class Driver extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING, field: 'last_name' })
  declare lastName: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING, field: 'first_name' })
  declare firstName: string;

  @Column({ type: DataType.STRING, field: 'middle_name' })
  declare middleName: string | null;

  @Column(DataType.STRING)
  declare phone: string | null;

  // Текущий статус занятости. Снапшот на момент вахты будет лежать в shifts.is_official.
  @Default(false)
  @Column({ type: DataType.BOOLEAN, field: 'is_official' })
  declare isOfficial: boolean;

  @Column(DataType.TEXT)
  declare note: string | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, field: 'created_by_id' })
  declare createdById: string | null;

  @BelongsTo(() => User, { onDelete: 'SET NULL' })
  declare createdBy: User;
}
