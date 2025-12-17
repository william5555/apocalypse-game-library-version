// lunar.system.js - 完整響應式系統（修正圖片載入版）
const Lunar = {
  state: {},
  
  qs: (s, p = document) => p.querySelector(s),
  qsa: (s, p = document) => [...p.querySelectorAll(s)],
  
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
  
  escape: str => String(str || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#039;'
  }[char])),
  
  formatText: (text, keepBreaks = false) => {
    const safe = Lunar.escape(String(text || ''));
    return keepBreaks ? safe.replace(/\n/g, '<br>') : safe;
  },
  
  debounce: (fn, delay) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
};

const CardSystem = {
  config: {
    sheetId: '1CF9hUYU5Kowvv2j8Um3pJ1P21MHnoCCvIZwFhry7vps',
    gid: 0,
    imageDir: 'image/',
    
    fields: {
      title: ['TITLE', '標題'],
      body: ['BODY', '內容'],
      cover: ['COVER_BG_KEY', '封面'],
      chapter: ['CHAPTER', '章節'],
      level: ['LEVEL', '層級']
    }
  },
  
  data: {
    raw: [],
    chapters: new Map(),
    searchIndex: new Map(),
    fields: null,
    cacheKey: 'cardSystem_cache',
    cacheExpiry: 5 * 60 * 1000
  },
  
  dom: {},
  
  async init() {
    await this.setupDOM();
    const isDetailsPage = location.pathname.includes('details');
    
    if (isDetailsPage) {
      await this.loadData();
      this.bindEvents();
      this.renderCards();
    }
  },
  
  async setupDOM() {
    const app = Lunar.qs('#app');
    if (!app) return;
    
    const isDetailsPage = location.pathname.includes('details');
    
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
  
  async loadData() {
    this.showLoading(true);
    
    try {
      const cachedData = this.getCachedData();
      if (cachedData) {
        this.data.raw = cachedData.raw;
        this.data.fields = cachedData.fields;
        this.processData();
        this.showLoading(false);
        return;
      }
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('載入超時')), 8000);
      });
      
      const url = `https://docs.google.com/spreadsheets/d/${this.config.sheetId}/gviz/tq?tqx=out:json&gid=${this.config.gid}&tq=select *`;
      
      const fetchPromise = fetch(url).then(response => {
        if (!response.ok) throw new Error('網路請求失敗');
        return response.text();
      });
      
      const text = await Promise.race([fetchPromise, timeoutPromise]);
      
      const jsonText = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const data = JSON.parse(jsonText);
      
      if (data.status !== 'ok') throw new Error('Google Sheets 回應錯誤');
      
      this.data.raw = this.parseSheetData(data.table);
      
      this.cacheData({
        raw: this.data.raw,
        fields: this.detectFields(),
        timestamp: Date.now()
      });
      
      this.processData();
      
    } catch (error) {
      console.error('資料載入失敗:', error);
      
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
  
  getCachedData() {
    try {
      const cached = localStorage.getItem(this.data.cacheKey);
      if (!cached) return null;
      
      const data = JSON.parse(cached);
      const now = Date.now();
      
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
  
  parseSheetData(table) {
    const cols = table.cols || [];
    const rows = table.rows || [];
    
    const labels = cols.map(col => col?.label?.trim() || '');
    
    return rows.map((row, idx) => {
      const obj = { __idx: idx };
      const cells = row.c || [];
      
      for (let i = 0; i < labels.length; i++) {
        const cell = cells[i];
        obj[labels[i]] = cell ? (cell.v ?? cell.f ?? '') : '';
      }
      
      return obj;
    });
  },
  
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
      
      if (!chapterMap.has(chapterName)) {
        chapterMap.set(chapterName, {
          name: chapterName,
          cards: [],
          outerCards: [],
          nodeCards: [],
          total: 0,
          heroCard: null,
          searchText: ''
        });
      }
      
      const chapter = chapterMap.get(chapterName);
      chapter.cards.push(row);
      chapter.total++;
      
      chapter.searchText += ' ' + Object.values(row).join(' ');
      
      if (level === 'node') {
        chapter.nodeCards.push(row);
      } else {
        chapter.outerCards.push(row);
        if (!chapter.heroCard) chapter.heroCard = row;
      }
    }
    
    chapterMap.forEach((chapter, name) => {
      if (!chapter.heroCard && chapter.cards.length > 0) {
        chapter.heroCard = chapter.cards[0];
      }
      
      chapter.searchText = chapter.searchText
        .toLowerCase()
        .replace(/\s+/g, '');
      
      this.data.chapters.set(name, chapter);
      this.data.searchIndex.set(name, chapter.searchText);
    });
  },
  
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
  
  bindEvents() {
    if (this.dom.search) {
      this.dom.search.addEventListener('input', Lunar.debounce(e => {
        Lunar.state.searchQuery = e.target.value.toLowerCase().trim();
        this.renderCards();
      }, 300));
    }
    
    if (this.dom.sort) {
      this.dom.sort.addEventListener('change', e => {
        Lunar.state.sortMode = e.target.value;
        this.renderCards();
      });
    }
    
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
    
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.dom.modal?.classList.contains('modal--open')) {
        this.closeModal();
      }
    });
  },
  
  renderCards() {
    if (!this.dom.cardsRoot) return;
    
    this.showSkeleton();
    
    setTimeout(() => {
      let chapters = Array.from(this.data.chapters.values());
      
      const query = Lunar.state.searchQuery || '';
      if (query) {
        chapters = chapters.filter(chapter => 
          chapter.searchText.includes(query)
        );
      }
      
      chapters = this.sortChapters(chapters, Lunar.state.sortMode);
      
      if (chapters.length === 0) {
        this.dom.cardsRoot.innerHTML = '<p class="text-center">找不到符合條件的卡片</p>';
        return;
      }
      
      this.renderChaptersInBatch(chapters);
    }, 50);
  },
  
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
  
  renderChaptersInBatch(chapters, batchSize = 10) {
    let rendered = 0;
    
    const renderBatch = () => {
      const batchEnd = Math.min(rendered + batchSize, chapters.length);
      const batch = chapters.slice(rendered, batchEnd);
      
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
      
      this.loadImages();
      
      if (rendered < chapters.length) {
        setTimeout(renderBatch, 50);
      }
    };
    
    renderBatch();
  },
  
  loadImages() {
    const images = this.dom.cardsRoot.querySelectorAll('.card__image');
    
    images.forEach((img, index) => {
      // 確保圖片載入完成後顯示
      img.onload = () => {
        img.classList.add('loaded');
      };
      
      // 如果圖片已經載入（從快取），立即添加 loaded class
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
  
  renderImage(coverKey, alt, isLarge = false) {
      // 1. 防呆：如果沒有 key，直接回傳佔位符
      if (!coverKey) {
        return '<div class="card__image-placeholder"></div>';
      }
      
      // 2. 檔名處理：取出純檔名，移除路徑和原本的副檔名
      // 例如 "image/cover.jpg" 會變成 "cover"
      let base = coverKey.replace(/^\/+/, '').split('?')[0].split('#')[0];
      const parts = base.split('/');
      let filename = parts[parts.length - 1];
      
      // 移除舊的副檔名 (例如 .jpg)，這樣我們才能加上新的 .webp
      filename = filename.replace(/\.[^/.]+$/, '');
      
      // 處理中文檔名編碼，避免瀏覽器讀不懂
      filename = encodeURIComponent(decodeURIComponent(filename));
      
      if (!filename) {
        return '<div class="card__image-placeholder"></div>';
      }

      // 3. 定義「候補清單」 (這就是您要的順位邏輯)
      // 優先順序：WebP (最快) -> JPG (舊的) -> PNG (舊的) -> JPEG -> GIF
      const extensions = ['webp', 'jpg', 'png', 'jpeg', 'gif'];
      
      // 產生所有可能的圖片路徑清單
      const imagePaths = extensions.map(ext => `${this.config.imageDir}${filename}.${ext}`);
      
      const className = isLarge ? 'modal__image' : 'card__image';
      
      // 4. 生成 HTML (核心修改)
      // 我們移除了 srcset，改用 onerror 搭配 data-index 來做「接力賽」
      return `
        <img src="${imagePaths[0]}" 
            class="${className}" 
            alt="${Lunar.escape(alt || '')}" 
            loading="lazy"
            data-index="0"
            onerror="
              // === 圖片載入失敗時的自動救援機制 ===
              // 1. 取得剛剛定義的所有路徑清單
              const paths = ${JSON.stringify(imagePaths).replace(/"/g, "'")};
              
              // 2. 看現在試到第幾張了，準備試下一張
              let nextIndex = parseInt(this.dataset.index) + 1;
              
              // 3. 記錄新的進度
              this.dataset.index = nextIndex;

              // 4. 如果還有下一張可以試，就換路徑
              if (nextIndex < paths.length) {
                this.src = paths[nextIndex];
              } else {
                // 5. 如果全部都試過了還是失敗，隱藏圖片並顯示佔位符
                this.style.display = 'none';
                // 防止 onerror 無限迴圈
                this.onerror = null; 
                if (this.parentElement) {
                  this.parentElement.innerHTML = '<div class=\'card__image-placeholder\'></div>';
                }
              }
            ">
      `;
  },
  
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
  
  openModal(chapterName) {
    const chapter = this.data.chapters.get(chapterName);
    if (!chapter) return;
    
    const hero = chapter.heroCard;
    const fields = this.data.fields;
    
    const title = hero?.[fields.title] || chapter.name;
    const cover = hero?.[fields.cover] || '';
    
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
    
    const meta = Lunar.qs('#readerMeta', this.dom.modalPanel);
    if (meta) {
      meta.innerHTML = `
        <span class="meta-chip">總計: ${chapter.total} 張卡片</span>
        ${chapter.outerCards.length > 0 ? `<span class="meta-chip">章節卡片: ${chapter.outerCards.length}</span>` : ''}
        ${chapter.nodeCards.length > 0 ? `<span class="meta-chip">子節點: ${chapter.nodeCards.length}</span>` : ''}
      `;
    }
    
    const listContainer = Lunar.qs('#readerList', this.dom.modalPanel);
    if (listContainer) {
      this.renderModalCards(chapter, listContainer);
    }
    
    this.dom.modal.classList.add('modal--open');
    document.body.style.overflow = 'hidden';
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

document.addEventListener('DOMContentLoaded', () => {
  CardSystem.init().catch(console.error);
});

window.CardSystem = CardSystem;
window.Lunar = Lunar;

export { CardSystem, Lunar };