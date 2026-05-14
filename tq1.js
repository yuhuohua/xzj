const ScriptVersion = "1.2.0";

const FM = FileManager.local();
const BASE_DIR = FM.joinPath(FM.libraryDirectory(), "Caishow_Data_ONE");
if (!FM.fileExists(BASE_DIR)) FM.createDirectory(BASE_DIR);
try {
  const cachePath = FM.joinPath(BASE_DIR, "weather_cache.json");
  if (FM.fileExists(cachePath)) FM.remove(cachePath);
} catch(e) {}

const ConfigManager = {
  getPath: (name) => FM.joinPath(BASE_DIR, name),
  load: () => {
    const path = FM.joinPath(BASE_DIR, "settings.json");
    if (FM.fileExists(path)) {
      try { return JSON.parse(FM.readString(path)); } catch (e) { return {};
      }
    }
    return {};
  },
  save: (data) => {
    try { FM.writeString(FM.joinPath(BASE_DIR, "settings.json"), JSON.stringify(data));
    } catch (e) {}
  },
  saveCache: (name, data) => {
    try { FM.writeString(FM.joinPath(BASE_DIR, name), JSON.stringify(data));
    } catch(e){}
  },
  readCache: (name) => {
    try {
      const path = FM.joinPath(BASE_DIR, name);
      if(FM.fileExists(path)) return JSON.parse(FM.readString(path));
    } catch(e){}
    return null;
  },
  saveImg: (name, img) => { try { FM.writeImage(FM.joinPath(BASE_DIR, name), img);
  } catch(e){} },
  getImg: (name) => { const p = FM.joinPath(BASE_DIR, name); return FM.fileExists(p) ? FM.readImage(p) : null;
  },
  rmImg: (name) => { try { FM.remove(FM.joinPath(BASE_DIR, name));
  } catch(e){} },
  clear: () => { try { if(FM.fileExists(BASE_DIR)) { const files = FM.listContents(BASE_DIR);
  for(const f of files) FM.remove(FM.joinPath(BASE_DIR, f)); } } catch(e){} }
};

// 农历数据 1900-2100
const lunarInfo = [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052d0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x0bd7,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0];
const weatherIcos = { CLEAR_DAY:"sun.max.fill", CLEAR_NIGHT:"moon.fill", PARTLY_CLOUDY_DAY:"cloud.sun.fill", PARTLY_CLOUDY_NIGHT:"cloud.moon.fill", CLOUDY:"cloud.fill", LIGHT_HAZE:"sun.haze.fill", MODERATE_HAZE:"sun.haze.fill", HEAVY_HAZE:"sun.haze.fill", LIGHT_RAIN:"cloud.drizzle.fill", MODERATE_RAIN:"cloud.rain.fill", HEAVY_RAIN:"cloud.rain.fill", STORM_RAIN:"cloud.heavyrain.fill", FOG:"cloud.fog.fill", LIGHT_SNOW:"cloud.snow.fill", MODERATE_SNOW:"cloud.snow.fill", HEAVY_SNOW:"cloud.snow.fill", STORM_SNOW:"wind.snow.fill", DUST:"cloud.dust.fill", SAND:"cloud.dust.fill", WIND:"wind", SUNSET:"sunset.fill", SUNRISE:"sunrise.fill" };

const weekTitle = ['周日','周一','周二','周三','周四','周五','周六'];
const weekTitleShort = ['日','一','二','三','四','五','六'];
const zodiacAnimals = ["鼠","牛","虎","兔","龙","蛇","马","羊","猴","鸡","狗","猪"];
const heavenlyStems = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const earthlyBranches = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

const yellowBlackDays = ["建","除","满","平","定","执","破","危","成","收","开","闭"];
const twentyEightMansions = ["角","亢","氐","房","心","尾","箕","斗","牛","女","虚","危","室","壁","奎","娄","胃","昴","毕","觜","参","井","鬼","柳","星","张","翼","轸"];
const solarTerms = ["小寒","大寒","立春","雨水","惊蛰","春分","清明","谷雨","立夏","小满","芒种","夏至","小暑","大暑","立秋","处暑","白露","秋分","寒露","霜降","立冬","小雪","大雪","冬至"];

const greetingText = {
  nightGreeting: "🦉火华,可以来一发了~",
  morningGreeting: "💫火华,早上心情美美哒~",
  noonGreeting: "🥳火华,中午好呀~",
  afternoonGreeting: "🐡火华,下午好呀~",
  eveningGreeting: "🐳火华,（傍晚好呀）",
  nightText: "🌙火华,（晚上好呀）"
};

const baseConfigKeys = {
    size_greeting: "100", size_date: "100", size_lunar: "100", size_info: "100", 
    size_weather: "100", size_weatherLarge: "100", size_poetry: "100", size_timeInfo: "100", 
    size_calendar: "100", size_holiday: "100", 
    size_schedule_title: "100", size_schedule_item: "100", 
    
    size_lotteryTitle: "100", size_lotteryItem: "100", size_lotteryInfo: "100",
    
    show_battery: "true", 
    show_poetry: "true",
    show_schedule: "true", 
    show_solar_term: "false", 
    birthday_list: "", 
    
    color_greeting: "#ffffff", color_date: "#ffcc99", color_lunar: "#99ccff", color_info: "#ffffff",
    color_weather: "#ffffff", color_weatherLarge: "#ffffff", color_poetry: "#ffffff", 
    color_timeInfo: "#99ccff", color_calendar: "#ffffff", color_holiday: "#ffffff", 
    color_schedule_title: "#ffffff", 
    color_schedule_bg: "#666666",
    color_schedule_item_1: "#ffffff",
    color_schedule_item_2: "#ffffff",
    color_schedule_item_3: "#ffffff",
    color_schedule_item_4: "#ffffff",
    color_schedule_item_5: "#ffffff",
    color_schedule_item_6: "#ffffff",
    color_lotteryTitle: "#ffffff", color_lotteryItem: "#ffffff", color_lotteryInfo: "#99ccff",
    
    color_bg: "#000000",
    color_bg_2: "", 
    
    color_bg_day: "",
    color_bg_2_day: "",
    color_bg_night: "",
    color_bg_2_night: "",

    layout_med_left_x: "0", layout_med_left_y: "0",
    layout_med_right_x: "0", layout_med_right_y: "0",
    
    layout_lg_tl_x: "0", layout_lg_tl_y: "0",
    layout_lg_tr_x: "0", layout_lg_tr_y: "0",
    
    layout_lg_mid_x: "0", layout_lg_mid_y: "0",
    
    layout_lg_week_x: "0", layout_lg_week_y: "0",
    layout_lg_cal_x: "0", layout_lg_cal_y: "0",
    
    layout_lg_holiday_x: "0", layout_lg_holiday_y: "0",
    layout_lg_schedule_x: "0", layout_lg_schedule_y: "0",

    space_week_w: "28",
    space_cal_w: "28",
    space_cal_h: "3",
    space_holiday_h: "2",
    space_schedule_h: "2",
    
    schedule_count: "4",
    schedule_offset: "0",

    text_greeting_night: "",
    text_greeting_morning: "",
    text_greeting_noon: "",
    text_greeting_afternoon: "",
    text_greeting_evening: ""
};
