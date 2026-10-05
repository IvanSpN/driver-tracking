import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DriversService } from './drivers.service';
import { PayrollService } from '../payroll/payroll.service';
import { ShiftsService } from '../shifts/shifts.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';

@Controller('drivers')
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly payrollService: PayrollService,
    private readonly shiftsService: ShiftsService,
  ) {}

  @Get()
  async list(
    @Query('official') official?: string,
    @Query('archived') archived?: string,
  ) {
    const drivers = await this.driversService.list({
      official: official === undefined ? undefined : official === 'true',
      archived: archived === 'true',
    });

    const ids = drivers.map((d) => d.id);
    const [totals, currentShifts] = await Promise.all([
      this.payrollService.getTotalDueByDriver(ids),
      this.shiftsService.getCurrentShiftByDriver(ids),
    ]);

    return drivers.map((d) => ({
      ...d.toJSON<Record<string, unknown>>(),
      totalDueMinor: totals.get(d.id) ?? 0,
      currentShift: currentShifts.get(d.id) ?? null,
    }));
  }

  @Post()
  create(
    @Body() dto: CreateDriverDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.driversService.create(dto, user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.driversService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.driversService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.driversService.remove(id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id') id: string) {
    return this.driversService.restore(id);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  deletePermanently(@Param('id') id: string) {
    return this.driversService.deletePermanently(id);
  }
}
