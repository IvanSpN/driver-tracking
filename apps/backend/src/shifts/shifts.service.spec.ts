import { BadRequestException, ConflictException } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { validate } from 'class-validator';
import { Driver } from '../database/models/driver.model';
import { Shift } from '../database/models/shift.model';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';

describe('ShiftsService dates', () => {
  const shift = {
    driverId: 'driver-id',
    startDate: '2026-10-01',
    endDate: '2026-10-15',
    update: jest.fn(),
  };
  const shifts = { findByPk: jest.fn(), create: jest.fn() };
  const drivers = { findByPk: jest.fn() };
  const connection = { query: jest.fn() };
  const service = new ShiftsService(
    shifts as unknown as typeof Shift,
    drivers as unknown as typeof Driver,
    connection as unknown as Sequelize,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    shifts.findByPk.mockResolvedValue(shift);
    drivers.findByPk.mockResolvedValue({ isOfficial: true });
    connection.query.mockResolvedValue([{ exists: false }]);
  });

  it('rejects a reversed date range before querying or writing a shift', async () => {
    await expect(
      service.create('driver-id', {
        startDate: '2026-10-15',
        endDate: '2026-10-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(shifts.create).not.toHaveBeenCalled();
    expect(connection.query).not.toHaveBeenCalled();
  });

  it('validates a changed start date against the existing end date', async () => {
    await expect(
      service.update('shift-id', { startDate: '2026-10-16' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(shift.update).not.toHaveBeenCalled();
  });

  it('updates both dates and excludes the edited shift from overlap checks', async () => {
    await service.update('shift-id', {
      startDate: '2026-10-03',
      endDate: '2026-10-20',
    });
    expect(shift.update).toHaveBeenCalledWith({
      startDate: '2026-10-03',
      endDate: '2026-10-20',
      note: undefined,
    });
    expect(connection.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        replacements: {
          driverId: 'driver-id',
          startDate: '2026-10-03',
          endDate: '2026-10-20',
          excludeId: 'shift-id',
        },
      }),
    );
  });

  it('clears the end date and checks for another open shift', async () => {
    await service.update('shift-id', { endDate: null });
    expect(shift.update).toHaveBeenCalledWith({
      startDate: '2026-10-01',
      endDate: null,
      note: undefined,
    });
    expect(connection.query).toHaveBeenCalledTimes(2);
  });

  it('rejects reopening when another open shift exists', async () => {
    connection.query.mockResolvedValueOnce([{ exists: true }]);
    await expect(
      service.update('shift-id', { endDate: null }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(shift.update).not.toHaveBeenCalled();
  });

  it('allows a one-day shift and leaves omitted dates unchanged', async () => {
    await service.update('shift-id', { startDate: '2026-10-15' });
    expect(shift.update).toHaveBeenCalledWith({
      startDate: '2026-10-15',
      endDate: '2026-10-15',
      note: undefined,
    });
  });
});

describe('shift date validation', () => {
  it.each([CreateShiftDto, UpdateShiftDto])(
    'accepts clearing the optional end date in %p',
    async (Dto) => {
      const dto = Object.assign(new Dto(), {
        startDate: '2026-10-01',
        endDate: null,
      });
      expect(await validate(dto)).toEqual([]);
    },
  );

  it.each(['2026-02-30', '2026-10-01T12:00:00Z', ''])(
    'rejects an invalid end date: %s',
    async (endDate) => {
      for (const Dto of [CreateShiftDto, UpdateShiftDto, CloseShiftDto]) {
        const dto = Object.assign(new Dto(), {
          startDate: '2026-10-01',
          endDate,
        });
        expect(
          (await validate(dto)).some((error) => error.property === 'endDate'),
        ).toBe(true);
      }
    },
  );
});
