const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;

export function validateGuestNames(names: string[]): string | null {
  if (names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) return 'تعداد مهمان‌ها باید بین ۳ تا ۸ نفر باشد.';
  if (names.some((name) => !name.trim())) return 'نام همهٔ مهمان‌ها را وارد کنید.';
  const normalized = names.map((name) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fa'));
  if (new Set(normalized).size !== normalized.length) return 'برای ساخت دعوت‌نامهٔ اختصاصی، نام‌ها باید متفاوت باشند.';
  if (names.some((name) => name.trim().length > 32)) return 'نام هر مهمان حداکثر می‌تواند ۳۲ نویسه باشد.';
  return null;
}
