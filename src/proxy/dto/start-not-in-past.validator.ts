import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Múi giờ Việt Nam (UTC+7), cố định — bảo hiểm TNDS tính theo giờ VN, không DST.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Parse "dd/MM/yyyy" + "HH:mm" thành mốc thời gian UTC, coi input là giờ VN.
 * Trả về null nếu sai định dạng hoặc ngày/giờ không hợp lệ (vd 32/13, 25:99).
 */
export function parseVnDateTime(
  ngay: string,
  gio: string,
): number | null {
  const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ngay);
  const t = /^(\d{2}):(\d{2})$/.exec(gio);
  if (!d || !t) return null;

  const day = Number(d[1]);
  const month = Number(d[2]);
  const year = Number(d[3]);
  const hour = Number(t[1]);
  const minute = Number(t[2]);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;

  // Dựng mốc UTC tương ứng giờ VN, rồi kiểm tra rollover (vd 31/02 -> 03/03).
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - VN_OFFSET_MS;
  const back = new Date(utcMs + VN_OFFSET_MS);
  if (
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day
  ) {
    return null;
  }
  return utcMs;
}

/**
 * Parse "dd/MM/yyyy HH:mm" (ngày + giờ gộp 1 field, dùng cho đơn xe máy).
 * Trả về null nếu sai định dạng/giá trị.
 */
export function parseVnDateTimeCombined(value: string): number | null {
  const m = /^(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2})$/.exec(value);
  if (!m) return null;
  return parseVnDateTime(m[1], m[2]);
}

@ValidatorConstraint({ name: 'startNotInPast', async: false })
export class StartNotInPastConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as { NgayDau?: string; GioDau?: string };
    if (typeof obj.NgayDau !== 'string' || typeof obj.GioDau !== 'string') {
      // Format sai sẽ do @Matches báo lỗi riêng; ở đây bỏ qua để không trùng message.
      return true;
    }
    const startMs = parseVnDateTime(obj.NgayDau, obj.GioDau);
    if (startMs === null) return true; // ngày/giờ không hợp lệ — để validator format bắt.
    return startMs >= Date.now();
  }

  defaultMessage(): string {
    return 'Thời gian bắt đầu (NgayDau + GioDau) không được ở quá khứ';
  }
}

/**
 * Decorator gắn ở cấp class hoặc trên một field bất kỳ; đọc NgayDau + GioDau
 * từ object để chặn thời điểm bắt đầu nằm trong quá khứ (theo giờ VN).
 */
export function StartNotInPast(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: StartNotInPastConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'startNotInPastCombined', async: false })
export class StartNotInPastCombinedConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return true; // để @Matches bắt format.
    const startMs = parseVnDateTimeCombined(value);
    if (startMs === null) return true; // format/giá trị sai — nhường validator format.
    return startMs >= Date.now();
  }

  defaultMessage(): string {
    return 'Thời gian bắt đầu (ngay_dau) không được ở quá khứ';
  }
}

/**
 * Decorator cho field "dd/MM/yyyy HH:mm" gộp (đơn xe máy) — chặn quá khứ theo giờ VN.
 */
export function StartNotInPastCombined(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: StartNotInPastCombinedConstraint,
    });
  };
}
