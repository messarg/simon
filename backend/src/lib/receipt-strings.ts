/**
 * Printed text. The API never sends prose (§15.2), but paper has to be in Armenian, so the
 * receipt's words live here as a resource and nowhere else in the backend.
 */
export const receiptHy = {
  practice: "ՓՈՐՁՆԱԿԱՆ",
  sale: "Վաճառք", return: "Վերադարձ", subtotal: "Ենթագումար", discount: "Զեղչ", tax: "ԱԱՀ", taxIncluded: "այդ թվում ԱԱՀ",
  rounding: "Կլորացում", total: "ԸՆԴԱՄԵՆԸ", cash: "Կանխիկ", card: "Քարտ", debt: "Պարտք", tendered: "Ստացված", change: "Մանր",
  cashier: "Գանձապահ", xReport: "X-հաշվետվություն", zReport: "Z-հաշվետվություն", openingFloat: "Սկզբնական գումար",
  cashSales: "Կանխիկ վաճառք", cardSales: "Քարտով վաճառք", repayments: "Պարտքի մարում", payIns: "Մուտք", refunds: "Վերադարձ",
  payOuts: "Ելք", drops: "Հանված պահարան", expected: "Պետք է լինի", counted: "Հաշվված", variance: "Տարբերություն",
  lateArrival: "ստացվել է փակումից հետո", repayment: "Պարտքի մարում", customer: "Հաճախորդ", remaining: "Մնացած պարտք", credit: "Կանխավճար", transferIn: "Ընդունված այլ հերթափոխից", transferOut: "Փոխանցված", reprint: "ԿՐԿՆՕՐԻՆԱԿ",
} as const;
