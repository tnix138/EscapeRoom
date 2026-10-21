import type { TicketPunchSelection } from './contracts';

export function normalizeDoorCode(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/\D/g, '');
}

export function isCorrectTicketSelection(selection: TicketPunchSelection, solution: TicketPunchSelection): boolean {
  return selection.emblem === solution.emblem && selection.actNumber === solution.actNumber && selection.rowCode === solution.rowCode;
}
