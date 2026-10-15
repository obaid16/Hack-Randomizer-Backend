export const STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE'
});

export const VALID_STATUSES = Object.values(STATUS);

export const GENERATION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  ARCHIVED: 'ARCHIVED'
});

export const VALID_GENERATION_STATUSES = Object.values(GENERATION_STATUS);
