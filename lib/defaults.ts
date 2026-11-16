import { DEFAULT_ENABLED_AMENITIES } from "@/lib/amenities";
import type { SectionKey, SectionRow, SiteSettings, SectionContent } from "@/types/content";

const l = (en: string, hi: string) => ({ en, hi });
const paras = (...p: string[]) => p.join("\n\n");

export const DEFAULT_SETTINGS: SiteSettings = {
  hotel: {
    name: "Hotel Asthara",
    tagline: l("Comfort in the heart of Rohtak", "रोहतक के दिल में आराम"),
    addressLine:
      "2nd Floor, Asthara Hotel, in front of PT Neki Ram Sharma Government College, beside Redtape Showroom",
    locality: "Model Town",
    city: "Rohtak",
    state: "Haryana",
    postalCode: "124001",
    country: "IN",
    latitude: 28.8863,
    longitude: 76.6133,
    mapsPlaceUrl: "",
    checkInTime: "12:00",
    checkOutTime: "11:00",
    alwaysOpenFrontDesk: true,
    deskOpens: "07:00",
    deskCloses: "23:00",
    currency: "INR",
  },
  contact: {
    phone: "",
    whatsapp: "",
    email: "",
    instagram: "hotelasthara_rohtak",
    facebook: "",
    googleBusinessUrl: "",
  },
  rating: { value: null, count: null, source: "", sourceUrl: "" },
  gst: {
    lowPercent: 5, // room tariff up to ₹7,500 per night
    highPercent: 18, // above ₹7,500
    thresholdPaise: 750_000,
    gstin: "",
    legalName: "Hotel Asthara",
    sacCode: "996311",
    invoicePrefix: "AST",
  },
  amenities: { enabled: DEFAULT_ENABLED_AMENITIES },
  nearby: [
    {
      id: "college",
      name: l("PT Neki Ram Sharma Government College", "पीटी नेकी राम शर्मा गवर्नमेंट कॉलेज"),
      distance: l("In front of the hotel", "होटल के ठीक सामने"),
      note: l("Across the road from our entrance.", "हमारे प्रवेश द्वार से सड़क के उस पार।"),
      icon: "GraduationCap",
    },
    {
      id: "market",
      name: l("Model Town market", "मॉडल टाउन मार्केट"),
      distance: l("Close by", "पास में"),
      note: l("Shops, cafés and everyday essentials.", "दुकानें, कैफ़े और रोज़मर्रा की ज़रूरतें।"),
      icon: "Store",
    },
    {
      id: "junction",
      name: l("Rohtak Junction railway station", "रोहतक जंक्शन रेलवे स्टेशन"),
      distance: l("About 4.5 km", "लगभग 4.5 किमी"),
      note: l("Easy access by auto or cab.", "ऑटो या कैब से आसानी से पहुँचें।"),
      icon: "TrainFront",
    },
    {
      id: "delhi-road",
      name: l("Delhi Road", "दिल्ली रोड"),
      distance: l("Close by", "पास में"),
      note: l("The main route towards Delhi.", "दिल्ली की ओर जाने वाला मुख्य मार्ग।"),
      icon: "Route",
    },
  ],
  faqs: [
    {
      id: "timings",
      q: l("What are the check-in and check-out times?", "चेक-इन और चेक-आउट का समय क्या है?"),
      a: l(
        "Check-in is from 12:00 PM and check-out is by 11:00 AM. The front desk is open 24 hours, so late arrivals are welcome.",
        "चेक-इन दोपहर 12:00 बजे से और चेक-आउट सुबह 11:00 बजे तक है। फ्रंट डेस्क 24 घंटे खुला रहता है, इसलिए देर से आने में कोई दिक्कत नहीं।",
      ),
    },
    {
      id: "id",
      q: l("Which ID do I need to show?", "कौन सा पहचान पत्र दिखाना होगा?"),
      a: l(
        "Every adult guest needs a valid government photo ID, local or outstation. Aadhaar, passport, driving licence and voter ID are accepted. PAN card is not accepted.",
        "हर वयस्क मेहमान के पास मान्य सरकारी फ़ोटो पहचान पत्र होना चाहिए, स्थानीय या बाहरी। आधार, पासपोर्ट, ड्राइविंग लाइसेंस और वोटर आईडी मान्य हैं। पैन कार्ड मान्य नहीं है।",
      ),
    },
    {
      id: "couples",
      q: l("Is the hotel couple friendly?", "क्या होटल कपल फ्रेंडली है?"),
      a: l(
        "Yes, couples are welcome. Each adult guest must show a valid government photo ID at check-in.",
        "हाँ, कपल का स्वागत है। चेक-इन पर हर वयस्क मेहमान को मान्य सरकारी फ़ोटो पहचान पत्र दिखाना होगा।",
      ),
    },
    {
      id: "location",
      q: l("Where exactly is the hotel?", "होटल ठीक कहाँ है?"),
      a: l(
        "We are on the 2nd floor in Model Town, Rohtak, in front of PT Neki Ram Sharma Government College and beside the Redtape showroom.",
        "हम रोहतक के मॉडल टाउन में दूसरी मंज़िल पर हैं, पीटी नेकी राम शर्मा गवर्नमेंट कॉलेज के सामने और रेडटेप शोरूम के बगल में।",
      ),
    },
    {
      id: "payment",
      q: l("How can I pay?", "भुगतान कैसे कर सकते हैं?"),
      a: l(
        "Pay online with UPI or card when you book, or choose Pay at Hotel and settle the bill at check-in.",
        "बुकिंग के समय UPI या कार्ड से ऑनलाइन भुगतान करें, या 'होटल में भुगतान' चुनें और चेक-इन पर बिल चुकाएँ।",
      ),
    },
    {
      id: "family",
      q: l("Do you have rooms for families?", "क्या परिवार के लिए कमरे हैं?"),
      a: l(
        "Yes. Check the room details for how many guests each room sleeps, or call the front desk for a larger group.",
        "हाँ। हर कमरे में कितने मेहमान रुक सकते हैं, यह कमरे के विवरण में देखें, या बड़े समूह के लिए फ्रंट डेस्क को कॉल करें।",
      ),
    },
    {
      id: "cancel",
      q: l("Can I cancel my booking?", "क्या मैं बुकिंग रद्द कर सकता/सकती हूँ?"),
      a: l(
        "Yes. Use Manage booking with your booking reference, or call the front desk. See the cancellation policy for the free-cancellation window and refunds.",
        "हाँ। अपने बुकिंग रेफ़रेंस के साथ 'बुकिंग प्रबंधित करें' का उपयोग करें या फ्रंट डेस्क को कॉल करें। मुफ़्त रद्दीकरण की अवधि और रिफ़ंड के लिए रद्दीकरण नीति देखें।",
      ),
    },
  ],
  policies: {
    idPolicy: l(
      "Every adult guest must show a valid government-issued photo ID at check-in. Local and outstation IDs are both accepted: Aadhaar, passport, driving licence or voter ID. PAN card is not accepted as ID.",
      "चेक-इन पर हर वयस्क मेहमान को मान्य सरकारी फ़ोटो पहचान पत्र दिखाना होगा। स्थानीय और बाहरी दोनों पहचान पत्र मान्य हैं: आधार, पासपोर्ट, ड्राइविंग लाइसेंस या वोटर आईडी। पैन कार्ड पहचान पत्र के रूप में मान्य नहीं है।",
    ),
    cancellation: {
      title: l("Cancellation policy", "रद्दीकरण नीति"),
      body: l(
        paras(
          "Free cancellation up to 24 hours before check-in.",
          "If you cancel within 24 hours of check-in, or do not arrive, we may charge the first night's tariff.",
          "Online payments for bookings cancelled in time are refunded to the original payment method within 5 to 7 working days.",
          "To cancel, use Manage booking on this website with your booking reference, or call the front desk.",
        ),
        paras(
          "चेक-इन से 24 घंटे पहले तक मुफ़्त रद्दीकरण।",
          "यदि आप चेक-इन से 24 घंटे के भीतर रद्द करते हैं या नहीं पहुँचते हैं, तो पहली रात का किराया लिया जा सकता है।",
          "समय पर रद्द की गई बुकिंग का ऑनलाइन भुगतान 5 से 7 कार्य दिवसों में मूल भुगतान माध्यम में वापस कर दिया जाता है।",
          "रद्द करने के लिए इस वेबसाइट पर अपने बुकिंग रेफ़रेंस के साथ 'बुकिंग प्रबंधित करें' का उपयोग करें, या फ्रंट डेस्क को कॉल करें।",
        ),
      ),
    },
    checkIn: {
      title: l("Check-in policy", "चेक-इन नीति"),
      body: l(
        paras(
          "Check-in is from 12:00 PM and check-out is by 11:00 AM. The front desk is open 24 hours.",
          "Early check-in and late check-out depend on availability. Please ask the front desk in advance.",
          "- Every adult guest must show a valid government photo ID, local or outstation.\n- PAN card is not accepted as ID.\n- The name on the ID should match the booking.",
          "The hotel may refuse check-in if a valid ID is not available. In that case the cancellation policy applies.",
        ),
        paras(
          "चेक-इन दोपहर 12:00 बजे से और चेक-आउट सुबह 11:00 बजे तक है। फ्रंट डेस्क 24 घंटे खुला रहता है।",
          "जल्दी चेक-इन और देर से चेक-आउट उपलब्धता पर निर्भर है। कृपया फ्रंट डेस्क से पहले पूछ लें।",
          "- हर वयस्क मेहमान को मान्य सरकारी फ़ोटो पहचान पत्र दिखाना होगा, स्थानीय या बाहरी।\n- पैन कार्ड पहचान पत्र के रूप में मान्य नहीं है।\n- पहचान पत्र पर नाम बुकिंग के नाम से मेल खाना चाहिए।",
          "मान्य पहचान पत्र न होने पर होटल चेक-इन से मना कर सकता है। ऐसे में रद्दीकरण नीति लागू होगी।",
        ),
      ),
    },
    terms: {
      title: l("Terms of use", "उपयोग की शर्तें"),
      body: l(
        paras(
          "These terms apply to bookings made through this website. By booking, you agree to them.",
          "Rates are per room per night in Indian rupees. GST is added at the rate applicable to the room tariff and shown before you pay.",
          "A booking is confirmed once you receive a confirmation with a booking reference. Pay at Hotel bookings are held for the guest and may be released if the guest does not arrive.",
          "Guests are responsible for damage to hotel property during their stay. The hotel may ask any guest who disturbs others or breaks house rules to leave without refund.",
          "Hotel Asthara may change rates, offers and availability at any time. A confirmed booking keeps the rate it was made at.",
        ),
        paras(
          "ये शर्तें इस वेबसाइट से की गई बुकिंग पर लागू होती हैं। बुकिंग करके आप इन्हें स्वीकार करते हैं।",
          "किराया प्रति कमरा प्रति रात भारतीय रुपये में है। कमरे के किराये पर लागू दर से GST जोड़ा जाता है और भुगतान से पहले दिखाया जाता है।",
          "बुकिंग रेफ़रेंस के साथ पुष्टि मिलने पर बुकिंग पक्की होती है। 'होटल में भुगतान' वाली बुकिंग मेहमान के लिए रखी जाती है और मेहमान के न पहुँचने पर रद्द की जा सकती है।",
          "ठहराव के दौरान होटल की संपत्ति को हुए नुकसान की ज़िम्मेदारी मेहमान की है। दूसरों को परेशान करने या नियम तोड़ने वाले मेहमान से होटल बिना रिफ़ंड के जाने को कह सकता है।",
          "होटल अस्थारा किसी भी समय किराया, ऑफ़र और उपलब्धता बदल सकता है। पक्की बुकिंग उसी किराये पर रहती है जिस पर वह की गई थी।",
        ),
      ),
    },
    privacy: {
      title: l("Privacy policy", "गोपनीयता नीति"),
      body: l(
        paras(
          "We collect only what we need to run your stay: your name, phone number, email, ID type and ID number, and your booking details.",
          "Your ID number is encrypted in our database and only authorised front-desk staff can view it. We keep it for as long as the law requires guest records to be kept.",
          "Payments are processed by Razorpay. We never see or store your card or UPI details.",
          "We use your contact details to send booking confirmations and to reply to your enquiries. We do not sell your data.",
          "To see, correct or delete your data, contact the front desk using the details on the Contact page.",
        ),
        paras(
          "हम केवल वही जानकारी लेते हैं जो आपके ठहराव के लिए ज़रूरी है: आपका नाम, फ़ोन नंबर, ईमेल, पहचान पत्र का प्रकार और नंबर, और बुकिंग का विवरण।",
          "आपका पहचान पत्र नंबर हमारे डेटाबेस में एन्क्रिप्ट रहता है और केवल अधिकृत फ्रंट-डेस्क स्टाफ़ ही इसे देख सकता है। कानून के अनुसार मेहमानों का रिकॉर्ड जितने समय रखना ज़रूरी है, हम उतने समय रखते हैं।",
          "भुगतान Razorpay के ज़रिए होता है। हम आपके कार्ड या UPI की जानकारी कभी नहीं देखते और न ही रखते हैं।",
          "हम आपके संपर्क विवरण का उपयोग बुकिंग की पुष्टि भेजने और आपके सवालों का जवाब देने के लिए करते हैं। हम आपका डेटा नहीं बेचते।",
          "अपना डेटा देखने, सुधारने या हटाने के लिए संपर्क पेज पर दिए विवरण से फ्रंट डेस्क से संपर्क करें।",
        ),
      ),
    },
  },
  seo: {
    titleTemplate: "%s | Hotel Asthara, Rohtak",
    defaultTitle: l(
      "Hotel Asthara – Couple-friendly hotel in Model Town, Rohtak",
      "होटल अस्थारा – मॉडल टाउन, रोहतक में कपल फ्रेंडली होटल",
    ),
    defaultDescription: l(
      "Air-conditioned rooms with free WiFi, LED TV and a 24-hour front desk in Model Town, Rohtak, opposite PT Neki Ram Sharma Government College. Book direct, pay online or at the hotel.",
      "मॉडल टाउन, रोहतक में पीटी नेकी राम शर्मा गवर्नमेंट कॉलेज के सामने, मुफ़्त वाई-फ़ाई, एलईडी टीवी और 24 घंटे फ्रंट डेस्क के साथ एयर-कंडीशन्ड कमरे। सीधे बुक करें, ऑनलाइन या होटल में भुगतान करें।",
    ),
    keywords: [
      "hotel in Model Town Rohtak",
      "couple friendly hotel Rohtak",
      "hotels in Rohtak",
      "Hotel Asthara Rohtak",
      "family rooms Rohtak",
    ],
    ogImageUrl: "",
    pages: {
      rooms: {
        title: l("Rooms and rates", "कमरे और किराया"),
        description: l(
          "Air-conditioned rooms in Model Town, Rohtak with free WiFi and a private bathroom. Check live availability and book direct.",
          "मॉडल टाउन, रोहतक में मुफ़्त वाई-फ़ाई और प्राइवेट बाथरूम वाले एयर-कंडीशन्ड कमरे। लाइव उपलब्धता देखें और सीधे बुक करें।",
        ),
      },
      gallery: {
        title: l("Photo gallery", "फ़ोटो गैलरी"),
        description: l(
          "See the rooms and the hotel before you book.",
          "बुकिंग से पहले कमरे और होटल देखें।",
        ),
      },
      about: {
        title: l("About the hotel", "होटल के बारे में"),
        description: l(
          "A city hotel in Model Town, Rohtak, built around easy arrivals and comfortable rooms.",
          "मॉडल टाउन, रोहतक में एक सिटी होटल, आसान पहुँच और आरामदायक कमरों के साथ।",
        ),
      },
      nearby: {
        title: l("Location and directions", "स्थान और रास्ता"),
        description: l(
          "Find Hotel Asthara in Model Town, Rohtak, opposite PT Neki Ram Sharma Government College.",
          "मॉडल टाउन, रोहतक में पीटी नेकी राम शर्मा गवर्नमेंट कॉलेज के सामने होटल अस्थारा ढूँढें।",
        ),
      },
      contact: {
        title: l("Contact", "संपर्क"),
        description: l(
          "Call, WhatsApp or write to the Hotel Asthara front desk in Model Town, Rohtak.",
          "मॉडल टाउन, रोहतक में होटल अस्थारा के फ्रंट डेस्क को कॉल, व्हाट्सऐप या संदेश भेजें।",
        ),
      },
      offers: {
        title: l("Offers", "ऑफ़र"),
        description: l(
          "Current direct-booking offers at Hotel Asthara, Rohtak.",
          "होटल अस्थारा, रोहतक में सीधी बुकिंग के मौजूदा ऑफ़र।",
        ),
      },
      faq: {
        title: l("FAQ", "अक्सर पूछे जाने वाले सवाल"),
        description: l(
          "Check-in times, ID rules, payments and more.",
          "चेक-इन का समय, पहचान पत्र के नियम, भुगतान और बहुत कुछ।",
        ),
      },
    },
  },
  booking: {
    maxNights: 15,
    maxRoomsPerBooking: 4,
    advanceBookingDays: 365,
    holdMinutes: 20,
    freeCancelHours: 24,
  },
  payments: { onlineEnabled: true, payAtHotelEnabled: true },
  notifications: { hotelEmails: [], sendGuestConfirmation: true },
  about: {
    title: l("About Hotel Asthara", "होटल अस्थारा के बारे में"),
    intro: l(
      "A city hotel built around easy arrivals and comfortable rooms.",
      "आसान पहुँच और आरामदायक कमरों वाला एक सिटी होटल।",
    ),
    body: l(
      paras(
        "Hotel Asthara is on the 2nd floor in Model Town, Rohtak, in front of PT Neki Ram Sharma Government College and beside the Redtape showroom. It is a hotel for people who want a clean, quiet, air-conditioned room close to the city, whether you are in Rohtak for a day of work, an exam, a family occasion or a night away as a couple.",
        "The front desk is open 24 hours, so a late train or an early start is never a problem.",
        "Guests can book online and pay by UPI or card, or reserve and pay at the hotel. Every adult guest needs a valid government photo ID, local or outstation. PAN card is not accepted.",
      ),
      paras(
        "होटल अस्थारा रोहतक के मॉडल टाउन में दूसरी मंज़िल पर है, पीटी नेकी राम शर्मा गवर्नमेंट कॉलेज के सामने और रेडटेप शोरूम के बगल में। यह उन लोगों के लिए है जो शहर के पास साफ़, शांत और एयर-कंडीशन्ड कमरा चाहते हैं, चाहे आप काम, परीक्षा, पारिवारिक कार्यक्रम या कपल के रूप में एक रात के लिए रोहतक आए हों।",
        "फ्रंट डेस्क 24 घंटे खुला रहता है, इसलिए देर से आने वाली ट्रेन या जल्दी निकलना कभी परेशानी नहीं।",
        "मेहमान ऑनलाइन बुक करके UPI या कार्ड से भुगतान कर सकते हैं, या बुक करके होटल में भुगतान कर सकते हैं। हर वयस्क मेहमान के पास मान्य सरकारी फ़ोटो पहचान पत्र होना चाहिए, स्थानीय या बाहरी। पैन कार्ड मान्य नहीं है।",
      ),
    ),
    imageUrl: "",
  },
  gallery: {
    categories: [
      { key: "rooms", label: l("Rooms", "कमरे") },
      { key: "hotel", label: l("Hotel", "होटल") },
      { key: "reception", label: l("Reception", "रिसेप्शन") },
      { key: "exterior", label: l("Exterior", "बाहरी दृश्य") },
      { key: "neighbourhood", label: l("Neighbourhood", "आसपास") },
    ],
  },
};

const SECTION_ORDER: SectionKey[] = [
  "HERO",
  "ROOMS_GRID",
  "AMENITIES",
  "WHY_CHOOSE_US",
  "OFFERS",
  "GALLERY",
  "TESTIMONIALS",
  "INSTAGRAM_FEED",
  "LOCATION",
  "FAQ",
  "CONTACT",
  "CTA",
];

export const DEFAULT_SECTION_CONTENT: SectionContent = {
  HERO: {
    headline: l("Comfort in the heart of Rohtak", "रोहतक के दिल में आराम"),
    subhead: l(
      "Air-conditioned rooms, free WiFi and a front desk that never closes, in Model Town opposite PT Neki Ram Sharma Government College.",
      "मॉडल टाउन में, पीटी नेकी राम शर्मा गवर्नमेंट कॉलेज के सामने, एयर-कंडीशन्ड कमरे, मुफ़्त वाई-फ़ाई और 24 घंटे खुला फ्रंट डेस्क।",
    ),
    imageUrl: "",
    videoUrl: "",
    posterUrl: "",
  },
  ROOMS_GRID: {
    title: l("Choose your room", "अपना कमरा चुनें"),
    intro: l(
      "Every room is air-conditioned with a private bathroom, free WiFi and an LED TV.",
      "हर कमरा एयर-कंडीशन्ड है, प्राइवेट बाथरूम, मुफ़्त वाई-फ़ाई और एलईडी टीवी के साथ।",
    ),
    limit: 3,
  },
  AMENITIES: {
    title: l("What every stay includes", "हर ठहराव में क्या शामिल है"),
    intro: l(
      "This is what comes with your room, with nothing added at checkout.",
      "आपके कमरे के साथ यह सब शामिल है, चेकआउट पर कुछ अतिरिक्त नहीं।",
    ),
  },
  WHY_CHOOSE_US: {
    title: l("Easy to find, easy to arrive", "ढूँढना आसान, पहुँचना आसान"),
    intro: l(
      "Three things guests tell us they value most.",
      "मेहमान जिन तीन बातों को सबसे ज़्यादा पसंद करते हैं।",
    ),
    points: [
      {
        id: "location",
        icon: "MapPin",
        title: l("Right in Model Town", "सीधे मॉडल टाउन में"),
        body: l(
          "Opposite PT Neki Ram Sharma Government College and about 4.5 km from Rohtak Junction.",
          "पीटी नेकी राम शर्मा गवर्नमेंट कॉलेज के सामने और रोहतक जंक्शन से लगभग 4.5 किमी।",
        ),
      },
      {
        id: "couples",
        icon: "Heart",
        title: l("Couple friendly", "कपल फ्रेंडली"),
        body: l(
          "Couples are welcome. Bring a valid government photo ID for each adult guest.",
          "कपल का स्वागत है। हर वयस्क मेहमान के लिए मान्य सरकारी फ़ोटो पहचान पत्र साथ लाएँ।",
        ),
      },
      {
        id: "desk",
        icon: "Clock",
        title: l("Front desk, 24 hours", "फ्रंट डेस्क, 24 घंटे"),
        body: l(
          "Arrive at 3 am or leave at midnight. There is always someone at the desk.",
          "रात 3 बजे पहुँचें या आधी रात को निकलें, डेस्क पर हमेशा कोई मौजूद है।",
        ),
      },
    ],
  },
  OFFERS: {
    title: l("Offers for direct bookings", "सीधी बुकिंग पर ऑफ़र"),
    intro: l("Use the code at checkout.", "चेकआउट पर कोड का उपयोग करें।"),
  },
  GALLERY: {
    title: l("Take a look inside", "अंदर झाँकिए"),
    intro: l("Rooms, corridors and the neighbourhood.", "कमरे, गलियारे और आसपास का इलाक़ा।"),
    limit: 6,
  },
  TESTIMONIALS: {
    title: l("What guests say", "मेहमान क्या कहते हैं"),
    intro: l("Reviews we have checked and approved.", "हमारे द्वारा जाँचे और स्वीकृत किए गए रिव्यू।"),
  },
  LOCATION: {
    title: l("Find us in Model Town", "मॉडल टाउन में हमें ढूँढें"),
    intro: l(
      "Look for the Redtape showroom. We are on the 2nd floor beside it.",
      "रेडटेप शोरूम देखें। हम उसके बगल में दूसरी मंज़िल पर हैं।",
    ),
  },
  INSTAGRAM_FEED: {
    title: l("From our Instagram", "हमारे इंस्टाग्राम से"),
    intro: l("Recent moments from the hotel.", "होटल के हाल के पल।"),
    posts: [],
  },
  FAQ: {
    title: l("Good to know before you book", "बुकिंग से पहले जानने योग्य"),
    intro: l("", ""),
    limit: 5,
  },
  CONTACT: {
    title: l("Talk to the front desk", "फ्रंट डेस्क से बात करें"),
    intro: l(
      "Call any time, or send a message and we will reply by phone or email.",
      "कभी भी कॉल करें, या संदेश भेजें, हम फ़ोन या ईमेल से जवाब देंगे।",
    ),
  },
  CTA: {
    title: l("Ready when you are", "जब आप तैयार हों"),
    body: l("Pick your dates and book in under two minutes.", "तारीख़ें चुनें और दो मिनट से कम में बुक करें।"),
  },
};

export const DEFAULT_SECTIONS: SectionRow[] = SECTION_ORDER.map((key, i) => ({
  key,
  enabled: true,
  sortOrder: i,
  content: DEFAULT_SECTION_CONTENT[key],
})) as SectionRow[];

export const SECTION_LABELS: Record<SectionKey, string> = {
  HERO: "Hero",
  ROOMS_GRID: "Rooms",
  AMENITIES: "Amenities",
  WHY_CHOOSE_US: "Why choose us",
  OFFERS: "Offers",
  GALLERY: "Gallery",
  TESTIMONIALS: "Testimonials",
  LOCATION: "Location and nearby",
  INSTAGRAM_FEED: "Instagram feed",
  FAQ: "FAQ",
  CONTACT: "Contact",
  CTA: "Call to action",
};

export const FIXED_SECTION: SectionKey = "HERO";
