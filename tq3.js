// 使用 prototype 扩展对象的方法将代码块隔离，防止被 GitHub 识别为语法错误
Object.assign(CaishowWidget.prototype, {
  async fetchData() {
    let location = { latitude: 39.90, longitude: 116.40, locality: "定位中", subLocality: "" };
    const freshSettings = ConfigManager.load();
    const isLocked = (freshSettings.lockLocation === true || freshSettings.lockLocation === "true");
    if (isLocked) {
      if (freshSettings.fixedLat && freshSettings.fixedLng) {
        location = { latitude: freshSettings.fixedLat, longitude: freshSettings.fixedLng, locality: freshSettings.fixedCity || "固定", subLocality: freshSettings.fixedSubCity || "位置" };
      }
    } else {
      try {
        let l = await Location.current();
        let g = await Location.reverseGeocode(l.latitude, l.longitude, "zh_cn");
        location = { latitude: l.latitude, longitude: l.longitude, locality: g[0].locality, subLocality: g[0].subLocality };
        ConfigManager.saveCache("location_cache.json", location); 
        this.settings.fixedLat = String(l.latitude); this.settings.fixedLng = String(l.longitude);
        this.settings.fixedCity = g[0].locality; this.settings.fixedSubCity = g[0].subLocality;
        this.saveSettings(false);
      } catch(e) { const c = ConfigManager.readCache("location_cache.json"); if (c) location = c; else location.locality = "定位失败";
      }
    }
    this.location = location;

    const weatherPromise = this.fetchWeather(freshSettings, location);
    const poetryPromise = this.fetchPoetry(freshSettings);
    const schedulePromise = this.fetchSchedules(freshSettings);
    const lotteryPromise = this.fetchLotteryData();

    const [weather, poetry, schedules, lottery] = await Promise.all([weatherPromise, poetryPromise, schedulePromise, lotteryPromise]);
    return { weather, poetry, schedules, lottery };
  },
  
  async fetchLotteryData() {
    let type = this.settings.lottery_type || "dlt";
    if (!type || type === "none") return null;

    if (type.includes("双色球") || type.includes("SSQ")) type = "ssq";
    else if (type.includes("大乐透") || type.includes("DLT")) type = "dlt";
    else if (type.includes("排列三") || type.includes("PL3")) type = "pl3";
    else if (type.includes("福彩3D") || type.includes("FC3D")) type = "fc3d";
    else if (type.includes("七星彩") || type.includes("QXC")) type = "qxc";
    else if (type.includes("七乐彩") || type.includes("QLC")) type = "qlc";
    else if (type.includes("排列五") || type.includes("PL5")) type = "pl5";

    const cacheKey = `lottery_cache_${type}`;
    const cache = ConfigManager.readCache(cacheKey);
    
    if (cache && cache.timestamp && (Date.now() - cache.timestamp) < 1800000 && cache.data.pool) {
        return cache.data;
    }

    let result = { full: "", pool: "", type: type };
    const mapName = { "ssq": "双色球", "dlt": "大乐透", "pl3": "排列三", "fc3d": "福彩3D", "qxc": "七星彩", "qlc": "七乐彩", "pl5": "排列五" };
    const name = mapName[type] || "彩票";

    const sportteryMap = { "dlt": 85, "pl3": 35, "pl5": 81, "qxc": "04" };
    if (sportteryMap[type]) {
        try {
            const gameNo = sportteryMap[type];
            const url = `https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=${gameNo}&provinceId=0&pageSize=1&isVerify=1&pageNo=1`;
            const req = new Request(url);
            const res = await req.loadJSON();
            if (res && res.success && res.value && res.value.list && res.value.list.length > 0) {
                const item = res.value.list[0];
                let nums = item.lotteryDrawResult.replace(/ /g, " ");
                if (type === "dlt") {
                   const parts = item.lotteryDrawResult.split(" ");
                   nums = parts.slice(0,5).join(" ") + " + " + parts.slice(5).join(" ");
                }
                result.full = `${name} ${item.lotteryDrawNum}期: ${nums}`;
                let pool = item.poolMoney || "0";
                result.pool = this.formatMoney(pool);
            }
        } catch(e) { console.log("Sporttery Error: " + e.message);
        }
    } else {
        try {
            let cwlCode = type;
            if (type === "fc3d") cwlCode = "3d";
            
            const url = `https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=${cwlCode}&issueCount=1`;
            const req = new Request(url);
            req.headers = {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
                "Referer": "https://www.cwl.gov.cn/",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest"
             };
            
            const res = await req.loadJSON();
            
            if (res && res.result && res.result.length > 0) {
                const item = res.result[0];
                let nums = item.red;
                if (item.blue && item.blue.length > 0) {
                    nums = nums + " + " + item.blue;
                }
                if (type === "fc3d") {
                    nums = nums.replace(/,/g, " ");
                } else {
                    nums = nums.replace(/,/g, " ");
                }
                
                result.full = `${name} ${item.code}期: ${nums}`;
                let pool = item.poolmoney || "0";
                result.pool = this.formatMoney(pool);
            }
        } catch(e) { console.log("CWL Error: " + e.message);
        }
    }

    if (result.full) {
        ConfigManager.saveCache(cacheKey, { data: result, timestamp: Date.now() });
        return result;
    }
    return null;
  },
  
  formatMoney(numStr) {
      let num = parseFloat(numStr.replace(/,/g, ""));
      if (isNaN(num)) return "统计中";
      if (num > 100000000) {
          return (num / 100000000).toFixed(2) + "亿";
      } else if (num > 10000) {
          return (num / 10000).toFixed(1) + "万";
      }
      return num + "元";
  },
  
  getLotterySchedule(type) {
      const day = new Date().getDay();
      let text = "今日休市";
      const map = {
          "ssq": [0, 2, 4],
          "dlt": [1, 3, 6],
          "qlc": [1, 3, 5],
          "qxc": [0, 2, 5],
          "fc3d": [0,1,2,3,4,5,6],
          "pl3": [0,1,2,3,4,5,6],
          "pl5": [0,1,2,3,4,5,6]
      };
      let time = "21:30";
      if (["ssq", "qlc", "fc3d"].includes(type)) time = "21:15";
      if (map[type] && map[type].includes(day)) {
          return `今日开奖: ${time}`;
      } else {
          return "今日不开奖";
      }
  },

  async fetchWeather(freshSettings, location) {
    let weather = {};
    if (freshSettings.apiKey && location.latitude) {
      try {
        const timeNow = new Date().getTime();
        const url = `https://api.caiyunapp.com/v2.5/${freshSettings.apiKey}/${location.longitude},${location.latitude}/weather.json?alert=true&dailysteps=15&daily_steps=15&_t=${timeNow}`;
        const req = new Request(url); req.timeoutInterval = 15;
        const res = await req.loadJSON();
        weather = this.processWeather(res);
        if(weather.temp) ConfigManager.saveCache("weather_cache.json", weather);
      } catch (e) { const c = ConfigManager.readCache("weather_cache.json"); if(c) weather = c;
      }
    } else { const c = ConfigManager.readCache("weather_cache.json"); if(c) weather = c;
    }
    return weather;
  },

  async fetchPoetry(freshSettings) {
    let poetry = {};
    let isStyle2 = (freshSettings.styleModel === "modern" || (args.widgetParameter && args.widgetParameter.indexOf("style2") > -1));
    if (!isStyle2) {
        try {
          const pReq = new Request("https://v2.jinrishici.com/sentence");
          pReq.timeoutInterval = 5;
          const pRes = await pReq.loadJSON(); poetry = pRes.data ? pRes : {};
        } catch (e) {}
    }
    return poetry;
  },

  async fetchSchedules(freshSettings) {
    let schedules = [];
    try { 
        const events = await CalendarEvent.today([]); 
        const now = new Date();
        let validEvents = events.filter(e => {
            if (e.title.startsWith("Canceled")) return false;
            if (e.isAllDay) return true;
            return e.endDate > now;
        });
        validEvents.sort((a, b) => {
            return a.startDate.getTime() - b.startDate.getTime();
        });
        schedules = validEvents.map(e => ({ title: e.title, isAllDay: e.isAllDay })); 
    } catch (e) {}
    return schedules;
  },

  processWeather(data) {
    if (!data || data.status !== "ok") return {};
    let info = {};
    if (data.result.alert && data.result.alert.content) info.alertTitle = data.result.alert.content.title;
    const daily = data.result.daily;
    if (daily.temperature) { info.min = Math.round(daily.temperature[0].min); info.max = Math.round(daily.temperature[0].max);
    }
    if (daily.temperature && daily.skycon) {
      info.future = [];
      for (let i = 1; i < 15; i++) {
        try {
          if (!daily.temperature[i]) break;
          if (info.future.length >= 7) break;
          let dStr = daily.temperature[i].date;
          let dNum = parseInt(dStr.split("-")[2]);
          info.future.push({ day: dNum + "日", min: Math.round(daily.temperature[i].min), max: Math.round(daily.temperature[i].max), ico: weatherIcos[daily.skycon[i].value] || "sun.max.fill" });
        } catch(e){ break;
        }
      }
    }
    const rt = data.result.realtime;
    if (rt) {
      info.temp = Math.round(rt.apparent_temperature);
      info.ico = weatherIcos[rt.skycon] || "sun.max.fill";
      info.hum = Math.round(rt.humidity * 100) + "%";
      if (rt.life_index) {
        info.comfort = rt.life_index.comfort ? rt.life_index.comfort.desc : "";
        info.uv = rt.life_index.ultraviolet ? rt.life_index.ultraviolet.desc : "";
      }
      if (rt.air_quality && rt.air_quality.aqi) info.aqi = this.airQuality(rt.air_quality.aqi.chn);
    }
    if (data.result.forecast_keypoint) info.desc = data.result.forecast_keypoint;
    if (daily.astro && daily.astro[0]) { info.sunrise = daily.astro[0].sunrise.time; info.sunset = daily.astro[0].sunset.time;
    }
    return info;
  },

  async render() {
    const freshSettings = ConfigManager.load();
    this.settings = Object.assign({}, this.defaultData, freshSettings);
      
    const data = await this.fetchData();
    const w = new ListWidget();
    
    let currentModel = this.settings.styleModel || "classic";
    
    if (!config.runsInApp && args.widgetParameter) {
        if (args.widgetParameter.indexOf("style2") > -1) currentModel = "modern";
        if (args.widgetParameter.indexOf("style3") > -1) currentModel = "holiday";
        if (args.widgetParameter.indexOf("style4") > -1) currentModel = "schedule";
    }
    
    if (currentModel === "modern") {
        this.activePrefix = "s2_";
    } else if (currentModel === "holiday") {
        this.activePrefix = "s3_";
    } else if (currentModel === "schedule") {
        this.activePrefix = "s4_";
    } else {
        this.activePrefix = "s1_";
    }
    try {
        let today = new Date();
        let gridTemp = getMonthGrid(today.getFullYear(), today.getMonth());
        if (gridTemp.length === 6) {
            if (this.activePrefix === "s1_" || this.activePrefix === "s2_") {
                this.settings[`${this.activePrefix}space_week_w`] = "34";
                this.settings[`${this.activePrefix}space_cal_w`] = "33.2";
                this.settings[`${this.activePrefix}size_calendar`] = "85"; 
            } else {
                this.settings[`${this.activePrefix}space_week_w`] = "10";
                this.settings[`${this.activePrefix}space_cal_w`] = "9.3";
                this.settings[`${this.activePrefix}size_calendar`] = "85";
            }
        }
    } catch(e) { console.log("行数检测失败") }

    let refreshMinutes = parseInt(this.settings.refreshInterval) || 60;
    if (refreshMinutes < 5) refreshMinutes = 5;
    w.refreshAfterDate = new Date(new Date().getTime() + refreshMinutes * 60000);
    const isDark = Device.isUsingDarkAppearance();
    const modeSuffix = isDark ? "_night" : "_day";
    const bgNameGeneric = `bg_${this.activePrefix.replace("_","")}.jpg`;
    const bgNameMode = `bg_${this.activePrefix.replace("_","")}${modeSuffix}.jpg`;
    let bgImg = ConfigManager.getImg(bgNameMode);
    if (!bgImg) bgImg = ConfigManager.getImg(bgNameGeneric);
    
    if (bgImg) {
        w.backgroundImage = bgImg;
    } else {
        let colorKey1 = isDark ? `${this.activePrefix}color_bg_night` : `${this.activePrefix}color_bg_day`;
        let colorKey2 = isDark ? `${this.activePrefix}color_bg_2_night` : `${this.activePrefix}color_bg_2_day`;
        
        let c1 = this.settings[colorKey1] || this.settings[`${this.activePrefix}color_bg`] || "#000000";
        let c2 = this.settings[colorKey2] || this.settings[`${this.activePrefix}color_bg_2`];
        
        if (c2 && c2.length > 0) {
            let gradient = new LinearGradient();
            gradient.colors = [new Color(c1), new Color(c2)];
            gradient.locations = [0, 1];
            w.backgroundGradient = gradient;
        } else {
            w.backgroundColor = new Color(c1);
        }
    }
    
    w.setPadding(10, 4, 5, 4);
    if (this.widgetFamily === 'medium') await this.renderMedium(w, data);
    else await this.renderLarge(w, data);
    return w;
  },

  async renderMedium(w, data) {
    let body = w.addStack(); body.layoutHorizontally(); body.centerAlignContent();
    let left = body.addStack(); left.layoutVertically();
    this.applyLayout(left, "med_left", {t:0, l:8, b:0, r:0}); 
    await this.renderInfoSide(left, data);
    
    body.addSpacer();
    let right = body.addStack(); right.size = new Size(this.s(110,"weather"), 0); right.layoutVertically();
    this.applyLayout(right, "med_right", {t:0, l:0, b:0, r:5}); 
    await this.renderWeatherSide(right, data.weather);
  },

  async renderLarge(w, data) {
    const isHolidayStyle = (this.activePrefix === "s3_");
    const isScheduleStyle = (this.activePrefix === "s4_");
    const isComplexLayout = isHolidayStyle || isScheduleStyle;

    let top = w.addStack(); 
    top.layoutHorizontally();
    top.size = new Size(0, this.s(isComplexLayout ? 149 : 149, "weather"));
    
    let left = top.addStack(); left.layoutVertically();
    this.applyLayout(left, "lg_tl", {t:0, l:8, b:0, r:0}); 
    await this.renderInfoSide(left, data);
    
    top.addSpacer();
    
    let right = top.addStack(); right.size = new Size(this.s(110,"weather"), 0); right.layoutVertically();
    this.applyLayout(right, "lg_tr", {t:0, l:0, b:0, r:5}); 
    await this.renderWeatherSide(right, data.weather);
    
    w.addSpacer(isComplexLayout ? 0 : 4);
    
    let midStack = w.addStack(); midStack.layoutVertically();
    this.applyLayout(midStack, "lg_mid", {t:0, l:0, b:0, r:0}); 
    await this.renderTimeInfo(midStack);
    
    if (isComplexLayout) {
        let bottomWrapper = w.addStack();
        bottomWrapper.layoutHorizontally(); 
        
        let leftBottomContainer = bottomWrapper.addStack();
        leftBottomContainer.layoutVertically();
        
        if (isHolidayStyle) {
            this.applyLayout(leftBottomContainer, "lg_holiday", {t:0, l:9, b:0, r:0});
            await this.renderHolidayBox(leftBottomContainer);
        } else {
            this.applyLayout(leftBottomContainer, "lg_schedule", {t:0, l:9, b:0, r:0});
            await this.renderScheduleBox(leftBottomContainer, data.schedules);
        }
        
        bottomWrapper.addSpacer();
        let calendarContainer = bottomWrapper.addStack();
        calendarContainer.layoutVertically();
        
        let weekWrapper = calendarContainer.addStack();
        weekWrapper.layoutVertically();
        this.applyLayout(weekWrapper, "lg_week", {t:0, l:18, b:0, r:0});
        await this.renderWeekRow(weekWrapper);
        let gridWrapper = calendarContainer.addStack();
        gridWrapper.layoutVertically();
        this.applyLayout(gridWrapper, "lg_cal", {t:0, l:18, b:0, r:0});
        await this.renderCalendarGrid(gridWrapper);
    } else {
        w.addSpacer(4);
        
        let weekStack = w.addStack(); weekStack.layoutVertically();
        this.applyLayout(weekStack, "lg_week", {t:0, l:0, b:0, r:0}); 
        await this.renderWeekRow(weekStack);
        
        let calStack = w.addStack(); calStack.layoutVertically(); 
        this.applyLayout(calStack, "lg_cal", {t:0, l:0, b:0, r:0});
        await this.renderCalendarGrid(calStack);
    }

    w.addSpacer(); 
  },

  async renderHolidayBox(stack) {
    stack.centerAlignContent();
    let box = stack.addStack();
    box.size = new Size(this.s(100,"holiday"), 0); 
    box.layoutVertically();
    
    let holidayGap = parseFloat(this.settings[`${this.activePrefix}space_holiday_h`] || 2);

    let titleStack = box.addStack(); titleStack.centerAlignContent();
    let iSz = this.s(15,"holiday"); 
    let icon = titleStack.addImage(this.getSFIco("gift.fill")); icon.imageSize = new Size(iSz, iSz); 
    icon.tintColor = new Color("#FF5555");
    titleStack.addSpacer(4);
    this.addText(titleStack, "节日生日", 17, "holiday", true); 
    
    box.addSpacer(holidayGap); 

    const holidays = this.getNextHolidays();
    for (let h of holidays) {
      let r = box.addStack(); r.centerAlignContent();
      let dispName = h.name.length > 4 ? h.name.substring(0,4) : h.name;
      this.addText(r, dispName, 17, "holiday"); 
      r.addSpacer();
      let dayStack = r.addStack(); dayStack.backgroundColor = h.days === 0 ? new Color("#FF5555") : new Color("#ffffff", 0.2);
      dayStack.cornerRadius = 3; dayStack.setPadding(1, 4, 1, 4);
      let t = dayStack.addText(h.days === 0 ? "今天" : h.days + "天"); t.font = Font.boldSystemFont(this.s(13,"holiday"));
      t.textColor = h.days === 0 ? Color.white() : this.getConfColor("holiday");
      box.addSpacer(holidayGap);
    }
  },

  async renderScheduleBox(stack, schedules) {
    stack.centerAlignContent();
    let box = stack.addStack();
    box.size = new Size(this.s(100,"schedule_title"), 0); 
    box.layoutVertically();
    
    let gap = parseFloat(this.settings[`${this.activePrefix}space_schedule_h`] || 2);
    let maxCount = parseInt(this.settings[`${this.activePrefix}schedule_count`]) || 3;
    let skipStr = this.settings[`${this.activePrefix}schedule_offset`] || "";
    let skipIndices = new Set(
        skipStr.replace(/，/g, ",") 
               .split(/[, ]+/)      
               .map(s => parseInt(s))
               .filter(n => !isNaN(n) && n > 0) 
               .map(n => n - 1)     
    );

    let keyword = this.settings[`${this.activePrefix}schedule_keyword`];
    let filteredSchedules = schedules;
    if (keyword && keyword.trim() !== "") {
        filteredSchedules = schedules.filter(e => e.title.includes(keyword));
    }

    let targetSchedules = filteredSchedules.filter((_, index) => !skipIndices.has(index));

    let titleStack = box.addStack(); titleStack.centerAlignContent();
    let iSz = this.s(15,"schedule_title");
    let icon = titleStack.addImage(this.getSFIco("calendar.badge.clock")); 
    icon.imageSize = new Size(iSz, iSz); 
    icon.tintColor = new Color("#55BEF0");
    titleStack.addSpacer(4);
    
    this.addText(titleStack, "日程安排", 17, "schedule_title", true); 
    
    box.addSpacer(gap);
    if (targetSchedules.length === 0) {
        let r = box.addStack(); r.centerAlignContent();
        let tips = keyword ? "无含关键词日程" : "无后续安排";
        this.addText(r, tips, 12.2, "schedule_item");
    } else {
        let listWrapper = box.addStack();
        listWrapper.layoutVertically();
        let bgKey = `${this.activePrefix}color_schedule_bg`;
        let rawHex = this.settings[bgKey];
        if (!rawHex) rawHex = "#666666";
        let finalColor;
        try {
            let tempC = new Color(rawHex);
            finalColor = new Color(tempC.hex, 0.3);
        } catch (e) {
            finalColor = new Color("#666666", 0.3);
        }
        
        listWrapper.backgroundColor = finalColor;
        listWrapper.cornerRadius = 4;
        listWrapper.setPadding(4, 4, 4, 4);

        let count = Math.min(targetSchedules.length, maxCount);
        for (let i = 0; i < count; i++) {
            let item = targetSchedules[i];
            let r = listWrapper.addStack(); 
            
            r.topAlignContent(); 
            let dotWrapper = r.addStack();
            dotWrapper.setPadding(6, 0, 0, 0); 
            let dot = dotWrapper.addStack();
            dot.size = new Size(4,4); 
            dot.cornerRadius=2; 
            
            let itemColor;
            if (i < 6) {
                itemColor = this.getConfColor(`schedule_item_${i+1}`);
            } else {
                itemColor = new Color("#ffffff");
            }
            
            dot.backgroundColor = itemColor;
            r.addSpacer(4);
            
            let title = item.title;
            let splitIdx = -1;
            if (title.includes("柴油")) splitIdx = title.indexOf("柴油") + 2;
            else if (title.includes("汽油")) splitIdx = title.indexOf("汽油") + 2;
            
            if (splitIdx > -1) {
                let vStack = r.addStack();
                vStack.layoutVertically();
                let t1 = title.substring(0, splitIdx);
                let t2 = title.substring(splitIdx).trim();
                this.addText(vStack, t1, 12.2, "schedule_item", false, 0, 1, itemColor);
                this.addText(vStack, t2, 12.2, "schedule_item", false, 0, 1, itemColor);
            } else {
                let t = this.addText(r, title, 12.2, "schedule_item", false, 0, 2, itemColor);
                t.lineLimit = 2;
            }
            
            if (i < count - 1) {
                listWrapper.addSpacer(gap);
            }
        }
    }
  },

  getNextHolidays() {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const publicHolidays = [ 
      { name: "元旦", m: 1, d: 1 }, { name: "情人节", m: 2, d: 14 }, 
      { name: "妇女节", m: 3, d: 8 }, { name: "劳动节", m: 5, d: 1 }, 
      { name: "儿童节", m: 6, d: 1 }, { name: "建军节", m: 8, d: 1 }, 
      { name: "教师节", m: 9, d: 10 }, { name: "国庆节", m: 10, d: 1 }, 
      { name: "万圣节", m: 11, d: 1 }, { name: "圣诞节", m: 12, d: 25 } 
    ];
    const holidayMap = { 
      2025: ["01-29", "04-04", "05-31", "10-06"], 
      2026: ["02-17", "04-05", "06-19", "09-25"], 
      2027: ["02-06", "04-05", "06-09", "09-15"], 
      2028: ["01-26", "04-04", "05-28", "10-03"], 
      2029: ["02-13", "04-04", "06-16", "09-22"], 
      2030: ["02-03", "04-05", "06-05", "09-12"],
      2031: ["01-23", "04-05", "06-24", "10-01"]
    };
    let allHolidays = [];
    
    const createDate = (y, m, d) => new Date(y, m - 1, d);
    const parseDateStr = (y, str) => {
        const p = str.split(/[-/]/);
        return new Date(y, parseInt(p[0]) - 1, parseInt(p[1]));
    };

    for (let y = currentYear - 1; y <= currentYear + 1; y++) {
      if (y >= currentYear) {
          publicHolidays.forEach(h => { 
              allHolidays.push({ name: h.name, date: createDate(y, h.m, h.d) }); 
          });
      }

      if (y >= currentYear && holidayMap[y]) {
          const [spring, qingming, dragon, midAutumn] = holidayMap[y];
          let springDate = parseDateStr(y, spring);
          allHolidays.push({ name: "春节", date: springDate });
          allHolidays.push({ name: "除夕", date: new Date(springDate.getTime() - 24*60*60*1000) });
          allHolidays.push({ name: "元宵", date: new Date(springDate.getTime() + 14*24*60*60*1000) });
          allHolidays.push({ name: "清明", date: parseDateStr(y, qingming) });
          allHolidays.push({ name: "端午", date: parseDateStr(y, dragon) });
          allHolidays.push({ name: "中秋", date: parseDateStr(y, midAutumn) });
      }

      let bData = this.settings[`${this.activePrefix}birthday_list`] || "";
      if (bData) {
          let lines = bData.split("\n");
          for (let line of lines) {
              line = line.replace(/，/g, ",");
              let parts = line.split(",");
              if (parts.length < 2) continue;
              
              let name = parts[0].trim();
              let dateStr = parts[1].trim();
              let type = (parts.length > 2 && (parts[2].includes("农") || parts[2].includes("Lunar"))) ? "lunar" : "solar";
              
              let dm = dateStr.split(/[-/]/);
              if(dm.length !== 2) continue;
              let m = parseInt(dm[0]);
              let d = parseInt(dm[1]);
              
              let targetDate = null;
              try {
                  if (type === "lunar") {
                      targetDate = getSolarFromLunar(y, m, d);
                  } else {
                      targetDate = createDate(y, m, d);
                  }
              } catch(e) {}
              
              if (targetDate && !isNaN(targetDate.getTime())) {
                  allHolidays.push({ name: name, date: targetDate });
              }
          }
      }
    }

    let today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let results = allHolidays.map(h => { 
        if (!h.date) return null;
        let diff = (h.date - today) / (1000 * 60 * 60 * 24); 
        return { name: h.name, days: Math.ceil(diff), date: h.date }; 
    })
    .filter(h => h && !isNaN(h.days) && h.days >= 0) 
    .sort((a, b) => a.days - b.days);
    
    let uniqueList = []; let seenKeys = new Set();
    for (let h of results) { 
        let key = h.name + "_" + h.days;
        if (!seenKeys.has(key)) { 
            seenKeys.add(key); 
            uniqueList.push(h);
        } 
        if (uniqueList.length >= 5) break; 
    }
    return uniqueList;
  },

  applyLayout(s, c, b={t:0,l:0,b:0,r:0}) { 
    let x = parseInt(this.settings[`${this.activePrefix}layout_${c}_x`]) || 0;
    let y = parseInt(this.settings[`${this.activePrefix}layout_${c}_y`]) || 0; 
    
    let ft = b.t + y;
    let fl = b.l + x;
    let fb = b.b;
    let fr = b.r;

    if (ft < 0) { fb += Math.abs(ft); ft = 0; }
    if (fb < 0) { ft += Math.abs(fb); fb = 0; }
    if (fl < 0) { fr += Math.abs(fl); fl = 0; }
    if (fr < 0) { fl += Math.abs(fr); fr = 0; }
    
    s.setPadding(ft, fl, fb, fr);
  },

  async renderInfoSide(stack, data) {
    const isStyle2 = (this.activePrefix === "s2_");
    
    const rawBat = this.settings[`${this.activePrefix}show_battery`];
    const rawPoe = this.settings[`${this.activePrefix}show_poetry`];
    
    const showBattery = (rawBat === undefined || rawBat === "true");
    const showPoetry = (rawPoe === undefined || rawPoe === "true");
    
    const date = new Date();
    
    let tStack = stack.addStack(); tStack.centerAlignContent();
    let hasLottery = (this.settings.lottery_type && this.settings.lottery_type !== "none" && data.lottery);
    if (hasLottery) {
        let parts = data.lottery.full.split(":"); 
        let titleStr = parts[0];
        let rawNums = parts.length > 1 ? parts[1].trim() : "";
        
        this.addText(tStack, titleStr, 14, "lotteryTitle", true);
        
        tStack.addSpacer(30);
        
        let statusBox = tStack.addStack();
        statusBox.backgroundColor = new Color("#666666", 0.3); 
        statusBox.cornerRadius = 4;
        statusBox.setPadding(1, 4, 1, 4);
        statusBox.centerAlignContent();
        
        let statusText = this.getLotterySchedule(data.lottery.type);
        this.addText(statusBox, statusText, 10, "lotteryInfo", false, 0, 1, this.getConfColor("lotteryInfo"));
        
        stack.addSpacer(2);
        let dStack = stack.addStack(); dStack.centerAlignContent();
        this.renderLotteryBalls(dStack, rawNums, this.settings.lottery_type, isStyle2);
        if (isStyle2) stack.addSpacer(2);
        
    } else {
        this.addText(tStack, this.getGreeting(date), 23, "greeting", true);
        let dStack = stack.addStack(); dStack.centerAlignContent();
        this.addText(dStack, this.getDateStr(date), 17, "date");
        dStack.addSpacer(4);
        let lunar = this.getLunarDate_Precise(date);
        this.addText(dStack, lunar.month + lunar.day, 17, "lunar");
    }
    
    stack.addSpacer(2);
    let iStack = stack.addStack(); iStack.centerAlignContent();
    this.addText(iStack, weekTitle[date.getDay()], 17, "info");
    if (showBattery) {
        iStack.addSpacer(4);
        this.addText(iStack, `🔋${Math.round(Device.batteryLevel()*100)}%`, 16, "info");
    }
    
    iStack.addSpacer(4);
    let city = this.location.locality || "";
    if(this.location.subLocality) city += ` ${this.location.subLocality}`;
    if(!city) city = "定位中";
    this.addText(iStack, `📍${city}`, 16, "info");
    
    let desc = data.weather.alertTitle || data.weather.desc || "暂无数据";
    this.addText(stack, desc, 13, "weather", false, 2, 3);
    
    stack.addSpacer(2); 
    let mix = stack.addStack(); mix.centerAlignContent();
    if (data.weather.future && data.weather.future.length > 0) {
      let fStack = mix.addStack();
      let useCompactMode = (isStyle2 || !showPoetry);
      let showLimit = useCompactMode ? 7 : 3;
      let spaceGap = useCompactMode ? 6 : 8;
      
      let count = Math.min(data.weather.future.length, showLimit);

      for(let i=0; i < count; i++) {
        let item = data.weather.future[i];
        let col = fStack.addStack(); col.layoutVertically(); col.centerAlignContent();
        
        if (useCompactMode) {
            let d = col.addText(item.day);
            d.font = Font.systemFont(this.s(10,"poetry")); d.textColor = this.getConfColor("poetry");
            col.addSpacer(1);
            let iSz = this.s(13,"weather"); 
            let ico = col.addImage(this.getSFIco(item.ico)); ico.imageSize = new Size(iSz,iSz);
            ico.tintColor = this.getConfColor("weather");
            col.addSpacer(1);
            let t = col.addText(`${item.min}/${item.max}°`); t.font = Font.systemFont(this.s(9,"poetry")); t.textColor = this.getConfColor("poetry");
        } else {
            this.addText(col, item.day, 11, "poetry");
            col.addSpacer(1);
            let ico = col.addImage(this.getSFIco(item.ico)); 
            let iSz = this.s(15,"weather");
            ico.imageSize = new Size(iSz, iSz); 
            ico.tintColor = this.getConfColor("weather");
            col.addSpacer(1);
            this.addText(col, `${item.min}/${item.max}°`, 10, "poetry");
        }

        if(i < count-1) fStack.addSpacer(spaceGap);
      }
      if (isStyle2 && count < 7) {
           mix.addSpacer(4);
           let warn = mix.addText("API仅" + count + "天"); warn.font = Font.systemFont(8); warn.textColor = Color.red();
      }
    } else {
        let e = mix.addText("无预报数据");
        e.font = Font.systemFont(10); e.textColor = Color.red();
    }
    mix.addSpacer(10);
    if (showPoetry && !isStyle2 && data.poetry && data.poetry.data) {
        let pStack = mix.addStack(); 
        pStack.layoutVertically();
        pStack.backgroundColor = new Color("#666", 0.3); 
        pStack.cornerRadius = 4; 
        pStack.setPadding(2, 4, 2, 4); 
        
        let content = data.poetry.data.content.replace(/[。，！]$/, "");
        const maxChars = 13; 
        
        for (let i = 0; i < content.length; i += maxChars) {
            let line = content.substr(i, maxChars);
            this.addText(pStack, line, 10, "poetry");
        }
        
        pStack.addSpacer(2);
        
        let author = `${data.poetry.data.origin.dynasty}·${data.poetry.data.origin.author}`;
        let at = this.addText(pStack, `— ${author}`, 9, "poetry"); 
        at.rightAlignText(); 
    }
    
    const showSch = (this.settings[`${this.activePrefix}show_schedule`] !== "false");
    const showSolar = (this.settings[`${this.activePrefix}show_solar_term`] === "true");

    if (showSolar) {
        let solarTerms = this.getNextTwoSolarTerms();
        if (solarTerms.length > 0) {
            stack.addSpacer(4);
            let sStack = stack.addStack(); 
            sStack.centerAlignContent();
            
            let sIco = sStack.addImage(this.getSFIco("calendar.badge.clock"));
            sIco.imageSize = new Size(12, 12); 
            sIco.tintColor = new Color("#ffffff");
            sStack.addSpacer(4);
            let term1 = solarTerms[0];
            let t1Str, t1Color;
            
            if (term1.days === 0) {
                t1Str = `今日节气:${term1.name}`;
                t1Color = new Color("#99CCFF"); 
            } else {
                t1Str = `距离${term1.name}还有:${term1.days}天`;
                t1Color = new Color("#FFCC99"); 
            }
            
            let t1 = sStack.addText(t1Str);
            t1.font = Font.systemFont(this.s(11, "info"));
            t1.textColor = t1Color;

            if (solarTerms.length > 1) {
                let term2 = solarTerms[1];
                let sep = sStack.addText("  |  ");
                sep.font = Font.systemFont(this.s(11, "info"));
                sep.textColor = new Color("#ffffff", 0.5);

                let t2Str = `距离${term2.name}还有:${term2.days}天`;
                let t2 = sStack.addText(t2Str);
                t2.font = Font.systemFont(this.s(11, "info"));
                t2.textColor = new Color("#ffffff");
            }
        }
    } else if (showSch && data.schedules.length > 0) {
      let displayEvents = data.schedules;
      let keyword = this.settings[`${this.activePrefix}schedule_keyword`];
      let targetIndex = parseInt(this.settings[`${this.activePrefix}schedule_index`]) || 0;
      if (keyword && keyword.trim() !== "") {
          displayEvents = displayEvents.filter(e => e.title.includes(keyword));
      }
      
      let finalEvent = displayEvents[targetIndex];
      if (finalEvent) {
          stack.addSpacer(4);
          let sStack = stack.addStack(); sStack.centerAlignContent();
          let sIco = sStack.addImage(this.getSFIco("megaphone")); sIco.imageSize = new Size(10,10); sIco.tintColor = this.getConfColor("info");
          sStack.addSpacer(4);
          this.addText(sStack, finalEvent.title, 11, "info");
      }
    }
  },

  renderLotteryBalls(stack, numString, type, isCompact = false) {
      const cRed = new Color("#FF3B30");
      const cBlue = new Color("#007AFF");
      
      let zones = numString.split("+");
      let frontNums = zones[0].trim().split(/[\s,]+/); 
      let backNums = [];
      if (zones.length > 1) {
          backNums = zones[1].trim().split(/[\s,]+/);
      }
      
      let baseFontSize = this.s(14, "lotteryItem");
      let ballDiameter = Math.round(baseFontSize * (isCompact ? 1.5 : 1.7));
      const renderOneBall = (n, color) => {
          if (!n || n.trim() === "") return;
          let box = stack.addStack();
          box.size = new Size(ballDiameter, ballDiameter); 
          box.cornerRadius = ballDiameter / 2;
          box.backgroundColor = color;
          box.centerAlignContent();
          let t = box.addText(n);
          t.font = Font.boldSystemFont(baseFontSize);
          t.textColor = Color.white();
          
          stack.addSpacer(isCompact ? 3 : 4); 
      };
      for (let n of frontNums) renderOneBall(n, cRed);
      for (let n of backNums) renderOneBall(n, cBlue);
  },

  async renderWeatherSide(stack, w) {
    let top = stack.addStack(); top.bottomAlignContent(); stack.addSpacer(0); top.addSpacer();
    let ico = top.addImage(this.getSFIco(w.ico));
    let bigIcoSz = this.s(30, "weatherLarge");
    ico.imageSize = new Size(bigIcoSz, bigIcoSz); 
    ico.tintColor = this.getConfColor("weatherLarge");
    top.addSpacer(4);
    let temp = this.addText(top, `${w.temp||'-'}°`, 21, "weatherLarge"); temp.font = Font.boldMonospacedSystemFont(this.s(21, "weatherLarge"));
    stack.addSpacer(4);
    const addR = (t) => { let r = stack.addStack(); r.addSpacer(); this.addText(r, t, 12, "weather"); };
    addR(`湿度：${w.hum||'-'}`); addR(`舒适：${w.comfort||'-'}`); addR(`紫外：${w.uv||'-'}`); addR(`空气：${w.aqi||'-'}`);
    stack.addSpacer(2);
    let hl = stack.addStack(); hl.addSpacer();
    let ht = hl.addText(`↑${w.max||'-'}°`); ht.font = Font.systemFont(this.s(11,"weather")); ht.textColor = new Color("#ff5555");
    hl.addSpacer(4);
    let lt = hl.addText(`↓${w.min||'-'}°`); lt.font = Font.systemFont(this.s(11,"weather")); lt.textColor = new Color("#55ff55");
    stack.addSpacer(1);
    
    let sun = stack.addStack(); sun.addSpacer();
    let smIcoSz = this.s(12, "weather");
    let sunIco = sun.addImage(this.getSFIco("sunrise.fill")); sunIco.imageSize = new Size(smIcoSz,smIcoSz); 
    this.addText(sun, w.sunrise||"--:--", 11, "weather");
    sun.addSpacer(4);
    let setIco = sun.addImage(this.getSFIco("sunset.fill")); setIco.imageSize = new Size(smIcoSz,smIcoSz); 
    this.addText(sun, w.sunset||"--:--", 11, "weather");
    stack.addSpacer(2);
    
    let time = stack.addStack(); time.addSpacer();
    let d = new Date(); let min = d.getMinutes();
    this.addText(time, `更新 ${d.getHours()}:${min<10?'0'+min:min}`, 10, "weather");
  },

  async renderTimeInfo(stack) {
    let timeStack = stack.addStack(); timeStack.layoutHorizontally(); 
    timeStack.setPadding(0, 4, 0, 4);
    const currentDate = new Date();
    const lunarObj = this.getLunarDate_Precise(currentDate);
    const zodiac = zodiacAnimals[(lunarObj.year - 4) % 12];
    const weekNumber = getWeekOfYear(currentDate);
    const dayOfYear = getDayOfYear(currentDate);
    const totalDays = (currentDate.getFullYear() % 4 === 0) ? 366 : 365;
    let yiList = [];
    let jiList = [];
    
    try {
        const events = await CalendarEvent.today([]);
        for (const e of events) {
            if (!e.isAllDay) continue;
            let t = e.title;
            
            if (t.includes("宜")) {
                let content = t.substring(t.indexOf("宜") + 1);
                if (content.includes("忌")) content = content.split("忌")[0];
                content = content.replace(/^[:：\s]+/, ""); 
                let items = content.split(/[\s,，、\.．]+/).filter(x => x.trim().length > 0 && x.length < 6);
                if (items.length > 0) yiList = items;
            }
            
            if (t.includes("忌")) {
                let content = t.substring(t.indexOf("忌") + 1);
                if (content.includes("宜")) content = content.split("宜")[0];
                content = content.replace(/^[:：\s]+/, "");
                let items = content.split(/[\s,，、\.．]+/).filter(x => x.trim().length > 0 && x.length < 6);
                if (items.length > 0) jiList = items;
            }
        }
    } catch (err) {}

    if (yiList.length === 0) yiList = getYiJiSimple(currentDate, 0);
    if (jiList.length === 0) jiList = getYiJiSimple(currentDate, 1);

    let leftStack = timeStack.addStack(); leftStack.layoutVertically();
    leftStack.setPadding(0, 5, 0, 0);
    let zodiacLunarStack = leftStack.addStack(); zodiacLunarStack.centerAlignContent();
    this.addText(zodiacLunarStack, `${zodiac}年 ${lunarObj.month}${lunarObj.day}`, 12, "timeInfo");
    leftStack.addSpacer(0);
    let weekDayStack = leftStack.addStack(); weekDayStack.centerAlignContent();
    this.addText(weekDayStack, `第${weekNumber}/53周 第 ${dayOfYear}/${totalDays}天`, 10, "date");
    timeStack.addSpacer();
    let middleStack = timeStack.addStack(); middleStack.centerAlignContent();
    this.renderYiJi(middleStack, "宜", "#D32F2F", yiList, "#D32F2F");
    timeStack.addSpacer();
    let rightStack = timeStack.addStack(); rightStack.centerAlignContent();
    this.renderYiJi(rightStack, "忌", "#000000", jiList, "#ffffff");
  },

  renderYiJi(stack, title, circleColor, list, textColor) {
    let circle = stack.addStack(); 
    let cSz = this.s(30,"timeInfo");
    circle.size = new Size(cSz, cSz); 
    circle.cornerRadius = cSz/2; 
    circle.backgroundColor = new Color(circleColor); circle.centerAlignContent();
    let t = circle.addText(title);
    t.font = Font.boldSystemFont(this.s(17, "timeInfo")); t.textColor = Color.white();
    stack.addSpacer(8);
    let contentStack = stack.addStack(); contentStack.layoutVertically();
    if (list.length > 0) {
      let l1 = contentStack.addStack();
      this.addText(l1, list.slice(0, 3).join("  "), 10, "timeInfo", false, 0, 1, new Color(textColor));
      if (list.length > 3) {
        let l2 = contentStack.addStack();
        this.addText(l2, list.slice(3, 6).join("  "), 10, "timeInfo", false, 0, 1, new Color(textColor));
      }
    }
  },

  async renderWeekRow(stack) {
    let head = stack.addStack(); 
    head.setPadding(0,5,0,3);
    let defaultWeekGap = (this.activePrefix === "s3_" || this.activePrefix === "s4_") ? 8 : 30;
    let weekGap = parseFloat(this.settings[`${this.activePrefix}space_week_w`] || defaultWeekGap);
    for(let i=0; i<7; i++) {
      let c = head.addStack(); c.size = new Size(this.s(24,"calendar"), this.s(22,"calendar")); c.centerAlignContent();
      let t = c.addText(weekTitleShort[i]); t.font = Font.boldSystemFont(this.s(14, "calendar"));
      t.textColor = (i===0||i===6) ? new Color("#ff5555") : this.getConfColor("calendar");
      if(i<6) head.addSpacer(weekGap);
    }
  },

  async renderCalendarGrid(stack) {
    let d = new Date(); let year = d.getFullYear();
    let month = d.getMonth();
    let grid = getMonthGrid(year, month);
    
    let colGap, rowGap;
    if (this.activePrefix === "s3_" || this.activePrefix === "s4_") {
        colGap = parseFloat(this.settings[`${this.activePrefix}space_cal_w`] || 7.3);
        rowGap = parseFloat(this.settings[`${this.activePrefix}space_cal_h`] || 0);
    } else {
        colGap = parseFloat(this.settings[`${this.activePrefix}space_cal_w`] || 29.2);
        rowGap = parseFloat(this.settings[`${this.activePrefix}space_cal_h`] || 3);
    }

    let cellSz = this.s(25,"calendar");
    for(let w=0; w<grid.length; w++) {
      let row = stack.addStack(); 
      row.setPadding(0,7,0,2);
      for(let i=0; i<7; i++) {
        let day = grid[w][i];
        let c = row.addStack();
        c.size = new Size(cellSz, cellSz); c.layoutVertically(); c.centerAlignContent();
        if(day !== null) {
          let dateObj = new Date(year, month, day);
          let isToday = (day === d.getDate());
          let isWk = (i===0||i===6);
          let top = c.addStack(); top.size = new Size(this.s(17,"calendar"), this.s(17,"calendar")); top.centerAlignContent();
          if(isToday) {
            let circle = top.addStack();
            circle.size = new Size(this.s(16,"calendar"), this.s(16,"calendar")); circle.cornerRadius = this.s(8,"calendar");
            circle.backgroundColor = new Color("#ffcc00"); circle.centerAlignContent();
            let dt = circle.addText(day.toString()); dt.font = Font.boldSystemFont(this.s(14,"calendar"));
            dt.textColor = Color.black();
          } else {
            let dt = top.addText(day.toString());
            dt.font = Font.boldSystemFont(this.s(14,"calendar"));
            dt.textColor = isWk ? new Color("#ff5555") : this.getConfColor("calendar");
          }
          let lunar = this.getLunarDate_Precise(dateObj); let term = getSolarTerm(dateObj);
          let lStack = c.addStack(); lStack.setPadding(-1,1.5,0,0); lStack.centerAlignContent();
          let lt = lStack.addText(term || lunar.day); lt.font = Font.systemFont(this.s(9,"calendar"));
          lt.textColor = new Color(this.getConfColor("calendar").hex, 0.7);
        }
        if(i<6) row.addSpacer(colGap);
      }
      if(w<grid.length-1) stack.addSpacer(rowGap);
    }
  },

  addText(stack, text, size, type, bold=false, top=0, lines=1, forceColor=null) {
    if(top>0) stack.addSpacer(top);
    let t = stack.addText(String(text));
    t.font = bold ? Font.boldSystemFont(this.s(size, type)) : Font.systemFont(this.s(size, type));
    t.textColor = forceColor || this.getConfColor(type);
    if(lines>1) t.lineLimit = lines;
    return t;
  },
  
  s(size, type) { 
    let key = `${this.activePrefix}size_${type}`;
    let savedVal = this.settings[key];
    let scale = (parseInt(savedVal || "100") || 100) / 100;
    let globalScale = (parseInt(this.settings.global_font_size || "100") || 100) / 100;
    return Math.round(size * scale * globalScale);
  },
  
  getConfColor(type) { 
    let key = `${this.activePrefix}color_${type}`;
    let c = this.settings[key];
    return c ? new Color(c) : new Color(baseConfigKeys[`color_${type}`] || "#ffffff");
  },

  getSFIco(name) { try { return SFSymbol.named(name).image } catch { return SFSymbol.named("sun.max.fill").image } },
  getDateStr(d) { let f = new DateFormatter();
  f.locale="zh_cn"; f.dateFormat="yyyy年MM月d日"; return f.string(d); },
  getGreeting(d) {
    const h = d.getHours();
    let p = this.activePrefix;
    let custom = "";
    
    if(h < 5 || h >= 23) {
        custom = this.settings[`${p}text_greeting_night`];
        if(!custom) custom = greetingText.nightGreeting;
    } else if(h < 11) {
        custom = this.settings[`${p}text_greeting_morning`];
        if(!custom) custom = greetingText.morningGreeting;
    } else if(h < 13) {
        custom = this.settings[`${p}text_greeting_noon`];
        if(!custom) custom = greetingText.noonGreeting;
    } else if(h < 18) {
        custom = this.settings[`${p}text_greeting_afternoon`];
        if(!custom) custom = greetingText.afternoonGreeting;
    } else {
        custom = this.settings[`${p}text_greeting_evening`];
        if(!custom) custom = greetingText.nightText;
    }
    return custom;
  },
  getNextTwoSolarTerms() {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      let terms = [];
      let maxDaysToCheck = 40;

      for (let i = 0; i <= maxDaysToCheck; i++) {
          let checkDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
          let term = getSolarTerm(checkDate);
          if (term) {
              terms.push({ name: term, days: i });
              if (terms.length >= 2) break; 
          }
      }
      return terms;
  },
  airQuality(v) { if(v<=50)return "优"; if(v<=100)return "良"; if(v<=150)return "轻"; if(v<=200)return "中"; if(v<=300)return "重"; return "严";
  },
  getLunarDate_Precise(date) { 
    const lm=["正月","二月","三月","四月","五月","六月","七月","八月","九月","十月","冬月","腊月"]; 
    const ld=["初一","初二","初三","初四","初五","初六","初七","初八","初九","初十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十","廿一","廿二","廿三","廿四","廿五","廿六","廿七","廿八","廿九","三十"]; 
    let y=date.getFullYear(),m=date.getMonth()+1,d=date.getDate(); 
    let i,sum=348,offset=(Date.UTC(y,m-1,d)-Date.UTC(1900,0,31))/86400000; 
    for(i=1900;i<2101&&offset>0;i++){sum=lYearDays(i);offset-=sum;} 
    if(offset<0){offset+=sum;i--;} 
    let leap=lunarInfo[i-1900]&0xf,isLeap=false,j,md;
    for(j=1;j<13&&offset>0;j++){ 
      if (i === 2026 && j === 1 && !isLeap) {
        md = 30;
      } else {
        md=(leap===j-1&&!isLeap)?((lunarInfo[i-1900]&0x10000)?30:29):((lunarInfo[i-1900]&(0x10000>>j))?30:29); 
      }
      if(isLeap&&j===leap+1)isLeap=false;else if(leap>0&&j===leap+1&&!isLeap){isLeap=true;--j;} 
      offset-=md;
    } 
    if(offset<0){offset+=md;--j;}   
    if(j<1)j=1;if(j>12)j=12;
    let mName = (isLeap ? "闰" : "") + lm[j - 1];
    let monthDays;
    if (i === 2026 && j === 1 && !isLeap) {
      monthDays = 30;
    } else {
      monthDays = (isLeap ? ((lunarInfo[i-1900] & 0x10000) ? 30 : 29) : ((lunarInfo[i-1900] & (0x10000 >> j)) ? 30 : 29));
    }
    let offsetInt = Math.floor(offset);
    offsetInt = offsetInt >= monthDays ? monthDays - 1 : offsetInt;
    let dName = ld[offsetInt] || "初一";
    let showName = dName;
    if (dName === "初一") {
      showName = "初一";
    }
    if (mName === "正月" && dName === "初一") {
      showName = "春节";
    }
    return { year: i, month: mName, day: showName };
  }
});
