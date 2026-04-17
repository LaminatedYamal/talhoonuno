export const currency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

export const expenseCategoryLabel = (c: string) => {
  switch (c) {
    case "meat_purchases":
      return "Meat purchases";
    case "supplies":
      return "Supplies";
    case "utilities":
      return "Utilities";
    case "wages":
      return "Wages";
    default:
      return "Other";
  }
};

export const expenseCategories = [
  "meat_purchases",
  "supplies",
  "utilities",
  "wages",
  "other",
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];
