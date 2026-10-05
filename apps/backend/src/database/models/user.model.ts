import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  Unique,
  AllowNull,
} from 'sequelize-typescript';

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
}

@Table({ tableName: 'users', underscored: true })
export class User extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Unique
  @AllowNull(false)
  @Column(DataType.STRING)
  declare email: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING, field: 'password_hash' })
  declare passwordHash: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING, field: 'full_name' })
  declare fullName: string;

  @Default(UserRole.ADMIN)
  @Column(DataType.ENUM(...Object.values(UserRole)))
  declare role: UserRole;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, field: 'is_active' })
  declare isActive: boolean;
}
