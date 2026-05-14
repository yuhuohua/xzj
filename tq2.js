class CaishowWidget extends DmYY {
  constructor(arg) {
    super(arg);
    this.name = '全能日历天气';
    this.en = 'CalendarWeather';
    this.logo = 'https://raw.githubusercontent.com/Orz-3/task/master/scriptable/icon/caiyun.png';
    
    this.defaultData = {
      apiKey: "",
      lockLocation: false,
      fixedLng: "", fixedLat: "", fixedCity: "", fixedSubCity: "",
      refreshInterval: "60", 
      styleModel: "classic", 
      global_font_size: "100",
      lottery_type: "none"
    };
    for (const [key, val] of Object.entries(baseConfigKeys)) {
        this.defaultData[`s1_${key}`] = val;
        this.defaultData[`s2_${key}`] = val;
        this.defaultData[`s3_${key}`] = val;
        this.defaultData[`s4_${key}`] = val; 
    }
    
    this.defaultData[`s1_space_week_w`] = "30";
    this.defaultData[`s1_space_cal_w`] = "29.2";
    this.defaultData[`s2_space_week_w`] = "30";
    this.defaultData[`s2_space_cal_w`] = "29.2";

    this.defaultData[`s3_space_week_w`] = "8";
    this.defaultData[`s3_space_cal_w`] = "7.3";
    this.defaultData[`s3_space_cal_h`] = "0";
    this.defaultData[`s3_space_holiday_h`] = "4";
    this.defaultData[`s4_space_week_w`] = "8";
    this.defaultData[`s4_space_cal_w`] = "7.3";
    this.defaultData[`s4_space_cal_h`] = "0";
    this.defaultData[`s4_space_schedule_h`] = "0"; 
    this.defaultData[`s4_schedule_count`] = "4"; 
    
    const saved = ConfigManager.load();
    this.settings = Object.assign({}, this.defaultData, saved);
    this.Run();
  }

  saveSettings(notify = true) {
    ConfigManager.save(this.settings);
    super.saveSettings(false);
    if (notify) this.notify('设置成功', '配置已保存到本地文件，稍后刷新');
    return JSON.stringify(this.settings);
  }

  Run() {
    if (config.runsInApp) {      
      this.registerAction("基础设置", async () => { await this.setBasicConfig(); }, { name: 'gearshape.fill', color: '#007aff', desc: '定位、API、刷新频率' });
      this.registerAction("彩票与问候", async () => { await this.handleGreetingSettings(this.getActivePrefix()); }, { name: 'ticket.fill', color: '#FF2D55', desc: '选择显示的彩票或问候语' });
      this.registerAction("第一套（三天天气）", async () => { await this.handleStyleSettingsMenu("s1") }, { name: 'doc.text.image', color: '#FF9500', desc: '第一套 (经典)' });
      this.registerAction("第二套（七天天气）", async () => { await this.handleStyleSettingsMenu("s2") }, { name: 'doc.text', color: '#34C759', desc: '第二套 (简约)' });
      this.registerAction("第三套（节假日倒计时）", async () => { await this.handleStyleSettingsMenu("s3") }, { name: 'gift.fill', color: '#FF2D55', desc: '第三套 (节日)' });
      this.registerAction("第四套（日历日程）", async () => { await this.handleStyleSettingsMenu("s4") }, { name: 'calendar.badge.clock', color: '#007AFF', desc: '第四套 (日程)' });
      this.registerAction("组件切换", async () => { await this.handleStyleSwitch(); }, { name: 'arrow.triangle.2.circlepath', color: '#5856d6', desc: '切换当前显示样式' });
      this.registerAction("重置配置", async () => { 
        const a = new Alert();
        a.title = "确认重置？"; a.message = "所有个性化颜色、布局、Key都将丢失。";
        a.addAction("确认重置"); a.addCancelAction("取消");
        const idx = await a.presentAlert();
        if(idx===0){ ConfigManager.clear(); this.settings = Object.assign({}, this.defaultData); this.saveSettings(false); this.notify("已重置", "请重新运行脚本"); }
      }, { name: 'trash.fill', color: '#ff3b30', desc: '修复所有问题' });
      this.registerAction("检查更新", async () => { await this.updateScript() }, { name: 'cloud.fill', color: '#007aff', desc: `当前版本 v${ScriptVersion}` });
    }
  }

  async updateScript() {
    const url = "https://raw.githubusercontent.com/loveyuwy/hao/refs/heads/main/cytqzyxzj.js";
    const a = new Alert();
    try {
        const req = new Request(url);
        const html = await req.loadString();
        const versionMatch = html.match(/const\s+ScriptVersion\s*=\s*["'](.*?)["']/);
        const remoteVersion = versionMatch ? versionMatch[1] : null;
        if (!remoteVersion) {
            a.title = "⚠️ 无法检测远程版本";
            a.message = "远程文件可能未包含版本号，或者文件格式有误。\n\n是否强制覆盖更新？";
            a.addAction("强制更新"); a.addCancelAction("取消");
            const idx = await a.presentAlert();
            if (idx === 0) await this.doUpdate(html);
            return;
        }

        if (remoteVersion !== ScriptVersion) {
            a.title = `🚀 发现新版本 v${remoteVersion}`;
            a.message = `当前版本: v${ScriptVersion}\n\n建议您立即更新以获得最新功能。`;
            a.addAction("立即更新"); a.addCancelAction("稍后");
            const idx = await a.presentAlert();
            if (idx === 0) await this.doUpdate(html);
        } else {
            a.title = "✅ 已是最新版本";
            a.message = `当前版本: v${ScriptVersion}\n无需更新。`;
            a.addAction("好的");
            await a.presentAlert();
        }
    } catch (e) {
        a.title = "❌ 更新检测失败";
        a.message = "网络请求错误或地址不可达：\n" + e.message;
        a.addAction("确定");
        await a.presentAlert();
    }
  }

  async doUpdate(code) {
     if (code && code.includes("CaishowWidget")) {
        const fm = FileManager.local();
        fm.writeString(module.filename, code);
        const a = new Alert();
        a.title = "✅ 更新成功";
        a.message = "脚本已覆盖，请退出并重新运行脚本以生效。";
        a.addAction("好的");
        await a.presentAlert();
    } else {
        this.notify("更新失败", "下载的内容似乎不正确");
    }
  }

  getActivePrefix() {
    let currentModel = this.settings.styleModel || "classic";
    if (currentModel === "modern") return "s2";
    if (currentModel === "holiday") return "s3";
    if (currentModel === "schedule") return "s4";
    return "s1";
  }

  async handleGreetingSettings(prefix) {
    const lotteryOptions = [
        { t: "🚫 不显示彩票 (使用问候语)", v: "none" },
        { t: "🟡🔵 大乐透 (DLT)", v: "dlt" },
        { t: "🔴🔵 双色球 (SSQ)", v: "ssq" },
        { t: "🔢 排列三 (PL3)", v: "pl3" },
        { t: "🎲 福彩3D (FC3D)", v: "fc3d" },
        { t: "7️⃣ 七星彩 (QXC)", v: "qxc" },
        { t: "🌈 七乐彩 (QLC)", v: "qlc" },
        { t: "🖐 排列五 (PL5)", v: "pl5" }
    ];
    let currentVal = this.settings.lottery_type || "none";
    let currentOption = lotteryOptions.find(o => o.v === currentVal) || lotteryOptions[0];
    await this.renderAppView([
    {
        title: "彩票显示设置",
        menu: [
            { 
                title: "点击选择模式", 
                val: "click_select_lottery_type",
                desc: currentOption.t, 
                icon: { name: "checklist", color: "#FF2D55" },
                onClick: async () => {
                    const a = new Alert();
                    a.title = "选择显示的彩票";
                    a.message = "选择后将替换问候语位置显示开奖信息";
                    lotteryOptions.forEach(o => {
                        if (o.v === currentVal) {
                            a.addAction("✅ " + o.t);
                        } else {
                            a.addAction(o.t);
                        }
                    });
                    a.addCancelAction("取消");
                    const idx = await a.presentSheet();
                    
                    if (idx !== -1) {
                        const selected = lotteryOptions[idx];
                        this.settings.lottery_type = selected.v;
                        this.saveSettings(false);
                        this.notify("设置已更新", `当前模式：${selected.t}`);
                    }
                }
            }
        ]
    },
    { 
        title: `自定义问候语 (当彩票选择"不显示"时生效)`,
        menu: [
            { title: "凌晨/深夜 (23:00-05:00)", type: "input", val: `${prefix}_text_greeting_night`, placeholder: "默认: " + greetingText.nightGreeting },
            { title: "早上 (05:00-11:00)", type: "input", val: `${prefix}_text_greeting_morning`, placeholder: "默认: " + greetingText.morningGreeting },
            { title: "中午 (11:00-13:00)", type: "input", val: `${prefix}_text_greeting_noon`, placeholder: "默认: " + greetingText.noonGreeting },
            { title: "下午 (13:00-18:00)", type: "input", val: `${prefix}_text_greeting_afternoon`, placeholder: "默认: " + greetingText.afternoonGreeting },
            { title: "晚上 (18:00-23:00)", type: "input", val: `${prefix}_text_greeting_evening`, placeholder: "默认: " + greetingText.nightText }
        ]
    }]);
    this.saveSettings(false);
  }

  async handleStyleSettingsMenu(prefix) {
    let pName = "经典";
    if (prefix === "s2") pName = "简约";
    if (prefix === "s3") pName = "节日";
    if (prefix === "s4") pName = "日程";

    let menu = [
        { title: "布局微调", val: "menu_layout", icon: { name: "arrow.up.and.down.and.arrow.left.and.right", color: "#5856D6" }, desc: "调整组件位置", onClick: async () => await this.handleLayoutMenu(prefix) },
        { title: "间距/数量", val: "menu_spacing", icon: { name: "arrow.up.left.and.arrow.down.right", color: "#FF2D55" }, desc: "调整行列间距/数量", onClick: async () => await this.handleSpacingMenu(prefix) },
        { title: "显示开关", val: "menu_vis", icon: { name: "eye.fill", color: "#007AFF" }, desc: "隐藏/显示部分元素", onClick: async () => await this.handleVisibilityMenu(prefix, pName) },
        { title: "字体大小", val: "menu_size", icon: { name: "textformat.size", color: "#FF9500" }, desc: "调整全局或局部缩放", onClick: async () => await this.handleSizeMenu(prefix) },
        { title: "颜色配置", val: "menu_color", icon: { name: "paintpalette.fill", color: "#34C759" }, desc: "自定义文字颜色", onClick: async () => await this.handleColorMenu(prefix) },
        { title: "背景设置", val: "menu_bg", icon: { name: "photo.fill", color: "#007AFF" }, desc: "日夜模式/图片/渐变", onClick: async () => await this.handleBackgroundMenu(prefix) }
    ];
    if (prefix === "s3") {
        menu.splice(1, 0, { 
            title: "生日管理", 
            val: "menu_birthday", 
            icon: { name: "cake.fill", color: "#FF2D55" }, 
            desc: "添加/管理家人朋友生日", 
            onClick: async () => await this.handleBirthdaySettings(prefix) 
        });
    }

    await this.renderAppView([{
        title: `${pName}配置菜单`,
        menu: menu
    }]);
  }
  
  async handleBirthdaySettings(prefix) {
      let key = `${prefix}_birthday_list`;
      let savedData = this.settings[key] || "";
      let savedLines = savedData.split("\n").filter(l => l.trim() !== "");
      const a = new Alert();
      a.title = "🎂 生日管理";
      a.message = "【输入说明】\n请在下方输入框中填写，格式为：\n姓名,日期,类型\n\n【示例】\n老公,10-27,农历\n老婆,05-20,公历\n\n(输入框留空则不显示)";
      for (let i = 0; i < 10; i++) {
          let val = savedLines[i] || "";
          a.addTextField("姓名,MM-DD,公历/农历", val);
      }
      
      a.addAction("保存生效");
      a.addCancelAction("取消");
      
      const idx = await a.presentAlert();
      if (idx === 0) {
          let newLines = [];
          for (let i = 0; i < 10; i++) {
              let text = a.textFieldValue(i).trim();
              if (text) {
                  newLines.push(text);
              }
          }
          this.settings[key] = newLines.join("\n");
          this.saveSettings();
      }
  }

  async handleVisibilityMenu(prefix, styleName) {
    const keyBat = `${prefix}_show_battery`;
    const keyPoe = `${prefix}_show_poetry`;
    const keySch = `${prefix}_show_schedule`; 
    const keySolar = `${prefix}_show_solar_term`;
    
    const getStatusVal = (k) => {
        let v = this.settings[k];
        return (v === undefined || v === null || v === "true");
    };

    let batIsOn = getStatusVal(keyBat);
    let poeIsOn = getStatusVal(keyPoe);
    let schIsOn = getStatusVal(keySch); 
    let solarIsOn = (this.settings[keySolar] === "true");
    
    let batDesc = batIsOn ? "当前状态：✅ 已开启" : "当前状态：🔴 已关闭";
    let poeDesc = poeIsOn ? "当前状态：✅ 已开启" : "当前状态：🔴 已关闭";
    let schDesc = schIsOn ? "当前状态：✅ 已开启" : "当前状态：🔴 已关闭";
    let solarDesc = solarIsOn ? "当前状态：✅ 已开启 (将替换日程)" : "当前状态：🔴 已关闭";
    await this.renderAppView([{
        title: `显示设置 - ${styleName}模式`,
        menu: [
            { 
                title: "🔋 电量显示", 
                desc: batDesc, 
                icon: { name: "battery.100", color: batIsOn ? "#34C759" : "#FF3B30" },
                val: "toggle_bat",
                onClick: async () => { await this.toggleSwitch(keyBat, styleName, "电量显示", prefix); } 
            },
            { 
                title: "📜 诗词与天气联动", 
                desc: poeDesc, 
                icon: { name: "text.quote", color: poeIsOn ? "#007AFF" : "#FF3B30" },
                val: "toggle_poe",
                onClick: async () => { await this.toggleSwitch(keyPoe, styleName, "诗词显示", prefix); } 
            },
            { 
                title: "📅 日程提醒", 
                desc: schDesc, 
                icon: { name: "calendar", color: schIsOn ? "#5856D6" : "#FF3B30" },
                val: "toggle_sch",
                onClick: async () => { await this.toggleSwitch(keySch, styleName, "日程提醒", prefix); } 
            },
            { 
                title: "⏳ 二十四节气倒数", 
                desc: solarDesc, 
                icon: { name: "leaf.fill", color: solarIsOn ? "#34C759" : "#FF3B30" },
                val: "toggle_solar",
                onClick: async () => { await this.toggleSwitch(keySolar, styleName, "节气倒数", prefix); } 
            }
        ]
    }]);
  }

  async toggleSwitch(key, styleName, label, prefix) {
    const isOn = (this.settings[key] !== "false");
    const a = new Alert();
    a.title = `设置 ${styleName} ${label}`;
    a.addAction(isOn ? "开启 (当前)" : "开启");
    a.addAction(!isOn ? "关闭 (当前)" : "关闭");
    a.addCancelAction("取消");
    const idx = await a.presentSheet();
    if (idx !== -1) {
        this.settings[key] = (idx === 0) ? "true" : "false";
        this.saveSettings(false);
        await this.handleVisibilityMenu(prefix, styleName);
    }
  }

  async handleLayoutMenu(prefix) {
    const items = [
      { title: "[中号] 左侧信息区", code: "med_left" }, { title: "[中号] 右侧天气区", code: "med_right" },
      { title: "[大号] 左上信息区", code: "lg_tl" }, { title: "[大号] 右上天气区", code: "lg_tr" },
      { title: "[大号] 中间黄历条", code: "lg_mid" }, { title: "[大号] 日历-星期栏", code: "lg_week" },
      { title: "[大号] 日历-日期区", code: "lg_cal" }
    ];
    if (prefix === "s3") {
        items.push({ title: "[大号] 左下-假期倒数", code: "lg_holiday" });
    }
    if (prefix === "s4") {
        items.push({ title: "[大号] 左下-日历事件", code: "lg_schedule" });
    }
    await this.renderAppView([{
        title: `选择调整区域 (${prefix})`,
        menu: items.map(i => ({ title: i.title, val: `layout_${i.code}`, icon: { name: "square.dashed", color: "#8E8E93" }, desc: "点击设置XY偏移", onClick: async () => await this.renderLayoutInput(i.title, i.code, prefix) }))
    }]);
  }

  async renderLayoutInput(title, code, prefix) {
    await this.renderAppView([{ 
        title: `${title} - 偏移 (X/Y)`,
        menu: [
            { title: "X轴偏移", desc: "正右负左", type: "input", val: `${prefix}_layout_${code}_x`, placeholder: "0" },
            { title: "Y轴偏移", desc: "正下负上", type: "input", val: `${prefix}_layout_${code}_y`, placeholder: "0" }
        ]
    }]);
    this.saveSettings(false);
  }

  async handleSpacingMenu(prefix) {
    let menu = [
        { title: "星期栏-横向", desc:"(左右间距)", type: "input", val: `${prefix}_space_week_w`, placeholder: "28" },
        { title: "日期区-横向", desc:"(左右间距,调小防溢出)", type: "input", val: `${prefix}_space_cal_w`, placeholder: "28" },
        { title: "日期区-行高", desc:"(上下行距)", type: "input", val: `${prefix}_space_cal_h`, placeholder: "3" }
    ];
    menu.push({ title: "日程关键词(重要)", desc:"(只显示含此词的日程,留空显示所有)", type: "input", val: `${prefix}_schedule_keyword`, placeholder: "例如: 柴油" });
    if (prefix !== "s4") {
        menu.push({ title: "指定显示第几条", desc:"(筛选后的第几条, 0是第一条)", type: "input", val: `${prefix}_schedule_index`, placeholder: "0" });
    }

    if (prefix === "s3") {
        menu.push({ title: "倒计时-行高", type: "input", val: `${prefix}_space_holiday_h`, placeholder: "4" });
    }
    if (prefix === "s4") {
        menu.push({ title: "日程列表-行高", type: "input", val: `${prefix}_space_schedule_h`, placeholder: "0" });
        menu.push({ title: "最大显示数量", desc:"建议3或4", type: "input", val: `${prefix}_schedule_count`, placeholder: "4" });
        menu.push({ title: "跳过指定序号", desc:"如: 2,4 (跳过第2和第4个)", type: "input", val: `${prefix}_schedule_offset`, placeholder: "2,4" });
    }
    await this.renderAppView([{ 
        title: `间距与筛选 (${prefix})`,
        menu: menu
    }]);
    this.saveSettings(false);
  }

  async handleSizeMenu(prefix) {
    const items = [
        {id:"greeting", t:"问候语"}, 
        {id:"lotteryTitle", t:"彩票标题(期号)"},
        {id:"lotteryItem", t:"彩票开奖球号"},
        {id:"lotteryInfo", t:"今日开奖状态"}, 
        {id:"date", t:"公历日期"}, 
        {id:"lunar", t:"农历日期"}, 
        {id:"info", t:"电量与定位"}, 
        {id:"weather", t:"天气描述"}, 
        {id:"weatherLarge", t:"大温度数字"}, 
        {id:"poetry", t:"诗词与预报"}, 
        {id:"timeInfo", t:"底部时间条"}, 
        {id:"calendar", t:"月历区域"}
    ];
    if (prefix === "s3") items.push({id:"holiday", t:"假期倒数"});
    if (prefix === "s4") {
        items.push({id:"schedule_title", t:"日程标题"});
        items.push({id:"schedule_item", t:"日程列表"});
    }
    
    const menuItems = items.map(i => ({ title: i.t, type: "input", val: `${prefix}_size_${i.id}`, placeholder: "100" }));
    const globalMenu = [{ title: "🌐 全局缩放", desc: "所有文字按比例缩放(默认100)", type: "input", val: "global_font_size", placeholder: "100" }];
    await this.renderAppView([
        { title: "全局设置 (影响所有组件)", menu: globalMenu },
        {
        title: `局部微调 (${prefix})`,
        menu: [
            { title: "✏️ 修改局部数值", val: "size_edit", icon: { name: "pencil", color: "#007AFF" }, desc: "进入单独调整", onClick: async () => { await this.renderAppView([{ title: "局部缩放 (百分比)", menu: menuItems }]); this.saveSettings(false); }},
            { title: "↩️ 恢复默认", val: "size_reset", icon: { name: "arrow.counterclockwise", color: "#FF3B30" }, desc: "重置当前套系字体", onClick: async () => { items.forEach(k => this.settings[`${prefix}_size_${k.id}`] = "100"); this.settings["global_font_size"] = "100"; this.saveSettings(false); this.notify("已恢复", "字体大小已重置"); }}
        ]
    }]);
  }

  async handleColorMenu(prefix) {
    const items = [
        {id:"greeting", t:"问候语"},
        {id:"lotteryTitle", t:"彩票标题"},
        {id:"lotteryInfo", t:"今日开奖状态"},
        {id:"date", t:"公历日期"}, {id:"lunar", t:"农历日期"}, 
        {id:"info", t:"电量与定位"}, {id:"weather", t:"天气描述"}, 
        {id:"weatherLarge", t:"大温度数字"}, {id:"poetry", t:"诗词与预报"}, 
        {id:"timeInfo", t:"底部时间条"}, {id:"calendar", t:"月历区域"}
    ];
    if (prefix === "s3") items.push({id:"holiday", t:"假期倒数"});
    
    if (prefix === "s4") {
        items.push({id:"schedule_title", t:"日程标题"});
        items.push({id:"schedule_bg", t:"日程背景(底框)"});
        for (let j = 1; j <= 6; j++) {
            items.push({id: `schedule_item_${j}`, t: `日程列表-第${j}行`});
        }
    }

    const menuItems = items.map(i => ({ title: i.t, type: "color", val: `${prefix}_color_${i.id}` }));
    await this.renderAppView([{
        title: `颜色配置 (${prefix})`,
        menu: [
            { title: "🎨 修改颜色", val: "color_edit", icon: { name: "paintpalette", color: "#007AFF" }, desc: "进入选色页面", onClick: async () => { await this.renderAppView([{ title: "自定义颜色", menu: menuItems }]); this.saveSettings(false); }},
            { title: "↩️ 恢复默认", val: "color_reset", icon: { name: "arrow.counterclockwise", color: "#FF3B30" }, desc: "重置当前套系颜色", onClick: async () => { items.forEach(k => this.settings[`${prefix}_color_${k.id}`] = baseConfigKeys[`color_${k.id}`]); this.saveSettings(false); this.notify("已恢复", "颜色已重置"); 
            }}
        ]
    }]);
  }

  async handleBackgroundMenu(prefix) {
    const filename = `bg_${prefix}.jpg`; 
    const filenameDay = `bg_${prefix}_day.jpg`; 
    const filenameNight = `bg_${prefix}_night.jpg`;
    await this.renderAppView([{
        title: `背景模式 (${prefix})`,
        menu: [
            { title: "☀️ 白天模式 - 图片", val: "bg_select_day", icon: { name: "sun.max.fill", color: "#FF9500" }, desc: "选择白天显示的图片", onClick: async () => { try { let i = await Photos.fromLibrary(); ConfigManager.saveImg(filenameDay, i); ConfigManager.saveImg(filename, i); this.notify("成功", "白天图片已保存"); } catch (e) {} }},
            { title: "🌙 夜间模式 - 图片", val: "bg_select_night", icon: { name: "moon.fill", color: "#5856D6" }, desc: "选择深色模式图片", 
              onClick: async () => { try { let i = await Photos.fromLibrary(); ConfigManager.saveImg(filenameNight, i); this.notify("成功", "夜间图片已保存"); } catch (e) {} }},
            
            { title: "☀️ 白天 - 颜色1 (主色)", type: "color", val: `${prefix}_color_bg_day`, desc: "无图片时显示" },
            { title: "☀️ 白天 - 颜色2 (渐变)", type: "color", val: `${prefix}_color_bg_2_day`, desc: "可选: 设置后显示渐变" },
            
            { title: "🌙 夜间 - 颜色1 (主色)", type: "color", val: `${prefix}_color_bg_night`, desc: "无图片时显示" },
            { title: "🌙 夜间 - 颜色2 (渐变)", type: "color", val: `${prefix}_color_bg_2_night`, desc: "可选: 设置后显示渐变" },

            { title: "🗑 清除所有图片", val: "bg_clear", icon: { name: "trash", color: "#FF3B30" }, desc: "恢复纯色背景", onClick: async () => { ConfigManager.rmImg(filename);
              ConfigManager.rmImg(filenameDay); ConfigManager.rmImg(filenameNight); this.notify("成功", "背景已清除"); }}
        ]
    }]);
    this.saveSettings(false);
  }

  async setBasicConfig() {
     const l=async()=>{try{const lo=await Location.current();const g=await Location.reverseGeocode(lo.latitude,lo.longitude,"zh_cn");this.settings.fixedLat=String(lo.latitude);this.settings.fixedLng=String(lo.longitude);this.settings.fixedCity=g[0].locality;this.settings.fixedSubCity=g[0].subLocality;this.saveSettings(false);this.notify("定位成功","已保存");await this.setBasicConfig();}catch(e){this.notify("定位失败",e.message);await this.setBasicConfig();}};
     const items = [
         { title:"彩云API Key", type:"input", val:"apiKey", placeholder:"请输入Token" },
         { title:"免费申请Token", val:"apply_token", icon: {name: "key", color: "#34C759"}, desc:"点击跳转官网", onClick:async()=>{Safari.open("https://platform.caiyunapp.com/login")} },
         { title:"刷新间隔(分)", type:"input", val:"refreshInterval", placeholder:"60" },
         { title:"📍 获取定位", val:"get_location_btn", icon: {name: "location", color: "#007AFF"}, onClick:l }, 
         { title:"锁定定位", type:"switch", val:"lockLocation" }
     ];
     await this.renderAppView([{ title:"基础设置 (全局生效)", menu:items }, { title:"固定坐标", menu:[{ title:"经度", type:"input", val:"fixedLng" }, { title:"纬度", type:"input", val:"fixedLat" }, { title:"城市", type:"input", val:"fixedCity" }, { title:"区域", type:"input", val:"fixedSubCity" }] }]);
     this.saveSettings(false);
  }

  async handleStyleSwitch() {
    const saved = ConfigManager.load();
    this.settings = Object.assign({}, this.defaultData, saved);
    const options = [ 
        { t: "第一套(三天天气)", v: "classic" }, 
        { t: "第二套(七天天气)", v: "modern" },
        { t: "第三套(节日倒计时)", v: "holiday" },
        { t: "第四套(日历事件)", v: "schedule" }
    ];
    const currentStyle = this.settings.styleModel || "classic";

    await this.renderAppView([{
        title: "选择组件样式",
        menu: options.map(o => ({
            title: (currentStyle === o.v ? "✅ " : "") + o.t,
            val: `style_${o.v}`,
            icon: { name: "circle.grid.2x2", color: "#5856D6" },
            onClick: async () => {
                const a = new Alert();
                a.title = "确认切换？";
                a.message = `即将切换为：${o.t}\n\n切换后请点击脚本右下角的“运行”按钮以刷新预览。`;
                a.addAction("确认切换");
                a.addCancelAction("取消");
                
                const idx = await a.presentAlert();
                
                if (idx === 0) {
                    this.settings.styleModel = o.v;
                    this.saveSettings(false);
                    this.notify("✅ 样式已切换", `当前模式：${o.t} (请重新运行)`);
                }
            }
        }))
    }]);
  }

  async setKeyConfig() { await this.setBasicConfig(); }
  async setRefreshConfig() { await this.setBasicConfig(); }
}
