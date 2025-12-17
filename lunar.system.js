// ==========================================================================
// lunar.system.js - 核心邏輯系統
// 說明：此模組負責資料抓取、處理、DOM 操作與圖片載入邏輯
// ==========================================================================

// --------------------------------------------------------------------------
// 1. Lunar 工具庫
// 提供通用的輔助函式，與業務邏輯解耦
// --------------------------------------------------------------------------
const Lunar = {
  state: {}, // 全域狀態暫存
  
  // 簡化 DOM 選擇器 (類似 jQuery)
  qs: (s, p = document) => p.querySelector(s),
  qsa: (s, p = document) => [...p.querySelectorAll(s)], // 回傳陣列而非 NodeList
  
  // 合併排序法 (Merge Sort) - 用於大量資料的穩定排序
  mergeSort: (arr, compare = (a, b) => a - b) => {
    if (arr.length <= 1) return arr;
    const mid = Math.floor(arr.length / 2);
    const left = Lunar.mergeSort(arr.slice(0, mid), compare);
    const right = Lunar.mergeSort(arr.slice(mid), compare);
    
    const merged = [];
    let i = 0, j = 0;
    while (i < left.length && j < right.length) {
      merged.push(compare(left[i], right[j]) <= 0 ? left[i++] : right[j++]);
    }
    return [...merged, ...left.slice(i), ...right.slice(j)];
  },
  
  // HTML 跳脫字元，防止 XSS 攻擊
  escape: str => String(str || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#039;'
  }[char])),
  
  // 文字格式化：將換行符號轉為 <br>
  formatText: (text, keepBreaks = false) => {
    const safe = Lunar.escape(String(text || ''));
    return keepBreaks ? safe.replace(/\n/g, '<br>') : safe;
  },
  
  // 防抖動函式 (Debounce) - 用於搜尋輸入，避免每打一個字就觸發搜尋
  debounce: (fn, delay) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
};

// --------------------------------------------------------------------------
// 2. CardSystem 卡片系統核心
// --------------------------------------------------------------------------
const CardSystem = {
  // [設定區] 請在此修改 Google Sheet ID 與欄位對應
  config: {
    sheetId: '1CF9hUYU5Kowvv2j8Um3pJ1P21MHnoCCvIZwFhry7vps', // Google Sheet ID
    gid: 0, // 工作表 ID (通常第一個是 0)
    imageDir: 'image/', // 圖片存放路徑
    
    // 欄位對映：[關鍵字, 中文備用名]
    // 系統會自動在 Excel 標題列中模糊比對這些欄位
    fields: {
      title: ['TITLE', '標題'],
      body: ['BODY', '內容'],
      cover: ['COVER_BG_KEY', '封面'],
      chapter: ['CHAPTER', '章節'],
      level: ['LEVEL', '層級'] // 用於區分是「章節卡片」還是「子節點」
    }
  },
  
  // [資料區] 執行時期的狀態
  data: {
    raw: [],           // 原始 Excel 資料
    chapters: new Map(), // 整理後的章節 Map
    searchIndex: new Map(), // 搜尋索引
    fields: null,      // 實際偵測到的欄位名稱
    cacheKey: 'cardSystem_cache', // localStorage 鍵名
    cacheExpiry: 5 * 60 * 1000    // 快取過期時間 (5分鐘)
  },
  
  // DOM 元素快取
  dom: {},
  
  // [初始化] 程式入口點
  async init() {
    await this.setupDOM(); // 根據頁面建立 HTML 結構
    
    // 判斷是否為「卡片詳細頁」，只有詳細頁才需要載入大量資料
    const isDetailsPage = location.pathname.includes('details');
    
    if (isDetailsPage) {
      await this.loadData(); // 下載資料
      this.bindEvents();     // 綁定互動事件
      this.renderCards();    // 渲染卡片
    }
  },
  
  // [建立 DOM] 根據頁面動態注入 HTML
  async setupDOM() {
    const app = Lunar.qs('#app');
    if (!app) return;
    
    const isDetailsPage = location.pathname.includes('details');
    
    // 詳細頁面 (卡片庫) 的 HTML 結構
    if (isDetailsPage) {
      app.innerHTML = `
        <header class="app-bar">
          <div class="container app-bar__container">
            <div class="brand">
              <h1 class="brand__title">人性輓歌</h1>
              <p class="brand__subtitle">劇情卡片庫</p>
            </div>
            <nav class="navigation">
              <a href="./index.html" class="navigation__link">首頁</a>
              <a href="./details.html" class="navigation__link navigation__link--active">卡片庫</a>
            </nav>
          </div>
        </header>
        
        <main class="container">
          <div class="toolbar">
            <div class="toolbar__left">
              <h2 class="toolbar__title">劇情卡片庫</h2>
              <p class="toolbar__description">瀏覽所有章節卡片，點擊查看詳細內容</p>
            </div>
            <div class="toolbar__right">
              <div class="search">
                <label class="search__label">搜尋卡片</label>
                <input type="search" class="search__input" placeholder="輸入關鍵字搜尋..." id="searchInput">
              </div>
              <select class="select" id="sortSelect">
                <option value="chapter_asc">章節名稱 (A-Z)</option>
                <option value="chapter_desc">章節名稱 (Z-A)</option>
                <option value="count_desc">卡片數量 (多到少)</option>
                <option value="count_asc">卡片數量 (少到多)</option>
              </select>
            </div>
          </div>
          
          <div id="statusBox" class="status">
            <div class="status__spinner"></div>
            <p>載入資料中...</p>
          </div>
          
          <div id="cardsRoot" class="grid grid--auto mt-4"></div>
        </main>
        
        <footer class="footer">
          <div class="container footer__container">
            <p class="footer__text">© ${new Date().getFullYear()} 人性輓歌:文明自毀白皮書</p>
          </div>
        </footer>
        
        <div id="modal" class="modal">
          <div class="modal__backdrop" data-action="close"></div>
          <div class="modal__panel"></div>
        </div>
      `;
    } else {
      // 首頁 (Landing Page) 的 HTML 結構
      app.innerHTML = `
        <header class="app-bar">
          <div class="container app-bar__container">
            <div class="brand">
              <h1 class="brand__title">人性輓歌</h1>
              <p class="brand__subtitle">文明自毀白皮書</p>
            </div>
            <nav class="navigation">
              <a href="./index.html" class="navigation__link navigation__link--active">首頁</a>
              <a href="./details.html" class="navigation__link">卡片庫</a>
            </nav>
          </div>
        </header>
        
        <main class="container">
          <section class="hero-section">
            <article class="card hero-card">
              <div class="hero-card__content">
                <h2 class="hero-title">《人性輓歌：文明自毀白皮書》</h2>
                <p class="hero-subtitle">—— 一款關於選擇、代價與文明的敘事遊戲</p>
                
                <div class="mt-3">
                  <p>在這款遊戲中，你將扮演一個文明的觀察者與決策者。</p>
                  <p>從繁榮的頂點到寂靜的終局，你將透過一連串關鍵選擇，親手推動——或嘗試挽救——一個走向自我毀滅的世界。</p>
                </div>
                
                <h3 class="section-title">遊戲核心體驗：</h3>
                <ul class="bullet-list">
                  <li class="bullet-list__item"><strong>沉浸式決策系統：</strong>在資源、人性、科技與道德的衝突中做出選擇，每個決定都將影響文明的走向。</li>
                  <li class="bullet-list__item"><strong>五維人性光譜：</strong>你的選擇將被歸納為「創造 vs 貪婪」「團結 vs 排外」「智慧 vs 狡詐」「謹慎 vs 殘暴」「利他 vs 自私」，逐步描繪出文明的心靈圖景。</li>
                  <li class="bullet-list__item"><strong>多層敘事結構：</strong>從宏觀政策到微觀人性，從數字交易到生存掙扎，見證文明如何在看似合理的每一步中，走向無法回頭的深淵。</li>
                  <li class="bullet-list__item"><strong>沒有標準答案：</strong>這不是關於「對錯」的測試，而是關於「代價」的反思——誰來承擔？誰被記住？誰被遺忘？</li>
                </ul>
                
                <h3 class="section-title">故事序幕：</h3>
                <div>
                  <p>世界並未毀於隕石或戰爭，</p>
                  <p>而是毀於我們每日做出的、那些「合理」的選擇。</p>
                  <p>從火種到高牆，從繁榮到崩潰，從團結到分裂——</p>
                  <p>這是一份記錄文明如何親手寫下自己輓歌的檔案。</p>
                </div>
                
                <p class="text-center mt-4 mb-4 text-primary" style="font-weight: 700; font-size: 1.25rem;">你準備好了嗎？</p>
                <p class="text-center">翻開這本《人性輓歌：文明自毀白皮書》，</p>
                <p class="text-center">開始你的覆盤——</p>
                <p class="text-center mb-4">或你的審判。</p>
                
                <div class="text-center">
                  <a href="./details.html" class="button button--primary">進入卡片庫</a>
                </div>
              </div>
            </article>
          </section>
          
          <section class="note-box">
            <h4 class="note-box__title">提示</h4>
            <p class="note-box__text">遊戲劇情卡片資料將從 Google Sheet 讀取並渲染成卡片。若圖片連結缺失或失效，將以image資料夾替代圖示顯示。</p>
          </section>
        </main>
        
        <footer class="footer">
          <div class="container footer__container">
            <p class="footer__text">© ${new Date().getFullYear()} 人性輓歌:文明自毀白皮書</p>
          </div>
        </footer>
      `;
    }
    
    // 綁定 DOM 元素到變數，方便後續操作
    this.dom = {
      app,
      modal: Lunar.qs('#modal'),
      modalPanel: Lunar.qs('.modal__panel'),
      cardsRoot: Lunar.qs('#cardsRoot'),
      search: Lunar.qs('#searchInput'),
      sort: Lunar.qs('#sortSelect'),
      statusBox: Lunar.qs('#statusBox')
    };
  },
  
  // [載入資料] 從 Google Sheets 抓取
  async loadData() {
    this.showLoading(true);
    
    try {
      // 1. 檢查快取 (LocalStorage)
      const cachedData = this.getCachedData();
      if (cachedData) {
        this.data.raw = cachedData.raw;
        this.data.fields = cachedData.fields;
        this.processData();
        this.showLoading(false);
        return;
      }
      
      // 2. 設定逾時 Promise (8秒)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('載入超時')), 8000);
      });
      
      // 3. 建構 Google Visualization API URL (這是個技巧，不需 API Key 即可取得 JSON)
      const url = `https://docs.google.com/spreadsheets/d/${this.config.sheetId}/gviz/tq?tqx=out:json&gid=${this.config.gid}&tq=select *`;
      
      const fetchPromise = fetch(url).then(response => {
        if (!response.ok) throw new Error('網路請求失敗');
        return response.text();
      });
      
      // 4. 競速：看是資料先回來還是先逾時
      const text = await Promise.race([fetchPromise, timeoutPromise]);
      
      // 5. 解析資料 (Google 回傳的 JSON 包在 google.visualization.Query.setResponse(...) 裡面，需擷取)
      const jsonText = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const data = JSON.parse(jsonText);
      
      if (data.status !== 'ok') throw new Error('Google Sheets 回應錯誤');
      
      this.data.raw = this.parseSheetData(data.table);
      
      // 6. 寫入快取
      this.cacheData({
        raw: this.data.raw,
        fields: this.detectFields(),
        timestamp: Date.now()
      });
      
      this.processData();
      
    } catch (error) {
      console.error('資料載入失敗:', error);
      
      // 如果失敗，嘗試讀取過期的快取當作備案
      const cachedData = this.getCachedData();
      if (cachedData) {
        this.data.raw = cachedData.raw;
        this.data.fields = cachedData.fields;
        this.processData();
      } else {
        this.showError(error.message === '載入超時' ? 
          '載入超時，請檢查網路連線' : 
          '資料載入失敗，請稍後再試');
      }
    } finally {
      this.showLoading(false);
    }
  },
  
  // 檢查快取是否有效
  getCachedData() {
    try {
      const cached = localStorage.getItem(this.data.cacheKey);
      if (!cached) return null;
      
      const data = JSON.parse(cached);
      const now = Date.now();
      
      // 檢查是否過期
      if (now - data.timestamp > this.data.cacheExpiry) {
        localStorage.removeItem(this.data.cacheKey);
        return null;
      }
      
      return data;
    } catch (e) {
      return null;
    }
  },
  
  cacheData(data) {
    try {
      localStorage.setItem(this.data.cacheKey, JSON.stringify(data));
    } catch (e) {
      console.warn('無法儲存快取:', e);
    }
  },
  
  // 將 Google Sheets 的複雜結構轉換為簡單的物件陣列
  parseSheetData(table) {
    const cols = table.cols || [];
    const rows = table.rows || [];
    
    const labels = cols.map(col => col?.label?.trim() || '');
    
    return rows.map((row, idx) => {
      const obj = { __idx: idx };
      const cells = row.c || [];
      
      for (let i = 0; i < labels.length; i++) {
        const cell = cells[i];
        // v 是值 (value), f 是格式化後的文字 (formatted)
        obj[labels[i]] = cell ? (cell.v ?? cell.f ?? '') : '';
      }
      
      return obj;
    });
  },
  
  // [資料處理] 將原始資料分組為「章節」
  processData() {
    if (!this.data.raw.length) return;
    
    const fields = this.detectFields();
    this.data.fields = fields;
    
    this.data.chapters.clear();
    this.data.searchIndex.clear();
    
    const chapterMap = new Map();
    
    for (let i = 0; i < this.data.raw.length; i++) {
      const row = this.data.raw[i];
      const chapterName = (row[fields.chapter] || '未命名').trim();
      const level = fields.level ? (row[fields.level] || '').toLowerCase() : '';
      
      // 如果這個章節還沒建立，先初始化結構
      if (!chapterMap.has(chapterName)) {
        chapterMap.set(chapterName, {
          name: chapterName,
          cards: [],
          outerCards: [], // 主要卡片
          nodeCards: [],  // 子節點卡片
          total: 0,
          heroCard: null, // 用於代表該章節的封面卡片
          searchText: ''  // 用於搜尋的字串索引
        });
      }
      
      const chapter = chapterMap.get(chapterName);
      chapter.cards.push(row);
      chapter.total++;
      
      // 將卡片內容加入搜尋索引
      chapter.searchText += ' ' + Object.values(row).join(' ');
      
      // 分類：是節點還是主卡
      if (level === 'node') {
        chapter.nodeCards.push(row);
      } else {
        chapter.outerCards.push(row);
        if (!chapter.heroCard) chapter.heroCard = row; // 第一張主卡當作封面
      }
    }
    
    // 後處理：建立最終 Map
    chapterMap.forEach((chapter, name) => {
      if (!chapter.heroCard && chapter.cards.length > 0) {
        chapter.heroCard = chapter.cards[0];
      }
      
      // 正規化搜尋文字 (轉小寫、去空白)
      chapter.searchText = chapter.searchText
        .toLowerCase()
        .replace(/\s+/g, '');
      
      this.data.chapters.set(name, chapter);
      this.data.searchIndex.set(name, chapter.searchText);
    });
  },
  
  // 自動偵測欄位名稱 (模糊比對)
  detectFields() {
    if (!this.data.raw.length) return {};
    
    const sample = this.data.raw[0];
    const keys = Object.keys(sample);
    const keyMap = new Map(keys.map(k => [k.toLowerCase(), k]));
    
    const resolve = (candidates) => {
      for (const cand of candidates) {
        if (keys.includes(cand)) return cand;
        
        const lowerKey = keyMap.get(cand.toLowerCase());
        if (lowerKey) return lowerKey;
        
        for (const key of keys) {
          if (key.toLowerCase().includes(cand.toLowerCase())) {
            return key;
          }
        }
      }
      return null;
    };
    
    return {
      title: resolve(this.config.fields.title) || 'TITLE',
      body: resolve(this.config.fields.body) || 'BODY',
      cover: resolve(this.config.fields.cover) || 'COVER_BG_KEY',
      chapter: resolve(this.config.fields.chapter) || 'CHAPTER',
      level: resolve(this.config.fields.level)
    };
  },
  
  // 切換 Loading 顯示狀態
  showLoading(isLoading) {
    if (!this.dom.statusBox) return;
    
    if (isLoading) {
      this.dom.statusBox.innerHTML = `
        <div class="status__spinner"></div>
        <p>載入資料中...</p>
      `;
      this.dom.statusBox.style.display = 'block';
      
      if (this.dom.cardsRoot) {
        this.dom.cardsRoot.innerHTML = '';
      }
    } else {
      this.dom.statusBox.style.display = 'none';
    }
  },
  
  // 綁定 UI 事件
  bindEvents() {
    // 搜尋輸入 (含防抖動)
    if (this.dom.search) {
      this.dom.search.addEventListener('input', Lunar.debounce(e => {
        Lunar.state.searchQuery = e.target.value.toLowerCase().trim();
        this.renderCards();
      }, 300));
    }
    
    // 排序選單
    if (this.dom.sort) {
      this.dom.sort.addEventListener('change', e => {
        Lunar.state.sortMode = e.target.value;
        this.renderCards();
      });
    }
    
    // 事件委派：處理動態生成的按鈕點擊
    document.addEventListener('click', e => {
      const openBtn = e.target.closest('.open-chapter');
      if (openBtn) {
        const chapter = openBtn.dataset.chapter;
        if (chapter) this.openModal(chapter);
        return;
      }
      
      if (e.target.closest('[data-action="close"]')) {
        this.closeModal();
        return;
      }
    });
    
    // 鍵盤 ESC 關閉 Modal
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.dom.modal?.classList.contains('modal--open')) {
        this.closeModal();
      }
    });
  },
  
  // [渲染流程] 主入口
  renderCards() {
    if (!this.dom.cardsRoot) return;
    
    this.showSkeleton(); // 先顯示骨架屏
    
    // 使用 setTimeout 讓 UI 線程先繪製骨架屏，避免卡頓
    setTimeout(() => {
      let chapters = Array.from(this.data.chapters.values());
      
      // 1. 搜尋過濾
      const query = Lunar.state.searchQuery || '';
      if (query) {
        chapters = chapters.filter(chapter => 
          chapter.searchText.includes(query)
        );
      }
      
      // 2. 排序
      chapters = this.sortChapters(chapters, Lunar.state.sortMode);
      
      // 3. 空狀態處理
      if (chapters.length === 0) {
        this.dom.cardsRoot.innerHTML = '<p class="text-center">找不到符合條件的卡片</p>';
        return;
      }
      
      // 4. 開始批次渲染
      this.renderChaptersInBatch(chapters);
    }, 50);
  },
  
  // 顯示骨架屏 (Skeleton)
  showSkeleton() {
    if (!this.dom.cardsRoot) return;
    
    const skeletonCount = 6;
    let skeletonHTML = '';
    
    for (let i = 0; i < skeletonCount; i++) {
      skeletonHTML += `
        <article class="card skeleton">
          <div class="card__media skeleton-media"></div>
          <div class="card__content">
            <div class="card__title skeleton-text" style="width: 80%"></div>
            <div class="card__meta">
              <span class="meta-chip skeleton-text" style="width: 40%"></span>
            </div>
            <div class="card__description">
              <div class="skeleton-text" style="width: 100%"></div>
              <div class="skeleton-text" style="width: 90%"></div>
              <div class="skeleton-text" style="width: 70%"></div>
            </div>
            <div class="card__actions">
              <button class="button button--primary skeleton-button"></button>
            </div>
          </div>
        </article>
      `;
    }
    
    this.dom.cardsRoot.innerHTML = skeletonHTML;
  },
  
  // [批次渲染] 解決大量 DOM 插入造成的卡頓
  renderChaptersInBatch(chapters, batchSize = 10) {
    let rendered = 0;
    
    const renderBatch = () => {
      const batchEnd = Math.min(rendered + batchSize, chapters.length);
      const batch = chapters.slice(rendered, batchEnd);
      
      // 第一批次時清空骨架屏
      if (rendered === 0) {
        this.dom.cardsRoot.innerHTML = '';
      }
      
      const fragment = document.createDocumentFragment();
      
      batch.forEach(chapter => {
        const cardHTML = this.renderChapterCard(chapter);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cardHTML;
        
        const cardElement = tempDiv.firstElementChild;
        if (cardElement) {
          fragment.appendChild(cardElement);
        }
      });
      
      this.dom.cardsRoot.appendChild(fragment);
      rendered = batchEnd;
      
      this.loadImages(); // 觸發圖片載入動畫
      
      // 如果還有下一批，用 setTimeout 排程到下一個 Event Loop
      if (rendered < chapters.length) {
        setTimeout(renderBatch, 50);
      }
    };
    
    renderBatch();
  },
  
  // 監聽圖片載入事件，加上 loaded class 觸發淡入動畫
  loadImages() {
    const images = this.dom.cardsRoot.querySelectorAll('.card__image');
    
    images.forEach((img, index) => {
      img.onload = () => {
        img.classList.add('loaded');
      };
      
      // 如果圖片從快取讀取 (已經 complete)，直接顯示
      if (img.complete) {
        img.classList.add('loaded');
      }
    });
  },
  
  sortChapters(chapters, mode) {
    const compare = {
      chapter_asc: (a, b) => a.name.localeCompare(b.name, 'zh-Hant'),
      chapter_desc: (a, b) => b.name.localeCompare(a.name, 'zh-Hant'),
      count_desc: (a, b) => b.total - a.total,
      count_asc: (a, b) => a.total - b.total
    }[mode] || ((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    
    return chapters.sort(compare);
  },
  
  // [核心] 圖片渲染與格式 fallback 邏輯
  renderImage(coverKey, alt, isLarge = false) {
      // 1. 防呆
      if (!coverKey) {
        return '<div class="card__image-placeholder"></div>';
      }
      
      // 2. 檔名處理：取出純檔名，移除路徑和副檔名
      let base = coverKey.replace(/^\/+/, '').split('?')[0].split('#')[0];
      const parts = base.split('/');
      let filename = parts[parts.length - 1];
      
      filename = filename.replace(/\.[^/.]+$/, '');
      filename = encodeURIComponent(decodeURIComponent(filename));
      
      if (!filename) {
        return '<div class="card__image-placeholder"></div>';
      }

      // 3. 定義「候補清單」：WebP (快) -> JPG -> PNG ...
      const extensions = ['webp', 'jpg', 'png', 'jpeg', 'gif'];
      const imagePaths = extensions.map(ext => `${this.config.imageDir}${filename}.${ext}`);
      
      const className = isLarge ? 'modal__image' : 'card__image';
      
      // 4. 生成 HTML (使用 onerror 進行遞迴嘗試)
      // data-index 記錄目前試到第幾種格式
      // onerror 邏輯：當目前格式失敗，就嘗試清單中的下一個
      return `
        <img src="${imagePaths[0]}" 
            class="${className}" 
            alt="${Lunar.escape(alt || '')}" 
            loading="lazy"
            data-index="0"
            onerror="
              const paths = ${JSON.stringify(imagePaths).replace(/"/g, "'")};
              let nextIndex = parseInt(this.dataset.index) + 1;
              this.dataset.index = nextIndex;

              if (nextIndex < paths.length) {
                this.src = paths[nextIndex]; // 嘗試下一個格式
              } else {
                // 全部失敗：隱藏圖片並顯示佔位符
                this.style.display = 'none';
                this.onerror = null; 
                if (this.parentElement) {
                  this.parentElement.innerHTML = '<div class=\'card__image-placeholder\'></div>';
                }
              }
            ">
      `;
  },
  
  // 生成單張卡片 HTML
  renderChapterCard(chapter) {
    const hero = chapter.heroCard;
    const fields = this.data.fields;
    
    const title = hero?.[fields.title] || chapter.name;
    const body = hero?.[fields.body] || '';
    const cover = hero?.[fields.cover] || '';
    
    return `
      <article class="card">
        <div class="card__media">
          ${this.renderImage(cover, title)}
          <div class="media-chip">${Lunar.escape(chapter.name)}</div>
        </div>
        <div class="card__content">
          <h3 class="card__title truncated" title="${Lunar.escape(title)}">
            ${Lunar.escape(title)}
          </h3>
          <div class="card__meta">
            <span class="meta-chip">${chapter.total} 張卡片</span>
            ${chapter.outerCards.length > 0 ? `<span class="meta-chip">${chapter.outerCards.length} 主卡</span>` : ''}
            ${chapter.nodeCards.length > 0 ? `<span class="meta-chip">${chapter.nodeCards.length} 節點</span>` : ''}
          </div>
          <p class="card__description truncated" title="${Lunar.escape(body)}">
            ${Lunar.formatText(body)}
          </p>
          <div class="card__actions">
            <button class="button button--primary open-chapter" 
                    data-chapter="${Lunar.escape(chapter.name)}">
              查看詳細內容
            </button>
          </div>
        </div>
      </article>
    `;
  },
  
  // 開啟詳細內容 Modal
  openModal(chapterName) {
    const chapter = this.data.chapters.get(chapterName);
    if (!chapter) return;
    
    const hero = chapter.heroCard;
    const fields = this.data.fields;
    
    const title = hero?.[fields.title] || chapter.name;
    const cover = hero?.[fields.cover] || '';
    
    // 注入 Modal 內容
    this.dom.modalPanel.innerHTML = `
      <div class="modal__header">
        <h3 class="modal__title">${Lunar.escape(chapter.name)}</h3>
        <button class="modal__close" data-action="close">✕</button>
      </div>
      <div class="modal__body">
        <div class="modal__media">
          ${this.renderImage(cover, title, true)}
        </div>
        <div class="modal__content">
          <div id="readerMeta" class="card__meta mb-3"></div>
          <div id="readerList"></div>
        </div>
      </div>
    `;
    
    // 注入 Meta 資訊
    const meta = Lunar.qs('#readerMeta', this.dom.modalPanel);
    if (meta) {
      meta.innerHTML = `
        <span class="meta-chip">總計: ${chapter.total} 張卡片</span>
        ${chapter.outerCards.length > 0 ? `<span class="meta-chip">章節卡片: ${chapter.outerCards.length}</span>` : ''}
        ${chapter.nodeCards.length > 0 ? `<span class="meta-chip">子節點: ${chapter.nodeCards.length}</span>` : ''}
      `;
    }
    
    // 渲染卡片列表 (閱讀模式)
    const listContainer = Lunar.qs('#readerList', this.dom.modalPanel);
    if (listContainer) {
      this.renderModalCards(chapter, listContainer);
    }
    
    this.dom.modal.classList.add('modal--open');
    document.body.style.overflow = 'hidden'; // 防止背景滾動
  },
  
  renderModalCards(chapter, container) {
    let html = '';
    
    if (chapter.outerCards.length > 0) {
      html += '<h4 class="reader-section__title">章節卡片</h4>';
      for (let i = 0; i < chapter.outerCards.length; i++) {
        html += this.renderModalCard(chapter.outerCards[i], i, 'outer');
      }
    }
    
    if (chapter.nodeCards.length > 0) {
      html += '<h4 class="reader-section__title">子節點</h4>';
      for (let i = 0; i < chapter.nodeCards.length; i++) {
        html += this.renderModalCard(chapter.nodeCards[i], i, 'node');
      }
    }
    
    container.innerHTML = html;
  },
  
  renderModalCard(card, index, type) {
    const fields = this.data.fields;
    const title = card[fields.title] || '未命名';
    const body = card[fields.body] || '';
    const cover = card[fields.cover] || '';
    
    return `
      <article class="reader-card" data-index="${index}" data-type="${type}">
        <div class="reader-card__media">
          ${this.renderImage(cover, title)}
        </div>
        <div class="reader-card__body">
          <h5 class="reader-card__title">${Lunar.escape(title)}</h5>
          <div class="reader-card__text">${Lunar.formatText(body, true)}</div>
        </div>
      </article>
    `;
  },
  
  closeModal() {
    this.dom.modal.classList.remove('modal--open');
    document.body.style.overflow = '';
  },
  
  // 錯誤處理介面
  showError(message) {
    if (this.dom.statusBox) {
      this.dom.statusBox.innerHTML = `
        <div class="status-error">
          <p>${Lunar.escape(message)}</p>
          <button onclick="location.reload()" class="button button--primary mt-2">重新載入</button>
        </div>
      `;
      this.dom.statusBox.style.display = 'block';
    }
  }
};

// 確保 DOM 載入完成後再初始化
document.addEventListener('DOMContentLoaded', () => {
  CardSystem.init().catch(console.error);
});

// 匯出模組供外部使用
window.CardSystem = CardSystem;
window.Lunar = Lunar;

export { CardSystem, Lunar };