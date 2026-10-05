import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';
import { Shift } from '../database/models/shift.model';
import { Driver } from '../database/models/driver.model';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';

export interface CurrentShiftInfo {
  id: string;
  startDate: string;
  endDate: string | null;
  daysLeft: number | null;
}

function daysLeft(endDate: string | null): number | null {
  if (!endDate) return null;
  const end = new Date(`${endDate}T00:00:00Z`);
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return Math.round((end.getTime() - todayUtc.getTime()) / 86_400_000);
}

@Injectable()
export class ShiftsService {
  constructor(
    @InjectModel(Shift) private readonly shiftModel: typeof Shift,
    @InjectModel(Driver) private readonly driverModel: typeof Driver,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  list(driverId: string) {
    return this.shiftModel.findAll({
      where: { driverId },
      order: [['startDate', 'DESC']],
    });
  }

  async create(driverId: string, dto: CreateShiftDto) {
    const driver = await this.driverModel.findByPk(driverId);
    if (!driver) throw new NotFoundException('Водитель не найден');

    const endDate = dto.endDate ?? null;
    this.assertDateOrder(dto.startDate, endDate);
    if (!endDate) await this.assertNoOpenShift(driverId);
    await this.assertNoOverlap(driverId, dto.startDate, endDate);

    return this.shiftModel.create({
      driverId,
      startDate: dto.startDate,
      endDate,
      isOfficial: driver.isOfficial,
      note: dto.note,
    });
  }

  async update(id: string, dto: UpdateShiftDto) {
    const shift = await this.findOrFail(id);
    const startDate = dto.startDate ?? shift.startDate;
    const endDate = dto.endDate !== undefined ? dto.endDate : shift.endDate;

    this.assertDateOrder(startDate, endDate);

    if (!endDate) await this.assertNoOpenShift(shift.driverId, id);
    await this.assertNoOverlap(shift.driverId, startDate, endDate, id);

    await shift.update({ startDate, endDate, note: dto.note });
    return shift;
  }

  close(id: string, dto: CloseShiftDto) {
    return this.update(id, { endDate: dto.endDate });
  }

  async remove(id: string) {
    const shift = await this.findOrFail(id);
    await shift.destroy();
  }

  async getCurrentShiftByDriver(
    driverIds: string[],
  ): Promise<Map<string, CurrentShiftInfo>> {
    if (driverIds.length === 0) return new Map();

    const rows = await this.sequelize.query<{
      driver_id: string;
      id: string;
      start_date: string;
      end_date: string | null;
    }>(
      `
      SELECT DISTINCT ON (driver_id) id, driver_id, start_date, end_date
      FROM shifts
      WHERE driver_id IN (:driverIds)
        AND start_date <= CURRENT_DATE
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      ORDER BY driver_id, start_date DESC
      `,
      { replacements: { driverIds }, type: QueryTypes.SELECT },
    );

    return new Map(
      rows.map((r) => [
        r.driver_id,
        {
          id: r.id,
          startDate: r.start_date,
          endDate: r.end_date,
          daysLeft: daysLeft(r.end_date),
        },
      ]),
    );
  }

  private async findOrFail(id: string) {
    const shift = await this.shiftModel.findByPk(id);
    if (!shift) throw new NotFoundException('Вахта не найдена');
    return shift;
  }

  private assertDateOrder(startDate: string, endDate: string | null) {
    if (endDate && endDate < startDate) {
      throw new BadRequestException(
        'Дата окончания вахты не может быть раньше даты начала',
      );
    }
  }

  private async assertNoOpenShift(driverId: string, excludeId?: string) {
    const rows = await this.sequelize.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM shifts
         WHERE driver_id = :driverId AND end_date IS NULL
           AND (:excludeId::uuid IS NULL OR id != :excludeId::uuid)
       ) AS "exists"`,
      {
        replacements: { driverId, excludeId: excludeId ?? null },
        type: QueryTypes.SELECT,
      },
    );
    if (rows[0].exists) {
      throw new ConflictException({
        message: 'У водителя уже есть открытая вахта',
        code: 'SHIFT_ALREADY_OPEN',
      });
    }
  }

  private async assertNoOverlap(
    driverId: string,
    startDate: string,
    endDate: string | null,
    excludeId?: string,
  ) {
    const rows = await this.sequelize.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM shifts
         WHERE driver_id = :driverId
           AND (:excludeId::uuid IS NULL OR id != :excludeId::uuid)
           AND daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]')
               && daterange(:startDate::date, COALESCE(:endDate::date, 'infinity'::date), '[]')
       ) AS "exists"`,
      {
        replacements: {
          driverId,
          startDate,
          endDate,
          excludeId: excludeId ?? null,
        },
        type: QueryTypes.SELECT,
      },
    );
    if (rows[0].exists) {
      throw new ConflictException({
        message: 'Вахта пересекается с уже существующей',
        code: 'SHIFT_OVERLAP',
      });
    }
  }
}
