import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Shift } from '../database/models/shift.model';
import { Driver } from '../database/models/driver.model';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';

@Module({
  imports: [SequelizeModule.forFeature([Shift, Driver])],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
