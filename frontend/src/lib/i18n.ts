export type Language = 'en' | 'am' | 'om';
export type Theme = 'light' | 'dark';

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('zew_language');
  return stored === 'am' || stored === 'om' ? stored : 'en';
}

export function storeLanguage(language: Language) {
  if (typeof window !== 'undefined') localStorage.setItem('zew_language', language);
}

export const translations: Record<Language, Record<string, string>> = {
  en: {
    cityBadge: 'ADDIS ABABA',
    heroEyebrow: 'SHARED COMMUTES & JOURNEYS FOR ADDIS ABABA',
    heroTitleLine1: 'Every journey.',
    heroTitleLine2: 'Better together.',
    heroDesc:
      'Plan a shared journey in Addis Ababa. Choose your route, departure time and seats, then review matching rides.',
    signInToRide: 'Find a ride',
    createAccount: 'Create Account',
    maxFareSavings: 'Projected fare savings',
    maxPickupSpan: 'Max Pickup Span',
    corridorVerified: 'Preview environment',
    howItWorks: 'How It Works',
    fareSplitting: 'Fare Splitting',
    logIn: 'Log In',
    signUpBtn: 'Sign Up & Get Started',
    signOut: 'Log Out',

    step1Title: 'Set Your Journey',
    step1Desc: 'Choose your pickup, destination, departure time and number of seats.',
    step2Title: 'Review Matching Rides',
    step2Desc:
      'Compare available departures and review the total fare before confirming your reservation.',
    step3Title: 'Follow Your Ride',
    step3Desc: 'See driver acceptance, your boarding code and trip updates in My rides.',

    showcaseKicker: 'DYNAMIC FARE SPLITTING',
    showcaseTitle: 'Shared Comfort. Unbeatable Value.',
    showcaseDesc:
      'See how a projected trip total changes as passengers share the fare. Road pricing is not connected.',
    showcaseItem1: 'Transparent Fare Splits: Total route fare split equally among passengers.',
    showcaseItem2: 'Direction matching does not verify road safety or reachability.',
    showcaseItem3: 'Driver and support controls are available only in the preview environment.',
    joinZew: 'Join Zew Today',

    planAhead: 'Plan ahead',
    myRides: 'My rides',
    savedCommutes: 'Saved commutes',
    passengerRequests: 'Passenger requests',
    earningsPayouts: 'Earnings & Payouts',
    phoneDispatch: 'Phone Dispatch Desk',
    liveRadar: 'Driver radar',
    systemOverview: 'System Overview',
    driverVerification: 'Driver profiles',
    auditLog: 'Activity log',

    whereHeading: 'Where are you heading?',
    pickup: 'PICKUP',
    dropoff: 'DROP-OFF',
    departureAddisTime: 'Departure · Addis time',
    capacityRange: 'Capacity Range (1–4 riders)',
    dynamicFareBreakdown: 'Dynamic Fare Breakdown',
    solorate: 'Solo rate',
    solototal: 'Solo total',
    findMyRide: 'Find my ride',
    saveThisCommute: 'Save this commute',
    moneySavingsTip: 'Money Savings',
    howZewWorks: 'How Zew works',

    langEn: 'English',
    langAm: 'አማርኛ',
    langOm: 'Afaan Oromoo',

    lightTheme: 'Light Theme',
    darkTheme: 'Dark Theme',
    exploreDemo: 'Find a ride',
    demoNotice: 'Preview environment. No live rides or payments.',
    languageLabel: 'Language',
    maximumFare: 'Maximum you can afford per seat (ETB)',
    findMyGroup: 'Find my group',
    findingGroup: 'Finding your group…',
    workspaceControls: 'Workspace controls',
  },
  am: {
    cityBadge: 'አዲስ አበባ',
    heroEyebrow: 'የጋራ ጉዞዎች እና መስመሮች ለአዲስ አበባ',
    heroTitleLine1: 'ማንኛውም ጉዞ።',
    heroTitleLine2: 'አብሮ የተሻለ ነው።',
    heroDesc: 'ለአዲስ አበባ የጋራ ጉዞ ሀሳብ። በዚህ የሙከራ ማሳያ ጉዞ፣ ተጓዦች፣ አሽከርካሪዎች እና ክፍያዎች ሁሉ ምሳሌዎች ናቸው።',
    signInToRide: 'ለመጓዝ ይግቡ',
    createAccount: 'መለያ ይክፈቱ',
    maxFareSavings: 'ከፍተኛ የክፍያ ቅናሽ',
    maxPickupSpan: 'ፈጣን የመጫኛ ጊዜ',
    corridorVerified: 'የሙከራ ማሳያ',
    howItWorks: 'እንዴት እንደሚሰራ',
    fareSplitting: 'የክፍያ ክፍፍል',
    logIn: 'ይግቡ',
    signUpBtn: 'መለያ ይክፈቱ',
    signOut: 'ውጣ',

    step1Title: 'ጉዞዎን ያቅዱ',
    step1Desc: 'በአዲስ አበባ ውስጥ መነሻና መድረሻ ቦታዎን በካርታ ወይም በቦታ ፍለጋ ይምረጡ።',
    step2Title: 'የሚስማሙ ጉዞዎችን ይመልከቱ',
    step2Desc: 'የሚገኙ ጉዞዎችን ያወዳድሩ፤ ቦታ ከማስያዝዎ በፊት ጠቅላላ ክፍያውን ይመልከቱ።',
    step3Title: 'ጉዞዎን ይከታተሉ',
    step3Desc: 'የአሽከርካሪውን ማረጋገጫ፣ የመሳፈሪያ ኮድ እና የጉዞ ሁኔታ በየእኔ ጉዞዎች ይመልከቱ።',

    showcaseKicker: 'ተለዋዋጭ የክፍያ ክፍፍል',
    showcaseTitle: 'የጋራ ምቾት። አነስተኛ ክፍያ።',
    showcaseDesc: 'የሙከራ 360 ብር ክፍያ በ4 ሰዎች ሲከፈል ለእያንዳንዱ 90 ብር ይሆናል። ይህ ምሳሌ ብቻ ነው።',
    showcaseItem1: 'ግልጽ የክፍያ ክፍፍል፡ አጠቃላይ ታሪፍ በተጓዦች መካከል እኩል ይከፈላል።',
    showcaseItem2: 'የመስመር ግጥሚያው የሙከራ ነው፤ የመንገድ ደህንነትን አያረጋግጥም።',
    showcaseItem3: 'የአሽከርካሪ እና የድጋፍ ቁጥጥሮች የሙከራ ማሳያዎች ናቸው።',
    joinZew: 'ዛሬውኑ ዜውን ይቀላቀሉ',

    planAhead: 'ጉዞ ያቅዱ',
    myRides: 'የእኔ ጉዞዎች',
    savedCommutes: 'የተቀመጡ ጉዞዎች',
    passengerRequests: 'የተጓዥ ጥያቄዎች',
    earningsPayouts: 'ገቢ እና ክፍያዎች',
    phoneDispatch: 'የስልክ ትእዛዝ ማስተናገጃ',
    liveRadar: 'የአሽከርካሪዎች ራዳር',
    systemOverview: 'የሲስተም አጠቃላይ እይታ',
    driverVerification: 'የአሽከርካሪ ማረጋገጫ',
    auditLog: 'የእንቅስቃሴ መዝገብ',

    whereHeading: 'ወዴት እየተጓዙ ነው?',
    pickup: 'መነሻ ቦታ',
    dropoff: 'መድረሻ ቦታ',
    departureAddisTime: 'የመነሻ ሰዓት (አዲስ አበባ)',
    capacityRange: 'የተጓዦች ብዛት (1-4 ተጓዥ)',
    dynamicFareBreakdown: 'ተለዋዋጭ የክፍያ ዝርዝር',
    solorate: 'የነጠላ ታሪፍ',
    solototal: 'የነጠላ ክፍያ',
    findMyRide: 'ጉዞዬን ፈልግ',
    saveThisCommute: 'ይህንን ጉዞ አስቀምጥ',
    moneySavingsTip: 'የገንዘብ ቁጠባ',
    howZewWorks: 'ዜው እንዴት እንደሚሰራ',

    langEn: 'English',
    langAm: 'አማርኛ',
    langOm: 'Afaan Oromoo',

    lightTheme: 'ብሩህ ገጽታ',
    darkTheme: 'ጨለምተኝነት ገጽታ',
    exploreDemo: 'ጉዞ ይፈልጉ',
    demoNotice: 'የሙከራ ማሳያ። እውነተኛ ጉዞ ወይም ክፍያ የለም።',
    languageLabel: 'ቋንቋ',
    maximumFare: 'በአንድ መቀመጫ መክፈል የሚችሉት ከፍተኛ ዋጋ (ብር)',
    findMyGroup: 'ቡድኔን ፈልግ',
    findingGroup: 'ቡድንዎን በመፈለግ ላይ…',
    workspaceControls: 'የመስሪያ ቦታ ቁጥጥሮች',
  },
  om: {
    cityBadge: 'FINFINNEE',
    heroEyebrow: 'IMALA WALIIN JOORNIIN FINFINNEEDHAF',
    heroTitleLine1: 'Imala hundumaa.',
    heroTitleLine2: 'Waliin ni wayya.',
    heroDesc:
      'Yaada imala waliinii Finfinneef. Agarsiisa yaalii kana keessatti imaltoonni, konkolaachiftoonni, imalli fi kaffaltiin fakkeenya qofa.',
    signInToRide: 'Imaluuf Seenaa',
    createAccount: 'Akkaawuntii Banadhaa',
    maxFareSavings: 'Quusannoo Kaffaltii Olaanaa',
    maxPickupSpan: 'Saffisa Fe’umsaa',
    corridorVerified: 'Agarsiisa yaalii',
    howItWorks: 'Akkaata Subii',
    fareSplitting: 'Qoodinsa Kaffaltii',
    logIn: 'Seenaa',
    signUpBtn: 'Galmaa’aa Jalqabaa',
    signOut: 'Ba’aa',

    step1Title: 'Imala Keessan Karoorsaa',
    step1Desc: 'Iddoo ka’umsaa fi ga’umsaa Finfinnee keessa kaartaa ykn barbaachaan filadhaa.',
    step2Title: 'Imaloota Walsiman Ilaalaa',
    step2Desc: 'Imaloota jiran wal bira qabaa; teessoo qabachuu dura kaffaltii waliigalaa ilaalaa.',
    step3Title: 'Imala Keessan Hordofaa',
    step3Desc:
      'Fudhatama konkolaachisaa, koodii yaabbannoo fi haala imalaa Imaloota Koo keessatti ilaalaa.',

    showcaseKicker: 'QOODINSA KAFFALTII JIJJIIRAMA A',
    showcaseTitle: 'Mijaawummaa Waliinii. Gatiin Muraasa.',
    showcaseDesc:
      'Kaffaltii fakkeenyaa 360 ETB namoota 4 waliin qooduun nama tokkoof 90 ETB ta’a. Kun fakkeenya qofa.',
    showcaseItem1:
      'Qoodinsa Kaffaltii Qulqulluu: Gatiin karaa hundaa imaltoota garee gidduutti qixa qoodama.',
    showcaseItem2: 'Walitti firoomsi karaa yaalii qofa; nageenya karaa hin mirkaneessu.',
    showcaseItem3: 'To’annoon konkolaachisaa fi deeggarsaa agarsiisa yaalii qofa.',
    joinZew: 'Har’uma Zew Ttasaa',

    planAhead: 'Imala Karoorsaa',
    myRides: 'Imaloota Kooy',
    savedCommutes: 'Imaloota Olka’aman',
    passengerRequests: 'Gaaffii Imaltootaa',
    earningsPayouts: 'Galii & Kaffaltii',
    phoneDispatch: 'Teessoo Bilbilaa',
    liveRadar: 'Raadaarii Konkolaachisaa',
    systemOverview: 'Ibsa Waliigalaa Sirnaa',
    driverVerification: 'Mirkaneessa Konkolaachisaa',
    auditLog: 'Galmee Hordoffii',

    whereHeading: 'Gara kam deemuuf jirtu?',
    pickup: "IDDOO KA'UMSAA",
    dropoff: "IDDOO GA'UMSAA",
    departureAddisTime: "Yeroo Ka'umsaa (Finfinnee)",
    capacityRange: 'Baayyina Imaltootaa (1–4)',
    dynamicFareBreakdown: 'Tarree Kaffaltii Jijjiiramaa',
    solorate: 'Gatii Kophaa',
    solototal: "Ida'ama Kophaa",
    findMyRide: 'Imala Koo Barbaadi',
    saveThisCommute: "Imala Kana Olka'i",
    moneySavingsTip: 'Quusannoo Maallaqaa',
    howZewWorks: 'Zew Akkaata Tajaajilaa',

    langEn: 'English',
    langAm: 'አማርኛ',
    langOm: 'Afaan Oromoo',

    lightTheme: 'Bariisaa (Light)',
    darkTheme: 'Dukkana (Dark)',
    exploreDemo: 'Imala barbaadaa',
    demoNotice: 'Agarsiisa yaalii. Imalli fi kaffaltiin dhugaa hin jiru.',
    languageLabel: 'Afaan',
    maximumFare: 'Gatii ol aanaa teessoo tokkoof kaffaluu dandeessan (ETB)',
    findMyGroup: 'Garee koo barbaadi',
    findingGroup: 'Garee keessan barbaadaa…',
    workspaceControls: 'To’annoo bakka hojii',
  },
};

export function getTranslation(lang: Language, key: string): string {
  return translations[lang]?.[key] || translations['en']?.[key] || key;
}
