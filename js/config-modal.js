const ConfigModal = {
  open() {
    let modal = document.getElementById("configModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "configModal";
      modal.className = "modal-overlay";
      modal.innerHTML = this.buildHTML();
      document.body.appendChild(modal);
      this.bindEvents(modal);
    }
    this.fillForm();
    modal.style.display = "flex";
  },
  close() {
    const modal = document.getElementById("configModal");
    if (modal) modal.style.display = "none";
  },
  /** AI 厂商库（v1.6.4：每家独立细分；选厂商自动带出协议 / 地址 / 常见模型）
   *  type 仍是运行时协议（openai / gemini），由厂商派生，用户不再手选协议 */
  PROVIDERS: [
    // ---- 国内厂商直连 ----
    {
      id: "deepseek",
      name: "DeepSeek 官方",
      group: "国内厂商直连",
      type: "openai",
      endpoint: "https://api.deepseek.com/v1",
      models: ["deepseek-chat", "deepseek-reasoner"],
      tip: "platform.deepseek.com 申请 Key；deepseek-chat 即 V3 通用版，deepseek-reasoner 为推理模型"
    },
    {
      id: "qwen",
      name: "阿里 · 通义千问",
      group: "国内厂商直连",
      type: "openai",
      endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      models: ["qwen-max", "qwen-plus", "qwen-turbo"],
      tip: "阿里云百炼 bailian.console.aliyun.com 申请 Key；qwen-max 最强，turbo 最快最省"
    },
    {
      id: "kimi",
      name: "Kimi · 月之暗面",
      group: "国内厂商直连",
      type: "openai",
      endpoint: "https://api.moonshot.cn/v1",
      models: ["kimi-k2-0711-preview", "moonshot-v1-128k", "moonshot-v1-32k"],
      tip: "platform.moonshot.cn 申请 Key；长文本能力强，适合主笔"
    },
    {
      id: "zhipu",
      name: "智谱 · GLM",
      group: "国内厂商直连",
      type: "openai",
      endpoint: "https://open.bigmodel.cn/api/paas/v4",
      models: ["glm-4.5", "glm-4-plus", "glm-4-flash"],
      tip: "bigmodel.cn 申请 Key；glm-4-flash 有免费额度，适合变量AI这类杂活"
    },
    {
      id: "siliconflow",
      name: "硅基流动 SiliconFlow",
      group: "国内厂商直连",
      type: "openai",
      endpoint: "https://api.siliconflow.cn/v1",
      models: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct"],
      tip: "siliconflow.cn 聚合托管多家开源模型，新用户常有赠送额度；模型名需带厂商前缀"
    },
    {
      id: "ark",
      name: "火山方舟 · 豆包",
      group: "国内厂商直连",
      type: "openai",
      endpoint: "https://ark.cn-beijing.volces.com/api/v3",
      models: ["doubao-seed-1-6-250615", "doubao-1-5-pro-32k-250115"],
      tip: "火山方舟控制台 console.volcengine.com/ark 开通；也可直接填接入点 ID（ep-开头）"
    },
    // ---- 海外厂商直连 ----
    {
      id: "openai",
      name: "OpenAI 官方",
      group: "海外厂商直连",
      type: "openai",
      endpoint: "https://api.openai.com/v1",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o3"],
      tip: "platform.openai.com 申请 Key；需海外网络，或改用聚合站 / 中转"
    },
    {
      id: "gemini",
      name: "Google · Gemini 官方",
      group: "海外厂商直连",
      type: "gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
      models: ["gemini-2.5-pro", "gemini-2.5-flash"],
      tip: "aistudio.google.com 申请 Key；走 Gemini 原生协议，需海外网络"
    },
    // ---- 聚合站（一个 Key 通吃多厂） ----
    {
      id: "openrouter",
      name: "OpenRouter 聚合站",
      group: "聚合站",
      type: "openai",
      endpoint: "https://openrouter.ai/api/v1",
      models: ["anthropic/claude-sonnet-4", "google/gemini-2.5-pro", "deepseek/deepseek-chat"],
      tip: "openrouter.ai 一个 Key 调用数百家模型（含 Claude / Gemini / DeepSeek）；需海外网络"
    },
    {
      id: "302ai",
      name: "302.ai 聚合站",
      group: "聚合站",
      type: "openai",
      endpoint: "https://api.302.ai/v1",
      models: ["claude-sonnet-4", "gpt-4o", "gemini-2.5-pro"],
      tip: "302.ai 国内聚合站，充值即用 Claude / GPT / Gemini，免海外网络"
    },
    // ---- 自定义 / 中转 ----
    {
      id: "custom-openai",
      name: "OpenAI 兼容格式 · 自定义地址",
      group: "自定义 / 中转",
      type: "openai",
      endpoint: "",
      models: [],
      tip: "填任意 OpenAI 兼容地址：one-api / new-api / gcli 等中转站或自建代理（地址一般以 /v1 结尾）"
    },
    {
      id: "custom-gemini",
      name: "Gemini 格式 · 自定义地址",
      group: "自定义 / 中转",
      type: "gemini",
      endpoint: "",
      models: [],
      tip: "填 Gemini 原生格式的自定义地址（如自建 gemini 代理）"
    }
  ],
  /** 🖼 生图厂商库（v3.9.0 第四接口专用；均走 OpenAI 兼容协议，mode 区分 images/chat 两路）
   *  - images 模式：POST {endpoint}/images/generations（标准生图接口，绝大多数服务商）
   *  - chat 模式：对话式生图模型（chat/completions 回复中带图片链接，OpenRouter 常见） */
  IMG_PROVIDERS: [
    {
      id: "agnes",
      name: "Agnes AI（自配生图 · agnes-image-2.5-flash）",
      type: "openai",
      mode: "images",
      endpoint: "https://apihub.agnes-ai.com/v1",
      models: ["agnes-image-2.5-flash"],
      tip: "自带的 Agnes 生图接口；Key 在 apihub.agnes-ai.com 获取。走标准 /images/generations，中文提示词效果好，出图快"
    },
    {
      id: "siliconflow",
      name: "硅基流动 SiliconFlow",
      type: "openai",
      mode: "images",
      endpoint: "https://api.siliconflow.cn/v1",
      models: ["Kwai-Kolors/Kolors", "black-forest-labs/FLUX.1-schnell"],
      tip: "siliconflow.cn 申请 Key；Kolors 中文理解佳，FLUX.1-schnell 出图快，均走标准生图接口"
    },
    {
      id: "ark-seedream",
      name: "火山方舟 · 豆包 Seedream",
      type: "openai",
      mode: "images",
      endpoint: "https://ark.cn-beijing.volces.com/api/v3",
      models: ["doubao-seedream-4-0-250828"],
      tip: "火山方舟控制台开通文生图；OpenAI images 格式，中文提示词效果极佳"
    },
    {
      id: "openai",
      name: "OpenAI 官方（gpt-image / DALL·E）",
      type: "openai",
      mode: "images",
      endpoint: "https://api.openai.com/v1",
      models: ["gpt-image-1", "dall-e-3"],
      tip: "platform.openai.com 申请 Key；gpt-image-1 返回 base64（已自动兼容），dall-e-3 返回链接；需海外网络或中转"
    },
    {
      id: "gemini-img",
      name: "Google Gemini（OpenAI 兼容层）",
      type: "openai",
      mode: "images",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
      models: ["gemini-2.0-flash-preview-image-generation"],
      tip: "aistudio.google.com 申请 Key；走 Gemini 的 OpenAI 兼容层生图端点；需海外网络"
    },
    {
      id: "302ai",
      name: "302.ai 聚合站",
      type: "openai",
      mode: "images",
      endpoint: "https://api.302.ai/v1",
      models: ["gpt-image-1", "flux-1.1-pro", "nano-banana"],
      tip: "302.ai 充值即用多种生图模型，免海外网络"
    },
    {
      id: "openrouter",
      name: "OpenRouter 聚合站（对话式生图）",
      type: "openai",
      mode: "chat",
      endpoint: "https://openrouter.ai/api/v1",
      models: ["google/gemini-2.5-flash-image-preview", "openai/gpt-image-1"],
      tip: "OpenRouter 生图模型多走对话接口，请保持「chat 对话式」模式；需海外网络"
    },
    {
      id: "novelai",
      name: "NovelAI 原生（V3-V5 全系模型）",
      type: "nai",
      mode: "nai",
      endpoint: "https://image.novelai.net",
      models: ["nai-diffusion-4-5-full", "nai-diffusion-5-full", "nai-diffusion-4-5-curated", "nai-diffusion-3"],
      tip: "官方地址 image.novelai.net（Key 为 pst- 开头的令牌）；各 NAI 代理站填其根地址即可，地址会自动补全 /ai/generate-image；模型代号见下方 NAI 快捷按钮"
    },
    {
      id: "ink",
      name: "文墨画师（纯文本模型生图 · 零成本）",
      type: "openai",
      mode: "ink",
      endpoint: "",
      models: [],
      tip: "不接生图 API：由任意文本模型（默认复用主笔接口，免费 gemini-3.5-flash / deepseek 皆可）手写 SVG 矢量插图，浏览器直接渲染——零生图成本，六种画风可选"
    },
    {
      id: "custom-img",
      name: "OpenAI 兼容生图 · 自定义地址",
      type: "openai",
      mode: "images",
      endpoint: "",
      models: [],
      tip: "填任意支持 /images/generations 的地址（one-api / new-api 中转、自建代理等）；对话式生图模型请切换「chat 对话式」模式；NovelAI 站点请切换「NovelAI 原生」模式"
    }
  ],
  /** 生图尺寸快捷档（填入 img_size 输入框） */
  IMG_SIZES: ["1024x1024", "1536x1024", "1024x1536", "1792x1024", "1024x1792"],
  buildHTML() {
    const providerOptions = () => {
      const groups = [];
      for (const p of this.PROVIDERS) (groups[p.group] = groups[p.group] || []).push(p);
      return Object.entries(groups).map(
        ([g, ps]) => `<optgroup label="${g}">${ps.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}</optgroup>`
      ).join("");
    };
    const chipRow = (p) => `<div class="model-chip-row" id="${p}_modelChips"></div>`;
    const imgProviderOptions = () => this.IMG_PROVIDERS.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
    return `
        <div class="modal-box">
            <div class="modal-header">
                <span>⚙ AI 接口设置</span>
                <button class="modal-close" onclick="ConfigModal.close()">✕</button>
            </div>
            <div class="modal-body">
                <div class="api-guide">
                    <b>${this.isEarthGenre() ? "六接口分工" : "五接口分工"}</b>：① 主笔写正文 · ② 动态世界推演远方事件 · ③ 变量AI登记状态面板 · ④ 插图引擎生成正文插图 · ⑤ 提示词工程师润色插图提示词${this.isEarthGenre() ? " · ⑥ 手机分身运转微信消息与朋友圈" : ""}。各接口相互独立、可同厂商可混搭；未启用的接口无需填写。
                </div>

                <!-- ✍ 主笔 AI：第一接口（写正文） -->
                <div class="dw-config api-card">
                    <div class="dw-config-head api-card-head" id="cfgSectionHead" onclick="ConfigModal.toggleMainSection()">
                        <span class="api-head-left">
                            <span class="dw-config-title">✍ 主笔 AI · 第一接口</span>
                            <span class="api-role-chip">① 写正文</span>
                            <span class="api-state-chip" id="cfg_stateChip"></span>
                        </span>
                        <span class="dw-caret" id="cfgCaret">▾</span>
                    </div>
                    <div class="dw-config-body" id="cfgSectionBody">
                        <div class="form-tip dw-intro">
                            <b>主笔</b>负责全部小说正文与开篇：文笔、长上下文最敏感。推荐长上下文高文笔模型（如 DeepSeek-V3 / qwen-max / kimi 长文本档 / claude 系）。
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🔌 连接配置</div>
                            <div class="form-row">
                                <label>AI 厂商（选定自动填地址与协议）</label>
                                <select id="cfg_provider">${providerOptions()}</select>
                                <div class="form-tip provider-tip" id="cfg_providerTip"></div>
                            </div>
                            <div class="form-row">
                                <label>API 地址 (Endpoint)</label>
                                <input id="cfg_endpoint" type="text" placeholder="例如 https://api.deepseek.com/v1 或自定义中转完整地址">
                            </div>
                            <div class="form-row">
                                <label>API Key</label>
                                <input id="cfg_key" type="password" placeholder="sk-...">
                            </div>
                            <div class="form-row">
                                <label>模型名称 (Model)</label>
                                <div class="model-fetch-row">
                                    <input id="cfg_model" type="text" placeholder="可手填，或点右侧「获取」自动拉取列表">
                                    <button type="button" class="btn-ghost" id="cfg_fetchBtn" onclick="ConfigModal.fetchModels()">获取</button>
                                </div>
                                ${chipRow("cfg")}
                                <select id="cfg_modelSelect" class="model-select" style="display:none" onchange="ConfigModal.pickModel(this.value)"></select>
                                <div class="form-tip" id="cfg_modelHint" style="display:none"></div>
                            </div>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🎛 高级参数</div>
                            <div class="form-row three-col">
                                <div>
                                    <label>最大Tokens</label>
                                    <input id="cfg_maxTokens" type="number" value="16384">
                                </div>
                                <div>
                                    <label>温度 (0-2)</label>
                                    <input id="cfg_temperature" type="number" step="0.1" min="0" max="2" value="0.9">
                                </div>
                                <div>
                                    <label>超时（秒）</label>
                                    <input id="cfg_timeout" type="number" min="60" max="1800" value="300" title="流式模式下为「无数据超时」：只要正文还在持续生成就不计时；默认 300 秒">
                                </div>
                            </div>
                            <label class="check-row">
                                <input type="checkbox" id="cfg_stream" checked>
                                <b>流式输出</b><i>推荐开启：边生成边显示，长正文不超时；「假流式」中转模型必须开启。个别老接口不兼容时可关闭</i>
                            </label>
                            <div class="form-tip">温度高更奔放、低更稳重；流式开启时超时只在「持续无任何数据」时触发，生成再久也不中断。</div>
                        </div>
                        <div id="cfg_testResult" class="test-result"></div>
                        <button type="button" class="btn-ghost dw-test-btn" onclick="ConfigModal.testConnection()">测试主接口连通</button>
                    </div>
                </div>

                <!-- 🌍 动态世界：额外 API（第二模型）驱动，可折叠分区 -->
                <div class="dw-config api-card">
                    <div class="dw-config-head api-card-head" id="dwSectionHead" onclick="ConfigModal.toggleDWSection()">
                        <span class="api-head-left">
                            <span class="dw-config-title">🌍 动态世界 · 第二接口</span>
                            <span class="api-role-chip">② 推演远方事件</span>
                            <span class="api-state-chip" id="dw_stateChip"></span>
                        </span>
                        <span class="dw-caret" id="dwCaret">▸</span>
                    </div>
                    <div class="dw-config-body" id="dwSectionBody" style="display:none">
                        <div class="form-tip dw-intro">
                            主笔 AI 写正文，<b>第二模型</b>每隔 N 轮在幕后推演"主角视线之外正在发生的事"（势力动向 / 远方传闻 / 伏笔暗流），远方事件与 NPC 档案会并入状态面板。可与主接口用不同厂商（推荐廉价长文本模型，也可复用同一接口换个模型）。
                        </div>
                        <label class="check-row">
                            <input type="checkbox" id="dw_enabled">
                            <b>启用动态世界</b><i>开篇后随正文推进自动生成</i>
                        </label>
                        <div class="va-quick-row">
                            <span class="va-quick-tip">快捷复用：</span>
                            <button type="button" class="btn-mini" onclick="ConfigModal.copyMainToExtra()">⚡ 同主接口</button>
                            <button type="button" class="btn-mini" onclick="ConfigModal.copyVarToExtra()">⚡ 同变量AI</button>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🔌 第二接口（额外 API）</div>
                            <div class="form-row">
                                <label>AI 厂商（可与主笔不同）</label>
                                <select id="dw_provider">${providerOptions()}</select>
                                <div class="form-tip provider-tip" id="dw_providerTip"></div>
                            </div>
                            <div class="form-row">
                                <label>API 地址 (Endpoint)</label>
                                <input id="dw_endpoint" type="text" placeholder="例如 https://api.deepseek.com/v1（可与主接口不同）">
                            </div>
                            <div class="form-row">
                                <label>API Key</label>
                                <input id="dw_key" type="password" placeholder="sk-...">
                            </div>
                            <div class="form-row">
                                <label>模型名称 (Model)</label>
                                <div class="model-fetch-row">
                                    <input id="dw_model" type="text" placeholder="可手填，或点右侧「获取」拉取列表">
                                    <button type="button" class="btn-ghost" id="dw_fetchBtn" onclick="ConfigModal.fetchExtraModels()">获取</button>
                                </div>
                                ${chipRow("dw")}
                                <select id="dw_modelSelect" class="model-select" style="display:none" onchange="ConfigModal.pickExtraModel(this.value)"></select>
                                <div class="form-tip" id="dw_modelHint" style="display:none"></div>
                            </div>
                            <div class="form-row three-col">
                                <div>
                                    <label>最大Tokens</label>
                                    <input id="dw_maxTokens" type="number" value="8192">
                                </div>
                                <div>
                                    <label>温度 (0-2)</label>
                                    <input id="dw_temperature" type="number" step="0.1" min="0" max="2" value="0.95">
                                </div>
                                <div>
                                    <label>超时（秒）</label>
                                    <input id="dw_timeout" type="number" min="30" max="600" value="90" title="默认 90 秒；推演挂起时自动放弃本轮，不锁后续推演">
                                </div>
                            </div>
                        </div>
                        <!-- 🎨 NovelAI 专属参数（v3.11.0 nai 模式时显示） -->
                        <div class="dw-subgroup" id="naiParamsGroup" style="display:none">
                            <div class="dw-sub-title">🎨 NovelAI 专属参数</div>
                            <div class="form-row">
                                <label>模型代号（快捷选择，可手填）</label>
                                <div class="model-chip-row" id="naiModelChips"></div>
                                <div class="form-tip">NAI 无模型列表接口（「获取」按钮拉不到属正常），请用快捷按钮或手填代号。V5 系=nai-diffusion-5-* · V4.5 系=nai-diffusion-4-5-* · V3=nai-diffusion-3。</div>
                            </div>
                            <div class="form-row">
                                <label>NAI 常用尺寸（宽 x 高，64 的倍数）</label>
                                <div class="model-chip-row">
                                    <button type="button" class="model-chip" onclick="ConfigModal.pickImgSize('832x1216')" title="竖图·NAI 标准Portrait">832x1216</button>
                                    <button type="button" class="model-chip" onclick="ConfigModal.pickImgSize('1216x832')" title="横图·NAI 标准Landscape">1216x832</button>
                                    <button type="button" class="model-chip" onclick="ConfigModal.pickImgSize('1024x1024')" title="方图">1024x1024</button>
                                    <button type="button" class="model-chip" onclick="ConfigModal.pickImgSize('1024x1536')" title="竖图·NAI 大尺寸">1024x1536</button>
                                    <button type="button" class="model-chip" onclick="ConfigModal.pickImgSize('1536x1024')" title="横图·NAI 大尺寸">1536x1024</button>
                                </div>
                            </div>
                            <div class="form-row">
                                <label>负面提示词（默认 Heavy 预设 + 防文字水印词）</label>
                                <textarea id="img_naiNegative" rows="2" placeholder="lowres, worst quality, ..."></textarea>
                                <div class="form-tip">已预填官方 Heavy 预设并补强「防图内文字/水印」词；可自行增删。步数 28 / 采样器 Euler Ancestral / CFG 5 / 噪声调度 karras 为内置推荐值。</div>
                            </div>
                            <div class="form-tip">
                                NAI 模式说明：地址填站点根地址（自动补全 /ai/generate-image）或完整生图地址均可；返回 zip 包由前端零依赖解压（需较新浏览器）；单张排队 10-30 秒属正常。
                            </div>
                        </div>
                        <!-- 🖌 文墨画师专属参数（v3.12.0 ink 模式时显示） -->
                        <div class="dw-subgroup" id="inkParamsGroup" style="display:none">
                            <div class="dw-sub-title">🖌 文墨画师专属参数</div>
                            <label class="check-row">
                                <input type="checkbox" id="img_inkUseMain" checked onchange="ConfigModal.onInkUseMainChange()">
                                <b>复用主笔接口（推荐）</b><i>用主笔的文本模型画图，零额外配置零额外成本；协议（OpenAI / Gemini）自动跟随主笔</i>
                            </label>
                            <label class="check-row">
                                <input type="checkbox" id="img_inkPlan" checked>
                                <b>精绘模式（两步构图 · 推荐）</b><i>先由模型规划五层构图，再按规划作画——构图更稳层次更分明；画后另有质量自检，不合格自动带反馈重画一次（会多一两次调用）</i>
                            </label>
                            <div class="form-row two-col">
                                <div>
                                    <label>文墨画风（注入画师的 SVG 技法导向）</label>
                                    <select id="img_inkStyle">
                                        <option value="flat">扁平插画 · 几何色块，明快现代</option>
                                        <option value="ink">水墨国风 · 浓淡留白，朱砂点缀</option>
                                        <option value="silhouette">极简剪影 · 渐变天空，正负形</option>
                                        <option value="dark">暗黑氛围 · 单点光源，压抑神秘</option>
                                        <option value="pastel">柔彩绘本 · 粉彩圆润，温暖治愈</option>
                                        <option value="neon">霓虹夜色 · 青品红光晕，雨夜反光</option>
                                    </select>
                                </div>
                                <div>
                                    <label>协议（取消复用主笔时生效）</label>
                                    <select id="img_inkType">
                                        <option value="openai">OpenAI 兼容（绝大多数中转与厂商）</option>
                                        <option value="gemini">Gemini 原生（generativelanguage.googleapis.com）</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-tip" id="inkParamsTip">
                                文墨模式说明：不接任何生图 API——由文本模型（免费 gemini-3.5-flash / deepseek 等皆可）手写 SVG 矢量插图，浏览器直接渲染；画风偏几何构成与氛围表达，细节不及专业生图模型，但零成本可无限重画。提示词工程师（第五接口）的润色稿对它同样生效。
                            </div>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🎛 生成行为</div>
                            <div class="form-row two-col">
                                <div>
                                    <label>触发间隔（每 N 轮正文）</label>
                                    <input id="dw_interval" type="number" min="1" max="20" value="5">
                                </div>
                                <div>
                                    <label>单层最少字数</label>
                                    <input id="dw_minWords" type="number" min="50" max="2000" value="200">
                                </div>
                            </div>
                            <div class="form-row">
                                <label>上下文层数（携带最近 N 层世界动态，防自相矛盾）</label>
                                <input id="dw_historyDepth" type="number" min="0" max="20" value="5">
                            </div>
                            <label class="check-row">
                                <input type="checkbox" id="dw_showReasoning" checked>
                                <b>展示世界推演</b><i>卡片内可展开查看第二模型的推演思路</i>
                            </label>
                            <label class="check-row">
                                <input type="checkbox" id="dw_useKnowledge" checked>
                                <b>注入知识库设定</b><i>世界事件贴合工坊世界观 / 原著设定</i>
                            </label>
                            <div class="form-row">
                                <label>世界推演提示词（留空 = 工坊默认）
                                    <button type="button" class="btn-mini" onclick="ConfigModal.resetDWPrompt()">↺ 恢复工坊默认</button>
                                </label>
                                <textarea id="dw_prompt" rows="4" placeholder="（留空使用工坊默认提示词，恢复工坊默认可查看全文）"></textarea>
                            </div>
                        </div>
                        <div id="dw_testResult" class="test-result"></div>
                        <button type="button" class="btn-ghost dw-test-btn" onclick="ConfigModal.testExtraConnection()">测试第二接口连通</button>
                    </div>
                </div>

                <!-- 🧾 变量AI：第三接口（状态登记官），可折叠分区 -->
                <div class="dw-config api-card">
                    <div class="dw-config-head api-card-head" id="vaSectionHead" onclick="ConfigModal.toggleVASection()">
                        <span class="api-head-left">
                            <span class="dw-config-title">🧾 变量AI · 第三接口</span>
                            <span class="api-role-chip">③ 登记状态</span>
                            <span class="api-state-chip" id="va_stateChip"></span>
                        </span>
                        <span class="dw-caret" id="vaCaret">▸</span>
                    </div>
                    <div class="dw-config-body" id="vaSectionBody" style="display:none">
                        <div class="form-tip dw-intro">
                            <b>提取器分流</b>：主笔 AI 只写正文（系统提示词去掉变量语法铁律、历史不再携带变量块，上下文更干净）；<b>第三模型</b>每轮通读正文，把章节 / 字数 / 仪表盘 / NPC 档案 / 伏笔 / 道具 / 大事记登记成变量并并入状态面板。推荐廉价强指令跟随模型（低温），可与主接口不同厂商。
                        </div>
                        <label class="check-row">
                            <input type="checkbox" id="va_enabled">
                            <b>启用变量AI分流</b><i>主笔免登记，每轮正文后由第三模型自动提取</i>
                        </label>
                        <div class="va-quick-row">
                            <span class="va-quick-tip">快捷复用：</span>
                            <button type="button" class="btn-mini" onclick="ConfigModal.copyMainToVar()">⚡ 同主接口</button>
                            <button type="button" class="btn-mini" onclick="ConfigModal.copyExtraToVar()">⚡ 同额外API（动态世界）</button>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🔌 第三接口（变量AI API）</div>
                            <div class="form-row">
                                <label>AI 厂商（可与主笔不同）</label>
                                <select id="va_provider">${providerOptions()}</select>
                                <div class="form-tip provider-tip" id="va_providerTip"></div>
                            </div>
                            <div class="form-row">
                                <label>API 地址 (Endpoint)</label>
                                <input id="va_endpoint" type="text" placeholder="例如 https://api.deepseek.com/v1（可与主接口不同）">
                            </div>
                            <div class="form-row">
                                <label>API Key</label>
                                <input id="va_key" type="password" placeholder="sk-...">
                            </div>
                            <div class="form-row">
                                <label>模型名称 (Model)</label>
                                <div class="model-fetch-row">
                                    <input id="va_model" type="text" placeholder="可手填，或点右侧「获取」拉取列表">
                                    <button type="button" class="btn-ghost" id="va_fetchBtn" onclick="ConfigModal.fetchVarModels()">获取</button>
                                </div>
                                ${chipRow("va")}
                                <select id="va_modelSelect" class="model-select" style="display:none" onchange="ConfigModal.pickVarModel(this.value)"></select>
                                <div class="form-tip" id="va_modelHint" style="display:none"></div>
                            </div>
                            <div class="form-row three-col">
                                <div>
                                    <label>最大Tokens</label>
                                    <input id="va_maxTokens" type="number" value="4096">
                                </div>
                                <div>
                                    <label>温度 (0-2)</label>
                                    <input id="va_temperature" type="number" step="0.1" min="0" max="2" value="0.2">
                                </div>
                                <div>
                                    <label>超时（秒）</label>
                                    <input id="va_timeout" type="number" min="30" max="600" value="90" title="默认 90 秒；提取挂起时自动放弃并出「重试登记」卡">
                                </div>
                            </div>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🎛 登记行为</div>
                            <label class="check-row">
                                <input type="checkbox" id="va_showCard">
                                <b>显示登记回执卡</b><i>每轮在聊天区出一张可折叠回执（默认关闭，状态面板即反馈）</i>
                            </label>
                            <label class="check-row">
                                <input type="checkbox" id="va_fallbackMain">
                                <b>主笔兜底登记</b><i>第三接口未启用时，自动用主笔接口跑登记官提示词——正文 NPC 照常建档、微信通讯录照常同步（默认开）</i>
                            </label>
                            <div class="form-tip">
                                防护：主笔若仍自带变量块则本轮以主笔为准；提取失败会出「重试登记」卡；连发指令时串行排队不丢轮。中途启用 / 关闭均可，旧存档无缝衔接。
                            </div>
                        </div>
                        <div id="va_testResult" class="test-result"></div>
                        <button type="button" class="btn-ghost dw-test-btn" onclick="ConfigModal.testVarConnection()">测试第三接口连通</button>
                    </div>
                </div>

                <!-- 🖼 插图引擎：第四接口（正文生图），可折叠分区 -->
                <div class="dw-config api-card">
                    <div class="dw-config-head api-card-head" id="imgSectionHead" onclick="ConfigModal.toggleImgSection()">
                        <span class="api-head-left">
                            <span class="dw-config-title">🖼 插图引擎 · 第四接口</span>
                            <span class="api-role-chip">④ 正文插图</span>
                            <span class="api-state-chip" id="img_stateChip"></span>
                        </span>
                        <span class="dw-caret" id="imgCaret">▸</span>
                    </div>
                    <div class="dw-config-body" id="imgSectionBody" style="display:none">
                        <div class="form-tip dw-intro">
                            启用后主笔在正文中输出<b>生图提示词</b>（提示词直接显示在正文里），系统自动调用生图接口，把生成的插图<b>插入正文对应位置</b>。全部工坊/世界通用，画风按本界自动适配（十五界内置画风库，画风补充可叠加）。推荐：硅基流动 Kolors / 豆包 Seedream（中文提示词友好）。
                        </div>
                        <label class="check-row">
                            <input type="checkbox" id="img_enabled">
                            <b>启用插图引擎</b><i>主笔写正文时同步产出插图标记，正文渲染后自动生图</i>
                        </label>
                        <div class="va-quick-row">
                            <span class="va-quick-tip">快捷复用：</span>
                            <button type="button" class="btn-mini" onclick="ConfigModal.copyMainToImg()">⚡ 同主接口</button>
                            <button type="button" class="btn-mini" onclick="ConfigModal.copyExtraToImg()">⚡ 同额外API</button>
                            <button type="button" class="btn-mini" onclick="ConfigModal.copyVarToImg()">⚡ 同变量AI</button>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🔌 第四接口（生图 API）</div>
                            <div class="form-row">
                                <label>生图厂商（选定自动填地址与模式）</label>
                                <select id="img_provider">${imgProviderOptions()}</select>
                                <div class="form-tip provider-tip" id="img_providerTip"></div>
                            </div>
                            <div class="form-row">
                                <label>接口模式（按服务商/模型选择）</label>
                                <select id="img_mode" onchange="ConfigModal.onImgModeChange()">
                                    <option value="images">标准生图接口（POST /images/generations）——绝大多数服务商</option>
                                    <option value="chat">对话式生图（chat/completions 回复带图片链接）——OpenRouter 等</option>
                                    <option value="nai">NovelAI 原生（POST /ai/generate-image）——NAI V3/V4/V4.5/V5 全系</option>
                                    <option value="ink">文墨画师（纯文本模型手写 SVG 插图）——零生图 API 成本</option>
                                </select>
                                <div class="form-tip" id="img_modeTip">不确定就选「标准生图接口」；对话式生图模型（如 OpenRouter 上的生图模型）才需要 chat 模式。</div>
                            </div>
                            <div class="form-row">
                                <label>API 地址 (Endpoint)</label>
                                <input id="img_endpoint" type="text" placeholder="例如 https://api.siliconflow.cn/v1（一般以 /v1 结尾）">
                            </div>
                            <div class="form-row">
                                <label>API Key</label>
                                <input id="img_key" type="password" placeholder="sk-...">
                            </div>
                            <div class="form-row">
                                <label>模型名称 (Model)</label>
                                <div class="model-fetch-row">
                                    <input id="img_model" type="text" placeholder="可手填，或点右侧「获取」拉取列表">
                                    <button type="button" class="btn-ghost" id="img_fetchBtn" onclick="ConfigModal.fetchImgModels()">获取</button>
                                </div>
                                <div class="model-chip-row" id="img_modelChips"></div>
                                <select id="img_modelSelect" class="model-select" style="display:none" onchange="ConfigModal.pickImgModel(this.value)"></select>
                                <div class="form-tip" id="img_modelHint" style="display:none"></div>
                            </div>
                            <div class="form-row three-col">
                                <div>
                                    <label>图片尺寸</label>
                                    <input id="img_size" type="text" value="1024x1024" placeholder="1024x1024">
                                    <div class="model-chip-row">
                                        ${this.IMG_SIZES.map((s) => `<button type="button" class="model-chip" onclick="ConfigModal.pickImgSize('${s}')" title="点击填入尺寸">${s}</button>`).join("")}
                                    </div>
                                </div>
                                <div>
                                    <label>每章插图上限</label>
                                    <input id="img_maxPerChapter" type="number" min="1" max="3" value="1" title="主笔每章最多输出的插图标记数（协议注入与自动生成双重约束）">
                                </div>
                                <div>
                                    <label>超时（秒）</label>
                                    <input id="img_timeout" type="number" min="30" max="600" value="180" title="生图较慢，默认 180 秒">
                                </div>
                            </div>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🎛 生成行为</div>
                            <div class="form-row two-col">
                                <div>
                                    <label>提示词语言</label>
                                    <select id="img_promptLang">
                                        <option value="zh">中文（国产模型推荐）</option>
                                        <option value="en">英文（海外模型推荐）</option>
                                    </select>
                                </div>
                                <div>
                                    <label>画风补充（附加到每条提示词末尾，可留空）</label>
                                    <input id="img_styleSuffix" type="text" placeholder="例如：电影感光效，高细节，8k 画质">
                                </div>
                            </div>
                            <label class="check-row">
                                <input type="checkbox" id="img_autoGen" checked>
                                <b>正文渲染后自动生成</b><i>关闭则每张插图都需在正文卡点击生成（省钱模式）</i>
                            </label>
                            <div class="form-tip">
                                防护：插图记录随存档保存，重开页面自动回显；图片链接过期或失败可点「↻ 重绘」；回放历史绝不自动生图（防刷新即烧钱）。
                            </div>
                        </div>
                        <div id="img_testResult" class="test-result"></div>
                        <button type="button" class="btn-ghost dw-test-btn" onclick="ConfigModal.testImgConnection()">测试第四接口（生成一张小样图）</button>
                    </div>
                </div>

                <!-- ✍ 提示词工程师：第五接口（润色插图提示词），可折叠分区（v3.10.0） -->
                <div class="dw-config api-card">
                    <div class="dw-config-head api-card-head" id="peSectionHead" onclick="ConfigModal.togglePeSection()">
                        <span class="api-head-left">
                            <span class="dw-config-title">✍ 提示词工程师 · 第五接口</span>
                            <span class="api-role-chip">⑤ 润色插图提示词</span>
                            <span class="api-state-chip" id="pe_stateChip"></span>
                        </span>
                        <span class="dw-caret" id="peCaret">▸</span>
                    </div>
                    <div class="dw-config-body" id="peSectionBody" style="display:none">
                        <div class="form-tip dw-intro">
                            <b>专职提示词扩写</b>：正文写完后，本章全部插图提示词先交由第五模型<b>一次批量扩写</b>（细节 / 镜头语言 / 光影 / 色调 / 画风关键词），再送第四接口生图。改写结果本地缓存（同提示词不重复调用），失败自动回退原始描述，绝不阻断生图。任意对话模型即可胜任，推荐与主笔不同的廉价模型。
                        </div>
                        <label class="check-row">
                            <input type="checkbox" id="pe_enabled">
                            <b>启用提示词工程师</b><i>插图生成前先润色提示词（每章一次批量调用，不影响正文速度）</i>
                        </label>
                        <div class="va-quick-row">
                            <span class="va-quick-tip">快捷复用：</span>
                            <button type="button" class="btn-mini" onclick="ConfigModal.copyMainToPe()">⚡ 同主接口</button>
                            <button type="button" class="btn-mini" onclick="ConfigModal.copyVarToPe()">⚡ 同变量AI</button>
                            <button type="button" class="btn-mini" onclick="ConfigModal.copyImgToPe()">⚡ 同生图接口</button>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🔌 第五接口（文字模型 API）</div>
                            <div class="form-row">
                                <label>AI 厂商（可与主笔不同）</label>
                                <select id="pe_provider" onchange="ConfigModal.onProviderChange('pe')">${providerOptions()}</select>
                                <div class="form-tip provider-tip" id="pe_providerTip"></div>
                            </div>
                            <div class="form-row">
                                <label>API 地址 (Endpoint)</label>
                                <input id="pe_endpoint" type="text" placeholder="例如 https://api.deepseek.com/v1（可与主接口不同）">
                            </div>
                            <div class="form-row">
                                <label>API Key</label>
                                <input id="pe_key" type="password" placeholder="sk-...">
                            </div>
                            <div class="form-row">
                                <label>模型名称 (Model)</label>
                                <div class="model-fetch-row">
                                    <input id="pe_model" type="text" placeholder="可手填，或点右侧「获取」拉取列表">
                                    <button type="button" class="btn-ghost" id="pe_fetchBtn" onclick="ConfigModal.fetchPeModels()">获取</button>
                                </div>
                                ${chipRow("pe")}
                                <select id="pe_modelSelect" class="model-select" style="display:none" onchange="ConfigModal.pickPeModel(this.value)"></select>
                                <div class="form-tip" id="pe_modelHint" style="display:none"></div>
                            </div>
                            <div class="form-row three-col">
                                <div>
                                    <label>最大Tokens</label>
                                    <input id="pe_maxTokens" type="number" value="2048">
                                </div>
                                <div>
                                    <label>温度 (0-2)</label>
                                    <input id="pe_temperature" type="number" step="0.1" min="0" max="2" value="0.7">
                                </div>
                                <div>
                                    <label>超时（秒）</label>
                                    <input id="pe_timeout" type="number" min="30" max="600" value="120" title="默认 120 秒；一次批量改写整章提示词，比单轮对话略长">
                                </div>
                            </div>
                        </div>
                        <div class="form-tip">
                            防护：改写失败 / 输出不合规时自动回退原始描述；改写稿按原始提示词缓存（上限 100 条），重绘与回放零重复调用；插图卡下方可展开查看「实际生图提示词」。
                        </div>
                        <div id="pe_testResult" class="test-result"></div>
                        <button type="button" class="btn-ghost dw-test-btn" onclick="ConfigModal.testPeConnection()">测试第五接口连通</button>
                    </div>
                </div>

                <!-- 📱 手机分身：第六接口（地球开放世界专属，微信消息与朋友圈引擎） -->
                ${this.isEarthGenre() ? `
                <div class="dw-config api-card">
                    <div class="dw-config-head api-card-head" id="phSectionHead" onclick="ConfigModal.togglePhSection()">
                        <span class="api-head-left">
                            <span class="dw-config-title">📱 手机分身 · 第六接口</span>
                            <span class="api-role-chip">⑥ 微信与朋友圈</span>
                            <span class="api-state-chip" id="ph_stateChip"></span>
                        </span>
                        <span class="dw-caret" id="phCaret">▸</span>
                    </div>
                    <div class="dw-config-body" id="phSectionBody" style="display:none">
                        <div class="form-tip dw-intro">
                            <b>社交世界引擎</b>：地球开放世界专属——玩家手机里的微信消息、群聊与朋友圈动态由第六模型运转：联系人们各过各的日子（柴米油盐、转发、寒暄），不围着玩家转；玩家发消息有人按性子回，发朋友圈有人点赞评论。手机动静会回流正文（NPC 见面可提及，因果守恒）。<b>默认复用主笔接口（零配置）</b>，也可独立配置廉价模型。
                        </div>
                        <label class="check-row">
                            <input type="checkbox" id="ph_enabled">
                            <b>启用手机分身</b><i>每 N 轮正文后自动刷新来信与朋友圈；玩家发消息/发圈即时响应</i>
                        </label>
                        <label class="check-row">
                            <input type="checkbox" id="ph_reuseMain">
                            <b>复用主笔接口（推荐）</b><i>零额外配置直接用主笔 AI 运转社交世界；取消勾选则用下方独立配置</i>
                        </label>
                        <div class="va-quick-row">
                            <span class="va-quick-tip">快捷复用：</span>
                            <button type="button" class="btn-mini" onclick="ConfigModal.copyMainToPh()">⚡ 同主接口</button>
                            <button type="button" class="btn-mini" onclick="ConfigModal.copyVarToPh()">⚡ 同变量AI</button>
                            <button type="button" class="btn-mini" onclick="ConfigModal.copyExtraToPh()">⚡ 同额外API</button>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🔌 第六接口（手机分身 API）</div>
                            <div class="form-row">
                                <label>AI 厂商（可与主笔不同）</label>
                                <select id="ph_provider" onchange="ConfigModal.onProviderChange('ph')">${providerOptions()}</select>
                                <div class="form-tip provider-tip" id="ph_providerTip"></div>
                            </div>
                            <div class="form-row">
                                <label>API 地址 (Endpoint)</label>
                                <input id="ph_endpoint" type="text" placeholder="例如 https://api.deepseek.com/v1（可与主接口不同）">
                            </div>
                            <div class="form-row">
                                <label>API Key</label>
                                <input id="ph_key" type="password" placeholder="sk-...">
                            </div>
                            <div class="form-row">
                                <label>模型名称 (Model)</label>
                                <div class="model-fetch-row">
                                    <input id="ph_model" type="text" placeholder="可手填，或点右侧「获取」拉取列表">
                                    <button type="button" class="btn-ghost" id="ph_fetchBtn" onclick="ConfigModal.fetchPhModels()">获取</button>
                                </div>
                                ${chipRow("ph")}
                                <select id="ph_modelSelect" class="model-select" style="display:none" onchange="ConfigModal.pickPhModel(this.value)"></select>
                                <div class="form-tip" id="ph_modelHint" style="display:none"></div>
                            </div>
                            <div class="form-row three-col">
                                <div>
                                    <label>最大Tokens</label>
                                    <input id="ph_maxTokens" type="number" value="4096">
                                </div>
                                <div>
                                    <label>温度 (0-2)</label>
                                    <input id="ph_temperature" type="number" step="0.1" min="0" max="2" value="0.9">
                                </div>
                                <div>
                                    <label>超时（秒）</label>
                                    <input id="ph_timeout" type="number" min="30" max="600" value="60">
                                </div>
                            </div>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🎛 刷新行为</div>
                            <div class="form-row">
                                <label>自动刷新间隔（每 N 轮正文）</label>
                                <input id="ph_interval" type="number" min="1" max="20" value="3">
                                <div class="form-tip">手机动静刷新频率——每轮都刷太吵，建议 2-4 轮一次；玩家主动发消息/发圈不受此限。</div>
                            </div>
                            <label class="check-row">
                                <input type="checkbox" id="ph_useKnowledge" checked>
                                <b>读取知识库</b><i>来信、朋友圈与聊天回复贴合知识库里的世界观、人物与地点设定（常驻+按需检索注入）</i>
                            </label>
                            <label class="check-row">
                                <input type="checkbox" id="ph_autoReact" checked>
                                <b>发圈自动反应</b><i>玩家发朋友圈后，联系人们按性子点赞评论；关闭则只有玩家单方面的记录</i>
                            </label>
                            <div class="form-tip">
                                时代即边界：1983 年前没有手机（悬浮球不出现）；1999-2010 为 QQ/QQ空间；2011 起为微信/朋友圈——用语与习惯按年代自动校准。手机数据（联系人/聊天/朋友圈）随存档保存。
                            </div>
                        </div>
                        <div id="ph_testResult" class="test-result"></div>
                        <button type="button" class="btn-ghost dw-test-btn" onclick="ConfigModal.testPhConnection()">测试第六接口连通</button>
                    </div>
                </div>` : ""}

                <!-- 🎨 主题工坊（v3.53.0）：阅读外观，与 33 界皮肤叠加而不冲突 -->
                <div class="dw-config api-card">
                    <div class="dw-config-head api-card-head" id="thSectionHead" onclick="ConfigModal.toggleThemeSection()">
                        <span class="api-head-left">
                            <span class="dw-config-title">🎨 主题工坊 · 阅读外观</span>
                            <span class="api-role-chip">全局生效</span>
                            <span class="api-state-chip" id="th_stateChip"></span>
                        </span>
                        <span class="dw-caret" id="thCaret">▸</span>
                    </div>
                    <div class="dw-config-body" id="thSectionBody" style="display:none">
                        <div class="form-tip dw-intro">
                            33 界皮肤决定「世界是什么味道」，这里决定「这本书怎么读」——字体、行高、卡片质感、明暗对比。内置 6 套，也可以导入自己调好的主题包；<b>「跟随世界」保持原样，什么都不改</b>。
                        </div>
                        <div id="themePanelHost"></div>
                    </div>
                </div>

                <!-- 🗄 保险箱（v3.53.0）：存档 / 配置 / 整机 导入导出 -->
                <div class="dw-config api-card">
                    <div class="dw-config-head api-card-head" id="vtSectionHead" onclick="ConfigModal.toggleVaultSection()">
                        <span class="api-head-left">
                            <span class="dw-config-title">🗄 保险箱 · 存档与配置搬家</span>
                            <span class="api-role-chip">全局生效</span>
                            <span class="api-state-chip" id="vt_stateChip"></span>
                        </span>
                        <span class="dw-caret" id="vtCaret">▸</span>
                    </div>
                    <div class="dw-config-body" id="vtSectionBody" style="display:none">
                        <div id="vaultPanelHost"></div>
                    </div>
                </div>

                <!-- 🧠 向量增强检索（v3.51.1）：世界书召回增强，接口与模型全自定义 -->
                <div class="dw-config api-card">
                    <div class="dw-config-head api-card-head" id="vecSectionHead" onclick="ConfigModal.toggleVecSection()">
                        <span class="api-head-left">
                            <span class="dw-config-title">🧠 向量增强检索 · 世界书召回</span>
                            <span class="api-role-chip">可选</span>
                            <span class="api-state-chip" id="vec_stateChip"></span>
                        </span>
                        <span class="dw-caret" id="vecCaret">▸</span>
                    </div>
                    <div class="dw-config-body" id="vecSectionBody" style="display:none">
                        <div class="form-tip dw-intro">
                            世界书默认用 <b>BM25 关键词召回</b>，已经能用。开启这里后多一层语义召回：先取候选，再用向量找「意思相近」的条目，最后用重排模型打分。<b>完全可选</b>——不填也能正常写作；填错、超时、服务商不支持，都会自动退回 BM25，不阻断正文。
                        </div>
                        <div id="vecPanelHost"></div>
                    </div>
                </div>

                <!-- 🔞 内容尺度与文学分级（v3.47.15）：全局生效，非接口配置 -->
                <div class="dw-config api-card">
                    <div class="dw-config-head api-card-head" id="csSectionHead" onclick="ConfigModal.toggleCSSection()">
                        <span class="api-head-left">
                            <span class="dw-config-title">🔞 内容尺度 · 文学分级</span>
                            <span class="api-role-chip">全局生效</span>
                            <span class="api-state-chip" id="cs_stateChip"></span>
                        </span>
                        <span class="dw-caret" id="csCaret">▸</span>
                    </div>
                    <div class="dw-config-body" id="csSectionBody" style="display:none">
                        <div class="form-tip dw-intro">
                            决定"亲密与残酷写到什么程度"。这一档会随每一轮请求注入系统提示词，让模型稳定执行，而不是每轮随机自我审查成干瘪段落。<b>无论选哪一档，五条硬底线始终生效</b>（见下方）。
                        </div>
                        <div class="cs-level-row" id="csLevelRow"></div>
                        <div class="cs-confirm-box" id="csConfirmBox" style="display:none">
                            <label class="check-row">
                                <input type="checkbox" id="cs_adultConfirm">
                                <b>我确认已满 18 周岁，且理解成人向内容仅用于虚构文学创作</b>
                                <i>勾选后方可选择「成人向」「极致」两档</i>
                            </label>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">⛓ 破限（决定"写不写"，与尺度档位互不替代）</div>
                            <label class="check-row">
                                <input type="checkbox" id="cs_breakLimit" onchange="ConfigModal.toggleBreakLimit(this.checked)">
                                <b>破限模式：不因题材敏感而拒写、切黑、加免责声明</b>
                                <i>极端题材 / 道德灰暗 / 禁忌关系；未成年人、真实人物、违法操作指南三条底线仍保留</i>
                            </label>
                            <div class="form-tip">尺度档管"写到什么程度"，破限管"写不写"。开启后提示词层会明确要求模型不再自我审查，同时成人向状态字段组一并解锁（状态栏 ⚙ 设置里可关）。</div>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🛡 硬底线（全档共享，不可关闭）</div>
                            <div class="form-tip cs-limits" id="csLimits"></div>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">📄 当前注入全文（预览）</div>
                            <textarea id="csPreview" rows="6" readonly></textarea>
                            <div class="form-tip">这段文字每轮都会追加到系统提示词末尾；切换档位即时更新。</div>
                        </div>
                    </div>
                <!-- 📕 云起预设（v3.55.5）：云境原创内置预设，全局生效 -->
                <div class="dw-config api-card">
                    <div class="dw-config-head api-card-head" id="mmSectionHead" onclick="ConfigModal.toggleMMSection()">
                        <span class="api-head-left">
                            <span class="dw-config-title">📕 云起预设 · 破限与文风</span>
                            <span class="api-role-chip">全局生效</span>
                            <span class="api-state-chip" id="mm_stateChip"></span>
                        </span>
                        <span class="dw-caret" id="mmCaret">▸</span>
                    </div>
                    <div class="dw-config-body" id="mmSectionBody" style="display:none">
                        <div class="form-tip dw-intro">
                            云境工坊原创内置预设（SillyTavern 兼容格式，全部提示词独立撰写）。启用后每轮把整份预设渲染进系统提示词——<b>破限三档、防截断、防空回、防频控、文风体系、NSFW 分级、数据清洗、状态栏、行动选项、NPC 小剧场、剧情记忆归档</b>随开关生效。世界文风已按云境的 33 个世界各写一套本土档位，随你开局选的文风自动选用；也可从外部导入任意 SillyTavern 预设整份替换。
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">📦 当前预设 <span class="api-role-chip" id="mmPresetChip"></span></div>
                            <div class="form-tip" id="mmPresetInfo"></div>
                            <div class="mm-toolbar">
                                <button type="button" class="btn-ghost" onclick="ConfigModal.mmImportPreset()">📥 导入预设 JSON</button>
                                <button type="button" class="btn-ghost" onclick="ConfigModal.mmUseBuiltinPreset()">↺ 恢复内置预设</button>
                                <button type="button" class="btn-ghost" onclick="ConfigModal.mmExportPreset()">⤓ 导出当前预设</button>
                            </div>
                            <input type="file" id="mmPresetFile" accept=".json,application/json" style="display:none" onchange="ConfigModal.mmPresetFilePicked(this)">
                            <div class="form-tip">
                                支持 SillyTavern 预设导出（<code>prompts</code> + <code>prompt_order</code>）与云境自有格式。
                                导入后整份替换内置预设，旧的逐条开关会自动清空；随时可一键恢复内置。
                            </div>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">☁ 云端同步 · 云起预设 <span class="api-role-chip" id="yqSyncChip"></span></div>
                            <div class="form-tip" id="yqSyncTip"></div>
                            <div class="mm-toolbar">
                                <button type="button" class="btn-ghost" onclick="ConfigModal.yqSyncCheck()">🔍 检查更新</button>
                                <button type="button" class="btn-ghost" onclick="ConfigModal.yqSyncPull()">⬇ 同步最新版</button>
                                <button type="button" class="btn-ghost" onclick="ConfigModal.yqSyncRepo()">⚙ 仓库</button>
                            </div>
                            <div class="form-tip">
                                预设更新后<b>不用再重新导入</b> —— 点「同步」直接从 GitHub 仓库拉最新一份云起预设与正则，
                                本机这份被整份替换（旧的逐块修改作废）。已是最新就不下载全量，只花几百字节比版本。
                            </div>
                        </div>
                        <div class="dw-subgroup">
                            <label class="check-row">
                                <input type="checkbox" id="mm_enabled" onchange="ConfigModal.toggleMiaomiao(this.checked)">
                                <b>启用云起预设</b>
                                <i>关闭时完全不影响现有流程（零开销）</i>
                            </label>
                        </div>
                        <div class="dw-subgroup">
                            <label class="check-row">
                                <input type="checkbox" id="mm_regexEnabled" onchange="ConfigModal.toggleMiaomiaoRegexAll(this.checked)">
                                <b>启用云起正则</b>
                                <i>ver 7.2：协议块变卡片 + 去 AI 腔。关掉只停清理，协议块仍会被收口</i>
                            </label>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🎨 本世界文风（随开局所选档位自动匹配）</div>
                            <div class="form-tip" id="mm_styleInfo"></div>
                            <select id="mm_stylePick" onchange="ConfigModal.pickMiaomiaoStyle(this.value)"></select>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🔧 逐条开关 · 预设条目 <span id="mmBlockCount"></span></div>
                            <div class="form-tip">
                                预设全部条目都在这里，想开哪条开哪条。改动即时生效并保存在本机浏览器。
                                预设自身按"多选一 / 二选一 / 三选一"设计，同类的请只留一个开着，否则后写的会覆盖先写的。
                            </div>
                            <div class="mm-toolbar">
                                <input type="text" id="mmSearch" placeholder="🔍 搜索条目名（如：破甲 / 防截断 / 文风）" oninput="ConfigModal.renderMMFilter()">
                                <button type="button" class="btn-ghost" onclick="ConfigModal.mmExpandAll(true)">全部展开</button>
                                <button type="button" class="btn-ghost" onclick="ConfigModal.mmExpandAll(false)">全部折叠</button>
                                <button type="button" class="btn-ghost" onclick="ConfigModal.mmResetOverrides()">恢复默认</button>
                            </div>
                            <div id="mm_blockList" class="mm-block-list"></div>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">🧹 逐条开关 · 云起正则 <span id="mmRegexCount"></span></div>
                            <div class="form-tip">
                                共 30 条（云境原创）：把 AI 输出的协议块渲染成折叠卡片（或按需剥离），
                                清理"不由自主地 / 指节泛白 / 像一只受惊的小鹿"这类 AI 腔，
                                以及 14 条「云起·XX美化」——开场白/状态栏/好感度/内心话/世界报告/记忆归档/行动选项
                                等功能的专属美化（关闭即回退朴素显示）。
                            </div>
                            <div class="mm-toolbar">
                                <button type="button" class="btn-ghost" onclick="ConfigModal.mmImportRegex()">📥 导入正则 JSON</button>
                                <button type="button" class="btn-ghost" onclick="ConfigModal.mmUseBuiltinRegex()">↺ 恢复内置正则</button>
                                <button type="button" class="btn-ghost" onclick="ConfigModal.mmExportRegex()">⤓ 导出当前正则</button>
                            </div>
                            <input type="file" id="mmRegexFile" accept=".json,application/json" style="display:none" onchange="ConfigModal.mmRegexFilePicked(this)">
                            <div class="form-tip" id="mmRegexSource"></div>
                            <div id="mm_regexList" class="mm-block-list"></div>
                        </div>
                        <div class="dw-subgroup">
                            <div class="dw-sub-title">📄 当前注入全文（预览）</div>
                            <textarea id="mmPreview" rows="8" readonly></textarea>
                            <div class="form-tip" id="mmPreviewTip"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="ConfigModal.testConnection()">测试主接口</button>
                <button class="btn-ghost" onclick="ConfigModal.close()">取消</button>
                <button class="btn-solid" onclick="ConfigModal.save()">保存全部配置</button>
            </div>
        </div>`;
  },
  bindEvents(modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) this.close();
    });
    document.getElementById("cfg_provider").addEventListener("change", () => this.onProviderChange("cfg"));
    document.getElementById("dw_provider").addEventListener("change", () => this.onProviderChange("dw"));
    document.getElementById("va_provider").addEventListener("change", () => this.onProviderChange("va"));
    document.getElementById("img_provider").addEventListener("change", () => this.onImgProviderChange());
    const csCb = document.getElementById("cs_adultConfirm");
    if (csCb) {
      csCb.addEventListener("change", () => {
        if (csCb.checked && window.MoContentScale) {
          window.MoContentScale.confirmAdult();
          this.renderCSSection();
        }
      });
    }
    modal.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest(".model-chip");
      if (!btn) return;
      const model = btn.getAttribute("data-model") || "";
      if (!model) return;
      const prefix = btn.getAttribute("data-prefix");
      if (prefix) this.pickQuickModel(prefix, model);
      else this.pickQuickImgModel(model);
    });
  },
  /** HTML 转义（v3.18.1：模型名等外部数据进 DOM 前统一转义） */
  esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  },
  /* ==================== 🏭 厂商体系（v1.6.4：每家细分） ==================== */
  /** 按 id 取厂商定义（未知 id 回落自定义 OpenAI 兼容） */
  providerById(id) {
    return this.PROVIDERS.find((p) => p.id === id) || this.PROVIDERS.find((p) => p.id === "custom-openai");
  },
  /** 当前表单选中的厂商（prefix：cfg / dw / va） */
  currentProvider(prefix) {
    const sel = document.getElementById(prefix + "_provider");
    return this.providerById(sel ? sel.value : "");
  },
  /** 当前表单的运行时协议（openai / gemini，由厂商派生） */
  currentType(prefix) {
    return this.currentProvider(prefix).type;
  },
  /** 由已存配置识别厂商：优先 provider 字段，其次按地址匹配，最后按协议回落自定义 */
  detectProvider(cfg) {
    cfg = cfg || {};
    if (cfg.provider && this.PROVIDERS.some((p) => p.id === cfg.provider)) return cfg.provider;
    const norm = (u) => String(u || "").replace(/\/+$/, "").toLowerCase();
    const ep = norm(cfg.endpoint);
    if (ep) {
      for (const p of this.PROVIDERS) {
        const pe = norm(p.endpoint);
        if (pe && (ep === pe || ep.startsWith(pe + "/") || ep.startsWith(pe))) return p.id;
      }
    }
    return cfg.type === "gemini" ? "custom-gemini" : "custom-openai";
  },
  /** 用户切换厂商：自动填地址（官方直连厂商）+ 清空旧模型列表 + 刷新提示与快捷模型 */
  onProviderChange(prefix) {
    const p = this.currentProvider(prefix);
    if (p.endpoint) {
      document.getElementById(prefix + "_endpoint").value = p.endpoint;
    }
    if (prefix === "cfg") this.resetModelList();
    if (prefix === "dw") this.resetExtraModelList();
    if (prefix === "va") this.resetVarModelList();
    if (prefix === "pe") this.resetPeModelList();
    if (prefix === "ph") this.resetPhModelList();
    this.updateProviderUI(prefix);
    this.refreshApiCardStates();
  },
  /** 刷新厂商提示条 + 常见模型快捷按钮（fillForm 恢复 / 切换厂商共用；不覆盖已填地址） */
  updateProviderUI(prefix) {
    const p = this.currentProvider(prefix);
    const tip = document.getElementById(prefix + "_providerTip");
    if (tip) {
      tip.textContent = `协议：${p.type === "gemini" ? "Gemini 原生" : "OpenAI 兼容"} · ${p.tip}`;
    }
    const chips = document.getElementById(prefix + "_modelChips");
    if (chips) {
      chips.innerHTML = (p.models || []).map(
        (m) => `<button type="button" class="model-chip" data-prefix="${this.esc(prefix)}" data-model="${this.esc(m)}" title="点击填入模型名">${this.esc(m)}</button>`
      ).join("");
    }
  },
  /** 快捷模型按钮 → 填入模型输入框 */
  pickQuickModel(prefix, model) {
    document.getElementById(prefix + "_model").value = model;
    this.refreshApiCardStates();
  },
  /* ==================== ✍ 主笔（第一接口）分区 ==================== */
  /** 折叠 / 展开「保险箱」 */
  toggleVaultSection() {
    const body = document.getElementById("vtSectionBody");
    const caret = document.getElementById("vtCaret");
    if (!body) return;
    const open = body.style.display === "none";
    body.style.display = open ? "block" : "none";
    if (caret) caret.textContent = open ? "▾" : "▸";
    if (open) this.renderVaultSection();
  },
  renderVaultSection() {
    const host = document.getElementById("vaultPanelHost");
    const chip = document.getElementById("vt_stateChip");
    if (host && window.YunjingVault) host.innerHTML = window.YunjingVault.panelHTML();
    if (chip && window.YunjingVault) {
      const s = window.YunjingVault.stats();
      chip.textContent = `${s.saves} 档 · ${s.cfg} 项配置`;
    }
  },
  /** 折叠 / 展开「主题工坊」 */
  toggleThemeSection() {
    const body = document.getElementById("thSectionBody");
    const caret = document.getElementById("thCaret");
    if (!body) return;
    const open = body.style.display === "none";
    body.style.display = open ? "block" : "none";
    if (caret) caret.textContent = open ? "▾" : "▸";
    if (open) this.renderThemeSection();
  },
  /** 渲染主题工坊（内嵌版，与独立弹窗共用同一份数据） */
  renderThemeSection() {
    const host = document.getElementById("themePanelHost");
    const chip = document.getElementById("th_stateChip");
    const t = window.ThemeStudio && window.ThemeStudio.current ? window.ThemeStudio.current() : null;
    if (chip) chip.textContent = t ? t.icon + " " + t.name : "—";
    if (host && window.ThemeStudio) host.innerHTML = window.ThemeStudio.panelHTML();
  },
  /** ThemeStudio 切换主题后回调（保持内嵌面板同步） */
  refreshThemeSection() {
    const host = document.getElementById("themePanelHost");
    if (host && host.offsetParent !== null) this.renderThemeSection();
    else {
      const chip = document.getElementById("th_stateChip");
      const t = window.ThemeStudio && window.ThemeStudio.current ? window.ThemeStudio.current() : null;
      if (chip && t) chip.textContent = t.icon + " " + t.name;
    }
  },
  /** 折叠 / 展开「向量增强检索」 */
  toggleVecSection() {
    const body = document.getElementById("vecSectionBody");
    const caret = document.getElementById("vecCaret");
    if (!body) return;
    const open = body.style.display === "none";
    body.style.display = open ? "block" : "none";
    if (caret) caret.textContent = open ? "▾" : "▸";
  },
  /** 渲染向量检索面板（每次打开设置都按最新配置重建） */
  renderVecSection() {
    const host = document.getElementById("vecPanelHost");
    if (host && window.KBVector) host.innerHTML = window.KBVector.buildPanelHTML("cfgVec", { flat: true });
  },

  /** 折叠 / 展开「主笔 AI」配置区 */
  toggleMainSection() {
    const body = document.getElementById("cfgSectionBody");
    const caret = document.getElementById("cfgCaret");
    if (!body) return;
    const open = body.style.display === "none";
    body.style.display = open ? "block" : "none";
    if (caret) caret.textContent = open ? "▾" : "▸";
  },
  /** 刷新三张接口卡的就绪状态徽标（打开弹窗 / 预设 / 复用后调用） */
  refreshApiCardStates() {
    var _a, _b, _c, _d, _e;
    const set = (id, text, cls) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.className = "api-state-chip " + cls;
    };
    const m = this.readForm();
    const mReady = !!(m.endpoint && m.apiKey && m.model);
    set("cfg_stateChip", mReady ? "✓ 已就绪" : "未配置", mReady ? "ok" : "off");
    const dwEnabled = (_a = document.getElementById("dw_enabled")) == null ? void 0 : _a.checked;
    const d = this.readDynamicWorldForm().extra;
    const dReady = !!(d.endpoint && d.apiKey && d.model);
    set("dw_stateChip", !dwEnabled ? "未启用" : dReady ? "✓ 已就绪" : "启用但未配全", !dwEnabled ? "off" : dReady ? "ok" : "warn");
    const vaEnabled = (_b = document.getElementById("va_enabled")) == null ? void 0 : _b.checked;
    const v = this.readVarAIForm();
    const vReady = !!(v.endpoint && v.apiKey && v.model);
    set("va_stateChip", !vaEnabled ? "未启用" : vReady ? "✓ 已就绪" : "启用但未配全", !vaEnabled ? "off" : vReady ? "ok" : "warn");
    const igEnabled = (_c = document.getElementById("img_enabled")) == null ? void 0 : _c.checked;
    const ic = document.getElementById("img_endpoint") ? this.readImgForm().api : {};
    const icReady = !!(ic.endpoint && ic.apiKey && ic.model);
    set("img_stateChip", !igEnabled ? "未启用" : icReady ? "✓ 已就绪" : "启用但未配全", !igEnabled ? "off" : icReady ? "ok" : "warn");
    const peEnabled = (_d = document.getElementById("pe_enabled")) == null ? void 0 : _d.checked;
    const pc = document.getElementById("pe_endpoint") ? this.readPeForm() : {};
    const pcReady = !!(pc.endpoint && pc.apiKey && pc.model);
    set("pe_stateChip", !peEnabled ? "未启用" : pcReady ? "✓ 已就绪" : "启用但未配全", !peEnabled ? "off" : pcReady ? "ok" : "warn");
    if (document.getElementById("vec_stateChip")) {
      const vc = window.KBVector ? window.KBVector.load() : null;
      const vReady = !!(vc && vc.enabled && vc.apiKey && vc.embedModel);
      set("vec_stateChip", !vc || !vc.enabled ? "未启用" : vReady ? "✓ 已就绪" : "启用但未配全", !vc || !vc.enabled ? "off" : vReady ? "ok" : "warn");
    }
    if (document.getElementById("ph_stateChip")) {
      const phEnabled = (_e = document.getElementById("ph_enabled")) == null ? void 0 : _e.checked;
      const pa = document.getElementById("ph_endpoint") ? this.readPhForm().api : {};
      const phReuse = pa.reuseMain !== false;
      const phReady = phReuse ? !!(m.endpoint && m.apiKey && m.model) : !!(pa.endpoint && pa.apiKey && pa.model);
      set(
        "ph_stateChip",
        !phEnabled ? "未启用" : phReady ? "✓ 已就绪" : phReuse ? "复用主笔(未配置)" : "启用但未配全",
        !phEnabled ? "off" : phReady ? "ok" : "warn"
      );
    }
  },
  /** 快捷复用：把主接口连接配置填入动态世界表单 */
  copyMainToExtra() {
    var _a;
    document.getElementById("dw_provider").value = document.getElementById("cfg_provider").value;
    document.getElementById("dw_endpoint").value = document.getElementById("cfg_endpoint").value;
    document.getElementById("dw_key").value = document.getElementById("cfg_key").value;
    document.getElementById("dw_model").value = document.getElementById("cfg_model").value;
    this.updateProviderUI("dw");
    this.resetExtraModelList();
    (_a = window.showToast) == null ? void 0 : _a.call(window, "已把主接口配置填入动态世界（建议换个便宜模型省费用）", "info");
    this.refreshApiCardStates();
  },
  /** 快捷复用：把变量AI（第三接口）配置填入动态世界表单 */
  copyVarToExtra() {
    var _a, _b, _c, _d;
    const c = ((_b = (_a = window.VariableAI) == null ? void 0 : _a.get) == null ? void 0 : _b.call(_a)) || {};
    if (!(c.endpoint && c.apiKey)) {
      (_c = window.showToast) == null ? void 0 : _c.call(window, "变量AI尚未配置完整，无法复用", "error");
      return;
    }
    document.getElementById("dw_provider").value = this.detectProvider(c);
    document.getElementById("dw_endpoint").value = c.endpoint || "";
    document.getElementById("dw_key").value = c.apiKey || "";
    document.getElementById("dw_model").value = c.model || "";
    this.updateProviderUI("dw");
    this.resetExtraModelList();
    (_d = window.showToast) == null ? void 0 : _d.call(window, "已复用变量AI配置（动态世界与状态登记共用同一模型）", "info");
    this.refreshApiCardStates();
  },
  /* ==================== 🌍 动态世界（额外 API）分区 ==================== */
  /** 折叠 / 展开「动态世界」配置区 */
  toggleDWSection() {
    const body = document.getElementById("dwSectionBody");
    const caret = document.getElementById("dwCaret");
    if (!body) return;
    const open = body.style.display === "none";
    body.style.display = open ? "block" : "none";
    if (caret) caret.textContent = open ? "▾" : "▸";
  },
  /** 动态世界：额外 API 表单填充 */
  /** 温度读取：NaN 回默认、clamp 到 [0,2]；0 是合法值（低温强指令跟随），不得被 || 吞掉 */
  clampTemp(v, dft) {
    const n = parseFloat(v);
    if (isNaN(n)) return dft;
    return Math.min(2, Math.max(0, n));
  },
  fillDynamicWorldForm() {
    var _a, _b;
    const dw = window.DynamicWorld;
    if (!dw) return;
    const extra = dw.getExtraApi();
    const set = dw.getSettings();
    document.getElementById("dw_provider").value = this.detectProvider(extra);
    document.getElementById("dw_endpoint").value = extra.endpoint || "";
    document.getElementById("dw_key").value = extra.apiKey || "";
    document.getElementById("dw_model").value = extra.model || "";
    document.getElementById("dw_maxTokens").value = extra.maxTokens || 8192;
    document.getElementById("dw_temperature").value = (_a = extra.temperature) != null ? _a : 0.95;
    document.getElementById("dw_timeout").value = extra.timeout || 90;
    this.updateProviderUI("dw");
    document.getElementById("dw_enabled").checked = !!set.enabled;
    document.getElementById("dw_interval").value = set.interval || 5;
    document.getElementById("dw_historyDepth").value = (_b = set.historyDepth) != null ? _b : 5;
    document.getElementById("dw_minWords").value = set.minWords || 200;
    document.getElementById("dw_showReasoning").checked = set.showReasoning !== false;
    document.getElementById("dw_useKnowledge").checked = set.useKnowledge !== false;
    document.getElementById("dw_prompt").value = set.prompt || "";
  },
  /** 动态世界：读取表单（第二接口 + 生成行为） */
  readDynamicWorldForm() {
    const clamp = (v, min, max, dft) => {
      const n = parseInt(v);
      return isNaN(n) ? dft : Math.min(max, Math.max(min, n));
    };
    return {
      extra: {
        provider: document.getElementById("dw_provider").value,
        type: this.currentType("dw"),
        endpoint: document.getElementById("dw_endpoint").value.trim(),
        apiKey: document.getElementById("dw_key").value.trim(),
        model: document.getElementById("dw_model").value.trim(),
        maxTokens: clamp(document.getElementById("dw_maxTokens").value, 256, 131072, 8192),
        temperature: this.clampTemp(document.getElementById("dw_temperature").value, 0.95),
        timeout: clamp(document.getElementById("dw_timeout").value, 30, 600, 90)
      },
      settings: {
        enabled: document.getElementById("dw_enabled").checked,
        interval: clamp(document.getElementById("dw_interval").value, 1, 20, 5),
        historyDepth: clamp(document.getElementById("dw_historyDepth").value, 0, 20, 5),
        minWords: clamp(document.getElementById("dw_minWords").value, 50, 2e3, 200),
        showReasoning: document.getElementById("dw_showReasoning").checked,
        useKnowledge: document.getElementById("dw_useKnowledge").checked,
        prompt: document.getElementById("dw_prompt").value.trim()
      }
    };
  },
  /** 第二接口：拉取模型列表 */
  async fetchExtraModels() {
    const { extra } = this.readDynamicWorldForm();
    const btn = document.getElementById("dw_fetchBtn");
    const hint = document.getElementById("dw_modelHint");
    if (!extra.endpoint || !extra.apiKey) {
      hint.style.display = "block";
      hint.textContent = "✕ 请先填写额外 API 地址与 API Key，再获取模型列表";
      hint.style.color = "var(--danger)";
      return;
    }
    btn.disabled = true;
    btn.textContent = "获取中…";
    try {
      const models = await window.DynamicWorld.fetchModels(extra);
      if (!models.length) throw new Error("接口未返回任何模型（可能不支持列表查询，请手填模型名）");
      this.displayExtraModels(models);
    } catch (err) {
      hint.style.display = "block";
      hint.style.color = "var(--danger)";
      hint.textContent = `✕ ${err.message}（可检查地址是否需含 /v1，或直接手填模型名）`;
    } finally {
      btn.disabled = false;
      btn.textContent = "获取";
    }
  },
  /** 第二接口：渲染模型下拉 */
  displayExtraModels(models) {
    const select = document.getElementById("dw_modelSelect");
    const hint = document.getElementById("dw_modelHint");
    const current = document.getElementById("dw_model").value.trim();
    select.innerHTML = "";
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      if (m === current) opt.selected = true;
      select.appendChild(opt);
    }
    if (!current && models.length) {
      select.value = models[0];
      document.getElementById("dw_model").value = models[0];
    }
    select.style.display = "block";
    hint.style.display = "block";
    hint.style.color = "var(--ok)";
    hint.textContent = `✓ 已获取 ${models.length} 个模型，从下拉中选择即可（也可继续手填）`;
  },
  /** 第二接口：下拉选中 → 同步输入框 */
  pickExtraModel(v) {
    document.getElementById("dw_model").value = v;
  },
  resetExtraModelList() {
    const select = document.getElementById("dw_modelSelect");
    const hint = document.getElementById("dw_modelHint");
    if (select) {
      select.innerHTML = "";
      select.style.display = "none";
    }
    if (hint) {
      hint.style.display = "none";
      hint.textContent = "";
    }
  },
  /** 恢复工坊默认动态世界提示词（填入输入框，可再修改） */
  resetDWPrompt() {
    const dw = window.DynamicWorld;
    if (!dw) return;
    document.getElementById("dw_prompt").value = dw.getPromptDefault();
    window.showToast("已填入工坊默认提示词，保存后生效", "info");
  },
  /** 第二接口：连通测试（用表单当前值，无需先保存） */
  async testExtraConnection() {
    const dw = window.DynamicWorld;
    const result = document.getElementById("dw_testResult");
    if (!dw || !result) return;
    const { extra } = this.readDynamicWorldForm();
    if (!(extra.endpoint && extra.apiKey && extra.model)) {
      result.className = "test-result error";
      result.textContent = "✕ 请先填写额外 API 的地址 / Key / 模型名";
      return;
    }
    result.className = "test-result loading";
    result.textContent = "⏳ 正在测试第二接口…";
    try {
      const reply = await dw.testExtraApi(extra);
      result.className = "test-result success";
      result.textContent = `✓ 第二接口连接成功，模型回复：${String(reply).slice(0, 40)}`;
    } catch (err) {
      result.className = "test-result error";
      result.textContent = `✕ ${err.message}`;
    }
  },
  /* ==================== 🧾 变量AI（第三接口）分区 ==================== */
  /** 折叠 / 展开「变量AI」配置区 */
  toggleVASection() {
    const body = document.getElementById("vaSectionBody");
    const caret = document.getElementById("vaCaret");
    if (!body) return;
    const open = body.style.display === "none";
    body.style.display = open ? "block" : "none";
    if (caret) caret.textContent = open ? "▾" : "▸";
  },
  /** 变量AI 表单填充 */
  fillVarAIForm() {
    var _a;
    const va = window.VariableAI;
    if (!va) return;
    const c = va.get();
    document.getElementById("va_provider").value = this.detectProvider(c);
    document.getElementById("va_endpoint").value = c.endpoint || "";
    document.getElementById("va_key").value = c.apiKey || "";
    document.getElementById("va_model").value = c.model || "";
    document.getElementById("va_maxTokens").value = c.maxTokens || 4096;
    document.getElementById("va_temperature").value = (_a = c.temperature) != null ? _a : 0.2;
    document.getElementById("va_timeout").value = c.timeout || 90;
    this.updateProviderUI("va");
    document.getElementById("va_enabled").checked = !!c.enabled;
    document.getElementById("va_showCard").checked = !!c.showCard;
    document.getElementById("va_fallbackMain").checked = c.fallbackMain !== false;
  },
  /** 变量AI 读取表单 */
  readVarAIForm() {
    const clamp = (v, min, max, dft) => {
      const n = parseInt(v);
      return isNaN(n) ? dft : Math.min(max, Math.max(min, n));
    };
    return {
      provider: document.getElementById("va_provider").value,
      type: this.currentType("va"),
      endpoint: document.getElementById("va_endpoint").value.trim(),
      apiKey: document.getElementById("va_key").value.trim(),
      model: document.getElementById("va_model").value.trim(),
      maxTokens: clamp(document.getElementById("va_maxTokens").value, 256, 131072, 4096),
      temperature: this.clampTemp(document.getElementById("va_temperature").value, 0.2),
      timeout: clamp(document.getElementById("va_timeout").value, 30, 600, 90),
      enabled: document.getElementById("va_enabled").checked,
      showCard: document.getElementById("va_showCard").checked,
      fallbackMain: document.getElementById("va_fallbackMain").checked
      // v3.27.6
    };
  },
  /** 第三接口：拉取模型列表 */
  async fetchVarModels() {
    const va = window.VariableAI;
    const cfg = this.readVarAIForm();
    const btn = document.getElementById("va_fetchBtn");
    const hint = document.getElementById("va_modelHint");
    if (!(cfg.endpoint && cfg.apiKey)) {
      hint.style.display = "block";
      hint.textContent = "✕ 请先填写变量AI地址与 API Key，再获取模型列表";
      hint.style.color = "var(--danger)";
      return;
    }
    btn.disabled = true;
    btn.textContent = "获取中…";
    try {
      const models = await va.fetchModels(cfg);
      if (!models.length) throw new Error("接口未返回任何模型（可能不支持列表查询，请手填模型名）");
      this.displayVarModels(models);
    } catch (err) {
      hint.style.display = "block";
      hint.style.color = "var(--danger)";
      hint.textContent = `✕ ${err.message}（可检查地址是否需含 /v1，或直接手填模型名）`;
    } finally {
      btn.disabled = false;
      btn.textContent = "获取";
    }
  },
  /** 第三接口：渲染模型下拉 */
  displayVarModels(models) {
    const select = document.getElementById("va_modelSelect");
    const hint = document.getElementById("va_modelHint");
    const current = document.getElementById("va_model").value.trim();
    select.innerHTML = "";
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      if (m === current) opt.selected = true;
      select.appendChild(opt);
    }
    if (!current && models.length) {
      select.value = models[0];
      document.getElementById("va_model").value = models[0];
    }
    select.style.display = "block";
    hint.style.display = "block";
    hint.style.color = "var(--ok)";
    hint.textContent = `✓ 已获取 ${models.length} 个模型，从下拉中选择即可（也可继续手填）`;
  },
  /** 第三接口：下拉选中 → 同步输入框 */
  pickVarModel(v) {
    document.getElementById("va_model").value = v;
  },
  resetVarModelList() {
    const select = document.getElementById("va_modelSelect");
    const hint = document.getElementById("va_modelHint");
    if (select) {
      select.innerHTML = "";
      select.style.display = "none";
    }
    if (hint) {
      hint.style.display = "none";
      hint.textContent = "";
    }
  },
  /** 快捷复用：把主接口配置填入变量AI表单 */
  copyMainToVar() {
    var _a;
    document.getElementById("va_provider").value = document.getElementById("cfg_provider").value;
    document.getElementById("va_endpoint").value = document.getElementById("cfg_endpoint").value;
    document.getElementById("va_key").value = document.getElementById("cfg_key").value;
    document.getElementById("va_model").value = document.getElementById("cfg_model").value;
    this.updateProviderUI("va");
    this.resetVarModelList();
    (_a = window.showToast) == null ? void 0 : _a.call(window, "已把主接口配置填入变量AI（建议再换个便宜模型以省费用）", "info");
    this.refreshApiCardStates();
  },
  /** 快捷复用：把额外API（动态世界）配置填入变量AI表单 */
  copyExtraToVar() {
    var _a, _b, _c, _d;
    const e = ((_b = (_a = window.DynamicWorld) == null ? void 0 : _a.getExtraApi) == null ? void 0 : _b.call(_a)) || {};
    if (!(e.endpoint && e.apiKey)) {
      (_c = window.showToast) == null ? void 0 : _c.call(window, "额外API尚未配置完整，无法复用", "error");
      return;
    }
    document.getElementById("va_provider").value = this.detectProvider(e);
    document.getElementById("va_endpoint").value = e.endpoint || "";
    document.getElementById("va_key").value = e.apiKey || "";
    document.getElementById("va_model").value = e.model || "";
    this.updateProviderUI("va");
    this.resetVarModelList();
    (_d = window.showToast) == null ? void 0 : _d.call(window, "已复用额外API配置（变量AI与动态世界共用同一廉价模型）", "info");
    this.refreshApiCardStates();
  },
  /** 第三接口：连通测试（用表单当前值，无需先保存） */
  async testVarConnection() {
    const va = window.VariableAI;
    const result = document.getElementById("va_testResult");
    if (!va || !result) return;
    const cfg = this.readVarAIForm();
    if (!(cfg.endpoint && cfg.apiKey && cfg.model)) {
      result.className = "test-result error";
      result.textContent = "✕ 请先填写变量AI的地址 / Key / 模型名";
      return;
    }
    result.className = "test-result loading";
    result.textContent = "⏳ 正在测试第三接口…";
    try {
      const reply = await va.testVarApi(cfg);
      result.className = "test-result success";
      result.textContent = `✓ 第三接口连接成功，模型回复：${String(reply).slice(0, 40)}`;
    } catch (err) {
      result.className = "test-result error";
      result.textContent = `✕ ${err.message}`;
    }
  },
  /* ==================== 🖼 插图引擎（第四接口）分区（v3.9.0） ==================== */
  /** 按 id 取生图厂商定义（未知回落自定义） */
  imgProviderById(id) {
    return this.IMG_PROVIDERS.find((p) => p.id === id) || this.IMG_PROVIDERS.find((p) => p.id === "custom-img");
  },
  /** 由已存配置识别生图厂商：优先 provider，其次按地址匹配，最后回落自定义 */
  detectImgProvider(cfg) {
    cfg = cfg || {};
    if (cfg.provider && this.IMG_PROVIDERS.some((p) => p.id === cfg.provider)) return cfg.provider;
    const norm = (u) => String(u || "").replace(/\/+$/, "").toLowerCase();
    const ep = norm(cfg.endpoint);
    if (ep) {
      for (const p of this.IMG_PROVIDERS) {
        const pe = norm(p.endpoint);
        if (pe && (ep === pe || ep.startsWith(pe + "/") || ep.startsWith(pe))) return p.id;
      }
    }
    return "custom-img";
  },
  /** 用户切换生图厂商：自动填地址 + 模式 + 快捷模型 */
  onImgProviderChange() {
    const p = this.imgProviderById(document.getElementById("img_provider").value);
    if (p.endpoint) document.getElementById("img_endpoint").value = p.endpoint;
    document.getElementById("img_mode").value = p.mode || "images";
    this.updateImgProviderUI();
    this.onImgModeChange();
    this.resetImgModelList();
    this.refreshApiCardStates();
  },
  /** v3.11.0 接口模式切换：NAI 模式展开专属参数区（模型代号 / 尺寸 / 负面提示词）
   *  v3.12.0 ink 模式展开文墨参数区（复用主笔 / 画风 / 协议） */
  onImgModeChange() {
    const mode = document.getElementById("img_mode").value;
    const group = document.getElementById("naiParamsGroup");
    if (group) group.style.display = mode === "nai" ? "block" : "none";
    const inkGroup = document.getElementById("inkParamsGroup");
    if (inkGroup) inkGroup.style.display = mode === "ink" ? "block" : "none";
    const tip = document.getElementById("img_modeTip");
    if (tip) {
      tip.textContent = mode === "nai" ? "NAI 模式：地址填站点根地址（自动补全 /ai/generate-image）或完整生图地址；模型无列表接口，请用 NAI 快捷按钮或手填代号（如 nai-diffusion-4-5-full）。" : mode === "ink" ? "文墨模式：不接生图 API——勾选「复用主笔接口」后下方地址 / Key / 模型可全部留空，用主笔的文本模型手写 SVG 插图；也可取消复用填任意文本模型。" : mode === "chat" ? "对话式生图模型（如 OpenRouter 上的生图模型）才需要 chat 模式。" : "不确定就选「标准生图接口」；对话式生图模型（如 OpenRouter 上的生图模型）才需要 chat 模式。";
    }
    const chips = document.getElementById("naiModelChips");
    if (chips) {
      const models = window.StoryImageGen && window.StoryImageGen.NAI_MODELS || [];
      chips.innerHTML = models.map(
        (m) => `<button type="button" class="model-chip" data-model="${this.esc(m)}" title="点击填入模型代号">${this.esc(m)}</button>`
      ).join("");
    }
    this.onInkUseMainChange();
    this.refreshApiCardStates();
  },
  /** v3.12.0 复用主笔开关：切换参数区提示文案（复用时说明三件套可留空，独立时说明需填文本模型） */
  onInkUseMainChange() {
    var _a, _b;
    const mode = (_a = document.getElementById("img_mode")) == null ? void 0 : _a.value;
    if (mode !== "ink") return;
    const useMain = ((_b = document.getElementById("img_inkUseMain")) == null ? void 0 : _b.checked) !== false;
    const tip = document.getElementById("inkParamsTip");
    if (tip) {
      tip.textContent = useMain ? "文墨模式说明：当前复用主笔接口——零额外配置零额外成本，协议自动跟随主笔；下方地址 / Key / 模型三项无需填写。文本模型（免费 gemini-3.5-flash / deepseek 等皆可）手写 SVG 矢量插图，浏览器直接渲染；v3.13.0 起锁死逐画风调色板 + 五层构图骨架 + 人物剪影铁律，勾选「精绘模式」再享两步构图与画后质量自检，细节不及专业生图模型，但零成本可无限重画。" : "文墨模式说明：当前独立配置——请在下方填写文本模型的地址 / Key / 模型名（任意会写代码的文本模型皆可），协议按左侧选择；手写 SVG 矢量插图，浏览器直接渲染，零生图成本；v3.13.0 起锁死逐画风调色板 + 五层构图骨架 + 人物剪影铁律，勾选「精绘模式」再享两步构图与画后质量自检。";
    }
  },
  /** 刷新生图厂商提示条 + 快捷模型按钮 */
  updateImgProviderUI() {
    var _a;
    const p = this.imgProviderById(document.getElementById("img_provider").value);
    const tip = document.getElementById("img_providerTip");
    const modeName = { images: "标准生图接口", chat: "对话式生图", nai: "NovelAI 原生", ink: "文墨画师" }[p.mode] || "标准生图接口";
    if (tip) tip.textContent = `模式：${modeName} · ${p.tip}`;
    const chips = document.getElementById("img_modelChips");
    if (chips) {
      const models = ((_a = document.getElementById("img_mode")) == null ? void 0 : _a.value) === "nai" ? window.StoryImageGen && window.StoryImageGen.NAI_MODELS || p.models || [] : p.models || [];
      chips.innerHTML = models.map(
        (m) => `<button type="button" class="model-chip" data-model="${this.esc(m)}" title="点击填入模型名">${this.esc(m)}</button>`
      ).join("");
    }
  },
  /** 快捷生图模型按钮 → 填入模型输入框 */
  pickQuickImgModel(model) {
    document.getElementById("img_model").value = model;
    this.refreshApiCardStates();
  },
  /** 尺寸快捷按钮 → 填入尺寸输入框 */
  pickImgSize(size) {
    document.getElementById("img_size").value = size;
  },
  /** 折叠 / 展开「插图引擎」配置区 */
  toggleImgSection() {
    const body = document.getElementById("imgSectionBody");
    const caret = document.getElementById("imgCaret");
    if (!body) return;
    const open = body.style.display === "none";
    body.style.display = open ? "block" : "none";
    if (caret) caret.textContent = open ? "▾" : "▸";
  },
  /** 插图引擎表单填充（第四接口 + 生成行为） */
  fillImgForm() {
    const IG = window.StoryImageGen;
    if (!IG) return;
    const c = IG.get();
    const st = IG.getSettings();
    document.getElementById("img_provider").value = this.detectImgProvider(c);
    document.getElementById("img_mode").value = ["chat", "nai", "ink"].includes(c.mode) ? c.mode : "images";
    document.getElementById("img_endpoint").value = c.endpoint || "";
    document.getElementById("img_key").value = c.apiKey || "";
    document.getElementById("img_model").value = c.model || "";
    document.getElementById("img_size").value = c.size || "1024x1024";
    document.getElementById("img_timeout").value = c.timeout || 180;
    document.getElementById("img_naiNegative").value = c.naiNegative || window.StoryImageGen && window.StoryImageGen.NAI_NEGATIVE || "";
    document.getElementById("img_inkUseMain").checked = c.inkUseMain !== false;
    document.getElementById("img_inkPlan").checked = c.inkPlan !== false;
    document.getElementById("img_inkStyle").value = window.StoryImageGen && window.StoryImageGen.INK_STYLES && window.StoryImageGen.INK_STYLES[c.inkStyle] ? c.inkStyle : "flat";
    document.getElementById("img_inkType").value = c.type === "gemini" ? "gemini" : "openai";
    this.updateImgProviderUI();
    this.onImgModeChange();
    document.getElementById("img_enabled").checked = !!st.enabled;
    document.getElementById("img_autoGen").checked = st.autoGen !== false;
    document.getElementById("img_maxPerChapter").value = st.maxPerChapter || 1;
    document.getElementById("img_promptLang").value = st.promptLang === "en" ? "en" : "zh";
    document.getElementById("img_styleSuffix").value = st.styleSuffix || "";
  },
  /** 插图引擎读取表单 */
  readImgForm() {
    const clamp = (v, min, max, dft) => {
      const n = parseInt(v);
      return isNaN(n) ? dft : Math.min(max, Math.max(min, n));
    };
    const sizeRaw = document.getElementById("img_size").value.trim();
    const modeRaw = document.getElementById("img_mode").value;
    const inkUseMain = document.getElementById("img_inkUseMain").checked;
    const inkTypeRaw = document.getElementById("img_inkType").value;
    return {
      api: {
        provider: document.getElementById("img_provider").value,
        type: modeRaw === "ink" && !inkUseMain && inkTypeRaw === "gemini" ? "gemini" : "openai",
        // ink 独立配置支持 Gemini 原生；其余三路均 OpenAI / NAI 兼容
        mode: ["chat", "nai", "ink"].includes(modeRaw) ? modeRaw : "images",
        endpoint: document.getElementById("img_endpoint").value.trim(),
        apiKey: document.getElementById("img_key").value.trim(),
        model: document.getElementById("img_model").value.trim(),
        size: /^\d{3,4}x\d{3,4}$/.test(sizeRaw) ? sizeRaw : "1024x1024",
        timeout: clamp(document.getElementById("img_timeout").value, 30, 600, 180),
        naiNegative: document.getElementById("img_naiNegative").value.trim(),
        inkUseMain,
        inkPlan: document.getElementById("img_inkPlan").checked !== false,
        // v3.13.0 精绘模式（两步构图）
        inkStyle: ["flat", "ink", "silhouette", "dark", "pastel", "neon"].includes(document.getElementById("img_inkStyle").value) ? document.getElementById("img_inkStyle").value : "flat"
      },
      settings: {
        enabled: document.getElementById("img_enabled").checked,
        autoGen: document.getElementById("img_autoGen").checked,
        maxPerChapter: clamp(document.getElementById("img_maxPerChapter").value, 1, 3, 1),
        promptLang: document.getElementById("img_promptLang").value === "en" ? "en" : "zh",
        styleSuffix: document.getElementById("img_styleSuffix").value.trim()
      }
    };
  },
  /** 快捷复用：把主接口连接配置填入插图引擎 */
  copyMainToImg() {
    var _a;
    document.getElementById("img_endpoint").value = document.getElementById("cfg_endpoint").value;
    document.getElementById("img_key").value = document.getElementById("cfg_key").value;
    this.resetImgModelList();
    (_a = window.showToast) == null ? void 0 : _a.call(window, "已把主接口地址与 Key 填入插图引擎（生图模型名需单独填写，一般不能用对话模型生图）", "info");
    this.refreshApiCardStates();
  },
  /** 快捷复用：把额外API（动态世界）配置填入插图引擎 */
  copyExtraToImg() {
    var _a, _b, _c, _d;
    const e = ((_b = (_a = window.DynamicWorld) == null ? void 0 : _a.getExtraApi) == null ? void 0 : _b.call(_a)) || {};
    if (!(e.endpoint && e.apiKey)) {
      (_c = window.showToast) == null ? void 0 : _c.call(window, "额外API尚未配置完整，无法复用", "error");
      return;
    }
    document.getElementById("img_endpoint").value = e.endpoint || "";
    document.getElementById("img_key").value = e.apiKey || "";
    this.resetImgModelList();
    (_d = window.showToast) == null ? void 0 : _d.call(window, "已复用额外API的地址与 Key（生图模型名需单独填写）", "info");
    this.refreshApiCardStates();
  },
  /** 快捷复用：把变量AI（第三接口）配置填入插图引擎 */
  copyVarToImg() {
    var _a, _b, _c, _d;
    const c = ((_b = (_a = window.VariableAI) == null ? void 0 : _a.get) == null ? void 0 : _b.call(_a)) || {};
    if (!(c.endpoint && c.apiKey)) {
      (_c = window.showToast) == null ? void 0 : _c.call(window, "变量AI尚未配置完整，无法复用", "error");
      return;
    }
    document.getElementById("img_endpoint").value = c.endpoint || "";
    document.getElementById("img_key").value = c.apiKey || "";
    this.resetImgModelList();
    (_d = window.showToast) == null ? void 0 : _d.call(window, "已复用变量AI的地址与 Key（生图模型名需单独填写）", "info");
    this.refreshApiCardStates();
  },
  /** 第四接口：拉取模型列表
   *  v3.46.2：NAI 原生模式由 StoryImageGen.fetchModels 直接返回内置代号表（官方无列表接口），
   *  失败提示也按模式分流，不再误导用户"检查地址是否含 /v1" */
  async fetchImgModels() {
    const { api } = this.readImgForm();
    const btn = document.getElementById("img_fetchBtn");
    const hint = document.getElementById("img_modelHint");
    if (api.mode === "ink" && api.inkUseMain !== false) {
      const IG2 = window.StoryImageGen;
      if (IG2 && !IG2._inkMainCfg()) {
        hint.style.display = "block";
        hint.style.color = "var(--danger)";
        hint.textContent = "✕ 文墨模式复用主笔接口，但主笔尚未配置完整——请先到「🎭 主笔 AI」完成配置";
        return;
      }
    } else if (!(api.endpoint && api.apiKey)) {
      hint.style.display = "block";
      hint.textContent = "✕ 请先填写生图 API 地址与 API Key，再获取模型列表";
      hint.style.color = "var(--danger)";
      return;
    }
    btn.disabled = true;
    btn.textContent = "获取中…";
    try {
      const models = await window.StoryImageGen.fetchModels(api);
      if (!models.length) throw new Error("接口未返回任何模型（可能不支持列表查询，请手填模型名）");
      this.displayImgModels(models);
    } catch (err) {
      hint.style.display = "block";
      hint.style.color = "var(--danger)";
      const suffix = api.mode === "nai" ? "（NAI 模式无需列表接口：请用下方快捷按钮或手填代号，如 nai-diffusion-5-full）" : api.mode === "ink" ? "（文墨模式请检查所复用/填写的文本模型接口）" : "（可检查地址是否需含 /v1，或直接手填模型名）";
      hint.textContent = `✕ ${err.message}${suffix}`;
    } finally {
      btn.disabled = false;
      btn.textContent = "获取";
    }
  },
  /** 第四接口：渲染模型下拉 */
  displayImgModels(models) {
    const select = document.getElementById("img_modelSelect");
    const hint = document.getElementById("img_modelHint");
    const current = document.getElementById("img_model").value.trim();
    select.innerHTML = "";
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      if (m === current) opt.selected = true;
      select.appendChild(opt);
    }
    if (!current && models.length) {
      select.value = models[0];
      document.getElementById("img_model").value = models[0];
    }
    select.style.display = "block";
    hint.style.display = "block";
    hint.style.color = "var(--ok)";
    hint.textContent = `✓ 已获取 ${models.length} 个模型，从下拉中选择生图模型即可（也可继续手填）`;
  },
  /** 第四接口：下拉选中 → 同步输入框 */
  pickImgModel(v) {
    document.getElementById("img_model").value = v;
  },
  resetImgModelList() {
    const select = document.getElementById("img_modelSelect");
    const hint = document.getElementById("img_modelHint");
    if (select) {
      select.innerHTML = "";
      select.style.display = "none";
    }
    if (hint) {
      hint.style.display = "none";
      hint.textContent = "";
    }
  },
  /** 第四接口：连通测试（实际生成一张小样图，验证地址/Key/模型/尺寸全链路） */
  async testImgConnection() {
    const IG = window.StoryImageGen;
    const result = document.getElementById("img_testResult");
    if (!IG || !result) return;
    const { api } = this.readImgForm();
    if (!(api.endpoint && api.apiKey && api.model)) {
      result.className = "test-result error";
      result.textContent = "✕ 请先填写生图 API 的地址 / Key / 模型名";
      return;
    }
    result.className = "test-result loading";
    result.textContent = "⏳ 正在生成测试小样图（约需数十秒，会消耗一次生图额度）…";
    try {
      const url = await IG.testApi(api);
      result.className = "test-result success";
      result.textContent = `✓ 第四接口连通成功：${String(url).slice(0, 60)}`;
    } catch (err) {
      result.className = "test-result error";
      result.textContent = `✕ ${err.message}（注意部分厂商不支持所选尺寸，可改 1024x1024 重试）`;
    }
  },
  /* ==================== ✍ 提示词工程师（第五接口）分区（v3.10.0） ==================== */
  /** 折叠 / 展开「提示词工程师」配置区 */
  togglePeSection() {
    const body = document.getElementById("peSectionBody");
    const caret = document.getElementById("peCaret");
    if (!body) return;
    const open = body.style.display === "none";
    body.style.display = open ? "block" : "none";
    if (caret) caret.textContent = open ? "▾" : "▸";
  },
  /** 提示词工程师 表单填充 */
  fillPeForm() {
    var _a;
    const pe = window.StoryPromptEngineer;
    if (!pe) return;
    const c = pe.get();
    document.getElementById("pe_provider").value = this.detectProvider(c);
    document.getElementById("pe_endpoint").value = c.endpoint || "";
    document.getElementById("pe_key").value = c.apiKey || "";
    document.getElementById("pe_model").value = c.model || "";
    document.getElementById("pe_maxTokens").value = c.maxTokens || 2048;
    document.getElementById("pe_temperature").value = (_a = c.temperature) != null ? _a : 0.7;
    document.getElementById("pe_timeout").value = c.timeout || 120;
    this.updateProviderUI("pe");
    document.getElementById("pe_enabled").checked = !!c.enabled;
  },
  /** 提示词工程师 读取表单 */
  readPeForm() {
    const clamp = (v, min, max, dft) => {
      const n = parseInt(v);
      return isNaN(n) ? dft : Math.min(max, Math.max(min, n));
    };
    return {
      provider: document.getElementById("pe_provider").value,
      type: this.currentType("pe"),
      endpoint: document.getElementById("pe_endpoint").value.trim(),
      apiKey: document.getElementById("pe_key").value.trim(),
      model: document.getElementById("pe_model").value.trim(),
      maxTokens: clamp(document.getElementById("pe_maxTokens").value, 256, 131072, 2048),
      temperature: this.clampTemp(document.getElementById("pe_temperature").value, 0.7),
      timeout: clamp(document.getElementById("pe_timeout").value, 30, 600, 120),
      enabled: document.getElementById("pe_enabled").checked
    };
  },
  /** 第五接口：拉取模型列表 */
  async fetchPeModels() {
    const pe = window.StoryPromptEngineer;
    const cfg = this.readPeForm();
    const btn = document.getElementById("pe_fetchBtn");
    const hint = document.getElementById("pe_modelHint");
    if (!(cfg.endpoint && cfg.apiKey)) {
      hint.style.display = "block";
      hint.textContent = "✕ 请先填写提示词工程师的地址与 API Key，再获取模型列表";
      hint.style.color = "var(--danger)";
      return;
    }
    btn.disabled = true;
    btn.textContent = "获取中…";
    try {
      const models = await pe.fetchModels(cfg);
      if (!models.length) throw new Error("接口未返回任何模型（可能不支持列表查询，请手填模型名）");
      this.displayPeModels(models);
    } catch (err) {
      hint.style.display = "block";
      hint.style.color = "var(--danger)";
      hint.textContent = `✕ ${err.message}（可检查地址是否需含 /v1，或直接手填模型名）`;
    } finally {
      btn.disabled = false;
      btn.textContent = "获取";
    }
  },
  /** 第五接口：渲染模型下拉 */
  displayPeModels(models) {
    const select = document.getElementById("pe_modelSelect");
    const hint = document.getElementById("pe_modelHint");
    const current = document.getElementById("pe_model").value.trim();
    select.innerHTML = "";
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      if (m === current) opt.selected = true;
      select.appendChild(opt);
    }
    if (!current && models.length) {
      select.value = models[0];
      document.getElementById("pe_model").value = models[0];
    }
    select.style.display = "block";
    hint.style.display = "block";
    hint.style.color = "var(--ok)";
    hint.textContent = `✓ 已获取 ${models.length} 个模型，从下拉中选择即可（也可继续手填）`;
  },
  /** 第五接口：下拉选中 → 同步输入框 */
  pickPeModel(v) {
    document.getElementById("pe_model").value = v;
  },
  resetPeModelList() {
    const select = document.getElementById("pe_modelSelect");
    const hint = document.getElementById("pe_modelHint");
    if (select) {
      select.innerHTML = "";
      select.style.display = "none";
    }
    if (hint) {
      hint.style.display = "none";
      hint.textContent = "";
    }
  },
  /** 快捷复用：把主接口配置填入提示词工程师表单 */
  copyMainToPe() {
    var _a;
    document.getElementById("pe_provider").value = document.getElementById("cfg_provider").value;
    document.getElementById("pe_endpoint").value = document.getElementById("cfg_endpoint").value;
    document.getElementById("pe_key").value = document.getElementById("cfg_key").value;
    document.getElementById("pe_model").value = document.getElementById("cfg_model").value;
    this.updateProviderUI("pe");
    this.resetPeModelList();
    (_a = window.showToast) == null ? void 0 : _a.call(window, "已把主接口配置填入提示词工程师（改写是小活，换个便宜模型更划算）", "info");
    this.refreshApiCardStates();
  },
  /** 快捷复用：把变量AI（第三接口）配置填入提示词工程师表单 */
  copyVarToPe() {
    var _a, _b, _c, _d;
    const c = ((_b = (_a = window.VariableAI) == null ? void 0 : _a.get) == null ? void 0 : _b.call(_a)) || {};
    if (!(c.endpoint && c.apiKey)) {
      (_c = window.showToast) == null ? void 0 : _c.call(window, "变量AI尚未配置完整，无法复用", "error");
      return;
    }
    document.getElementById("pe_provider").value = this.detectProvider(c);
    document.getElementById("pe_endpoint").value = c.endpoint || "";
    document.getElementById("pe_key").value = c.apiKey || "";
    document.getElementById("pe_model").value = c.model || "";
    this.updateProviderUI("pe");
    this.resetPeModelList();
    (_d = window.showToast) == null ? void 0 : _d.call(window, "已复用变量AI配置（改写与提取都是小活，共用廉价模型正好）", "info");
    this.refreshApiCardStates();
  },
  /** 快捷复用：把生图接口（第四接口）配置填入提示词工程师表单 */
  copyImgToPe() {
    var _a, _b;
    const IG = window.StoryImageGen;
    if (!IG) return;
    const c = IG.get() || {};
    if (!(c.endpoint && c.apiKey)) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "生图接口尚未配置完整，无法复用", "error");
      return;
    }
    document.getElementById("pe_provider").value = this.detectProvider(c);
    document.getElementById("pe_endpoint").value = c.endpoint || "";
    document.getElementById("pe_key").value = c.apiKey || "";
    document.getElementById("pe_model").value = c.model || "";
    this.updateProviderUI("pe");
    this.resetPeModelList();
    (_b = window.showToast) == null ? void 0 : _b.call(window, "已复用生图接口配置（同厂商一站配齐，注意部分聚合站对话与生图计费不同）", "info");
    this.refreshApiCardStates();
  },
  /** 第五接口：连通测试（用表单当前值，无需先保存） */
  async testPeConnection() {
    const pe = window.StoryPromptEngineer;
    const result = document.getElementById("pe_testResult");
    if (!pe || !result) return;
    const cfg = this.readPeForm();
    if (!(cfg.endpoint && cfg.apiKey && cfg.model)) {
      result.className = "test-result error";
      result.textContent = "✕ 请先填写提示词工程师的地址 / Key / 模型名";
      return;
    }
    result.className = "test-result loading";
    result.textContent = "⏳ 正在测试第五接口…";
    try {
      const reply = await pe.testApi(cfg);
      result.className = "test-result success";
      result.textContent = `✓ 第五接口连接成功，模型回复：${String(reply).slice(0, 40)}`;
    } catch (err) {
      result.className = "test-result error";
      result.textContent = `✕ ${err.message}`;
    }
  },
  /* ==================== 📱 手机分身（第六接口，v3.19.6 地球开放世界专属） ==================== */
  /** 是否地球开放世界（第六接口卡仅此界渲染） */
  isEarthGenre() {
    try {
      const g = window.storyFramework && window.storyFramework.config && window.storyFramework.config.genreKey || new URLSearchParams(location.search).get("genre");
      return g === "earth";
    } catch (e) {
      return false;
    }
  },
  /** 折叠 / 展开「手机分身」配置区 */
  togglePhSection() {
    const body = document.getElementById("phSectionBody");
    const caret = document.getElementById("phCaret");
    if (!body) return;
    const open = body.style.display === "none";
    body.style.display = open ? "block" : "none";
    if (caret) caret.textContent = open ? "▾" : "▸";
  },

  /* ==================== 🔞 内容尺度（v3.47.15） ==================== */
  /** 折叠 / 展开「内容尺度」配置区 */
  toggleCSSection() {
    const body = document.getElementById("csSectionBody");
    const caret = document.getElementById("csCaret");
    if (!body) return;
    const open = body.style.display === "none";
    body.style.display = open ? "block" : "none";
    if (caret) caret.textContent = open ? "▾" : "▸";
    if (open) this.renderCSSection();
  },
  /** 渲染内容尺度面板（档位卡 + 确认框 + 全文预览） */
  renderCSSection() {
    const CS = window.MoContentScale;
    const row = document.getElementById("csLevelRow");
    const chip = document.getElementById("cs_stateChip");
    if (!CS) {
      if (row) row.innerHTML = '<div class="form-tip">内容尺度模块未加载（content-scale.js 缺失），将按「克制」档运行。</div>';
      return;
    }
    const cur = CS.get();
    const ok18 = CS.adultConfirmed();
    if (chip) {
      const lv = CS.LEVELS[cur];
      chip.textContent = lv.icon + " " + lv.name;
    }
    if (row) {
      row.innerHTML = Object.keys(CS.LEVELS).map((k) => {
        const lv = CS.LEVELS[k];
        const locked = (k === "adult" || k === "explicit") && !ok18;
        const on = k === cur;
        return `<button type="button" class="cs-level-card${on ? " on" : ""}${locked ? " locked" : ""}"
                  data-level="${k}" onclick="ConfigModal.pickContentScale('${k}')">
                  <span class="cs-lv-icon">${lv.icon}</span>
                  <span class="cs-lv-name">${this.esc(lv.name)}${locked ? " 🔒" : ""}</span>
                  <span class="cs-lv-desc">${this.esc(lv.desc)}</span>
                </button>`;
      }).join("");
    }
    const box = document.getElementById("csConfirmBox");
    if (box) box.style.display = ok18 ? "none" : "block";
    const cb = document.getElementById("cs_adultConfirm");
    if (cb) cb.checked = ok18;
    const lim = document.getElementById("csLimits");
    if (lim) lim.textContent = CS.HARD_LIMITS;
    const brk = document.getElementById("cs_breakLimit");
    if (brk) brk.checked = CS.breakOn ? CS.breakOn() : false;
    const pv = document.getElementById("csPreview");
    if (pv) pv.value = CS.buildDirective();
  },
  /** v3.53.0 破限开关 */
  toggleBreakLimit(on) {
    const CS = window.MoContentScale;
    if (!CS || !CS.setBreak) return;
    if (on) {
      const ok = window.confirm(
        "破限模式会要求模型不再因题材敏感而拒写、切黑、加免责声明或说教。\n\n" +
        "保留的三条硬底线：不写未成年人的性内容、不写真实在世人物、不提供现实违法操作指南。\n\n确认开启？"
      );
      if (!ok) { this.renderCSSection(); return; }
      CS.setBreak(true);
      /* 破限同时解锁成人向状态字段组（用户仍可在状态栏设置里单独关） */
      try { if (CS.adultConfirmed()) localStorage.setItem("yunjingAdultFields", "1"); } catch (e) {}
    } else {
      CS.setBreak(false);
    }
    if (window.StatusSchema && StatusSchema.render) StatusSchema.render();
    this.renderCSSection();
    if (window.showToast) window.showToast(on ? "⛓ 破限已开启" : "破限已关闭", "info");
  },
  /** 选择档位：成人两档需先过 18+ 确认 */
  pickContentScale(level) {
    const CS = window.MoContentScale;
    if (!CS) return;
    if ((level === "adult" || level === "explicit") && !CS.adultConfirmed()) {
      const box = document.getElementById("csConfirmBox");
      if (box) { box.style.display = "block"; box.scrollIntoView({ block: "nearest" }); }
      if (window.StoryResponseHandler && StoryResponseHandler.renderSystemMessage) {
        StoryResponseHandler.renderSystemMessage("请先勾选「已满 18 周岁」确认，再选择成人向档位", "warn");
      }
      return;
    }
    CS.set(level);
    this.renderCSSection();
  },

  /* ==================== 📕 云起预设（v3.55.5） ==================== */
  /** 折叠 / 展开「云起预设」配置区 */
  async toggleMMSection() {
    const body = document.getElementById("mmSectionBody");
    const caret = document.getElementById("mmCaret");
    if (!body) return;
    const open = body.style.display === "none";
    body.style.display = open ? "block" : "none";
    if (caret) caret.textContent = open ? "▾" : "▸";
    if (open) {
      if (window.YJEnsureMiaoPreset) { try { await window.YJEnsureMiaoPreset(); } catch (e) { } }
      this.renderMMSection();
    }
  },
  /** 分组名（按条目名的 emoji 前缀归类） */
  MM_GROUP_LABEL: {
    '📕': '文风', '🧠': '思维模式', '🌍': '世界运行', '💬': '语言与转述',
    '📹': '视角', '🪄': '视觉生成', '🥳': '沉浸', '🛡': '破甲', '🧷': '思维链',
    '👾': '状态栏', '📚': '人称与叙事', '📃': '叙事导演', '⭕': '角色', '🗑': '变量清空',
    '🕙': '推进节奏', '🖊': '写作基调', '⚙': '格式', '⚧': '性别', '🕹': '玩家状态',
    '💕': '好感度', '📊': '互动选项', '🪩': 'NPC小剧场', '📖': '世界书', '✂': '防截断',
    '⬇': '分隔', '其它': '其它'
  },
  /** 分隔/占位块不进开关列表 */
  mmIsSkippable(b) {
    if (b.marker) return true;
    const n = b.name || '';
    if (!n.trim()) return true;
    if (/^[═─━＝]+$/.test(n.trim())) return true;
    if (/^(⬇️?|🐑?)$/.test(n.trim())) return true;
    return false;
  },
  /** emoji 前缀归类 */
  mmGroupOf(name) {
    const m = String(name || '').match(/^(\p{Extended_Pictographic}+)/u);
    if (!m) return '其它';
    const k = m[1];
    return this.MM_GROUP_LABEL[k] || '其它';
  },
  /** 渲染云起预设面板 */
  renderMMSection() {
    const M = window.MoMiaomiao;
    const B = window.MoMiaomiaoBridge;
    const chip = document.getElementById("mm_stateChip");
    if (!M || !B) {
      const info = document.getElementById("mm_styleInfo");
      if (info) info.textContent = "预设模块未加载（preset-yunqi / miaomiao-engine / miaomiao-bridge 缺失）。";
      return;
    }
    const on = M.enabled();
    if (chip) chip.textContent = on ? "已启用" : "已关闭";
    const cb = document.getElementById("mm_enabled");
    if (cb) cb.checked = on;
    const RX = window.MoMiaomiaoRegex;
    const rc = document.getElementById("mm_regexEnabled");
    if (rc && RX) rc.checked = RX.enabled();

    /* v3.55.7：云端同步状态（仓库 / 已同步版本 / 上次同步时间） */
    try {
      const YS = window.YunqiSync;
      const chipS = document.getElementById("yqSyncChip");
      const tipS = document.getElementById("yqSyncTip");
      if (YS && (chipS || tipS)) {
        const st = YS.status();
        if (chipS) chipS.textContent = st.configured ? "自定义仓库" : "官方仓库";
        if (tipS) {
          let s = `仓库：<code>${this.esc(st.repo)}</code>`;
          s += st.version ? ` · 已同步 <b>v${this.esc(st.version)}</b>` : " · 尚未同步过";
          if (st.at) {
            try {
              s += `（${new Date(st.at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}）`;
            } catch (e) { }
          }
          tipS.innerHTML = s;
        }
      }
    } catch (e) { }

    /* v3.51.0：当前预设 / 正则的来源（内置 or 导入） */
    const PIO = window.YunjingPresetIO;
    const RIO = window.YunjingRegexIO;
    const pInfo = PIO && PIO.info ? PIO.info() : null;
    const chipP = document.getElementById("mmPresetChip");
    if (chipP && pInfo) chipP.textContent = pInfo.source === "custom" ? "已导入" : "内置";
    const infoP = document.getElementById("mmPresetInfo");
    if (infoP && pInfo) {
      const ver = (pInfo.version && String(pInfo.name || "").indexOf(pInfo.version) < 0) ? ` v${this.esc(pInfo.version)}` : "";
      infoP.innerHTML = pInfo.source === "custom"
        ? `当前：<b>${this.esc(pInfo.name)}</b>${ver} · ${pInfo.blocks} 块 / ${pInfo.chars} 字${pInfo.file ? `（导入自 <code>${this.esc(pInfo.file)}</code>）` : ""}`
        : `当前：<b>${this.esc(pInfo.name)}</b>${ver} · ${pInfo.blocks} 块 / ${pInfo.chars} 字（内置，原文一字未改）`;
    }
    const rInfo = RIO && RIO.info ? RIO.info() : null;
    const infoR = document.getElementById("mmRegexSource");
    if (infoR && rInfo) {
      infoR.innerHTML = rInfo.source === "custom"
        ? `当前：<b>导入的 ${rInfo.count} 条</b>（按正文文本替换生效；<code>&lt;style&gt;</code> 段会被剥离，视觉仍跟随世界皮肤）`
        : `当前：内置 ${rInfo.count} 条（ver 7.2）`;
    }

    // 文风下拉：当前世界的全部档位
    const world = B.worldName();
    const picks = B.listStyles(world);
    const sel = document.getElementById("mm_stylePick");
    const info = document.getElementById("mm_styleInfo");
    if (sel) {
      if (!world) {
        sel.innerHTML = '<option value="">（当前世界未匹配到预设文风）</option>';
      } else {
        const cur = B.resolveStyleBlock();
        const curPick = cur ? cur.split("｜").slice(1).join("｜") : "";
        sel.innerHTML = picks.map((p) => `<option value="${this.esc(p)}"${p === curPick ? " selected" : ""}>${this.esc(p)}</option>`).join("");
      }
    }
    if (info) {
      info.textContent = world
        ? `当前世界「${world}」共 ${picks.length} 档文风。默认跟随开局向导里选的文风；此处手动改会覆盖开局选择。`
        : "当前世界未匹配到预设文风（可能尚未开局，或该世界无对应档位）。";
    }

    this.renderMMBlocks();
    this.renderMMRegex();

    // 预览
    const pv = document.getElementById("mmPreview");
    const tip = document.getElementById("mmPreviewTip");
    if (pv) {
      const txt = on ? (B.render({}) || "") : "";
      pv.value = txt || "（未启用，或无内容）";
      if (tip) tip.textContent = on ? `共 ${txt.length} 字，随开局设定即时更新。` : "启用后此处显示每轮实际注入的预设正文。";
    }
  },
  /** 渲染「预设条目」逐条开关（全量 352 条，按分组折叠） */
  renderMMBlocks() {
    const M = window.MoMiaomiao;
    const B = window.MoMiaomiaoBridge;
    const list = document.getElementById("mm_blockList");
    if (!list || !M) return;
    const all = M.listBlocks().filter((b) => !this.mmIsSkippable(b));
    const ov = M.getOverrides();
    const world = B ? B.worldName() : "";

    // 分组：文风组拆出「本世界」与「其它世界」，避免 180 条挤在一起
    const groups = {};
    all.forEach((b) => {
      let g = this.mmGroupOf(b.name);
      if (g === "文风") g = (world && b.name.indexOf("📕文风·" + world + "｜") === 0) ? "文风·本世界" : "文风·其它世界";
      (groups[g] = groups[g] || []).push(b);
    });
    // 本世界文风排最前，其余按条目数降序
    const order = Object.keys(groups).sort((a, b) => {
      if (a === "文风·本世界") return -1;
      if (b === "文风·本世界") return 1;
      return groups[b].length - groups[a].length;
    });

    const q = (document.getElementById("mmSearch") || {}).value || "";
    const kw = q.trim().toLowerCase();

    list.innerHTML = order.map((g) => {
      const items = groups[g].filter((b) => !kw || (b.name || "").toLowerCase().indexOf(kw) >= 0);
      if (!items.length) return "";
      const onCount = items.filter((b) => (ov[b.name] !== undefined ? !!ov[b.name] : b.on)).length;
      const opened = this._mmOpenAll || (g === "文风·本世界" && world);
      return `<div class="mm-group" data-group="${this.esc(g)}">
          <div class="mm-group-head" onclick="ConfigModal.mmToggleGroup(this)">
            <span class="mm-group-caret">${opened ? "▾" : "▸"}</span>
            <span class="mm-group-name">${this.esc(g)}</span>
            <span class="mm-group-count">${onCount}/${items.length}</span>
          </div>
          <div class="mm-group-body" style="display:${opened ? "block" : "none"}">
            ${opened ? items.map((b) => this.mmBlockRow(b, ov)).join("") : ""}
          </div>
        </div>`;
    }).join("") || '<div class="form-tip">没有匹配的条目。</div>';

    const cnt = document.getElementById("mmBlockCount");
    if (cnt) {
      const on = all.filter((b) => (ov[b.name] !== undefined ? !!ov[b.name] : b.on)).length;
      cnt.textContent = `（${all.length} 条，当前开启 ${on}）`;
    }
  },
  /** 单条预设条目 */
  mmBlockRow(b, ov) {
    const on = ov[b.name] !== undefined ? !!ov[b.name] : b.on;
    const changed = ov[b.name] !== undefined;
    return `<label class="check-row mm-row${changed ? " mm-changed" : ""}">
        <input type="checkbox"${on ? " checked" : ""} onchange="ConfigModal.toggleMiaomiaoBlock('${this.esc(b.name).replace(/'/g, "\\'")}', this.checked)">
        <span>${this.esc(b.name)}${b.edited ? ' <i class="mm-edited">已改</i>' : ""}</span>
        <i>${b.len} 字</i>
        <button type="button" class="mm-edit-btn" title="编辑这条提示词（本机生效，可还原）" onclick="event.preventDefault();event.stopPropagation();ConfigModal.mmEditBlock('${this.esc(b.id)}')">✎</button>
      </label>`;
  },
  /** 渲染「云起正则」逐条开关（30 条，含 14 条云起专属美化） */
  renderMMRegex() {
    const R = window.MoMiaomiaoRegex;
    const list = document.getElementById("mm_regexList");
    if (!list) return;
    if (!R) {
      list.innerHTML = '<div class="form-tip">正则模块未加载。</div>';
      return;
    }
    const cat = R.catalog();
    const KIND_LABEL = { card: "协议块 → 卡片", purge: "去 AI 味清理", ctx: "上下文裁剪", custom: "📥 自定义（导入）", misc: "其它" };
    const KIND_ICON = { card: "🗂", purge: "🧹", ctx: "✂️", custom: "📥", misc: "·" };
    const groups = {};
    cat.forEach((c) => { (groups[c.kind] = groups[c.kind] || []).push(c); });
    const order = ["card", "purge", "ctx", "custom", "misc"].filter((k) => groups[k]);

    list.innerHTML = order.map((k) => {
      const items = groups[k];
      const onCount = items.filter((c) => c.on).length;
      const opened = !!this._mmOpenAll || k === "purge";
      return `<div class="mm-group" data-group="${k}">
          <div class="mm-group-head" onclick="ConfigModal.mmToggleGroup(this)">
            <span class="mm-group-caret">${opened ? "▾" : "▸"}</span>
            <span class="mm-group-name">${KIND_ICON[k]} ${KIND_LABEL[k]}</span>
            <span class="mm-group-count">${onCount}/${items.length}</span>
          </div>
          <div class="mm-group-body" style="display:${opened ? "block" : "none"}">
            ${opened ? items.map((c) => this.mmRegexRow(c)).join("") : ""}
          </div>
        </div>`;
    }).join("");

    const cnt = document.getElementById("mmRegexCount");
    if (cnt) cnt.textContent = `（${cat.length} 条，当前开启 ${cat.filter((c) => c.on).length}）`;
  },
  /** 单条正则 */
  mmRegexRow(c) {
    const changed = c.on !== c.origin;
    return `<label class="check-row mm-row${changed ? " mm-changed" : ""}">
        <input type="checkbox"${c.on ? " checked" : ""} onchange="ConfigModal.toggleMiaomiaoRegex('${this.esc(c.id)}', this.checked)">
        <span>${this.esc(c.name)}</span>
        <i>${c.kind}${changed ? " · 已改" : ""}</i>
      </label>`;
  },
  /** 分组展开/折叠（首次展开时才生成条目，避免一次性铺 397 个 DOM） */
  mmToggleGroup(head) {
    const box = head.parentElement.querySelector(".mm-group-body");
    if (!box) return;
    const caret = head.querySelector(".mm-group-caret");
    const open = box.style.display === "none";
    if (open && !box.dataset.built) {
      const g = head.parentElement.getAttribute("data-group");
      // 触发一次重渲染补上条目内容
      if (document.getElementById("mm_regexList") && head.parentElement.closest("#mm_regexList")) {
        box.innerHTML = "";
      }
      box.dataset.built = "1";
      // 交给对应渲染器填内容（用 group 名定位）
      this.mmFillGroup(head.parentElement, g);
    }
    box.style.display = open ? "block" : "none";
    if (caret) caret.textContent = open ? "▾" : "▸";
  },
  /** 按分组名填入条目 */
  mmFillGroup(groupEl, g) {
    const box = groupEl.querySelector(".mm-group-body");
    if (!box) return;
    const M = window.MoMiaomiao;
    const R = window.MoMiaomiaoRegex;
    const B = window.MoMiaomiaoBridge;
    // 正则列表
    if (R && groupEl.closest && groupEl.closest("#mm_regexList")) {
      const cat = R.catalog().filter((c) => c.kind === g);
      box.innerHTML = cat.map((c) => this.mmRegexRow(c)).join("");
      return;
    }
    if (!M) return;
    const ov = M.getOverrides();
    const world = B ? B.worldName() : "";
    const items = M.listBlocks().filter((b) => !this.mmIsSkippable(b)).filter((b) => {
      let bg = this.mmGroupOf(b.name);
      if (bg === "文风") bg = (world && b.name.indexOf("📕文风·" + world + "｜") === 0) ? "文风·本世界" : "文风·其它世界";
      return bg === g;
    });
    box.innerHTML = items.map((b) => this.mmBlockRow(b, ov)).join("");
  },
  /** 全部展开 / 折叠 */
  mmExpandAll(open) {
    this._mmOpenAll = !!open;
    this.renderMMBlocks();
    this.renderMMRegex();
    document.querySelectorAll(".mm-group-body").forEach((b) => { b.dataset.built = "0"; });
    // 展开态下直接生成
    if (open) {
      document.querySelectorAll(".mm-group").forEach((g) => {
        const box = g.querySelector(".mm-group-body");
        if (box && !box.innerHTML) this.mmFillGroup(g, g.getAttribute("data-group"));
      });
    }
  },
  /** 搜索过滤 */
  renderMMFilter() {
    this.renderMMBlocks();
  },
  /** 清除所有手动改动，回到预设出厂状态 */
  mmResetOverrides() {
    if (window.MoMiaomiao) window.MoMiaomiao.clearOverrides();
    if (window.MoMiaomiaoRegex) window.MoMiaomiaoRegex.clearOverrides();
    this.renderMMSection();
  },
  /** 正则总开关 */
  toggleMiaomiaoRegexAll(on) {
    const R = window.MoMiaomiaoRegex;
    if (!R) return;
    R.setEnabled(!!on);
    this.renderMMSection();
  },
  /** 单条正则开关 */
  toggleMiaomiaoRegex(id, on) {
    const R = window.MoMiaomiaoRegex;
    if (!R) return;
    R.setOverride(id, !!on);
    this.renderMMRegex();
  },
  /** 整份预设启停 */
  toggleMiaomiao(on) {
    const M = window.MoMiaomiao;
    if (!M) return;
    M.setEnabled(!!on);
    this.renderMMSection();
  },
  /** 手动改本世界文风档（写入 override，覆盖开局选择） */
  pickMiaomiaoStyle(pickName) {
    const M = window.MoMiaomiao;
    const B = window.MoMiaomiaoBridge;
    if (!M || !B || !pickName) return;
    const world = B.worldName();
    if (!world) return;
    // 先关掉本世界其它档（多选一语义）
    B.listStyles(world).forEach((p) => {
      M.setOverride("📕文风·" + world + "｜" + p, false);
    });
    M.setOverride("📕文风·" + world + "｜" + pickName, true);
    this.renderMMSection();
  },
  /** 单个预设条目开关 */
  toggleMiaomiaoBlock(name, on) {
    const M = window.MoMiaomiao;
    if (!M) return;
    M.setOverride(name, !!on);
    this.renderMMSection();
  },

  /* ==================== v3.51.0 预设 / 正则：导入替换 + 逐块编辑 ==================== */
  mmSay(msg, type) {
    if (window.showToast) window.showToast(msg, type || "info");
    else console.log("[MM]", msg);
  },
  /** 下载一段文本为 JSON 文件 */
  mmDownload(name, text) {
    try {
      const blob = new Blob([text], { type: "application/json;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    } catch (e) { this.mmSay("导出失败：" + e.message, "error"); }
  },
  /* ---------- 预设整份替换 ---------- */
  /* ---------- v3.55.7 云起预设 · 云端同步（不用重新导入的更新方式） ---------- */
  yqSyncCheck() {
    const YS = window.YunqiSync;
    if (!YS) {
      try { window.showToast && window.showToast("云端同步模块未加载", "error"); } catch (e) { }
      return;
    }
    YS.uiCheck().then(() => this.renderMMSection());
  },
  yqSyncPull() {
    const YS = window.YunqiSync;
    if (!YS) {
      try { window.showToast && window.showToast("云端同步模块未加载", "error"); } catch (e) { }
      return;
    }
    YS.uiSync(false).then((r) => { if (r) this.renderMMSection(); });
  },
  yqSyncRepo() {
    const YS = window.YunqiSync;
    if (!YS) return;
    if (YS.uiRepo()) this.renderMMSection();
  },
  mmImportPreset() {
    if (!window.YunjingPresetIO) return this.mmSay("预设导入模块未加载（preset-io.js）", "error");
    const el = document.getElementById("mmPresetFile");
    if (el) el.click();
  },
  mmPresetFilePicked(input) {
    const f = input && input.files && input.files[0];
    if (!f) return;
    const IO = window.YunjingPresetIO;
    const done = () => { try { input.value = ""; } catch (e) { } };
    if (!IO) { done(); return this.mmSay("预设导入模块未加载", "error"); }
    IO.importFile(f).then((info) => {
      const rx = info && info.regexes ? `，配套正则 ${info.regexes} 条已一并装载` : "";
      this.mmSay(`✅ 已导入「${info.name}」：${info.blocks} 块 / ${info.chars} 字${rx}。旧预设的逐条开关已清空，可重新逐条调整。`, "success");
      this._mmOpenAll = false;
      this.renderMMSection();
      done();
    }).catch((e) => {
      this.mmSay("❌ 导入失败：" + (e && e.message ? e.message : e), "error");
      done();
    });
  },
  mmUseBuiltinPreset() {
    const IO = window.YunjingPresetIO;
    if (!IO) return;
    const cur = IO.info ? IO.info() : null;
    if (cur && cur.source !== "custom") return this.mmSay("当前已经是内置预设", "info");
    if (!window.confirm("恢复内置云起预设？\n\n· 导入的整份预设会被移除\n· 你对单条提示词的改写也会一并清除\n（恢复后即云起原版）")) return;
    IO.useBuiltin();
    this.mmSay("↺ 已恢复内置云起预设", "success");
    this.renderMMSection();
  },
  mmExportPreset() {
    const IO = window.YunjingPresetIO;
    if (!IO) return;
    const txt = IO.exportCurrent ? IO.exportCurrent() : "";
    if (!txt) return this.mmSay("当前没有可导出的预设", "error");
    this.mmDownload("云境预设_" + new Date().toISOString().slice(0, 10) + ".json", txt);
  },
  /* ---------- 正则整份替换 ---------- */
  mmImportRegex() {
    if (!window.YunjingRegexIO) return this.mmSay("正则导入模块未加载（regex-io.js）", "error");
    const el = document.getElementById("mmRegexFile");
    if (el) el.click();
  },
  mmRegexFilePicked(input) {
    const f = input && input.files && input.files[0];
    if (!f) return;
    const R = window.YunjingRegexIO;
    const done = () => { try { input.value = ""; } catch (e) { } };
    if (!R) { done(); return this.mmSay("正则导入模块未加载", "error"); }
    R.importFile(f).then((info) => {
      this.mmSay(`✅ 已导入 ${info.count} 条正则，整份替换内置云起正则`, "success");
      this._mmOpenAll = false;
      this.renderMMSection();
      done();
    }).catch((e) => {
      this.mmSay("❌ 导入失败：" + (e && e.message ? e.message : e), "error");
      done();
    });
  },
  mmUseBuiltinRegex() {
    const R = window.YunjingRegexIO;
    if (!R) return;
    const cur = R.info ? R.info() : null;
    if (cur && cur.source !== "custom") return this.mmSay("当前已经是内置正则", "info");
    if (!window.confirm("恢复内置云起正则（30 条）？导入的那份会被移除（逐条开关也会重置）。")) return;
    R.useBuiltin();
    this.mmSay("↺ 已恢复内置云起正则", "success");
    this.renderMMSection();
  },
  mmExportRegex() {
    const R = window.YunjingRegexIO;
    if (!R) return;
    const txt = R.exportCurrent ? R.exportCurrent() : "";
    if (!txt) return this.mmSay("当前没有可导出的正则", "error");
    this.mmDownload("云境正则_" + new Date().toISOString().slice(0, 10) + ".json", txt);
  },
  /* ---------- 单条提示词改写 ---------- */
  async mmEditBlock(id) {
    const M = window.MoMiaomiao;
    const IO = window.YunjingPresetIO;
    if (!M || !IO) return;
    if (window.YJEnsureMiaoPreset) { try { await window.YJEnsureMiaoPreset(); } catch (e) { } }
    const p = M.preset ? M.preset() : null;
    const blk = p && p.prompts ? p.prompts.filter((b) => b.identifier === id)[0] : null;
    if (!blk) return this.mmSay("找不到这条提示词", "error");
    const def = blk.content || "";
    const cur = IO.editOf(id);
    const old = document.getElementById("mmEditLayer");
    if (old) old.remove();
    const layer = document.createElement("div");
    layer.id = "mmEditLayer";
    layer.className = "mm-edit-layer";
    layer.innerHTML = `
      <div class="mm-edit-box">
        <div class="mm-edit-head">
          <b>✎ ${this.esc(blk.name || "未命名块")}</b>
          <span class="mm-edit-meta">${def.length} 字 · ${cur != null ? "已改写" : "默认版"}</span>
        </div>
        <textarea id="mmEditText" spellcheck="false"></textarea>
        <div class="mm-edit-actions">
          <button type="button" class="btn-ghost" onclick="ConfigModal.mmResetBlock('${this.esc(id)}')">↺ 还原默认</button>
          <button type="button" class="btn-ghost" onclick="ConfigModal.mmCloseEdit()">取消</button>
          <button type="button" class="btn-solid" onclick="ConfigModal.mmSaveBlock('${this.esc(id)}')">保存这条</button>
        </div>
        <div class="form-tip">
          改的是本机副本：内置原文一字不动，「还原默认」随时回到原版。
          <code>{{getvar::…}}</code> / <code>{{setvar::…}}</code> 这类宏照常展开。
        </div>
      </div>`;
    document.body.appendChild(layer);
    const ta = document.getElementById("mmEditText");
    ta.value = cur != null ? cur : def;
    ta.focus();
    try { ta.setSelectionRange(0, 0); ta.scrollTop = 0; } catch (e) { }
  },
  mmSaveBlock(id) {
    const IO = window.YunjingPresetIO;
    const ta = document.getElementById("mmEditText");
    if (!IO || !ta) return;
    const v = ta.value;
    if (!v.trim()) return this.mmSay("内容为空的话不如直接把这条关掉（开关在左侧）", "error");
    IO.setEdit(id, v);
    this.mmCloseEdit();
    this.mmSay("✅ 已保存这条提示词（仅本机）", "success");
    this.renderMMSection();
  },
  mmResetBlock(id) {
    const IO = window.YunjingPresetIO;
    if (!IO) return;
    IO.clearEdit(id);
    this.mmCloseEdit();
    this.mmSay("↺ 已还原为默认版", "success");
    this.renderMMSection();
  },
  mmCloseEdit() {
    const el = document.getElementById("mmEditLayer");
    if (el) el.remove();
  },

  /** 手机分身：表单填充（接口 + 行为） */
  fillPhForm() {
    var _a;
    if (!this.isEarthGenre()) return;
    const PP = window.PhonePanel;
    if (!PP) return;
    const api = PP.getApi();
    const set = PP.getSettings();
    document.getElementById("ph_enabled").checked = !!set.enabled;
    document.getElementById("ph_reuseMain").checked = api.reuseMain !== false;
    document.getElementById("ph_provider").value = this.detectProvider(api);
    document.getElementById("ph_endpoint").value = api.endpoint || "";
    document.getElementById("ph_key").value = api.apiKey || "";
    document.getElementById("ph_model").value = api.model || "";
    document.getElementById("ph_maxTokens").value = api.maxTokens || 4096;
    document.getElementById("ph_temperature").value = (_a = api.temperature) != null ? _a : 0.9;
    document.getElementById("ph_timeout").value = api.timeout || 60;
    document.getElementById("ph_interval").value = set.interval || 3;
    document.getElementById("ph_useKnowledge").checked = set.useKnowledge !== false;
    document.getElementById("ph_autoReact").checked = set.autoReact !== false;
    this.updateProviderUI("ph");
  },
  /** 手机分身：读取表单（{ api, settings }） */
  readPhForm() {
    const clamp = (v, min, max, dft) => {
      const n = parseInt(v);
      return isNaN(n) ? dft : Math.min(max, Math.max(min, n));
    };
    return {
      api: {
        provider: document.getElementById("ph_provider").value,
        type: this.currentType("ph"),
        endpoint: document.getElementById("ph_endpoint").value.trim(),
        apiKey: document.getElementById("ph_key").value.trim(),
        model: document.getElementById("ph_model").value.trim(),
        maxTokens: clamp(document.getElementById("ph_maxTokens").value, 256, 32768, 4096),
        temperature: this.clampTemp(document.getElementById("ph_temperature").value, 0.9),
        timeout: clamp(document.getElementById("ph_timeout").value, 30, 300, 60),
        reuseMain: document.getElementById("ph_reuseMain").checked
      },
      settings: {
        enabled: document.getElementById("ph_enabled").checked,
        interval: clamp(document.getElementById("ph_interval").value, 1, 20, 3),
        useKnowledge: document.getElementById("ph_useKnowledge").checked,
        autoReact: document.getElementById("ph_autoReact").checked
      }
    };
  },
  /** 第六接口：拉取模型列表 */
  async fetchPhModels() {
    const PP = window.PhonePanel;
    const endpoint = document.getElementById("ph_endpoint").value.trim();
    const apiKey = document.getElementById("ph_key").value.trim();
    const type = this.currentType("ph");
    const hint = document.getElementById("ph_modelHint");
    if (!endpoint || !apiKey) {
      hint.style.display = "block";
      hint.style.color = "var(--danger)";
      hint.textContent = "✕ 请先填写 API 地址与 API Key，再获取模型列表";
      return;
    }
    const btn = document.getElementById("ph_fetchBtn");
    btn.disabled = true;
    btn.textContent = "获取中…";
    try {
      const models = type === "gemini" ? await fetchGeminiModels(endpoint, apiKey) : await fetchOpenAIModels(endpoint, apiKey);
      if (!models.length) throw new Error("接口未返回任何模型（可能不支持列表查询，请手填模型名）");
      const select = document.getElementById("ph_modelSelect");
      select.innerHTML = models.map((m) => `<option value="${this.esc(m)}">${this.esc(m)}</option>`).join("");
      select.style.display = "block";
      hint.style.display = "block";
      hint.style.color = "";
      hint.textContent = `✓ 已获取 ${models.length} 个模型，从下拉中选择即可（也可继续手填）`;
    } catch (err) {
      hint.style.display = "block";
      hint.style.color = "var(--danger)";
      hint.textContent = `✕ ${err.message}（可检查地址是否需含 /v1，或直接手填模型名）`;
    } finally {
      btn.disabled = false;
      btn.textContent = "获取";
    }
  },
  /** 第六接口：下拉选中 → 同步输入框 */
  pickPhModel(v) {
    document.getElementById("ph_model").value = v;
  },
  resetPhModelList() {
    const select = document.getElementById("ph_modelSelect");
    const hint = document.getElementById("ph_modelHint");
    if (select) {
      select.innerHTML = "";
      select.style.display = "none";
    }
    if (hint) {
      hint.style.display = "none";
      hint.textContent = "";
    }
  },
  /** 快捷复用：把主接口配置填入手机分身表单 */
  copyMainToPh() {
    var _a;
    document.getElementById("ph_provider").value = document.getElementById("cfg_provider").value;
    document.getElementById("ph_endpoint").value = document.getElementById("cfg_endpoint").value;
    document.getElementById("ph_key").value = document.getElementById("cfg_key").value;
    document.getElementById("ph_model").value = document.getElementById("cfg_model").value;
    document.getElementById("ph_reuseMain").checked = false;
    this.updateProviderUI("ph");
    this.resetPhModelList();
    (_a = window.showToast) == null ? void 0 : _a.call(window, "已把主接口配置填入手机分身（社交模拟是小活，换个便宜模型更划算）", "info");
    this.refreshApiCardStates();
  },
  /** 快捷复用：把变量AI（第三接口）配置填入手机分身表单 */
  copyVarToPh() {
    var _a, _b, _c, _d;
    const c = ((_b = (_a = window.VariableAI) == null ? void 0 : _a.get) == null ? void 0 : _b.call(_a)) || {};
    if (!(c.endpoint && c.apiKey)) {
      (_c = window.showToast) == null ? void 0 : _c.call(window, "变量AI尚未配置完整，无法复用", "error");
      return;
    }
    document.getElementById("ph_provider").value = this.detectProvider(c);
    document.getElementById("ph_endpoint").value = c.endpoint || "";
    document.getElementById("ph_key").value = c.apiKey || "";
    document.getElementById("ph_model").value = c.model || "";
    document.getElementById("ph_reuseMain").checked = false;
    this.updateProviderUI("ph");
    this.resetPhModelList();
    (_d = window.showToast) == null ? void 0 : _d.call(window, "已复用变量AI配置（社交模拟与状态登记共用廉价模型正好）", "info");
    this.refreshApiCardStates();
  },
  /** 快捷复用：把额外API（动态世界）配置填入手机分身表单 */
  copyExtraToPh() {
    var _a, _b, _c, _d;
    const c = ((_b = (_a = window.DynamicWorld) == null ? void 0 : _a.getExtraApi) == null ? void 0 : _b.call(_a)) || {};
    if (!(c.endpoint && c.apiKey)) {
      (_c = window.showToast) == null ? void 0 : _c.call(window, "动态世界额外API尚未配置完整，无法复用", "error");
      return;
    }
    document.getElementById("ph_provider").value = this.detectProvider(c);
    document.getElementById("ph_endpoint").value = c.endpoint || "";
    document.getElementById("ph_key").value = c.apiKey || "";
    document.getElementById("ph_model").value = c.model || "";
    document.getElementById("ph_reuseMain").checked = false;
    this.updateProviderUI("ph");
    this.resetPhModelList();
    (_d = window.showToast) == null ? void 0 : _d.call(window, "已复用额外API配置（远方事件与社交动静由同一模型分饰两角）", "info");
    this.refreshApiCardStates();
  },
  /** 第六接口：连通测试（用表单当前值，无需先保存；复用主笔时实际测主笔） */
  async testPhConnection() {
    const PP = window.PhonePanel;
    const result = document.getElementById("ph_testResult");
    if (!PP || !result) return;
    const { api } = this.readPhForm();
    const testApi = api.reuseMain !== false ? (() => {
      const m = this.readForm();
      return { ...api, type: m.type, endpoint: m.endpoint, apiKey: m.apiKey, model: m.model };
    })() : api;
    if (!(testApi.endpoint && testApi.apiKey && testApi.model)) {
      result.className = "test-result error";
      result.textContent = "✕ 请先填写手机分身的地址 / Key / 模型名（或勾选「复用主笔接口」并配好主笔）";
      return;
    }
    result.className = "test-result loading";
    result.textContent = api.reuseMain !== false ? "⏳ 复用主笔模式：正在测试主笔接口…" : "⏳ 正在测试第六接口…";
    try {
      const reply = await PP.callPhoneAPI([
        { role: "user", content: '你好，请只回复 JSON：{"ok":true}' }
      ], testApi);
      result.className = "test-result success";
      result.textContent = `✓ ${api.reuseMain !== false ? "主笔接口（复用）" : "第六接口"}连接成功，模型回复：${String(reply).slice(0, 40)}`;
    } catch (err) {
      result.className = "test-result error";
      result.textContent = `✕ ${err.message}`;
    }
  },
  /** 拉取模型列表（对应原框架 fetchModels） */
  async fetchModels() {
    const endpoint = document.getElementById("cfg_endpoint").value.trim();
    const apiKey = document.getElementById("cfg_key").value.trim();
    const type = this.currentType("cfg");
    if (!endpoint || !apiKey) {
      const hint = document.getElementById("cfg_modelHint");
      hint.style.display = "block";
      hint.textContent = "✕ 请先填写 API 地址与 API Key，再获取模型列表";
      hint.style.color = "var(--danger)";
      return;
    }
    const btn = document.getElementById("cfg_fetchBtn");
    btn.disabled = true;
    btn.textContent = "获取中…";
    try {
      const models = type === "gemini" ? await fetchGeminiModels(endpoint, apiKey) : await fetchOpenAIModels(endpoint, apiKey);
      if (!models.length) throw new Error("接口未返回任何模型（可能不支持列表查询，请手填模型名）");
      this.displayModels(models);
    } catch (err) {
      const hint = document.getElementById("cfg_modelHint");
      hint.style.display = "block";
      hint.style.color = "var(--danger)";
      hint.textContent = `✕ ${err.message}（可检查地址是否需含 /v1，或直接手填模型名）`;
    } finally {
      btn.disabled = false;
      btn.textContent = "获取";
    }
  },
  /** 渲染模型下拉（对应原框架 displayModels，当前已填模型自动选中） */
  displayModels(models) {
    const select = document.getElementById("cfg_modelSelect");
    const hint = document.getElementById("cfg_modelHint");
    const current = document.getElementById("cfg_model").value.trim();
    select.innerHTML = "";
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      if (m === current) opt.selected = true;
      select.appendChild(opt);
    }
    if (!current && models.length) {
      select.value = models[0];
      document.getElementById("cfg_model").value = models[0];
    }
    select.style.display = "block";
    hint.style.display = "block";
    hint.style.color = "var(--ok)";
    hint.textContent = `✓ 已获取 ${models.length} 个模型，从下拉中选择即可（也可继续手填）`;
  },
  /** 下拉选中 → 同步到输入框 */
  pickModel(v) {
    document.getElementById("cfg_model").value = v;
  },
  resetModelList() {
    const select = document.getElementById("cfg_modelSelect");
    const hint = document.getElementById("cfg_modelHint");
    if (select) {
      select.innerHTML = "";
      select.style.display = "none";
    }
    if (hint) {
      hint.style.display = "none";
      hint.textContent = "";
    }
  },
  fillForm() {
    var _a;
    const fw = window.storyFramework;
    const c = fw.apiConfig;
    document.getElementById("cfg_provider").value = this.detectProvider(c);
    document.getElementById("cfg_endpoint").value = c.endpoint || "";
    document.getElementById("cfg_key").value = c.apiKey || "";
    document.getElementById("cfg_model").value = c.model || "";
    document.getElementById("cfg_maxTokens").value = c.maxTokens || 16384;
    document.getElementById("cfg_temperature").value = (_a = c.temperature) != null ? _a : 0.9;
    document.getElementById("cfg_timeout").value = c.timeout || 300;
    document.getElementById("cfg_stream").checked = c.stream !== false;
    this.updateProviderUI("cfg");
    this.fillDynamicWorldForm();
    this.fillVarAIForm();
    this.fillImgForm();
    this.fillPeForm();
    this.fillPhForm();
    this.renderCSSection();
    this.renderMMSection();
    this.renderVecSection();
    this.renderThemeSection();
    this.renderVaultSection();
    this.refreshApiCardStates();
  },
  readForm() {
    const clamp = (v, min, max, dft) => {
      const n = parseInt(v);
      return isNaN(n) ? dft : Math.min(max, Math.max(min, n));
    };
    return {
      provider: document.getElementById("cfg_provider").value,
      type: this.currentType("cfg"),
      endpoint: document.getElementById("cfg_endpoint").value.trim(),
      apiKey: document.getElementById("cfg_key").value.trim(),
      model: document.getElementById("cfg_model").value.trim(),
      // v1.6.8 修复：主笔 maxTokens 此前无 clamp（负数/超大值直通 API → 400），
      // temperature 的 || 会把合法的 0 吞成 0.9
      maxTokens: clamp(document.getElementById("cfg_maxTokens").value, 256, 131072, 16384),
      temperature: this.clampTemp(document.getElementById("cfg_temperature").value, 0.9),
      timeout: clamp(document.getElementById("cfg_timeout").value, 60, 1800, 300),
      stream: document.getElementById("cfg_stream").checked
    };
  },
  save() {
    var _a;
    const fw = window.storyFramework;
    fw.apiConfig = { ...fw.apiConfig, ...this.readForm() };
    fw.saveApiConfig();
    /* v3.51.1：设置页里的向量检索也随「保存全部配置」一起落盘，
       免得改完忘了点那块小号的「保存」 */
    if (window.KBVector && document.getElementById("cfgVecKey")) {
      try { window.KBVector.saveFromUI("cfgVec", true); } catch (e) {}
    }
    let dwMsg = "";
    const dw = window.DynamicWorld;
    if (dw) {
      const { extra, settings } = this.readDynamicWorldForm();
      dw.saveExtraApi({ ...dw.getExtraApi(), ...extra, enabled: !!(extra.endpoint && extra.apiKey && extra.model) });
      dw.saveSettings(settings);
      if (settings.enabled && !(extra.endpoint && extra.apiKey && extra.model)) {
        dwMsg = "🌍 动态世界已勾选启用，但额外 API 尚未填全（地址 / Key / 模型），暂不会触发生成。";
      } else if (settings.enabled) {
        dwMsg = `🌍 动态世界已启用：每 ${settings.interval} 轮正文由第二模型自动推演远方事件。`;
      }
    }
    let vaMsg = "";
    const va = window.VariableAI;
    if (va) {
      const cfg = this.readVarAIForm();
      va.save({ ...va.get(), ...cfg });
      if (cfg.enabled && !(cfg.endpoint && cfg.apiKey && cfg.model)) {
        vaMsg = "🧾 变量AI已勾选启用，但第三接口尚未填全（地址 / Key / 模型），暂不会分流。";
      } else if (cfg.enabled) {
        vaMsg = "🧾 变量AI已启用：主笔只写正文，状态由第三模型自动登记。";
      } else if (cfg.fallbackMain) {
        vaMsg = va.isFallbackActive() ? "🧾 变量AI未启用，主笔兜底生效中：状态登记改由主笔接口执行，正文 NPC 照常建档。" : "🧾 变量AI未启用，主笔兜底待主接口配置后生效（正文 NPC 登记走主笔）。";
      }
    }
    let imgMsg = "";
    const IG = window.StoryImageGen;
    if (IG) {
      const { api, settings } = this.readImgForm();
      IG.save({ ...IG.get(), ...api });
      IG.saveSettings(settings);
      if (settings.enabled && !IG.isConfigured()) {
        imgMsg = api.mode === "ink" ? "🖼 插图引擎已勾选启用，文墨模式复用主笔接口但主笔尚未配置完整（🎭 主笔 AI 的地址 / Key / 模型）。" : "🖼 插图引擎已勾选启用，但第四接口尚未填全（地址 / Key / 模型），主笔暂不会输出插图标记。";
      } else if (settings.enabled) {
        imgMsg = `🖼 插图引擎已启用：主笔正文中输出插图标记，每章上限 ${settings.maxPerChapter} 张${settings.autoGen ? "，渲染后自动生成" : "（手动点击生成）"}。` + (api.mode === "ink" ? "文墨画师模式：零生图 API 成本，由文本模型手写 SVG 插图。" : "");
      }
    }
    let peMsg = "";
    const PE = window.StoryPromptEngineer;
    if (PE) {
      const cfg = this.readPeForm();
      PE.save(cfg);
      if (cfg.enabled && !(cfg.endpoint && cfg.apiKey && cfg.model)) {
        peMsg = "✍ 提示词工程师已勾选启用，但第五接口尚未填全（地址 / Key / 模型），插图暂用原始描述直接生图。";
      } else if (cfg.enabled) {
        peMsg = "✍ 提示词工程师已启用：每章插图提示词先批量润色扩写，再送生图模型（同一提示词只调用一次）。";
      }
    }
    let phMsg = "";
    const PP = window.PhonePanel;
    if (PP && document.getElementById("ph_enabled")) {
      const { api, settings } = this.readPhForm();
      PP.saveApi({ ...PP.getApi(), ...api });
      PP.saveSettings({ ...PP.getSettings(), ...settings });
      (_a = PP.updateDock) == null ? void 0 : _a.call(PP);
      if (settings.enabled && !PP.isApiReady()) {
        phMsg = "📱 手机分身已勾选启用，但接口尚未就绪：复用主笔需先配好主笔三件套，或取消复用填独立配置。";
      } else if (settings.enabled) {
        phMsg = `📱 手机分身已启用：每 ${settings.interval} 轮正文自动刷新来信与朋友圈（1983 年前的时代自动无手机）。`;
      }
    }
    this.close();
    window.StoryResponseHandler.renderSystemMessage("✓ AI 接口配置已保存，可以开始创作了。" + (dwMsg ? "\n" + dwMsg : "") + (vaMsg ? "\n" + vaMsg : "") + (imgMsg ? "\n" + imgMsg : "") + (peMsg ? "\n" + peMsg : "") + (phMsg ? "\n" + phMsg : ""), "success");
  },
  async testConnection() {
    const result = document.getElementById("cfg_testResult");
    const cfg = this.readForm();
    result.className = "test-result loading";
    result.textContent = "⏳ 正在测试连接…";
    try {
      const reply = await testApiConnection(cfg.endpoint, cfg.apiKey, cfg.model, cfg.type, cfg.maxTokens);
      result.className = "test-result success";
      result.textContent = `✓ 连接成功，模型回复：${String(reply).slice(0, 40)}`;
    } catch (err) {
      result.className = "test-result error";
      result.textContent = `✕ ${err.message}（注意浏览器直连需接口允许 CORS，或使用本地 one-api/new-api 代理）`;
    }
  }
};
window.ConfigModal = ConfigModal;
