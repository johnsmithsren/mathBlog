const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORK_DIR = 'g:/考研数学';
const marked = require(path.join(WORK_DIR, 'vendor/marked.min.js'));
const katex = require(path.join(WORK_DIR, 'vendor/katex/katex.min.js'));

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMarkdownBody(mdContent, chapterId) {
    const mathStore = [];
    function saveMath(math, isBlock) {
        const id = mathStore.length;
        const cleaned = String(math)
            .replace(/^[ \t]*>[ \t]?/gm, '')
            .replace(/<\/end\{/g, '\\end{');
        mathStore.push({ math: cleaned, isBlock });
        return isBlock ? `\n\n%%MATH_BLOCK_${chapterId}_${id}%%\n\n` : `%%MATH_INLINE_${chapterId}_${id}%%`;
    }

    // 1. 保护块级公式 $$...$$
    let text = mdContent.replace(/\$\$([\s\S]*?)\$\$/g, (m, g) => saveMath(g, true));

    // 2. 保护行内公式 $...$
    text = text.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (m, prefix, g) => {
        return prefix + saveMath(g, false);
    });

    // 3. marked 解析
    const TILDE_TOKEN = '%%TILDE%%';
    text = text.replace(/~/g, TILDE_TOKEN);
    marked.setOptions({
        gfm: true,
        breaks: false
    });
    let html = marked.parse(text);
    html = html.replace(new RegExp(TILDE_TOKEN, 'g'), '~');

    // 4. 还原公式由 KaTeX 渲染
    html = html.replace(new RegExp(`%%MATH_(BLOCK|INLINE)_${chapterId}_(\\d+)%%`, 'g'), (m, type, id) => {
        const item = mathStore[parseInt(id)];
        if (!item) return m;
        const isBlock = type === 'BLOCK';
        try {
            return katex.renderToString(item.math.trim(), {
                displayMode: isBlock,
                throwOnError: false
            });
        } catch (e) {
            return `<span class="katex-error">[公式解析异常: ${escapeHtml(item.math)}]</span>`;
        }
    });

    return html;
}

function findBrowser() {
    const candidates = [
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Edge/Application/msedge.exe')
    ];
    for (const p of candidates) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
}

async function exportAllToPdf() {
    console.log('=== 考研数学（数学二）PDF 导出工具 ===');
    const files = fs.readdirSync(WORK_DIR)
        .filter(f => f.endsWith('.md'))
        .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true }));

    const baodianFiles = files.filter(f => f.startsWith('【及格宝典】'));
    const tikufiles = files.filter(f => f.startsWith('【及格题库】'));
    const zhuanxiangFiles = files.filter(f => f.startsWith('【真题专项】'));

    console.log(`检索到章节: 宝典 ${baodianFiles.length} 篇, 题库 ${tikufiles.length} 篇, 专项 ${zhuanxiangFiles.length} 篇 (共计 ${files.length} 篇)`);

    const sections = [
        { title: '第一篇：及格保底战略与核心宝典', desc: '考点雷达 · 线性代数与高等数学核心解法 · 客观题秒杀与避坑纪律 · 高频公式错坑手册', files: baodianFiles },
        { title: '第二篇：核心考点必刷题库（附详尽步骤）', desc: '未定型极限 · 二重积分 · 微分方程 · 线性方程组与对角化 · 导数/极值/渐近线专题', files: tikufiles },
        { title: '第三篇：真题同款专项攻坚与全真模拟', desc: '变限积分拆项求导 · 伴随与特征值 · 全真模拟套卷 · 分部积分法秒杀 · 中值定理全景', files: zhuanxiangFiles }
    ];

    let tocHtml = '<div class="toc-container">\n<h2>📑 全书总目录</h2>\n';
    let contentHtml = '';
    let globalChapterIndex = 1;

    for (const sec of sections) {
        tocHtml += `<div class="toc-section-title">${sec.title}</div>\n<div class="toc-section-desc">${sec.desc}</div>\n<ul class="toc-list">\n`;
        
        for (const file of sec.files) {
            const rawTitle = file.replace(/\.md$/, '');
            const chapterAnchor = `chap-${globalChapterIndex}`;
            tocHtml += `  <li><a href="#${chapterAnchor}"><span class="toc-num">${String(globalChapterIndex).padStart(2, '0')}</span> ${escapeHtml(rawTitle)}</a></li>\n`;

            const filePath = path.join(WORK_DIR, file);
            const mdContent = fs.readFileSync(filePath, 'utf8');
            const renderedBody = renderMarkdownBody(mdContent, globalChapterIndex);

            contentHtml += `
            <section class="book-chapter" id="${chapterAnchor}">
                <div class="chapter-header">
                    <div class="chapter-category">${sec.title.split('：')[0]}</div>
                    <div class="chapter-badge">第 ${globalChapterIndex} 讲</div>
                    <h1 class="chapter-title">${escapeHtml(rawTitle)}</h1>
                </div>
                <div class="chapter-body">
                    ${renderedBody}
                </div>
            </section>
            `;
            globalChapterIndex++;
        }
        tocHtml += `</ul>\n`;
    }
    tocHtml += '</div>';

    // 拼装完整 HTML 页面
    const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>考研数学（数学二）保底70分全套通关宝典与题库全集</title>
    <link rel="stylesheet" href="./vendor/katex/katex.min.css">
    <style>
        :root {
            --primary: #1e3a8a;
            --primary-light: #eff6ff;
            --accent: #2563eb;
            --text-dark: #0f172a;
            --text-body: #334155;
            --border-line: #cbd5e1;
            --card-bg: #f8fafc;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
            font-size: 15px;
            line-height: 1.75;
            color: var(--text-body);
            background: #ffffff;
            padding: 0;
            margin: 0;
        }

        /* 页面与打印控制 */
        @page {
            size: A4;
            margin: 18mm 14mm 18mm 14mm;
        }

        @media screen {
            body {
                background: #f1f5f9;
                padding: 30px 15px;
            }
            .book-container {
                max-width: 960px;
                margin: 0 auto;
                background: #ffffff;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                border-radius: 8px;
                padding: 40px 50px;
            }
        }

        @media print {
            body {
                background: #ffffff !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .book-container {
                width: 100% !important;
                padding: 0 !important;
                box-shadow: none !important;
            }
            .page-break-always {
                page-break-before: always !important;
                break-before: page !important;
            }
            .book-chapter {
                page-break-before: always !important;
                break-before: page !important;
            }
            .avoid-break {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            h1, h2, h3 {
                page-break-after: avoid !important;
                break-after: avoid !important;
            }
            pre, table, blockquote {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            .no-print {
                display: none !important;
            }
        }

        /* 封面设计 */
        .book-cover {
            min-height: 85vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 60px 20px;
            border-bottom: 3px double #94a3b8;
            margin-bottom: 40px;
        }

        .cover-badge {
            display: inline-block;
            background: #1e3a8a;
            color: #ffffff;
            font-size: 13px;
            font-weight: 700;
            padding: 6px 18px;
            border-radius: 20px;
            letter-spacing: 0.1em;
            margin-bottom: 24px;
        }

        .cover-title {
            font-size: 32px;
            font-weight: 900;
            color: #0f172a;
            line-height: 1.35;
            margin-bottom: 16px;
            letter-spacing: -0.02em;
        }

        .cover-subtitle {
            font-size: 17px;
            color: #475569;
            max-width: 680px;
            margin-bottom: 40px;
            line-height: 1.6;
        }

        .cover-meta {
            margin-top: 40px;
            font-size: 14px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
            width: 80%;
            max-width: 480px;
            display: flex;
            justify-content: space-around;
        }

        .cover-meta-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .cover-meta-label {
            font-size: 12px;
            color: #94a3b8;
            text-transform: uppercase;
        }

        .cover-meta-val {
            font-weight: 600;
            color: #334155;
        }

        /* 目录美化 */
        .toc-container {
            margin-bottom: 50px;
            padding: 30px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            page-break-after: always;
            break-after: page;
        }

        .toc-container h2 {
            font-size: 24px;
            color: #0f172a;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 10px;
            margin-bottom: 24px;
        }

        .toc-section-title {
            font-size: 17px;
            font-weight: 800;
            color: #1e3a8a;
            margin-top: 20px;
            margin-bottom: 4px;
        }

        .toc-section-desc {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 10px;
        }

        .toc-list {
            list-style: none;
            margin-bottom: 15px;
            display: grid;
            grid-template-columns: 1fr;
            gap: 6px;
        }

        .toc-list li a {
            text-decoration: none;
            color: #1e293b;
            font-size: 14px;
            display: flex;
            align-items: center;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background 0.15s;
        }

        .toc-list li a:hover {
            background: #e2e8f0;
            color: #2563eb;
        }

        .toc-num {
            font-weight: 800;
            color: #2563eb;
            margin-right: 12px;
            font-family: monospace;
            background: #dbeafe;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
        }

        /* 章节主体排版 */
        .book-chapter {
            margin-bottom: 60px;
        }

        .chapter-header {
            margin-bottom: 30px;
            padding-bottom: 16px;
            border-bottom: 2px solid #0f172a;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .chapter-category {
            font-size: 13px;
            font-weight: 700;
            color: #2563eb;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .chapter-badge {
            display: inline-block;
            font-size: 12px;
            background: #f1f5f9;
            color: #475569;
            padding: 2px 8px;
            border-radius: 4px;
            width: fit-content;
            font-weight: 600;
        }

        .chapter-title {
            font-size: 24px;
            font-weight: 900;
            color: #0f172a;
            line-height: 1.35;
        }

        /* Markdown 内容正文 */
        .chapter-body h2 {
            font-size: 20px;
            color: #0f172a;
            margin-top: 32px;
            margin-bottom: 14px;
            padding-bottom: 6px;
            border-bottom: 1px solid #e2e8f0;
            font-weight: 800;
        }

        .chapter-body h3 {
            font-size: 16px;
            color: #1e3a8a;
            margin-top: 24px;
            margin-bottom: 10px;
            font-weight: 700;
        }

        .chapter-body h4 {
            font-size: 15px;
            color: #334155;
            margin-top: 18px;
            margin-bottom: 8px;
            font-weight: 700;
        }

        .chapter-body p {
            margin-bottom: 12px;
            text-align: justify;
        }

        .chapter-body ul, .chapter-body ol {
            margin-left: 24px;
            margin-bottom: 14px;
        }

        .chapter-body li {
            margin-bottom: 6px;
        }

        .chapter-body blockquote {
            margin: 16px 0;
            padding: 12px 18px;
            background-color: #f8fafc;
            border-left: 4px solid #2563eb;
            color: #334155;
            border-radius: 0 6px 6px 0;
            font-size: 14.5px;
        }

        .chapter-body blockquote p:last-child {
            margin-bottom: 0;
        }

        .chapter-body table {
            width: 100%;
            border-collapse: collapse;
            margin: 18px 0;
            font-size: 14px;
        }

        .chapter-body th, .chapter-body td {
            border: 1px solid #cbd5e1;
            padding: 8px 12px;
            text-align: left;
        }

        .chapter-body th {
            background-color: #f1f5f9;
            font-weight: 700;
            color: #0f172a;
        }

        .chapter-body tr:nth-child(even) {
            background-color: #f8fafc;
        }

        .chapter-body code {
            font-family: Consolas, Monaco, "Courier New", monospace;
            background: #f1f5f9;
            padding: 2px 5px;
            border-radius: 4px;
            font-size: 0.9em;
            color: #b91c1c;
        }

        .chapter-body pre {
            background: #0f172a;
            color: #e2e8f0;
            padding: 14px 18px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 16px 0;
            font-size: 13.5px;
            line-height: 1.6;
        }

        .chapter-body pre code {
            background: transparent;
            color: inherit;
            padding: 0;
        }

        .chapter-body hr {
            border: 0;
            height: 1px;
            background: #e2e8f0;
            margin: 30px 0;
        }

        /* KaTeX 公式优化 */
        .katex-display {
            margin: 14px 0 !important;
            padding: 8px 12px !important;
            background: #fbfcfe;
            border-radius: 6px;
            overflow-x: auto;
            border: 1px solid #eef2f6;
        }

        .katex {
            font-size: 1.05em !important;
        }

        /* 顶部悬浮控制栏（屏幕查看时可用） */
        .screen-toolbar {
            position: fixed;
            bottom: 24px;
            right: 24px;
            display: flex;
            gap: 10px;
            z-index: 999;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(8px);
            padding: 8px 12px;
            border-radius: 30px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            border: 1px solid #cbd5e1;
        }

        .screen-btn {
            background: #2563eb;
            color: #fff;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .screen-btn:hover {
            background: #1d4ed8;
        }

        .screen-btn-secondary {
            background: #f1f5f9;
            color: #334155;
        }
        .screen-btn-secondary:hover {
            background: #e2e8f0;
        }
    </style>
</head>
<body>
    <div class="screen-toolbar no-print">
        <button class="screen-btn" onclick="window.print()">🖨️ 打印 / 另存为 PDF</button>
        <a class="screen-btn screen-btn-secondary" href="#chap-1">📖 直达正文</a>
    </div>

    <div class="book-container">
        <!-- 封面 -->
        <div class="book-cover">
            <div class="cover-badge">全国硕士研究生招生考试 · 数学（二）</div>
            <h1 class="cover-title">考研数学（数学二）保底70分<br>全套通关宝典与题库全集</h1>
            <p class="cover-subtitle">近五年考情雷达 · 核心机械化大题解法 · 客观题排除秒杀 · 20大易错坑点手册 · 必刷题库15题精解 · 真题压轴攻坚</p>
            <div class="cover-meta">
                <div class="cover-meta-item">
                    <span class="cover-meta-label">整理章节</span>
                    <span class="cover-meta-val">共 24 篇核心讲义</span>
                </div>
                <div class="cover-meta-item">
                    <span class="cover-meta-label">适用目标</span>
                    <span class="cover-meta-val">70~90 分保底冲刺</span>
                </div>
                <div class="cover-meta-item">
                    <span class="cover-meta-label">排版引擎</span>
                    <span class="cover-meta-val">KaTeX 离线高保真</span>
                </div>
            </div>
        </div>

        <!-- 目录 -->
        ${tocHtml}

        <!-- 正文所有章节 -->
        <main>
            ${contentHtml}
        </main>
    </div>
</body>
</html>`;

    const htmlOutputPath = path.join(WORK_DIR, '考研数学二_完整通关宝典与题库全集.html');
    fs.writeFileSync(htmlOutputPath, fullHtml, 'utf8');
    console.log(`✅ 成功合并生成完整电子书 HTML: ${htmlOutputPath}`);

    // 调用浏览器打印成 PDF
    const browser = findBrowser();
    if (!browser) {
        console.warn('⚠️ 未检测到系统内置 Edge/Chrome 浏览器，已生成合并版 HTML，请在浏览器中按 Ctrl+P 另存为 PDF。');
        return;
    }

    const pdfOutputPath = path.join(WORK_DIR, '考研数学二_完整通关宝典与题库全集.pdf');
    console.log(`🚀 正在调用浏览器内核渲染高保真 PDF (${browser})...`);
    console.log('这可能需要 15~30 秒，请稍候...');

    const printCmd = `"${browser}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${pdfOutputPath}" "file:///${htmlOutputPath.replace(/\\/g, '/')}"`;

    try {
        execSync(printCmd, { stdio: 'inherit', timeout: 120000 });
        if (fs.existsSync(pdfOutputPath)) {
            const stats = fs.statSync(pdfOutputPath);
            const mb = (stats.size / 1024 / 1024).toFixed(2);
            console.log(`🎉 PDF 导出成功！`);
            console.log(`📁 文件位置: ${pdfOutputPath}`);
            console.log(`📦 文件大小: ${mb} MB`);
        } else {
            console.error('❌ 未能生成 PDF 文件');
        }
    } catch (err) {
        console.error('执行 PDF 打印异常:', err.message);
    }
}

exportAllToPdf();
