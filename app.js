const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('pdf-upload');
const output = document.getElementById('output'); // この要素は現在使われていない？必要に応じて見直す
const loading = document.getElementById('loading');
const downloadAllBtn = document.getElementById('download-all');

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('bg-blue-50');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('bg-blue-50');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('bg-blue-50');
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFile(file);
    }
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
    // 同じファイルを選択してもchangeイベントが発火するようにリセット
    e.target.value = null;
});

// --- ★★★ 修正が必要な関数 ★★★ ---
async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') {
        alert('PDFファイルを選択してください。');
        return;
    }

    loading.classList.remove('hidden');
    loading.textContent = '📥 処理準備中...';
    downloadAllBtn.classList.add('hidden'); // 処理中はボタンを隠す

    try {
        const arrayBuffer = await file.arrayBuffer();
        // pdf.jsのWorkerを設定 (パフォーマンス向上とメインスレッドのブロック回避)
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        const zip = new JSZip(); // JSZipインスタンスを作成
        const imagePromises = []; // 各ページの画像生成Promiseを格納する配列

        for (let i = 1; i <= numPages; i++) {
            loading.textContent = `📄 ${i}/${numPages} ページ変換中...`;

            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // 高解像度化 (必要に応じて調整)
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };
            await page.render(renderContext).promise;

            // Promiseを生成し、配列に追加
            const imagePromise = new Promise((resolve) => {
                canvas.toBlob((blob) => {
                    if (blob) {
                        // Zipファイルに画像を追加 (ファイル名を指定)
                        const fileName = `page-${String(i).padStart(3, '0')}.png`; // 0埋め (例: page-001.png)
                        zip.file(fileName, blob);
                        resolve(); // 完了を通知
                    } else {
                        console.error(`ページ ${i} のBlob生成に失敗しました。`);
                        resolve(); // エラーでも次の処理に進むためにresolveする
                    }
                }, 'image/png');
            });
            imagePromises.push(imagePromise);

            // メモリ解放のため、不要になったCanvasとPageオブジェクトをクリーンアップ (任意)
            canvas.width = 0;
            canvas.height = 0;
            page.cleanup();

            // (任意) 短い待機時間を入れてブラウザの負荷を軽減
            await new Promise(res => setTimeout(res, 50));
        }

        // すべての画像生成とZipへの追加が完了するのを待つ
        await Promise.all(imagePromises);

        loading.textContent = '📦 Zipファイル生成中...';

        // Zipファイルを生成
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // ダウンロード用のURLを生成
        const zipUrl = URL.createObjectURL(zipBlob);

        // 「すべて保存」ボタンを設定
        downloadAllBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = zipUrl;
            // 元のファイル名に基づいてZipファイル名を決定 (拡張子を除く)
            const originalFileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            a.download = `${originalFileNameWithoutExt}_images.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // 一度ダウンロードしたらURLを無効化 (メモリリーク防止)
            URL.revokeObjectURL(zipUrl);
            // ダウンロード後はボタンを無効化または非表示にするなど
            // downloadAllBtn.disabled = true;
        };

        loading.textContent = '✅ 変換完了！下のボタンから保存してください。';
        downloadAllBtn.classList.remove('hidden'); // ボタンを表示

    } catch (error) {
        console.error('PDF処理中にエラーが発生しました:', error);
        loading.textContent = `❌ エラーが発生しました: ${error.message}`;
        alert(`エラーが発生しました: ${error.message}`);
    } finally {
        // loadingを完了表示にするか、少し遅れて非表示にするなど
        // setTimeout(() => loading.classList.add('hidden'), 5000);
    }
}

// Service Worker関連のコード (現状のままで良いか確認)
// オフライン対応が不要なら削除しても良い
const cacheName = 'pdf2img-cache-v1';
const assets = [
    '/',
    '/index.html', // 実際のファイル構成に合わせる
    '/app.js',     // 実際のファイル構成に合わせる
    '/manifest.json', // 不要なら削除
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.worker.min.js', // Workerもキャッシュ
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' // JSZipもキャッシュ
];

self.addEventListener('install', (e) => {
    console.log('[Service Worker] Install');
    e.waitUntil(
        caches.open(cacheName).then((cache) => {
            console.log('[Service Worker] Caching all: app shell and content');
            return cache.addAll(assets);
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((r) => {
            console.log('[Service Worker] Fetching resource: ' + e.request.url);
            return r || fetch(e.request).then((response) => {
                return caches.open(cacheName).then((cache) => {
                    console.log('[Service Worker] Caching new resource: ' + e.request.url);
                    cache.put(e.request, response.clone());
                    return response;
                });
            });
        })
    );
});