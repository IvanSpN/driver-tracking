import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { UpsertAccrualDto } from './dto/upsert-accrual.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';

@Controller()
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('drivers/:driverId/payroll')
  getPayroll(@Param('driverId') driverId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.payrollService.listPayroll(driverId, from, to);
  }

  @Put('drivers/:driverId/accruals/:period')
  upsertAccrual(
    @Param('driverId') driverId: string,
    @Param('period') period: string,
    @Body() dto: UpsertAccrualDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.payrollService.upsertAccrual(driverId, period, dto, user.sub);
  }

  @Delete('drivers/:driverId/accruals/:period')
  @HttpCode(204)
  deleteAccrual(@Param('driverId') driverId: string, @Param('period') period: string) {
    return this.payrollService.deleteAccrual(driverId, period);
  }

  @Get('drivers/:driverId/payments')
  listPayments(@Param('driverId') driverId: string, @Query('period') period?: string) {
    return this.payrollService.listPayments(driverId, period);
  }

  @Post('drivers/:driverId/payments')
  createPayment(
    @Param('driverId') driverId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.payrollService.createPayment(driverId, dto, user.sub);
  }

  @Patch('payments/:id')
  updatePayment(@Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.payrollService.updatePayment(id, dto);
  }

  @Delete('payments/:id')
  @HttpCode(204)
  deletePayment(@Param('id') id: string) {
    return this.payrollService.deletePayment(id);
  }
}
