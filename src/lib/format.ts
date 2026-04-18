export const expenseCategories = [
  "meat_purchases",
  "supplies",
  "utilities",
  "wages",
  "rent",
  "other",
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];
