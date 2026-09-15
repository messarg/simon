/**
 * Armenian UI strings. PRD §4.2, §20.3; vocabulary per the i18n-hy skill.
 *
 * Every user-facing string lives here — none in components. Keys are by meaning. The
 * Armenian is indicative until a native speaker reviews it (§8.5, §26 Q9).
 */
export const hy = {
  app: { name: "Սիմոն" },
  nav: {
    sell: "Վաճառել", debts: "Պարտքեր", stock: "Պահեստ", shift: "Հերթափոխ",
    home: "Գլխավոր", reports: "Հաշվետվություն", products: "Ապրանքներ", customers: "Հաճախորդներ",
    suppliers: "Մատակարարներ", settings: "Կարգավորումներ", more: "Ավելին",
  },
  common: {
    cancel: "Չեղարկել", save: "Պահպանել", close: "Փակել", back: "Հետ", done: "Պատրաստ է", next: "Առաջ",
    undo: "Հետարկել", retry: "Կրկին փորձել", signOut: "Դուրս գալ", loading: "Բեռնվում է…", search: "Փնտրել",
    edit: "Խմբագրել", add: "Ավելացնել", yes: "Այո", no: "Ոչ", total: "Ընդամենը", clear: "Մաքրել",
  },
  status: {
    shiftOpen: "Հերթափոխ բաց", shiftClosed: "Հերթափոխ փակ", online: "Կապը կա",
    offline: "Աշխատում է առանց կապի։ Վաճառքները կպահվեն։",
    pending: { one: "{n} վաճառք դեռ չի ուղարկվել", other: "{n} վաճառք դեռ չի ուղարկվել" },
    staleSettings: "Կարգավորումները վաղուց չեն թարմացվել",
    practice: "Փորձնական ռեժիմ",
  },
  signIn: {
    title: "Ո՞վ է աշխատում", enterPin: "Մուտքագրե՛ք PIN-ը", forUser: "{name}",
    attemptsLeft: { one: "Մնաց {n} փորձ", other: "Մնաց {n} փորձ" },
    locked: "Կողպված է։ Փորձե՛ք {n} րոպեից կամ դիմե՛ք ադմինին։",
    tooMany: "Չափից շատ փորձեր։ Սպասե՛ք {n} վայրկյան։",
    forgot: "Մոռացե՞լ եք",
    recoveryTitle: "Վերականգնման կոդ",
    recoveryHint: "Մուտքագրե՛ք թղթի վրա գրված կոդը",
    recoveryNew: "Ձեր նոր վերականգնման կոդը։ Գրե՛ք թղթի վրա և պահե՛ք այս համակարգչից հեռու։",
    wrongDevice: "Սխալ PIN",
  },
  setup: {
    welcome: "Բարի գալուստ Սիմոն",
    welcomeHint: "Երկու հարց, և խանութը պատրաստ է աշխատելու։",
    shopName: "Խանութի անունը", shopNamePlaceholder: "օր.՝ Շինանյութ «Արարատ»",
    ownerName: "Ձեր անունը", ownerPin: "Ընտրե՛ք PIN (4–8 թիվ)", ownerPinRepeat: "Կրկնե՛ք PIN-ը",
    pinMismatch: "PIN-երը չեն համընկնում",
    recoveryTitle: "Գրե՛ք այս կոդը թղթի վրա",
    recoveryHint: "Եթե երբևէ կողպվեք, սա ձեր միակ ճանապարհն է։ Այն ցույց է տրվում միայն մեկ անգամ։",
    recoveryConfirm: "Գրեցի, շարունակել",
    taxPending: "Հարկային ռեժիմը դեռ նշված չէ։ Մինչ այդ վաճառք չի կարող ավարտվել։",
  },
  placeholder: {
    comingTitle: "{screen}",
    comingHint: "Այս բաժինը պատրաստվում է։",
  },
  keypad: { clear: "Մաքրել", backspace: "Ջնջել" },
  problems: {
    "credit-limit-exceeded": "Սահմանաչափը գերազանցված է",
    "customer-blocked": "Այս հաճախորդին պարտքով վաճառք չի թույլատրվում",
    "insufficient-stock-strict": "Պահեստում չկա բավարար քանակ",
    "return-exceeds-sold": "Վերադարձը գերազանցում է վաճառվածը",
    "discount-above-cap": "Զեղչը գերազանցում է թույլատրվածը",
    "tax-regime-not-set": "Հարկային ռեժիմը նշված չէ",
    "shift-not-open": "Հերթափոխը բաց չէ",
    "shift-has-open-baskets": "Կան չավարտված վաճառքներ",
    "duplicate-barcode": "Այս շտրիխկոդն արդեն կա",
    "immutable-after-movements": "Չափման միավորը այլևս չի փոխվում",
    "pin-incorrect": "Սխալ PIN",
    "account-locked": "Կողպված է",
    "too-many-attempts": "Չափից շատ փորձեր",
    "not-permitted": "Ձեր իրավունքները չեն բավարարում",
    "session-expired": "Մուտքագրե՛ք PIN-ը",
    "not-found": "Չի գտնվել",
    "malformed-request": "Սխալ հարցում",
    "illegal-transition": "Այս վաճառքն արդեն փակված է",
    "internal-error": "Սխալ։ Տվյալները պահպանված են։",
    "setup-required": "Խանութը դեռ կարգավորված չէ",
    "reauth-required": "Անհրաժեշտ է ադմինի PIN",
    network: "Կապ չկա։ Այս գործողությունը հասանելի չէ։",
  },
  warnings: {
    "insufficient-stock": "Պահեստում նշված է 0։ Վաճառքը կշարունակվի։",
    "customer-blocked-on-sync": "Հաճախորդն արգելափակվել է այս վաճառքից հետո",
    "credit-limit-exceeded-on-sync": "Պարտքը գերազանցել է սահմանաչափը",
    "product-deactivated-on-sync": "Ապրանքն այլևս ակտիվ չէ",
    "held-basket-after-close": "Չավարտված զամբյուղ՝ փակված հերթափոխից",
    "return-exceeds-sold-on-sync": "Վերադարձը գերազանցել է վաճառվածը",
    "price-changed-on-sync": "Գինը փոխվել է այս վաճառքից հետո",
    "tax-rate-changed-on-sync": "Հարկի դրույքը փոխվել է այս վաճառքից հետո",
    "device-clock-skew": "Սարքի ժամացույցը սխալ է",
    "discount-above-cap-on-sync": "Զեղչը գերազանցել է թույլատրվածը",
    "cost-variance": "Ինքնարժեքը սովորականից տարբերվում է",
  },
} as const;

export type Strings = typeof hy;
