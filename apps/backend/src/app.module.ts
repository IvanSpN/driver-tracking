import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { PayrollModule } from './payroll/payroll.module';
import { ShiftsModule } from './shifts/shifts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    DriversModule,
    PayrollModule,
    ShiftsModule,
    SequelizeModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        dialect: 'postgres',

        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),

        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),

        // Схема теперь только через миграции (`npm run migrate` в apps/backend) — autoLoadModels
        // нужен лишь чтобы Sequelize знал об атрибутах моделей для запросов.
        autoLoadModels: true,
        synchronize: false,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
