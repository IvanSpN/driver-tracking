import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Accrual } from '../database/models/accrual.model';
import { Payment } from '../database/models/payment.model';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

@Module({
  imports: [SequelizeModule.forFeature([Accrual, Payment])],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
