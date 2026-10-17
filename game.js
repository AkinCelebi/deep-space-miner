/**
 * Deep Space Miner - Gelişmiş Oyun Motoru
 * Boss Sistemi, Aktif Yetenekler, Şans UFO'su, Genişletilmiş Dengeleme
 */

// Sayı Formatlayıcı (K, M, B, T, Qa vb.)
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return "0";
  if (num === 0) return "0";
  if (num < 10) {
    return num % 1 === 0 ? num.toString() : num.toFixed(1);
  }
  if (num < 1000) return Math.floor(num).toLocaleString('tr-TR');
  
  const suffixes = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  const i = Math.floor(Math.log10(num) / 3);
  if (i >= suffixes.length) return num.toExponential(2);
  
  const formatted = (num / Math.pow(10, i * 3)).toFixed(2);
  return formatted + " " + suffixes[i];
}

// Oyun Durumu
const state = {
  credits: 0,
  totalEarnedAllTime: 0,
  darkMatter: 0,
  warpCount: 0,
  totalClicks: 0,
  currentRunAsteroids: 0,     // Mevcut turda parçalanan (Warp ile sıfırlanır)
  totalAsteroidsDestroyed: 0, // Tüm zamanlar toplamı
  playTimeSeconds: 0,
  lastSaveTime: Date.now(),
  
  // Geliştirmeler
  upgrades: {
    // Manuel
    clickPower: 0,
    critChance: 0,
    critDamage: 0,
    overcharge: 0,
    tachyonBeam: 0,
    
    // Otomasyon
    drone: 0,
    satellite: 0,
    miningRig: 0,
    plasmaDrill: 0,
    dysonHarvester: 0,
    quantumRig: 0,
    antimatterDrill: 0,
    stellarForge: 0
  },

  // Yetenek Cooldown & Süreleri (saniye cinsinden)
  skills: {
    overdrive: { cdTimer: 0, maxCd: 60, duration: 8, activeTimer: 0 },
    strike: { cdTimer: 0, maxCd: 75, duration: 5, activeTimer: 0 },
    magnet: { cdTimer: 0, maxCd: 65, duration: 8, activeTimer: 0 }
  },

  // Beceri Laboratuvarı Seviyeleri (0 = Kilitli, 1-5 = Açık & Geliştirilmiş)
  skillLevels: {
    overdrive: 0,
    strike: 0,
    magnet: 0,
    naniteSpeed: 0,
    critBoost: 0
  },

  // Galaktik Sıralama, Pilot Sicili & Rütbe Takibi (250,000 Oyuncu Arasında)
  playerName: localStorage.getItem("DeepSpaceMiner_PlayerName") || "",
  pilotId: "",
  lastRank: 248500,
  lastLeagueName: "Bronz Madenci V",

  // Şans Buff'ı (UFO'dan gelen Çılgınlık)
  frenzyTimer: 0,

  // Reklam Güçlendirmeleri & Zamanlayıcılar (CrazyGames Ads)
  adBoostClickTimer: 0,  // 60 saniye (1 dakika) boyunca 2x Tıklama Gücü
  adBoostAutoTimer: 0,   // 120 saniye (2 dakika) boyunca 2x Otomatik Madencilik DPS
  midgameAdTimer: 0,     // Saniyelik sayaç
  nextMidgameTarget: 300 // İlk reklam 5 dakika (300sn), sonraki reklamlar 10 dakika (600sn)
};

// Geliştirme Tanımları
const UPGRADE_DEFS = {
  // MANUEL TAB
  clickPower: {
    id: "clickPower",
    name: "Lazer Güçlendirici",
    desc: "Her tıklamada vurduğunuz temel hasarı artırır.",
    icon: "🔦",
    baseCost: 15,
    costMult: 1.15,
    type: "manual",
    getEffect: (lvl) => 1 + lvl * 1.8
  },
  critChance: {
    id: "critChance",
    name: "Hassas Sensör",
    desc: "Kritik vuruş şansını %2 artırır.",
    icon: "🎯",
    baseCost: 65,
    costMult: 1.22,
    maxLevel: 25,
    type: "manual",
    getEffect: (lvl) => 5 + lvl * 2
  },
  critDamage: {
    id: "critDamage",
    name: "Odak Kristali",
    desc: "Kritik vuruşların çarpanını +0.5x artırır.",
    icon: "💎",
    baseCost: 180,
    costMult: 1.28,
    type: "manual",
    getEffect: (lvl) => 2.0 + lvl * 0.5
  },
  overcharge: {
    id: "overcharge",
    name: "Aşırı Akım Kondansatörü",
    desc: "Tüm manuel kazı gücünü %12 artırır.",
    icon: "🔋",
    baseCost: 600,
    costMult: 1.32,
    type: "manual",
    getEffect: (lvl) => 1 + lvl * 0.12
  },
  tachyonBeam: {
    id: "tachyonBeam",
    name: "Takyon Işın Odaklayıcı",
    desc: "Zaman bükücü takyonlarla tıklama hasarını katlar.",
    icon: "☄️",
    baseCost: 2400,
    costMult: 1.35,
    type: "manual",
    getEffect: (lvl) => 1 + lvl * 0.20
  },

  // OTOMASYON TAB
  drone: {
    id: "drone",
    name: "Madenci Dronu",
    desc: "Asteroit etrafında dönerek otomatik kazı yapar.",
    icon: "🛸",
    baseCost: 40,
    costMult: 1.14,
    dps: 1.2,
    type: "auto"
  },
  satellite: {
    id: "satellite",
    name: "Yörünge Lazer Uydusu",
    desc: "Yörüngeden sürekli enerji ışını gönderir.",
    icon: "🛰️",
    baseCost: 240,
    costMult: 1.16,
    dps: 8.5,
    type: "auto"
  },
  miningRig: {
    id: "miningRig",
    name: "Otomatik Maden Platformu",
    desc: "Ağır kazı matkaplarıyla yüzeyi parçalar.",
    icon: "🏗️",
    baseCost: 1200,
    costMult: 1.18,
    dps: 45,
    type: "auto"
  },
  plasmaDrill: {
    id: "plasmaDrill",
    name: "Plazma Ekskavatörü",
    desc: "Yüksek sıcaklıkta plazma püskürterek maden eritir.",
    icon: "⚡",
    baseCost: 6500,
    costMult: 1.20,
    dps: 220,
    type: "auto"
  },
  dysonHarvester: {
    id: "dysonHarvester",
    name: "Güneş Enerjili Toplayıcı",
    desc: "Yıldız enerjisini yoğunlaştırıp maden çıkarır.",
    icon: "☀️",
    baseCost: 35000,
    costMult: 1.22,
    dps: 1100,
    type: "auto"
  },
  quantumRig: {
    id: "quantumRig",
    name: "Kuantum Molekül Parçalayıcı",
    desc: "Atom seviyesinde madenleri ayrıştırıp depolar.",
    icon: "⚛️",
    baseCost: 190000,
    costMult: 1.24,
    dps: 5500,
    type: "auto"
  },
  antimatterDrill: {
    id: "antimatterDrill",
    name: "Antimadde Matkabı",
    desc: "Antimadde reaksiyonuyla asteroitleri buharlaştırır.",
    icon: "🌌",
    baseCost: 950000,
    costMult: 1.25,
    dps: 28000,
    type: "auto"
  },
  stellarForge: {
    id: "stellarForge",
    name: "Yıldız Çekirdeği Ocağı",
    desc: "Galaktik ölçekte maden üretim fabrikası.",
    icon: "🪐",
    baseCost: 5000000,
    costMult: 1.26,
    dps: 140000,
    type: "auto"
  }
};

// ==================== BECERİ LABORATUVARI TANIMLARI ====================
const SKILL_UPGRADE_DEFS = {
  overdrive: {
    id: "overdrive",
    name: "Aşırı Yükleme Reaktörü",
    baseName: "Aşırı Yükleme",
    type: "active",
    icon: "⚡",
    desc: "Reaktörü zorlayarak tüm kazı gücünü ve hızını geçici süreyle artırır.",
    levels: [
      { cost: 300, desc: "Kilit Aç: 1.40x Hasar, 6 sn Süre, 60 sn Bekleme", mult: 1.40, duration: 6, cd: 60 },
      { cost: 2000, desc: "Sv 2: 1.65x Hasar, 7 sn Süre, 54 sn Bekleme", mult: 1.65, duration: 7, cd: 54 },
      { cost: 14000, desc: "Sv 3: 1.95x Hasar, 8 sn Süre, 48 sn Bekleme", mult: 1.95, duration: 8, cd: 48 },
      { cost: 85000, desc: "Sv 4: 2.30x Hasar, 9 sn Süre, 42 sn Bekleme", mult: 2.30, duration: 9, cd: 42 },
      { cost: 500000, desc: "Sv 5 (MAKS): 2.70x Hasar, 10 sn Süre, 36 sn Bekleme", mult: 2.70, duration: 10, cd: 36 }
    ]
  },
  strike: {
    id: "strike",
    name: "Yörünge İyon Topu",
    baseName: "Yörünge Darbesi",
    type: "active",
    icon: "☄️",
    desc: "Yörüngedeki taktiksel uydu ağından asteroide doğrudan iyon ışını indirir.",
    levels: [
      { cost: 1200, desc: "Kilit Aç: %6.0 Anlık Can Hasarı, 75 sn Bekleme", dmgRatio: 0.06, cd: 75 },
      { cost: 7500, desc: "Sv 2: %8.5 Anlık Can Hasarı, 68 sn Bekleme", dmgRatio: 0.085, cd: 68 },
      { cost: 40000, desc: "Sv 3: %11.5 Anlık Can Hasarı, 60 sn Bekleme", dmgRatio: 0.115, cd: 60 },
      { cost: 220000, desc: "Sv 4: %15.0 Anlık Can Hasarı, 52 sn Bekleme", dmgRatio: 0.15, cd: 52 },
      { cost: 1200000, desc: "Sv 5 (MAKS): %19.0 Anlık Can Hasarı, 45 sn Bekleme", dmgRatio: 0.19, cd: 45 }
    ]
  },
  magnet: {
    id: "magnet",
    name: "Kuantum Çekirdek Matrisi",
    baseName: "Kuantum Mıknatısı",
    type: "active",
    icon: "🧲",
    desc: "Uzay-zaman dalgalanmasıyla kritik vuruş frekansını yükseltir.",
    levels: [
      { cost: 4000, desc: "Kilit Aç: +%15 Kritik Şans, 6 sn Süre, 65 sn Bekleme", critBonus: 15, duration: 6, cd: 65 },
      { cost: 25000, desc: "Sv 2: +%25 Kritik Şans, 7 sn Süre, 58 sn Bekleme", critBonus: 25, duration: 7, cd: 58 },
      { cost: 150000, desc: "Sv 3: +%38 Kritik Şans, 8 sn Süre, 50 sn Bekleme", critBonus: 38, duration: 8, cd: 50 },
      { cost: 750000, desc: "Sv 4: +%52 Kritik Şans, 9 sn Süre, 44 sn Bekleme", critBonus: 52, duration: 9, cd: 44 },
      { cost: 4000000, desc: "Sv 5 (MAKS): +%68 Kritik + 0.60x Kritik Çarpanı, 10 sn, 38 sn Bekleme", critBonus: 68, critMultBonus: 0.60, duration: 10, cd: 38 }
    ]
  },
  naniteSpeed: {
    id: "naniteSpeed",
    name: "Nanit Hızlandırıcı Protokol",
    baseName: "Nanit Hızlandırıcı",
    type: "passive",
    icon: "🔬",
    desc: "Tüm dronların ve otomatik sistemlerin kazı hızını kalıcı olarak artırır.",
    levels: [
      { cost: 600, desc: "Sv 1: Otomasyon Hızı +%6", dpsMult: 0.06 },
      { cost: 3800, desc: "Sv 2: Otomasyon Hızı +%12", dpsMult: 0.12 },
      { cost: 22000, desc: "Sv 3: Otomasyon Hızı +%19", dpsMult: 0.19 },
      { cost: 120000, desc: "Sv 4: Otomasyon Hızı +%27", dpsMult: 0.27 },
      { cost: 650000, desc: "Sv 5 (MAKS): Otomasyon Hızı +%36", dpsMult: 0.36 }
    ]
  },
  critBoost: {
    id: "critBoost",
    name: "Kozmik Rezonans Kristali",
    baseName: "Kozmik Rezonans",
    type: "passive",
    icon: "💎",
    desc: "Kritik vuruşların patlayıcı hasar çarpanını katlar.",
    levels: [
      { cost: 900, desc: "Sv 1: Kritik Hasar Çarpanı +0.20x", critMultBonus: 0.20 },
      { cost: 5500, desc: "Sv 2: Kritik Hasar Çarpanı +0.45x", critMultBonus: 0.45 },
      { cost: 32000, desc: "Sv 3: Kritik Hasar Çarpanı +0.75x", critMultBonus: 0.75 },
      { cost: 180000, desc: "Sv 4: Kritik Hasar Çarpanı +1.10x", critMultBonus: 1.10 },
      { cost: 950000, desc: "Sv 5 (MAKS): Kritik Hasar Çarpanı +1.50x", critMultBonus: 1.50 }
    ]
  }
};

// ==================== GALAKTİK LİGLER ====================
const LEAGUES = [
  { minRank: 150001, maxRank: 250000, name: "Bronz Madenci V", icon: "🥉", color: "#cd7f32", nextTarget: "Gümüş Sondajcı (#150,000)" },
  { minRank: 75001,  maxRank: 150000, name: "Gümüş Sondajcı IV", icon: "🥈", color: "#c0c0c0", nextTarget: "Altın Filo (#75,000)" },
  { minRank: 25001,  maxRank: 75000,  name: "Altın Filo Komutanı III", icon: "🥇", color: "#ffd700", nextTarget: "Platin Hükümdar (#25,000)" },
  { minRank: 5001,   maxRank: 25000,  name: "Platin Hükümdar II", icon: "💎", color: "#00f0ff", nextTarget: "Elmas Sektör Lideri (#5,000)" },
  { minRank: 501,    maxRank: 5000,   name: "Elmas Sektör Lideri I", icon: "🔮", color: "#a855f7", nextTarget: "Kozmik Efsane (#500)" },
  { minRank: 1,      maxRank: 500,    name: "Kozmik Efsane (Apex)", icon: "👑", color: "#ff007f", nextTarget: "Galaksi Şampiyonu (#1)" }
];

function getLeagueInfo(rank) {
  for (const l of LEAGUES) {
    if (rank >= l.minRank && rank <= l.maxRank) return l;
  }
  return LEAGUES[0];
}

// Asteroit Türleri (12 Zengin Sektör, 60 Benzersiz Maden & Boss Çeşidi)
const ASTEROID_TIERS = [
  {
    sectorName: "Karbon Kuşağı",
    color: "#282c37", glow: "#00f0ff", veinColor: "#64b5f6",
    lightColor: "#475569", darkColor: "#0f172a",
    hpBase: 120, rewardBase: 42,
    subTypes: [
      "Ham Karbon Parçası",
      "Sıkışmış Grafit Kaya",
      "Yoğun Kömür Göktaşı",
      "Siyah Karborundum"
    ],
    bossName: "👑 MEGA KARBON MONOLİTİ"
  },
  {
    sectorName: "Demir Havzası",
    color: "#475569", glow: "#38bdf8", veinColor: "#bae6fd",
    lightColor: "#94a3b8", darkColor: "#1e293b",
    hpBase: 400, rewardBase: 155,
    subTypes: [
      "Piritli Demir Çakılı",
      "Manyetit Kristali",
      "Yoğun Hematit Parçası",
      "Çelik Damarlı Göktaşı"
    ],
    bossName: "👑 LEJYON DEMİR DEVİ"
  },
  {
    sectorName: "Bakır Sahası",
    color: "#9a3412", glow: "#f97316", veinColor: "#fdba74",
    lightColor: "#c2410c", darkColor: "#431407",
    hpBase: 1250, rewardBase: 500,
    subTypes: [
      "Oksitli Bakır Kütlesi",
      "Doğal Kalkopirit",
      "Bakır Silikat Kayası",
      "Yoğun Bronz Çekirdeği"
    ],
    bossName: "👑 KIZIL BAKIR TİTANI"
  },
  {
    sectorName: "Gümüş Damarı",
    color: "#64748b", glow: "#e2e8f0", veinColor: "#ffffff",
    lightColor: "#cbd5e1", darkColor: "#1e293b",
    hpBase: 3800, rewardBase: 1650,
    subTypes: [
      "Ham Gümüş Şarapneli",
      "Parlak Akantoid",
      "Arı Gümüş Göktaşı",
      "Elektrom Maden Kümesi"
    ],
    bossName: "👑 PARLAK GÜMÜŞ KRALİÇESİ"
  },
  {
    sectorName: "Titanyum Zırhı",
    color: "#334155", glow: "#38bdf8", veinColor: "#7dd3fc",
    lightColor: "#64748b", darkColor: "#0f172a",
    hpBase: 11500, rewardBase: 5400,
    subTypes: [
      "Rutil Göktaşı",
      "İlmenit Parçası",
      "Titanyum-Karbür Bloğu",
      "Yoğun Titanyum Kabuk"
    ],
    bossName: "👑 TİTANYUM MUHAFIZ"
  },
  {
    sectorName: "Altın Maden Yatağı",
    color: "#ca8a04", glow: "#eab308", veinColor: "#fef08a",
    lightColor: "#facc15", darkColor: "#422006",
    hpBase: 35000, rewardBase: 17500,
    subTypes: [
      "Altın Tozu Göktaşı",
      "Altın Damarlı Kuvars",
      "Arı Altın Külçesi",
      "Zümrütlü Altın Kümesi"
    ],
    bossName: "👑 GÖRKEMLİ ALTIN KRALI"
  },
  {
    sectorName: "Platin & Osmiyum",
    color: "#0d9488", glow: "#2dd4bf", veinColor: "#99f6e4",
    lightColor: "#14b8a6", darkColor: "#042f2e",
    hpBase: 105000, rewardBase: 55000,
    subTypes: [
      "Ham Platin Şarapneli",
      "Ağır Osmiyum Bloğu",
      "İridyum Meteoriti",
      "Yoğun Platin Kristali"
    ],
    bossName: "👑 PLATİNYUM SENTİNEL"
  },
  {
    sectorName: "Kozmik Elmas & Safir",
    color: "#0284c7", glow: "#38bdf8", veinColor: "#e0f2fe",
    lightColor: "#38bdf8", darkColor: "#082f49",
    hpBase: 310000, rewardBase: 170000,
    subTypes: [
      "Kristalize Karbon",
      "Ham Elmas Damarı",
      "Safir Göktaşı",
      "Kusursuz Kozmik Elmas"
    ],
    bossName: "👑 YILDIZ KRİSTALİ ŞAHLANIŞI"
  },
  {
    sectorName: "Radyoaktif Uranyum",
    color: "#15803d", glow: "#22c55e", veinColor: "#86efac",
    lightColor: "#16a34a", darkColor: "#052e16",
    hpBase: 920000, rewardBase: 520000,
    subTypes: [
      "Işıyan Uranyum Tozu",
      "Parlayan Pitchblende",
      "Plütonyum Çakılı",
      "Gama Işıyan Radyum"
    ],
    bossName: "👑 TERMONÜKLEER ÇEKİRDEK"
  },
  {
    sectorName: "Plazma & İyon",
    color: "#0891b2", glow: "#06b6d4", veinColor: "#a5f3fc",
    lightColor: "#22d3ee", darkColor: "#083344",
    hpBase: 2700000, rewardBase: 1600000,
    subTypes: [
      "İyonize Gaz Kümesi",
      "Kor Kor Plazma Topu",
      "Yüksek Akım Plazmoid",
      "Süper Manyetik Plazma"
    ],
    bossName: "👑 PLAZMA FIRTINASI"
  },
  {
    sectorName: "Karanlık Madde & Boşluk",
    color: "#180d2b", glow: "#a855f7", veinColor: "#e9d5ff",
    lightColor: "#3b1d60", darkColor: "#090314",
    hpBase: 8000000, rewardBase: 4900000,
    subTypes: [
      "Negatif Kütle Parçası",
      "Boşluk Kristali",
      "Karanlık Madde Düğümü",
      "Saf Antimadde Çekirdeği"
    ],
    bossName: "👑 KARANLIK MADDE HÜKÜMDARI"
  },
  {
    sectorName: "Galaktik Tekillik",
    color: "#18181b", glow: "#ef4444", veinColor: "#fca5a5",
    lightColor: "#450a0a", darkColor: "#000000",
    hpBase: 24000000, rewardBase: 15500000,
    subTypes: [
      "Pulsar Tozu",
      "Nötron Parçacık Yığını",
      "Kuasar Parçası",
      "Mikro Kara Delik"
    ],
    bossName: "👑 GALAKTİK TEKİLLİK"
  }
];

// Mevcut Asteroit Nesnesi
let currentAsteroid = {
  tierIndex: 0,
  name: "",
  isBoss: false,
  bossTimer: 35,
  maxBossTimer: 35,
  color: "",
  glow: "",
  veinColor: "",
  maxHp: 100,
  currentHp: 100,
  reward: 50,
  radius: 110,
  rotation: 0,
  rotSpeed: 0.003,
  scale: 1,
  vertices: [],
  cracks: []
};

// Şans UFO'su (Lucky Event)
let luckyUfo = {
  active: false,
  x: -50,
  y: 100,
  vx: 2.2,
  vy: 0.8,
  radius: 24,
  spawnCooldown: 40 // Saniye sonra ilk UFO gelebilir
};

// Mega Lazer Işını Animasyonu (Yörünge Darbesi Yeteneği)
let megaLaserEffect = {
  active: false,
  timer: 0,
  duration: 25,
  width: 40
};

// Parçacıklar, Şarapneller, Şok Dalgaları ve Uçuşan Yazılar
let particles = [];
let shards = [];
let shockwaves = [];
let floatingTexts = [];
let stars = [];
let dronesList = [];

// Canvas & DOM
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
let screenShake = 0;

// ==================== HESAPLAMALAR & ÇARPANLAR ====================

function getPrestigeMultiplier() {
  return 1 + state.darkMatter * 0.10; // Her Karanlık Madde +%10 kalıcı bonus
}

function getClickDamage() {
  const base = UPGRADE_DEFS.clickPower.getEffect(state.upgrades.clickPower);
  const overchargeMult = UPGRADE_DEFS.overcharge.getEffect(state.upgrades.overcharge);
  const tachyonMult = UPGRADE_DEFS.tachyonBeam.getEffect(state.upgrades.tachyonBeam);
  const prestigeMult = getPrestigeMultiplier();

  // Aktif Buff Çarpanları
  let skillMult = 1;
  if (state.skills.overdrive.activeTimer > 0) {
    const odLvl = state.skillLevels ? state.skillLevels.overdrive || 1 : 1;
    const mult = SKILL_UPGRADE_DEFS.overdrive.levels[Math.max(0, odLvl - 1)].mult;
    skillMult *= mult;
  }
  if (state.frenzyTimer > 0) skillMult *= 3.0; // UFO Çılgınlığı: 3x Hasar
  if (state.adBoostClickTimer > 0) skillMult *= 2.0; // 1 Dakikalık Reklamlı 2x Kazı Gücü

  return base * overchargeMult * tachyonMult * prestigeMult * skillMult;
}

function getCritChance() {
  let chance = UPGRADE_DEFS.critChance.getEffect(state.upgrades.critChance);

  // UFO Çılgınlığı aktifse kesin kritik
  if (state.frenzyTimer > 0) return 100;

  // Kuantum Mıknatısı Aktifse
  if (state.skills.magnet.activeTimer > 0) {
    const magLvl = state.skillLevels ? state.skillLevels.magnet || 1 : 1;
    chance += SKILL_UPGRADE_DEFS.magnet.levels[magLvl - 1].critBonus;
  }

  return Math.min(100, Math.round(chance));
}

function getCritMultiplier() {
  let mult = UPGRADE_DEFS.critDamage.getEffect(state.upgrades.critDamage);

  // Pasif Kozmik Rezonans Becerisi
  const cbLvl = state.skillLevels ? state.skillLevels.critBoost || 0 : 0;
  if (cbLvl > 0) {
    mult += SKILL_UPGRADE_DEFS.critBoost.levels[cbLvl - 1].critMultBonus;
  }

  // Kuantum Mıknatısı Aktif ve Sv 5 ise ekstra çarpan
  if (state.skills.magnet.activeTimer > 0) {
    const magLvl = state.skillLevels ? state.skillLevels.magnet || 0 : 0;
    if (magLvl >= 5) {
      mult += (SKILL_UPGRADE_DEFS.magnet.levels[magLvl - 1].critMultBonus || 0);
    } else {
      mult *= 1.15;
    }
  }

  return mult;
}

function getAutoDPS() {
  let dps = 0;
  for (const [key, def] of Object.entries(UPGRADE_DEFS)) {
    if (def.type === "auto") {
      dps += def.dps * state.upgrades[key];
    }
  }

  // Pasif Nanit Hızlandırıcı Protokolü
  const nsLvl = state.skillLevels ? state.skillLevels.naniteSpeed || 0 : 0;
  let naniteMult = 1;
  if (nsLvl > 0) {
    naniteMult += SKILL_UPGRADE_DEFS.naniteSpeed.levels[nsLvl - 1].dpsMult;
  }

  let skillMult = 1;
  if (state.skills.overdrive.activeTimer > 0) {
    const odLvl = state.skillLevels ? state.skillLevels.overdrive || 1 : 1;
    const mult = SKILL_UPGRADE_DEFS.overdrive.levels[Math.max(0, odLvl - 1)].mult;
    skillMult *= mult;
  }
  if (state.frenzyTimer > 0) skillMult *= 2.0;
  if (state.adBoostAutoTimer > 0) skillMult *= 2.0; // 2 Dakikalık Reklamlı 2x Otomatik Madencilik

  return dps * getPrestigeMultiplier() * naniteMult * skillMult;
}

function getUpgradeCost(key) {
  const def = UPGRADE_DEFS[key];
  const lvl = state.upgrades[key];
  return Math.floor(def.baseCost * Math.pow(def.costMult, lvl));
}

// ==================== ASTEROİT OLUŞTURMA & BOSS ====================

function spawnAsteroid(tierOverride = null) {
  let tierIdx = 0;
  const count = state.currentRunAsteroids || 0;

  if (tierOverride !== null) {
    tierIdx = tierOverride;
  } else {
    // Her 5 asteroitte bir (4 alt asteroit + 1 Boss) bir sonraki sektöre geçer!
    tierIdx = Math.min(Math.floor(count / 5), ASTEROID_TIERS.length - 1);
  }

  const tier = ASTEROID_TIERS[tierIdx] || ASTEROID_TIERS[0];
  const stepInTier = count % 5; // 0, 1, 2, 3 -> Alt Asteroitler; 4 -> BOSS!
  const isBoss = stepInTier === 4;

  // Warp Zorluk Çarpanı: Her warp atlayışında evren %15 daha yoğun hale gelir (oyuncunun kalıcı hasarına karşı dinamik denge)
  const warpScaling = 1 + (state.warpCount || 0) * 0.15;

  // Sektör İçi Aşamalı Can Artışı (Her adımda can gözle görülür şekilde artar)
  const stepMultipliers = [1.0, 1.35, 1.80, 2.35, 4.80];
  const stepMult = stepMultipliers[stepInTier];

  let maxHp = Math.floor(tier.hpBase * stepMult * warpScaling);
  let reward = Math.floor(tier.rewardBase * stepMult * getPrestigeMultiplier());

  let asteroidName = "";
  if (isBoss) {
    asteroidName = tier.bossName;
    reward = Math.floor(reward * 1.5); // Boss ekstra ganimeti
    window.sounds.playBossAlarm();
    showToast(`⚠️ DİKKAT! ${tier.sectorName.toUpperCase()} BOSS'U SAHNEDE!`, true);
  } else {
    asteroidName = tier.subTypes[stepInTier] || tier.subTypes[0];
  }

  // Şekil (28 Noktalı Çok-Aşamalı Organik Kaya Konturu)
  const numVertices = 28;
  const vertices = [];
  const baseR = (isBoss ? 135 : 100) + Math.random() * 16;

  // Organik girinti/çıkıntılar için çok-dalgalı gürültü profili
  const p1 = Math.random() * 2 + 2; // Ana kaya lobları
  const p2 = Math.random() * 3 + 4; // Orta çıkıntılar
  const p3 = 8; // Küçük kaya sivrilikleri

  for (let i = 0; i < numVertices; i++) {
    const angle = (i / numVertices) * Math.PI * 2;
    const wave1 = Math.sin(angle * p1) * 16;
    const wave2 = Math.cos(angle * p2) * 8;
    const wave3 = (Math.sin(angle * p3) * 5) + (Math.random() * 8 - 4);
    const r = Math.max(baseR * 0.72, baseR + wave1 + wave2 + wave3);
    vertices.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r, r: r, angle: angle });
  }

  // 3D Kraterler (Gölge, hilal parıltı ve merkezi tepe)
  const craters = [];
  const numCraters = isBoss ? 10 : 7;
  for (let i = 0; i < numCraters; i++) {
    const cDist = (Math.random() * 0.62 + 0.1) * baseR;
    const cAngle = Math.random() * Math.PI * 2;
    craters.push({
      x: Math.cos(cAngle) * cDist,
      y: Math.sin(cAngle) * cDist,
      radius: Math.random() * 15 + 8,
      hasPeak: Math.random() < 0.65
    });
  }

  // Yüzeydeki Kaya Yükseltileri (Surface Boulders)
  const boulders = [];
  for (let i = 0; i < (isBoss ? 14 : 9); i++) {
    const bDist = (Math.random() * 0.68 + 0.1) * baseR;
    const bAngle = Math.random() * Math.PI * 2;
    boulders.push({
      x: Math.cos(bAngle) * bDist,
      y: Math.sin(bAngle) * bDist,
      size: Math.random() * 4 + 2
    });
  }

  // Işıltılı Değerli Maden Damarları (Organic Branching Veins)
  const veins = [];
  const numVeins = isBoss ? 6 : 4;
  for (let i = 0; i < numVeins; i++) {
    const startAng = (i / numVeins) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
    const startDist = (Math.random() * 0.25 + 0.1) * baseR;
    let px = Math.cos(startAng) * startDist;
    let py = Math.sin(startAng) * startDist;
    const points = [{ x: px, y: py }];
    const segs = 3 + Math.floor(Math.random() * 3);
    for (let s = 0; s < segs; s++) {
      const stepAng = startAng + (Math.random() * 1.2 - 0.6);
      const stepLen = (Math.random() * 0.22 + 0.12) * baseR;
      px += Math.cos(stepAng) * stepLen;
      py += Math.sin(stepAng) * stepLen;
      points.push({ x: px, y: py });
    }
    veins.push(points);
  }

  // Parlayan Kristal Maden Noktaları (Gems)
  const crystals = [];
  const numCrystals = isBoss ? 8 : 5;
  for (let i = 0; i < numCrystals; i++) {
    const crAng = Math.random() * Math.PI * 2;
    const crDist = (Math.random() * 0.65 + 0.15) * baseR;
    crystals.push({
      x: Math.cos(crAng) * crDist,
      y: Math.sin(crAng) * crDist,
      size: Math.random() * 5 + 3,
      sparklePhase: Math.random() * Math.PI * 2
    });
  }

  // Çatlaklar (Hasar aldıkça akkor magma/enerji parlayan yarıklar)
  const cracks = [];
  for (let i = 0; i < 8; i++) {
    const endV = vertices[Math.floor(Math.random() * vertices.length)];
    cracks.push({
      startX: (Math.random() - 0.5) * 20,
      startY: (Math.random() - 0.5) * 20,
      midX: (Math.random() - 0.5) * (baseR * 0.5),
      midY: (Math.random() - 0.5) * (baseR * 0.5),
      endX: endV.x * 0.95,
      endY: endV.y * 0.95,
      threshold: 0.88 - i * 0.11
    });
  }

  // Asteroit etrafında yörüngede dönen mikro-parçacıklar (Space Dust / Debris)
  const debris = [];
  for (let i = 0; i < 7; i++) {
    debris.push({
      angle: (i / 7) * Math.PI * 2,
      distX: baseR * (1.3 + (i % 3) * 0.2),
      distY: baseR * (0.55 + (i % 2) * 0.15),
      speed: 0.007 + (i % 3) * 0.003,
      size: Math.random() * 2.2 + 1.2
    });
  }

  currentAsteroid = {
    tierIndex: tierIdx,
    sectorName: tier.sectorName,
    name: asteroidName,
    stepInTier: stepInTier,
    isBoss: isBoss,
    bossTimer: 40,
    maxBossTimer: 40,
    color: isBoss ? "#4a0e17" : tier.color,
    lightColor: isBoss ? "#ff6b81" : (tier.lightColor || "#94a3b8"),
    darkColor: isBoss ? "#2b050d" : (tier.darkColor || "#0f172a"),
    glow: isBoss ? "#ff0044" : tier.glow,
    veinColor: isBoss ? "#ff3366" : tier.veinColor,
    maxHp: maxHp,
    currentHp: maxHp,
    reward: reward,
    radius: baseR,
    rotation: 0,
    rotSpeed: (Math.random() * 0.004 + 0.002) * (Math.random() < 0.5 ? 1 : -1),
    scale: 0.25, // Doğuş / warp-in efekti
    hitFlash: 0,
    vertices: vertices,
    craters: craters,
    boulders: boulders,
    veins: veins,
    crystals: crystals,
    cracks: cracks,
    debris: debris
  };

  updateTargetInfoUI();
}

// ==================== HASAR VE PARÇALANMA ====================

function damageAsteroid(amount, isCrit = false, x = null, y = null, isAuto = false) {
  let finalAmount = amount;
  if (state.skills.strike && state.skills.strike.activeTimer > 0) {
    finalAmount *= 1.25; // %25 İyon Alanı zırh eritme bonusu
  }
  currentAsteroid.currentHp -= finalAmount;
  currentAsteroid.hitFlash = 1.0;

  const hitX = x !== null ? x : canvas.width / 2;
  const hitY = y !== null ? y : canvas.height / 2;

  // Lazer vuruşundan uçuşan minik kıvılcımlar
  const sparkCount = isCrit ? 10 : 4;
  for (let i = 0; i < sparkCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = Math.random() * (isCrit ? 9 : 5) + 1.5;
    particles.push({
      x: hitX,
      y: hitY,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      size: Math.random() * 3 + 1.5,
      color: isCrit ? "#00f0ff" : (Math.random() < 0.5 ? "#ffffff" : currentAsteroid.veinColor),
      life: 1.0,
      decay: Math.random() * 0.04 + 0.025
    });
  }

  // Kritik vuruşta küçük şarapnel kopması
  if (isCrit && Math.random() < 0.6) {
    shards.push({
      x: hitX,
      y: hitY,
      vx: (Math.random() - 0.5) * 7,
      vy: (Math.random() - 0.5) * 7,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 6 + 3,
      color: currentAsteroid.veinColor,
      lightColor: "#ffffff",
      life: 0.9,
      decay: 0.03
    });
  }

  if (!isAuto) {
    currentAsteroid.scale = 0.94;
    window.sounds.playMineHit(isCrit);
    screenShake = isCrit ? 6 : 2;

    floatingTexts.push({
      text: (isCrit ? "KRİTİK! " : "") + formatNumber(Math.floor(finalAmount)),
      x: hitX + (Math.random() * 26 - 13),
      y: hitY - 10,
      vy: -1.8,
      color: isCrit ? "#00f0ff" : "#fff",
      size: isCrit ? 22 : 16,
      life: 1.0,
      isCrit: isCrit
    });
  }

  if (currentAsteroid.currentHp <= 0) {
    destroyAsteroid();
  }

  updateHPBarUI();
}

function destroyAsteroid() {
  window.sounds.playExplode();
  screenShake = currentAsteroid.isBoss ? 26 : 16;

  const earned = currentAsteroid.reward;
  state.credits += earned;
  state.totalEarnedAllTime += earned;
  state.currentRunAsteroids = (state.currentRunAsteroids || 0) + 1;
  state.totalAsteroidsDestroyed = (state.totalAsteroidsDestroyed || 0) + 1;
  checkRankProgression();

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // 1. Şok Dalgası Patlaması (Shockwave Blast)
  shockwaves.push({
    x: centerX,
    y: centerY,
    radius: 12,
    maxRadius: currentAsteroid.isBoss ? 250 : 180,
    color: currentAsteroid.glow,
    life: 1.0,
    speed: currentAsteroid.isBoss ? 9 : 7
  });

  // 2. Kaya Şarapnelleri (Uçuşan ve dönen büyük taş parçaları)
  const numShards = currentAsteroid.isBoss ? 24 : 14;
  for (let i = 0; i < numShards; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = Math.random() * (currentAsteroid.isBoss ? 11 : 8) + 2.5;
    const shardSize = Math.random() * 12 + 6;
    shards.push({
      x: centerX + Math.cos(ang) * (Math.random() * 25),
      y: centerY + Math.sin(ang) * (Math.random() * 25),
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.25,
      size: shardSize,
      color: Math.random() < 0.4 ? currentAsteroid.veinColor : currentAsteroid.color,
      lightColor: currentAsteroid.lightColor,
      life: 1.0,
      decay: Math.random() * 0.02 + 0.014
    });
  }

  // 3. Akkor Kıvılcım & Ateş Parçacıkları (Embers & Sparks)
  const countP = currentAsteroid.isBoss ? 70 : 40;
  for (let i = 0; i < countP; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = Math.random() * 12 + 2;
    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      size: Math.random() * 5 + 2,
      color: Math.random() < 0.5 ? currentAsteroid.veinColor : (Math.random() < 0.5 ? "#ffd700" : "#ff3366"),
      life: 1.0,
      decay: Math.random() * 0.025 + 0.015
    });
  }

  floatingTexts.push({
    text: `+${formatNumber(earned)} 🪙`,
    x: centerX,
    y: centerY - 40,
    vy: -2.5,
    color: "#ffd700",
    size: currentAsteroid.isBoss ? 32 : 26,
    life: 1.6,
    isCrit: true
  });

  if (currentAsteroid.isBoss) {
    showToast("👑 BOSS İMHA EDİLDİ! Muazzam Kredi Kazanıldı!", true);
  }

  spawnAsteroid();
  updateUI();
}

// ==================== TIKLAMA VE UFO ETKİLEŞİMİ ====================

function handleClick(e) {
  if (e && e.preventDefault) e.preventDefault();
  window.sounds.ensureContext();
  state.totalClicks++;

  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  // 1. Şans UFO'suna tıklandı mı?
  if (luckyUfo.active) {
    const distUfo = Math.hypot(clickX - luckyUfo.x, clickY - luckyUfo.y);
    if (distUfo < luckyUfo.radius * 1.5) {
      catchLuckyUfo();
      return;
    }
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const dist = Math.hypot(clickX - centerX, clickY - centerY);

  // 2. Asteroide tıklandı mı?
  if (dist < currentAsteroid.radius * 1.35) {
    const isCrit = Math.random() * 100 < getCritChance();
    const dmg = getClickDamage() * (isCrit ? getCritMultiplier() : 1);

    window.sounds.playMineHit(isCrit);
    screenShake = isCrit ? 6 : 2;

    damageAsteroid(dmg, isCrit, clickX, clickY, false);
  } else {
    window.sounds.playLaser();
    floatingTexts.push({
      text: "ISKA",
      x: clickX,
      y: clickY,
      vy: -1.5,
      color: "#8b9bb4",
      size: 14,
      life: 0.6
    });
  }

  updateUI();
}

// Şans UFO'sunu Yakalama
function catchLuckyUfo() {
  window.sounds.playUfo();
  screenShake = 12;
  luckyUfo.active = false;
  luckyUfo.spawnCooldown = 50 + Math.random() * 30;

  const roll = Math.random();
  if (roll < 0.38) {
    // 1. Çılgınlık Modu (15 sn 3x hasar)
    state.frenzyTimer = 15;
    showToast("🛸 ŞANS UFO'SU: 15 SN ÇILGINLIK MODU! (3x Kazı Gücü)");
  } else if (roll < 0.72) {
    // 2. Anında Kredi Yağmuru
    const instantCredits = Math.max(250, Math.floor(getAutoDPS() * 45 + getClickDamage() * 40));
    state.credits += instantCredits;
    state.totalEarnedAllTime += instantCredits;
    showToast(`🛸 ŞANS UFO'SU: +${formatNumber(instantCredits)} Kredi Kasası!`);
    floatingTexts.push({
      text: `+${formatNumber(instantCredits)} 🪙`,
      x: luckyUfo.x,
      y: luckyUfo.y,
      vy: -3,
      color: "#ffd700",
      size: 28,
      life: 1.8,
      isCrit: true
    });
  } else {
    // 3. Manyetik Kritik Dalgası
    state.skills.magnet.activeTimer = 15;
    showToast("🛸 ŞANS UFO'SU: 15 SN %100 KRİTİK FIRTINASI!");
  }

  // Patlama efekti
  for (let i = 0; i < 25; i++) {
    particles.push({
      x: luckyUfo.x,
      y: luckyUfo.y,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.5) * 14,
      size: Math.random() * 5 + 2,
      color: "#00f0ff",
      life: 1.0,
      decay: 0.025
    });
  }

  updateUI();
}

// ==================== AKTİF YETENEKLER (SKILLS) ====================

function activateSkill(type) {
  window.sounds.ensureContext();
  const lvl = state.skillLevels ? state.skillLevels[type] || 0 : 0;
  const def = SKILL_UPGRADE_DEFS[type];

  // Kilitli kontrolü
  if (lvl < 1) {
    showToast(`🔒 ${def.baseName.toUpperCase()} KİLİTLİ! Beceriler sekmesinden kilidi açın.`);
    const tabBtn = document.querySelector('.tab-btn[data-tab="tab-skills"]');
    if (tabBtn) tabBtn.click();
    return;
  }

  const skill = state.skills[type];
  if (!skill || skill.cdTimer > 0) return;

  const lvlData = def.levels[lvl - 1];
  window.sounds.playSkill();

  if (type === "overdrive") {
    skill.duration = lvlData.duration;
    skill.maxCd = lvlData.cd;
    skill.activeTimer = lvlData.duration;
    skill.cdTimer = lvlData.cd;
    showToast(`⚡ AŞIRI YÜKLEME DEVREDE! (${lvlData.duration} sn ${lvlData.mult}x Güç)`);
  } else if (type === "strike") {
    skill.maxCd = lvlData.cd;
    skill.cdTimer = lvlData.cd;
    skill.duration = 5;
    skill.activeTimer = 5;
    megaLaserEffect.active = true;
    megaLaserEffect.timer = megaLaserEffect.duration;
    screenShake = 22;

    // Asteroitin canına anında darbe (Normalde tam oran, Boss'ta %55'i)
    const ratio = currentAsteroid.isBoss ? (lvlData.dmgRatio * 0.55) : lvlData.dmgRatio;
    const strikeDmg = Math.max(15, Math.floor(currentAsteroid.maxHp * ratio));
    damageAsteroid(strikeDmg, true, canvas.width / 2, canvas.height / 2, false);
    showToast(`☄️ YÖRÜNGE DARBESİ! ${formatNumber(strikeDmg)} Hasar Vuruldu! (5 sn İyon Alanı)`);
  } else if (type === "magnet") {
    skill.duration = lvlData.duration;
    skill.maxCd = lvlData.cd;
    skill.activeTimer = lvlData.duration;
    skill.cdTimer = lvlData.cd;
    const descText = `+${lvlData.critBonus}% Kritik`;
    showToast(`🧲 KUANTUM MIKNATISI: ${descText}! (${lvlData.duration} sn)`);
  }

  updateUI();
}

// ==================== RENDER & CANVAS DÖNGÜSÜ ====================

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  if (screenShake > 0) {
    const rx = (Math.random() - 0.5) * screenShake;
    const ry = (Math.random() - 0.5) * screenShake;
    ctx.translate(rx, ry);
    screenShake *= 0.9;
    if (screenShake < 0.2) screenShake = 0;
  }

  // 1. Yıldızlar
  stars.forEach(star => {
    star.alpha += star.speed;
    const a = (Math.sin(star.alpha) + 1) / 2;
    ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.8})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // 2. Boss Varsa Arkasında Tehlike Halkası Çiz
  if (currentAsteroid.isBoss) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 51, 102, 0.4)";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#ff0044";
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentAsteroid.radius * 1.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 3. Asteroit Çizimi
  currentAsteroid.rotation += currentAsteroid.rotSpeed;
  if (currentAsteroid.scale < 1) {
    currentAsteroid.scale += (1 - currentAsteroid.scale) * 0.15;
  }
  if (currentAsteroid.hitFlash > 0) {
    currentAsteroid.hitFlash *= 0.85;
    if (currentAsteroid.hitFlash < 0.04) currentAsteroid.hitFlash = 0;
  }

  const v = currentAsteroid.vertices;
  const baseR = currentAsteroid.radius;
  const hpRatio = currentAsteroid.currentHp / currentAsteroid.maxHp;

  // 3A. Yörünge Mikro-Parçacıkları (Arka Katman: Y ekseni negatif olanlar)
  if (currentAsteroid.debris) {
    ctx.save();
    currentAsteroid.debris.forEach(d => {
      d.angle += d.speed;
      const dy = Math.sin(d.angle) * d.distY;
      if (dy < 0) {
        const dx = Math.cos(d.angle) * d.distX;
        ctx.fillStyle = "rgba(180, 210, 240, 0.35)";
        ctx.beginPath();
        ctx.arc(centerX + dx, centerY + dy, d.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(currentAsteroid.rotation);
  ctx.scale(currentAsteroid.scale, currentAsteroid.scale);

  // YOLU ÇİZ (Pürüzsüz organik kayalık kontur)
  function traceAsteroidPath() {
    ctx.beginPath();
    if (!v || v.length === 0) return;
    const len = v.length;
    const firstMidX = (v[0].x + v[1].x) / 2;
    const firstMidY = (v[0].y + v[1].y) / 2;
    ctx.moveTo(firstMidX, firstMidY);
    for (let i = 1; i < len; i++) {
      const next = v[(i + 1) % len];
      const midX = (v[i].x + next.x) / 2;
      const midY = (v[i].y + next.y) / 2;
      ctx.quadraticCurveTo(v[i].x, v[i].y, midX, midY);
    }
    const lastMidX = (v[len - 1].x + v[0].x) / 2;
    const lastMidY = (v[len - 1].y + v[0].y) / 2;
    ctx.quadraticCurveTo(v[0].x, v[0].y, firstMidX, firstMidY);
    ctx.closePath();
  }

  // Dinamik Işıklandırma & Aura Yoğunluğu (Daha Parlak ve Canlı)
  const timeNow = Date.now() / 320;
  const breathPulse = Math.sin(timeNow) * 6;
  const isBoss = currentAsteroid.isBoss;
  const damageIntensity = (1 - hpRatio) * 14;
  const flashGlow = (currentAsteroid.hitFlash || 0) * 28;
  const dynamicBlur = (isBoss ? 48 : 32) + breathPulse + damageIntensity + flashGlow;

  // Çift Katmanlı Atmosferik Dış Parıltı (Kozmik Korona)
  ctx.save();
  traceAsteroidPath();
  ctx.shadowColor = currentAsteroid.glow;
  ctx.shadowBlur = dynamicBlur;
  ctx.strokeStyle = currentAsteroid.glow;
  ctx.lineWidth = isBoss ? 3.5 : 2.5;
  ctx.stroke();

  // İç yoğun çekirdek çizgisi
  ctx.shadowBlur = dynamicBlur * 0.4;
  ctx.strokeStyle = currentAsteroid.veinColor;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  // 3B. 3D Küresel Hacimsel Aydınlatma (Işık sol-üstten vurur)
  ctx.save();
  traceAsteroidPath();
  ctx.clip(); // Tüm dokular, kraterler ve madenler bu kayanın içinde kalır

  const lightX = -baseR * 0.38;
  const lightY = -baseR * 0.42;
  const rockGrad = ctx.createRadialGradient(
    lightX, lightY, baseR * 0.06,
    0, 0, baseR * 1.25
  );
  rockGrad.addColorStop(0, currentAsteroid.lightColor || "#94a3b8");
  rockGrad.addColorStop(0.35, currentAsteroid.color);
  rockGrad.addColorStop(0.74, currentAsteroid.darkColor || "#0f172a");
  rockGrad.addColorStop(1, "#02040a");

  ctx.fillStyle = rockGrad;
  ctx.fill();

  // 3C. Yüzey Kayalık Fasetleri (Chiseled Rock Shading)
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (let i = 0; i < v.length; i += 4) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(v[i].x, v[i].y);
    ctx.lineTo(v[(i + 2) % v.length].x, v[(i + 2) % v.length].y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
  for (let i = 2; i < v.length; i += 4) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(v[i].x, v[i].y);
    ctx.lineTo(v[(i + 2) % v.length].x, v[(i + 2) % v.length].y);
    ctx.closePath();
    ctx.fill();
  }

  // 3D Kraterler (Detailed Craters with Specular Lips & Central Peaks)
  if (currentAsteroid.craters) {
    currentAsteroid.craters.forEach(cr => {
      // Dış derinlik gölgesi
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.arc(cr.x + 1.5, cr.y + 1.5, cr.radius * 1.08, 0, Math.PI * 2);
      ctx.fill();

      // Krater Çukuru Tabanı
      const craterGrad = ctx.createRadialGradient(
        cr.x - cr.radius * 0.25, cr.y - cr.radius * 0.25, cr.radius * 0.1,
        cr.x, cr.y, cr.radius
      );
      craterGrad.addColorStop(0, "rgba(2, 4, 10, 0.9)");
      craterGrad.addColorStop(1, "rgba(10, 16, 30, 0.65)");
      ctx.fillStyle = craterGrad;
      ctx.beginPath();
      ctx.arc(cr.x, cr.y, cr.radius, 0, Math.PI * 2);
      ctx.fill();

      // Kraterin Işık Alan Üst Kenarlığı (Hilal parıltı)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(cr.x - 1, cr.y - 1, cr.radius * 0.96, Math.PI * 0.8, Math.PI * 1.8);
      ctx.stroke();

      // Kraterin Alt Derinlik Gölgesi
      ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(cr.x + 1.2, cr.y + 1.2, cr.radius * 0.92, -Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();

      // Krater İçi Merkezi Tepe (Central Peak)
      if (cr.hasPeak) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.beginPath();
        ctx.arc(cr.x - 0.5, cr.y - 0.5, cr.radius * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.beginPath();
        ctx.arc(cr.x + 0.5, cr.y + 0.5, cr.radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // Yüzeydeki Kaya Blokları (Boulders)
  if (currentAsteroid.boulders) {
    currentAsteroid.boulders.forEach(b => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.beginPath();
      ctx.arc(b.x + 1, b.y + 1, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = currentAsteroid.lightColor || "rgba(255, 255, 255, 0.3)";
      ctx.beginPath();
      ctx.arc(b.x - 0.8, b.y - 0.8, b.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Işıltılı Değerli Maden Damarları (Luminous Ore Veins)
  if (currentAsteroid.veins) {
    currentAsteroid.veins.forEach(pts => {
      if (pts.length < 2) return;
      // Dış Parıltı
      ctx.strokeStyle = currentAsteroid.veinColor;
      ctx.lineWidth = 3.6;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let p = 1; p < pts.length; p++) {
        ctx.lineTo(pts[p].x, pts[p].y);
      }
      ctx.stroke();

      // İç Beyaz Neon Çekirdek
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let p = 1; p < pts.length; p++) {
        ctx.lineTo(pts[p].x, pts[p].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    });
  }

  // Parlayan Kristal Nodülleri & 4 Köşeli Yıldız Parıltısı (Gems & Cross Glints)
  if (currentAsteroid.crystals) {
    const timeG = Date.now() / 340;
    currentAsteroid.crystals.forEach(gem => {
      const pulse = (Math.sin(timeG + gem.sparklePhase) + 1) / 2;
      ctx.save();
      ctx.fillStyle = currentAsteroid.veinColor;
      ctx.shadowColor = currentAsteroid.glow;
      ctx.shadowBlur = 12 * pulse + 5;
      ctx.beginPath();
      const s = gem.size * (0.8 + pulse * 0.4);
      ctx.moveTo(gem.x, gem.y - s);
      ctx.lineTo(gem.x + s * 0.75, gem.y);
      ctx.lineTo(gem.x, gem.y + s);
      ctx.lineTo(gem.x - s * 0.75, gem.y);
      ctx.closePath();
      ctx.fill();

      // Yıldız Işıltısı (Cross Glint)
      if (pulse > 0.4) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = (pulse - 0.4) * 1.6;
        const gLen = s * 1.8;
        ctx.beginPath();
        ctx.moveTo(gem.x - gLen, gem.y);
        ctx.lineTo(gem.x + gLen, gem.y);
        ctx.moveTo(gem.x, gem.y - gLen);
        ctx.lineTo(gem.x, gem.y + gLen);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  // Akkor Magma / Enerji Hasar Çatlakları
  if (currentAsteroid.cracks && hpRatio < 0.9) {
    currentAsteroid.cracks.forEach(c => {
      if (hpRatio < c.threshold) {
        ctx.save();
        const lavaColor = hpRatio < 0.3 ? "#ff1a40" : (hpRatio < 0.6 ? "#ff5500" : "#ffaa00");
        const lavaGlow = hpRatio < 0.3 ? "#ff0033" : "#ff8800";
        ctx.strokeStyle = lavaColor;
        ctx.shadowColor = lavaGlow;
        ctx.shadowBlur = 16;
        ctx.lineWidth = hpRatio < 0.3 ? 4.5 : 3.2;
        ctx.beginPath();
        ctx.moveTo(c.startX, c.startY);
        ctx.lineTo(c.midX, c.midY);
        ctx.lineTo(c.endX, c.endY);
        ctx.stroke();

        ctx.strokeStyle = "#fffdf0";
        ctx.lineWidth = 1.4;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  // Lazer Vuruş Parlaması (Hit Flash)
  if (currentAsteroid.hitFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${currentAsteroid.hitFlash * 0.4})`;
    ctx.fill();
  }

  ctx.restore(); // Clip sonu

  // Kenar Yansıma Işığı (Fresnel Rim Lighting)
  ctx.save();
  traceAsteroidPath();
  ctx.strokeStyle = currentAsteroid.glow;
  ctx.lineWidth = 2.0;
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // Translate/rotate sonu

  // 3D. Yörünge Mikro-Parçacıkları (Ön Katman: Y ekseni pozitif olanlar)
  if (currentAsteroid.debris) {
    ctx.save();
    currentAsteroid.debris.forEach(d => {
      const dy = Math.sin(d.angle) * d.distY;
      if (dy >= 0) {
        const dx = Math.cos(d.angle) * d.distX;
        ctx.fillStyle = currentAsteroid.veinColor;
        ctx.shadowColor = currentAsteroid.glow;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(centerX + dx, centerY + dy, d.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  // 4. Dronlar & Otomatik Lazerler
  dronesList.forEach(drone => {
    drone.angle += drone.speed;
    const dx = centerX + Math.cos(drone.angle) * drone.distX;
    const dy = centerY + Math.sin(drone.angle) * drone.distY;

    drone.laserTimer++;
    if (drone.laserTimer > 40) {
      ctx.strokeStyle = drone.isSatellite ? "rgba(0, 240, 255, 0.85)" : "rgba(255, 153, 0, 0.85)";
      ctx.lineWidth = drone.isSatellite ? 3 : 1.5;
      ctx.shadowColor = drone.isSatellite ? "#00f0ff" : "#ff9900";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(centerX + (Math.random() * 20 - 10), centerY + (Math.random() * 20 - 10));
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (drone.laserTimer > 46) drone.laserTimer = 0;
    }

    ctx.fillStyle = drone.isSatellite ? "#00f0ff" : "#ff9900";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(dx, dy, drone.isSatellite ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // 5. Yörünge Darbesi Mega Lazeri (Skill 2 Animasyonu)
  if (megaLaserEffect.active) {
    megaLaserEffect.timer--;
    const alpha = megaLaserEffect.timer / megaLaserEffect.duration;

    ctx.save();
    ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
    ctx.lineWidth = megaLaserEffect.width * alpha;
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 35;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, centerY);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
    ctx.lineWidth = (megaLaserEffect.width / 3) * alpha;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, centerY);
    ctx.stroke();
    ctx.restore();

    if (megaLaserEffect.timer <= 0) megaLaserEffect.active = false;
  }

  // 6. Şans UFO'su (Uçan Daire)
  if (luckyUfo.active) {
    luckyUfo.x += luckyUfo.vx;
    luckyUfo.y += luckyUfo.vy;

    // UFO Dış Parıltısı
    ctx.save();
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 15;

    // UFO Kubbesi
    ctx.fillStyle = "#00f0ff";
    ctx.beginPath();
    ctx.arc(luckyUfo.x, luckyUfo.y - 4, luckyUfo.radius * 0.45, Math.PI, 0);
    ctx.fill();

    // UFO Diski
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.ellipse(luckyUfo.x, luckyUfo.y, luckyUfo.radius, luckyUfo.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Işıklar
    ctx.fillStyle = "#fff";
    [-12, 0, 12].forEach(ox => {
      ctx.beginPath();
      ctx.arc(luckyUfo.x + ox, luckyUfo.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Ekrandan çıktı mı?
    if (luckyUfo.x > canvas.width + 60 || luckyUfo.y > canvas.height + 60) {
      luckyUfo.active = false;
      luckyUfo.spawnCooldown = 45 + Math.random() * 30;
    }
  }

  // 6B. Şok Dalgaları (Expanding Shockwaves on Explosions)
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.radius += sw.speed;
    sw.life = 1 - (sw.radius / sw.maxRadius);

    if (sw.life <= 0) {
      shockwaves.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.strokeStyle = sw.color;
    ctx.shadowColor = sw.color;
    ctx.shadowBlur = 18;
    ctx.lineWidth = Math.max(1, 5 * sw.life);
    ctx.globalAlpha = sw.life * 0.85;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 6C. Kaya Şarapnelleri (Tumbling Shards & Rock Fragments)
  for (let i = shards.length - 1; i >= 0; i--) {
    const sh = shards[i];
    sh.x += sh.vx;
    sh.y += sh.vy;
    sh.vx *= 0.98;
    sh.vy *= 0.98;
    sh.rotation += sh.rotSpeed;
    sh.life -= sh.decay;

    if (sh.life <= 0) {
      shards.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.rotate(sh.rotation);
    ctx.globalAlpha = sh.life;

    ctx.fillStyle = sh.color;
    ctx.shadowColor = sh.lightColor || "#00f0ff";
    ctx.shadowBlur = 6 * sh.life;
    ctx.beginPath();
    const s = sh.size;
    ctx.moveTo(-s * 0.5, -s * 0.7);
    ctx.lineTo(s * 0.6, -s * 0.4);
    ctx.lineTo(s * 0.4, s * 0.7);
    ctx.lineTo(-s * 0.5, s * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = sh.lightColor || "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  // 7. Parçacıklar
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  // 8. Uçuşan Sayılar
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy;
    ft.life -= 0.02;

    if (ft.life <= 0) {
      floatingTexts.splice(i, 1);
      continue;
    }

    ctx.font = `bold ${ft.size}px 'Orbitron', sans-serif`;
    ctx.fillStyle = ft.color;
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = ft.isCrit ? 14 : 4;
    ctx.globalAlpha = ft.life;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
  }

  ctx.restore();
  requestAnimationFrame(render);
}

// ==================== ZAMANLAYICILAR & OYUN DÖNGÜSÜ ====================

// Otomasyon Hasar Döngüsü (Her 100ms)
setInterval(() => {
  const dps = getAutoDPS();
  if (dps > 0) {
    const tickDamage = dps / 10;
    damageAsteroid(tickDamage, false, null, null, true);
    updateHUDOnly();
  }
}, 100);

// Saniyelik Sistem Döngüsü (Boss Sayacı, Cooldownlar, UFO, Kayıt)
setInterval(() => {
  state.playTimeSeconds++;

  // 1. Boss Zamanlayıcısı
  if (currentAsteroid.isBoss) {
    currentAsteroid.bossTimer--;
    if (currentAsteroid.bossTimer <= 0) {
      showToast("⏳ BOSS KAÇTI! Zaman doldu.");
      state.currentRunAsteroids = (state.currentRunAsteroids || 0) + 1;
      spawnAsteroid();
    }
    updateBossTimerUI();
  }

  // 2. Yetenek Cooldownları & Süreleri
  for (const skill of Object.values(state.skills)) {
    if (skill.cdTimer > 0) skill.cdTimer--;
    if (skill.activeTimer && skill.activeTimer > 0) skill.activeTimer--;
  }

  // 3. UFO Çılgınlık Süresi
  if (state.frenzyTimer > 0) state.frenzyTimer--;

  // 4. Şans UFO Spawner
  if (!luckyUfo.active) {
    luckyUfo.spawnCooldown--;
    if (luckyUfo.spawnCooldown <= 0) {
      luckyUfo.active = true;
      luckyUfo.x = -40;
      luckyUfo.y = 80 + Math.random() * (canvas.height - 220);
      luckyUfo.vx = 2.0 + Math.random() * 1.2;
      luckyUfo.vy = (Math.random() - 0.4) * 1.5;
    }
  }

  // 5. Reklam Güçlendirme Süreleri (1 Dakika Tıkla, 2 Dakika Oto)
  if (state.adBoostClickTimer > 0) state.adBoostClickTimer--;
  if (state.adBoostAutoTimer > 0) state.adBoostAutoTimer--;
  updateAdBoostersUI();

  // 6. Ara Reklam Zamanlayıcısı (İlk reklam 5 dakika, sonraki reklamlar 10 dakikada bir)
  state.midgameAdTimer = (state.midgameAdTimer || 0) + 1;
  if (state.midgameAdTimer >= (state.nextMidgameTarget || 300)) {
    // Boss savaşı sürüyorsa oyuncuyu bölmemek için boss bitene kadar bekle
    if (!currentAsteroid.isBoss) {
      state.midgameAdTimer = 0;
      state.nextMidgameTarget = 600; // Sonraki reklamlar 10 dakika (600 saniye)
      triggerCrazyGamesAd("midgame");
    }
  }

  updateSkillsUI();
  updateBuffsUI();
  saveGame();
}, 1000);

// ==================== ARAYÜZ (UI) GÜNCELLEMELERİ ====================

function updateUI() {
  updateHUDOnly();
  updateTargetInfoUI();
  updateSkillsUI();
  updateBuffsUI();
  updateAdBoostersUI();
}

function updateHUDOnly() {
  document.getElementById("credits-display").innerText = formatNumber(state.credits);
  document.getElementById("dps-display").innerText = formatNumber(getAutoDPS()) + " /sn";
  
  const pilotNameEl = document.getElementById("pilot-name-display");
  if (pilotNameEl) pilotNameEl.innerText = state.playerName || "Pilot";

  const dmBonus = Math.floor(state.darkMatter * 10);
  document.getElementById("dm-display").innerText = formatNumber(state.darkMatter);
  document.querySelector(".hud-stat.dark-matter .stat-label").innerText = `KARANLIK MADDE (+%${dmBonus})`;
  const dmPill = document.querySelector(".hud-stat.dark-matter");
  if (dmPill) {
    dmPill.title = `1 Karanlık Madde = +%10 Kalıcı Üretim & Hasar Bonusu (Mevcut Bonus: +%${dmBonus})`;
  }

  document.getElementById("click-power-text").innerText = formatNumber(getClickDamage());
  document.getElementById("crit-chance-text").innerText = `%${getCritChance()}`;
  document.getElementById("asteroid-count-text").innerText = `#${(state.currentRunAsteroids || 0) + 1}`;

  const currentRank = calculatePlayerRank();
  const currentLeague = getLeagueInfo(currentRank);
  const rankDisplay = document.getElementById("rank-display");
  if (rankDisplay) rankDisplay.innerText = `#${formatNumber(currentRank)}`;
  const rankPill = document.getElementById("hud-rank-pill");
  if (rankPill) rankPill.title = `Galaktik Sıralama: #${formatNumber(currentRank)} (${currentLeague.name}) - Puanlama rehberi için tıklayın`;

  updateUpgradeStates();
  updateSkillsUpgradeStates();
  updateWarpUI();
}

function updateTargetInfoUI() {
  const tier = ASTEROID_TIERS[currentAsteroid.tierIndex] || ASTEROID_TIERS[0];
  const step = (state.currentRunAsteroids || 0) % 5;

  document.getElementById("target-name").innerText = currentAsteroid.name;
  document.getElementById("target-tier").innerText = `SEKTÖR ${currentAsteroid.tierIndex + 1}: ${tier.sectorName.toUpperCase()}`;

  const stageEl = document.getElementById("target-stage");
  if (stageEl) {
    stageEl.innerText = currentAsteroid.isBoss ? "🔥 BOSS" : `[${step + 1} / 5]`;
    stageEl.classList.toggle("boss-stage", currentAsteroid.isBoss);
  }

  // Boss Rozeti ve Sayacı Göster/Gizle
  const bossBadge = document.getElementById("boss-badge");
  const bossTimerBox = document.getElementById("boss-timer-container");

  if (currentAsteroid.isBoss) {
    if (bossBadge) bossBadge.classList.remove("hidden");
    if (bossTimerBox) bossTimerBox.classList.remove("hidden");
    updateBossTimerUI();
  } else {
    if (bossBadge) bossBadge.classList.add("hidden");
    if (bossTimerBox) bossTimerBox.classList.add("hidden");
  }

  updateHPBarUI();
}

function updateBossTimerUI() {
  if (!currentAsteroid.isBoss) return;
  const pct = Math.max(0, (currentAsteroid.bossTimer / currentAsteroid.maxBossTimer) * 100);
  document.getElementById("boss-timer-fill").style.width = pct + "%";
  document.getElementById("boss-timer-text").innerText = `${currentAsteroid.bossTimer}s`;
}

function updateHPBarUI() {
  const pct = Math.max(0, (currentAsteroid.currentHp / currentAsteroid.maxHp) * 100);
  document.getElementById("hp-bar-fill").style.width = pct + "%";
  document.getElementById("hp-bar-text").innerText = 
    `${formatNumber(Math.max(0, currentAsteroid.currentHp))} / ${formatNumber(currentAsteroid.maxHp)} HP`;
}

function updateWarpUI() {
  const calculatedDM = Math.floor(Math.sqrt((state.totalEarnedAllTime || 0) / 250000));
  const pendingDM = Math.max(0, calculatedDM - (state.darkMatter || 0));

  const pendingEl = document.getElementById("warp-pending-dm");
  if (pendingEl) pendingEl.innerText = `+${pendingDM} 🔮`;

  const bonusPreview = document.getElementById("warp-bonus-preview");
  if (bonusPreview) bonusPreview.innerText = `Kalıcı Üretim Bonusu: +%${pendingDM * 10} (Her 1 KM = +%10)`;

  // Kazanılacak Galaktik Skor Önizlemesi
  const effectiveGainDM = Math.max(1, pendingDM);
  const warpScoreGain = SCORE_PER_WARP_JUMP + (effectiveGainDM * SCORE_PER_DARK_MATTER);
  const pendingScoreEl = document.getElementById("warp-pending-score");
  if (pendingScoreEl) {
    pendingScoreEl.innerText = `+${formatNumber(warpScoreGain)} Puan`;
    pendingScoreEl.style.color = pendingDM >= 1 ? "#ffd700" : "#8b9bb4";
  }

  const scoreDetailEl = document.getElementById("warp-score-detail");
  if (scoreDetailEl) {
    scoreDetailEl.innerText = `🚀 Warp: +${formatNumber(SCORE_PER_WARP_JUMP)} Skor | 🔮 KM Başına: +${formatNumber(SCORE_PER_DARK_MATTER)} Skor`;
  }

  // Warp Sonrası & Mevcut Galaktik Skor Durum Paneli
  const myScore = getPlayerScore();
  const myRank = calculatePlayerRank();

  const curScoreEl = document.getElementById("warp-current-score");
  if (curScoreEl) curScoreEl.innerText = `${formatNumber(myScore)} Puan`;

  const statusRankEl = document.getElementById("warp-status-rank");
  if (statusRankEl) statusRankEl.innerText = `#${formatNumber(myRank)}`;

  const totalJumpsEl = document.getElementById("warp-total-jumps");
  if (totalJumpsEl) totalJumpsEl.innerText = `${state.warpCount || 0} Warp`;

  const totalWarpScore = ((state.warpCount || 0) * SCORE_PER_WARP_JUMP) + ((state.darkMatter || 0) * SCORE_PER_DARK_MATTER);
  const totalScoreEarnedEl = document.getElementById("warp-total-score-earned");
  if (totalScoreEarnedEl) totalScoreEarnedEl.innerText = `${formatNumber(totalWarpScore)} Puan`;

  // Sıradaki Karanlık Madde için Kredi İhtiyacı
  const nextTargetDM = (state.darkMatter || 0) + pendingDM + 1;
  const nextReqCredits = Math.pow(nextTargetDM, 2) * 250000;
  const creditsDiff = Math.max(0, nextReqCredits - (state.totalEarnedAllTime || 0));
  const nextReqEl = document.getElementById("warp-next-dm-req");
  if (nextReqEl) nextReqEl.innerText = `${formatNumber(creditsDiff)} 🪙`;

  const btnWarp = document.getElementById("btn-warp-execute");
  if (btnWarp) btnWarp.disabled = pendingDM < 1;
}

// Yetenek Butonları & Cooldown Arayüzü
function updateSkillsUI() {
  for (const [key, skill] of Object.entries(state.skills)) {
    const btn = document.getElementById(`skill-${key}`);
    const cdEl = document.getElementById(`cd-${key}`);
    const badgeEl = document.getElementById(`badge-${key}`);
    const descEl = document.getElementById(`skill-desc-${key}`);
    if (!btn || !cdEl) continue;

    const lvl = state.skillLevels ? state.skillLevels[key] || 0 : 0;
    const isLocked = lvl < 1;

    btn.classList.toggle("skill-locked", isLocked);
    btn.classList.toggle("unlocked", !isLocked);

    if (badgeEl) {
      badgeEl.innerText = isLocked ? "KİLİTLİ" : `SV. ${lvl}`;
    }

    if (descEl) {
      if (isLocked) {
        descEl.innerText = "🔒 Kilitli (Aç)";
      } else {
        const lvlData = SKILL_UPGRADE_DEFS[key].levels[lvl - 1];
        if (key === "overdrive") descEl.innerText = `${lvlData.mult}x Kazı Gücü`;
        else if (key === "strike") descEl.innerText = `%${Math.round(lvlData.dmgRatio * 100)} Ani Hasar`;
        else if (key === "magnet") descEl.innerText = `+${lvlData.critBonus}% Kritik`;
      }
    }

    const isOnCd = !isLocked && skill.cdTimer > 0;
    btn.classList.toggle("on-cooldown", isOnCd);

    if (isOnCd) {
      const cdPct = (skill.cdTimer / skill.maxCd) * 100;
      cdEl.style.width = cdPct + "%";
    } else {
      cdEl.style.width = "0%";
    }

    // Aktif kullanım parıltısı
    const isActive = !isLocked && skill.activeTimer && skill.activeTimer > 0;
    btn.classList.toggle("active-buff", !!isActive);
  }
}

// Aktif Yetenek Süresi & Buff Göstergesi (Orta Üst Alan)
function updateBuffsUI() {
  const container = document.getElementById("active-buffs-container");
  if (!container) return;

  let html = "";

  // 1. Aşırı Yükleme (Overdrive)
  if (state.skills.overdrive.activeTimer > 0) {
    const s = state.skills.overdrive;
    const maxDur = s.duration || 6;
    const curSec = s.activeTimer;
    const pct = Math.max(0, Math.min(100, (curSec / maxDur) * 100));
    const lvl = (state.skillLevels && state.skillLevels.overdrive) || 1;
    const lvlData = SKILL_UPGRADE_DEFS.overdrive.levels[lvl - 1];
    const multText = lvlData ? `${lvlData.mult}x Hasar` : "Güç Katlayıcı";

    html += `
      <div class="active-skill-card skill-overdrive">
        <div class="asc-header">
          <span class="asc-title">⚡ YÜKLEME <span class="asc-effect">(${multText})</span></span>
          <span class="asc-timer">⏳ ${curSec}s</span>
        </div>
        <div class="asc-bar-track">
          <div class="asc-bar-fill" style="width: ${pct.toFixed(1)}%;"></div>
        </div>
      </div>
    `;
  }

  // 2. Yörünge Darbesi İyon Alanı (Strike)
  if (state.skills.strike.activeTimer > 0) {
    const s = state.skills.strike;
    const maxDur = s.duration || 5;
    const curSec = s.activeTimer;
    const pct = Math.max(0, Math.min(100, (curSec / maxDur) * 100));

    html += `
      <div class="active-skill-card skill-strike">
        <div class="asc-header">
          <span class="asc-title">☄️ DARBE <span class="asc-effect">(+%25)</span></span>
          <span class="asc-timer">⏳ ${curSec}s</span>
        </div>
        <div class="asc-bar-track">
          <div class="asc-bar-fill" style="width: ${pct.toFixed(1)}%;"></div>
        </div>
      </div>
    `;
  }

  // 3. Kuantum Mıknatısı (Magnet)
  if (state.skills.magnet.activeTimer > 0) {
    const s = state.skills.magnet;
    const maxDur = s.duration || 6;
    const curSec = s.activeTimer;
    const pct = Math.max(0, Math.min(100, (curSec / maxDur) * 100));
    const lvl = (state.skillLevels && state.skillLevels.magnet) || 1;
    const lvlData = SKILL_UPGRADE_DEFS.magnet.levels[lvl - 1];
    const critText = lvlData ? `+${lvlData.critBonus}%` : "Kritik";

    html += `
      <div class="active-skill-card skill-magnet">
        <div class="asc-header">
          <span class="asc-title">🧲 MIKNATIS <span class="asc-effect">(${critText})</span></span>
          <span class="asc-timer">⏳ ${curSec}s</span>
        </div>
        <div class="asc-bar-track">
          <div class="asc-bar-fill" style="width: ${pct.toFixed(1)}%;"></div>
        </div>
      </div>
    `;
  }

  // 4. Şans UFO Kuantum Çılgınlığı (Frenzy)
  if (state.frenzyTimer > 0) {
    const maxDur = 12;
    const curSec = state.frenzyTimer;
    const pct = Math.max(0, Math.min(100, (curSec / maxDur) * 100));

    html += `
      <div class="active-skill-card skill-frenzy">
        <div class="asc-header">
          <span class="asc-title">🛸 ÇILGINLIK <span class="asc-effect">(3x)</span></span>
          <span class="asc-timer">⏳ ${curSec}s</span>
        </div>
        <div class="asc-bar-track">
          <div class="asc-bar-fill" style="width: ${pct.toFixed(1)}%;"></div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// ==================== CRAZYGAMES SDK v3 & REKLAM GÜÇLENDİRMELERİ ====================

let crazyGamesInitialized = false;

async function initCrazyGames() {
  try {
    if (window.CrazyGames && window.CrazyGames.SDK) {
      await window.CrazyGames.SDK.init();
      crazyGamesInitialized = true;
      console.log("CrazyGames SDK v3 başarıyla başlatıldı.");

      // Oyun döngüsü takip bildirimi
      if (window.CrazyGames.SDK.game && window.CrazyGames.SDK.game.gameplayStart) {
        window.CrazyGames.SDK.game.gameplayStart();
      }
    } else {
      console.log("CrazyGames SDK bulunamadı (Yerel/Offline mod). Reklamlar simülasyon modunda çalışacak.");
    }
  } catch (err) {
    console.warn("CrazyGames SDK init uyarısı:", err);
  }
}

function triggerCrazyGamesAd(type = "midgame") {
  if (!crazyGamesInitialized || !window.CrazyGames || !window.CrazyGames.SDK || !window.CrazyGames.SDK.ad) {
    console.log(`[Ad Simulation] ${type} reklamı simüle edildi (SDK bağlı değil veya geliştirici ortamı).`);
    return;
  }

  const prevMuted = window.sounds ? window.sounds.muted : false;
  if (window.sounds) window.sounds.muted = true;
  if (window.CrazyGames.SDK.game && window.CrazyGames.SDK.game.gameplayStop) {
    window.CrazyGames.SDK.game.gameplayStop();
  }

  const callbacks = {
    adStarted: () => {
      console.log(`${type} reklamı başladı.`);
      if (window.sounds) window.sounds.muted = true;
    },
    adFinished: () => {
      console.log(`${type} reklamı tamamlandı.`);
      if (window.sounds) window.sounds.muted = prevMuted;
      if (window.CrazyGames.SDK.game && window.CrazyGames.SDK.game.gameplayStart) {
        window.CrazyGames.SDK.game.gameplayStart();
      }
    },
    adError: (error) => {
      console.warn(`${type} reklam hatası/atlandı:`, error);
      if (window.sounds) window.sounds.muted = prevMuted;
      if (window.CrazyGames.SDK.game && window.CrazyGames.SDK.game.gameplayStart) {
        window.CrazyGames.SDK.game.gameplayStart();
      }
    }
  };

  window.CrazyGames.SDK.ad.requestAd("midgame", callbacks);
}

function requestRewardedBoost(boostType) {
  // Zaten aktifken tekrar tıklanıp süre sıfırlanmasın!
  if (boostType === 'click' && state.adBoostClickTimer > 0) return;
  if (boostType === 'auto' && state.adBoostAutoTimer > 0) return;

  const grantReward = () => {
    if (boostType === 'click') {
      state.adBoostClickTimer = 60; // 1 Dakika
    } else {
      state.adBoostAutoTimer = 120; // 2 Dakika
    }
    updateAdBoostersUI();
    updateHUDOnly();
    if (window.sounds && window.sounds.playOverdrive) {
      window.sounds.playOverdrive();
    }
  };

  // SDK yoksa veya yerel test ediliyorsa direkt ödülü ver (kullanıcıyı engelleme)
  if (!crazyGamesInitialized || !window.CrazyGames || !window.CrazyGames.SDK || !window.CrazyGames.SDK.ad) {
    console.log(`[Rewarded Ad Fallback] ${boostType} güçlendirmesi yerel test modunda uygulandı.`);
    grantReward();
    return;
  }

  const prevMuted = window.sounds ? window.sounds.muted : false;
  if (window.sounds) window.sounds.muted = true;
  if (window.CrazyGames.SDK.game && window.CrazyGames.SDK.game.gameplayStop) {
    window.CrazyGames.SDK.game.gameplayStop();
  }

  const callbacks = {
    adStarted: () => {
      console.log("Ödüllü reklam gösteriliyor...");
      if (window.sounds) window.sounds.muted = true;
    },
    adFinished: () => {
      console.log("Ödüllü reklam başarıyla tamamlandı!");
      if (window.sounds) window.sounds.muted = prevMuted;
      if (window.CrazyGames.SDK.game && window.CrazyGames.SDK.game.gameplayStart) {
        window.CrazyGames.SDK.game.gameplayStart();
      }
      grantReward();
    },
    adError: (error) => {
      console.warn("Ödüllü reklam gösterilemedi:", error);
      if (window.sounds) window.sounds.muted = prevMuted;
      if (window.CrazyGames.SDK.game && window.CrazyGames.SDK.game.gameplayStart) {
        window.CrazyGames.SDK.game.gameplayStart();
      }
      // CrazyGames dışındaki alan adlarında (örn. GitHub Pages, localhost) oyuncuyu ödüllendir
      if (!window.location.hostname.includes("crazygames")) {
        grantReward();
      }
    }
  };

  window.CrazyGames.SDK.ad.requestAd("rewarded", callbacks);
}

function updateAdBoostersUI() {
  const btnClick = document.getElementById("btn-boost-click");
  const timerClick = document.getElementById("boost-click-timer");
  const btnAuto = document.getElementById("btn-boost-auto");
  const timerAuto = document.getElementById("boost-auto-timer");

  if (btnClick && timerClick) {
    if (state.adBoostClickTimer > 0) {
      btnClick.classList.add("active-boost");
      btnClick.style.pointerEvents = "none";
      timerClick.innerText = `🔥 ${state.adBoostClickTimer}s`;
    } else {
      btnClick.classList.remove("active-boost");
      btnClick.style.pointerEvents = "auto";
      timerClick.innerText = "1 Dk (Reklam)";
    }
  }

  if (btnAuto && timerAuto) {
    if (state.adBoostAutoTimer > 0) {
      btnAuto.classList.add("active-boost");
      btnAuto.style.pointerEvents = "none";
      const mins = Math.floor(state.adBoostAutoTimer / 60);
      const secs = state.adBoostAutoTimer % 60;
      timerAuto.innerText = `⚡ ${mins > 0 ? mins + "m " : ""}${secs < 10 ? "0" + secs : secs}s`;
    } else {
      btnAuto.classList.remove("active-boost");
      btnAuto.style.pointerEvents = "auto";
      timerAuto.innerText = "2 Dk (Reklam)";
    }
  }
}

// ==================== MAĞAZA VE KARTLAR ====================

function getAutoUnitEffectiveDPS(def) {
  let naniteMult = 1;
  const nsLvl = state.skillLevels ? state.skillLevels.naniteSpeed || 0 : 0;
  if (nsLvl > 0) {
    naniteMult += SKILL_UPGRADE_DEFS.naniteSpeed.levels[nsLvl - 1].dpsMult;
  }
  return def.dps * getPrestigeMultiplier() * naniteMult;
}

function initUpgradeCards() {
  const manualContainer = document.getElementById("manual-upgrades-list");
  const autoContainer = document.getElementById("auto-upgrades-list");

  manualContainer.innerHTML = "";
  autoContainer.innerHTML = "";

  for (const [key, def] of Object.entries(UPGRADE_DEFS)) {
    const card = document.createElement("div");
    card.id = `upgrade-card-${key}`;
    card.className = "upgrade-card disabled";
    card.onclick = () => buyUpgrade(key);

    const isAuto = def.type === "auto";

    card.innerHTML = `
      <div class="card-left">
        <span class="card-icon">${def.icon}</span>
        <div class="card-details">
          <span class="card-title">${def.name}</span>
          <span class="card-desc">${def.desc}</span>
          <div class="card-stats-row">
            <span class="card-level" id="card-lvl-${key}">${isAuto ? "Adet: 0" : "Seviye: 0"}</span>
            <span class="card-power-preview" id="card-power-${key}"></span>
          </div>
        </div>
      </div>
      <div class="card-right">
        <span class="card-cost" id="card-cost-${key}">0 🪙</span>
      </div>
    `;

    if (isAuto) {
      autoContainer.appendChild(card);
    } else {
      manualContainer.appendChild(card);
    }
  }
}

function updateUpgradeStates() {
  for (const [key, def] of Object.entries(UPGRADE_DEFS)) {
    const card = document.getElementById(`upgrade-card-${key}`);
    if (!card) continue;

    const lvl = state.upgrades[key] || 0;
    const cost = getUpgradeCost(key);
    const isMax = def.maxLevel && lvl >= def.maxLevel;
    const canAfford = state.credits >= cost && !isMax;

    card.classList.toggle("disabled", !canAfford);

    const lvlEl = document.getElementById(`card-lvl-${key}`);
    if (lvlEl) {
      lvlEl.innerText = def.type === "auto" ? `Adet: ${lvl}` : `Seviye: ${lvl}${def.maxLevel ? ` / ${def.maxLevel}` : ""}`;
    }

    const powerEl = document.getElementById(`card-power-${key}`);
    if (powerEl) {
      if (isMax) {
        powerEl.innerHTML = `<span class="power-next">⭐ MAKSİMUM</span>`;
      } else if (def.type === "auto") {
        const unitDPS = getAutoUnitEffectiveDPS(def);
        const curDPS = lvl * unitDPS;
        const nextDPS = (lvl + 1) * unitDPS;
        powerEl.innerHTML = `⚡ ${formatNumber(curDPS)}/sn <span class="power-arrow">➔</span> <span class="power-next">${formatNumber(nextDPS)}/sn</span> <span class="power-gain">(+${formatNumber(unitDPS)}/sn)</span>`;
      } else if (key === "clickPower") {
        const curEff = def.getEffect(lvl);
        const nextEff = def.getEffect(lvl + 1);
        const overchargeMult = UPGRADE_DEFS.overcharge.getEffect(state.upgrades.overcharge || 0);
        const tachyonMult = UPGRADE_DEFS.tachyonBeam.getEffect(state.upgrades.tachyonBeam || 0);
        const prestigeMult = getPrestigeMultiplier();
        const curVal = curEff * overchargeMult * tachyonMult * prestigeMult;
        const nextVal = nextEff * overchargeMult * tachyonMult * prestigeMult;
        const diff = nextVal - curVal;
        powerEl.innerHTML = `🔨 ${formatNumber(curVal)} <span class="power-arrow">➔</span> <span class="power-next">${formatNumber(nextVal)}</span> <span class="power-gain">(+${formatNumber(diff)})</span>`;
      } else if (key === "critChance") {
        const curC = def.getEffect(lvl);
        const nextC = def.getEffect(lvl + 1);
        powerEl.innerHTML = `🎯 %${curC} <span class="power-arrow">➔</span> <span class="power-next">%${nextC}</span> <span class="power-gain">(+%2)</span>`;
      } else if (key === "critDamage") {
        const curM = def.getEffect(lvl);
        const nextM = def.getEffect(lvl + 1);
        powerEl.innerHTML = `💎 ${curM.toFixed(1)}x <span class="power-arrow">➔</span> <span class="power-next">${nextM.toFixed(1)}x</span> <span class="power-gain">(+0.5x)</span>`;
      } else if (key === "overcharge" || key === "tachyonBeam") {
        const curBonus = Math.round((def.getEffect(lvl) - 1) * 100);
        const nextBonus = Math.round((def.getEffect(lvl + 1) - 1) * 100);
        const step = key === "overcharge" ? 12 : 20;
        powerEl.innerHTML = `✨ +%${curBonus} <span class="power-arrow">➔</span> <span class="power-next">+%${nextBonus}</span> <span class="power-gain">(+%${step})</span>`;
      }
    }

    const costEl = document.getElementById(`card-cost-${key}`);
    if (costEl) {
      costEl.innerText = isMax ? "MAKS" : `${formatNumber(cost)} 🪙`;
    }
  }
}

function buyUpgrade(key) {
  const def = UPGRADE_DEFS[key];
  const cost = getUpgradeCost(key);
  const isMax = def.maxLevel && (state.upgrades[key] || 0) >= def.maxLevel;

  if (state.credits >= cost && !isMax) {
    state.credits -= cost;
    state.upgrades[key] = (state.upgrades[key] || 0) + 1;
    window.sounds.playUpgrade();
    
    if (def.type === "auto") {
      updateDrones();
    }

    checkRankProgression();
    updateUI();
  }
}

// ==================== BECERİ LABORATUVARI (SKILLS TAB) ====================

function initSkillsUpgradeCards() {
  const container = document.getElementById("skills-upgrades-list");
  if (!container) return;

  container.innerHTML = "";

  for (const [key, def] of Object.entries(SKILL_UPGRADE_DEFS)) {
    const card = document.createElement("div");
    card.id = `skill-card-${key}`;
    card.className = "upgrade-card skill-card-upgrade disabled";
    card.onclick = () => buySkillUpgrade(key);

    let dotsHtml = "";
    for (let i = 1; i <= 5; i++) {
      dotsHtml += `<div class="level-dot" id="dot-${key}-${i}"></div>`;
    }

    card.innerHTML = `
      <div class="card-left">
        <span class="card-icon">${def.icon}</span>
        <div class="card-details">
          <span class="card-title">${def.name}</span>
          <span class="card-desc" id="skill-desc-text-${key}">${def.desc}</span>
          <div class="skill-level-dots" id="skill-dots-${key}">
            ${dotsHtml}
          </div>
        </div>
      </div>
      <div class="card-right">
        <span class="card-cost" id="skill-cost-val-${key}">0 🪙</span>
      </div>
    `;

    container.appendChild(card);
  }
}

function updateSkillsUpgradeStates() {
  if (!state.skillLevels) return;

  for (const [key, def] of Object.entries(SKILL_UPGRADE_DEFS)) {
    const card = document.getElementById(`skill-card-${key}`);
    if (!card) continue;

    const currentLvl = state.skillLevels[key] || 0;
    const isMax = currentLvl >= 5;
    const nextLvlData = isMax ? null : def.levels[currentLvl];
    const cost = nextLvlData ? nextLvlData.cost : 0;
    const canAfford = !isMax && state.credits >= cost;

    card.classList.toggle("disabled", !canAfford);

    // Seviye noktalarını güncelle
    for (let i = 1; i <= 5; i++) {
      const dot = document.getElementById(`dot-${key}-${i}`);
      if (dot) {
        dot.classList.toggle("active", i <= currentLvl);
        dot.classList.toggle("max", currentLvl === 5);
      }
    }

    // Açıklama metnini sıradaki seviye etkisiyle güncelle
    const descEl = document.getElementById(`skill-desc-text-${key}`);
    if (descEl) {
      if (isMax) {
        descEl.innerText = `⭐ MAKSİMUM SEVİYE - ${def.levels[4].desc}`;
      } else {
        descEl.innerText = nextLvlData.desc;
      }
    }

    // Maliyet etiketi
    const costEl = document.getElementById(`skill-cost-val-${key}`);
    if (costEl) {
      if (isMax) {
        costEl.innerText = "MAKS";
        costEl.style.color = "#ffd700";
      } else {
        const prefix = currentLvl === 0 ? "KİLİT AÇ: " : "YÜKSELT: ";
        costEl.innerText = `${prefix}${formatNumber(cost)} 🪙`;
        costEl.style.color = canAfford ? "#ffd700" : "#8b9bb4";
      }
    }
  }
}

function buySkillUpgrade(key) {
  const def = SKILL_UPGRADE_DEFS[key];
  if (!def || !state.skillLevels) return;

  const currentLvl = state.skillLevels[key] || 0;
  if (currentLvl >= 5) return;

  const nextLvlData = def.levels[currentLvl];
  if (state.credits >= nextLvlData.cost) {
    state.credits -= nextLvlData.cost;
    state.skillLevels[key] = currentLvl + 1;
    const newLvl = state.skillLevels[key];

    window.sounds.playUpgrade();
    const actionWord = currentLvl === 0 ? "KİLİDİ AÇILDI" : `SEVİYE ${newLvl}'E YÜKSELTİLDİ`;
    showToast(`🔬 ${def.baseName.toUpperCase()} ${actionWord}!`);

    checkRankProgression();
    updateUI();
  }
}

// ==================== GALAKTİK SIRALAMA & LİDERLİK TABLOSU ====================

// Dengeli Galaktik Skor Sabitleri
const SCORE_PER_CREDIT_DIVISOR = 20; // Her 20 Kredi = +1 Skor
const SCORE_PER_ASTEROID = 350;      // Her Asteroit İmhası = +350 Skor
const SCORE_PER_WARP_JUMP = 5000;    // Her Warp Sıçraması = +5,000 Skor (Dengelendi)
const SCORE_PER_DARK_MATTER = 1000;  // Her Karanlık Madde = +1,000 Skor (5.000'den dengelendi)
const SCORE_PER_CLICK = 2;           // Her Manuel Vuruş = +2 Skor

function getPlayerScore() {
  const creditsScore = Math.floor((state.totalEarnedAllTime || 0) / SCORE_PER_CREDIT_DIVISOR);
  const asteroidScore = (state.totalAsteroidsDestroyed || 0) * SCORE_PER_ASTEROID;
  const warpScore = ((state.warpCount || 0) * SCORE_PER_WARP_JUMP) + ((state.darkMatter || 0) * SCORE_PER_DARK_MATTER);
  const clicksScore = (state.totalClicks || 0) * SCORE_PER_CLICK;
  return creditsScore + asteroidScore + warpScore + clicksScore;
}

function calculatePlayerRank() {
  const score = getPlayerScore();
  const maxRank = 250000;
  if (score <= 0) return maxRank;

  // Logaritmik dinamik eğri
  const scale = Math.log10(score + 1) / 10.5; // 0..1
  const progressRatio = Math.min(0.999996, Math.pow(Math.min(1.0, scale), 1.6));
  
  let rank = Math.round(maxRank * (1 - progressRatio));
  return Math.max(1, rank);
}

function checkRankProgression() {
  const currentRank = calculatePlayerRank();
  const currentLeague = getLeagueInfo(currentRank);

  // Sıralama ilerleme kontrolü
  if (state.lastRank === undefined) state.lastRank = 248500;
  if (currentRank < state.lastRank) {
    const passed = state.lastRank - currentRank;
    if (passed >= 200) {
      showToast(`🎉 RÜTBE YÜKSELDİ! #${formatNumber(state.lastRank)} ➔ #${formatNumber(currentRank)} (+${formatNumber(passed)} pilot geçildi!)`);
      state.lastRank = currentRank;
    }
  }

  // Lig terfisi kontrolü
  if (state.lastLeagueName === undefined) state.lastLeagueName = "Bronz Madenci V";
  if (currentLeague.name !== state.lastLeagueName) {
    showToast(`🏆 LİG ATLADINIZ! Tebrikler, ${currentLeague.name} rütbesine yükseldiniz!`);
    window.sounds.playUpgrade();
    state.lastLeagueName = currentLeague.name;
  }

  // HUD güncelle
  const rankDisplay = document.getElementById("rank-display");
  if (rankDisplay) rankDisplay.innerText = `#${formatNumber(currentRank)}`;
  
  const rankPill = document.getElementById("hud-rank-pill");
  if (rankPill) {
    rankPill.title = `Galaktik Sıralama: #${formatNumber(currentRank)} (${currentLeague.name})`;
  }
}

// Liderlik Tablosu Deterministic İsim Üretici
const RIVAL_PREFIXES = ["Nova", "Orion", "Astro", "Kozmik", "Vortex", "Siber", "Stellar", "Titan", "Nebula", "Solar", "Kuantum", "Dark"];
const RIVAL_SUFFIXES = ["Miner", "Avcı", "Driller", "Kaptan", "Pilot", "Gezgin", "Usta", "Korsan", "Lord", "X", "Pro", "Star"];

function getRivalName(rank) {
  const seed = rank * 2654435761;
  const pIdx = Math.abs(seed) % RIVAL_PREFIXES.length;
  const sIdx = Math.abs(Math.floor(seed / 7)) % RIVAL_SUFFIXES.length;
  const num = Math.abs(Math.floor(seed / 13)) % 99 + 1;
  return `${RIVAL_PREFIXES[pIdx]}_${RIVAL_SUFFIXES[sIdx]}_${num}`;
}

function renderLeaderboardModal() {
  const myRank = calculatePlayerRank();
  const myLeague = getLeagueInfo(myRank);
  const myScore = getPlayerScore();

  // 1. Oyuncu Kartı
  const iconEl = document.getElementById("lb-league-icon");
  const playerNameEl = document.getElementById("lb-player-name");
  const nameEl = document.getElementById("lb-league-name");
  const rankEl = document.getElementById("lb-my-rank");
  const scoreEl = document.getElementById("lb-my-score");
  const pctEl = document.getElementById("lb-percentile-text");

  if (iconEl) iconEl.innerText = myLeague.icon;
  if (playerNameEl) playerNameEl.innerText = state.playerName || "Kozmik Pilot";
  if (nameEl) {
    nameEl.innerText = myLeague.name;
    nameEl.style.color = myLeague.color;
  }
  if (rankEl) rankEl.innerText = `Sıralama: #${formatNumber(myRank)} / 250,000`;
  if (scoreEl) scoreEl.innerText = `Skor: ${formatNumber(myScore)}`;

  const passedPct = (((250000 - myRank) / 250000) * 100).toFixed(1);
  if (pctEl) pctEl.innerText = `Oyuncuların %${passedPct}'ini geçtiniz!`;

  // 2. Bir sonraki rütbe barı
  const nextTargetEl = document.getElementById("lb-next-rank-text");
  const progressFill = document.getElementById("lb-progress-fill");
  if (nextTargetEl) nextTargetEl.innerText = myLeague.nextTarget;

  if (progressFill) {
    const range = myLeague.maxRank - myLeague.minRank;
    const progress = Math.max(0, Math.min(100, ((myLeague.maxRank - myRank) / (range || 1)) * 100));
    progressFill.style.width = `${Math.max(5, progress.toFixed(1))}%`;
  }

  // 3. Sıralama Tablosu Satırları
  const rowsContainer = document.getElementById("lb-table-rows");
  if (!rowsContainer) return;

  let html = "";

  // En İyi 5 Galaktik Şampiyon (Zirvedeki Efsaneler)
  const topChamps = [
    { rank: 1, name: "👑 NovaLord_Apex", league: "Kozmik Efsane", score: 4850000000 },
    { rank: 2, name: "👑 Nebula_Valkyrie", league: "Kozmik Efsane", score: 2750000000 },
    { rank: 3, name: "👑 Orion_Core_Drill", league: "Kozmik Efsane", score: 1420000000 },
    { rank: 4, name: "👑 QuantumReaper_01", league: "Kozmik Efsane", score: 680000000 },
    { rank: 5, name: "👑 SolarPhoenix_99", league: "Kozmik Efsane", score: 250000000 }
  ];

  topChamps.forEach(champ => {
    html += `
      <div class="lb-table-row">
        <span class="col-rank">#${champ.rank}</span>
        <span class="col-pilot">${champ.name}</span>
        <span class="col-league">${champ.league}</span>
        <span class="col-score">${formatNumber(champ.score)}</span>
      </div>
    `;
  });

  // Ayırıcı
  if (myRank > 7) {
    html += `<div class="lb-table-row lb-divider">• • • • •</div>`;
  }

  // Oyuncunun Çevresindeki 5 Sıra (Tutarlı ve dinamik çevre rekabeti)
  const startRank = Math.max(6, myRank - 2);
  const endRank = Math.min(250000, myRank + 2);

  for (let r = startRank; r <= endRank; r++) {
    const isMe = r === myRank;
    const league = getLeagueInfo(r);
    
    let scoreVal = myScore;
    if (!isMe) {
      const rankDiff = myRank - r; // Pozitif ise rakip oyuncunun önünde
      const pctDiff = 1 + (rankDiff * 0.035);
      scoreVal = Math.max(0, Math.floor(myScore * pctDiff + rankDiff * 45));
    }

    const pilotName = isMe ? `🚀 ${state.playerName || "SEN"} (SİZ)` : getRivalName(r);

    html += `
      <div class="lb-table-row ${isMe ? 'lb-user-row' : ''}">
        <span class="col-rank">#${formatNumber(r)}</span>
        <span class="col-pilot">
          ${pilotName}
          ${isMe ? '<span class="lb-you-badge">SİZ</span>' : ''}
        </span>
        <span class="col-league">${league.name.split(" ")[0]}</span>
        <span class="col-score">${formatNumber(scoreVal)}</span>
      </div>
    `;
  }

  rowsContainer.innerHTML = html;

  // Skor kaydediciyi tetikle
  saveToHallOfFame();
}

function openLeaderboardModal() {
  switchLeaderboardTab("live");
  document.getElementById("leaderboard-modal").classList.remove("hidden");
  window.sounds.playUpgrade();
}

function closeLeaderboardModal() {
  document.getElementById("leaderboard-modal").classList.add("hidden");
}

// ==================== KALICI ŞEREF KÜRSÜSÜ (HALL OF FAME) ====================

const HOF_STORAGE_KEY = "DeepSpaceMiner_HallOfFame";

function getHallOfFameRecords() {
  try {
    const raw = localStorage.getItem(HOF_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveToHallOfFame() {
  const score = getPlayerScore();
  if (score <= 0 && (state.warpCount || 0) === 0 && (state.totalAsteroidsDestroyed || 0) === 0) {
    return;
  }

  const name = state.playerName || "Kozmik Pilot";
  const records = getHallOfFameRecords();
  const currentRank = calculatePlayerRank();
  const currentLeague = getLeagueInfo(currentRank);
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;

  if (!state.pilotId) {
    state.pilotId = "pilot_" + Date.now();
  }

  const existingIndex = records.findIndex(r => r.id === state.pilotId || r.name.toLowerCase() === name.toLowerCase());

  const newRecord = {
    id: state.pilotId,
    name: name,
    score: score,
    rank: currentRank,
    league: currentLeague.name,
    warpCount: state.warpCount || 0,
    darkMatter: state.darkMatter || 0,
    asteroids: state.totalAsteroidsDestroyed || 0,
    date: dateStr
  };

  if (existingIndex >= 0) {
    if (score >= records[existingIndex].score) {
      records[existingIndex] = newRecord;
    }
  } else {
    records.push(newRecord);
  }

  // Skora göre azalan sırala
  records.sort((a, b) => b.score - a.score);

  // En iyi 25 kaydı sakla
  const trimmed = records.slice(0, 25);
  try {
    localStorage.setItem(HOF_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error("Hall of Fame kaydedilemedi:", e);
  }
}

function renderHallOfFame() {
  const container = document.getElementById("hof-table-rows");
  if (!container) return;

  const records = getHallOfFameRecords();
  if (!records || records.length === 0) {
    container.innerHTML = `
      <div class="hof-empty-row">
        Henüz kayıtlı bir efsanevi sefer bulunmuyor.<br>
        Madenciliğe devam edin, puan toplayın veya Warp sıçraması yaparak adınızı şeref kürsüsüne yazdırın!
      </div>
    `;
    return;
  }

  let html = "";
  records.forEach((rec, idx) => {
    const isCurrentPilot = rec.id === state.pilotId || (rec.name && rec.name === state.playerName);
    let rankBadge = `#${idx + 1}`;
    if (idx === 0) rankBadge = "🥇 #1";
    else if (idx === 1) rankBadge = "🥈 #2";
    else if (idx === 2) rankBadge = "🥉 #3";

    html += `
      <div class="lb-table-row ${isCurrentPilot ? 'lb-user-row' : ''}">
        <span class="col-rank">${rankBadge}</span>
        <span class="col-pilot">
          ${rec.name}
          ${isCurrentPilot ? '<span class="lb-you-badge">SİZ</span>' : ''}
          <small style="color:var(--text-muted);font-size:0.75rem;margin-left:4px;">(${rec.date || ''})</small>
        </span>
        <span class="col-league">${rec.league.split(" ")[0]} (${rec.warpCount} Warp)</span>
        <span class="col-score">${formatNumber(rec.score)}</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

function switchLeaderboardTab(tabName) {
  const btnLive = document.getElementById("lb-tab-live");
  const btnHof = document.getElementById("lb-tab-hof");
  const viewLive = document.getElementById("lb-view-live-container");
  const viewHof = document.getElementById("lb-view-hof-container");

  if (tabName === "live") {
    if (btnLive) btnLive.classList.add("active");
    if (btnHof) btnHof.classList.remove("active");
    if (viewLive) viewLive.classList.remove("hidden");
    if (viewHof) viewHof.classList.add("hidden");
    renderLeaderboardModal();
  } else {
    if (btnHof) btnHof.classList.add("active");
    if (btnLive) btnLive.classList.remove("active");
    if (viewHof) viewHof.classList.remove("hidden");
    if (viewLive) viewLive.classList.add("hidden");
    saveToHallOfFame();
    renderHallOfFame();
  }
}

// ==================== PİLOT İSİM & SİCİL YÖNETİMİ ====================

const PILOT_FIRST_NAMES = ["Kaptan", "Astro", "Kozmik", "Nova", "Orion", "Siber", "Stellar", "Titan", "Gezgin", "Vortex", "Galaktik", "Solar"];
const PILOT_LAST_NAMES = ["Avcı", "Kurt", "Şahin", "Gölge", "Yıldız", "Reaper", "Yolcu", "Pusula", "Fırtına", "Alev", "Korsan", "Madenci"];

function getRandomPilotName() {
  const f = PILOT_FIRST_NAMES[Math.floor(Math.random() * PILOT_FIRST_NAMES.length)];
  const l = PILOT_LAST_NAMES[Math.floor(Math.random() * PILOT_LAST_NAMES.length)];
  const n = Math.floor(Math.random() * 90) + 10;
  return `${f}_${l}_${n}`;
}

function openPilotModal(allowClose = true) {
  const modal = document.getElementById("pilot-modal");
  if (!modal) return;

  const btnClose = document.getElementById("btn-close-pilot");
  if (btnClose) {
    btnClose.style.display = allowClose ? "block" : "none";
  }

  const input = document.getElementById("input-pilot-name");
  if (input) {
    input.value = state.playerName || getRandomPilotName();
    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);
  }

  modal.classList.remove("hidden");
}

function closePilotModal() {
  const modal = document.getElementById("pilot-modal");
  if (modal) modal.classList.add("hidden");
}

function savePilotName(customName) {
  let name = (customName || "").trim();
  if (!name) {
    name = getRandomPilotName();
  }
  if (name.length > 16) {
    name = name.substring(0, 16);
  }

  const isFirstTime = !state.playerName;
  state.playerName = name;
  localStorage.setItem("DeepSpaceMiner_PlayerName", name);

  updateHUDOnly();
  saveToHallOfFame();

  const lbPlayerName = document.getElementById("lb-player-name");
  if (lbPlayerName) lbPlayerName.innerText = name;

  closePilotModal();
  saveGame();

  if (isFirstTime) {
    showToast(`🚀 Hoş geldiniz Kaptan ${name}! Galaktik madencilik seferiniz başladı.`);
  } else {
    showToast(`✏️ Pilot çağrı adınız "${name}" olarak güncellendi.`);
  }
}

// ==================== DRONLAR & YILDIZLAR ====================

function initStars() {
  stars = [];
  const count = 130;
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.5 + 0.5,
      alpha: Math.random(),
      speed: Math.random() * 0.02 + 0.005
    });
  }
}

function updateDrones() {
  const totalDrones = (state.upgrades.drone || 0) + (state.upgrades.satellite || 0) * 2;
  dronesList = [];

  for (let i = 0; i < totalDrones; i++) {
    const angleOffset = (i / totalDrones) * Math.PI * 2;
    dronesList.push({
      angle: angleOffset,
      distX: currentAsteroid.radius * 1.5 + (i % 3) * 20,
      distY: (currentAsteroid.radius * 1.5 + (i % 3) * 20) * 0.45,
      speed: 0.015 + (i % 2) * 0.005,
      laserTimer: Math.random() * 40,
      isSatellite: i >= (state.upgrades.drone || 0)
    });
  }
}

// ==================== WARP / PRESTİJ ====================

function executeWarp() {
  const calculatedDM = Math.floor(Math.sqrt((state.totalEarnedAllTime || 0) / 250000));
  const pendingDM = Math.max(0, calculatedDM - (state.darkMatter || 0));

  if (pendingDM >= 1) {
    const oldRank = calculatePlayerRank();
    const warpScoreGain = SCORE_PER_WARP_JUMP + (pendingDM * SCORE_PER_DARK_MATTER);

    state.darkMatter += pendingDM;
    state.warpCount = (state.warpCount || 0) + 1;
    state.credits = 0; // Warp ile krediler sıfırlanır
    state.currentRunAsteroids = 0;

    for (const key of Object.keys(state.upgrades)) {
      state.upgrades[key] = 0;
    }

    const newRank = calculatePlayerRank();
    const overtaken = Math.max(0, oldRank - newRank);

    window.sounds.playWarp();
    showToast(`🚀 WARP TAMAMLANDI! +${pendingDM} KM | +${formatNumber(warpScoreGain)} Skor (+${formatNumber(overtaken)} pilot geçildi!)`);
    
    checkRankProgression();
    spawnAsteroid(0);
    updateDrones();
    updateUI();
    saveGame();
  }
}

function showToast(msg, isBoss = false) {
  // Kullanıcı talebi: Bildirimler ekranı kaplamasın, SADECE BOSS bildirimi kalsın!
  if (!isBoss) return;
  const box = document.getElementById("notification-box");
  if (!box) return;
  box.innerHTML = "";
  const toast = document.createElement("div");
  toast.className = "toast toast-boss";
  toast.innerText = msg;
  box.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 2200);
}

// ==================== KAYIT / YÜKLE / SIFIRLA ====================

const SESSION_TIMEOUT_SEC = 15 * 60; // 15 dakika = 900 saniye kısıtlaması
let isResetting = false;

function resetStateToInitial() {
  state.credits = 0;
  state.totalEarnedAllTime = 0;
  state.darkMatter = 0;
  state.warpCount = 0;
  state.totalClicks = 0;
  state.currentRunAsteroids = 0;
  state.totalAsteroidsDestroyed = 0;
  state.playTimeSeconds = 0;
  state.lastSaveTime = Date.now();
  state.frenzyTimer = 0;
  for (const key of Object.keys(state.upgrades)) {
    state.upgrades[key] = 0;
  }
  state.skillLevels = {
    overdrive: 0,
    strike: 0,
    magnet: 0,
    naniteSpeed: 0,
    critBoost: 0
  };
  state.skills = {
    overdrive: { cdTimer: 0, maxCd: 60, duration: 8, activeTimer: 0 },
    strike: { cdTimer: 0, maxCd: 75 },
    magnet: { cdTimer: 0, maxCd: 65, duration: 8, activeTimer: 0 }
  };
  state.lastRank = 250000;
  state.lastLeagueName = "Bronz Madenci V";
  state.adBoostClickTimer = 0;
  state.adBoostAutoTimer = 0;
  state.midgameAdTimer = 0;
  state.nextMidgameTarget = 300;
}

function handleSessionTimeout(elapsedSec) {
  // 15 dakikadan uzun süre sonra gelindi: Önceki seferi Şeref Kürsüsüne kaydet ve sıfırla
  const prevScore = getPlayerScore();
  if (prevScore > 0 || (state.warpCount || 0) > 0 || (state.totalAsteroidsDestroyed || 0) > 0) {
    saveToHallOfFame();
  }

  const savedPlayerName = state.playerName || localStorage.getItem("DeepSpaceMiner_PlayerName") || "";
  const elapsedMin = Math.floor(elapsedSec / 60);

  localStorage.removeItem("DeepSpaceMiner_Save");
  resetStateToInitial();
  state.playerName = savedPlayerName;
  if (savedPlayerName) {
    localStorage.setItem("DeepSpaceMiner_PlayerName", savedPlayerName);
  }

  spawnAsteroid(0);
  updateDrones();
  updateUI();

  setTimeout(() => {
    const expiryModal = document.getElementById("expiry-modal");
    if (expiryModal) {
      const timeText = document.getElementById("expiry-time-text");
      if (timeText) timeText.innerText = `${elapsedMin} dakika`;
      const scoreText = document.getElementById("expiry-saved-score");
      if (scoreText) scoreText.innerText = `${formatNumber(prevScore)} Puan`;
      expiryModal.classList.remove("hidden");
    } else {
      showToast(`⏱️ 15 dakikadan uzun süre (${elapsedMin} dk) oyundan uzak kaldığınız için yeni sefere başlandı.`);
    }
  }, 150);

  saveGame();
}

function saveGame() {
  if (isResetting) return;
  state.lastSaveTime = Date.now();
  const saveJson = JSON.stringify(state);
  localStorage.setItem("DeepSpaceMiner_Save", saveJson);

  // CrazyGames Bulut Kaydı (Data Module Cloud Save)
  if (crazyGamesInitialized && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.data) {
    try {
      window.CrazyGames.SDK.data.setItem("DeepSpaceMiner_Save", saveJson);
    } catch (e) {
      // sessizce geç
    }
  }
}

async function loadGame() {
  let saved = localStorage.getItem("DeepSpaceMiner_Save");

  // CrazyGames Bulut Kaydı Kontrolü (Cloud Save)
  if (crazyGamesInitialized && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.data) {
    try {
      const cloudData = await window.CrazyGames.SDK.data.getItem("DeepSpaceMiner_Save");
      if (cloudData) {
        saved = cloudData;
      }
    } catch (e) {
      console.warn("Bulut verisi okunamadı:", e);
    }
  }

  if (saved) {
    try {
      const parsed = typeof saved === "string" ? JSON.parse(saved) : saved;
      const now = Date.now();
      const lastSave = parsed.lastSaveTime || now;
      const elapsedSec = (now - lastSave) / 1000;

      // 15 Dakika Zaman Kısıtlaması Kontrolü (15dk sonra girerse aynı yerden devam edemez)
      if (elapsedSec > SESSION_TIMEOUT_SEC) {
        Object.assign(state, parsed);
        handleSessionTimeout(elapsedSec);
        return;
      }

      Object.assign(state, parsed);

      if (!state.skillLevels) {
        state.skillLevels = {
          overdrive: 0,
          strike: 0,
          magnet: 0,
          naniteSpeed: 0,
          critBoost: 0
        };
      }
      if (state.lastRank === undefined) state.lastRank = 248500;
      if (!state.lastLeagueName) state.lastLeagueName = "Bronz Madenci V";

      if (state.totalAsteroidsDestroyed === undefined) {
        state.totalAsteroidsDestroyed = state.asteroidsDestroyed || 0;
      }
      if (state.currentRunAsteroids === undefined) {
        const totalUpgrades = Object.values(state.upgrades || {}).reduce((a, b) => a + b, 0);
        state.currentRunAsteroids = totalUpgrades === 0 ? 0 : ((state.asteroidsDestroyed || 0) % 20);
      }
      if (!state.playerName) {
        state.playerName = localStorage.getItem("DeepSpaceMiner_PlayerName") || "";
      }
      if (state.adBoostClickTimer === undefined) state.adBoostClickTimer = 0;
      if (state.adBoostAutoTimer === undefined) state.adBoostAutoTimer = 0;
      if (state.midgameAdTimer === undefined) state.midgameAdTimer = 0;
      if (state.nextMidgameTarget === undefined) state.nextMidgameTarget = 300;

      // Çevrimdışı Kazanç (15 dakikadan az olan süre için)
      const dps = getAutoDPS();
      if (elapsedSec > 30 && dps > 0) {
        const earned = Math.floor(elapsedSec * dps * 0.6);
        state.credits += earned;
        state.totalEarnedAllTime += earned;

        document.getElementById("offline-credits-val").innerText = `+${formatNumber(earned)} 🪙`;
        document.getElementById("offline-modal").classList.remove("hidden");
      }
    } catch (e) {
      console.error("Kayıt yüklenemedi:", e);
    }
  }
}

function openResetModal() {
  document.getElementById("reset-modal").classList.remove("hidden");
}

function closeResetModal() {
  document.getElementById("reset-modal").classList.add("hidden");
}

function confirmResetGame() {
  isResetting = true;
  // Sefer bitirilmeden/sıfırlanmadan önce mevcut skoru Şeref Kürsüsüne kalıcı olarak kaydet
  saveToHallOfFame();

  localStorage.removeItem("DeepSpaceMiner_Save");
  localStorage.removeItem("DeepSpaceMiner_PlayerName");
  // DİKKAT: DeepSpaceMiner_HallOfFame KORUNUR! Kalıcı skor tahtası asla silinmez.

  resetStateToInitial();
  state.playerName = "";
  state.pilotId = "";

  window.location.reload();
}

function resizeCanvas() {
  const wrapper = document.getElementById("canvas-wrapper");
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
  initStars();
}

// ==================== BAŞLATICI ====================

window.addEventListener("load", () => {
  initCrazyGames();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  initUpgradeCards();
  initSkillsUpgradeCards();
  loadGame();
  spawnAsteroid();
  updateDrones();
  updateUI();
  requestAnimationFrame(render);

  // Pilot Kayıt Kontrolü: İsim belirlenmemişse zorunlu kayıt modalını aç
  if (!state.playerName) {
    openPilotModal(false);
  }

  // Pilot Modal Butonları
  const btnSavePilot = document.getElementById("btn-save-pilot-name");
  if (btnSavePilot) {
    btnSavePilot.addEventListener("click", () => {
      const input = document.getElementById("input-pilot-name");
      savePilotName(input ? input.value : "");
    });
  }

  const inputPilot = document.getElementById("input-pilot-name");
  if (inputPilot) {
    inputPilot.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        savePilotName(inputPilot.value);
      }
    });
  }

  const btnDice = document.getElementById("btn-dice-name");
  if (btnDice) {
    btnDice.addEventListener("click", () => {
      const input = document.getElementById("input-pilot-name");
      if (input) input.value = getRandomPilotName();
    });
  }

  const btnClosePilot = document.getElementById("btn-close-pilot");
  if (btnClosePilot) {
    btnClosePilot.addEventListener("click", closePilotModal);
  }

  const hudPilotPill = document.getElementById("hud-pilot-pill");
  if (hudPilotPill) {
    hudPilotPill.addEventListener("click", () => openPilotModal(true));
  }

  const btnEditPilotName = document.getElementById("btn-edit-pilot-name");
  if (btnEditPilotName) {
    btnEditPilotName.addEventListener("click", () => openPilotModal(true));
  }

  // Tıklama Olayı
  document.getElementById("click-overlay").addEventListener("mousedown", handleClick);

  // Klavye Kısayolları (1, 2, 3 Yetenekler için)
  window.addEventListener("keydown", (e) => {
    // Eğer oyuncu pilot ismi modalında yazı yazıyorsa kısayolları tetikleme
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    if (e.key === "1") activateSkill("overdrive");
    if (e.key === "2") activateSkill("strike");
    if (e.key === "3") activateSkill("magnet");
  });

  // Yetenek Buton Dinleyicileri
  document.getElementById("skill-overdrive").addEventListener("click", () => activateSkill("overdrive"));
  document.getElementById("skill-strike").addEventListener("click", () => activateSkill("strike"));
  document.getElementById("skill-magnet").addEventListener("click", () => activateSkill("magnet"));

  // Reklamla Güçlendirme Butonları (CrazyGames Rewarded Ads)
  const btnBoostClick = document.getElementById("btn-boost-click");
  if (btnBoostClick) {
    btnBoostClick.addEventListener("click", () => requestRewardedBoost("click"));
  }
  const btnBoostAuto = document.getElementById("btn-boost-auto");
  if (btnBoostAuto) {
    btnBoostAuto.addEventListener("click", () => requestRewardedBoost("auto"));
  }

  // Tab Geçişleri
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const targetContent = document.getElementById(btn.dataset.tab);
      if (targetContent) targetContent.classList.add("active");
    });
  });

  // Liderlik Tablosu & Galaktik Sıralama
  const btnLeaderboard = document.getElementById("btn-leaderboard");
  if (btnLeaderboard) btnLeaderboard.addEventListener("click", openLeaderboardModal);

  const rankPill = document.getElementById("hud-rank-pill");
  if (rankPill) rankPill.addEventListener("click", openLeaderboardModal);

  const btnCloseLb = document.getElementById("btn-close-leaderboard");
  if (btnCloseLb) btnCloseLb.addEventListener("click", closeLeaderboardModal);

  // Liderlik Tablosu Sekmeleri (Canlı Sıralama & Şeref Kürsüsü)
  const lbTabLive = document.getElementById("lb-tab-live");
  if (lbTabLive) {
    lbTabLive.addEventListener("click", () => switchLeaderboardTab("live"));
  }

  const lbTabHof = document.getElementById("lb-tab-hof");
  if (lbTabHof) {
    lbTabHof.addEventListener("click", () => switchLeaderboardTab("hof"));
  }

  // Ses Butonu
  const btnSound = document.getElementById("btn-sound");
  btnSound.addEventListener("click", () => {
    const isMuted = window.sounds.toggleMute();
    btnSound.innerText = isMuted ? "🔇" : "🔊";
    showToast(isMuted ? "Ses Kapatıldı" : "Ses Açıldı");
  });

  // Warp Butonu
  document.getElementById("btn-warp-execute").addEventListener("click", executeWarp);

  // Sıfırla Butonu & Modal
  document.getElementById("btn-reset").addEventListener("click", openResetModal);
  document.getElementById("btn-close-reset").addEventListener("click", closeResetModal);
  document.getElementById("btn-cancel-reset").addEventListener("click", closeResetModal);
  document.getElementById("btn-confirm-reset").addEventListener("click", confirmResetGame);

  // İstatistikler Modalı
  const statsModal = document.getElementById("stats-modal");
  document.getElementById("btn-stats").addEventListener("click", () => {
    document.getElementById("stat-total-asteroids").innerText = formatNumber(state.totalAsteroidsDestroyed || state.currentRunAsteroids || 0);
    document.getElementById("stat-total-clicks").innerText = formatNumber(state.totalClicks);
    document.getElementById("stat-alltime-credits").innerText = formatNumber(state.totalEarnedAllTime) + " 🪙";
    document.getElementById("stat-warp-count").innerText = state.warpCount || 0;

    const curScore = getPlayerScore();
    const curRank = calculatePlayerRank();
    const curLeague = getLeagueInfo(curRank);
    const scoreStatEl = document.getElementById("stat-galactic-score");
    if (scoreStatEl) scoreStatEl.innerText = `${formatNumber(curScore)} Puan`;
    const rankStatEl = document.getElementById("stat-galactic-rank");
    if (rankStatEl) rankStatEl.innerText = `#${formatNumber(curRank)} (${curLeague.name})`;

    document.getElementById("stat-play-time").innerText = Math.floor(state.playTimeSeconds / 60) + " dk";
    statsModal.classList.remove("hidden");
  });

  document.getElementById("btn-close-stats").addEventListener("click", () => {
    statsModal.classList.add("hidden");
  });

  // Çevrimdışı Modal Kapatma
  document.getElementById("btn-claim-offline").addEventListener("click", () => {
    document.getElementById("offline-modal").classList.add("hidden");
    window.sounds.playUpgrade();
  });

  // 15 Dakika Zaman Aşımı Modalı Onay Butonu
  const btnConfirmExpiry = document.getElementById("btn-confirm-expiry");
  if (btnConfirmExpiry) {
    btnConfirmExpiry.addEventListener("click", () => {
      const modal = document.getElementById("expiry-modal");
      if (modal) modal.classList.add("hidden");
      window.sounds.playUpgrade();
      if (!state.playerName) {
        openPilotModal(false);
      }
    });
  }

  // Sekme Kapanırken / Arka Plana Atılırken Anlık Kayıt ve 15dk Zaman Kontrolü
  window.addEventListener("beforeunload", () => {
    saveGame();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const now = Date.now();
      const elapsedSec = (now - (state.lastSaveTime || now)) / 1000;
      if (elapsedSec > SESSION_TIMEOUT_SEC) {
        handleSessionTimeout(elapsedSec);
      }
    } else {
      saveGame();
    }
  });
});
