import { BadRequestException } from '@nestjs/common';

const PERIOD_RE = /^\d{4}-\d{2}$/;

// '2026-09' -> '2026-09-01' (для хранения и фильтрации в БД)
export function parsePeriod(period: string): string {
  if (!PERIOD_RE.test(period)) {
    throw new BadRequestException('Период должен быть в формате YYYY-MM');
  }
  return `${period}-01`;
}

// '2026-09-01' -> '2026-09' (для ответа клиенту)
export function formatPeriod(date: string): string {
  return date.slice(0, 7);
}
