const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('pdf-upload');
const output = document.getElementById('output');
const loading = document.getElementById('loading');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('bg-blue-50');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('bg-blue-50'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('bg-blue-50');
    handleFiles(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', (e) => handleFiles(e.target.files[0]));

const downloadAllBtn = document.getElementById('download-all');
let imageUrls = [];

const loadingText = document.getElementById('loading');
let cancelRequested = false;

async function handleFiles(file) {
    if (!file || file.type !== 'application/pdf') return;

    cancelRequested = false;
    loadingText.classList.remove('hidden');
    loadingText.textContent = '📥 処理開始中...';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    imageUrls = []; // 画像URLをリセット

    for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelRequested) break;
        loadingText.textContent = `📄 ${i}/${pdf.numPages} ページ変換中...`;

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 }); // 解像度そのまま
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;

        const imageURL = canvas.toDataURL('image/png');
        imageUrls.push({ url: imageURL, name: `page-${i}.png` });

        // 少し待機してメモリ開放の猶予を（スマホ対策）
        await new Promise(res => setTimeout(res, 100));
    }

    loadingText.textContent = '✅ 変換完了しました！';
    downloadAllBtn.classList.remove('hidden');
}

downloadAllBtn.addEventListener('click', async () => {
    for (const { url, name } of imageUrls) {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);

        // 順番にダウンロードを開始
        a.click();

        // ダウンロード間に少し待機
        await new Promise(res => setTimeout(res, 500));

        document.body.removeChild(a);
    }
});
