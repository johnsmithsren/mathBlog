const fs = require('fs');
const path = require('path');
const marked = require('./vendor/marked.min.js');
const katex = require('./vendor/katex/katex.min.js');

function renderMarkdownToHtml(mdContent, title = '考研数学笔记', allFiles = []) {
    const mathStore = [];
    function saveMath(math, isBlock) {
        const id = mathStore.length;
        mathStore.push({ math, isBlock });
        return isBlock ? `\n\n%%MATH_BLOCK_${id}%%\n\n` : `%%MATH_INLINE_${id}%%`;
    }

    // 1. 保护块级公式 $$...$$
    let text = mdContent.replace(/\$\$([\s\S]*?)\$\$/g, (m, g) => saveMath(g, true));

    // 2. 保护行内公式 $...$
    text = text.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (m, prefix, g) => {
        return prefix + saveMath(g, false);
    });

    // 3. 提取标题生成目录 (TOC)
    const toc = [];
    const lines = text.split('\n');
    let inCode = false;
    for (const line of lines) {
        if (line.trim().startsWith('```')) {
            inCode = !inCode;
            continue;
        }
        if (inCode) continue;
        const hMatch = line.match(/^(#{1,3})\s+(.+)$/);
        if (hMatch) {
            const level = hMatch[1].length;
            let rawText = hMatch[2].trim();
            let plainText = rawText.replace(/%%MATH_(?:BLOCK|INLINE)_(\d+)%%/g, (match, id) => {
                return mathStore[parseInt(id)] ? mathStore[parseInt(id)].math : '';
            });
            const slug = 'heading-' + toc.length;
            toc.push({ level, text: plainText, rawText, slug });
        }
    }

    // 4. marked 转换
    marked.setOptions({
        gfm: true,
        breaks: false
    });
    let html = marked.parse(text);

    // 5. 还原公式并由 KaTeX 渲染
    html = html.replace(/%%MATH_(BLOCK|INLINE)_(\d+)%%/g, (m, type, id) => {
        const item = mathStore[parseInt(id)];
        if (!item) return m;
        const isBlock = type === 'BLOCK';
        try {
            return katex.renderToString(item.math.trim(), {
                displayMode: isBlock,
                throwOnError: false
            });
        } catch (e) {
            return `<span class="katex-error" title="${escapeHtml(e.message)}">[公式解析异常: ${escapeHtml(item.math)}]</span>`;
        }
    });

    // 6. 为标题添加锚点 id
    let headingIndex = 0;
    html = html.replace(/<h([1-3])>([\s\S]*?)<\/h\1>/g, (m, level, content) => {
        const slug = 'heading-' + headingIndex++;
        return `<h${level} id="${slug}">${content} <a class="header-anchor" href="#${slug}" title="直达此小节">#</a></h${level}>`;
    });

    // 7. 生成本篇大纲 HTML
    const tocHtml = toc.map(item => {
        const indentClass = `toc-level-${item.level}`;
        return `<a href="#${item.slug}" class="toc-item ${indentClass}">${escapeHtml(item.text)}</a>`;
    }).join('\n');

    // 8. 生成多章节切换列表
    const chaptersHtml = allFiles.length > 1 ? `
        <div class="sidebar-section-title">📑 笔记章节</div>
        <div class="toc-list" style="border-bottom: 1px solid var(--sidebar-border); margin-bottom: 12px; padding-bottom: 12px;">
            ${allFiles.map(f => {
                const isActive = f.title === title;
                return `<a href="./${encodeURIComponent(f.htmlName)}" class="toc-item ${isActive ? 'active-chapter' : ''}" style="${isActive ? 'font-weight: 700; color: var(--primary-color); background: var(--quote-bg);' : ''}">📄 ${escapeHtml(f.title)}</a>`;
            }).join('\n')}
        </div>
    ` : '';

    return generateFullHtmlPage(title, html, tocHtml, chaptersHtml);
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateFullHtmlPage(title, contentHtml, tocHtml, chaptersHtml = '') {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} - 考研数学复习系统</title>
    <!-- KaTeX 本地离线数学公式样式 -->
    <link rel="stylesheet" href="./vendor/katex/katex.min.css">
    <style>
        :root {
            --bg-color: #fbfcfd;
            --text-color: #1e293b;
            --sidebar-bg: #f8fafc;
            --sidebar-border: #e2e8f0;
            --card-bg: #ffffff;
            --border-color: #e2e8f0;
            --primary-color: #2563eb;
            --primary-hover: #1d4ed8;
            --code-bg: #f1f5f9;
            --quote-bg: #eff6ff;
            --quote-border: #3b82f6;
            --table-header: #f1f5f9;
            --table-stripe: #f8fafc;
            --formula-bg: #f8fafc;
        }

        [data-theme="dark"] {
            --bg-color: #0b1120;
            --text-color: #e2e8f0;
            --sidebar-bg: #151e32;
            --sidebar-border: #24324f;
            --card-bg: #151e32;
            --border-color: #24324f;
            --primary-color: #38bdf8;
            --primary-hover: #0ea5e9;
            --code-bg: #070d18;
            --quote-bg: #122449;
            --quote-border: #38bdf8;
            --table-header: #1f2c47;
            --table-stripe: #151e32;
            --formula-bg: #111a2e;
        }

        [data-theme="eye"] {
            --bg-color: #f3f7f3;
            --text-color: #233423;
            --sidebar-bg: #e6efe6;
            --sidebar-border: #cadaca;
            --card-bg: #fbfdfb;
            --border-color: #cadaca;
            --primary-color: #2e7d32;
            --primary-hover: #1b5e20;
            --code-bg: #e5f0e5;
            --quote-bg: #e8f5e9;
            --quote-border: #4caf50;
            --table-header: #dceadc;
            --table-stripe: #eff7ef;
            --formula-bg: #e9f3e9;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
            font-size: 16px;
            line-height: 1.8;
            color: var(--text-color);
            background-color: var(--bg-color);
            display: flex;
            min-height: 100vh;
            transition: background-color 0.2s, color 0.2s;
        }

        /* 侧边大纲目录 */
        #sidebar {
            width: 290px;
            background: var(--sidebar-bg);
            border-right: 1px solid var(--sidebar-border);
            height: 100vh;
            position: sticky;
            top: 0;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
            transition: transform 0.25s ease;
            z-index: 100;
        }

        .sidebar-header {
            padding: 18px 16px 14px;
            font-size: 1.05rem;
            font-weight: 700;
            color: var(--primary-color);
            border-bottom: 1px solid var(--sidebar-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .sidebar-section-title {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-color);
            opacity: 0.6;
            font-weight: 700;
            padding: 12px 16px 4px;
        }

        .toc-list {
            padding: 8px 10px;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .toc-item {
            text-decoration: none;
            color: var(--text-color);
            opacity: 0.85;
            font-size: 0.88rem;
            padding: 6px 10px;
            border-radius: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            transition: all 0.15s ease;
        }

        .toc-item:hover {
            opacity: 1;
            color: var(--primary-color);
            background: var(--border-color);
            padding-left: 13px;
        }

        .toc-level-1 { font-weight: 700; font-size: 0.92rem; margin-top: 6px; }
        .toc-level-2 { padding-left: 18px; font-size: 0.86rem; }
        .toc-level-3 { padding-left: 30px; font-size: 0.8rem; opacity: 0.75; }

        /* 主体内容区 */
        #main {
            flex: 1;
            min-width: 0;
            padding: 32px 52px 100px;
            max-width: 1020px;
            margin: 0 auto;
        }

        /* 顶部导航控制条 */
        .top-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border-color);
        }

        .badge-box {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .badge {
            display: inline-block;
            padding: 4px 10px;
            font-size: 0.75rem;
            font-weight: 600;
            background: var(--quote-bg);
            color: var(--primary-color);
            border-radius: 12px;
            border: 1px solid var(--border-color);
        }

        .actions {
            display: flex;
            gap: 8px;
        }

        .btn {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            padding: 6px 12px;
            font-size: 0.85rem;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .btn:hover {
            border-color: var(--primary-color);
            color: var(--primary-color);
        }

        /* 文章样式美化 */
        h1, h2, h3, h4 {
            color: var(--text-color);
            position: relative;
            scroll-margin-top: 24px;
        }

        h1 {
            font-size: 2.15rem;
            font-weight: 800;
            margin: 16px 0 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid var(--primary-color);
            letter-spacing: -0.02em;
        }

        h2 {
            font-size: 1.55rem;
            font-weight: 700;
            margin: 44px 0 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
        }

        h3 {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 28px 0 12px;
        }

        .header-anchor {
            text-decoration: none;
            color: var(--primary-color);
            opacity: 0;
            margin-left: 8px;
            font-size: 0.8em;
            transition: opacity 0.2s;
        }

        h1:hover .header-anchor,
        h2:hover .header-anchor,
        h3:hover .header-anchor {
            opacity: 0.6;
        }

        p {
            margin: 14px 0;
            text-align: justify;
        }

        ul, ol {
            margin: 14px 0 14px 24px;
        }

        li {
            margin: 6px 0;
        }

        blockquote {
            margin: 22px 0;
            padding: 14px 18px;
            background: var(--quote-bg);
            border-left: 4px solid var(--quote-border);
            border-radius: 4px;
            font-size: 0.95rem;
        }

        blockquote p {
            margin: 0;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
            font-size: 0.95rem;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }

        th, td {
            padding: 11px 14px;
            border: 1px solid var(--border-color);
            text-align: left;
        }

        th {
            background-color: var(--table-header);
            font-weight: 600;
        }

        tr:nth-child(even) {
            background-color: var(--table-stripe);
        }

        hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 36px 0;
        }

        /* 考研数学公式专用美化 */
        .katex-display {
            background: var(--formula-bg);
            padding: 18px 24px;
            margin: 20px 0 !important;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            overflow-x: auto;
            overflow-y: hidden;
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
            transition: all 0.2s;
        }

        .katex-display:hover {
            border-color: var(--primary-color);
        }

        .katex {
            font-size: 1.08em;
        }

        @media (max-width: 860px) {
            #sidebar {
                position: fixed;
                left: -290px;
            }
            #sidebar.open {
                transform: translateX(290px);
            }
            #main {
                padding: 20px 16px;
            }
            .sidebar-toggle-mobile {
                display: inline-flex !important;
            }
        }

        .sidebar-toggle-mobile {
            display: none;
        }

        @media print {
            #sidebar, .top-bar {
                display: none !important;
            }
            #main {
                max-width: 100% !important;
                padding: 0 !important;
            }
            .katex-display {
                border: none !important;
                box-shadow: none !important;
                background: transparent !important;
            }
        }
    </style>
</head>
<body>
    <div id="sidebar">
        <div class="sidebar-header">
            <span>📚 考研数学复习系统</span>
            <button class="btn" style="padding: 2px 6px; font-size: 0.75rem;" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">回顶部</button>
        </div>
        ${chaptersHtml}
        <div class="sidebar-section-title">📌 当前小节导航</div>
        <div class="toc-list">
            ${tocHtml}
        </div>
    </div>

    <main id="main">
        <div class="top-bar">
            <div class="badge-box">
                <button class="btn sidebar-toggle-mobile" onclick="toggleSidebar()">📖 目录</button>
                <span class="badge">考研数学系统笔记</span>
                <span class="badge">离线 KaTeX 高清排版</span>
            </div>
            <div class="actions">
                <button class="btn" onclick="toggleTheme()" title="切换主题">🎨 <span id="themeText">护眼模式</span></button>
                <button class="btn" onclick="window.print()" title="打印当前复习讲义或导出为高清PDF">🖨️ 打印PDF</button>
            </div>
        </div>

        <article id="content">
            ${contentHtml}
        </article>
    </main>

    <script>
        function toggleSidebar() {
            document.getElementById('sidebar').classList.toggle('open');
        }

        const themes = ['default', 'eye', 'dark'];
        const themeLabels = {
            'default': '护眼模式',
            'eye': '暗夜模式',
            'dark': '纸质浅色'
        };
        let currentThemeIndex = 0;

        function toggleTheme() {
            currentThemeIndex = (currentThemeIndex + 1) % themes.length;
            const theme = themes[currentThemeIndex];
            if (theme === 'default') {
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', theme);
            }
            document.getElementById('themeText').textContent = themeLabels[theme];
            localStorage.setItem('math_note_theme', theme);
        }

        const savedTheme = localStorage.getItem('math_note_theme');
        if (savedTheme && themes.includes(savedTheme)) {
            currentThemeIndex = themes.indexOf(savedTheme);
            if (savedTheme !== 'default') {
                document.documentElement.setAttribute('data-theme', savedTheme);
            }
            document.getElementById('themeText').textContent = themeLabels[savedTheme];
        }
    </script>
</body>
</html>`;
}

function main() {
    const cwd = process.cwd();
    const files = fs.readdirSync(cwd).filter(f => f.endsWith('.md') && !f.startsWith('.'));
    console.log(`找到 ${files.length} 个 Markdown 笔记文件:`, files);

    const fileMetaList = files.map(f => ({
        filename: f,
        title: f.replace(/\.md$/, ''),
        htmlName: f.replace(/\.md$/, '.html')
    }));

    for (const f of fileMetaList) {
        const mdPath = path.join(cwd, f.filename);
        const htmlPath = path.join(cwd, f.htmlName);
        const content = fs.readFileSync(mdPath, 'utf8');
        console.log(`正在渲染: ${f.filename} -> ${f.htmlName}...`);
        const html = renderMarkdownToHtml(content, f.title, fileMetaList);
        fs.writeFileSync(htmlPath, html, 'utf8');
        console.log(`成功生成: ${htmlPath}`);
    }

    // 默认使用 00 总纲清单作为 index.html 方便开箱即开
    const defaultHome = fileMetaList.find(f => f.htmlName.includes('00')) || fileMetaList.find(f => f.htmlName.includes('01')) || fileMetaList[0];
    if (defaultHome && fs.existsSync(path.join(cwd, defaultHome.htmlName))) {
        fs.copyFileSync(path.join(cwd, defaultHome.htmlName), path.join(cwd, 'index.html'));
        console.log(`已同步首页: index.html -> ${defaultHome.htmlName}`);
    }
}

if (require.main === module) {
    main();
}

module.exports = { renderMarkdownToHtml };
