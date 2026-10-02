// Sequelize+pg отдаёт BIGINT колонки строкой (защита от потери точности), а суммы в копейках
// безопасно влезают в Number (до 9e15) — см. docs/mvp-spec.md §2.4.
export const toNumber = (v: string | number): number => Number(v);
