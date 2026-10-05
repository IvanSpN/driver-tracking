import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';

@Controller()
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('drivers/:driverId/shifts')
  list(@Param('driverId') driverId: string) {
    return this.shiftsService.list(driverId);
  }

  @Post('drivers/:driverId/shifts')
  create(@Param('driverId') driverId: string, @Body() dto: CreateShiftDto) {
    return this.shiftsService.create(driverId, dto);
  }

  @Patch('shifts/:id')
  update(@Param('id') id: string, @Body() dto: UpdateShiftDto) {
    return this.shiftsService.update(id, dto);
  }

  @Post('shifts/:id/close')
  close(@Param('id') id: string, @Body() dto: CloseShiftDto) {
    return this.shiftsService.close(id, dto);
  }

  @Delete('shifts/:id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.shiftsService.remove(id);
  }
}
